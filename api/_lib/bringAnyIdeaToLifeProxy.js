// api/_lib/bringAnyIdeaToLifeProxy.js
// Backend cho tính năng "Bring Any Idea to Life" (chuyển đổi từ
// bring-any-idea-to-life.zip, app AI Studio gốc gọi thẳng @google/genai +
// API key nhúng client bằng process.env.API_KEY — KHÔNG an toàn để deploy
// thật). DÙNG CHUNG endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// provider: 'bring-any-idea-to-life') — không tạo Serverless Function mới
// vì Vercel giới hạn 12 functions (đã dùng hết).
//
// TÍNH NĂNG: người dùng upload 1 ảnh/PDF (bản vẽ tay, sơ đồ, ảnh vật thể đời
// thường...), AI "nhìn" ảnh rồi sinh ra 1 trang HTML/CSS/JS độc lập, tương
// tác được — system instruction giữ nguyên y hệt bản gốc services/gemini.ts.
//
// KIẾN TRÚC FALLBACK TỰ ĐỘNG (Groq trước — MIỄN PHÍ, Gemini dự phòng — free
// tier nhưng giới hạn chặt/dễ hết quota, xem ghi chú bên dưới):
//   Bản đầu tiên của proxy này gọi thẳng Gemini 3 Pro (model trả phí) và bị
//   lỗi 429 "limit: 0" ngay cả khi có key — vì tài khoản Google AI Studio
//   miễn phí không được cấp quota cho model Pro (limit 0 trên free tier,
//   không phải do hết hạn mức mà do free tier vốn KHÔNG có quota cho model
//   này). Đổi sang dùng Groq trước (giống Video to Learning/Vibe Tracking):
//     - qwen/qwen3.6-27b: model multimodal (ảnh + text) MIỄN PHÍ của Groq,
//       hỗ trợ vision + sinh code tốt (agentic coding), thay cho
//       meta-llama/llama-4-scout-17b-16e-instruct đã bị Groq khai tử (xem
//       console.groq.com/docs/deprecations, thông báo 17/06/2026). Đây là
//       model vision hiện hành của Groq tại thời điểm viết code này — nếu
//       Groq lại đổi/khai tử model này trong tương lai, chỉ cần sửa hằng số
//       GROQ_VISION_MODEL bên dưới.
//   Nếu Groq lỗi ở TẤT CẢ các key (rate limit, model bị khai tử, outage...)
//   → tự động chuyển sang Gemini (dùng gemini-3.6-flash — bản Flash rẻ/free
//   tier thật, thay vì gemini-3-pro-preview — để tăng khả năng còn quota,
//   xem videoToLearningProxy.js dùng cùng model Flash này với lý do tương
//   tự) — chấp nhận chất lượng thấp hơn 1 chút ở nhánh dự phòng.
//
// KHÔNG chạy song song 2 bên cùng lúc — chỉ gọi Gemini khi Groq THỰC SỰ gặp
// sự cố, để tiết kiệm quota/tiền.

import { GoogleGenAI } from '@google/genai'
import { withApiKeyRotation, isRotatableApiError, toRotatableHttpError, countApiKeyPool } from './apiKeyPool.js'

export class BringAnyIdeaToLifeProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'BringAnyIdeaToLifeProxyError'
    this.status = status
  }
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b' // model vision MIỄN PHÍ hiện hành của Groq (xem ghi chú đầu file)
const GEMINI_MODEL = 'gemini-3.6-flash' // model Flash còn free tier thật, dùng làm dự phòng khi Groq lỗi
const timeoutMs = 55_000 // thấp hơn timeout Serverless Function của Vercel
const maxRetriesPerKey = 2 // retry TRÊN CÙNG 1 key cho lỗi tạm thời (timeout/mạng)

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

