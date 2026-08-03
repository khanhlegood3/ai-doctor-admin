// api/_lib/videoToLearningHistory.js
// Lưu LỊCH SỬ từng lượt dùng tính năng "Video to Learning" (bao gồm cả
// nhánh mới: YouTube video/short, YouTube channel — chỉ lưu link, và Website)
// vào MongoDB, theo đúng uuid ẩn danh của người dùng (xem AuthContext.jsx /
// cdoc_users), để:
//   1. Người dùng xem lại lịch sử của chính mình dù đổi máy/xoá cache
//      (khác bản IndexedDB cục bộ chỉ tồn tại trên đúng 1 trình duyệt).
//   2. Admin xem được TOÀN BỘ user đã dùng tính năng này: xem video/trang
//      nào, AI trả lời gì, lúc nào, cùng vài số liệu thống kê xu hướng.
//
// Cùng pattern với api/game-play-log.js: append-only log (mỗi lượt là 1
// document riêng, không upsert/gộp) — giữ trọn lịch sử theo thời gian.
//
// Collection: "video_to_learning_history"
//   {
//     uuid, userId, name,               // định danh người dùng (xem cdoc_users)
//     type,                             // 'youtube_video' | 'youtube_short' | 'youtube_channel' | 'facebook_video' | 'website'
//     link,                             // URL gốc người dùng dán vào
//     title,                            // tiêu đề video/trang nếu biết được (tuỳ chọn)
//     aiSource,                         // 'groq-transcript' | 'groq-page' | 'gemini-fallback' | null (channel: không gọi AI)
//     status,                           // 'success' | 'error' | 'saved-only' (channel, không gọi AI)
//     errorMessage,                     // nếu status = 'error'
//     specPreview,                      // trích đoạn ngắn (≤500 ký tự) nội dung AI trả về — không lưu toàn bộ code để doc gọn
//     createdAt,                        // ISO string
//   }

import { connectToDatabase } from './mongodb.js'

const COLLECTION = 'video_to_learning_history'
const MAX_PREVIEW_CHARS = 500

let indexesEnsured = false
async function ensureIndexes(col) {
  if (indexesEnsured) return
  try {
    await col.createIndex({ uuid: 1, createdAt: -1 })
    await col.createIndex({ createdAt: -1 })
  } catch (err) {
    console.warn('[videoToLearningHistory] createIndex failed (có thể đã tồn tại):', err?.message)
  }
  indexesEnsured = true
}

const VALID_TYPES = new Set(['youtube_video', 'youtube_short', 'youtube_channel', 'facebook_video', 'website'])
const VALID_STATUS = new Set(['success', 'error', 'saved-only'])

export class VideoToLearningHistoryError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'VideoToLearningHistoryError'
    this.status = status
  }
}

/**
 * Ghi 1 lượt sử dụng vào lịch sử. Luôn INSERT mới (không upsert) — đúng tinh
 * thần "giữ trọn lịch sử theo thời gian" người dùng yêu cầu.
 */
export async function saveHistoryEntry({ uuid, userId, name, type, link, title, aiSource, status, errorMessage, specPreview } = {}) {
  const cleanUuid = String(uuid || '').trim()
  const cleanLink = String(link || '').trim()
  if (!cleanUuid) throw new VideoToLearningHistoryError('Thiếu uuid.', 400)
  if (!cleanLink) throw new VideoToLearningHistoryError('Thiếu link.', 400)
  const cleanType = VALID_TYPES.has(type) ? type : 'website'
  const cleanStatus = VALID_STATUS.has(status) ? status : 'success'

  const doc = {
    uuid: cleanUuid,
    userId: userId ? String(userId).trim() : null,
    name: name ? String(name).trim() : null,
    type: cleanType,
    link: cleanLink,
    title: title ? String(title).trim().slice(0, 300) : null,
    aiSource: aiSource ? String(aiSource) : null,
    status: cleanStatus,
    errorMessage: errorMessage ? String(errorMessage).slice(0, 1000) : null,
    specPreview: specPreview ? String(specPreview).slice(0, MAX_PREVIEW_CHARS) : null,
    createdAt: new Date().toISOString(),
  }

  const { db } = await connectToDatabase()
  const col = db.collection(COLLECTION)
  await ensureIndexes(col)
  const result = await col.insertOne(doc)
  return { item: { ...doc, _id: result.insertedId } }
}

