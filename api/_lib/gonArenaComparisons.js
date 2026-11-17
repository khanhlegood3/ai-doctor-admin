// Full anonymous duel archive: immutable JSON snapshots in R2 + latest
// comparison in MongoDB. No user ID, API key, cookie or IP is persisted.
import { createHash } from 'node:crypto'
import { uploadBufferToR2, getR2PublicUrl } from './r2Storage.js'
import { ARENA_ENGINE_NAMES } from './arenaUserKeyEngines.js'

export class GonArenaComparisonError extends Error {
  constructor(message, status = 400) { super(message); this.status = status }
}
const engines = new Set(ARENA_ENGINE_NAMES)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
function fail(message, status = 400) { throw new GonArenaComparisonError(message, status) }
function text(value, max, field) {
  if (typeof value !== 'string' || value.length > max) fail(`${field} không hợp lệ.`)
  return value
}
function date(value, field) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(`${field} không hợp lệ.`)
  return new Date(value).toISOString()
}

export function normalizeArenaComparison(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Thiếu dữ liệu so sánh.')
  if (!uuid.test(input.id || '')) fail('ID trận đấu không hợp lệ.')
  if (!Number.isSafeInteger(input.revision) || input.revision < 1) fail('Revision không hợp lệ.')
  if (!engines.has(input.modelA) || !engines.has(input.modelB)) fail('Model không hợp lệ.')
  const vote = input.vote ?? null
  if (![null, 'a', 'b', 'tie'].includes(vote)) fail('Đánh giá không hợp lệ.')
  if (!Array.isArray(input.videoUrls) || input.videoUrls.length > 2) fail('Tối đa 2 video nguồn.')
  const videoUrls = input.videoUrls.map(value => {
    const link = text(value, 2000, 'URL')
    let url
    try { url = new URL(link) } catch { fail('URL không hợp lệ.') }
    if (!['http:', 'https:'].includes(url.protocol)) fail('URL không hợp lệ.')
    return link
  })
  const results = {}
  for (const side of ['a', 'b']) {
    const result = input.results?.[side]
    if (!result || !['done', 'error'].includes(result.status)) fail('Cả hai model phải hoàn tất trước khi lưu.')
    if (!uuid.test(result.id || '')) fail('ID kết quả không hợp lệ.')
    const html = result.status === 'done' ? text(result.html, 1000000, 'HTML') : null
    if (result.status === 'done' && !html.trim()) fail('Thiếu HTML của kết quả thành công.')
    results[side] = {
      id: result.id, engine: side === 'a' ? input.modelA : input.modelB,
      // UI configuration label at generation time (not a verified upstream
      // model ID; providers may be overridden in server configuration).
      modelLabel: text(result.modelLabel || (side === 'a' ? input.modelA : input.modelB), 200, 'Nhãn model'),
      status: result.status, html,
      error: result.status === 'error' ? text(result.error || 'Model gặp lỗi', 10000, 'Lỗi') : null,
      completedAt: date(result.completedAt, 'Thời điểm kết quả'),
    }
  }
  const doc = {
    schemaVersion: 1, id: input.id, revision: input.revision,
    description: text(input.description || '', 20000, 'Mô tả'), videoUrls,
    modelA: input.modelA, modelB: input.modelB, results, vote,
    winner: vote === 'a' ? input.modelA : vote === 'b' ? input.modelB : null,
    // Same-engine retries are archived, but excluded from model ranking.
    comparable: input.modelA !== input.modelB,
    createdAt: date(input.createdAt, 'Thời điểm bắt đầu'),
    votedAt: vote ? date(input.votedAt, 'Thời điểm đánh giá') : null,
  }
  if (Buffer.byteLength(JSON.stringify(doc)) > 3 * 1024 * 1024) fail('Kết quả quá lớn để lưu (tối đa 3 MB).', 413)
  return doc
}

async function defaultCollection() {
  // Lazy import: do not open a Mongo connection during build or unit tests.
  const { connectToDatabase } = await import('./mongodb.js')
  const { db } = await connectToDatabase()
  const col = db.collection('gon_arena_comparisons')
  await col.createIndex({ createdAt: -1 })
  await col.createIndex({ comparable: 1, winner: 1 })
  return col // _id = duel ID is already a unique index.
}
function response(doc) {
  return { id: doc.id, revision: doc.revision, jsonUrl: doc.jsonUrl, saved: true }
}

export async function saveGonArenaComparison(input, {
  getCollection = defaultCollection, upload = uploadBufferToR2,
  publicUrl = getR2PublicUrl, envSource = process.env,
} = {}) {
  const doc = normalizeArenaComparison(input)
  const snapshotHash = createHash('sha256').update(JSON.stringify(doc)).digest('hex')
  const col = await getCollection()
  const previous = await col.findOne({ _id: doc.id })
  if (previous?.revision > doc.revision) return response(previous)
  if (previous?.revision === doc.revision) {
    if (previous.snapshotHash !== snapshotHash) fail('Revision đã lưu có nội dung khác.', 409)
    return response(previous)
  }
  if (previous?.vote) fail('Trận đấu đã được đánh giá, không thể sửa kết quả.', 409)

  // Whitelisted creation records also enter the existing GON R2 archive so
  // BOTH successful apps can be reopened without choosing “Use this version”.
  for (const side of ['a', 'b']) {
    const result = doc.results[side]
    if (result.status !== 'done') continue
    const creation = {
      id: result.id,
      name: `${(doc.description || doc.videoUrls[0] || 'GON Arena').slice(0, 120)} • Model ${side.toUpperCase()}`,
      html: result.html, videoUrl: doc.videoUrls[0] || null,
      imageUrl: null, mimeType: null, timestamp: result.completedAt,
    }
    await upload({ key: `bring-any-idea-to-life/creations/${result.id}.json`, buffer: Buffer.from(JSON.stringify(creation)), contentType: 'application/json', envSource })
  }
  // Content-addressed snapshots prevent a delayed/retried request from
  // overwriting the JSON referenced by a newer Mongo revision.
  const key = `gon-arena/comparisons/${doc.id}/${doc.revision}-${snapshotHash}.json`
  await upload({ key, buffer: Buffer.from(JSON.stringify(doc, null, 2)), contentType: 'application/json', envSource })
  const record = { ...doc, snapshotHash, jsonUrl: publicUrl(key, { envSource }), updatedAt: new Date().toISOString() }
  try {
    await col.updateOne(
      { _id: doc.id, revision: { $lt: doc.revision }, $or: [{ vote: null }, { snapshotHash }] },
      { $set: record }, { upsert: true },
    )
  } catch (error) {
    if (error.code !== 11000) throw error
    const latest = await col.findOne({ _id: doc.id })
    if (!latest || latest.revision < doc.revision || (latest.revision === doc.revision && latest.snapshotHash !== snapshotHash)) {
      fail('Kết quả đã được cập nhật hoặc đánh giá. Vui lòng tải lại.', 409)
    }
    return response(latest)
  }
  return response(record)
}