// Giữ nguyên y hệt system instruction gốc trong services/gemini.ts.
const SYSTEM_INSTRUCTION = `You are an expert AI Engineer and Product Designer specializing in "bringing artifacts to life".
Your goal is to take a user uploaded file—which might be a polished UI design, a messy napkin sketch, a photo of a whiteboard with jumbled notes, or a picture of a real-world object (like a messy desk)—and instantly generate a fully functional, interactive, single-page HTML/JS/CSS application.

CORE DIRECTIVES:
1. **Analyze & Abstract**: Look at the image.
    - **Sketches/Wireframes**: Detect buttons, inputs, and layout. Turn them into a modern, clean UI.
    - **Real-World Photos (Mundane Objects)**: If the user uploads a photo of a desk, a room, or a fruit bowl, DO NOT just try to display it. **Gamify it** or build a **Utility** around it.
      - *Cluttered Desk* -> Create a "Clean Up" game where clicking items (represented by emojis or SVG shapes) clears them, or a Trello-style board.
      - *Fruit Bowl* -> A nutrition tracker or a still-life painting app.
    - **Documents/Forms**: specific interactive wizards or dashboards.

2. **NO EXTERNAL IMAGES**:
    - **CRITICAL**: Do NOT use <img src="..."> with external URLs (like imgur, placeholder.com, or generic internet URLs). They will fail.
    - **INSTEAD**: Use **CSS shapes**, **inline SVGs**, **Emojis**, or **CSS gradients** to visually represent the elements you see in the input.
    - If you see a "coffee cup" in the input, render a ☕ emoji or draw a cup with CSS. Do not try to load a jpg of a coffee cup.

3. **Make it Interactive**: The output MUST NOT be static. It needs buttons, sliders, drag-and-drop, or dynamic visualizations.
4. **Self-Contained**: The output must be a single HTML file with embedded CSS (<style>) and JavaScript (<script>). No external dependencies unless absolutely necessary (Tailwind via CDN is allowed).
5. **Robust & Creative**: If the input is messy or ambiguous, generate a "best guess" creative interpretation. Never return an error. Build *something* fun and functional.

RESPONSE FORMAT:
Return ONLY the raw HTML code. Do not wrap it in markdown code blocks (\`\`\`html ... \`\`\`). Start immediately with <!DOCTYPE html>.`

// Bug đã gặp: qwen/qwen3.6-27b là reasoning model, mặc định trả về cả khối
// <think>...</think> TRƯỚC phần code thật. Hệ quả kép:
//   1. cleanHtml() trước đây chỉ dọn markdown fence, không dọn <think> — nên
//      toàn bộ nội dung suy luận (text thô, không phải HTML) bị nhét thẳng
//      vào iframe preview và hiển thị ra như text thường (không phải web app
//      thật) — đây là nguyên nhân của bug "chỉ ra text/JSON, không ra web
//      preview" và cũng là nguyên nhân bug màu chữ trùng nền trước đó.
//   2. Không set max_tokens → phần <think> (có thể rất dài) ngốn gần hết
//      ngân sách token, khiến HTML thật bị cắt cụt giữa chừng (thiếu
//      </style>, <body>, <script>...) trước khi kịp sinh xong.
// Fix: (a) reasoning_format: 'hidden' để Groq tự bỏ hẳn phần suy luận khỏi
// response (model vẫn "nghĩ" nhưng không trả về, theo docs Groq), dồn toàn
// bộ ngân sách token cho code thật; (b) đặt max_tokens đủ lớn cho 1 trang
// HTML/CSS/JS đầy đủ; (c) cleanHtml() vẫn dọn phòng hờ <think> nếu lỡ còn
// sót (ví dụ nhánh fallback Gemini, hoặc Groq đổi hành vi trong tương lai).
const GROQ_MAX_TOKENS = 8000

