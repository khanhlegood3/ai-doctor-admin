import React, { useCallback, useEffect, useState } from 'react'
import { Gift, Users, Copy, CheckCircle2, Loader2, PlayCircle, RefreshCw, Trophy, Coins } from 'lucide-react'
import {
  getOrCreateReferralCode,
  getReferralsByReferrer,
  getRewards,
  addRewardWithReferralCommission,
  markRewardSynced,
  markRewardFailed,
} from '../lib/gameAffiliateDB'
import { recordRewardOnChain } from '../lib/gameAffiliateChain'
import { submitBossWin, fetchBossLeaderboard, getRankBonus } from '../lib/gameLeaderboardApi'
import { fetchTokenUsdPrices, convertPointsToValues, formatTokenAmount, POINT_TO_USD } from '../lib/pointsTokenConversion'

// Thời gian "xem quảng cáo" giả lập (giây) khi chưa gắn SDK Google Ads
// rewarded thật. Thay handleWatchAd bên dưới bằng lệnh gọi SDK thật
// (vd googletag.pubads() rewarded ad) khi có ad unit chính thức.
const AD_WATCH_SECONDS = 15
const AD_REWARD = { amount: 5000, currency: 'VIET' }

// Ghi 1 khoản thưởng cho `uuid` + hoa hồng local cho tuyến trên F1/F2 (nếu
// có), rồi gửi ĐÚNG 1 giao dịch rewardTask() lên chain — vì contract đã tự
// chia hoa hồng ngược lên toàn bộ tuyến trên trong CÙNG giao dịch đó, các
// dòng hoa hồng local chỉ cần "ăn theo" cùng 1 txHash, không gửi giao dịch
// riêng cho từng cấp F1/F2.
async function submitReward({ uuid, kind, amount, currency, gameId, note }) {
  const { primaryId, commissions } = await addRewardWithReferralCommission({
    uuid, kind, amount, currency, gameId, note,
  })
  const result = await recordRewardOnChain({ id: primaryId, uuid, amount })
  for (const c of commissions) {
    // eslint-disable-next-line no-await-in-loop
    if (result.ok) await markRewardSynced(c.commissionId, result.txHash)
    // eslint-disable-next-line no-await-in-loop
    else await markRewardFailed(c.commissionId, result.cooldown ? `Chưa đồng bộ F${c.level} — chờ giao dịch chính của người được giới thiệu.` : (result.error || 'Lỗi không xác định'))
  }
  return result
}

