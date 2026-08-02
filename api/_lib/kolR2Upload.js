// api/_lib/kolR2Upload.js
// Provider 'kol-r2-upload-url' của groq-proxy.js — sinh presigned PUT URL để
// CLIENT (trình duyệt) upload video trực tiếp lên R2, dùng cho 2 trường hợp
// KHÔNG đi qua server tải hộ (khác nhánh YouTube ở kolYoutubeDownload.js):
//   - 'raw'   : user tự chọn file video từ máy (KolVideoLibraryPanel.jsx)
//   - 'posed' : video kết quả AI Pose ghép ra ở client, dạng Blob từ
//               MediaRecorder (KolPoseMakerPanel.jsx)
// Không đi qua Vercel Function nghĩa là KHÔNG còn giới hạn ~4.5MB
// request/response cho các file này nữa — video đi thẳng browser → R2.
import { createR2PresignedUploadUrl, genR2Key } from './r2Storage.js'

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
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ uploadUrl: string, publicUrl: string, key: string }>}
 */
export async function createKolR2UploadUrl({ kind, contentType, envSource = process.env }) {
  const prefix = KIND_PREFIX[kind]
  if (!prefix) {
    throw new KolR2UploadError(`kind không hợp lệ: ${kind} (chỉ nhận 'raw' hoặc 'posed').`, 400)
  }
  if (!contentType || !contentType.startsWith('video/')) {
    throw new KolR2UploadError('contentType phải là video/*.', 400)
  }
  const key = genR2Key(prefix, extFromContentType(contentType))
  return createR2PresignedUploadUrl({ key, contentType, envSource })
}
