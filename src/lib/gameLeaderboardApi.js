/**
 * gameLeaderboardApi.js — client cho api/game-leaderboard.js
 *
 * Ghi nhận thời gian thắng BOSS (chỉ status === 'win') lên MongoDB (dùng
 * chung cho mọi thiết bị) và tính điểm thưởng THEO HẠNG (rank) trên bảng
 * xếp hạng: thắng BOSS càng NHANH thì hạng càng cao, thưởng càng lớn.
 */

// Thưởng THEO HẠNG cho mỗi lần thắng BOSS (cộng vào phần thưởng cơ bản
// "game_complete" đã có sẵn ở GameAffiliateRewardWidget.jsx). Đơn vị: điểm
// nội bộ (1 điểm = 0.01 USD, xem pointsTokenConversion.js).
const RANK_BONUS_TABLE = [
  { maxRank: 1, bonus: 5000, label: '🥇 Hạng 1 — Nhanh nhất bảng xếp hạng' },
  { maxRank: 3, bonus: 3000, label: '🥈 Top 3 nhanh nhất' },
  { maxRank: 10, bonus: 1500, label: '🥉 Top 10 nhanh nhất' },
  { maxRank: Infinity, bonus: 300, label: '🎖️ Đã vào bảng xếp hạng' },
]

export function getRankBonus(rank) {
  if (!rank || rank < 1) return { bonus: 0, label: null }
  const tier = RANK_BONUS_TABLE.find((t) => rank <= t.maxRank)
  return tier ? { bonus: tier.bonus, label: tier.label } : { bonus: 0, label: null }
}

// Ghi nhận 1 lần thắng BOSS lên leaderboard dùng chung. Trả về null nếu lỗi
// mạng — không nên chặn luồng thưởng cục bộ (offline-first) chỉ vì
// leaderboard chưa đồng bộ được, chỉ đơn giản là chưa có rank lúc đó.
export async function submitBossWin({ uuid, name, gameId, gameTitle, status, score, timeSec }) {
  if (!uuid || !gameId || status !== 'win') return null
  try {
    const res = await fetch('/api/game-leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, name, gameId, gameTitle, status, score, timeSec }),
    })
    if (!res.ok) return null
    return await res.json() // { item, rank, isNewBest, totalPlayers }
  } catch (err) {
    console.warn('[gameLeaderboardApi] Không thể ghi nhận lên leaderboard (sẽ thử lại lần chơi sau):', err)
    return null
  }
}

// Lấy top N người chơi thắng BOSS nhanh nhất cho 1 game.
export async function fetchBossLeaderboard(gameId, limit = 20) {
  if (!gameId) return []
  try {
    const res = await fetch(`/api/game-leaderboard?gameId=${encodeURIComponent(gameId)}&limit=${limit}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.items || []
  } catch (err) {
    console.warn('[gameLeaderboardApi] Không thể tải leaderboard:', err)
    return []
  }
}
