// api/_lib/geminiComic.js
// Logic sinh TEXT + ẢNH — dùng chung cho tính năng "Tạo Game bằng Avatar của
// Tôi" (Comic Hero). Hai nhánh dùng 2 nhà cung cấp khác nhau:
//   - Sinh TEXT (kịch bản): Groq (api.groq.com) — TÁI SỬ DỤNG GROQ_API_KEY đã
//     có sẵn trong dự án (đang chạy chatbot chính), miễn phí thật, không cần
//     ví Pollen.
//   - Sinh ẢNH: vẫn Pollinations.AI, model "flux" — gọi ẨN DANH.
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
//   4. Đổi sang gọi "flux" ẨN DANH — GET /image/{prompt}, KHÔNG gửi
//      Authorization/Bearer key. Theo tài liệu chính thức, đây là cách DUY
//      NHẤT thật sự $0: tier "Anonymous" (không có key) không bị trừ Pollen,
//      đổi lại giới hạn tốc độ ~1 ảnh / 15 giây / IP.
//   5. Nhánh TEXT (kịch bản): Pollinations không có chế độ ẩn danh cho text
//      trên gen.pollinations.ai, vẫn cần POLLINATIONS_API_KEY có Pollen →
//      đổi hẳn sang gọi Groq (api.groq.com/openai/v1/chat/completions), tái
//      dùng GROQ_API_KEY đã cấu hình sẵn cho chatbot chính trong dự án.
//      Miễn phí thật, không phụ thuộc ví Pollen nào cả.
//   6. (BẢN NÀY) Nhánh ẢNH: domain "gen.pollinations.ai" (endpoint "unified"
//      mới) bắt đầu YÊU CẦU AUTH cho MỌI request, kể cả model free "flux" —
//      lỗi 401 dù không đổi gì phía code (Pollinations tự thay đổi chính
//      sách). Domain CŨ "image.pollinations.ai" vẫn còn hoạt động ẩn danh,
//      miễn phí — chuyển hẳn sang domain này, kèm tham số `referrer=<domain
//      của app>` thay cho Bearer key.
//
//   TÓM LẠI (bản hiện tại):
//   - Sinh ẢNH: hoàn toàn miễn phí, không cần API key, không phụ thuộc ví
//     Pollen — nhưng sinh từ mô tả TEXT thuần (không nhận ảnh tham chiếu),
//     nên KHÔNG còn giữ nét mặt avatar thật của người dùng, và bị giới hạn
//     tốc độ ~1 ảnh/15 giây/IP (đủ dùng cho 1 người dùng thao tác tuần tự,
//     nhưng nhiều người dùng cùng lúc có thể bị 429).
//   - Sinh TEXT (kịch bản): dùng Groq, model xem TEXT_MODEL bên dưới — cần
//     GROQ_API_KEY (đã có sẵn trong dự án, dùng chung với chatbot chính).
//
// Được import bởi:
//   - api/groq-proxy.js → Vercel Serverless Function (production), nhánh
//     provider: 'gemini-comic' (dùng chung endpoint với Groq để không vượt
//     quá giới hạn 12 Serverless Functions của Vercel).
//   - vite.config.js    → middleware dev-server, để `npm run dev`
//     cũng gọi Groq/Pollinations thật, không cần deploy lên Vercel mới test
//     được.
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
// Env var:
//   - GROQ_API_KEY (hoặc GROQ_API_KEY1, GROQ_API_KEY2, ... — xem
//     api/_lib/apiKeyPool.js để dùng nhiều key dự phòng, tự động rotate khi
//     1 key hết hạn mức/billing) — dùng cho nhánh TEXT (kịch bản), lấy free
//     tại https://console.groq.com — đã có sẵn trong dự án (chatbot chính +
//     api/groq-whisper.js dùng chung biến này).
//   - Nhánh ẢNH không cần API key nào (gọi ẩn danh tới Pollinations).

import { withApiKeyRotation, toRotatableHttpError } from './apiKeyPool.js'

const POLLINATIONS_IMAGE_BASE_URL = 'https://image.pollinations.ai'
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'

// Model text: dùng Groq "llama-3.3-70b-versatile" — cùng model đang dùng
// cho chatbot chính (xem api/groq-proxy.js), miễn phí thật (14.400
// request/ngày), hỗ trợ response_format json_object. Model ảnh: "flux" —
// gọi ẩn danh (xem ghi chú ở trên) nên thật sự $0, không cần Pollen.
const TEXT_MODEL = 'llama-3.3-70b-versatile'
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

