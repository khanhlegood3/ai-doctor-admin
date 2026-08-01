// api/_lib/webpageText.js
// Lấy nội dung TEXT THUẦN của 1 trang web bất kỳ (không phải YouTube) để làm
// nguyên liệu cho pipeline "Website to Learning" trong videoToLearningProxy.js
// — cùng tinh thần với youtubeTranscript.js (lấy transcript miễn phí, không
// cần API key) nhưng áp dụng cho trang web thường: fetch HTML thô rồi tự
// trích text bằng regex, KHÔNG thêm dependency mới (cheerio/jsdom) để không
// phình bundle/serverless function.
//
// GIỚI HẠN: đây là fetch tĩnh (không chạy JavaScript), nên các trang SPA
// render nội dung hoàn toàn bằng client-side JS (React/Vue không SSR) sẽ trả
// về rất ít text — hàm này báo lỗi rõ ràng trong trường hợp đó thay vì âm
// thầm gửi 1 trang gần như trống cho AI.

export class WebpageTextError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'WebpageTextError'
    this.status = status
  }
}

const MAX_HTML_BYTES = 2 * 1024 * 1024 // 2MB — đủ cho hầu hết bài viết/blog, chặn trang quá nặng
const FETCH_TIMEOUT_MS = 15_000
export const MIN_PAGE_TEXT_CHARS = 200 // dưới ngưỡng này coi là "không đủ nội dung để học"

function withTimeout(promise, ms, onTimeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new WebpageTextError(onTimeoutMessage, 504)), ms)),
  ])
}

// Giải mã vài HTML entity phổ biến nhất — không cần bộ giải mã đầy đủ vì
// mục đích chỉ là cho AI đọc hiểu nội dung, không phải hiển thị lại nguyên văn.
function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return ''
  return decodeBasicEntities(match[1]).trim().slice(0, 200)
}

function htmlToPlainText(html) {
  let text = html
    // Bỏ hẳn các khối không phải nội dung đọc được (script/style/nav/footer/svg...)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<!--([\s\S]*?)-->/g, ' ')
    // Xuống dòng ở các thẻ block để giữ cấu trúc đoạn văn tương đối
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\s*\/?>(?=)/gi, '\n')
    // Bỏ toàn bộ thẻ HTML còn lại
    .replace(/<[^>]+>/g, ' ')

  text = decodeBasicEntities(text)
  // Gộp khoảng trắng thừa nhưng vẫn giữ xuống dòng đoạn văn
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')

  return text.trim()
}

/**
 * Fetch 1 URL bất kỳ và trả về text thuần + title, để dùng làm "nội dung
 * nguồn" cho prompt sinh spec học tập — tương tự transcript của video.
 *
 * @param {string} pageUrl
 * @returns {Promise<{ text: string, title: string, url: string }>}
 */
export async function fetchWebpageText(pageUrl) {
  let parsed
  try {
    parsed = new URL(pageUrl)
  } catch {
    throw new WebpageTextError('Link không hợp lệ.', 400)
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new WebpageTextError('Chỉ hỗ trợ link http/https.', 400)
  }

  let res
  try {
    res = await withTimeout(
      fetch(parsed.toString(), {
        headers: {
          // Vài trang chặn UA "bot" mặc định của fetch() server-side — giả UA
          // trình duyệt thường để tăng tỉ lệ lấy được nội dung thật.
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      }),
      FETCH_TIMEOUT_MS,
      'Trang web phản hồi quá chậm (quá 15s), thử lại sau hoặc chọn trang khác.',
    )
  } catch (err) {
    if (err instanceof WebpageTextError) throw err
    throw new WebpageTextError(`Không tải được trang web: ${err?.message || err}`, 502)
  }

  if (!res.ok) {
    throw new WebpageTextError(`Trang web trả về lỗi HTTP ${res.status}.`, 502)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
    throw new WebpageTextError(`Link này không phải trang HTML (content-type: ${contentType}).`, 400)
  }

  const reader = res.body?.getReader ? res.body.getReader() : null
  let html
  if (reader) {
    // Đọc thủ công theo chunk để chặn cứng ở MAX_HTML_BYTES, tránh trang quá
    // nặng làm serverless function tốn thời gian/bộ nhớ vô ích.
    const chunks = []
    let received = 0
    const decoder = new TextDecoder('utf-8')
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      chunks.push(value)
      if (received >= MAX_HTML_BYTES) {
        try { await reader.cancel() } catch { /* ignore */ }
        break
      }
    }
    html = decoder.decode(Buffer.concat(chunks.map((c) => Buffer.from(c))))
  } else {
    html = await res.text()
  }

  const title = extractTitle(html)
  const text = htmlToPlainText(html)

  if (text.length < MIN_PAGE_TEXT_CHARS) {
    throw new WebpageTextError(
      'Không trích được đủ nội dung từ trang này — có thể trang cần chạy JavaScript mới hiển thị nội dung (SPA), hoặc trang chặn crawl. Thử dán link 1 bài viết/blog tĩnh khác.',
      422,
    )
  }

  // Giới hạn độ dài gửi cho AI (giữ vừa 1 context window hợp lý, tương tự
  // cách MIN/độ dài transcript được xử lý trong youtubeTranscript.js).
  const MAX_TEXT_CHARS = 20_000
  const truncated = text.length > MAX_TEXT_CHARS ? `${text.slice(0, MAX_TEXT_CHARS)}\n\n[...nội dung đã được cắt bớt do quá dài...]` : text

  return { text: truncated, title, url: parsed.toString() }
}
