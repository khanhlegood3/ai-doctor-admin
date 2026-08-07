// api/_lib/imageToCodeProxy.js
// Backend cho tính năng "Image to Code" (chuyển đổi từ image-to-code.zip,
// app AI Studio gốc — client tự gọi thẳng @google/genai bằng
// process.env.GEMINI_API_KEY nhúng trong bundle, KHÔNG an toàn để deploy
// thật). DÙNG CHUNG endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// provider: 'image-to-code') — không tạo Serverless Function mới vì Vercel
// giới hạn 12 functions (đã dùng hết, xem vercel.json).
//
// TÍNH NĂNG GỐC (image-to-code.zip/Home.tsx): người dùng upload 1 ảnh, AI
// "nhìn" ảnh rồi viết 1 sketch p5.js sáng tạo, có tương tác (mouse), lấy
// cảm hứng từ hành vi/đặc điểm của vật thể trong ảnh (vd ảnh chim -> thuật
// toán boids bay theo chuột, ảnh cây -> cây fractal mọc theo chuột...).
// System prompt bên dưới giữ lại gần như nguyên vẹn phần "PROCESS"/"EXAMPLES"
// của bản gốc, chỉ đổi định dạng output.
//
// TÍCH HỢP VÀO "Video to Learning": module này được gắn vào làm 1 loại item
// MỚI (type: 'image') trong hàng đợi của video-to-learning-khanh, dùng
// chung layout render/code/spec/history đã có sẵn ở đó (xem App.tsx +
// lib/imageToCode.ts). Vì tab "Xem trước" của video-to-learning render
// thẳng `code` vào <iframe srcDoc>, output ở đây PHẢI là 1 trang HTML hoàn
// chỉnh (khác bản gốc AI Studio chỉ sinh 1 đoạn JS thuần chạy trong sẵn 1
// canvas p5 dựng sẵn bởi CodePreview.jsx) — nên prompt yêu cầu model bọc
// sẵn sketch vào 1 file HTML tự chứa (nhúng p5.js qua CDN), thay vì chỉ trả
// về đoạn JS như bản gốc.
//
// KIẾN TRÚC FALLBACK: giống hệt bringAnyIdeaToLifeProxy.js — Groq vision
// (qwen, MIỄN PHÍ) thử trước, Gemini Flash dự phòng khi Groq lỗi ở mọi key.

import { withApiKeyRotation, isRotatableApiError, toRotatableHttpError, countApiKeyPool } from './apiKeyPool.js'
import { GoogleGenAI } from '@google/genai'

export class ImageToCodeProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ImageToCodeProxyError'
    this.status = status
  }
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b' // model vision MIỄN PHÍ hiện hành của Groq (giống bringAnyIdeaToLifeProxy.js)
const GEMINI_MODEL = 'gemini-3.6-flash' // model Flash còn free tier thật, dùng làm dự phòng khi Groq lỗi
const timeoutMs = 55_000 // thấp hơn maxDuration 120s của api/groq-proxy.js (xem vercel.json)
const maxRetriesPerKey = 2
const GROQ_MAX_TOKENS = 6000

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

// Giữ lại gần như nguyên vẹn "PROCESS"/"EXAMPLES" của prompt gốc trong
// image-to-code.zip/Home.tsx — chỉ đổi phần OUTPUT để trả về 1 trang HTML
// tự chứa (nhúng p5.js qua CDN) thay vì chỉ 1 đoạn JS thuần, cho khớp với
// cách video-to-learning render `code` (đưa thẳng vào <iframe srcDoc>).
const SYSTEM_INSTRUCTION = `You are a creative coding expert who turns images into clever code sketches using p5.js. A user uploads an image and you generate an interactive p5.js sketch that represents the image. The sketch always has some sort of interactive element that connects to the nature of the object in the real world.

## EXAMPLES
Here are examples of how a type of image could be turned into a clever creative coding sketch that captures the essence of the image:
- A photo of birds --> a boids flocking algorithm sketch where the boids follow your mouse
- A photo of a tree --> a recursive fractal tree that grows as you move your mouse up and down
- A photo of a pond --> a sketch that has a ripple animation on mouse click
- A photo of a wristwatch --> a beautiful functioning clock that accesses system time and displays it like the wristwatch
- A photo of a lamp --> a sketch of the lamp, but when you click the screen the lamp turns on and off
- A photo of a zipper --> a sketch representing the shapes of the zipper, and when you move your mouse up and down the zipper opens and closes like a real zipper

## PROCESS
Reflect and meditate on the nature of the object BEFORE picking an algorithmic approach. You are thoughtful, clever, delightful, and playful.
1. Describe the behavioral properties of the image: how it behaves or moves in the real world, and the colors/vibe of the image.
2. Given those behavioral properties, pick a creative coding algorithm that pairs with the image to make a delightful p5.js sketch.
3. State the rough composition/bounding boxes of the important parts of the photo, so the sketch's layout echoes the composition of the photo.
Write steps 1-3 as short prose notes BEFORE the code (a few sentences total, in Vietnamese).

## OUTPUT
After the notes, output ONE complete, self-contained HTML document fenced between \`\`\`html and \`\`\`:
- Load p5.js via <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script> in <head>.
- Use createCanvas(windowWidth, windowHeight) and a windowResized() handler so the sketch always fills the page.
- Implement the algorithm from step 2, using mouseMoved()/mouseClicked()/mousePressed() to make it interactive per the object's real-world behavior.
- Do NOT load any external images or other libraries. Everything must be self-contained (inline <style> + <script> only), drawn with p5.js primitives/shapes/colors inspired by the photo.
- Leave clear comments describing each part of the sketch. Don't be too verbose.
- This must be the ONLY code block in your response.`