export default function GameAffiliateRewardWidget({ uuid, lastGameResult, playerName, cameraOpen }) {
  const [code, setCode] = useState('')
  const [referralCount, setReferralCount] = useState(0)
  const [rewards, setRewards] = useState([])
  const [copied, setCopied] = useState(false)
  const [watchingAd, setWatchingAd] = useState(false)
  const [adSecondsLeft, setAdSecondsLeft] = useState(0)
  const [claiming, setClaiming] = useState(false)
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState('reward') // 'reward' | 'leaderboard' | 'exchange'

  // Bảng xếp hạng "thắng BOSS nhanh nhất" (dùng chung mọi thiết bị qua Mongo)
  const [leaderboard, setLeaderboard] = useState([])
  const [myRank, setMyRank] = useState(null)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false)

  // Quy đổi tổng điểm thưởng hiện có ra USD + tất cả token dự án hỗ trợ
  const [tokenPrices, setTokenPrices] = useState(null)

  const [totalPoints, setTotalPoints] = useState(0)

  const refresh = useCallback(async () => {
    if (!uuid) return
    const [c, refs, rws] = await Promise.all([
      getOrCreateReferralCode(uuid),
      getReferralsByReferrer(uuid),
      getRewards(uuid),
    ])
    setCode(c)
    setReferralCount(refs.length)
    setRewards(rws.slice(0, 8))
    // Tổng điểm nội bộ tích luỹ (chỉ tính currency VIET — dùng để quy đổi
    // ra USD + các token dự án hỗ trợ ở tab "Quy đổi").
    setTotalPoints(rws.filter((r) => r.currency === 'VIET').reduce((sum, r) => sum + (Number(r.amount) || 0), 0))
  }, [uuid])

  useEffect(() => { refresh() }, [refresh])

  // Ghi nhận thưởng "hoàn thành game" khi có kết quả mới từ iframe. Nếu là
  // THẮNG BOSS (status === 'win') thì đồng thời ghi thời gian lên leaderboard
  // dùng chung (mọi thiết bị) và cộng thêm thưởng THEO HẠNG — thắng BOSS
  // càng nhanh, hạng càng cao, thưởng càng lớn.
  useEffect(() => {
    if (!uuid || !lastGameResult) return
    if (lastGameResult.status !== 'win' && lastGameResult.status !== 'freeplay') return
    ;(async () => {
      await submitReward({
        uuid,
        kind: 'game_complete',
        amount: 2000,
        currency: 'VIET',
        gameId: lastGameResult.gameId,
        note: `Hoàn thành ${lastGameResult.gameTitle || lastGameResult.gameId}`,
      })

      if (lastGameResult.status === 'win') {
        const lb = await submitBossWin({
          uuid,
          name: playerName || '',
          gameId: lastGameResult.gameId,
          gameTitle: lastGameResult.gameTitle,
          status: lastGameResult.status,
          score: lastGameResult.score,
          timeSec: lastGameResult.timeSec,
        })
        if (lb?.rank) {
          setMyRank(lb.rank)
          const { bonus, label } = getRankBonus(lb.rank)
          if (bonus > 0) {
            await submitReward({
              uuid,
              kind: 'boss_rank_bonus',
              amount: bonus,
              currency: 'VIET',
              gameId: lastGameResult.gameId,
              note: `${label} · ${lastGameResult.timeSec}s (hạng ${lb.rank}/${lb.totalPlayers})`,
            })
          }
          setTab('leaderboard')
          fetchBossLeaderboard(lastGameResult.gameId).then(setLeaderboard)
        }
      }

      await refresh()
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, lastGameResult])

  // Tải bảng xếp hạng của game hiện tại khi mở panel / đổi game
  useEffect(() => {
    if (!open || !lastGameResult?.gameId) return
    setLoadingLeaderboard(true)
    fetchBossLeaderboard(lastGameResult.gameId)
      .then(setLeaderboard)
      .finally(() => setLoadingLeaderboard(false))
  }, [open, lastGameResult?.gameId])

  // Tải giá quy đổi (USD) cho tất cả token dự án hỗ trợ khi mở panel
  useEffect(() => {
    if (!open) return
    fetchTokenUsdPrices().then(setTokenPrices)
  }, [open])

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

  const referralLink = typeof window !== 'undefined' && code
    ? `${window.location.origin}${window.location.pathname}?ref=${encodeURIComponent(code)}`
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
    // Khung camera cử chỉ (TouchlessHandCam trong BodyProtectionJourneyPanel.jsx)
    // cũng neo "fixed bottom-6 left-6" — khi camera đang mở, đẩy popup này
    // lên cao hơn (bottom-48) để không bị che/đè lên khung camera.
    <div className={`fixed left-6 z-50 transition-all ${cameraOpen ? 'bottom-48' : 'bottom-6'}`}>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 px-4 py-3 text-sm font-bold text-white shadow-2xl transition hover:-translate-y-0.5"
        >
          <Gift size={18} /> Giới thiệu & Thưởng
        </button>
      )}

      {open && (
        <div className="w-96 overflow-hidden rounded-2xl border border-white/10 bg-[#101418] text-white shadow-2xl">
          <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/20 to-rose-500/20 px-4 py-3">
            <div className="flex items-center gap-2 font-bold">
              <Gift size={16} className="text-amber-300" /> Affiliate Game
            </div>
            <button type="button" onClick={() => setOpen(false)} className="text-white/60 hover:text-white">✕</button>
          </div>

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

            {myRank && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm">
                <span className="text-emerald-200">Hạng của bạn (lần thắng gần nhất)</span>
                <b className="text-emerald-300">#{myRank}</b>
              </div>
            )}

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
      )}
    </div>
  )
}
