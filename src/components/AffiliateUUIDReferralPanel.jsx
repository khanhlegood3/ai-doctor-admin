import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  deleteReferralFor,
} from '../lib/gameAffiliateDB'
import {
  registerReferralOnChain,
  getGameAffiliateWalletAddress,
  AFFILIATE_CONTRACT_ADDRESS,
  BSCSCAN_TESTNET_BASE_URL,
  getBscScanAddressUrl,
  getBscScanTxUrl,
} from '../lib/gameAffiliateChain'
import { fetchUnifiedHistory } from '../services/moralisService'
import QRCode from 'qrcode'

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
// AffiliateSystemControlPanel.jsx (key `cdoc_affiliate_v1`, id dạng `me-{uuid}`)
// để các màn hình Affiliate trong app hiển thị cùng 1 dữ liệu.
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

// Phòng hờ trường hợp Mongo có nhiều doc trùng cho cùng 1 refereeUuid (vd do
// race condition lúc test/đăng ký liên tiếp) — chỉ giữ 1 dòng/refereeUuid khi
// hiển thị, ưu tiên dòng đã 'synced' nếu có.
function dedupeByReferee(rows) {
  const map = new Map()
  for (const r of rows) {
    const key = r.refereeUuid
    if (!key) continue
    const existing = map.get(key)
    if (!existing || (r.chainStatus === 'synced' && existing.chainStatus !== 'synced')) {
      map.set(key, r)
    }
  }
  return Array.from(map.values())
}

