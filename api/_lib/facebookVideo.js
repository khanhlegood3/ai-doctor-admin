// api/_lib/facebookVideo.js
// Helper DÙNG CHUNG cho mọi tính năng cần nhận diện link video Facebook và
// trích ra URL file .mp4 phát trực tiếp (CDN) từ link đó — dùng làm nền cho
// cả facebookTranscript.js (transcript/caption) lẫn facebookDownload.js
// (tải clip về R2), giống hệt cách youtube.ts/youtubeTranscript.js chia sẻ
// logic trích videoId cho YouTube.
//
// CÁCH LÀM: Facebook KHÔNG có API public miễn phí kiểu YouTube Data API để
// lấy metadata/caption. Với video PUBLIC (không riêng tư, không yêu cầu
// đăng nhập), trang xem video (dùng User-Agent giả lập trình duyệt di động,
// bản m.facebook.com nhẹ hơn và ít JS hơn bản desktop) vẫn nhúng sẵn 1 khối
// JSON nội bộ chứa các field như "browser_native_hd_url" /
// "browser_native_sd_url" (link mp4 trực tiếp) và đôi khi "captions_url"
// (phụ đề, nếu chủ video có bật). Ta trích các field này bằng regex trên
// HTML thô — không dùng Graph API (cần app review + access token riêng cho
// từng trang, ngoài phạm vi 1 helper miễn phí dùng chung).
//
// GIỚI HẠN (đọc trước khi debug lỗi "không tải được video Facebook"):
//   1. Chỉ hoạt động với video CÔNG KHAI. Video riêng tư/giới hạn người xem
//      sẽ không trích được field nào ở trên -> báo lỗi rõ ràng.
//   2. Facebook có thể đổi cấu trúc HTML/JSON nội bộ bất kỳ lúc nào — đây là
//      rủi ro CỐ HỮU của cách scrape này (y hệt rủi ro đã ghi chú ở
//      kolYoutubeDownload.js cho ytdl-core), không phải bug có thể sửa triệt
//      để 100%.
//   3. Không phải mọi video Facebook đều có phụ đề (captions_url) — nhiều
//      video sẽ không có, lúc đó facebookTranscript.js báo lỗi rõ ràng thay
//      vì âm thầm trả kết quả sai.

export class FacebookVideoError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'FacebookVideoError'
    this.status = status
  }
}

const FACEBOOK_HOSTS = new Set([
  'facebook.com',
  'www.facebook.com',
  'm.facebook.com',
  'web.facebook.com',
  'fb.watch',
])

export function isFacebookVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    if (!FACEBOOK_HOSTS.has(parsed.hostname.toLowerCase())) return false
    if (hostname === 'fb.watch') return true
    return (
      parsed.pathname.includes('/videos/') ||
      parsed.pathname.includes('/reel/') ||
      parsed.pathname.includes('/watch') ||
      parsed.pathname.includes('/share/v/') ||
      parsed.pathname.includes('/share/r/')
    )
  } catch {
    return false
  }
}

const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

function toMobileUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'fb.watch') return url // fb.watch tự redirect, giữ nguyên
    parsed.hostname = 'm.facebook.com'
    return parsed.toString()
  } catch {
    return url
  }
}

function unescapeJsonString(raw) {
  try {
    return JSON.parse(`"${raw}"`)
  } catch {
    return raw.replace(/\\\//g, '/').replace(/\\u0025/g, '%')
  }
}

/**
 * Tải trang xem video Facebook (bản mobile) và trích ra URL mp4 phát trực
 * tiếp (ưu tiên bản HD), tiêu đề, và captions_url nếu có.
 *
 * @param {string} facebookUrl
 * @returns {Promise<{ directUrl: string, title: string, captionsUrl: string|null, durationMs: number|null }>}
 */
export async function resolveFacebookVideo(facebookUrl) {
  if (!isFacebookVideoUrl(facebookUrl)) {
    throw new FacebookVideoError('Link Facebook không hợp lệ.', 400)
  }

  // fb.watch là link rút gọn -> để fetch tự theo redirect sang facebook.com thật.
  const pageRes = await fetch(toMobileUrl(facebookUrl), {
    headers: { 'User-Agent': UA, 'Accept-Language': 'vi,en;q=0.9' },
    redirect: 'follow',
  })
  if (!pageRes.ok) {
    throw new FacebookVideoError('Không tải được trang video Facebook.', 502)
  }
  const html = await pageRes.text()

  const hdMatch = html.match(/"browser_native_hd_url":"([^"]+)"/)
  const sdMatch = html.match(/"browser_native_sd_url":"([^"]+)"/)
  const rawMatch = hdMatch || sdMatch
  if (!rawMatch) {
    throw new FacebookVideoError(
      'Không lấy được link video trực tiếp từ Facebook (thường do video ở chế độ riêng tư/giới hạn người xem, hoặc Facebook đã đổi cấu trúc trang). Hãy thử tải video về máy rồi chọn "Chọn file để tải lên" thay thế.',
      422,
    )
  }
  const directUrl = unescapeJsonString(rawMatch[1])

  const titleMatch = html.match(/"og:title" content="([^"]*)"/) || html.match(/<title>([^<]*)<\/title>/)
  const title = titleMatch ? unescapeJsonString(titleMatch[1]).trim() : 'Video Facebook'

  const captionsMatch = html.match(/"captions_url":"([^"]+)"/)
  const captionsUrl = captionsMatch ? unescapeJsonString(captionsMatch[1]) : null

  const durationMatch = html.match(/"playable_duration_in_ms":(\d+)/)
  const durationMs = durationMatch ? Number(durationMatch[1]) : null

  return { directUrl, title, captionsUrl, durationMs }
}
