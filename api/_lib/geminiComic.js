// api/_lib/geminiComic.js
// Logic gọi Pollinations.AI (gen.pollinations.ai) — dùng chung cho tính năng
// "Tạo Game bằng Avatar của Tôi" (Comic Hero).
//
// LỊCH SỬ:
//   1. Ban đầu dùng Google Gemini (@google/genai).
//   2. Đổi sang Pollinations.AI, model ảnh "nanobanana" (giữ được nét mặt
//      avatar thật qua ảnh tham chiếu / image-to-image) — NHƯNG mọi request
//      có kèm API key đều bị trừ Pollen, tài khoản dùng chung của app hết
//      Pollen → lỗi "insufficient balance".
//   3. Đổi model ảnh sang "flux" qua endpoint có key (POST
//      /v1/images/generations) — NHƯNG vẫn bị trừ Pollen (rẻ hơn nhiều,
//      nhưng vẫn > 0), ví vẫn 0 → vẫn lỗi.
//   4. (BẢN NÀY) Đổi sang gọi "flux" ẨN DANH — GET /image/{prompt}, KHÔNG
//      gửi Authorization/Bearer key. Theo tài liệu chính thức, đây là cách
//      DUY NHẤT thật sự $0: tier "Anonymous" (không có key) không bị trừ
//      Pollen, đổi lại giới hạn tốc độ ~1 ảnh / 15 giây / IP.
//
//   TÓM LẠI (bản hiện tại):
//   - Sinh ẢNH: hoàn toàn miễn phí, không cần POLLINATIONS_API_KEY, không
//     phụ thuộc ví Pollen — nhưng sinh từ mô tả TEXT thuần (không nhận ảnh
//     tham chiếu), nên KHÔNG còn giữ nét mặt avatar thật của người dùng, và
//     bị giới hạn tốc độ ~1 ảnh/15 giây/IP (đủ dùng cho 1 người dùng thao
//     tác tuần tự, nhưng nhiều người dùng cùng lúc có thể bị 429).
//   - Sinh TEXT (kịch bản): vẫn dùng model "openai" qua endpoint có key —
//     Pollinations KHÔNG có chế độ ẩn danh cho text trên gen.pollinations.ai
//     nên vẫn cần POLLINATIONS_API_KEY có Pollen (dù chi phí rất rẻ, xem
//     ghi chú ở TEXT_MODEL bên dưới).
//
// Được import bởi:
//   - api/groq-proxy.js → Vercel Serverless Function (production), nhánh
//     provider: 'gemini-comic' (dùng chung endpoint với Groq để không vượt
//     quá giới hạn 12 Serverless Functions của Vercel).
//   - vite.config.js    → middleware dev-server, để `npm run dev`
//     cũng gọi Pollinations thật, không cần deploy lên Vercel mới test được.
//
// GIỮ NGUYÊN INTERFACE: hàm export `runGeminiComicGenerate({ apiKey, action,
// model, contents, config })` nhận và trả về đúng "hình dạng" dữ liệu kiểu
// Gemini cũ (contents: string | {text} | Array<{text}|{inlineData}}>,
// candidates[0].content.parts[].inlineData.{mimeType,data}) để KHÔNG phải
// đụng vào geminiComicClient.js hay ComicHeroGamePanel.jsx ở phía client.
// Client vẫn gửi kèm inlineData (ảnh tham chiếu) như cũ — engine ở đây chỉ
// ĐỌC phần text, tự "làm sạch" các câu nhắc tới ảnh tham chiếu không còn
// tồn tại (xem sanitizePromptForTextToImage), và BỎ QUA phần inlineData.
//
// Env var: POLLINATIONS_API_KEY — secret key (sk_...) lấy free tại
// https://enter.pollinations.ai — KHÔNG bao giờ để lộ ra frontend. Chỉ nhánh
// TEXT dùng biến này; nhánh ẢNH không cần.

const BASE_URL = 'https://gen.pollinations.ai'

