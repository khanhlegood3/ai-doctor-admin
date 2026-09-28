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

const UA_MOBILE =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
const UA_DESKTOP =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
// Facebook phục vụ trang có sẵn thẻ Open Graph (og:video) cho crawler của
// chính nó — thường ít bị chặn/đẩy sang trang đăng nhập hơn UA trình duyệt.
const UA_CRAWLER = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'

// Bỏ tham số theo dõi (mibextid, fs, s...) — chúng không cần để xem video và
// đôi khi khiến Facebook trả về trang khác/redirect vòng.
function cleanUrl(url) {
  try {
    const parsed = new URL(url)
    for (const key of [...parsed.searchParams.keys()]) {
      if (!['v', 'story_fbid', 'id'].includes(key)) parsed.searchParams.delete(key)
    }
    return parsed.toString()
  } catch {
    return url
  }
}

function toMobileUrl(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'fb.watch') return url
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

function decodeHtmlEntities(str) {
  return str.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
}

// Trích thông tin video từ HTML thô, thử nhiều "dấu vết" Facebook hay dùng.
function extractFromHtml(html) {
  const patterns = [
    /"browser_native_hd_url":"([^"]+)"/,
    /"playable_url_quality_hd":"([^"]+)"/,
    /"hd_src":"([^"]+)"/,
    /"browser_native_sd_url":"([^"]+)"/,
    /"playable_url":"([^"]+)"/,
    /"sd_src":"([^"]+)"/,
  ]
  let directUrl = null
  for (const re of patterns) {
    const m = html.match(re)
    if (m) {
      directUrl = unescapeJsonString(m[1])
      break
    }
  }
  if (!directUrl) {
    const og =
      html.match(/<meta[^>]+property="og:video:secure_url"[^>]+content="([^"]+)"/) ||
      html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+)"/) ||
      html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:video(?::secure_url)?"/)
    if (og && /\.mp4|video/i.test(og[1])) directUrl = decodeHtmlEntities(og[1])
  }
  if (!directUrl || !/^https?:\/\//.test(directUrl)) return null

  const titleMatch =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/) ||
    html.match(/"og:title" content="([^"]*)"/) ||
    html.match(/<title>([^<]*)<\/title>/)
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : 'Video Facebook'
  const captionsMatch = html.match(/"captions_url":"([^"]+)"/)
  const durationMatch = html.match(/"playable_duration_in_ms":(\d+)/)
  return {
    directUrl,
    title,
    captionsUrl: captionsMatch ? unescapeJsonString(captionsMatch[1]) : null,
    durationMs: durationMatch ? Number(durationMatch[1]) : null,
  }
}

/**
 * Tải trang xem video Facebook và trích URL mp4 trực tiếp. Thử LẦN LƯỢT nhiều
 * cách (crawler UA, desktop, mobile m.facebook.com) vì Facebook chặn/đẩy sang
 * trang đăng nhập tuỳ UA + IP (đặc biệt IP datacenter như Vercel) — cách nào
 * ra được link mp4 trước thì dùng.
 *
 * @param {string} facebookUrl
 * @returns {Promise<{ directUrl: string, title: string, captionsUrl: string|null, durationMs: number|null }>}
 */
export async function resolveFacebookVideo(facebookUrl) {
  if (!isFacebookVideoUrl(facebookUrl)) {
    throw new FacebookVideoError('Link Facebook không hợp lệ.', 400)
  }

  const cleaned = cleanUrl(facebookUrl)
  const attempts = [
    { url: cleaned, ua: UA_CRAWLER },
    { url: cleaned, ua: UA_DESKTOP },
    { url: toMobileUrl(cleaned), ua: UA_MOBILE },
  ]

  const statuses = []
  let sawLoginWall = false
  for (const { url, ua } of attempts) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': ua, 'Accept-Language': 'vi,en;q=0.9', Accept: 'text/html,application/xhtml+xml' },
        redirect: 'follow',
      })
      statuses.push(res.status)
      const html = await res.text().catch(() => '')
      if (/login|checkpoint/i.test(res.url) && !/\/share\//.test(res.url)) sawLoginWall = true
      const found = html ? extractFromHtml(html) : null
      if (found) return found
    } catch (err) {
      statuses.push(`lỗi mạng: ${err?.message || err}`)
    }
  }

  console.error('[facebookVideo] không trích được video. Trạng thái các lần thử:', statuses.join(', '))
  const allBlocked = statuses.every((s) => typeof s === 'number' && s >= 400)
  throw new FacebookVideoError(
    (allBlocked
      ? `Facebook từ chối truy cập link này từ server (mã ${statuses.filter((s) => typeof s === 'number').join('/')}).`
      : sawLoginWall
        ? 'Facebook yêu cầu đăng nhập để xem video này.'
        : 'Không tìm thấy link video trong trang Facebook.') +
      ' Thường do video không công khai hoặc Facebook chặn truy cập tự động. Hãy tải video về máy rồi dùng "Chọn file để tải lên" thay thế.',
    422,
  )
}