// Dùng chung cho cả 2 nhánh (Groq text + Pollinations image) nên không còn
// gắn cứng tên nhà cung cấp nào trong message mặc định — `providerLabel`
// cho phép caller ghi rõ nguồn lỗi (vd "Groq API", "Pollinations API") khi
// cần, còn mặc định chỉ nói chung chung "Upstream API error".
async function parseUpstreamError(res, providerLabel = 'Upstream') {
  const text = await res.text().catch(() => '')
  let message = text
  try {
    const json = JSON.parse(text)
    message = json?.error?.message || json?.error || text
  } catch {
    // giữ nguyên text nếu không phải JSON
  }
  message = String(message || `${providerLabel} API error (${res.status})`)
  const isAuthError = res.status === 401 || res.status === 402 || /invalid.*key|unauthorized|payment required/i.test(message)
  if (res.status === 429) {
    const rateLimitMessage = providerLabel === 'Pollinations'
      ? 'Đang bị giới hạn tần suất của chế độ ảnh miễn phí (~1 ảnh/15 giây/IP). Vui lòng đợi vài giây rồi thử lại.'
      : 'Đang bị giới hạn tần suất của API miễn phí. Vui lòng đợi một chút rồi thử lại.'
    throw new GeminiComicError(rateLimitMessage, 429)
  }
  throw new GeminiComicError(message, isAuthError ? 401 : res.status || 500)
}

// ---------------------------------------------------------------------------
// Nhánh sinh TEXT — dùng cho generateComicText (kịch bản/nội dung từng beat)
// Gọi Groq (api.groq.com/openai/v1/chat/completions) — tái sử dụng
// GROQ_API_KEY đã có sẵn trong dự án cho chatbot chính. Format request/
// response tương thích OpenAI, giống hệt cách api/groq-proxy.js đang gọi
// Groq ở nhánh mặc định.
// ---------------------------------------------------------------------------
async function generateText({ contents, config, envSource }) {
  const promptText = typeof contents === 'string' ? contents : extractPromptText(contents)

  const body = {
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: promptText }],
  }
  if (config?.responseMimeType === 'application/json') {
    body.response_format = { type: 'json_object' }
  }

  // KEY POOL / AUTO-ROTATION: nếu GROQ_API_KEY đang dùng hết hạn mức/billing,
  // tự động thử GROQ_API_KEY1, GROQ_API_KEY2, ... (xem api/_lib/apiKeyPool.js)
  // thay vì để nhánh sinh kịch bản của Comic Hero lỗi ngay lập tức.
  const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
    return res.json()
  }, { envSource })

  const text = data?.choices?.[0]?.message?.content || ''

  return { text, candidates: [] }
}

// ---------------------------------------------------------------------------
// Nhánh sinh ẢNH — dùng cho generateComicImage (persona + panel truyện).
//
// QUAN TRỌNG (cập nhật): domain "gen.pollinations.ai" (endpoint "unified"
// mới của Pollinations) giờ LUÔN yêu cầu auth — kể cả model free "flux" —
// trả lỗi 401 "Authentication required..." nếu không có Bearer key. Đây là
// thay đổi gần đây từ phía Pollinations (không liên quan gì tới việc chưa
// cấu hình đúng ở bên mình).
//
// Pollinations vẫn giữ domain CŨ "image.pollinations.ai" hoạt động ẩn danh,
// miễn phí, không cần Bearer key — chỉ cần thêm tham số `referrer=<domain>`
// để tránh bị coi là traffic không rõ nguồn gốc. Đổi hẳn sang domain này để
// giữ đúng mục tiêu $0 tuyệt đối, không phụ thuộc ví Pollen.
// Giới hạn tốc độ vẫn ~1 ảnh / 15 giây / IP như trước.
// ---------------------------------------------------------------------------
const IMAGE_REFERRER_DOMAIN = 'hienmaunhanvan.com'

async function generateImage({ contents, config }) {
  const rawPromptText = extractPromptText(contents)
  const promptText = sanitizePromptForTextToImage(rawPromptText)
  const { width, height } = aspectRatioToDims(config?.imageConfig?.aspectRatio)

  const url = `${POLLINATIONS_IMAGE_BASE_URL}/prompt/${encodeURIComponent(promptText)}?model=${IMAGE_MODEL}&width=${width}&height=${height}&nologo=true&referrer=${encodeURIComponent(IMAGE_REFERRER_DOMAIN)}`

  // Không set header Authorization ở đây — request đi ẩn danh, chỉ khai báo
  // referrer để Pollinations nhận diện nguồn gọi (thay cho Bearer key).
  const res = await fetch(url)

  if (!res.ok) await parseUpstreamError(res, 'Pollinations')

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
export async function runGeminiComicGenerate({ action = 'generateContent', contents, config, envSource }) {
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
      // generateImage). Không chặn ở đây dù GROQ_API_KEY chưa cấu hình, để
      // tính năng sinh ảnh vẫn hoạt động độc lập với nhánh text.
      return await generateImage({ contents, config })
    }
    // Nhánh text gọi Groq — KEY POOL / AUTO-ROTATION qua GROQ_API_KEY* (xem
    // generateText() ở trên và api/_lib/apiKeyPool.js).
    return await generateText({ contents, config, envSource })
  } catch (err) {
    if (err instanceof GeminiComicError) throw err
    throw new GeminiComicError(String(err?.message || err || 'Comic generate proxy error'), 500)
  }
}