/**
 * Lấy lịch sử của 1 uuid cụ thể (dùng cho cả "lịch sử của chính tôi" lẫn
 * admin xem lịch sử của 1 user bất kỳ — endpoint không phân biệt 2 trường
 * hợp này, đúng mô hình bảo mật hiện tại của app: gating admin ở client).
 */
export async function listHistoryEntries({ uuid, limit = 100 } = {}) {
  const cleanUuid = String(uuid || '').trim()
  if (!cleanUuid) throw new VideoToLearningHistoryError('Thiếu uuid.', 400)
  const cap = Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500)

  const { db } = await connectToDatabase()
  const col = db.collection(COLLECTION)
  await ensureIndexes(col)
  const items = await col.find({ uuid: cleanUuid }).sort({ createdAt: -1 }).limit(cap).toArray()
  return { items }
}

/**
 * Tổng hợp số liệu cho Admin panel:
 *   - totalEntries / totalUsers
 *   - byType: { youtube_video, youtube_short, youtube_channel, website }
 *   - byAiSource: { 'groq-transcript': n, 'groq-page': n, 'gemini-fallback': n, null: n (channel/lỗi) }
 *   - dailyTrend: 14 ngày gần nhất, [{ date: 'YYYY-MM-DD', count }]
 *   - perUser: mỗi user 1 dòng { uuid, userId, name, count, lastActivity } — sắp theo count giảm dần
 *   - recentEntries: 30 lượt mới nhất trên TOÀN BỘ hệ thống (mọi user)
 */
export async function getAdminOverview({ recentLimit = 30, perUserLimit = 200 } = {}) {
  const { db } = await connectToDatabase()
  const col = db.collection(COLLECTION)
  await ensureIndexes(col)

  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

  const [totalEntries, byTypeAgg, byAiSourceAgg, dailyTrendAgg, perUserAgg, recentEntries, distinctUsers] = await Promise.all([
    col.countDocuments({}),
    col.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]).toArray(),
    col.aggregate([{ $group: { _id: '$aiSource', count: { $sum: 1 } } }]).toArray(),
    col
      .aggregate([
        { $match: { createdAt: { $gte: fourteenDaysAgo } } },
        { $group: { _id: { $substrCP: ['$createdAt', 0, 10] }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray(),
    col
      .aggregate([
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$uuid',
            userId: { $first: '$userId' },
            name: { $first: '$name' },
            count: { $sum: 1 },
            lastActivity: { $first: '$createdAt' },
          },
        },
        { $sort: { count: -1 } },
        { $limit: Math.min(Math.max(parseInt(perUserLimit, 10) || 200, 1), 1000) },
      ])
      .toArray(),
    col.find({}).sort({ createdAt: -1 }).limit(Math.min(Math.max(parseInt(recentLimit, 10) || 30, 1), 200)).toArray(),
    col.distinct('uuid'),
  ])

  const byType = { youtube_video: 0, youtube_short: 0, youtube_channel: 0, facebook_video: 0, website: 0 }
  for (const row of byTypeAgg) {
    if (row._id && byType[row._id] !== undefined) byType[row._id] = row.count
  }

  const byAiSource = {}
  for (const row of byAiSourceAgg) {
    byAiSource[row._id || 'none'] = row.count
  }

  const dailyTrend = dailyTrendAgg.map((row) => ({ date: row._id, count: row.count }))

  const perUser = perUserAgg.map((row) => ({
    uuid: row._id,
    userId: row.userId || null,
    name: row.name || null,
    count: row.count,
    lastActivity: row.lastActivity,
  }))

  return {
    totalEntries,
    totalUsers: distinctUsers.length,
    byType,
    byAiSource,
    dailyTrend,
    perUser,
    recentEntries,
  }
}
