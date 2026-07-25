// api/affiliate-referral.js
//
// Lý do file này tồn tại: gameAffiliateDB.js (IndexedDB) + localStorage chỉ
// lưu dữ liệu TRÊN TỪNG TRÌNH DUYỆT/THIẾT BỊ. Khi User 2 đăng ký F1 bằng
// UUID của User 1 trên máy/trình duyệt của User 2, quan hệ đó chỉ được ghi
// vào IndexedDB của User 2 — User 1 mở app trên máy của họ sẽ KHÔNG thấy gì
// vì đó là 1 kho dữ liệu cục bộ khác hoàn toàn (đây chính là nguyên nhân
// "đăng ký F1 nhưng chưa thấy hiện F1 trong danh sách").
//
// Endpoint này dùng MongoDB (đã có sẵn MONGODB_URI trên Vercel — xem
// api/alchemy-webhook.js, api/moralis.js) làm nguồn sự thật DÙNG CHUNG, để
// cả 2 phía (referrer & referee) đều thấy đúng quan hệ dù ở thiết bị nào.
//
// Collection: "affiliate_referrals"
//   { referrerUuid, refereeUuid, code, source, chainStatus, txHash, createdAt }
//   - unique theo refereeUuid (1 người chỉ có đúng 1 tuyến trên, không cho
//     đổi referrer giữa chừng — cùng quy tắc với gameAffiliateDB.saveReferral).
//
// Methods:
//   GET  ?referrer=<uuid>  -> { items: [...] }  (F1 trực tiếp của uuid này)
//   GET  ?referee=<uuid>   -> { item: {...} | null } (tuyến trên của uuid này)
//   POST { referrerUuid, refereeUuid, code, source } -> { item, alreadyExisted }

import { connectToDatabase } from './_lib/mongodb.js';

const COLLECTION = 'affiliate_referrals';

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(COLLECTION);

    if (req.method === 'GET') {
      const { referrer, referee } = req.query || {};

      if (referee) {
        const item = await col.findOne({ refereeUuid: String(referee) });
        return res.status(200).json({ item: item || null });
      }
      if (referrer) {
        const items = await col
          .find({ referrerUuid: String(referrer) })
          .sort({ createdAt: -1 })
          .toArray();
        return res.status(200).json({ items });
      }
      return res.status(400).json({ error: 'Cần truyền query "referrer" hoặc "referee".' });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const referrerUuid = String(body?.referrerUuid || '').trim();
      const refereeUuid = String(body?.refereeUuid || '').trim();
      const code = body?.code || null;
      const source = body?.source || 'uuid_manual';

      if (!referrerUuid || !refereeUuid) {
        return res.status(400).json({ error: 'Thiếu referrerUuid hoặc refereeUuid.' });
      }
      if (referrerUuid === refereeUuid) {
        return res.status(400).json({ error: 'Không thể tự giới thiệu chính mình.' });
      }

      const existing = await col.findOne({ refereeUuid });
      if (existing) {
        // Đã có tuyến trên từ trước — không cho đổi, trả về quan hệ hiện có
        // để client hiển thị đúng (idempotent, tránh lỗi khi bấm đăng ký 2 lần).
        return res.status(200).json({ item: existing, alreadyExisted: true });
      }

      const doc = {
        referrerUuid,
        refereeUuid,
        code,
        source,
        chainStatus: 'pending',
        txHash: null,
        createdAt: new Date().toISOString(),
      };
      await col.insertOne(doc);
      return res.status(201).json({ item: doc, alreadyExisted: false });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[api/affiliate-referral] error:', error);
    return res.status(500).json({ error: error?.message || 'Lỗi máy chủ không xác định.' });
  }
}
