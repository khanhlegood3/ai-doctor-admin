// api/_lib/arcadeSprite.js
//
// Backend cho tính năng "One Shot Arcade" (ghép vào Bring Any Idea to Life).
// Bản gốc (AI Studio, xem one-shot-arcade.zip) dùng @google/genai (Gemini
// "Nano Banana Pro") để: (1) biến ảnh thật của người chơi thành sprite pixel
// 8-bit CÒN GIỮ NÉT MẶT (image-to-image), và (2) ghép sprite hero + villain
// thành 1 cảnh "battle" hoàn chỉnh. Dự án này KHÔNG có GEMINI_API_KEY (chỉ
// có GROQ_API_KEY + Pollinations ẩn danh, xem geminiComic.js) nên áp dụng
// đúng chiến lược đã dùng cho Comic Hero:
//
//   - Mô tả ngoại hình từ ảnh: KHÔNG làm ở đây — client gọi thẳng nhánh Groq
//     mặc định (model 'meta-llama/llama-4-scout-17b-16e-instruct', vision)
//     giống hệt FullDocumentSummarizationPanel.jsx / MedicalUploader.jsx,
//     không cần thêm code backend nào.
//   - Sinh ẢNH sprite/scene: model 'flux' trên Pollinations, gọi ẨN DANH
//     (domain image.pollinations.ai + tham số referrer, KHÔNG Bearer key) —
//     xem đầy đủ lý do lịch sử ở geminiComic.js. Vì đây là text-to-image
//     thuần (không nhận ảnh tham chiếu), sprite sinh ra dựa trên MÔ TẢ chữ
//     (từ bước vision ở trên), không giữ nguyên khuôn mặt thật 1:1 như bản
//     Gemini gốc — đây là đánh đổi đã biết trước, không phải lỗi.
//   - Lời thoại villain (taunt): dùng Groq text, model llama-3.3-70b-versatile
//     (cùng model chatbot chính), ngắn gọn 1 câu, đọc được qua
//     /api/google-tts?tl=vi (đã có sẵn trong dự án).
//
// Được import bởi api/groq-proxy.js, nhánh provider === 'arcade-sprite'
// (KHÔNG tạo file api/*.js mới — xem ghi chú giới hạn 12 Serverless
// Functions ở đầu api/groq-proxy.js).

import { withApiKeyRotation, toRotatableHttpError } from './apiKeyPool.js'

const POLLINATIONS_IMAGE_BASE_URL = 'https://image.pollinations.ai'
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const IMAGE_REFERRER_DOMAIN = 'hienmaunhanvan.com'
const TEXT_MODEL = 'llama-3.3-70b-versatile'
const IMAGE_MODEL = 'flux'

export class ArcadeSpriteError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

function sniffMimeFromBase64(base64) {
  if (!base64) return 'image/png'
  if (base64.startsWith('iVBORw0KGgo')) return 'image/png'
  if (base64.startsWith('/9j/')) return 'image/jpeg'
  if (base64.startsWith('R0lGOD')) return 'image/gif'
  if (base64.startsWith('UklGR')) return 'image/webp'
  return 'image/png'
}

async function parseUpstreamError(res, providerLabel) {
  const text = await res.text().catch(() => '')
  let message = text
  try {
    const json = JSON.parse(text)
    message = json?.error?.message || json?.error || text
  } catch {
    // giữ nguyên text nếu không phải JSON
  }
  message = String(message || `${providerLabel} API error (${res.status})`)
  if (res.status === 429) {
    throw new ArcadeSpriteError(
      'Đang bị giới hạn tần suất của chế độ ảnh miễn phí (~1 ảnh/15 giây/IP). Vui lòng đợi vài giây rồi thử lại.',
      429,
    )
  }
  const isAuthError = res.status === 401 || res.status === 402 || /invalid.*key|unauthorized|payment required/i.test(message)
  throw new ArcadeSpriteError(message, isAuthError ? 401 : res.status || 500)
}

