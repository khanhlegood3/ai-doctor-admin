import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Copy, CheckCircle2, Users, UserPlus, Link2, ShieldCheck,
  Loader2, AlertTriangle, Network, Gift, ArrowRight, RefreshCw,
  ExternalLink, Radio,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import {
  getOrCreateReferralCode,
  getReferralFor,
  getReferralsByReferrer,
  saveReferral,
} from '../lib/gameAffiliateDB'
import {
  registerReferralOnChain,
  getGameAffiliateWalletAddress,
  AFFILIATE_CONTRACT_ADDRESS,
  BSCSCAN_TESTNET_BASE_URL,
  getBscScanAddressUrl,
  getBscScanTxUrl,
} from '../lib/gameAffiliateChain'

// =====================================================================================
// ĐĂNG KÝ AFFILIATE 3 TẦNG (UUID) — tham khảo mô hình dashboard Affiliate của
// refearnapp (apps/dashboard: "Affiliate Links", "My Referrals", % hoa hồng
// hiển thị ngay đầu trang) nhưng đơn giản hoá cho AI Doctor Admin:
//   - Không cần backend riêng: User 1 lấy UUID của mình (định danh duy nhất,
//     ổn định — xem AuthContext) rồi gửi (chat, Zalo, SMS...) cho User 2.
//   - User 2 dán UUID đó vào ô "UUID người giới thiệu" và bấm Đăng ký để tự
//     trở thành F1 của User 1.
//   - Hoa hồng chia 3 tầng NGƯỢC LÊN: F1 10% · F2 5% · F3 2% — đúng
//     levelRates trên smart-contract HienMauAffiliate (xem gameAffiliateChain.js),
//     ghi cả local (IndexedDB, hoạt động ngay/offline) lẫn on-chain (gasless,
//     đồng bộ chéo thiết bị) để 2 người trên 2 máy khác nhau vẫn nối được cây.
// =====================================================================================

const AFFILIATE_STATE_KEY = 'cdoc_affiliate_v1'
const LEVELS = [
  { level: 1, rate: 10, label: 'F1' },
  { level: 2, rate: 5, label: 'F2' },
  { level: 3, rate: 2, label: 'F3' },
]

function loadLocalTree() {
  try {
    const raw = localStorage.getItem(AFFILIATE_STATE_KEY)
    return raw ? JSON.parse(raw) : { users: [] }
  } catch {
    return { users: [] }
  }
}

// Giữ đồng bộ với cây MLM local dùng chung bởi AffiliateSystemPanel.jsx /
// AffiliateReferralLandingPage.jsx (key `cdoc_affiliate_v1`, id dạng `me-{uuid}`)
// để 2 màn hình Affiliate trong app hiển thị cùng 1 dữ liệu.
function linkLocalTree({ referrerUuid, refereeUuid, refereeName }) {
  const state = loadLocalTree()
  const users = Array.isArray(state.users) ? [...state.users] : []
  const parentId = `me-${referrerUuid}`
  const childId = `me-${refereeUuid}`
  if (!users.some((u) => u.id === parentId)) {
    users.push({ id: parentId, name: 'Người giới thiệu (UUID)', parentId: null, balances: { VND: 0, VIET: 0, PI: 0 } })
  }
  const childIdx = users.findIndex((u) => u.id === childId)
  const childUser = { id: childId, name: refereeName || 'Thành viên mới', parentId, balances: { VND: 0, VIET: 0, PI: 0 } }
  if (childIdx >= 0) users[childIdx] = { ...users[childIdx], parentId, name: refereeName || users[childIdx].name }
  else users.push(childUser)
  try { localStorage.setItem(AFFILIATE_STATE_KEY, JSON.stringify({ ...state, users })) } catch { /* ignore quota errors */ }
}

function shortUuid(uuid) {
  if (!uuid) return '—'
  return uuid.length > 14 ? `${uuid.slice(0, 8)}…${uuid.slice(-6)}` : uuid
}

