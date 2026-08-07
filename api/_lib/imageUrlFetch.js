// api/_lib/imageUrlFetch.js
// Lấy 1 ảnh từ URL bất kỳ (chức năng "đọc hình từ URL" của Bring Any Idea to
// Life) và trả về base64 + mimeType để đi tiếp vào cùng pipeline Groq/Gemini
// đã có sẵn cho ảnh upload (xem bringAnyIdeaToLifeProxy.js) — KHÔNG cần thêm
// nhánh xử lý mới, chỉ cần "biến" 1 link ảnh thành fileBase64/mimeType y hệt
// như khi người dùng chọn file từ máy.
//
// Fetch diễn ra Ở SERVER (không phải trình duyệt) để tránh lỗi CORS/hotlink
// khi ảnh nằm trên domain không cho phép fetch cross-origin từ client — cùng
// tinh thần với webpageText.js (fetch trang web) đã có trong codebase.

export class ImageUrlFetchError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'ImageUrlFetchError'
    this.status = status
  }
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024 // 8MB — đủ cho hầu hết ảnh chụp/ảnh web, chặn ảnh quá nặng
const FETCH_TIMEOUT_MS = 15_000

function withTimeout(promise, ms, onTimeoutMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new ImageUrlFetchError(onTimeoutMessage, 504)), ms)),
  ])
}

/**
 * @param {string} imageUrl
 * @returns {Promise<{ base64: string, mimeType: string }>}
 */
export async function fetchImageAsBase64(imageUrl) {
  let parsed
  try {
    parsed = new URL(imageUrl)
  } catch {
    throw new ImageUrlFetchError('Link ảnh không hợp lệ.', 400)
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new ImageUrlFetchError('Chỉ hỗ trợ link ảnh http/https.', 400)
  }

  let res
  try {
    res = await withTimeout(
      fetch(parsed.toString(), {
        headers: {
          // Vài CDN/host chặn UA "bot" mặc định của fetch() server-side — giả UA
          // trình duyệt thường để tăng tỉ lệ tải được ảnh (giống webpageText.js).
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          Accept: 'image/*',
        },
        redirect: 'follow',
      }),
      FETCH_TIMEOUT_MS,
      'Ảnh phản hồi quá chậm (quá 15s), thử lại sau hoặc dùng link khác.',
    )
  } catch (err) {
    if (err instanceof ImageUrlFetchError) throw err
    throw new ImageUrlFetchError(`Không tải được ảnh: ${err?.message || err}`, 502)
  }

  if (!res.ok) {
    throw new ImageUrlFetchError(`Link ảnh trả về lỗi HTTP ${res.status}.`, 502)
  }

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('image/')) {
    throw new ImageUrlFetchError(
      `Link này không phải ảnh (content-type: ${contentType || 'không xác định'}). Hãy dán link trỏ thẳng tới file ảnh (.png, .jpg, .webp...).`,
      400,
    )
  }

  const contentLengthHeader = res.headers.get('content-length')
  if (contentLengthHeader && Number(contentLengthHeader) > MAX_IMAGE_BYTES) {
    throw new ImageUrlFetchError(`Ảnh quá lớn (vượt quá ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB).`, 413)
  }

  const reader = res.body?.getReader ? res.body.getReader() : null
  let buffer
  if (reader) {
    // Đọc thủ công theo chunk để chặn cứng ở MAX_IMAGE_BYTES ngay cả khi server
    // không trả Content-Length chính xác, tránh ảnh quá nặng tốn tài nguyên vô ích.
    const chunks = []
    let received = 0
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_IMAGE_BYTES) {
        try { await reader.cancel() } catch { /* ignore */ }
        throw new ImageUrlFetchError(`Ảnh quá lớn (vượt quá ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB).`, 413)
      }
      chunks.push(value)
    }
    buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)))
  } else {
    const arrayBuffer = await res.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  }

  if (!buffer.length) {
    throw new ImageUrlFetchError('Ảnh tải về rỗng, thử lại hoặc dùng link khác.', 502)
  }

  return { base64: buffer.toString('base64'), mimeType: contentType }
}
