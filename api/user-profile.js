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
//   GET  ?userId=<id>            -> { uuid: string|null }  (tra ngược UUID theo User ID — dùng
//                                     để link giới thiệu ?ref=<userId> phân giải được đúng người,
//                                     vì mọi luồng nội bộ (referral, on-chain, cây F1/F2/F3) vẫn
//                                     vận hành theo UUID, User ID chỉ là bí danh công khai để chia
//                                     sẻ an toàn/dễ đọc hơn.)
//   GET  ?checkUserId=<id>       -> { available: boolean, reason?: 'invalid_format'|'taken' }
//   GET  ?adminApiAccessList=1 (header x-admin-secret) -> { requests: [...] } (chờ duyệt API trả phí)
//   POST { uuid, name, secret, verified, userId?, email?, apiAccessRequest? } -> { ok: true, apiAccessStatus }
//   POST { action: 'decideApiAccess', uuid, decision: 'approve'|'reject', adminSecret } -> { ok: true }
//     - uuid CHƯA có trong kho: tạo mới, lưu hash(secret) làm "khoá sở hữu".
//     - uuid ĐÃ có: chỉ chấp nhận cập nhật nếu hash(secret) khớp khoá đã lưu
//       -> trả 403 nếu không khớp (ai đó đang cố sửa tên cho UUID không phải
//       của họ).
//     - verified: true CHỈ nên gửi khi tên đến từ 1 provider OAuth đã xác
//       thực (Google/Apple) — xem Mức 2 ở LoginPage.jsx. Một khi đã verified
//       thì không bị hạ cấp lại xuống false bởi lần ghi sau.
//     - userId (tuỳ chọn): nếu gửi, phải khớp USER_ID_REGEX và CHƯA thuộc về
//       1 uuid khác -> trả 409 nếu trùng. CHỈ ĐƯỢC ĐẶT 1 LẦN DUY NHẤT cho mỗi
//       uuid: nếu uuid đã có userId khác giá trị đang gửi -> trả 409 (không
//       cho đổi lại); gửi lại đúng userId hiện tại thì không sao (idempotent).

import { createHash } from 'crypto';
import { connectToDatabase } from './_lib/mongodb.js';

const COLLECTION = 'user_profiles';
const USER_ID_REGEX = /^[A-Za-z0-9_]{3,24}$/;

// ─── Quyền dùng API trả phí (paid_api) ─────────────────────────────────────
// Vercel Hobby giới hạn 12 Serverless Functions (đã dùng hết — xem ghi chú
// trong api/_lib/aiChatbotControlProxy.js), nên tính năng này được GHÉP vào
// đúng endpoint /api/user-profile thay vì tạo file api/*.js mới, tái sử dụng
// luôn kết nối Mongo + collection user_profiles đã có (đã keyed theo uuid).
//
// Luồng:
//  1. User đăng ký (email/password) và tick "muốn dùng API trả phí" ->
//     client POST { uuid, name, secret, apiAccessRequest: true, email } ->
//     xác thực bằng đúng cơ chế secret sở hữu uuid đã có sẵn ở trên (KHÔNG
//     cần thêm auth mới) -> set apiAccessStatus = 'pending' -> báo admin
//     qua Telegram nếu đã cấu hình TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID
//     (best-effort, xem notifyAdminNewApiAccessRequest bên dưới).
//  2. Admin (trang Quản Trị) GET ?adminApiAccessList=1 kèm header
//     x-admin-secret để xem danh sách đang chờ (vẫn xem được kể cả khi
//     chưa cấu hình Telegram — panel tự làm mới).
//  3. Admin POST { action: 'decideApiAccess', uuid, decision, adminSecret }
//     để duyệt/từ chối -> set apiAccessStatus = 'approved' | 'rejected'.
// ADMIN_API_SECRET là biến môi trường server-only (không tiền tố VITE_, nên
// không lọt vào bundle) — Admin tự nhập secret này 1 lần trong panel Quản
// Trị (lưu localStorage trên máy admin), giống hệt cách app đã làm với
// "khoá sở hữu" ở trên — không phải auth server thật, nhưng đúng mức độ bảo
// mật hiện có của toàn bộ app này (xem ghi chú đầu file: "App này KHÔNG có
// server-session/cookie").
function isValidAdminSecret(secret) {
  const expected = process.env.ADMIN_API_SECRET;
  return !!expected && !!secret && secret === expected;
}

