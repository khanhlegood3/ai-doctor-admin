// api/_lib/videoToLearningHistoryR2.js
// Sao lưu ĐẦY ĐỦ 1 creation (kết quả "Video to Learning": spec + code HTML)
// lên Cloudflare R2 — dùng SONG SONG với:
//   - IndexedDB cục bộ (lib/history/historyStorage.ts): đọc lại NGAY LẬP
//     TỨC, không cần mạng, nhưng CHỈ tồn tại trên đúng 1 trình duyệt.
//   - MongoDB (videoToLearningHistory.js): chỉ lưu METADATA + specPreview
//     (≤500 ký tự) để gọn document cho Admin xem/thống kê, KHÔNG lưu
//     fullSpec/fullCode.
// R2 lấp đúng khoảng trống còn lại: bản sao lưu ĐẦY ĐỦ (spec+code thật),
// bền, không phụ thuộc trình duyệt/thiết bị — cho phép người dùng "Reload"
// lại đúng app đã tạo dù đổi máy/xoá cache, giống hệt cơ chế R2 đã có ở
// "Bring Any Idea to Life" (xem bringAnyIdeaToLifeHistoryR2.js, cùng kiến
// trúc, chỉ khác object layout).
//
// KHÁC bringAnyIdeaToLifeHistoryR2.js (không có đăng nhập, lưu phẳng theo id
// ẩn danh): Video to Learning ĐÃ CÓ uuid ẩn danh ổn định theo từng người
// dùng (xem lib/khanhIdentity.js, dùng chung với MongoDB ở trên) — nên scope
// R2 theo uuid ngay từ tên object, vừa cho phép "load lịch sử của riêng tôi"
// (không cần quét toàn bộ bucket), vừa tránh 1 người dùng thấy creation của
// người khác.
//
// Object layout trong bucket (dùng chung bucket R2 hiện có, xem r2Storage.js):
//   video-to-learning/creations/<uuid>/<id>.json
//     - { id, uuid, type, link, title, spec, code, aiSource, timestamp }

import { uploadBufferToR2, getR2PublicUrl, listR2Keys } from './r2Storage.js'

export class VideoToLearningHistoryR2Error extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'VideoToLearningHistoryR2Error'
    this.status = status
  }
}

function sanitizeUuidForKey(uuid) {
  // uuid ẩn danh thường đã là chuỗi an toàn (xem khanhIdentity.js), nhưng lọc
  // phòng hờ ký tự lạ lọt vào R2 object key (path separator, khoảng trắng...).
  return String(uuid || '').trim().replace(/[^a-zA-Z0-9_-]/g, '')
}

/**
 * @param {object} params
 * @param {string} params.uuid - uuid ẩn danh của người dùng (xem khanhIdentity.js)
 * @param {string} params.id - id của creation (client sinh bằng crypto.randomUUID())
 * @param {string} params.type - LinkType ('youtube_video' | ... | 'website' | 'image')
 * @param {string} params.link - URL gốc (hoặc tên file, với type 'image')
 * @param {string} [params.title]
 * @param {string} params.spec - spec/ghi chú AI đã sinh
 * @param {string} params.code - HTML đầy đủ đã sinh
 * @param {string} [params.aiSource]
 * @param {string} [params.timestamp] - ISO string, mặc định là lúc gọi hàm
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ jsonUrl: string }>}
 */
export async function saveVideoToLearningCreationToR2({
  uuid,
  id,
  type,
  link,
  title,
  spec,
  code,
  aiSource,
  timestamp,
  envSource = process.env,
}) {
  const cleanUuid = sanitizeUuidForKey(uuid)
  if (!cleanUuid) throw new VideoToLearningHistoryR2Error('Thiếu uuid.', 400)
  if (!id) throw new VideoToLearningHistoryR2Error('Thiếu id của creation.', 400)
  if (!code) throw new VideoToLearningHistoryR2Error('Thiếu code (HTML) của creation.', 400)

  const creationRecord = {
    id,
    uuid: cleanUuid,
    type: type || 'website',
    link: link || null,
    title: title || null,
    spec: spec || '',
    code,
    aiSource: aiSource || null,
    timestamp: timestamp || new Date().toISOString(),
  }
  const jsonBuffer = Buffer.from(JSON.stringify(creationRecord), 'utf-8')
  const jsonKey = `video-to-learning/creations/${cleanUuid}/${id}.json`
  await uploadBufferToR2({ buffer: jsonBuffer, key: jsonKey, contentType: 'application/json', envSource })

  return { jsonUrl: getR2PublicUrl(jsonKey, { envSource }) }
}

/**
 * Load toàn bộ creation JSON đã sao lưu trong R2 CỦA ĐÚNG 1 uuid — dùng cho
 * nút "Nạp lịch sử từ R2" (đổi máy/xoá cache vẫn thấy lại đầy đủ spec+code).
 * @param {object} params
 * @param {string} params.uuid
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ creations: Array<object>, count: number }>}
 */
export async function loadVideoToLearningCreationsFromR2({ uuid, envSource = process.env } = {}) {
  const cleanUuid = sanitizeUuidForKey(uuid)
  if (!cleanUuid) throw new VideoToLearningHistoryR2Error('Thiếu uuid.', 400)

  const keys = await listR2Keys({ prefix: `video-to-learning/creations/${cleanUuid}/`, envSource })
  const creations = []

  await Promise.all(keys.filter((key) => key.endsWith('.json')).map(async (key) => {
    const url = getR2PublicUrl(key, { envSource })
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const item = await res.json()
      if (item?.id && item?.code) creations.push(item)
    } catch (err) {
      console.warn('[video-to-learning-r2] skip unreadable creation:', key, err?.message || err)
    }
  }))

  creations.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
  return { creations, count: creations.length }
}