// Model text: "openai" — rẻ nhưng không phải $0 tuyệt đối, vẫn cần Pollen
// (Pollinations tính ~100.000+ lượt/1 Pollen — gần như không đáng kể,
// nhưng vẫn cần ví > 0). Model ảnh: "flux" — gọi ẩn danh (xem ghi chú ở
// trên) nên thật sự $0, không cần Pollen.
const TEXT_MODEL = 'openai'
const IMAGE_MODEL = 'flux'

export class GeminiComicError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Aspect ratio kiểu Gemini ("1:1", "2:3", ...) → { width, height } cụ thể
// cho endpoint GET /image/{prompt} (nhận width/height riêng, không phải
// chuỗi "size" như endpoint POST JSON).
function aspectRatioToDims(aspectRatio) {
  switch (aspectRatio) {
    case '1:1':
      return { width: 1024, height: 1024 }
    case '2:3':
      return { width: 1024, height: 1536 }
    case '3:2':
      return { width: 1536, height: 1024 }
    case '9:16':
      return { width: 1024, height: 1820 }
    case '16:9':
      return { width: 1820, height: 1024 }
    default:
      return { width: 1024, height: 1024 }
  }
}

// Đoán mimeType thật từ vài byte đầu của base64 (Pollinations không luôn nói
// rõ PNG hay JPEG trong response JSON, nên tự dò theo "magic bytes").
function sniffMimeFromBase64(base64) {
  if (!base64) return 'image/png'
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/png'
}

// contents kiểu Gemini → gộp hết các phần `text` thành 1 chuỗi prompt.
// contents có thể là:
//   - string (nhánh text, xử lý riêng ở generateText)
//   - { text: "..." } (ảnh không có tham chiếu, vd sinh persona)
//   - [{ text }, { inlineData: {...} }, ...] (nhiều phần — client vẫn gửi
//     kèm inlineData như trước khi đổi sang flux, NHƯNG ở đây ta chủ động
//     BỎ QUA phần inlineData vì flux không nhận ảnh tham chiếu)
function extractPromptText(contents) {
  const parts = Array.isArray(contents) ? contents : [contents]
  const textParts = []
  for (const part of parts) {
    if (part && typeof part.text === 'string' && part.text.trim()) {
      textParts.push(part.text.trim())
    }
  }
  return textParts.join('\n')
}

// ComicHeroGamePanel.jsx (không sửa) vẫn chèn các câu như
// "REFERENCE 1 [HERO]:" hoặc "Maintain strict character likeness... use
// REFERENCE 1" vào prompt vì trước đây có ảnh tham chiếu đi kèm. Từ khi đổi
// sang flux (text-to-image, không có ảnh tham chiếu), những câu này không
// còn ý nghĩa và có thể khiến flux hiểu sai/sinh ảnh lỗi — nên lọc bỏ trước
// khi gửi lên API.
function sanitizePromptForTextToImage(promptText) {
  return promptText
    .replace(/REFERENCE 1 \[HERO\]:/g, '')
    .replace(/REFERENCE 2 \[CO-STAR\]:/g, '')
    .replace(/INSTRUCTIONS: Maintain strict character likeness\.[^.]*\.[^.]*\.\s*/g, '')
    .replace(/\(Use REFERENCE 1\)/g, '')
    .replace(/\(Use REFERENCE 2\)/g, '')
    .replace(/\breference 1\b/gi, 'the main hero')
    .replace(/\breference 2\b/gi, 'the co-star')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

async function parseUpstreamError(res) {
  const text = await res.text().catch(() => '')
  let message = text
  try {
    const json = JSON.parse(text)
    message = json?.error?.message || json?.error || text
  } catch {
    // giữ nguyên text nếu không phải JSON
  }
  message = String(message || `Pollinations API error (${res.status})`)
  const isAuthError = res.status === 401 || res.status === 402 || /invalid.*key|unauthorized|payment required/i.test(message)
  if (res.status === 429) {
    throw new GeminiComicError(
      'Đang bị giới hạn tần suất của chế độ ảnh miễn phí (~1 ảnh/15 giây/IP). Vui lòng đợi vài giây rồi thử lại.',
      429
    )
  }
  throw new GeminiComicError(message, isAuthError ? 401 : res.status || 500)
}

// ---------------------------------------------------------------------------
// Nhánh sinh TEXT — dùng cho generateComicText (kịch bản/nội dung từng beat)
// ---------------------------------------------------------------------------
async function generateText({ apiKey, contents, config }) {
  const promptText = typeof contents === 'string' ? contents : extractPromptText(contents)

  const body = {
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: promptText }],
  }
  if (config?.responseMimeType === 'application/json') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) await parseUpstreamError(res)

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content || ''

  return { text, candidates: [] }
}

