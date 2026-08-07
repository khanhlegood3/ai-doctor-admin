// api/_lib/bringAnyIdeaToLifeProxy.js
// Backend cho tính năng "Bring Any Idea to Life" (chuyển đổi từ
// bring-any-idea-to-life.zip, app AI Studio gốc gọi thẳng @google/genai +
// API key nhúng client bằng process.env.API_KEY — KHÔNG an toàn để deploy
// thật). DÙNG CHUNG endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// provider: 'bring-any-idea-to-life') — không tạo Serverless Function mới
// vì Vercel giới hạn 12 functions (đã dùng hết).
//
// TÍNH NĂNG: người dùng upload 1 ảnh/PDF (bản vẽ tay, sơ đồ, ảnh vật thể đời
// thường...), Gemini 3 Pro (đủ mạnh cho coding phức tạp) "nhìn" ảnh rồi sinh
// ra 1 trang HTML/CSS/JS độc lập, tương tác được — y hệt logic gốc của
// services/gemini.ts (system instruction giữ nguyên), chỉ chuyển sang chạy
// server-side bằng GEMINI_API_KEY (biến môi trường, dùng chung pool với
// Vibe Check/Video to Learning...) — client KHÔNG BAO GIỜ thấy API key.
//
// KEY POOL / AUTO-ROTATION: nếu GEMINI_API_KEY đang dùng bị hết billing/
// quota, tự động thử GEMINI_API_KEY1, GEMINI_API_KEY2, ... (xem
// api/_lib/apiKeyPool.js) trước khi báo lỗi cho client.

import { GoogleGenAI } from '@google/genai'
import { withApiKeyRotation, isRotatableApiError } from './apiKeyPool.js'

export class BringAnyIdeaToLifeProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'BringAnyIdeaToLifeProxyError'
    this.status = status
  }
}

// Model Flash mới nhất còn free tier vẫn không đủ tin cậy cho việc sinh cả
// 1 trang HTML/JS hoàn chỉnh từ ảnh — giữ nguyên model Pro như bản gốc.
const GEMINI_MODEL = 'gemini-3-pro-preview'
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

export async function runBringAnyIdeaToLifeGenerate({ prompt, fileBase64, mimeType, envSource }) {
  if (!prompt) throw new BringAnyIdeaToLifeProxyError('Missing prompt', 400)

  try {
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
              temperature: 0.5, // temperature cao hơn cho sáng tạo với input đời thường
            },
          })

          const response = await withTimeout(modelPromise, timeoutMs)

          let html = response.text || ''
          if (!html) throw new BringAnyIdeaToLifeProxyError('Không có nội dung trả về từ Gemini.', 502)

          // Dọn markdown fence nếu model vẫn lỡ bọc bất chấp system instruction.
          html = html.replace(/^```html\s*/, '').replace(/^```\s*/, '').replace(/```$/, '')

          return { html }
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
  } catch (err) {
    if (err instanceof BringAnyIdeaToLifeProxyError) throw err
    throw new BringAnyIdeaToLifeProxyError(
      err?.message ||
        'Chưa cấu hình GEMINI_API_KEY. Bring Any Idea to Life cần Gemini 3 Pro thật (trả phí, lấy tại Google AI Studio) để phân tích ảnh và sinh code — không có bản thay thế miễn phí tương đương. Thêm biến GEMINI_API_KEY (hoặc GEMINI_API_KEY1, GEMINI_API_KEY2, ... cho nhiều key) trong Vercel → Settings → Environment Variables.',
      err?.status || 501,
    )
  }
}
