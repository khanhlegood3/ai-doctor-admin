// api/_lib/vibeCheckProxy.js
// Backend cho tính năng "Vibe Check" (chuyển đổi từ vibecheck.zip, app AI
// Studio gốc gọi thẳng @google/genai + API key nhúng client bằng
// `process.env.GEMINI_API_KEY` — KHÔNG an toàn để deploy thật). DÙNG CHUNG
// endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// `provider: 'vibe-check'`) — không tạo Serverless Function mới vì Vercel
// giới hạn 12 functions (đã dùng hết).
//
// KHÁC với Vibe Tracking/Vision Sync (đổi hẳn sang Groq miễn phí): tính
// năng cốt lõi của Vibe Check là SO SÁNH nhiều phiên bản model Gemini thật
// (Flash-Lite/Flash/Pro, 2.5 vs 3, thinking on/off) và SINH ẢNH thật từ
// prompt — Groq (1 model text-only, miễn phí) không thể thay thế mà không
// phá vỡ hoàn toàn ý nghĩa "so sánh vibe giữa các model" của tính năng.
// Do đó nhánh này gọi THẲNG Gemini thật server-side bằng GEMINI_API_KEY
// (biến môi trường đã có sẵn — dùng chung với tính năng Lyria Realtime
// Music của Vision Sync, xem visionSyncProxy.js) — client KHÔNG BAO GIỜ
// thấy API key, chỉ gửi { model, systemInstruction, prompt, promptImage,
// imageOutput, thinking, thinkingCapable } lên server, server gọi Gemini
// và trả về kết quả (text hoặc base64 image) — giữ đúng logic gốc của
// src/lib/llm.ts nhưng chạy phía server thay vì client.
//
// LƯU Ý: nếu chưa cấu hình GEMINI_API_KEY (biến trả phí) trên Vercel, toàn
// bộ tính năng Vibe Check sẽ báo lỗi rõ ràng thay vì âm thầm thất bại —
// đây là tính năng DUY NHẤT trong Vibe Check, không có phần nào chạy free
// qua Groq như Vision Sync (nơi phần vibe/soundscape vẫn free, chỉ nhạc
// nền cần trả phí).

import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from '@google/genai'

export class VibeCheckProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VibeCheckProxyError'
    this.status = status
  }
}

const timeoutMs = 55_000 // giới hạn thấp hơn bản gốc (193s) để không vượt quá timeout Serverless Function của Vercel
const maxRetries = 2 // giảm so với bản gốc (5) vì đã có giới hạn thời gian request của Vercel

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

const safetySettings = [
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
  HarmCategory.HARM_CATEGORY_HARASSMENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_NONE }))

export async function runVibeCheckGenerate({
  geminiApiKey,
  model,
  systemInstruction,
  prompt,
  promptImage,
  imageOutput,
  thinking,
  thinkingCapable,
}) {
  if (!geminiApiKey) {
    throw new VibeCheckProxyError(
      'GEMINI_API_KEY not configured. Vibe Check cần một API key Gemini thật (trả phí, lấy tại Google AI Studio) để so sánh các model Gemini thật — không có bản thay thế miễn phí tương đương. Thêm biến GEMINI_API_KEY trong Vercel → Settings → Environment Variables.',
      501,
    )
  }
  if (!model || !prompt) {
    throw new VibeCheckProxyError('Missing model or prompt', 400)
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey })

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const modelPromise = ai.models.generateContent({
        model,
        config: {
          systemInstruction,
          safetySettings,
          ...(thinkingCapable && !thinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          ...(imageOutput ? { responseModalities: [Modality.TEXT, Modality.IMAGE] } : {}),
        },
        contents: [
          {
            parts: [
              ...(promptImage
                ? [{ inlineData: { data: promptImage.split(',')[1], mimeType: 'image/png' } }]
                : []),
              { text: prompt },
            ],
          },
        ],
      })

      const response = await withTimeout(modelPromise, timeoutMs)

      if (imageOutput) {
        const data = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data
        if (!data) throw new VibeCheckProxyError('No image data found', 502)
        return { result: 'data:image/png;base64,' + data }
      }

      if (!response.text) throw new VibeCheckProxyError('No text data found', 502)
      return { result: response.text }
    } catch (err) {
      if (attempt === maxRetries - 1) {
        if (err instanceof VibeCheckProxyError) throw err
        throw new VibeCheckProxyError(err?.message || 'Gemini generate error', 502)
      }
      await new Promise((res) => setTimeout(res, 1200 * 2 ** attempt))
    }
  }
  throw new VibeCheckProxyError('All retries failed', 502)
}
