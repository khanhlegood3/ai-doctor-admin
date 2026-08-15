// api/_lib/kolR2Upload.js
// Provider 'kol-r2-upload-url' của groq-proxy.js — sinh presigned PUT URL để
// CLIENT (trình duyệt) upload video trực tiếp lên R2, dùng cho 2 trường hợp
// KHÔNG đi qua server tải hộ (khác nhánh YouTube ở kolYoutubeDownload.js):
//   - 'raw'   : user tự chọn file video từ máy (KolVideoLibraryPanel.jsx)
//   - 'posed' : video kết quả AI Pose ghép ra ở client, dạng Blob từ
//               MediaRecorder (KolPoseMakerPanel.jsx)
// Không đi qua Vercel Function nghĩa là KHÔNG còn giới hạn ~4.5MB
// request/response cho các file này nữa — video đi thẳng browser → R2.
import { createR2PresignedUploadUrl, genR2Key, uploadBufferToR2, hasFallbackR2Bucket } from './r2Storage.js'

export class KolR2UploadError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'KolR2UploadError'
    this.status = status
  }
}

const KIND_PREFIX = {
  raw: 'kol-videos/upload',
  posed: 'kol-videos/posed',
}

function extFromContentType(contentType) {
  const sub = String(contentType || '').split('/')[1] || 'mp4'
  return sub.split(';')[0]
}

/**
 * @param {object} params
 * @param {'raw'|'posed'} params.kind
 * @param {string} [params.contentType]
 * @param {0|1} [params.bucketSlot] - 0 = bucket chính (mặc định), 1 = bucket
 *   dự phòng — client dùng khi PUT trực tiếp lên bucket chính thất bại
 *   (thường do CORS chưa cấu hình đúng ở bucket đó), để tự động thử bucket
 *   còn lại thay vì rơi thẳng vào fallback base64 (dính giới hạn 4.5MB của
 *   Vercel, gây HTTP 413 với video — bug thực tế đã gặp).
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ uploadUrl: string, publicUrl: string, key: string }>}
 */
export async function createKolR2UploadUrl({ kind, contentType, bucketSlot = 0, envSource = process.env }) {
  const prefix = KIND_PREFIX[kind]
  if (!prefix) {
    throw new KolR2UploadError(`kind không hợp lệ: ${kind} (chỉ nhận 'raw' hoặc 'posed').`, 400)
  }
  if (!contentType || !contentType.startsWith('video/')) {
    throw new KolR2UploadError('contentType phải là video/*.', 400)
  }
  if (bucketSlot === 1 && !hasFallbackR2Bucket(envSource)) {
    throw new KolR2UploadError('Bucket R2 dự phòng chưa được cấu hình (thiếu R2_BUCKET_NAME1/R2_ACCESS_URL1).', 501)
  }
  const key = genR2Key(prefix, extFromContentType(contentType))
  return createR2PresignedUploadUrl({ key, contentType, envSource, bucketSlot })
}


/**
 * Server-side fallback upload for browsers/origins that are blocked by R2 CORS
 * on presigned PUT preflight. Intended for short recorded Vibe Tracking clips.
 * @param {object} params
 * @param {'raw'|'posed'} params.kind
 * @param {string} params.contentType
 * @param {string} params.base64Data
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ url: string, size: number, key: string }>}
 */
export async function uploadKolBase64ToR2({ kind, contentType, base64Data, envSource = process.env }) {
  const prefix = KIND_PREFIX[kind]
  if (!prefix) {
    throw new KolR2UploadError(`kind không hợp lệ: ${kind} (chỉ nhận 'raw' hoặc 'posed').`, 400)
  }
  if (!contentType || !contentType.startsWith('video/')) {
    throw new KolR2UploadError('contentType phải là video/*.', 400)
  }
  const cleanBase64 = String(base64Data || '').replace(/^data:[^;]+;base64,/, '')
  if (!cleanBase64) {
    throw new KolR2UploadError('Thiếu dữ liệu video base64 để upload.', 400)
  }
  const buffer = Buffer.from(cleanBase64, 'base64')
  if (!buffer.length) {
    throw new KolR2UploadError('Dữ liệu video base64 không hợp lệ.', 400)
  }
  const key = genR2Key(prefix, extFromContentType(contentType))
  const uploaded = await uploadBufferToR2({ buffer, key, contentType, envSource })
  return { url: uploaded.url, size: uploaded.size, key: uploaded.key }
}
