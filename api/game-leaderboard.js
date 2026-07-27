// api/game-leaderboard.js
//
// Lý do file này tồn tại: gameAffiliateDB.js (IndexedDB) chỉ lưu tiến trình
// chơi game TRÊN TỪNG TRÌNH DUYỆT/THIẾT BỊ — không đủ để xếp hạng "ai thắng
// BOSS nhanh nhất" giữa TẤT CẢ người chơi. Endpoint này dùng MongoDB (đã có
// sẵn MONGODB_URI trên Vercel — cùng pattern với api/affiliate-referral.js)
// làm nguồn sự thật DÙNG CHUNG cho Leader Board "Hành Trình Bảo Vệ Cơ Thể".
//
// Collection: "game_boss_leaderboard"
//   { uuid, name, gameId, gameTitle, bestTimeSec, bestScore, winCount,
//     createdAt, updatedAt }
//   - unique theo (uuid, gameId): mỗi user chỉ giữ 1 dòng "thành tích tốt
//     nhất" (thời gian thắng BOSS nhanh nhất) cho mỗi game — không lưu mọi
//     lượt chơi để leaderboard luôn gọn và luôn phản ánh kỷ lục cá nhân.
//
// Methods:
//   GET  ?gameId=<id>&limit=20
//     -> { items: [{ rank, uuid, name, bestTimeSec, bestScore, winCount }] }
//        Sắp xếp bestTimeSec TĂNG DẦN (thắng BOSS càng NHANH thì hạng càng
//        cao — rank 1 = nhanh nhất).
//   POST { uuid, name, gameId, gameTitle, status, score, timeSec }
//     -> Chỉ ghi nhận khi status === 'win'. Nếu đây là kỷ lục MỚI (nhanh hơn
//        lần trước của chính uuid này, hoặc lần đầu thắng) thì cập nhật.
//     -> { item, rank, isNewBest, totalPlayers }
import { connectToDatabase } from './_lib/mongodb.js';

const COLLECTION = 'game_boss_leaderboard';

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const col = db.collection(COLLECTION);

    if (req.method === 'GET') {
      const { gameId, limit } = req.query || {};
      if (!gameId) {
        return res.status(400).json({ error: 'Cần truyền query "gameId".' });
      }
      const cap = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
      const items = await col
        .find({ gameId: String(gameId) })
        .sort({ bestTimeSec: 1, bestScore: -1 })
        .limit(cap)
        .toArray();

      const ranked = items.map((it, idx) => ({
        rank: idx + 1,
        uuid: it.uuid,
        name: it.name || 'Ẩn danh',
        bestTimeSec: it.bestTimeSec,
        bestScore: it.bestScore,
        winCount: it.winCount || 1,
        updatedAt: it.updatedAt,
      }));
      return res.status(200).json({ items: ranked });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = {}; }
      }
      const uuid = String(body?.uuid || '').trim();
      const gameId = String(body?.gameId || '').trim();
      const gameTitle = body?.gameTitle || gameId;
      const name = String(body?.name || '').trim() || 'Ẩn danh';
      const status = body?.status;
      const score = Number(body?.score) || 0;
      const timeSec = Number(body?.timeSec) || 0;

      if (!uuid || !gameId) {
        return res.status(400).json({ error: 'Thiếu uuid hoặc gameId.' });
      }
      if (status !== 'win') {
        // Chỉ BOSS-clear (status === 'win') mới được xếp hạng leaderboard —
        // lượt thua vẫn có thể được ghi nhận tiến trình ở nơi khác (progress
        // store cục bộ trong gameAffiliateDB.js), nhưng không vào bảng này.
        return res.status(200).json({ item: null, rank: null, isNewBest: false, note: 'not_a_win' });
      }
      if (timeSec <= 0) {
        return res.status(400).json({ error: 'timeSec phải > 0 để xếp hạng theo thời gian.' });
      }

      const existing = await col.findOne({ uuid, gameId });
      let isNewBest = false;

      if (!existing) {
        isNewBest = true;
        await col.insertOne({
          uuid, name, gameId, gameTitle,
          bestTimeSec: timeSec, bestScore: score, winCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      } else if (timeSec < existing.bestTimeSec) {
        isNewBest = true;
        await col.updateOne(
          { uuid, gameId },
          { $set: { name, bestTimeSec: timeSec, bestScore: Math.max(score, existing.bestScore || 0), updatedAt: new Date().toISOString() }, $inc: { winCount: 1 } },
        );
      } else {
        // Không phải kỷ lục mới nhưng vẫn ghi nhận thêm 1 lần thắng + cập
        // nhật tên hiển thị mới nhất (VD: user đổi tên sau khi từng thắng).
        await col.updateOne(
          { uuid, gameId },
          { $set: { name, updatedAt: new Date().toISOString() }, $inc: { winCount: 1 } },
        );
      }

      const item = await col.findOne({ uuid, gameId });
      const totalPlayers = await col.countDocuments({ gameId });
      const betterCount = await col.countDocuments({ gameId, bestTimeSec: { $lt: item.bestTimeSec } });
      const rank = betterCount + 1;

      return res.status(existing ? 200 : 201).json({ item, rank, isNewBest, totalPlayers });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[api/game-leaderboard] error:', error);
    return res.status(500).json({ error: error?.message || 'Lỗi máy chủ không xác định.' });
  }
}
