// api/_lib/bringAnyIdeaToLifeHistoryR2.js
// Provider 'bring-any-idea-to-life-save-r2' của groq-proxy.js — sao lưu 1
// creation (kết quả "Bring Any Idea to Life") lên Cloudflare R2, dùng
// SONG SONG với IndexedDB cục bộ (xem src/bring-any-idea-to-life-khanh/src/lib/historyStorage.ts):
//   - IndexedDB: đọc lại NGAY LẬP TỨC, không cần mạng, không giới hạn CORS.
//   - R2: bản sao lưu bền, không phụ thuộc trình duyệt/thiết bị, và giải
//     phóng localStorage/IndexedDB khỏi việc phải giữ ảnh gốc base64 (vốn là
//     nguyên nhân chính gây đầy localStorage trước đây — xem comment cũ
//     "Local storage full or error saving history" đã bỏ trong App.tsx).
//
// Tính năng này KHÔNG có đăng nhập/uuid (dùng ẩn danh, xem BringAnyIdeaToLifePanel.jsx),
// nên không scope theo ownerUuid như video-to-learning-history — chỉ lưu
// phẳng theo id của creation (id do client sinh bằng crypto.randomUUID()).
//
// Object layout trong bucket (dùng chung bucket R2 hiện có, xem r2Storage.js):
//   bring-any-idea-to-life/source-files/<id>.<ext> - ảnh/video/PDF gốc user upload
//   bring-any-idea-to-life/images/<id>.<ext>        - legacy ảnh gốc user upload (nếu có)
//   bring-any-idea-to-life/creations/<id>.json - { id, name, html, imageUrl, timestamp }

import { uploadBufferToR2, getR2PublicUrl, listR2Keys, createR2PresignedUploadUrl, genR2Key } from './r2Storage.js'

export class BringAnyIdeaToLifeHistoryR2Error extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'BringAnyIdeaToLifeHistoryR2Error'
    this.status = status
  }
}

function extFromMimeType(mimeType) {
  const sub = String(mimeType || '').split('/')[1] || 'png'
  return sub.split(';')[0].split('+')[0]
}

/**
 * @param {object} params
 * @param {string} params.id - id của creation (client-side crypto.randomUUID())
 * @param {string} params.name
 * @param {string} params.html - HTML đầy đủ đã sinh ra
 * @param {string} [params.imageBase64] - ảnh/video gốc (không kèm tiền tố data:...;base64,)
 * @param {string} [params.sourceUrl] - URL R2 public của file gốc đã upload trực tiếp từ client
 * @param {string} [params.mimeType]
 * @param {string} [params.videoUrl] - link YouTube/Facebook gốc, nếu creation đến từ link video (không upload file)
 * @param {string} [params.timestamp] - ISO string, mặc định là lúc gọi hàm
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ jsonUrl: string, imageUrl: string|null }>}
 */
export async function saveBringAnyIdeaToLifeCreationToR2({
  id,
  name,
  html,
  imageBase64,
  sourceUrl,
  mimeType,
  videoUrl,
  timestamp,
  envSource = process.env,
}) {
  if (!id) throw new BringAnyIdeaToLifeHistoryR2Error('Thiếu id của creation.', 400)
  if (!html) throw new BringAnyIdeaToLifeHistoryR2Error('Thiếu html của creation.', 400)

  let imageUrl = sourceUrl || null
  if (!imageUrl && imageBase64) {
    const cleanBase64 = String(imageBase64).replace(/^data:[^;]+;base64,/, '')
    const buffer = Buffer.from(cleanBase64, 'base64')
    if (buffer.length) {
      const imageKey = `bring-any-idea-to-life/source-files/${id}.${extFromMimeType(mimeType)}`
      const uploadedImage = await uploadBufferToR2({
        buffer,
        key: imageKey,
        contentType: mimeType || 'image/png',
        envSource,
      })
      imageUrl = uploadedImage.url
    }
  }

  const creationRecord = {
    id,
    name: name || 'New Creation',
    html,
    imageUrl,
    videoUrl: videoUrl || null,
    mimeType: mimeType || null,
    timestamp: timestamp || new Date().toISOString(),
  }
  const jsonBuffer = Buffer.from(JSON.stringify(creationRecord), 'utf-8')
  const jsonKey = `bring-any-idea-to-life/creations/${id}.json`
  await uploadBufferToR2({ buffer: jsonBuffer, key: jsonKey, contentType: 'application/json', envSource })

  return { jsonUrl: getR2PublicUrl(jsonKey, { envSource }), imageUrl }
}


/**
 * Load toàn bộ creation JSON đã sao lưu trong R2, không scope theo user để
 * đáp ứng nút admin/landing "Load history from R2".
 * @param {object} params
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ creations: Array<object>, count: number }>}
 */
export async function loadAllBringAnyIdeaToLifeCreationsFromR2({ envSource = process.env } = {}) {
  const keys = await listR2Keys({ prefix: 'bring-any-idea-to-life/creations/', envSource })
  const creations = []

  await Promise.all(keys.filter((key) => key.endsWith('.json')).map(async (key) => {
    const url = getR2PublicUrl(key, { envSource })
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const item = await res.json()
      if (item?.id && item?.html) creations.push(item)
    } catch (err) {
      console.warn('[bring-any-idea-to-life-r2] skip unreadable creation:', key, err?.message || err)
    }
  }))

  creations.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')))
  return { creations, count: creations.length }
}


/** Tạo presigned URL để client upload trực tiếp file gốc (ảnh/video/PDF) lên R2. */
export async function createBringAnyIdeaToLifeSourceUploadUrl({ id, mimeType, envSource = process.env }) {
  if (!id) throw new BringAnyIdeaToLifeHistoryR2Error('Thiếu id của creation/source file.', 400)
  if (!mimeType) throw new BringAnyIdeaToLifeHistoryR2Error('Thiếu mimeType của file upload.', 400)
  const key = genR2Key(`bring-any-idea-to-life/source-files/${id}`, extFromMimeType(mimeType))
  try {
    return await createR2PresignedUploadUrl({ key, contentType: mimeType, envSource })
  } catch (err) {
    throw new BringAnyIdeaToLifeHistoryR2Error(err?.message || 'Không tạo được URL upload R2 cho file gốc.', err?.status || 502)
  }
}