// Báo admin ngay khi có yêu cầu dùng API trả phí mới (best-effort — lỗi ở
// đây KHÔNG được làm hỏng response chính, vì đây chỉ là tiện ích thông
// báo, không phải nghiệp vụ cốt lõi). Dùng Telegram Bot API vì: (1) không
// cần thêm npm dependency (chỉ 1 lần fetch), (2) push thẳng vào điện thoại
// admin theo thời gian thực, khác hẳn cách "pull" hiện có (admin phải tự
// mở panel Quản Trị mới thấy). Không set TELEGRAM_BOT_TOKEN/CHAT_ID thì
// bỏ qua im lặng — app vẫn hoạt động bình thường, chỉ là không có thông
// báo chủ động.
async function notifyAdminNewApiAccessRequest({ name, email, uuid }) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const text =
    `🔔 Yêu cầu dùng API trả phí mới\n` +
    `Tên: ${name || 'Không tên'}\n` +
    (email ? `Email: ${email}\n` : '') +
    `UUID: ${uuid}\n\n` +
    `Vào trang Quản Trị → "Yêu Cầu Dùng API Trả Phí" để duyệt.`;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (err) {
    console.warn('[api/user-profile] notifyAdminNewApiAccessRequest failed:', err?.message);
  }
}

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
      // Admin: danh sách yêu cầu dùng API trả phí đang chờ duyệt.
      if (req.query?.adminApiAccessList !== undefined) {
        if (!isValidAdminSecret(req.headers['x-admin-secret'])) {
          return res.status(403).json({ error: 'Sai admin secret.' });
        }
        const pending = await col
          .find({ apiAccessStatus: 'pending' })
          .project({ uuid: 1, name: 1, email: 1, apiAccessRequestedAt: 1, apiAccessNote: 1 })
          .sort({ apiAccessRequestedAt: 1 })
          .toArray();
        return res.status(200).json({ requests: pending });
      }

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
      if (uuid) {
        const doc = await col.findOne({ uuid });
        return res.status(200).json({
          name: doc?.name || null,
          verified: !!doc?.verified,
          userId: doc?.userId || null,
          apiAccessStatus: doc?.apiAccessStatus || 'none',
        });
      }

      if (req.query?.userId !== undefined) {
        const userId = String(req.query.userId || '').trim();
        if (!USER_ID_REGEX.test(userId)) {
          return res.status(200).json({ uuid: null });
        }
        const doc = await col.findOne({ userIdLower: userId.toLowerCase() });
        return res.status(200).json({ uuid: doc?.uuid || null });
      }

      return res.status(400).json({ error: 'Thiếu uuid, userId hoặc checkUserId.' });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }

      // Admin: duyệt / từ chối 1 yêu cầu dùng API trả phí.
      if (body?.action === 'decideApiAccess') {
        if (!isValidAdminSecret(body?.adminSecret)) {
          return res.status(403).json({ error: 'Sai admin secret.' });
        }
        const uuid = String(body?.uuid || '').trim();
        const decision = body?.decision === 'approve' ? 'approved' : body?.decision === 'reject' ? 'rejected' : null;
        if (!uuid || !decision) {
          return res.status(400).json({ error: 'Thiếu uuid hoặc decision không hợp lệ.' });
        }
        const result = await col.updateOne(
          { uuid },
          { $set: { apiAccessStatus: decision, apiAccessDecidedAt: new Date().toISOString() } }
        );
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: 'Không tìm thấy uuid.' });
        }
        return res.status(200).json({ ok: true, apiAccessStatus: decision });
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
        // CHỈ ĐƯỢC ĐẶT USER ID 1 LẦN DUY NHẤT: nếu uuid này đã có userId từ
        // trước (khác giá trị đang gửi lên) -> từ chối, kể cả khi secret khớp
        // đúng chủ sở hữu. Gửi lại đúng userId hiện tại thì vẫn cho qua
        // (idempotent, vd lần đồng bộ lại profile không cố tình đổi).
        if (existing?.userId && existing.userId.toLowerCase() !== userId.toLowerCase()) {
          return res.status(409).json({ error: `UUID này đã đặt User ID "${existing.userId}" trước đó — mỗi tài khoản chỉ được đặt User ID 1 lần duy nhất, không thể đổi lại.` });
        }
        const userIdLower = userId.toLowerCase();
        const ownerOfUserId = await col.findOne({ userIdLower });
        if (ownerOfUserId && ownerOfUserId.uuid !== uuid) {
          return res.status(409).json({ error: `User ID "${userId}" đã có người dùng — hãy chọn User ID khác.` });
        }
      }

      const email = body?.email ? String(body.email).trim().slice(0, 200) : null;
      const apiAccessRequest = !!body?.apiAccessRequest;

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
      if (email) {
        setFields.email = email;
      }
      if (apiAccessRequest) {
        // Không cho gửi lại yêu cầu mới nếu đã được duyệt trước đó (idempotent,
        // tránh vô tình đưa 1 tài khoản đã 'approved' về lại 'pending').
        if (existing?.apiAccessStatus !== 'approved') {
          setFields.apiAccessStatus = 'pending';
          setFields.apiAccessRequestedAt = new Date().toISOString();
        }
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

      // Chỉ báo admin khi đây là lần ĐẦU TIÊN chuyển sang pending (không báo
      // lại mỗi lần AuthContext tự đồng bộ/gọi lại request đã pending sẵn).
      if (setFields.apiAccessStatus === 'pending' && existing?.apiAccessStatus !== 'pending') {
        notifyAdminNewApiAccessRequest({ name, email, uuid }).catch(() => {});
      }

      return res.status(200).json({ ok: true, apiAccessStatus: setFields.apiAccessStatus || existing?.apiAccessStatus || 'none' });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[api/user-profile] error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ.' });
  }
}
