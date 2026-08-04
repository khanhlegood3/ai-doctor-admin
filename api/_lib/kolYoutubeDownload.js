// api/_lib/kolYoutubeDownload.js
// Backend cho tính năng "AI Pose thật cho video KOL" ở trang Remix Sức Khoẻ
// từ KOL — nhánh "dán link YouTube, server tải video về" (xem thảo luận với
// user: 2 nguồn video được hỗ trợ song song — dán link YouTube HOẶC upload
// file trực tiếp, ưu tiên cái nào xử lý được thì dùng). Cũng được tab
// "AI Sign Language Translator" (Vibe Tracking) tái sử dụng qua cùng
// provider 'kol-youtube-fetch' (xem groq-proxy.js).
//
// CẬP NHẬT (chuyển sang R2): trước đây hàm này trả video dạng base64 thẳng
// trong JSON response, bị trần ~4.5MB response của Vercel Serverless
// Function chặn (chỉ nhận clip ≤ 90s, ép chất lượng thấp nhất). Giờ server
// tải video xong thì UPLOAD THẲNG lên Cloudflare R2 (xem r2Storage.js) rồi
// chỉ trả về 1 URL — bỏ hẳn giới hạn 4.5MB, cho phép clip dài/nét hơn hẳn.
//
// CẬP NHẬT (2026-08): thay @distube/ytdl-core → youtubei.js. Lý do: chính
// nhóm DisTube công bố @distube/ytdl-core NGỪNG BẢO TRÌ và khuyến nghị dùng
// youtubei.js thay thế — ytdl-core cũ bị YouTube chặn/hỏng khi họ đổi cấu
// trúc nội bộ (lỗi 'Không lấy được thông tin video từ YouTube' liên tục ở
// getInfo()). youtubei.js dùng thẳng InnerTube API (API nội bộ mà chính các
// client YouTube dùng) và được bảo trì tích cực hơn nên bắt kịp thay đổi của
// YouTube nhanh hơn nhiều.
//
// GIỚI HẠN CÒN LẠI (đọc kỹ trước khi debug lỗi 'download thất bại'):
//   1. Vercel Serverless Function vẫn có giới hạn THỜI GIAN CHẠY và BỘ NHỚ
//      (buffer cả video vào RAM trước khi upload) — vẫn cần trần hợp lý cho
//      độ dài/dung lượng clip, chỉ là trần đó giờ cao hơn nhiều so với khi
//      còn bị giới hạn bởi response size.
//   2. Tải video YouTube về từ server (datacenter IP của Vercel) vẫn có thể
//      bị YouTube giới hạn tốc độ/chặn dù đã đổi thư viện — đây là rủi ro
//      CỐ HỮU của cách "server tự tải" (không phải bug sửa triệt để 100%
//      được), chỉ là youtubei.js bắt kịp thay đổi nội bộ của YouTube tốt
//      hơn ytdl-core (không còn được bảo trì) nên bền hơn theo thời gian.
//   3. Vì các lý do trên, nhánh này LUÔN được thiết kế để THẤT BẠI RÕ RÀNG
//      (ném lỗi có message dễ hiểu) thay vì treo hoặc trả dữ liệu hỏng — để
//      phía client có thể fallback ngay sang "hãy tải video về máy rồi chọn
//      file để upload thủ công" (giờ cũng đi qua R2 — xem
//      kol-r2-upload-url provider ở groq-proxy.js — luôn hoạt động, xem
//      KolVideoLibraryPanel.jsx).

import { Innertube } from 'youtubei.js'
import { Readable } from 'node:stream'
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

// 1 Innertube session được tái dùng giữa các lần gọi "ấm" (warm invocation)
// của cùng 1 Vercel Serverless Function instance, tránh phải khởi tạo lại
// (fetch config/player) mỗi request — chỉ tạo mới khi cold start, khi lần
// tạo trước đó lỗi, hoặc khi cookie thay đổi (key theo cookie).
//
// COOKIE ĐĂNG NHẬP (bắt buộc để vượt bot-check "Đăng nhập để xác nhận bạn
// không phải là robot" — YouTube chặn IP datacenter như Vercel theo mặc
// định, kể cả với youtubei.js): đặt biến môi trường YOUTUBE_COOKIE trên
// Vercel bằng chuỗi cookie của 1 tài khoản Google/YouTube thật.
//   Cách lấy: đăng nhập youtube.com trên trình duyệt (Chrome) → mở
//   DevTools (F12) → tab Network → bấm 1 request bất kỳ tới youtube.com →
//   phần Request Headers → copy nguyên giá trị header "cookie:" (chuỗi
//   dạng "name1=value1; name2=value2; ...") → dán vào Vercel env var
//   YOUTUBE_COOKIE (Project Settings → Environment Variables).
//   Lưu ý: (1) nên dùng 1 tài khoản Google phụ, không dùng tài khoản chính
//   — cookie tự động hoá kiểu này có rủi ro bị YouTube khoá/giới hạn tài
//   khoản; (2) cookie sẽ hết hạn theo thời gian, cần lặp lại thao tác trên
//   để lấy cookie mới khi thấy lỗi LOGIN_REQUIRED quay lại dù đã cấu hình.
const innertubeCache = new Map() // cookie string -> Promise<Innertube>
function getInnertube(cookie) {
  const key = cookie || ''
  if (!innertubeCache.has(key)) {
    const promise = Innertube.create({
      lang: 'vi',
      location: 'VN',
      cookie: cookie || undefined,
    }).catch((err) => {
      innertubeCache.delete(key) // cho phép thử tạo lại ở request sau
      throw err
    })
    innertubeCache.set(key, promise)
  }
  return innertubeCache.get(key)
}

