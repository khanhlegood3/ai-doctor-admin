// api/game-play-log.js
//
// Lý do file này tồn tại: api/game-leaderboard.js CHỈ lưu kỷ lục thắng tốt
// nhất (bestTimeSec) theo (uuid, gameId) — chủ động bỏ qua mọi lượt THUA và
// không lưu lịch sử từng lượt chơi. File này khác: ghi lại NGUYÊN VẸN từng
// lượt chơi (thắng lẫn thua, kể cả điểm 0), dùng để tracking hành vi người
// chơi (đã chơi game nào, thắng/thua, mất bao lâu, lúc nào) — tương đương
// bản localStorage đã có sẵn trong portal-index.html (loadLB/saveLB), nhưng
// lưu server-side (MongoDB) để không mất khi đổi máy/xoá cache trình duyệt,
// và để sau này có thể tổng hợp xem tracking nhiều người chơi cùng lúc.
//
// Collection: "game_play_log"
//   { uuid, name, gameId, gameTitle, status, score, timeSec, meta, createdAt }
//   - KHÔNG unique/upsert — mỗi lượt chơi là 1 document riêng (kể cả lượt
//     thua, kể cả score = 0), khác hẳn kiểu "chỉ giữ bản ghi tốt nhất" của
//     game-leaderboard.js.
//
// Methods:
//   GET  ?uuid=<uuid>&limit=100        -> { items: [...] }  (lịch sử của 1 người chơi)
//   GET  ?gameId=<id>&limit=100        -> { items: [...] }  (lịch sử của 1 game, mọi người chơi)
//   GET  ?uuid=<uuid>&gameId=<id>      -> { items: [...] }  (kết hợp cả 2 điều kiện)
//   POST { uuid, name, gameId, gameTitle, status, score, timeSec, meta }
//     -> { item }  (luôn insert mới, không cần status/score phải thoả điều
//        kiện gì — "nhận thưởng 0 điểm cũng ghi lại luôn" theo đúng yêu cầu).
import { connectToDatabase } from './_lib/mongodb.js';

const COLLECTION = 'game_play_log';

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(COLLECTION);

    if (req.method === 'GET') {
      const { uuid, gameId, limit } = req.query || {};
      if (!uuid && !gameId) {
        return res.status(400).json({ error: 'Cần truyền ít nhất "uuid" hoặc "gameId".' });
      }
      const query = {};
      if (uuid) query.uuid = String(uuid);
      if (gameId) query.gameId = String(gameId);

      const cap = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500);
      const items = await col
        .find(query)
        .sort({ createdAt: -1 })
        .limit(cap)
        .toArray();
      return res.status(200).json({ items });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const uuid = String(body?.uuid || '').trim();
      const gameId = String(body?.gameId || '').trim();
      const gameTitle = body?.gameTitle ? String(body.gameTitle) : gameId;
      const name = String(body?.name || '').trim() || 'Ẩn danh';
      const status = body?.status === 'win' ? 'win' : 'lose';
      // Cố tình KHÔNG chặn score = 0 hay timeSec = 0 — "nhận thưởng 0 điểm
      // cũng ghi lại luôn" theo đúng yêu cầu, khác với game-leaderboard.js.
      const score = Number.isFinite(Number(body?.score)) ? Number(body.score) : 0;
      const timeSec = Number.isFinite(Number(body?.timeSec)) ? Number(body.timeSec) : 0;
      const meta = body?.meta ?? null;

      if (!uuid || !gameId) {
        return res.status(400).json({ error: 'Thiếu uuid hoặc gameId.' });
      }

      const doc = {
        uuid, name, gameId, gameTitle,
        status, score, timeSec, meta,
        createdAt: new Date().toISOString(),
      };
      const result = await col.insertOne(doc);
      return res.status(201).json({ item: { ...doc, _id: result.insertedId } });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[api/game-play-log] error:', error);
    return res.status(500).json({ error: error?.message || 'Lỗi máy chủ không xác định.' });
  }
}
