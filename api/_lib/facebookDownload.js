// api/_lib/facebookDownload.js
// Backend cho nhánh "dán link Facebook, server tải video về" — song song với
// kolYoutubeDownload.js, dùng cho cùng tính năng "AI Pose thật cho video KOL"
// (Remix Sức Khoẻ từ KOL), giờ hỗ trợ thêm nguồn Facebook bên cạnh YouTube.
//
// Khác YouTube (dùng @distube/ytdl-core để lấy các format tách sẵn), với
// Facebook ta dùng resolveFacebookVideo() (api/_lib/facebookVideo.js) để lấy
// thẳng 1 URL mp4 CDN công khai (browser_native_hd_url/sd_url) rồi tải buffer
// qua fetch thường — không cần thư viện riêng.
//
// GIỚI HẠN: y hệt kolYoutubeDownload.js — vẫn có trần thời gian chạy/bộ nhớ
// của Vercel Serverless Function, vẫn CỐ Ý fail rõ ràng (không phải bug) khi
// video dài/nặng hoặc không lấy được link trực tiếp, để client tự fallback
// sang "chọn file để upload thủ công".

import { resolveFacebookVideo, FacebookVideoError } from './facebookVideo.js'
import { uploadBufferToR2, genR2Key, R2StorageError } from './r2Storage.js'

export class FacebookDownloadError extends Error {
  constructor(message, status = 422) {
    super(message)
    this.name = 'FacebookDownloadError'
    this.status = status
  }
}

const DEFAULT_MAX_DURATION_SECONDS = 300
const DEFAULT_MAX_BYTES = 80 * 1024 * 1024 // 80MB, đồng bộ kolYoutubeDownload.js

/**
 * Tải 1 clip Facebook về server rồi upload thẳng lên R2, trả lại URL public
 * (đồng bộ với fetchYoutubeClipToR2 ở kolYoutubeDownload.js).
 *
 * @param {string} facebookUrl
 * @param {object} [opts]
 * @param {number} [opts.maxDurationSeconds]
 * @param {number} [opts.maxBytes]
 * @param {Record<string,string>} [opts.envSource]
 * @returns {Promise<{ url: string, mimeType: string, title: string, durationSeconds: number, size: number }>}
 */
export async function fetchFacebookClipToR2(facebookUrl, opts = {}) {
  const maxDurationSeconds = opts.maxDurationSeconds || DEFAULT_MAX_DURATION_SECONDS
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES
  const envSource = opts.envSource || process.env

  if (!facebookUrl || typeof facebookUrl !== 'string') {
    throw new FacebookDownloadError('Thiếu link Facebook.', 400)
  }

  let resolved
  try {
    resolved = await resolveFacebookVideo(facebookUrl)
  } catch (err) {
    console.error('[facebookDownload] resolveFacebookVideo failed:', err?.message || err)
    if (err instanceof FacebookVideoError) {
      throw new FacebookDownloadError(err.message, err.status)
    }
    throw new FacebookDownloadError(
      'Không lấy được thông tin video từ Facebook (có thể do video riêng tư, hoặc link sai). Hãy thử tải video này về máy rồi chọn "Chọn file để tải lên" bên dưới thay thế.',
    )
  }

  const durationSeconds = resolved.durationMs ? Math.round(resolved.durationMs / 1000) : 0
  if (durationSeconds > maxDurationSeconds) {
    throw new FacebookDownloadError(
      `Video dài ${durationSeconds}s, vượt giới hạn ${maxDurationSeconds}s cho phép tải qua server (giới hạn kỹ thuật của Vercel Serverless Function). Hãy cắt video ngắn lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
    )
  }

  let videoRes
  try {
    videoRes = await fetch(resolved.directUrl)
  } catch (err) {
    console.error('[facebookDownload] fetch directUrl failed:', err?.message || err)
    throw new FacebookDownloadError(
      'Tải video từ Facebook thất bại (link trực tiếp có thể đã hết hạn). Hãy thử lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }
  if (!videoRes.ok || !videoRes.body) {
    throw new FacebookDownloadError(
      'Tải video từ Facebook thất bại (server Facebook từ chối yêu cầu). Hãy thử lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }

  const contentLength = Number(videoRes.headers.get('content-length') || 0)
  if (contentLength && contentLength > maxBytes) {
    throw new FacebookDownloadError(
      `Video vượt quá dung lượng ${(maxBytes / 1024 / 1024).toFixed(0)}MB cho phép tải qua server. Hãy tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
    )
  }

  const chunks = []
  let totalBytes = 0
  try {
    for await (const chunk of videoRes.body) {
      totalBytes += chunk.length
      if (totalBytes > maxBytes) {
        throw new Error('EXCEEDS_MAX_BYTES')
      }
      chunks.push(chunk)
    }
  } catch (err) {
    if (String(err?.message) === 'EXCEEDS_MAX_BYTES') {
      throw new FacebookDownloadError(
        `Video vượt quá dung lượng ${(maxBytes / 1024 / 1024).toFixed(0)}MB cho phép tải qua server. Hãy tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
      )
    }
    console.error('[facebookDownload] download stream failed:', err?.message || err)
    throw new FacebookDownloadError(
      'Tải video từ Facebook thất bại giữa chừng. Hãy thử lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }

  const buffer = Buffer.concat(chunks)
  const mimeType = (videoRes.headers.get('content-type') || 'video/mp4').split(';')[0]
  const ext = mimeType.split('/')[1] || 'mp4'
  const key = genR2Key('kol-videos/facebook', ext)

  let uploaded
  try {
    uploaded = await uploadBufferToR2({ buffer, key, contentType: mimeType, envSource })
  } catch (err) {
    console.error('[facebookDownload] R2 upload failed:', err?.message || err)
    const status = err instanceof R2StorageError ? err.status : 500
    throw new FacebookDownloadError(
      'Tải video từ Facebook thành công nhưng lưu lên R2 thất bại. Hãy thử lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
      status,
    )
  }

  return {
    url: uploaded.url,
    mimeType,
    title: resolved.title || 'Video Facebook',
    durationSeconds,
    size: uploaded.size,
  }
}
