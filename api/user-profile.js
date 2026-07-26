// api/user-profile.js
// Đăng ký / tra cứu TÊN HIỂN THỊ theo UUID — dùng để LoginPage (trang Đăng
// ký) tự hiện đúng tên người giới thiệu (referrer) ngay khi User 2 dán/paste
// UUID của họ, kể cả khi referrer đang ở 1 thiết bị/trình duyệt hoàn toàn
// khác. Trước đây tên chỉ được lưu cục bộ (localStorage/IndexedDB) trên máy
// của chính người đó nên không thể tra cứu chéo thiết bị được — đây là kho
// tối giản (chỉ uuid -> tên tự khai) để giải quyết đúng vấn đề đó, KHÔNG
// phải một hệ thống định danh/định danh xác thực.
//
// Methods:
//   GET  ?uuid=<uuid>   -> { name: string|null }
//   POST { uuid, name } -> { ok: true }
//     Tự khai/cập nhật tên của CHÍNH mình — gọi tự động từ AuthContext.jsx
//     mỗi khi uuid/tên của phiên hiện tại có sẵn hoặc thay đổi.

import { connectToDatabase } from './_lib/mongodb.js';

const COLLECTION = 'user_profiles';

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(COLLECTION);

    if (req.method === 'GET') {
      const uuid = String(req.query?.uuid || '').trim();
      if (!uuid) {
        return res.status(400).json({ error: 'Thiếu uuid.' });
      }
      const doc = await col.findOne({ uuid });
      return res.status(200).json({ name: doc?.name || null });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const uuid = String(body?.uuid || '').trim();
      const name = String(body?.name || '').trim().slice(0, 120);
      if (!uuid || !name) {
        return res.status(400).json({ error: 'Thiếu uuid hoặc name.' });
      }
      await col.updateOne(
        { uuid },
        { $set: { uuid, name, updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/user-profile] error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}
