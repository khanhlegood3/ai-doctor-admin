// api/_lib/geminiComic.js
// Logic gọi Pollinations.AI (gen.pollinations.ai) — dùng chung cho tính năng
// "Tạo Game bằng Avatar của Tôi" (Comic Hero).
//
// LỊCH SỬ:
//   1. Ban đầu dùng Google Gemini (@google/genai).
//   2. Đổi sang Pollinations.AI, model ảnh "nanobanana" (giữ được nét mặt
//      avatar thật qua ảnh tham chiếu / image-to-image).
//   3. (BẢN NÀY) Đổi model ảnh sang "flux" — quyết định có chủ đích: tài
//      khoản Pollinations dùng chung của app bị 0 Pollen ("insufficient
//      balance"), mà TẤT CẢ model image-to-image (nanobanana, kontext,
//      seedream, klein...) đều tốn Pollen. "flux" là model ảnh DUY NHẤT
//      của Pollinations miễn phí — vĩnh viễn, không giới hạn, không cần
//      Pollen. ĐÁNH ĐỔI: flux chỉ sinh ảnh từ TEXT (text-to-image), KHÔNG
//      nhận ảnh tham chiếu → tính năng "giữ nét mặt avatar thật của người
//      dùng" trong ảnh hero/panel truyện KHÔNG còn nữa; ảnh hero giờ sinh
//      hoàn toàn từ mô tả text (scene/desc), không dựa trên ảnh thật.
//   Sinh TEXT (kịch bản) vẫn dùng model "openai" — model này rất rẻ nhưng
//   KHÔNG hoàn toàn $0 như flux (Pollinations tính ~100.000+ lượt/1 Pollen).
//   Nếu tài khoản vẫn ở mức 0 Pollen, nhánh text vẫn có thể báo lỗi
//   "insufficient balance" dù chi phí gần như không đáng kể — cần nạp tối
//   thiểu (vài chục nghìn VNĐ ~ vài chục nghìn lượt gọi) hoặc chờ/khiếu nại
//   phần Pollen miễn phí hàng tuần của tier đã đăng ký tại
//   https://enter.pollinations.ai.
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
// https://enter.pollinations.ai — KHÔNG bao giờ để lộ ra frontend.

const BASE_URL = 'https://gen.pollinations.ai'

// Model text: "openai" — rẻ nhưng không phải $0 tuyệt đối (xem ghi chú ở
// trên). Model ảnh: "flux" — model ảnh duy nhất miễn phí vĩnh viễn của
// Pollinations, không cần Pollen, không giới hạn.
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

// Aspect ratio kiểu Gemini ("1:1", "2:3", ...) → kích thước pixel cụ thể mà
// Pollinations dùng (param `size`, dạng "WIDTHxHEIGHT").
function aspectRatioToSize(aspectRatio) {
  switch (aspectRatio) {
    case '1:1':
      return '1024x1024'
    case '2:3':
      return '1024x1536'
    case '3:2':
      return '1536x1024'
    case '9:16':
      return '1024x1820'
    case '16:9':
      return '1820x1024'
    default:
      return '1024x1024'
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
  throw new GeminiComicError(message, isAuthError ? 401 : 500)
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
// LUÔN dùng flux (text-to-image, miễn phí) — không còn nhánh image-to-image
// vì flux không nhận ảnh tham chiếu. Xem ghi chú ở đầu file.
// ---------------------------------------------------------------------------
async function generateImage({ apiKey, contents, config }) {
  const rawPromptText = extractPromptText(contents)
  const promptText = sanitizePromptForTextToImage(rawPromptText)
  const size = aspectRatioToSize(config?.imageConfig?.aspectRatio)

  const res = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: promptText,
      size,
      response_format: 'b64_json',
    }),
  })

  if (!res.ok) await parseUpstreamError(res)

  const data = await res.json()
  const first = data?.data?.[0]

  let base64 = first?.b64_json
  if (!base64 && first?.url) {
    // Vài trường hợp API trả về URL thay vì base64 — tự tải về và encode lại
    // để giữ nguyên "hình dạng" response mà client đang mong đợi.
    const imgRes = await fetch(first.url)
    if (!imgRes.ok) throw new GeminiComicError('Không tải được ảnh kết quả từ Pollinations', 500)
    const arrBuf = await imgRes.arrayBuffer()
    base64 = Buffer.from(arrBuf).toString('base64')
  }

  if (!base64) {
    throw new GeminiComicError('Pollinations không trả về dữ liệu ảnh hợp lệ', 500)
  }

  const mimeType = sniffMimeFromBase64(base64)

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
  if (!apiKey) {
    throw new GeminiComicError('POLLINATIONS_API_KEY not configured on server', 500)
  }
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
      return await generateImage({ apiKey, contents, config })
    }
    return await generateText({ apiKey, contents, config })
  } catch (err) {
    if (err instanceof GeminiComicError) throw err
    throw new GeminiComicError(String(err?.message || err || 'Pollinations proxy error'), 500)
  }
}
