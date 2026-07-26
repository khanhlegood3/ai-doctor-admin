// api/user-profile.js
// Đăng ký / tra cứu TÊN HIỂN THỊ theo UUID — dùng để LoginPage (trang Đăng
// ký) tự hiện đúng tên người giới thiệu (referrer) ngay khi User 2 dán/paste
// UUID của họ, kể cả khi referrer đang ở 1 thiết bị/trình duyệt hoàn toàn
// khác. Trước đây tên chỉ được lưu cục bộ (localStorage/IndexedDB) trên máy
// của chính người đó nên không thể tra cứu chéo thiết bị được — đây là kho
// tối giản (uuid -> tên) để giải quyết đúng vấn đề đó, KHÔNG phải một hệ
// thống định danh/xác thực đầy đủ.
//
// App này KHÔNG có server-session/cookie (toàn bộ auth là client-side —
// xem AuthContext.jsx), nên "chỉ cho phép đúng chủ UUID sửa tên của UUID đó"
// không thể dựa vào session như 1 backend có auth thật. Thay vào đó dùng 1
// SECRET ngẫu nhiên sinh 1 LẦN trên chính thiết bị đó (xem
// getOrCreateProfileSecret trong AuthContext.jsx), không rời khỏi thiết bị
// trừ lúc gửi kèm request này — hoạt động theo kiểu "ai claim UUID trước,
// giữ secret đó, thì mới có quyền sửa tên cho UUID đó về sau" (first-claim-
// wins). KHÔNG chống được kẻ tấn công có quyền truy cập localStorage của
// đúng thiết bị nạn nhân, nhưng chặn được việc 1 thiết bị B tự POST tên giả
// cho UUID KHÔNG PHẢI của mình (vd để mạo danh referrer khác) — đúng lỗ hổng
// cần vá.
//
// User ID (vd "KhanhLX1") — khác với "tên hiển thị" (name, có thể trùng,
// có dấu, có khoảng trắng): User ID là 1 handle NGẮN, DUY NHẤT TRÊN TOÀN HỆ
// THỐNG, chỉ gồm chữ cái không dấu / số / gạch dưới, không khoảng trắng.
// Uniqueness được đảm bảo ở 2 lớp: (1) check trước khi ghi, (2) unique index
// thật trên Mongo (userIdLower) để chặn race condition 2 người bấm Đăng ký
// cùng lúc với cùng 1 User ID.
//
// Methods:
//   GET  ?uuid=<uuid>            -> { name: string|null, verified: boolean, userId: string|null }
//   GET  ?checkUserId=<id>       -> { available: boolean, reason?: 'invalid_format'|'taken' }
//   POST { uuid, name, secret, verified, userId? } -> { ok: true }
//     - uuid CHƯA có trong kho: tạo mới, lưu hash(secret) làm "khoá sở hữu".
//     - uuid ĐÃ có: chỉ chấp nhận cập nhật nếu hash(secret) khớp khoá đã lưu
//       -> trả 403 nếu không khớp (ai đó đang cố sửa tên cho UUID không phải
//       của họ).
//     - verified: true CHỈ nên gửi khi tên đến từ 1 provider OAuth đã xác
//       thực (Google/Apple) — xem Mức 2 ở LoginPage.jsx. Một khi đã verified
//       thì không bị hạ cấp lại xuống false bởi lần ghi sau.
//     - userId (tuỳ chọn): nếu gửi, phải khớp USER_ID_REGEX và CHƯA thuộc về
//       1 uuid khác -> trả 409 nếu trùng. 1 uuid chỉ giữ 1 userId; gửi lại
//       cùng userId của chính mình thì không sao (idempotent).

import { createHash } from 'crypto';
import { connectToDatabase } from './_lib/mongodb.js';

const COLLECTION = 'user_profiles';
const USER_ID_REGEX = /^[A-Za-z0-9_]{3,24}$/;

function hashSecret(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

let indexEnsured = false;
async function ensureUserIdIndex(col) {
  if (indexEnsured) return;
  try {
    // sparse: true -> các doc chưa có userId (chưa đăng ký handle) không bị
    // tính là "trùng null" với nhau.
    await col.createIndex({ userIdLower: 1 }, { unique: true, sparse: true });
  } catch (err) {
    console.warn('[api/user-profile] createIndex userIdLower failed (có thể đã tồn tại):', err?.message);
  }
  indexEnsured = true;
}

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(COLLECTION);
    await ensureUserIdIndex(col);

    if (req.method === 'GET') {
      // Kiểm tra nhanh 1 User ID còn trống hay không (dùng lúc gõ ở form
      // Đăng ký, TRƯỚC KHI tài khoản/uuid tồn tại nên chưa gọi được nhánh
      // uuid bên dưới).
      if (req.query?.checkUserId !== undefined) {
        const userId = String(req.query.checkUserId || '').trim();
        if (!USER_ID_REGEX.test(userId)) {
          return res.status(200).json({ available: false, reason: 'invalid_format' });
        }
        const taken = await col.findOne({ userIdLower: userId.toLowerCase() });
        return res.status(200).json({ available: !taken, reason: taken ? 'taken' : undefined });
      }

      const uuid = String(req.query?.uuid || '').trim();
      if (!uuid) {
        return res.status(400).json({ error: 'Thiếu uuid.' });
      }
      const doc = await col.findOne({ uuid });
      return res.status(200).json({ name: doc?.name || null, verified: !!doc?.verified, userId: doc?.userId || null });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const uuid = String(body?.uuid || '').trim();
      const name = String(body?.name || '').trim().slice(0, 120);
      const secret = String(body?.secret || '').trim();
      const verified = !!body?.verified;
      const userId = body?.userId ? String(body.userId).trim() : null;
      if (!uuid || !name) {
        return res.status(400).json({ error: 'Thiếu uuid hoặc name.' });
      }
      if (!secret) {
        return res.status(400).json({ error: 'Thiếu secret sở hữu UUID.' });
      }
      if (userId && !USER_ID_REGEX.test(userId)) {
        return res.status(400).json({ error: 'User ID không hợp lệ — chỉ gồm chữ không dấu, số, dấu gạch dưới, 3-24 ký tự, không khoảng trắng.' });
      }
      const secretHash = hashSecret(secret);

      const existing = await col.findOne({ uuid });
      if (existing?.secretHash && existing.secretHash !== secretHash) {
        return res.status(403).json({ error: 'Không có quyền cập nhật tên cho UUID này (secret không khớp chủ sở hữu đã đăng ký trước đó).' });
      }

      if (userId) {
        const userIdLower = userId.toLowerCase();
        const ownerOfUserId = await col.findOne({ userIdLower });
        if (ownerOfUserId && ownerOfUserId.uuid !== uuid) {
          return res.status(409).json({ error: `User ID "${userId}" đã có người dùng — hãy chọn User ID khác.` });
        }
      }

      const setFields = {
        uuid,
        name,
        secretHash,
        verified: verified || !!existing?.verified, // không hạ cấp verified đã có
        updatedAt: new Date().toISOString(),
      };
      if (userId) {
        setFields.userId = userId;
        setFields.userIdLower = userId.toLowerCase();
      }

      try {
        await col.updateOne({ uuid }, { $set: setFields }, { upsert: true });
      } catch (err) {
        // Race condition: 2 người bấm Đăng ký cùng lúc với cùng userId ->
        // unique index chặn ở tầng Mongo dù đã check trước đó.
        if (err?.code === 11000) {
          return res.status(409).json({ error: `User ID "${userId}" vừa được người khác đăng ký trước — hãy chọn User ID khác.` });
        }
        throw err;
      }
      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/user-profile] error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}