/**
 * Trích video ID từ các dạng link YouTube phổ biến (watch?v=, youtu.be/,
 * shorts/, embed/, live/). Trả về null nếu không nhận ra được — coi như link
 * không hợp lệ.
 * @param {string} rawUrl
 * @returns {string|null}
 */
function extractYoutubeVideoId(rawUrl) {
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be') {
    return u.pathname.split('/').filter(Boolean)[0] || null
  }
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      return u.searchParams.get('v')
    }
    const match = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
    if (match) return match[2]
  }
  return null
}

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
  const videoId = extractYoutubeVideoId(youtubeUrl)
  if (!videoId) {
    throw new KolYoutubeDownloadError('Link YouTube không hợp lệ.', 400)
  }

  const cookie = envSource.YOUTUBE_COOKIE || ''

  let youtube
  let info
  try {
    youtube = await getInnertube(cookie)
    info = await youtube.getBasicInfo(videoId)
  } catch (err) {
    console.error('[kolYoutubeDownload] getBasicInfo failed:', err?.message || err)
    throw new KolYoutubeDownloadError(
      'Không lấy được thông tin video từ YouTube (có thể do server bị YouTube chặn, video riêng tư/giới hạn độ tuổi, hoặc link sai). Hãy thử tải video này về máy rồi chọn "Chọn file để tải lên" bên dưới thay thế.',
    )
  }

  const playability = info.playability_status?.status
  if (playability && playability !== 'OK') {
    const reason = info.playability_status?.reason || playability
    // Gợi ý rõ hướng khắc phục khi bị chặn kiểu "cần đăng nhập" — phân biệt
    // 2 trường hợp: (1) server chưa cấu hình cookie tài khoản YouTube nào
    // cả, (2) đã cấu hình nhưng cookie đó đã hết hạn/bị YouTube từ chối.
    const isLoginRequired = playability === 'LOGIN_REQUIRED'
    let hint = ''
    if (isLoginRequired) {
      hint = cookie
        ? ' (cookie YOUTUBE_COOKIE trên server có thể đã hết hạn, cần lấy cookie mới từ tài khoản Google/YouTube và cập nhật lại biến môi trường này)'
        : ' (server chưa cấu hình cookie đăng nhập YouTube — cần đặt biến môi trường YOUTUBE_COOKIE, xem comment trong api/_lib/kolYoutubeDownload.js)'
    }
    console.error(`[kolYoutubeDownload] playability=${playability} reason=${reason} hasCookie=${Boolean(cookie)}`)
    throw new KolYoutubeDownloadError(
      `Video không thể tải (${reason})${hint}. Hãy thử tải video này về máy rồi chọn "Chọn file để tải lên" bên dưới thay thế.`,
    )
  }

  const durationSeconds = Number(info.basic_info?.duration || 0)
  if (durationSeconds > maxDurationSeconds) {
    throw new KolYoutubeDownloadError(
      `Video dài ${durationSeconds}s, vượt giới hạn ${maxDurationSeconds}s cho phép tải qua server (giới hạn kỹ thuật của Vercel Serverless Function). Hãy cắt video ngắn lại, hoặc tải video về máy rồi chọn "Chọn file để tải lên" thay thế.`,
    )
  }

  let webStream
  try {
    webStream = await youtube.download(videoId, {
      type: 'video+audio',
      quality: 'best',
      format: 'mp4',
    })
  } catch (err) {
    console.error('[kolYoutubeDownload] download() failed:', err?.message || err)
    throw new KolYoutubeDownloadError(
      'Không tìm thấy định dạng video+audio phù hợp để tải (video có thể chỉ có luồng video/audio tách riêng — YouTube hay dùng định dạng này cho video chất lượng cao). Hãy tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
    )
  }

  const chunks = []
  let totalBytes = 0

  try {
    const nodeStream = Readable.fromWeb(webStream)
    await new Promise((resolve, reject) => {
      nodeStream.on('data', (chunk) => {
        totalBytes += chunk.length
        if (totalBytes > maxBytes) {
          nodeStream.destroy(new Error('EXCEEDS_MAX_BYTES'))
          return
        }
        chunks.push(chunk)
      })
      nodeStream.on('end', resolve)
      nodeStream.on('error', reject)
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
  const mimeType = 'video/mp4'
  const key = genR2Key('kol-videos/youtube', 'mp4')

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
    title: info.basic_info?.title || 'Video YouTube',
    durationSeconds,
    size: uploaded.size,
  }
}