function cleanHtml(text) {
  let out = text || ''
  // Dọn hẳn khối <think>...</think> nếu model lỡ trả kèm (phòng hờ, xem ghi chú trên).
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '')
  // Phòng trường hợp bị cắt cụt giữa chừng khối <think> (không có thẻ đóng):
  // bỏ luôn từ <think> tới hết, vì phần sau đó (nếu có) không phải HTML thật.
  out = out.replace(/<think>[\s\S]*$/i, '')
  // Dọn markdown fence nếu model vẫn lỡ bọc bất chấp system instruction.
  out = out.replace(/^\s*```html\s*/i, '').replace(/^\s*```\s*/, '').replace(/```\s*$/, '')
  return out.trim()
}

// --- Groq (vision, miễn phí, ưu tiên gọi trước) ---
async function callGroqVision({ prompt, fileBase64, mimeType, envSource }) {
  const content = [{ type: 'text', text: prompt }]
  if (fileBase64 && mimeType) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } })
  }

  const body = {
    model: GROQ_VISION_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content },
    ],
    temperature: 0.5,
    max_tokens: GROQ_MAX_TOKENS,
    reasoning_format: 'hidden', // qwen3.x: ẩn hẳn <think>, dồn token cho code thật (xem ghi chú trên)
  }

  const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
    return res.json()
  }, { envSource })

  return data?.choices?.[0]?.message?.content || ''
}

// --- Gemini (multimodal, dự phòng khi Groq lỗi) ---
async function callGemini({ prompt, fileBase64, mimeType, envSource }) {
  return await withApiKeyRotation('GEMINI_API_KEY', async (geminiApiKey) => {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    const parts = [{ text: prompt }]
    if (fileBase64 && mimeType) {
      parts.push({ inlineData: { data: fileBase64, mimeType } })
    }

    for (let attempt = 0; attempt < maxRetriesPerKey; attempt++) {
      try {
        const modelPromise = ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.5,
          },
        })

        const response = await withTimeout(modelPromise, timeoutMs)

        const html = response.text || ''
        if (!html) throw new BringAnyIdeaToLifeProxyError('Không có nội dung trả về từ Gemini.', 502)
        return html
      } catch (err) {
        if (isRotatableApiError(err)) throw err // để withApiKeyRotation() bắt và đổi key
        if (attempt === maxRetriesPerKey - 1) {
          if (err instanceof BringAnyIdeaToLifeProxyError) throw err
          throw new BringAnyIdeaToLifeProxyError(err?.message || 'Gemini generate error', 502)
        }
        await new Promise((res) => setTimeout(res, 1200 * 2 ** attempt))
      }
    }
    throw new BringAnyIdeaToLifeProxyError('All retries failed', 502)
  }, { envSource })
}

// --- Điều phối Groq (mặc định, miễn phí) ↔ Gemini (fallback tự động) ---
export async function runBringAnyIdeaToLifeGenerate({ prompt, fileBase64, mimeType, envSource }) {
  if (!prompt) throw new BringAnyIdeaToLifeProxyError('Missing prompt', 400)

  const hasGroq = countApiKeyPool('GROQ_API_KEY', { envSource }) > 0
  const hasGemini = countApiKeyPool('GEMINI_API_KEY', { envSource }) > 0

  if (!hasGroq && !hasGemini) {
    throw new BringAnyIdeaToLifeProxyError(
      'Chưa cấu hình GROQ_API_KEY lẫn GEMINI_API_KEY (hoặc các biến *_API_KEY1, *_API_KEY2, ...) trên server. Thêm ít nhất một trong hai trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }

  if (hasGroq) {
    try {
      const html = cleanHtml(await callGroqVision({ prompt, fileBase64, mimeType, envSource }))
      if (html) return { html, source: 'groq' }
    } catch (err) {
      console.warn('[bring-any-idea-to-life] Groq failed on all keys, falling back to Gemini:', err?.message || err)
    }
  }

  if (!hasGemini) {
    throw new BringAnyIdeaToLifeProxyError(
      'Groq gặp sự cố ở tất cả các key (hoặc chưa cấu hình) và chưa có GEMINI_API_KEY để dự phòng. Thêm biến GROQ_API_KEY (miễn phí, lấy tại console.groq.com) hoặc GEMINI_API_KEY trong Vercel → Settings → Environment Variables.',
      502,
    )
  }

  const html = cleanHtml(await callGemini({ prompt, fileBase64, mimeType, envSource }))
  return { html, source: 'gemini-fallback' }
}
