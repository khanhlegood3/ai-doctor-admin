import React, { useEffect, useState } from 'react'
import { Gift, X } from 'lucide-react'
import { submitBossWin, getRankBonus } from '../lib/gameLeaderboardApi'
import { submitReward } from '../lib/gameAffiliateReward'
import AffiliateGameContent from './AffiliateGameContent.jsx'

// ============================================================================
// GameAffiliateRewardWidget — popup "Affiliate Game" mở NGAY TRONG màn hình
// game (BodyProtectionJourneyPanel), điều khiển bằng props `open`/`onClose`
// (nút mở popup nằm ở toolbar, ngay sau nút "Toàn màn hình" — xem
// BodyProtectionJourneyPanel.jsx). Nội dung 3 tab (Thưởng / Xếp hạng BOSS /
// Quy đổi) dùng chung component AffiliateGameContent.jsx với trang riêng
// "Affiliate Game" (AffiliateGamePage.jsx) — cùng 1 nguồn logic, không lệch
// dữ liệu giữa 2 nơi.
//
// Component này LUÔN được mount (kể cả khi popup đang đóng) vì nó còn giữ
// hiệu ứng tự động ghi thưởng "hoàn thành game" mỗi khi có kết quả mới từ
// iframe game — hiệu ứng đó phải chạy dù popup đang mở hay đóng.
//
// Khi mở, popup hiển thị TO TOÀN MÀN HÌNH trên điện thoại (và dạng modal căn
// giữa trên màn hình lớn) để người chơi dễ thấy đủ thông tin.
export default function GameAffiliateRewardWidget({ uuid, userId, lastGameResult, playerName, open, onClose }) {
  const [myRank, setMyRank] = useState(null)

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
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid, lastGameResult])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div className="flex h-full w-full max-w-none flex-col overflow-hidden border border-white/10 bg-[#101418] text-white shadow-2xl sm:h-auto sm:max-h-[88vh] sm:max-w-md sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between bg-gradient-to-r from-amber-500/20 to-rose-500/20 px-4 py-3">
          <div className="flex items-center gap-2 font-bold">
            <Gift size={16} className="text-amber-300" /> Affiliate Game
          </div>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <AffiliateGameContent
          uuid={uuid}
          userId={userId}
          playerName={playerName}
          gameId={lastGameResult?.gameId || null}
          initialTab={myRank ? 'leaderboard' : 'reward'}
        />
      </div>
    </div>
  )
}
