/**
 * gameAffiliateReward.js — ghi 1 khoản thưởng cho `uuid` + hoa hồng local cho
 * tuyến trên F1/F2 (nếu có), rồi gửi ĐÚNG 1 giao dịch rewardTask() lên chain
 * — vì contract đã tự chia hoa hồng ngược lên toàn bộ tuyến trên trong CÙNG
 * giao dịch đó, các dòng hoa hồng local chỉ cần "ăn theo" cùng 1 txHash,
 * không gửi giao dịch riêng cho từng cấp F1/F2.
 *
 * Tách riêng khỏi GameAffiliateRewardWidget.jsx để dùng chung được cho cả
 * popup trong game LẪN trang Affiliate Game độc lập (AffiliateGamePage.jsx)
 * — tuyến trên F1/F2 luôn được tính theo ĐÚNG 1 UUID (xem gameAffiliateDB.js:
 * getReferralFor dùng thẳng uuid thật, không qua "code" riêng của game).
 */
import { addRewardWithReferralCommission, markRewardSynced, markRewardFailed } from './gameAffiliateDB'
import { recordRewardOnChain } from './gameAffiliateChain'

export async function submitReward({ uuid, kind, amount, currency, gameId, note }) {
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
