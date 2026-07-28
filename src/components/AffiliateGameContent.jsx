import React, { useCallback, useEffect, useState } from 'react'
import { Gift, Users, Copy, CheckCircle2, Loader2, PlayCircle, RefreshCw, Trophy, Coins } from 'lucide-react'
import {
  getReferralsByReferrer,
  getRewards,
  getOrCreateReferralCode,
} from '../lib/gameAffiliateDB'
import { submitReward } from '../lib/gameAffiliateReward'
import { fetchBossLeaderboard } from '../lib/gameLeaderboardApi'
import { fetchTokenUsdPrices, convertPointsToValues, formatTokenAmount, POINT_TO_USD } from '../lib/pointsTokenConversion'

// Thời gian "xem quảng cáo" giả lập (giây) khi chưa gắn SDK Google Ads
// rewarded thật. Thay handleWatchAd bên dưới bằng lệnh gọi SDK thật
// (vd googletag.pubads() rewarded ad) khi có ad unit chính thức.
const AD_WATCH_SECONDS = 15
const AD_REWARD = { amount: 5000, currency: 'VIET' }

// ============================================================================
// AffiliateGameContent — phần NỘI DUNG (3 tab: Thưởng / Xếp hạng BOSS / Quy
// đổi) tách riêng khỏi khung hiển thị (popup nổi trong game HAY trang riêng
// đầy đủ) để 2 nơi dùng chung ĐÚNG 1 nguồn logic, không lệch dữ liệu.
//
// ĐỒNG BỘ UUID: link giới thiệu ở đây dùng ĐÚNG định dạng chung của toàn dự
// án — `?ref=<User ID nếu có, không thì UUID>` (giống hệt
// AffiliateUUIDReferralPanel.jsx) — thay vì tự sinh 1 "mã code" riêng cho
// game như trước (mã đó không được App.jsx (nơi xử lý ?ref= trung tâm) hiểu
// là UUID/User ID hợp lệ, khiến quan hệ F1/F2 và điểm thưởng bị tách rời
// khỏi hệ thống affiliate chung của dự án). Nhờ vậy điểm/tiền của user này
// và hoa hồng F1/F2 của tuyến trên luôn quy về ĐÚNG 1 UUID duy nhất, dùng
// chung với mọi màn hình Affiliate khác trong app.
export default function AffiliateGameContent({ uuid, userId, playerName, gameId, initialTab = 'reward' }) {
  const [referralCount, setReferralCount] = useState(0)
  const [rewards, setRewards] = useState([])
  const [copied, setCopied] = useState(false)
  const [watchingAd, setWatchingAd] = useState(false)
  const [adSecondsLeft, setAdSecondsLeft] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [tab, setTab] = useState(initialTab) // 'reward' | 'leaderboard' | 'exchange'

  // Bảng xếp hạng "thắng BOSS nhanh nhất" (dùng chung mọi thiết bị qua Mongo)
  const [leaderboard, setLeaderboard] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)

  // Quy đổi tổng điểm thưởng hiện có ra USD + tất cả token dự án hỗ trợ
  const [tokenPrices, setTokenPrices] = useState(null)
  const [totalPoints, setTotalPoints] = useState(0)

  const refresh = useCallback(async () => {
    if (!uuid) return
    // Vẫn giữ 1 "code" nội bộ (chỉ dùng làm nhãn/metadata khi ghi log referral,
    // KHÔNG dùng làm giá trị ?ref= của link chia sẻ — xem referralLink bên dưới).
    const [refs, rws] = await Promise.all([
      getReferralsByReferrer(uuid),
      getRewards(uuid),
    ])
    getOrCreateReferralCode(uuid).catch(() => {})
    setReferralCount(refs.length)
    setRewards(rws.slice(0, 8))
    // Tổng điểm nội bộ tích luỹ (chỉ tính currency VIET — dùng để quy đổi
    // ra USD + các token dự án hỗ trợ ở tab "Quy đổi").
    setTotalPoints(rws.filter((r) => r.currency === 'VIET').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))
  }, [uuid])

  useEffect(() => { refresh() }, [refresh])

  // Tải bảng xếp hạng của game hiện tại khi mở tab "Xếp hạng"
  useEffect(() => {
    if (tab !== 'leaderboard' || !gameId) return
    setLoadingLeaderboard(true)
    fetchBossLeaderboard(gameId)
      .then((rows) => {
        setLeaderboard(rows)
        const mine = rows.find((p) => p.uuid === uuid)
        if (mine) setMyRank(mine.rank)
      })
      .finally(() => setLoadingLeaderboard(false))
  }, [tab, gameId, uuid])

  // Tải giá quy đổi (USD) cho tất cả token dự án hỗ trợ khi mở tab "Quy đổi"
  useEffect(() => {
    if (tab !== 'exchange') return
    fetchTokenUsdPrices().then(setTokenPrices)
  }, [tab])

  useEffect(() => {
    if (!watchingAd || adSecondsLeft <= 0) return
    const t = setTimeout(() => setAdSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [watchingAd, adSecondsLeft])

  const handleWatchAd = () => {
    setWatchingAd(true)
    setAdSecondsLeft(AD_WATCH_SECONDS)
  }

  useEffect(() => {
    if (watchingAd && adSecondsLeft === 0) {
      (async () => {
        setWatchingAd(false)
        setClaiming(true)
        await submitReward({
          uuid, kind: 'ad_watch', amount: AD_REWARD.amount, currency: AD_REWARD.currency,
          gameId: 'ad_watch', note: 'Xem quảng cáo nhận thưởng',
        })
        await refresh()
        setClaiming(false)
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchingAd, adSecondsLeft])

  // ─── Link giới thiệu — ĐỒNG BỘ với UUID chung toàn dự án ─────────────────
  // Giống hệt AffiliateUUIDReferralPanel.jsx: ưu tiên User ID (ngắn/dễ chia
  // sẻ) nếu đã đặt, không thì dùng thẳng UUID. App.jsx (xử lý ?ref= trung
  // tâm cho toàn app) và mọi màn hình Affiliate khác đều đọc đúng định dạng
  // này, nên F1/F2 + điểm/tiền của link này quy về đúng 1 UUID duy nhất.
  const referralLink = typeof window !== 'undefined' && uuid
    ? (() => {
        const params = new URLSearchParams({ ref: userId || uuid })
        if (playerName) params.set('refName', playerName)
        return `${window.location.origin}${window.location.pathname}?${params.toString()}`
      })()
    : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  if (!uuid) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex border-b border-white/10 text-xs font-semibold">
        {[
          { id: 'reward', label: 'Thưởng', icon: Gift },
          { id: 'leaderboard', label: 'Xếp hạng BOSS', icon: Trophy },
          { id: 'exchange', label: 'Quy đổi', icon: Coins },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 transition ${
              tab === id ? 'border-b-2 border-amber-400 text-amber-300' : 'text-white/50 hover:text-white/80'
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'reward' && (
        <div className="space-y-4 p-4">
          <div>
            <div className="mb-1 text-xs text-white/50">Link giới thiệu của bạn</div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              <input readOnly value={referralLink} className="w-full truncate bg-transparent text-xs outline-none" />
              <button type="button" onClick={handleCopy} className="shrink-0 rounded-lg bg-white/10 p-1.5 hover:bg-white/20">
                {copied ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <span className="flex items-center gap-2 text-white/70"><Users size={14} /> Đã giới thiệu</span>
            <b>{referralCount} người</b>
          </div>

          <button
            type="button"
            disabled={watchingAd || claiming}
            onClick={handleWatchAd}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:opacity-60"
          >
            {watchingAd ? (
              <>Đang xem quảng cáo… {adSecondsLeft}s</>
            ) : claiming ? (
              <><Loader2 size={14} className="animate-spin" /> Đang ghi nhận thưởng…</>
            ) : (
              <><PlayCircle size={16} /> Xem quảng cáo nhận thưởng</>
            )}
          </button>

          <div>
            <div className="mb-2 flex items-center justify-between text-xs text-white/50">
              <span className="flex items-center gap-1"><Trophy size={12} /> Lịch sử thưởng gần đây</span>
              <button type="button" onClick={refresh} className="hover:text-white"><RefreshCw size={12} /></button>
            </div>
            <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
              {rewards.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-white/40">
                  Chưa có thưởng nào.
                </div>
              )}
              {rewards.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5 text-xs">
                  <span className="text-white/70">{r.note || r.kind}</span>
                  <span className="flex items-center gap-1.5">
                    <b className="text-emerald-400">+{r.amount.toLocaleString()} {r.currency}</b>
                    <span
                      className={`rounded px-1 py-0.5 text-[9px] font-bold ${
                        r.chainStatus === 'synced' ? 'bg-emerald-500/20 text-emerald-300'
                        : r.chainStatus === 'failed' ? 'bg-red-500/20 text-red-300'
                        : 'bg-amber-500/20 text-amber-300'
                      }`}
                      title={r.chainStatus === 'synced' ? (r.txHash || '') : r.chainStatus === 'failed' ? (r.error || '') : ''}
                    >
                      {r.chainStatus === 'synced' ? 'On-chain' : r.chainStatus === 'failed' ? 'Lỗi' : 'Đang gửi'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        )}

        {tab === 'leaderboard' && (
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
            🏆 Ai thắng BOSS <b>NHANH NHẤT</b> đứng đầu bảng — thưởng theo hạng: Hạng 1 <b>+5.000</b>, Top 3 <b>+3.000</b>, Top 10 <b>+1.500</b>, còn lại <b>+300</b> điểm/lần thắng.
          </div>

          {!gameId && (
            <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-white/40">
              Hãy chơi ít nhất 1 ván trong "Hành Trình Bảo Vệ Cơ Thể" để xem bảng xếp hạng theo game.
            </div>
          )}

          {myRank && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm">
              <span className="text-emerald-200">Hạng của bạn (lần thắng gần nhất)</span>
              <b className="text-emerald-300">#{myRank}</b>
            </div>
          )}

          {gameId && (
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {loadingLeaderboard && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-white/40">
                <Loader2 size={14} className="animate-spin" /> Đang tải bảng xếp hạng…
              </div>
            )}
            {!loadingLeaderboard && leaderboard.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-xs text-white/40">
                Chưa có ai thắng BOSS — hãy là người đầu tiên!
              </div>
            )}
            {leaderboard.map((p) => (
              <div
                key={p.uuid}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs ${
                  p.uuid === uuid ? 'border border-amber-400/50 bg-amber-500/10' : 'bg-black/30'
                }`}
              >
                <span className="flex items-center gap-2">
                  <b className={p.rank === 1 ? 'text-amber-300' : p.rank <= 3 ? 'text-slate-300' : 'text-white/50'}>
                    #{p.rank}
                  </b>
                  <span className="text-white/80">{p.name}</span>
                </span>
                <span className="flex items-center gap-1.5 text-white/70">
                  ⏱ {p.bestTimeSec}s
                  <span className="text-white/30">·</span>
                  {p.winCount} thắng
                </span>
              </div>
            ))}
          </div>
          )}
        </div>
        )}

        {tab === 'exchange' && (
        <div className="space-y-3 p-4">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">Tổng điểm thưởng của bạn</span>
              <b className="text-amber-300">{totalPoints.toLocaleString()} điểm</b>
            </div>
            <div className="mt-1 text-[11px] text-white/40">Quy ước: 1 điểm = {POINT_TO_USD} USD</div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
            <span className="text-sm text-emerald-200">≈ Giá trị quy đổi</span>
            <b className="text-emerald-300">
              ${(totalPoints * POINT_TO_USD).toLocaleString(undefined, { maximumFractionDigits: 2 })} USD
            </b>
          </div>

          <div>
            <div className="mb-2 text-xs text-white/50">Quy đổi ra từng token/coin dự án hỗ trợ</div>
            {!tokenPrices && (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-white/40">
                <Loader2 size={14} className="animate-spin" /> Đang lấy giá thị trường…
              </div>
            )}
            {tokenPrices && (
              <div className="space-y-1.5">
                {Object.entries(convertPointsToValues(totalPoints, tokenPrices).tokens).map(([symbol, amount]) => (
                  <div key={symbol} className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5 text-xs">
                    <span className="font-bold text-white/80">{symbol}</span>
                    <span className="font-mono text-emerald-300">{formatTokenAmount(symbol, amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-[10px] text-white/30">
              Giá BTC/ETH/BNB/USDT/PI lấy theo thị trường (CoinGecko), có thể trễ vài phút. VIET là token nội bộ, neo cố định 1 VIET = 0.01 USD.
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