function extractSpecAndCode(rawText) {
  const text = (rawText || '').replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '')
  const fenceRegex = /```(?:html)?\s*([\s\S]*?)```/i
  const match = fenceRegex.exec(text)
  if (!match) {
    // Không tìm thấy fence: coi cả phản hồi là "spec", không có code khả dụng.
    return { spec: text.trim(), code: '' }
  }
  const spec = text.slice(0, match.index).trim()
  let code = match[1].trim()
  if (!/^<!DOCTYPE html>/i.test(code) && !/^<html/i.test(code)) {
    // Phòng trường hợp model chỉ trả JS thuần (giống bản gốc AI Studio) thay
    // vì cả trang HTML như system prompt yêu cầu -> tự bọc lại thành 1 trang
    // HTML tự chứa với p5.js CDN, để vẫn render được trong <iframe srcDoc>.
    code = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8" />
<title>Image to Code Sketch</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js"></script>
<style>html,body{margin:0;padding:0;overflow:hidden;background:#0f172a;}</style>
</head>
<body>
<script>
${code}
</script>
</body>
</html>`
  }
  return { spec, code }
}

// --- Groq (vision, miễn phí, ưu tiên gọi trước) ---
async function callGroqVision({ prompt, imageBase64, mimeType, envSource }) {
  const content = [{ type: 'text', text: prompt }]
  if (imageBase64 && mimeType) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } })
  }

  const body = {
    model: GROQ_VISION_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content },
    ],
    temperature: 0.8,
    max_tokens: GROQ_MAX_TOKENS,
    reasoning_format: 'hidden', // qwen3.x: ẩn <think>, dồn token cho phần notes + code thật
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
async function callGemini({ prompt, imageBase64, mimeType, envSource }) {
  return await withApiKeyRotation('GEMINI_API_KEY', async (geminiApiKey) => {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const parts = [{ text: prompt }]
    if (imageBase64 && mimeType) {
      parts.push({ inlineData: { data: imageBase64, mimeType } })
    }

    for (let attempt = 0; attempt < maxRetriesPerKey; attempt++) {
      try {
        const modelPromise = ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: { parts },
          config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.8 },
        })
        const response = await withTimeout(modelPromise, timeoutMs)
        const text = response.text || ''
        if (!text) throw new ImageToCodeProxyError('Không có nội dung trả về từ Gemini.', 502)
        return text
      } catch (err) {
        if (isRotatableApiError(err)) throw err
        if (attempt === maxRetriesPerKey - 1) {
          if (err instanceof ImageToCodeProxyError) throw err
          if (err?.message === 'timeout') {
            throw new ImageToCodeProxyError(`Gemini xử lý ảnh quá lâu (vượt quá ${Math.round(timeoutMs / 1000)} giây).`, 504)
          }
          throw new ImageToCodeProxyError(err?.message || 'Gemini generate error', 502)
        }
        await new Promise((res) => setTimeout(res, 1200 * 2 ** attempt))
      }
    }
    throw new ImageToCodeProxyError('All retries failed', 502)
  }, { envSource })
}

// --- Điều phối Groq (mặc định, miễn phí) ↔ Gemini (fallback tự động) ---
export async function runImageToCodeGenerate({ imageBase64, mimeType, userInput, envSource }) {
  if (!imageBase64 || !mimeType) throw new ImageToCodeProxyError('Missing imageBase64/mimeType', 400)

  const hasGroq = countApiKeyPool('GROQ_API_KEY', { envSource }) > 0
  const hasGemini = countApiKeyPool('GEMINI_API_KEY', { envSource }) > 0

  if (!hasGroq && !hasGemini) {
    throw new ImageToCodeProxyError(
      'Chưa cấu hình GROQ_API_KEY lẫn GEMINI_API_KEY (hoặc các biến *_API_KEY1, *_API_KEY2, ...) trên server. Thêm ít nhất một trong hai trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }

  const prompt = userInput?.trim()
    ? `Tạo sketch cho ảnh đính kèm. Yêu cầu thêm từ người dùng: ${userInput.trim()}`
    : 'Tạo sketch cho ảnh đính kèm.'

  if (hasGroq) {
    try {
      const raw = await callGroqVision({ prompt, imageBase64, mimeType, envSource })
      const { spec, code } = extractSpecAndCode(raw)
      if (code) return { spec, code, source: 'groq' }
    } catch (err) {
      console.warn('[image-to-code] Groq failed on all keys, falling back to Gemini:', err?.message || err)
    }
  }

  if (!hasGemini) {
    throw new ImageToCodeProxyError(
      'Groq gặp sự cố ở tất cả các key (hoặc chưa cấu hình) và chưa có GEMINI_API_KEY để dự phòng. Thêm biến GROQ_API_KEY (miễn phí, lấy tại console.groq.com) hoặc GEMINI_API_KEY trong Vercel → Settings → Environment Variables.',
      502,
    )
  }

  const raw = await callGemini({ prompt, imageBase64, mimeType, envSource })
  const { spec, code } = extractSpecAndCode(raw)
  if (!code) throw new ImageToCodeProxyError('Không trích xuất được code từ phản hồi AI.', 502)
  return { spec, code, source: 'gemini-fallback' }
}