// ---------------------------------------------------------------------------
// Sinh ảnh sprite/scene — text-to-image thuần qua Pollinations "flux" ẩn danh.
// `kind` chỉ ảnh hưởng tới prompt khung (sprite pixel-art đơn lẻ, nền trong
// suốt giả lập bằng nền màu lục đồng nhất để client tự flood-fill xoá nền —
// xem processSpriteImage phía client) vs 1 cảnh "battle" ghép 2 nhân vật.
// ---------------------------------------------------------------------------
async function generateSpriteImage({ description, kind = 'sprite', villainDescription }) {
  if (!description || !description.trim()) {
    throw new ArcadeSpriteError('Thiếu mô tả nhân vật để sinh sprite.', 400)
  }

  let prompt
  let width = 512
  let height = 512
  if (kind === 'scene') {
    prompt = `16-bit retro arcade pixel art battle scene, side view, two characters facing off in a dungeon corridor. Left: hero, ${description}. Right: villain, ${villainDescription || 'a menacing pixelated monster'}. Dramatic lighting, limited retro color palette, crisp pixel edges, no text, no watermark.`
    width = 960
    height = 540
  } else {
    prompt = `16-bit retro video game character sprite, full body, front-facing, standing pose, ${description}. Solid flat bright green background (#00ff66) for chroma-key removal, crisp pixel art edges, limited retro color palette, no shadow on ground, no text, no watermark, centered.`
  }

  const url = `${POLLINATIONS_IMAGE_BASE_URL}/prompt/${encodeURIComponent(prompt)}?model=${IMAGE_MODEL}&width=${width}&height=${height}&nologo=true&referrer=${encodeURIComponent(IMAGE_REFERRER_DOMAIN)}`

  const res = await fetch(url)
  if (!res.ok) await parseUpstreamError(res, 'Pollinations')

  const contentType = res.headers.get('content-type') || ''
  const arrBuf = await res.arrayBuffer()
  const base64 = Buffer.from(arrBuf).toString('base64')
  const mimeType = contentType.startsWith('image/') ? contentType.split(';')[0].trim() : sniffMimeFromBase64(base64)

  return { imageBase64: base64, mimeType }
}

// ---------------------------------------------------------------------------
// Lời thoại villain — 1 câu ngắn, hống hách/troll, theo ngôn ngữ yêu cầu.
// ---------------------------------------------------------------------------
async function generateVillainTaunt({ villainDescription, situation, lang = 'vi', envSource }) {
  const langLabel = lang === 'en' ? 'English' : 'Vietnamese (tiếng Việt)'
  const promptText = [
    `You are the villain in a retro pixel arcade game. Your appearance: ${villainDescription || 'a shadowy pixelated monster'}.`,
    `Current situation: ${situation || 'the hero just entered your maze'}.`,
    `Say ONE short, campy, over-the-top taunt line (max 18 words) in ${langLabel}. Reply with ONLY the line, no quotes, no extra text.`,
  ].join(' ')

  const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: TEXT_MODEL,
        messages: [{ role: 'user', content: promptText }],
        max_tokens: 60,
        temperature: 0.9,
      }),
    })
    if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
    return res.json()
  }, { envSource })

  const line = (data?.choices?.[0]?.message?.content || '').trim().replace(/^["“]|["”]$/g, '')
  return { line: line || (lang === 'en' ? 'You cannot beat me!' : 'Ngươi không thể thắng ta đâu!') }
}

// ---------------------------------------------------------------------------
// Entry point — dispatch theo action, gọi từ api/groq-proxy.js
// ---------------------------------------------------------------------------
export async function runArcadeSpriteGenerate({ action, description, villainDescription, kind, situation, lang, envSource }) {
  try {
    if (action === 'sprite' || action === 'scene') {
      return await generateSpriteImage({ description, kind: action === 'scene' ? 'scene' : 'sprite', villainDescription })
    }
    if (action === 'taunt') {
      return await generateVillainTaunt({ villainDescription, situation, lang, envSource })
    }
    throw new ArcadeSpriteError(`Unknown arcade-sprite action: ${action}`, 400)
  } catch (err) {
    if (err instanceof ArcadeSpriteError) throw err
    throw new ArcadeSpriteError(String(err?.message || err || 'Arcade sprite proxy error'), 500)
  }
}
