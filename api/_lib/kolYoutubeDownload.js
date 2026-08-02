// api/_lib/kolYoutubeDownload.js
// Backend cho tính năng "AI Pose thật cho video KOL" ở trang Remix Sức Khoẻ
// từ KOL — nhánh "dán link YouTube, server tải video về" (xem thảo luận với
// user: 2 nguồn video được hỗ trợ song song — dán link YouTube HOẶC upload
// file trực tiếp, ưu tiên cái nào xử lý được thì dùng).
//
// GIỚI HẠN THỰC TẾ (đọc kỹ trước khi debug lỗi 'download thất bại'):
//   1. Vercel Serverless Function (kể cả trên Vercel Pro) có giới hạn KÍCH
//      THƯỚC RESPONSE ~4.5 MB — không thể trả cả 1 video YouTube dài/nét cao
//      qua endpoint này. Vì vậy chỉ chấp nhận clip NGẮN (mặc định ≤ 90 giây)
//      và ép về định dạng progressive nhỏ nhất có sẵn (thường 360p).
//   2. Tải video YouTube về từ server (datacenter IP của Vercel) rất dễ bị
//      YouTube chặn/giới hạn tốc độ, hoặc thư viện ytdl-core bị hỏng khi
//      YouTube đổi cấu trúc nội bộ — đây là rủi ro CỐ HỮU của cách này, không
//      phải bug có thể sửa triệt để 100%.
//   3. Vì 2 lý do trên, nhánh này LUÔN được thiết kế để THẤT BẠI RÕ RÀNG (ném
//      lỗi có message dễ hiểu) thay vì treo hoặc trả dữ liệu hỏng — để phía
//      client có thể fallback ngay sang "hãy tải video về máy rồi chọn file
//      để upload thủ công" (luôn hoạt động 100%, xem KolVideoLibraryPanel.jsx).

import ytdl from '@distube/ytdl-core'

export class KolYoutubeDownloadError extends Error {
  constructor(message, status = 422) {
    super(message)
    this.name = 'KolYoutubeDownloadError'
    this.status = status
  }
}

const DEFAULT_MAX_DURATION_SECONDS = 90
// Để dư margin so với trần response ~4.5MB của Vercel (base64 làm phình thêm ~33%).
const DEFAULT_MAX_BYTES = 3.2 * 1024 * 1024

/**
 * Tải 1 clip YouTube NGẮN về server, trả lại dưới dạng base64 để nhúng vào
 * JSON response (đồng bộ với các nhánh khác của groq-proxy.js).
 *
 * @param {string} youtubeUrl
 * @param {object} [opts]
 * @param {number} [opts.maxDurationSeconds]
 * @param {number} [opts.maxBytes]
 * @returns {Promise<{ base64: string, mimeType: string, title: string, durationSeconds: number }>}
 */
export async function fetchYoutubeClipAsBase64(youtubeUrl, opts = {}) {
  const maxDurationSeconds = opts.maxDurationSeconds || DEFAULT_MAX_DURATION_SECONDS
  const maxBytes = opts.maxBytes || DEFAULT_MAX_BYTES

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
    format = ytdl.chooseFormat(info.formats, { quality: 'lowest', filter: 'audioandvideo' })
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
        `Video vượt quá dung lượng ${(maxBytes / 1024 / 1024).toFixed(1)}MB cho phép tải qua server. Hãy tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
      )
    }
    console.error('[kolYoutubeDownload] download stream failed:', err?.message || err)
    throw new KolYoutubeDownloadError(
      'Tải video từ YouTube thất bại giữa chừng (thường do server bị YouTube giới hạn tốc độ). Hãy thử lại sau, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }

  const buffer = Buffer.concat(chunks)
  return {
    base64: buffer.toString('base64'),
    mimeType: (format.mimeType || 'video/mp4').split(';')[0],
    title: info.videoDetails?.title || 'Video YouTube',
    durationSeconds,
  }
}