// ─── Hiện User ID (duy nhất toàn hệ thống) thay vì chỉ 1 chuỗi UUID vô
// nghĩa, ở MỌI nơi cây affiliate hiển thị 1 UUID (tuyến trên, F1/F2/F3) —
// Mức 3 chống giả mạo áp dụng xuyên suốt màn hình, không chỉ ở lúc đăng ký.
// Cache ở module-scope (không phải state) vì rất nhiều dòng có thể cùng
// tra 1 UUID trong 1 lần render (vd F2 xuất hiện nhiều lần qua các F1 khác
// nhau) — tránh gọi API lặp lại không cần thiết.
const uuidIdentityCache = new Map() // uuid -> { userId } | null
function UuidIdentityLabel({ uuid, textDim }) {
  const [info, setInfo] = useState(() => (uuidIdentityCache.has(uuid) ? uuidIdentityCache.get(uuid) : undefined))
  useEffect(() => {
    if (!uuid) return
    if (uuidIdentityCache.has(uuid)) { setInfo(uuidIdentityCache.get(uuid)); return }
    let cancelled = false
    fetch(`/api/user-profile?uuid=${encodeURIComponent(uuid)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const resolved = data?.userId ? { userId: data.userId } : null
        uuidIdentityCache.set(uuid, resolved)
        if (!cancelled) setInfo(resolved)
      })
      .catch(() => { if (!cancelled) setInfo(null) })
    return () => { cancelled = true }
  }, [uuid])
  return (
    <span className="font-mono">
      {info?.userId ? `@${info.userId}` : shortUuid(uuid)}
      {info?.userId && <span className={textDim}> · {shortUuid(uuid)}</span>}
    </span>
  )
}

// Nhãn ngắn gọn "@UserId (uuid rút gọn)" dùng cho các dòng THÔNG BÁO DẠNG
// TEXT (message/confirm) — nơi không thể render component <UuidIdentityLabel/>
// (JSX). Tra theo thứ tự: userId truyền tay nếu đã biết chắc (vd
// resolvedReferrer khi vừa xác minh xong) → cache module-scope (đã từng tra
// qua UuidIdentityLabel/effect resolveReferrer trong phiên này) → cuối cùng
// mới rơi về UUID rút gọn nếu chưa tra được User ID.
function identityText(uuid, knownUserId) {
  if (knownUserId) return `@${knownUserId} (${shortUuid(uuid)})`
  const cached = uuidIdentityCache.get(uuid)
  if (cached?.userId) return `@${cached.userId} (${shortUuid(uuid)})`
  return shortUuid(uuid)
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

// Đồng bộ lại chainStatus/txHash lên Mongo SAU KHI registerReferralOnChain()
// chạy xong — nếu bỏ bước này, doc trên Mongo (nguồn hiển thị chính) sẽ mãi
// kẹt ở "pending" dù ví đã đăng ký xong trên chain thật.
async function patchServerReferral({ refereeUuid, chainStatus, txHash }) {
  try {
    const res = await fetch('/api/affiliate-referral', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refereeUuid, chainStatus, txHash }),
    })
    const data = await res.json().catch(() => ({}))
    return res.ok ? data?.item || null : null
  } catch { return null }
}

// Gỡ 1 quan hệ SAI/rác (vd migrate nhầm dữ liệu test cũ) — chỉ server chấp
// nhận xoá khi chainStatus CHƯA 'synced'.
async function deleteServerReferral(refereeUuid) {
  const res = await fetch('/api/affiliate-referral', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refereeUuid }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data?.error || `Lỗi máy chủ (${res.status})`)
  return data // { deleted: true }
}

export default function AffiliateUUIDReferralPanel() {
  const { user } = useAuth()
  const { theme, t } = useApp()
  const isDark = theme === 'dark'
  const myUuid = user?.uuid || null

  const [myCode, setMyCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [referralQrDataUrl, setReferralQrDataUrl] = useState('')
  const [upline, setUpline] = useState(null) // { referrerUuid, ... } nếu tôi đã có người giới thiệu
  const [uplineChecked, setUplineChecked] = useState(false) // true sau khi đã hỏi server ít nhất 1 lần — phân biệt "chưa kiểm tra" với "xác nhận chưa có upline"
  const [downline, setDownline] = useState([]) // F1 trực tiếp của tôi
  const [downlineF2, setDownlineF2] = useState([]) // F2 — do các F1 của tôi giới thiệu
  const [downlineF3, setDownlineF3] = useState([]) // F3 — do các F2 của tôi giới thiệu
  const [inputUuid, setInputUuid] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [chainStatus, setChainStatus] = useState(null) // 'pending' | 'synced' | 'failed' | 'skipped'
  const [message, setMessage] = useState(null) // { type: 'success'|'error', text }
  // Tên người giới thiệu — CHỈ có khi User 2 đến từ link giới thiệu (?ref=&
  // refName=), do chính User 1 tự khai lúc tạo link (xem myReferralLink bên
  // dưới). App không có "danh bạ" tên theo UUID dùng chung nhiều thiết bị,
  // nên đây là cách đơn giản nhất để hiện tên và tránh nhầm UUID.
  const [pendingReferrerName, setPendingReferrerName] = useState('')
  const [pendingReferrerUserId, setPendingReferrerUserId] = useState('')

  // ─── Chống giả mạo Mức 3 + 4 ────────────────────────────────────────────
  // KHÔNG BAO GIỜ tin trực tiếp refName/refId lấy từ query string để hiển
  // thị xác nhận "đang đăng ký làm F1 của ai" — 2 tham số đó chỉ do chính
  // người tạo link tự khai, ai cũng có thể sửa tay trên URL để giả danh 1
  // người nổi tiếng/đáng tin trong khi UUID thật (nơi hoa hồng thực sự chảy
  // vào) lại là của kẻ tấn công. Mỗi khi UUID người giới thiệu đổi (gõ tay
  // hoặc từ link), LUÔN tra lại NGAY TỪ SERVER theo đúng UUID, và ưu tiên
  // hiển thị User ID (duy nhất toàn hệ thống, được bảo vệ bởi "khoá sở hữu"
  // ở api/user-profile.js — xem AuthContext.jsx) thay vì Tên hiển thị (name,
  // KHÔNG duy nhất, ai cũng tự đặt trùng ai đó).
  const [resolvedReferrer, setResolvedReferrer] = useState(null) // { name, userId, verified } | null
  const [resolvingReferrer, setResolvingReferrer] = useState(false)
  const [referrerNotFound, setReferrerNotFound] = useState(false) // UUID này CHƯA có hồ sơ nào trong hệ thống
  const referrerCacheRef = useRef({}) // { [uuid]: { name, verified, userId } | 'not_found' }
  // Ô nhập giờ nhận CẢ UUID lẫn User ID (2 dạng phân biệt bằng dấu "-" —
  // UUID định dạng HEALTH-... luôn có "-", User ID theo USER_ID_REGEX thì
  // không bao giờ có) — actualReferrerUuid là UUID THẬT sau khi phân giải,
  // dùng để đăng ký/ghi quan hệ referral (toàn bộ backend vẫn vận hành theo
  // UUID); inputUuid chỉ là giá trị thô người dùng gõ/dán.
  const [actualReferrerUuid, setActualReferrerUuid] = useState('')
  // true nếu inputUuid đến từ link giới thiệu (?ref=...), false nếu người
  // dùng tự gõ/dán tay — dùng để quyết định có tự động đăng ký F1 hay không
  // (xem effect "Tự động đăng ký F1" bên dưới).
  const [referralFromLink, setReferralFromLink] = useState(false)
  // true nếu UUID/User ID người giới thiệu (dù gõ tay hay điền sẵn từ link)
  // TRÙNG với chính người đang đăng ký (myUuid/user.userId) — vd User 2 lỡ
  // mở đúng link giới thiệu do CHÍNH mình tạo ra. Phải cảnh báo + chặn NGAY
  // (không chờ bấm nút), và effect "Tự động đăng ký F1" cũng phải bỏ qua
  // trường hợp này — bấm "Tiếp tục với Google" lúc này chỉ là ĐĂNG NHẬP xác
  // nhận danh tính, không phải hành động "tự đăng ký làm F1 của chính mình".
  const [isSelfReferral, setIsSelfReferral] = useState(false)

  useEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem('cdoc_pending_referral') || 'null')
      if (!pending?.uuid) return
      setInputUuid((current) => {
        if (current) return current
        if (pending.uuid !== myUuid) setReferralFromLink(true) // KHÔNG bật cờ này khi là link của chính mình — effect tự động đăng ký F1 phải bỏ qua
        return pending.uuid
      })
      setPendingReferrerName(pending.name || '')
      setPendingReferrerUserId(pending.userId || '')
    } catch { /* ignore */ }
  }, [myUuid])

  // Tra lại danh tính người giới thiệu NGAY TỪ SERVER mỗi khi giá trị ô nhập
  // (gõ tay hoặc điền sẵn từ link) đổi — đây là bước xác nhận thật, refName/
  // refId từ URL chỉ là gợi ý optimistic ở trên. Debounce 400ms giống các chỗ
  // tra UUID khác trong app (LoginPage.jsx). Chấp nhận CẢ UUID lẫn User ID:
  // nếu giá trị không chứa "-" (không phải định dạng UUID HEALTH-...), coi là
  // User ID và phân giải ngược ra UUID thật trước, rồi mới tra hồ sơ theo
  // đúng UUID đó như bình thường.
  useEffect(() => {
    const raw = inputUuid.trim()
    // Tự giới thiệu chính mình — cảnh báo NGAY, không tra cứu/không cho đăng
    // ký, dù raw là UUID thô hay User ID của chính người đang đăng ký.
    const selfMatch = !!raw && (raw === myUuid || (user?.userId && raw.toLowerCase() === user.userId.toLowerCase()))
    setIsSelfReferral(selfMatch)
    if (!raw || selfMatch) {
      setResolvedReferrer(null); setReferrerNotFound(false); setResolvingReferrer(false); setActualReferrerUuid('')
      return
    }
    if (raw in referrerCacheRef.current) {
      const cached = referrerCacheRef.current[raw]
      if (cached === 'not_found') { setResolvedReferrer(null); setReferrerNotFound(true); setActualReferrerUuid('') }
      else { setResolvedReferrer(cached.profile); setReferrerNotFound(false); setActualReferrerUuid(cached.uuid) }
      return
    }
    setResolvingReferrer(true)
    const timer = window.setTimeout(async () => {
      try {
        let uuid = raw
        if (!raw.includes('-')) {
          // Dạng User ID — phân giải ngược ra UUID thật trước.
          const idRes = await fetch(`/api/user-profile?userId=${encodeURIComponent(raw)}`)
          const idData = await idRes.json().catch(() => ({}))
          if (!idData?.uuid) {
            referrerCacheRef.current[raw] = 'not_found'
            setResolvedReferrer(null); setReferrerNotFound(true); setActualReferrerUuid('')
            return
          }
          uuid = idData.uuid
        }
        const res = await fetch(`/api/user-profile?uuid=${encodeURIComponent(uuid)}`)
        const data = await res.json().catch(() => ({}))
        const hasProfile = res.ok && (data?.name || data?.userId)
        if (!hasProfile) {
          referrerCacheRef.current[raw] = 'not_found'
          setResolvedReferrer(null); setReferrerNotFound(true); setActualReferrerUuid('')
        } else {
          const resolved = { name: data?.name || '', verified: !!data?.verified, userId: data?.userId || '' }
          referrerCacheRef.current[raw] = { profile: resolved, uuid }
          setResolvedReferrer(resolved); setReferrerNotFound(false); setActualReferrerUuid(uuid)
        }
      } catch {
        // Lỗi mạng — không kết luận "không tồn tại" oan; server (Mức 4) vẫn
        // tự chặn ở bước submit nếu UUID thật sự không có hồ sơ.
        setResolvedReferrer(null); setReferrerNotFound(false); setActualReferrerUuid('')
      } finally {
        setResolvingReferrer(false)
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [inputUuid, myUuid, user?.userId])

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

    // F1 trực tiếp của tôi
    const serverDownline = dedupeByReferee(await fetchServerDownline(myUuid))
    setUpline(serverUpline)
    setUplineChecked(true)
    setDownline(serverDownline)

    // F2: mỗi F1 của tôi cũng có downline riêng của họ — gộp lại thành tầng 2.
    // F3: tương tự, lấy downline của từng F2 vừa gộp được ở trên.
    // Chạy song song (Promise.all) theo từng tầng để không phải chờ tuần tự.
    const f2Groups = await Promise.all(serverDownline.map((f1) => fetchServerDownline(f1.refereeUuid)))
    const serverDownlineF2 = dedupeByReferee(f2Groups.flat())
    setDownlineF2(serverDownlineF2)

    const f3Groups = await Promise.all(serverDownlineF2.map((f2) => fetchServerDownline(f2.refereeUuid)))
    const serverDownlineF3 = dedupeByReferee(f3Groups.flat())
    setDownlineF3(serverDownlineF3)
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

  const handleCopyReferralLink = async () => {
    if (!referralLink) return
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopiedLink(true)
      window.setTimeout(() => setCopiedLink(false), 2000)
    } catch { /* ignore */ }
  }

  const registerAsF1 = async (referrerUuid) => {
    setSubmitting(true)
    setChainStatus('pending')
    try {
      // 1) Ghi lên server (MongoDB) trước — đây là nguồn dữ liệu mà CẢ 2 phía
      // (referrer & referee) sẽ đọc để hiển thị, bất kể đang ở thiết bị nào.
      const serverResult = await postServerReferral({ referrerUuid, refereeUuid: myUuid, code: myCode, source: 'uuid_manual' })
      if (serverResult.alreadyExisted && serverResult.item?.referrerUuid !== referrerUuid) {
        setMessage({ type: 'error', text: `Bạn đã có người giới thiệu khác (${identityText(serverResult.item.referrerUuid)}) từ trước — không thể đổi tuyến trên.` })
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

      // 4) Đồng bộ ngược trạng thái on-chain lên Mongo — nếu bỏ bước này,
      // doc trên server (nguồn hiển thị chính) sẽ mãi kẹt "pending" dù ví đã
      // đăng ký xong trên chain thật, khiến UI hiện sai mãi mãi.
      await patchServerReferral({
        refereeUuid: myUuid,
        chainStatus: chainResult.ok ? 'synced' : 'failed',
        txHash: chainResult.txHash || null,
      })

      setMessage({
        type: 'success',
        text: chainResult.ok
          ? `Đăng ký thành công! Bạn là F1 của ${identityText(referrerUuid, resolvedReferrer?.userId)}. Hoa hồng 3 tầng (F1 10% · F2 5% · F3 2%) đã được kích hoạt trên chain.`
          : `Đăng ký thành công! Bạn là F1 của ${identityText(referrerUuid, resolvedReferrer?.userId)}. Đồng bộ on-chain sẽ tự thử lại sau.`,
      })
      setInputUuid('')
      setPendingReferrerName('')
      try { sessionStorage.removeItem('cdoc_pending_referral') } catch { /* ignore */ }
      await refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Có lỗi xảy ra khi đăng ký.' })
      setChainStatus('failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setMessage(null)
    const referrerUuid = actualReferrerUuid
    if (!myUuid) {
      setMessage({ type: 'error', text: 'Bạn cần đăng nhập (kể cả ẩn danh) để có UUID trước khi đăng ký.' })
      return
    }
    if (!inputUuid.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng dán UUID hoặc User ID của người giới thiệu bạn.' })
      return
    }
    if (isSelfReferral) {
      setMessage({ type: 'error', text: 'Đây là UUID/User ID của chính bạn — không thể tự giới thiệu chính mình. Hãy dán UUID/User ID của người ĐÃ mời bạn.' })
      return
    }
    if (!referrerUuid) {
      setMessage({ type: 'error', text: resolvingReferrer ? 'Đang xác minh, vui lòng đợi một chút…' : 'Chưa xác minh được UUID/User ID này — kiểm tra lại trước khi đăng ký.' })
      return
    }
    if (upline) {
      setMessage({ type: 'error', text: `Bạn đã có người giới thiệu (${identityText(upline.referrerUuid)}) từ trước — không thể đổi tuyến trên.` })
      return
    }
    if (referrerNotFound) {
      setMessage({ type: 'error', text: 'UUID/User ID này chưa có hồ sơ nào trong hệ thống — kiểm tra lại trước khi đăng ký, kẻo hoa hồng bị mất vào 1 định danh không tồn tại.' })
      return
    }
    await registerAsF1(referrerUuid)
  }

  // ─── Tự động đăng ký F1 khi đến từ link giới thiệu ─────────────────────
  // Trước đây User 2 LUÔN phải tự bấm nút "Đăng ký" ở đây sau khi đã tạo
  // tài khoản (kể cả khi đến từ link Affiliate) — nếu họ tạo tài khoản bằng
  // "Tiếp tục với Google" rồi rời trang mà quên bấm nút này, quan hệ F1
  // không bao giờ được ghi nhận dù đã bấm đúng link giới thiệu. Effect này
  // tự làm thay bước bấm "Đăng ký" đó ngay khi đủ điều kiện an toàn: UUID
  // người giới thiệu đến từ link (referralFromLink — vốn KHÔNG bao giờ được
  // bật cho link của chính mình, xem effect điền sẵn ở trên), đã xác minh
  // xong và có hồ sơ thật (actualReferrerUuid, !referrerNotFound,
  // !resolvingReferrer), KHÔNG phải tự giới thiệu chính mình (!isSelfReferral
  // — bấm "Tiếp tục với Google" bằng CHÍNH tài khoản đã tạo link chỉ là đăng
  // nhập xác nhận danh tính, không phải hành động tự đăng ký F1 của chính
  // mình), chưa từng có upline (uplineChecked && !upline), và chưa tự đăng ký
  // lần nào trong phiên này (autoRegisterAttemptedRef).
  const autoRegisterAttemptedRef = useRef(false)
  useEffect(() => {
    if (
      referralFromLink
      && myUuid
      && actualReferrerUuid
      && actualReferrerUuid !== myUuid
      && !isSelfReferral
      && !resolvingReferrer
      && !referrerNotFound
      && uplineChecked
      && !upline
      && !submitting
      && !autoRegisterAttemptedRef.current
    ) {
      autoRegisterAttemptedRef.current = true
      registerAsF1(actualReferrerUuid)
    }
  }, [referralFromLink, myUuid, actualReferrerUuid, isSelfReferral, resolvingReferrer, referrerNotFound, uplineChecked, upline, submitting])

  const [retrying, setRetrying] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [txHistory, setTxHistory] = useState(null) // null = chưa tải; [] = tải rồi nhưng rỗng
  const [loadingTxHistory, setLoadingTxHistory] = useState(false)
  const [txHistoryError, setTxHistoryError] = useState(null)

  // Tải lịch sử giao dịch (Native + ERC-20) của ví on-chain gắn với UUID —
  // hiển thị ngay trong app, giống bảng "Transactions" của Moralis Explorer,
  // thay vì phải mở BscScan mới xem được.
  const handleLoadTxHistory = async () => {
    if (!myWalletAddress) return
    setLoadingTxHistory(true)
    setTxHistoryError(null)
    try {
      const apiKey = import.meta.env.VITE_YOUR_MORALIS_API_KEY
      const rows = await fetchUnifiedHistory(myWalletAddress, apiKey)
      setTxHistory(rows)
    } catch (err) {
      setTxHistoryError(err?.message || 'Không tải được lịch sử giao dịch từ Moralis.')
    } finally {
      setLoadingTxHistory(false)
    }
  }

  // Thử đồng bộ on-chain lại cho quan hệ ĐÃ có ở Mongo nhưng chưa 'synced'
  // (vd bị lỗi mạng lần trước, hoặc quan hệ vừa migrate từ local chưa từng
  // được gửi lên chain).
  const handleRetrySync = async () => {
    if (!upline?.referrerUuid || !myUuid) return
    setRetrying(true)
    setMessage(null)
    try {
      const localRow = await getReferralFor(myUuid)
      const chainResult = await registerReferralOnChain({ id: localRow?.id, referrerUuid: upline.referrerUuid, refereeUuid: myUuid })
      await patchServerReferral({
        refereeUuid: myUuid,
        chainStatus: chainResult.ok ? 'synced' : 'failed',
        txHash: chainResult.txHash || null,
      })
      setMessage({
        type: chainResult.ok ? 'success' : 'error',
        text: chainResult.ok ? 'Đã đồng bộ on-chain thành công!' : `Vẫn chưa đồng bộ được: ${chainResult.error || 'lỗi không rõ'}`,
      })
      await refresh()
    } finally {
      setRetrying(false)
    }
  }

  // Gỡ 1 quan hệ SAI/rác (vd dữ liệu test cũ tự động migrate nhầm lên Mongo)
  // — chỉ khi CHƯA đồng bộ on-chain, để không lệch với dữ liệu trên contract.
  const handleUnlink = async () => {
    if (!upline?.referrerUuid || !myUuid) return
    if (upline.chainStatus === 'synced') {
      setMessage({ type: 'error', text: 'Quan hệ này đã đồng bộ on-chain — không thể tự gỡ nữa.' })
      return
    }
    if (!window.confirm(`Gỡ liên kết "Bạn là F1 của ${identityText(upline.referrerUuid)}"? Chỉ dùng khi đây là dữ liệu sai/dữ liệu test cũ.`)) return
    setUnlinking(true)
    setMessage(null)
    try {
      await deleteServerReferral(myUuid)
      await deleteReferralFor(myUuid)
      setMessage({ type: 'success', text: 'Đã gỡ liên kết. Bạn có thể dán UUID/User ID người giới thiệu đúng để đăng ký lại.' })
      await refresh()
    } catch (err) {
      setMessage({ type: 'error', text: err?.message || 'Không gỡ được liên kết.' })
    } finally {
      setUnlinking(false)
    }
  }

  // Link giới thiệu dựa theo domain đang deploy thực tế (window.location.origin
  // — tự đổi theo môi trường: localhost lúc dev, hienmaunhanvan.com lúc
  // prod...). ?ref= ưu tiên dùng User ID (nếu đã đặt) thay vì UUID thô — User
  // ID an toàn hơn để chia sẻ: DUY NHẤT toàn hệ thống, không dấu, không
  // khoảng trắng, không cần encode, ngắn/dễ đọc/dễ gõ tay hơn UUID rất nhiều.
  // App.jsx phân giải ngược ?ref=<userId> ra đúng UUID trước khi lưu pending
  // referral (xem effect ?ref= trong App.jsx). Nếu CHƯA đặt User ID thì vẫn
  // dùng UUID như cũ để link luôn hoạt động được. refName chỉ là GỢI Ý HIỂN
  // THỊ TẠM (optimistic) lúc trang vừa mở, giúp người nhận thấy ngay "có vẻ
  // đang đăng ký làm F1 của ai" trong lúc chờ — phía nhận LUÔN tra lại từ
  // server theo đúng UUID (Mức 3, xem effect resolve referrer ở trên) trước
  // khi cho bấm Đăng ký, nên dù ai đó sửa tay tham số này trên URL cũng không
  // đánh lừa được xác nhận cuối cùng (sẽ bị gắn cờ "sai lệch" thay vì được tin).
  const referralLink = useMemo(() => {
    if (typeof window === 'undefined' || !myUuid) return ''
    const params = new URLSearchParams({ ref: user?.userId || myUuid })
    if (user?.name) params.set('refName', user.name)
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`
  }, [myUuid, user?.userId, user?.name])

  const referralShareText = useMemo(() => (
    myUuid
      ? `Tham gia AI Doctor cùng tôi nhé! Bấm vào link này để tự động trở thành F1 của tôi:\n${referralLink}\n\n(Hoặc dán tay ${user?.userId ? `User ID của tôi: ${user.userId}` : `UUID của tôi: ${myUuid}`} vào mục "Đăng Ký Affiliate Marketing")`
      : ''
  ), [myUuid, referralLink, user?.userId])

  // Sinh QR code từ link giới thiệu — cho phép User 1 đưa điện thoại cho
  // User 2 quét trực tiếp (ngoài đời/offline) thay vì phải gõ tay link dài.
  useEffect(() => {
    let cancelled = false
    if (!referralLink) {
      setReferralQrDataUrl('')
      return
    }
    QRCode.toDataURL(referralLink, {
      width: 220,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setReferralQrDataUrl(url) })
      .catch(() => { if (!cancelled) setReferralQrDataUrl('') })
    return () => { cancelled = true }
  }, [referralLink])

  const handleCopyShareText = async () => {
    if (!referralShareText) return
    try {
      await navigator.clipboard.writeText(referralShareText)
      setMessage({ type: 'success', text: 'Đã sao chép tin nhắn mời — dán vào Zalo/SMS/Chat để gửi cho người bạn muốn giới thiệu.' })
    } catch { /* ignore */ }
  }

  return (
    <div className={`mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 md:px-8 md:py-10 lg:px-12 ${textMain}`}>
      <div className="mb-6">
        <div className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold ${isDark ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300' : 'border-cyan-500/30 bg-cyan-50 text-cyan-700'}`}>
          <Link2 size={13} /> Đăng Ký Affiliate Marketing
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
          <p className={`mb-3 text-xs ${textDim}`}>Gửi link bên dưới cho người bạn muốn mời (User 2) — mở link là tự động điền sẵn danh tính của bạn (ưu tiên User ID nếu đã đặt, an toàn hơn UUID để chia sẻ), chỉ cần bấm Đăng ký. Không cần dán tay nữa.</p>

          <button
            type="button"
            onClick={handleCopyReferralLink}
            disabled={!referralLink}
            className="w-full flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 text-emerald-300 hover:bg-emerald-500/20 transition disabled:opacity-50"
          >
            <span className="flex items-center gap-2 text-xs font-bold"><Link2 size={14} /> {copiedLink ? 'Đã sao chép link!' : 'Sao chép link giới thiệu'}</span>
            {copiedLink ? <CheckCircle2 size={14} /> : <Copy size={14} />}
          </button>
          <p className={`mt-1 truncate text-[10px] font-mono ${textDim}`}>{referralLink || 'Đang tạo link…'}</p>

          <div className={`mt-3 flex flex-col items-center gap-2 rounded-xl border p-3 ${isDark ? 'border-white/10 bg-black/30' : 'border-black/10 bg-black/[0.03]'}`}>
            {referralQrDataUrl ? (
              <img
                src={referralQrDataUrl}
                alt="QR code link giới thiệu Affiliate"
                width={160}
                height={160}
                className="rounded-lg bg-white p-1.5"
              />
            ) : (
              <div className="flex h-[160px] w-[160px] items-center justify-center rounded-lg bg-white/5 text-[10px] text-center px-2">
                Đang tạo QR code…
              </div>
            )}
            <p className={`text-[10px] text-center ${textDim}`}>Đưa mã QR này cho người bạn muốn mời quét bằng camera điện thoại</p>
          </div>

          <div className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 ${isDark ? 'border-white/10 bg-black/30' : 'border-black/10 bg-black/[0.03]'}`}>
            <input readOnly value={myUuid || 'Đang tạo UUID…'} className="w-full truncate bg-transparent text-xs font-mono outline-none" />
            <button type="button" onClick={handleCopyUuid} disabled={!myUuid} className="shrink-0 rounded-lg bg-cyan-500/15 border border-cyan-500/30 p-1.5 text-cyan-400 hover:bg-cyan-500/25 disabled:opacity-50">
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
            </button>
          </div>
          {user?.userId && (
            <p className={`mt-1 text-[10px] font-mono ${textDim}`}>User ID của bạn: <span className="font-bold text-cyan-400">@{user.userId}</span></p>
          )}
          <p className={`mt-1 text-[10px] ${textDim}`}>Hoặc chỉ gửi riêng UUID này nếu người kia muốn tự dán tay.</p>
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
              <div><UuidIdentityLabel uuid={upline.referrerUuid} textDim={textDim} /></div>
              <div className={`mt-1 ${textDim}`}>{upline.chainStatus === 'synced' ? 'Đã đồng bộ on-chain ✓' : upline.chainStatus === 'failed' ? 'Chưa đồng bộ on-chain — sẽ tự thử lại' : 'Đang chờ đồng bộ on-chain…'}</div>
              {upline.txHash && (
                <a href={getBscScanTxUrl(upline.txHash)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1 font-bold text-cyan-400 hover:underline">
                  <ExternalLink size={11} /> Xem giao dịch trên BscScan Testnet
                </a>
              )}
              {upline.chainStatus !== 'synced' && (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button type="button" onClick={handleRetrySync} disabled={retrying} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 font-bold text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-60">
                    {retrying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Thử đồng bộ on-chain lại
                  </button>
                  <button type="button" onClick={handleUnlink} disabled={unlinking} className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 font-bold text-red-400 hover:bg-red-500/20 disabled:opacity-60">
                    {unlinking ? <Loader2 size={11} className="animate-spin" /> : <AlertTriangle size={11} />} Gỡ liên kết (nếu sai)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
              {inputUuid.trim() && (
                <div className={`rounded-xl border p-3 text-xs leading-relaxed ${
                  isSelfReferral
                    ? (isDark ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-red-500/30 bg-red-50 text-red-700')
                    : referrerNotFound
                    ? (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-amber-500/30 bg-amber-50 text-amber-700')
                    : (isDark ? 'border-violet-500/25 bg-violet-500/10 text-violet-300' : 'border-violet-500/30 bg-violet-50 text-violet-700')
                }`}>
                  {isSelfReferral ? (
                    <span className="flex items-center gap-1.5 font-bold text-red-400"><AlertTriangle size={12} /> Đây là UUID/User ID của chính bạn — bạn không thể tự giới thiệu chính mình. Nếu ai đó đã mời bạn, hãy dán UUID/User ID của người đó.</span>
                  ) : resolvingReferrer ? (
                    <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" /> Đang xác minh UUID/User ID người giới thiệu với máy chủ…</span>
                  ) : referrerNotFound ? (
                    <span className="flex items-center gap-1.5 font-bold"><AlertTriangle size={12} /> UUID/User ID này chưa có hồ sơ nào trong hệ thống — kiểm tra lại trước khi đăng ký, kẻo hoa hồng bị mất vào 1 định danh không tồn tại.</span>
                  ) : resolvedReferrer ? (
                    <>
                      <div className="font-bold flex items-center gap-1.5">
                        <ShieldCheck size={12} />
                        Bạn sắp đăng ký làm F1 của {resolvedReferrer.userId ? `@${resolvedReferrer.userId}` : (resolvedReferrer.name || shortUuid(inputUuid.trim()))}
                      </div>
                      <div className="mt-1 opacity-80">
                        {resolvedReferrer.userId
                          ? 'Đã xác minh từ máy chủ theo đúng UUID — User ID là định danh duy nhất toàn hệ thống, không thể trùng/giả mạo.'
                          : `Người này chưa đặt User ID — chỉ có tên hiển thị${resolvedReferrer.name ? ` ("${resolvedReferrer.name}")` : ''}, tên KHÔNG duy nhất nên hãy đối chiếu kỹ UUID trước khi đăng ký.`}
                        {resolvedReferrer.verified && ' Tên đã xác thực qua Google/Apple.'}
                      </div>
                      {resolvedReferrer.userId && pendingReferrerUserId && pendingReferrerUserId.toLowerCase() !== resolvedReferrer.userId.toLowerCase() && (
                        <div className="mt-1.5 font-bold text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> ⚠️ Link ghi User ID "{pendingReferrerUserId}" nhưng hồ sơ thật của UUID này là "{resolvedReferrer.userId}" — có thể ai đó đang cố giả mạo. Chỉ tin phần đã xác minh ở trên.</div>
                      )}
                      {!resolvedReferrer.userId && pendingReferrerName && resolvedReferrer.name && pendingReferrerName.trim() !== resolvedReferrer.name.trim() && (
                        <div className="mt-1.5 font-bold text-red-400 flex items-center gap-1.5"><AlertTriangle size={12} /> ⚠️ Link ghi tên khác với hồ sơ thật của UUID này — chỉ tin phần đã xác minh ở trên.</div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
              <input
                value={inputUuid}
                onChange={(e) => { setInputUuid(e.target.value); setPendingReferrerName(''); setPendingReferrerUserId(''); setReferralFromLink(false) }}
                placeholder="Dán UUID hoặc User ID người giới thiệu bạn (vd: 8f2a1c9e-... hoặc KhanhLX1)"
                className={`w-full rounded-xl border px-3 py-2.5 text-xs font-mono bg-transparent outline-none ${isDark ? 'border-white/15' : 'border-black/15'}`}
              />
              <button
                type="submit"
                disabled={submitting || !myUuid || resolvingReferrer || referrerNotFound || isSelfReferral || !actualReferrerUuid}
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

        {/* Bảng giao dịch dạng Moralis — tải theo yêu cầu (không tự động, để
            không tốn quota API key mỗi lần vào trang). */}
        <div className="mt-3">
          <button
            type="button"
            onClick={handleLoadTxHistory}
            disabled={!myWalletAddress || loadingTxHistory}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-bold hover:bg-white/5 disabled:opacity-50"
          >
            {loadingTxHistory ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            {loadingTxHistory ? 'Đang tải…' : 'Tải lịch sử giao dịch (Moralis)'}
          </button>

          {txHistoryError && (
            <p className="mt-2 text-[11px] text-red-400">{txHistoryError}</p>
          )}

          {txHistory && (
            txHistory.length === 0 ? (
              <p className={`mt-2 text-[11px] ${textDim}`}>Ví này chưa có giao dịch nào trên BSC Testnet.</p>
            ) : (
              <div className="mt-2 max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {txHistory.map((row) => (
                  <a
                    key={row.hash}
                    href={getBscScanTxUrl(row.hash)}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center justify-between text-[11px] rounded-lg px-2.5 py-1.5 hover:bg-cyan-500/10 ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'}`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 font-bold ${row.type === 'sent' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {row.type === 'sent' ? 'Gửi' : 'Nhận'}
                      </span>
                      <span className="font-mono">{shortUuid(row.hash)}</span>
                    </span>
                    <span className="flex items-center gap-1 text-cyan-400 font-bold">
                      {row.valueEth} {row.name || 'BNB'} <ExternalLink size={10} />
                    </span>
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* Cây thành viên đa tầng — F1 (10%) · F2 (5%) · F3 (2%), tham khảo
          bảng "My Referrals" của refearnapp nhưng mở rộng đủ 3 tầng đúng
          hoa hồng ở banner đầu trang. */}
      <div className={`mt-5 rounded-2xl border p-5 ${card}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><Network size={18} className="text-cyan-400" /><span className="font-bold text-sm">Cây thành viên đa tầng qua UUID</span></div>
          <button type="button" onClick={refresh} className={`text-xs ${textDim} hover:text-cyan-400 flex items-center gap-1`}><RefreshCw size={12} /> Làm mới</button>
        </div>

        {[
          { label: 'F1 · tầng 1 (10%)', rows: downline, emptyText: 'Chưa có ai đăng ký dưới UUID của bạn. Hãy gửi UUID ở trên cho bạn bè!' },
          { label: 'F2 · tầng 2 (5%)', rows: downlineF2, emptyText: 'Chưa có F2 — sẽ xuất hiện khi F1 của bạn giới thiệu thêm người mới.' },
          { label: 'F3 · tầng 3 (2%)', rows: downlineF3, emptyText: 'Chưa có F3 — sẽ xuất hiện khi F2 của bạn giới thiệu thêm người mới.' },
        ].map((tier, idx) => (
          <div key={tier.label} className={idx > 0 ? 'mt-4' : ''}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-xs font-bold ${textDim}`}>{tier.label}</span>
              <span className="text-[10px] font-bold text-cyan-400">{tier.rows.length} người</span>
            </div>
            {tier.rows.length === 0 ? (
              <p className={`text-xs ${textDim}`}>{tier.emptyText}</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {tier.rows.map((r) => (
                  <div key={r.id || r._id || r.refereeUuid} className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'}`}>
                    <UuidIdentityLabel uuid={r.refereeUuid} textDim={textDim} />
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
          </div>
        ))}

        <p className={`mt-4 text-[11px] ${textDim}`}>Xem chi tiết hoa hồng, sổ cái minh bạch và cây thành viên đầy đủ tại mục “{t ? t('affiliate') || 'Affiliate & Earn Đa Tầng' : 'Affiliate & Earn Đa Tầng'}”.</p>
      </div>
    </div>
  )
}
