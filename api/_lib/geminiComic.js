// api/_lib/geminiComic.js
// Logic gọi Pollinations.AI (gen.pollinations.ai) — dùng chung cho tính năng
// "Tạo Game bằng Avatar của Tôi" (Comic Hero).
//
// LỊCH SỬ: Ban đầu dùng Google Gemini (@google/genai). Đã đổi sang
// Pollinations.AI vì miễn phí thật (không giới hạn credit dùng thử), có
// endpoint OpenAI-compatible cho cả sinh text lẫn sinh ảnh/image-to-image.
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
//
// Env var: POLLINATIONS_API_KEY — secret key (sk_...) lấy free tại
// https://enter.pollinations.ai — KHÔNG bao giờ để lộ ra frontend.

const BASE_URL = 'https://gen.pollinations.ai'

// Model text: "openai" (Pollinations proxy tới GPT, miễn phí qua pool chung).
// Model ảnh: "nanobanana" — hỗ trợ image-to-image nhiều ảnh tham chiếu
// (đúng nhu cầu "biến avatar thành nhân vật hero" + giữ mặt nhân vật phụ).
const TEXT_MODEL = 'openai'
const IMAGE_MODEL = 'nanobanana'

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

// contents kiểu Gemini → { promptText, refImages: [{mimeType, data}] }
// contents có thể là:
//   - string (chỉ dùng cho nhánh text, xử lý riêng ở runGeminiComicGenerate)
//   - { text: "..." } (ảnh không có tham chiếu, vd sinh persona lần đầu)
//   - [{ text }, { inlineData: { mimeType, data } }, ...] (nhiều phần, có
//     thể xen kẽ text + ảnh tham chiếu, vd generateImage với hero/co-star)
function parseImageContents(contents) {
  const parts = Array.isArray(contents) ? contents : [contents]
  const textParts = []
  const refImages = []

  for (const part of parts) {
    if (!part) continue
    if (typeof part.text === 'string' && part.text.trim()) {
      textParts.push(part.text.trim())
    }
    if (part.inlineData?.data) {
      refImages.push({
        mimeType: part.inlineData.mimeType || 'image/jpeg',
        data: part.inlineData.data,
      })
    }
  }

  return { promptText: textParts.join('\n'), refImages }
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
  const promptText = typeof contents === 'string' ? contents : parseImageContents(contents).promptText

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
// Nhánh sinh ẢNH — dùng cho generateComicImage (persona + panel truyện)
// ---------------------------------------------------------------------------
async function generateImage({ apiKey, contents, config }) {
  const { promptText, refImages } = parseImageContents(contents)
  const size = aspectRatioToSize(config?.imageConfig?.aspectRatio)

  let res
  if (refImages.length > 0) {
    // Có ảnh tham chiếu (avatar hero / co-star) → dùng /v1/images/edits
    // (image-to-image, multipart) — nanobanana hỗ trợ nhiều ảnh tham chiếu
    // cùng lúc qua nhiều field "image" lặp lại.
    const form = new FormData()
    form.append('model', IMAGE_MODEL)
    form.append('prompt', promptText)
    form.append('size', size)
    for (const img of refImages) {
      const buffer = Buffer.from(img.data, 'base64')
      form.append('image', new Blob([buffer], { type: img.mimeType }), 'reference.jpg')
    }

    res = await fetch(`${BASE_URL}/v1/images/edits`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
  } else {
    // Không có ảnh tham chiếu (vd sinh persona từ mô tả text thuần) →
    // /v1/images/generations (text-to-image).
    res = await fetch(`${BASE_URL}/v1/images/generations`, {
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
  }

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