// ─── Backend dùng chung (MongoDB qua /api/affiliate-referral) ─────────────
// IndexedDB/localStorage chỉ tồn tại TRÊN TỪNG THIẾT BỊ — nếu User 2 đăng ký
// trên máy của họ, User 1 mở app trên máy khác sẽ không có dữ liệu đó trong
// IndexedDB cục bộ. Gọi API này để cả 2 phía luôn thấy đúng quan hệ dù khác
// thiết bị/trình duyệt. Local (IndexedDB) + on-chain vẫn được ghi song song
// làm cache ngoại tuyến / minh bạch, nhưng server là nguồn hiển thị chính.
async function fetchServerUpline(uuid) {
  try {
    const res = await fetch(`/api/affiliate-referral?referee=${encodeURIComponent(uuid)}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.item || null
  } catch { return null }
}

async function fetchServerDownline(uuid) {
  try {
    const res = await fetch(`/api/affiliate-referral?referrer=${encodeURIComponent(uuid)}`)
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.items) ? data.items : []
  } catch { return [] }
}

async function postServerReferral({ referrerUuid, refereeUuid, code, source }) {
  const res = await fetch('/api/affiliate-referral', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referrerUuid, refereeUuid, code, source }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Lỗi máy chủ (${res.status})`)
  return data // { item, alreadyExisted }
}

export default function AffiliateUUIDReferralPanel() {
  const { user } = useAuth()
  const { theme, t } = useApp()
  const isDark = theme === 'dark'
  const myUuid = user?.uuid || null

  const [myCode, setMyCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [upline, setUpline] = useState(null) // { referrerUuid, ... } nếu tôi đã có người giới thiệu
  const [downline, setDownline] = useState([]) // F1 trực tiếp của tôi
  const [inputUuid, setInputUuid] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [chainStatus, setChainStatus] = useState(null) // 'pending' | 'synced' | 'failed' | 'skipped'
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }

  // Ví ẩn danh on-chain tương ứng với UUID này — dùng để dựng link BscScan
  // Testnet, giống cách xem 1 địa chỉ trên Moralis / BscScan explorer.
  const myWalletAddress = useMemo(() => (myUuid ? getGameAffiliateWalletAddress(myUuid) : null), [myUuid])

  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/10'
  const textDim = isDark ? 'text-white/50' : 'text-slate-500'
  const textMain = isDark ? 'text-slate-100' : 'text-slate-900'

  const refresh = useCallback(async () => {
    if (!myUuid) return
    const code = await getOrCreateReferralCode(myUuid)
    setMyCode(code)

    // 1) LUÔN kiểm tra MongoDB (server) TRƯỚC — đây là nguồn sự thật dùng
    // chung cho mọi thiết bị. Không còn ưu tiên IndexedDB local nữa.
    let serverUpline = await fetchServerUpline(myUuid)

    // 2) Auto-migrate: nếu máy này có 1 quan hệ "upline" cũ trong IndexedDB
    // (đăng ký từ TRƯỚC KHI có backend Mongo) nhưng Mongo chưa hề biết đến
    // nó, tự động đẩy quan hệ đó lên Mongo đúng 1 lần. Đây chính là ca của
    // bug vừa gặp: user đã bấm "Đăng ký" ở bản cũ (chỉ lưu local), giờ lên
    // bản mới cần tự "hợp thức hoá" quan hệ đó vào Mongo để referrer ở thiết
    // bị khác cũng thấy được, thay vì cứ hiển thị mãi theo local mà Mongo
    // không hề hay biết.
    if (!serverUpline) {
      const localUpline = await getReferralFor(myUuid)
      if (localUpline?.referrerUuid) {
        try {
          const migrated = await postServerReferral({
            referrerUuid: localUpline.referrerUuid,
            refereeUuid: myUuid,
            code: localUpline.code || code,
            source: localUpline.source ? `${localUpline.source}_migrated` : 'uuid_manual_migrated',
          })
          serverUpline = migrated.item
        } catch {
          // Không migrate được (vd offline) — KHÔNG hiển thị local như đã xác
          // nhận, để tránh lặp lại chính bug vừa gặp; để trống, người dùng
          // bấm "Làm mới" hoặc đăng ký lại khi có mạng.
        }
      }
    }

    const serverDownline = await fetchServerDownline(myUuid)
    setUpline(serverUpline)
    setDownline(serverDownline)
  }, [myUuid])

  useEffect(() => { refresh() }, [refresh])

  const handleCopyUuid = async () => {
    if (!myUuid) return
    try {
      await navigator.clipboard.writeText(myUuid)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore clipboard errors (unsupported/insecure context) */ }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setMessage(null)
    const referrerUuid = inputUuid.trim()
    if (!myUuid) {
      setMessage({ type: 'error', text: 'Bạn cần đăng nhập (kể cả ẩn danh) để có UUID trước khi đăng ký.' })
      return
    }
    if (!referrerUuid) {
      setMessage({ type: 'error', text: 'Vui lòng dán UUID của người giới thiệu bạn.' })
      return
    }
    if (referrerUuid === myUuid) {
      setMessage({ type: 'error', text: 'Không thể tự giới thiệu chính mình.' })
      return
    }
    if (upline) {
      setMessage({ type: 'error', text: `Bạn đã có người giới thiệu (${shortUuid(upline.referrerUuid)}) từ trước — không thể đổi tuyến trên.` })
      return
    }

    setSubmitting(true)
    setChainStatus('pending')
    try {
      // 1) Ghi lên server (MongoDB) trước — đây là nguồn dữ liệu mà CẢ 2 phía
      // (referrer & referee) sẽ đọc để hiển thị, bất kể đang ở thiết bị nào.
      const serverResult = await postServerReferral({ referrerUuid, refereeUuid: myUuid, code: myCode, source: 'uuid_manual' })
      if (serverResult.alreadyExisted && serverResult.item?.referrerUuid !== referrerUuid) {
        setMessage({ type: 'error', text: `Bạn đã có người giới thiệu khác (${shortUuid(serverResult.item.referrerUuid)}) từ trước — không thể đổi tuyến trên.` })
        setChainStatus(null)
        await refresh()
        return
      }

      // 2) Ghi cache local (IndexedDB) + cây MLM local để 2 màn hình Affiliate
      // trong app hiển thị nhất quán ngay cả khi offline.
      const saved = await saveReferral({ referrerUuid, refereeUuid: myUuid, code: myCode, source: 'uuid_manual' })
      linkLocalTree({ referrerUuid, refereeUuid: myUuid, refereeName: user?.name })

      // 3) Ghi quan hệ referral lên chain (gasless) để minh bạch/đối soát —
      // best-effort: nếu lỗi (vd chưa cấu hình Pimlico API key thật) vẫn giữ
      // nguyên quan hệ đã lưu ở server, chỉ báo trạng thái "chưa đồng bộ on-chain".
      const chainResult = await registerReferralOnChain({ id: saved?.id, referrerUuid, refereeUuid: myUuid })
      setChainStatus(chainResult.ok ? 'synced' : 'failed')

      setMessage({
        type: 'success',
        text: chainResult.ok
          ? `Đăng ký thành công! Bạn là F1 của ${shortUuid(referrerUuid)}. Hoa hồng 3 tầng (F1 10% · F2 5% · F3 2%) đã được kích hoạt trên chain.`
          : `Đăng ký thành công! Bạn là F1 của ${shortUuid(referrerUuid)}. Đồng bộ on-chain sẽ tự thử lại sau.`,
      })
      setInputUuid('')
      await refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Có lỗi xảy ra khi đăng ký.' })
      setChainStatus('failed')
    } finally {
      setSubmitting(false)
    }
  }

  const referralShareText = useMemo(() => (
    myUuid ? `UUID của tôi: ${myUuid}\nDán mã này vào mục "Đăng Ký Affiliate 3 Tầng" trong AI Doctor để trở thành F1 của tôi.` : ''
  ), [myUuid])

  const handleCopyShareText = async () => {
    if (!referralShareText) return
    try {
      await navigator.clipboard.writeText(referralShareText)
      setMessage({ type: 'success', text: 'Đã sao chép tin nhắn mời — dán vào Zalo/SMS/Chat để gửi cho người bạn muốn giới thiệu.' })
    } catch { /* ignore */ }
  }

  return (
    <div className={`mx-auto max-w-4xl px-4 py-6 pb-28 md:px-8 md:py-10 ${textMain}`}>
      <div className="mb-6">
        <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${isDark ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' : 'border-cyan-500/30 bg-cyan-50 text-cyan-700'}`}>
          <Link2 size={13} /> Đăng Ký Affiliate 3 Tầng
        </div>
        <h1 className="text-2xl font-black md:text-3xl">Chia sẻ UUID — Đăng ký giới thiệu</h1>
        <p className={`mt-1 text-sm ${textDim}`}>Lấy UUID của bạn gửi cho người khác (User 2), hoặc dán UUID người đã giới thiệu bạn để tham gia hệ thống affiliate đa tầng.</p>
      </div>

      {/* Banner hoa hồng — tham khảo cách refearnapp hiển thị ngay đầu trang Links: "Share your links and earn X% commission" */}
      <div className={`mb-6 rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-3"><Gift size={18} className="text-emerald-400" /><span className="font-bold text-sm">Chia sẻ UUID và nhận hoa hồng 3 tầng</span></div>
        <div className="grid grid-cols-3 gap-3">
          {LEVELS.map((l) => (
            <div key={l.level} className={`rounded-xl border p-3 text-center ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-black/[0.02]'}`}>
              <div className="text-2xl font-black text-emerald-400">{l.rate}%</div>
              <div className={`text-xs font-bold ${textDim}`}>{l.label} · tầng {l.level}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* User 1: lấy UUID của mình để gửi đi */}
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-3"><ShieldCheck size={18} className="text-cyan-400" /><span className="font-bold text-sm">UUID của bạn</span></div>
          <p className={`mb-3 text-xs ${textDim}`}>Gửi UUID này cho người bạn muốn mời (User 2). Họ dán vào ô bên cạnh để tự động trở thành F1 của bạn.</p>
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${isDark ? 'border-white/10 bg-black/30' : 'border-black/10 bg-black/[0.03]'}`}>
            <input readOnly value={myUuid || 'Đang tạo UUID…'} className="w-full truncate bg-transparent text-xs font-mono outline-none" />
            <button type="button" onClick={handleCopyUuid} disabled={!myUuid} className="shrink-0 rounded-lg bg-cyan-500/15 border border-cyan-500/30 p-1.5 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-50">
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <button
            type="button"
            onClick={handleCopyShareText}
            disabled={!myUuid}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold py-2.5 hover:bg-cyan-500/20 transition disabled:opacity-50"
          >
            <Copy size={13} /> Sao chép tin nhắn mời (kèm hướng dẫn)
          </button>

          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/[0.02] px-3 py-2 text-xs">
            <span className={`flex items-center gap-1.5 ${textDim}`}><Users size={13} /> F1 trực tiếp của bạn</span>
            <b>{downline.length} người</b>
          </div>
        </div>

        {/* User 2: dán UUID người giới thiệu để đăng ký */}
        <div className={`rounded-2xl border p-5 ${card}`}>
          <div className="flex items-center gap-2 mb-3"><UserPlus size={18} className="text-violet-400" /><span className="font-bold text-sm">Đăng ký làm F1 của người khác</span></div>

          {upline ? (
            <div className={`rounded-xl border p-3 text-xs ${isDark ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-500/30 bg-emerald-50 text-emerald-700'}`}>
              <div className="flex items-center gap-1.5 font-bold mb-1"><CheckCircle2 size={13} /> Bạn đã là F1 của:</div>
              <div className="font-mono">{shortUuid(upline.referrerUuid)}</div>
              <div className={`mt-1 ${textDim}`}>{upline.chainStatus === 'synced' ? 'Đã đồng bộ on-chain ✓' : upline.chainStatus === 'failed' ? 'Chưa đồng bộ on-chain — sẽ tự thử lại' : 'Đang chờ đồng bộ on-chain…'}</div>
              {upline.txHash && (
                <a href={getBscScanTxUrl(upline.txHash)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-bold text-cyan-400 hover:underline">
                  <ExternalLink size={11} /> Xem giao dịch trên BscScan Testnet
                </a>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              <input
                value={inputUuid}
                onChange={(e) => setInputUuid(e.target.value)}
                placeholder="Dán UUID người giới thiệu bạn (vd: 8f2a1c9e-...)"
                className={`w-full rounded-xl border px-3 py-2.5 text-xs font-mono bg-transparent outline-none ${isDark ? 'border-white/15' : 'border-black/15'}`}
              />
              <button
                type="submit"
                disabled={submitting || !myUuid}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-bold py-2.5 hover:bg-violet-500/25 transition disabled:opacity-60"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {submitting ? 'Đang đăng ký…' : 'Đăng ký Affiliate'}
              </button>
            </form>
          )}

          {message && (
            <div className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${message.type === 'success' ? (isDark ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : 'border-emerald-500/30 bg-emerald-50 text-emerald-700') : (isDark ? 'border-red-500/25 bg-red-500/10 text-red-300' : 'border-red-500/30 bg-red-50 text-red-600')}`}>
              {message.type === 'error' && <AlertTriangle size={12} className="inline mr-1" />}
              {message.text}
            </div>
          )}
        </div>
      </div>

      {/* Giám sát On-chain — link BscScan Testnet, xem trực tiếp như Moralis/
          BSC testnet explorer, không cần công cụ riêng: địa chỉ contract
          HienMauAffiliate + ví ẩn danh gắn với UUID của bạn. */}
      <div className={`mt-5 rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center gap-2 mb-3"><Radio size={18} className="text-emerald-400" /><span className="font-bold text-sm">Giám sát On-chain (BscScan Testnet)</span></div>
        <div className="space-y-2 text-xs">
          <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-black/[0.02]'}`}>
            <div>
              <div className={textDim}>Ví on-chain của bạn</div>
              <div className="font-mono mt-0.5">{myWalletAddress ? shortUuid(myWalletAddress) : '—'}</div>
            </div>
            {myWalletAddress && (
              <a href={getBscScanAddressUrl(myWalletAddress)} target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1.5 font-bold text-emerald-400 hover:bg-emerald-500/25">
                <ExternalLink size={12} /> Xem
              </a>
            )}
          </div>
          <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-black/[0.02]'}`}>
            <div>
              <div className={textDim}>Smart contract HienMauAffiliate</div>
              <div className="font-mono mt-0.5">{shortUuid(AFFILIATE_CONTRACT_ADDRESS)}</div>
            </div>
            <a href={getBscScanAddressUrl(AFFILIATE_CONTRACT_ADDRESS)} target="_blank" rel="noreferrer" className="shrink-0 flex items-center gap-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-1.5 font-bold text-cyan-400 hover:bg-cyan-500/25">
              <ExternalLink size={12} /> Xem
            </a>
          </div>
        </div>
        <p className={`mt-3 text-[11px] ${textDim}`}>Mở trực tiếp trên {BSCSCAN_TESTNET_BASE_URL.replace('https://', '')} để xem lịch sử giao dịch, số dư và sự kiện on-chain (ReferralRegistered, CommissionPaid…) — không cần API key, tương tự cách xem trên Moralis Explorer.</p>
      </div>

      {/* Danh sách F1 đã giới thiệu — tham khảo bảng "My Referrals" của refearnapp */}
      <div className={`mt-5 rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Network size={18} className="text-cyan-400" /><span className="font-bold text-sm">F1 đã giới thiệu qua UUID</span></div>
          <button type="button" onClick={refresh} className={`text-xs ${textDim} hover:text-cyan-400 flex items-center gap-1`}><RefreshCw size={12} /> Làm mới</button>
        </div>
        {downline.length === 0 ? (
          <p className={`text-xs ${textDim}`}>Chưa có ai đăng ký dưới UUID của bạn. Hãy gửi UUID ở trên cho bạn bè!</p>
        ) : (
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {downline.map((r) => (
              <div key={r.id || r._id || r.refereeUuid} className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'}`}>
                <span className="font-mono">{shortUuid(r.refereeUuid)}</span>
                <span className="flex items-center gap-1.5">
                  {r.txHash && (
                    <a href={getBscScanTxUrl(r.txHash)} target="_blank" rel="noreferrer" title="Xem giao dịch trên BscScan Testnet" className="text-cyan-400 hover:text-cyan-300">
                      <ExternalLink size={11} />
                    </a>
                  )}
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.chainStatus === 'synced' ? 'bg-emerald-500/20 text-emerald-300' : r.chainStatus === 'failed' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                    {r.chainStatus === 'synced' ? 'On-chain' : r.chainStatus === 'failed' ? 'Chờ đồng bộ' : 'Đang xử lý'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
        <p className={`mt-3 text-[11px] ${textDim}`}>Xem chi tiết hoa hồng, sổ cái minh bạch và cây thành viên đầy đủ tại mục “{t ? t('affiliate') || 'Affiliate & Earn Đa Tầng' : 'Affiliate & Earn Đa Tầng'}”.</p>
      </div>
    </div>
  )
}
