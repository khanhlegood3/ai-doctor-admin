// api/affiliate-admin-stats.js
//
// Lý do file này tồn tại: trước đây "Quản Trị Affiliate" (AffiliateSystemAdminPanel.jsx,
// tab affiliateAdmin) được render KHÔNG TRUYỀN PROPS nào ở App.jsx, nên nó luôn tự rơi về
// DEFAULT_USERS/DEFAULT_POLICY cứng (3 user giả, rate 10/5/2% chỉnh được nhưng không lưu đi
// đâu cả) — Admin bấm "Thêm Tầng"/sửa % hay "Mô phỏng đóng góp quỹ" đều không ảnh hưởng gì
// tới hệ affiliate UUID thật (MongoDB collections affiliate_referrals/user_profiles, hoặc
// smart-contract HienMauAffiliate.sol). Endpoint này cấp dữ liệu THẬT (read-only) để Admin
// panel hiển thị đúng quy mô hệ thống thay vì số liệu giả.
//
// Lưu ý quan trọng: rate hoa hồng (F1 10% · F2 5% · F3 2%) đã CỐ ĐỊNH trong contract
// HienMauAffiliate.sol đã deploy (xem gameAffiliateChain.js) — KHÔNG có cơ chế nào trong app
// này để ghi đè rate đó qua UI, nên panel Admin không nên hiện ô "sửa %" tưởng như đổi được
// (xem thêm src/components/admin/AffiliateSystemAdminPanel.jsx).
//
// Bảo mật: giống các endpoint admin khác trong app này (không có server-session/cookie thật,
// gating "isAdmin" hoàn toàn ở phía client — xem AuthContext.jsx/Sidebar.jsx), endpoint này
// CHỈ đọc (GET), không có thao tác ghi/sửa/xoá nào có thể gây hại nếu bị gọi trực tiếp.
//
// Method:
//   GET -> {
//     totalProfiles: number,               // tổng số hồ sơ user_profiles (đã từng đăng nhập >=1 lần)
//     totalReferralLinks: number,          // tổng số quan hệ referrer -> referee đã ghi nhận
//     fixedLevelRates: [{level, rate}],    // rate THẬT, cố định trên contract — chỉ để hiển thị
//     topReferrers: [                      // xếp hạng theo số F1 trực tiếp (downline count)
//       { referrerUuid, userId, name, verified, f1Count }
//     ],
//     recentReferrals: [                   // 20 quan hệ mới nhất, để Admin đối soát nhanh
//       { referrerUuid, refereeUuid, chainStatus, createdAt }
//     ],
//   }

import { connectToDatabase } from './_lib/mongodb.js';

const REFERRAL_COLLECTION = 'affiliate_referrals';
const PROFILE_COLLECTION = 'user_profiles';

// Rate thật, cố định trên smart-contract HienMauAffiliate.sol (levelRates = [10,5,2]%) —
// KHÔNG lấy từ DB vì contract không expose rate qua app này; chỉ hard-code lại đúng giá trị
// đã xác nhận để Admin panel không hiện sai số so với on-chain.
const FIXED_LEVEL_RATES = [
  { level: 1, rate: 10 },
  { level: 2, rate: 5 },
  { level: 3, rate: 2 },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const referralCol = db.collection(REFERRAL_COLLECTION);
    const profileCol = db.collection(PROFILE_COLLECTION);

    const [totalProfiles, totalReferralLinks, recentReferrals, referrerGroups] = await Promise.all([
      profileCol.countDocuments({}),
      referralCol.countDocuments({}),
      referralCol.find({}).sort({ createdAt: -1 }).limit(20).toArray(),
      referralCol
        .aggregate([
          { $group: { _id: '$referrerUuid', f1Count: { $sum: 1 } } },
          { $sort: { f1Count: -1 } },
          { $limit: 10 },
        ])
        .toArray(),
    ]);

    // Tra tên/User ID thật cho từng referrerUuid trong bảng xếp hạng — cùng logic Mức 3
    // (ưu tiên userId, không tin bất cứ gì ngoài user_profiles) đã áp dụng ở
    // AffiliateUUIDReferralPanel.jsx/LoginPage.jsx.
    const topReferrerUuids = referrerGroups.map((g) => g._id).filter(Boolean);
    const profiles = topReferrerUuids.length
      ? await profileCol.find({ uuid: { $in: topReferrerUuids } }).toArray()
      : [];
    const profileByUuid = new Map(profiles.map((p) => [p.uuid, p]));

    const topReferrers = referrerGroups.map((g) => {
      const profile = profileByUuid.get(g._id);
      return {
        referrerUuid: g._id,
        userId: profile?.userId || null,
        name: profile?.name || null,
        verified: !!profile?.verified,
        f1Count: g.f1Count,
      };
    });

    return res.status(200).json({
      totalProfiles,
      totalReferralLinks,
      fixedLevelRates: FIXED_LEVEL_RATES,
      topReferrers,
      recentReferrals: recentReferrals.map((r) => ({
        referrerUuid: r.referrerUuid,
        refereeUuid: r.refereeUuid,
        chainStatus: r.chainStatus || 'pending',
        createdAt: r.createdAt || null,
      })),
    });
  } catch (error) {
    console.error('[api/affiliate-admin-stats] error:', error);
    return res.status(500).json({ error: error?.message || 'Lỗi máy chủ không xác định.' });
  }
}
