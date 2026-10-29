// api/_lib/youtubeSearchScrape.js
// Tìm video YouTube bằng text mô tả cho chế độ GON Arena — KHÔNG cần
// YOUTUBE_API_KEY (vốn chưa được cấu hình trên server): tải trang kết quả
// tìm kiếm youtube.com/results rồi trích object `ytInitialData` (JSON YouTube
// nhúng sẵn trong HTML) để lấy danh sách videoId + title.
//
// Đánh đổi đã được người dùng chấp nhận: scrape phụ thuộc cấu trúc trang
// YouTube — nếu YouTube đổi markup, hàm này báo lỗi rõ ràng (502) và client
// cho phép dán link video thủ công thay thế (xem InputArea.tsx / App.tsx).

export class YoutubeSearchScrapeError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'YoutubeSearchScrapeError'
    this.status = status
  }
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Trích chuỗi JSON object "cân bằng ngoặc" bắt đầu từ dấu '{' đầu tiên tại
// hoặc sau startIndex — có tính đến chuỗi "..." và escape \" bên trong để
// không dừng sớm ở ngoặc nằm trong chuỗi. ytInitialData là object JSON-literal
// của JS (thực chất là JSON hợp lệ về mặt cú pháp ngoặc/chuỗi).
function extractJsonObjectAt(html, startIndex) {
  const open = html.indexOf('{', startIndex)
  if (open < 0) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = open; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return html.slice(open, i + 1)
    }
  }
  return null
}

// Duyệt cây ytInitialData để gom mọi node videoRenderer (video trong kết quả
// tìm kiếm). Quảng cáo/shelf cũng có thể chứa videoRenderer với videoId hợp
// lệ — vẫn chấp nhận vì đây là tính năng gợi ý video cho demo đấu trường.
function collectVideoRenderers(node, out) {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) collectVideoRenderers(item, out)
    return
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === 'videoRenderer' && value && typeof value === 'object' && typeof value.videoId === 'string') {
      const title = Array.isArray(value.title?.runs)
        ? value.title.runs.map((run) => run?.text || '').join('').trim()
        : String(value.title?.simpleText || '').trim()
      out.push({ videoId: value.videoId, title: title || 'Untitled video' })
      continue
    }
    collectVideoRenderers(value, out)
  }
}

/**
 * Tìm tối đa `limit` link video YouTube phù hợp với query text.
 * @param {string} query
 * @param {number} limit - mặc định 2 (GON Arena chỉ dùng tối đa 2 link/lần)
 * @returns {Promise<Array<{ url: string, title: string }>>}
 */
export async function searchYoutubeVideoLinks(query, limit = 2) {
  const q = String(query || '').trim()
  if (!q) throw new YoutubeSearchScrapeError('Thiếu nội dung mô tả để tìm video.', 400)

  let html
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=vi`, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) {
      throw new YoutubeSearchScrapeError(`YouTube trả về HTTP ${res.status} khi tìm video (có thể bị chặn tạm thời — hãy dán link video trực tiếp).`, 502)
    }
    html = await res.text()
  } catch (err) {
    if (err instanceof YoutubeSearchScrapeError) throw err
    throw new YoutubeSearchScrapeError(`Không kết nối được YouTube để tìm video: ${err?.message || err}`, 502)
  }

  // ytInitialData thường xuất hiện dạng `var ytInitialData = {...};` trong 1
  // thẻ <script>; regex bắt marker rồi cân bằng ngoặc từ vị trí đó.
  const markerMatch = /(?:var\s+|window\[["']ytInitialData["']\]\s*=\s*)ytInitialData\s*=\s*/.exec(html)
    || /ytInitialData\s*=\s*/.exec(html)
  const rawJson = markerMatch ? extractJsonObjectAt(html, markerMatch.index + markerMatch[0].length) : null
  if (!rawJson) {
    throw new YoutubeSearchScrapeError('Không đọc được dữ liệu kết quả tìm kiếm từ YouTube (ytInitialData thiếu — YouTube có thể vừa đổi cấu trúc trang hoặc chặn request).', 502)
  }

  let data
  try {
    data = JSON.parse(rawJson)
  } catch {
    throw new YoutubeSearchScrapeError('Dữ liệu kết quả tìm kiếm YouTube không hợp lệ (parse ytInitialData thất bại).', 502)
  }

  const renderers = []
  collectVideoRenderers(data, renderers)

  const seen = new Set()
  const videos = []
  for (const renderer of renderers) {
    // videoId chuẩn của YouTube: đúng 11 ký tự [A-Za-z0-9_-]
    if (!/^[\w-]{11}$/.test(renderer.videoId) || seen.has(renderer.videoId)) continue
    seen.add(renderer.videoId)
    videos.push({ url: `https://www.youtube.com/watch?v=${renderer.videoId}`, title: renderer.title })
    if (videos.length >= limit) break
  }

  if (!videos.length) {
    throw new YoutubeSearchScrapeError(`Không tìm thấy video nào phù hợp với "${q}". Hãy thử mô tả khác hoặc dán link video trực tiếp.`, 404)
  }
  return videos
}