// ---------------------------------------------------------------------------
// Nhánh sinh ẢNH — dùng cho generateComicImage (persona + panel truyện).
//
// QUAN TRỌNG: gọi KHÔNG kèm Authorization/Bearer key. Tài liệu Pollinations
// xác nhận: hễ request có gửi API key là bị trừ Pollen (kể cả model free
// như flux) — "flux miễn phí vĩnh viễn" chỉ đúng ở tier Anonymous (không
// gửi key), đổi lại giới hạn tốc độ ~1 ảnh / 15 giây / địa chỉ IP. Vì mục
// tiêu là $0 tuyệt đối (không phụ thuộc ví Pollen), ta chấp nhận đánh đổi
// tốc độ này thay vì gửi kèm sk_ key.
// ---------------------------------------------------------------------------
async function generateImage({ contents, config }) {
  const rawPromptText = extractPromptText(contents)
  const promptText = sanitizePromptForTextToImage(rawPromptText)
  const { width, height } = aspectRatioToDims(config?.imageConfig?.aspectRatio)

  const url = `${BASE_URL}/image/${encodeURIComponent(promptText)}?model=${IMAGE_MODEL}&width=${width}&height=${height}&nologo=true`

  // Không set header Authorization ở đây — cố tình để request đi ẩn danh.
  const res = await fetch(url)

  if (!res.ok) await parseUpstreamError(res)

  const contentType = res.headers.get('content-type') || ''
  const arrBuf = await res.arrayBuffer()
  const base64 = Buffer.from(arrBuf).toString('base64')
  const mimeType = contentType.startsWith('image/') ? contentType.split(';')[0].trim() : sniffMimeFromBase64(base64)

  return {
    text: '',
    candidates: [
      {
        content: {
          parts: [{ inlineData: { mimeType, data: base64 } }],
        },
      },
    ],
  }
}

// ---------------------------------------------------------------------------
// Entry point — giữ nguyên chữ ký hàm để không phải sửa nơi gọi
// ---------------------------------------------------------------------------
export async function runGeminiComicGenerate({ apiKey, action = 'generateContent', contents, config }) {
  if (!contents) {
    throw new GeminiComicError('Missing "contents" in request body', 400)
  }
  if (action !== 'generateContent') {
    throw new GeminiComicError(`Unsupported action: ${action}`, 400)
  }

  try {
    // Phân biệt nhánh text/ảnh dựa trên config.imageConfig — client hiện tại
    // (geminiComicClient.js) luôn gửi imageConfig khi gọi generateComicImage
    // và responseMimeType khi gọi generateComicText, nên không cần đổi gì ở
    // phía client.
    if (config?.imageConfig) {
      // Nhánh ảnh KHÔNG cần apiKey — chạy ẩn danh, miễn phí thật (xem
      // generateImage). Không chặn ở đây dù POLLINATIONS_API_KEY chưa cấu
      // hình, để tính năng sinh ảnh vẫn hoạt động độc lập với nhánh text.
      return await generateImage({ contents, config })
    }
    // Nhánh text vẫn cần apiKey thật (có Pollen) vì Pollinations không có
    // chế độ ẩn danh cho text trên gen.pollinations.ai.
    if (!apiKey) {
      throw new GeminiComicError('POLLINATIONS_API_KEY not configured on server', 500)
    }
    return await generateText({ apiKey, contents, config })
  } catch (err) {
    if (err instanceof GeminiComicError) throw err
    throw new GeminiComicError(String(err?.message || err || 'Pollinations proxy error'), 500)
  }
}
