// api/_lib/kolYoutubeDownload.js
// Backend cho tính năng "AI Pose thật cho video KOL" ở trang Remix Sức Khoẻ
// từ KOL — nhánh "dán link YouTube, server tải video về" (xem thảo luận với
// user: 2 nguồn video được hỗ trợ song song — dán link YouTube HOẶC upload
// file trực tiếp, ưu tiên cái nào xử lý được thì dùng).
//
// CẬP NHẬT (chuyển sang R2): trước đây hàm này trả video dạng base64 thẳng
// trong JSON response, bị trần ~4.5MB response của Vercel Serverless
// Function chặn (chỉ nhận clip ≤ 90s, ép chất lượng thấp nhất). Giờ server
// tải video xong thì UPLOAD THẲNG lên Cloudflare R2 (xem r2Storage.js) rồi
// chỉ trả về 1 URL — bỏ hẳn giới hạn 4.5MB, cho phép clip dài/nét hơn hẳn.
//
// GIỚI HẠN CÒN LẠI (đọc kỹ trước khi debug lỗi 'download thất bại'):
//   1. Vercel Serverless Function vẫn có giới hạn THỜI GIAN CHẠY và BỘ NHỚ
//      (buffer cả video vào RAM trước khi upload) — vẫn cần trần hợp lý cho
//      độ dài/dung lượng clip, chỉ là trần đó giờ cao hơn nhiều so với khi
//      còn bị giới hạn bởi response size.
//   2. Tải video YouTube về từ server (datacenter IP của Vercel) rất dễ bị
//      YouTube chặn/giới hạn tốc độ, hoặc thư viện ytdl-core bị hỏng khi
//      YouTube đổi cấu trúc nội bộ — đây là rủi ro CỐ HỮU của cách này, không
//      phải bug có thể sửa triệt để 100%.
//   3. Vì các lý do trên, nhánh này LUÔN được thiết kế để THẤT BẠI RÕ RÀNG
//      (ném lỗi có message dễ hiểu) thay vì treo hoặc trả dữ liệu hỏng — để
//      phía client có thể fallback ngay sang "hãy tải video về máy rồi chọn
//      file để upload thủ công" (giờ cũng đi qua R2 — xem
//      kol-r2-upload-url provider ở groq-proxy.js — luôn hoạt động, xem
//      KolVideoLibraryPanel.jsx).

import ytdl from '@distube/ytdl-core'
import { uploadBufferToR2, genR2Key, R2StorageError } from './r2Storage.js'

export class KolYoutubeDownloadError extends Error {
  constructor(message, status = 422) {
    super(message)
    this.name = 'KolYoutubeDownloadError'
    this.status = status
  }
}

// Không còn bị ép bởi trần response ~4.5MB nữa (video đi thẳng lên R2, chỉ
// trả về 1 URL nhỏ) — nới rộng hợp lý, vẫn chặn để tránh 1 request ăn hết bộ
// nhớ/thời gian chạy của function (mặc định Vercel: 1024MB RAM, ~60-300s
// tuỳ gói). Có thể chỉnh lại qua opts nếu cần.
const DEFAULT_MAX_DURATION_SECONDS = 300
const DEFAULT_MAX_BYTES = 80 * 1024 * 1024 // 80MB

/**
 * Tải 1 clip YouTube về server rồi upload thẳng lên R2, trả lại URL public
 * (đồng bộ với các nhánh khác của groq-proxy.js).
 *
 * @param {string} youtubeUrl
 * @param {object} [opts]
 * @param {number} [opts.maxDurationSeconds]
 * @param {number} [opts.maxBytes]
 * @param {Record<string,string>} [opts.envSource]
 * @returns {Promise<{ url: string, mimeType: string, title: string, durationSeconds: number, size: number }>}
 */
export async function fetchYoutubeClipToR2(youtubeUrl, opts = {}) {
  const maxDurationSeconds = opts.maxDurationSeconds || DEFAULT_MAX_DURATION_SECONDS
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES
  const envSource = opts.envSource || process.env

  if (!youtubeUrl || typeof youtubeUrl !== 'string') {
    throw new KolYoutubeDownloadError('Thiếu link YouTube.', 400)
  }
  if (!ytdl.validateURL(youtubeUrl)) {
    throw new KolYoutubeDownloadError('Link YouTube không hợp lệ.', 400)
  }

  let info
  try {
    info = await ytdl.getInfo(youtubeUrl)
  } catch (err) {
    console.error('[kolYoutubeDownload] getInfo failed:', err?.message || err)
    throw new KolYoutubeDownloadError(
      'Không lấy được thông tin video từ YouTube (có thể do server bị YouTube chặn, video riêng tư/giới hạn độ tuổi, hoặc link sai). Hãy thử tải video này về máy rồi chọn "Chọn file để tải lên" bên dưới thay thế.',
    )
  }

  const durationSeconds = Number(info.videoDetails?.lengthSeconds || 0)
  if (durationSeconds > maxDurationSeconds) {
    throw new KolYoutubeDownloadError(
      `Video dài ${durationSeconds}s, vượt giới hạn ${maxDurationSeconds}s cho phép tải qua server (giới hạn kỹ thuật của Vercel Serverless Function). Hãy cắt video ngắn lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
    )
  }

  let format
  try {
    format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' })
  } catch {
    format = null
  }
  if (!format) {
    throw new KolYoutubeDownloadError(
      'Không tìm thấy định dạng video+audio phù hợp để tải (video có thể chỉ có luồng video/audio tách riêng — YouTube hay dùng định dạng này cho video chất lượng cao). Hãy tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }

  const chunks = []
  let totalBytes = 0

  try {
    await new Promise((resolve, reject) => {
      const stream = ytdl.downloadFromInfo(info, { format })
      stream.on('data', (chunk) => {
        totalBytes += chunk.length
        if (totalBytes > maxBytes) {
          stream.destroy(new Error('EXCEEDS_MAX_BYTES'))
          return
        }
        chunks.push(chunk)
      })
      stream.on('end', resolve)
      stream.on('error', reject)
    })
  } catch (err) {
    if (String(err?.message) === 'EXCEEDS_MAX_BYTES') {
      throw new KolYoutubeDownloadError(
        `Video vượt quá dung lượng ${(maxBytes / 1024 / 1024).toFixed(0)}MB cho phép tải qua server. Hãy tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
      )
    }
    console.error('[kolYoutubeDownload] download stream failed:', err?.message || err)
    throw new KolYoutubeDownloadError(
      'Tải video từ YouTube thất bại giữa chừng (thường do server bị YouTube giới hạn tốc độ). Hãy thử lại sau, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }

  const buffer = Buffer.concat(chunks)
  const mimeType = (format.mimeType || 'video/mp4').split(';')[0]
  const ext = mimeType.split('/')[1] || 'mp4'
  const key = genR2Key('kol-videos/youtube', ext)

  let uploaded
  try {
    uploaded = await uploadBufferToR2({ buffer, key, contentType: mimeType, envSource })
  } catch (err) {
    console.error('[kolYoutubeDownload] R2 upload failed:', err?.message || err)
    const status = err instanceof R2StorageError ? err.status : 500
    throw new KolYoutubeDownloadError(
      'Tải video từ YouTube thành công nhưng lưu lên R2 thất bại. Hãy thử lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
      status,
    )
  }

  return {
    url: uploaded.url,
    mimeType,
    title: info.videoDetails?.title || 'Video YouTube',
    durationSeconds,
    size: uploaded.size,
  }
}
