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
// KEY POOL / AUTO-ROTATION: nếu GEMINI_API_KEY đang dùng bị hết billing/
// quota, tự động thử GEMINI_API_KEY1, GEMINI_API_KEY2, ... (xem
// api/_lib/apiKeyPool.js) trước khi báo lỗi cho client — thay vì toàn bộ
// tính năng Vibe Check ngừng hoạt động ngay khi 1 key hết tiền.
//
// LƯU Ý: nếu chưa cấu hình bất kỳ GEMINI_API_KEY* nào trên Vercel, toàn
// bộ tính năng Vibe Check sẽ báo lỗi rõ ràng thay vì âm thầm thất bại —
// đây là tính năng DUY NHẤT trong Vibe Check, không có phần nào chạy free
// qua Groq như Vision Sync (nơi phần vibe/soundscape vẫn free, chỉ nhạc
// nền cần trả phí).

import { GoogleGenAI, Modality, HarmCategory, HarmBlockThreshold } from '@google/genai'
import { withApiKeyRotation, isRotatableApiError } from './apiKeyPool.js'

export class VibeCheckProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VibeCheckProxyError'
    this.status = status
  }
}

const timeoutMs = 55_000 // giới hạn thấp hơn bản gốc (193s) để không vượt quá timeout Serverless Function của Vercel
const maxRetriesPerKey = 2 // retry TRÊN CÙNG 1 KEY cho lỗi tạm thời (timeout/mạng) — lỗi hết hạn mức/billing thì rotate key ngay, không cần retry cùng key

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
  model,
  systemInstruction,
  prompt,
  promptImage,
  imageOutput,
  thinking,
  thinkingCapable,
  envSource,
}) {
  if (!model || !prompt) {
    throw new VibeCheckProxyError('Missing model or prompt', 400)
  }

  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (geminiApiKey) => {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey })

      // Retry nội bộ TRÊN CÙNG 1 KEY: chỉ dành cho lỗi tạm thời (timeout,
      // 5xx, mạng chập chờn) — nếu là lỗi "nên rotate" (401/402/429/hết
      // quota), ném thẳng ra ngoài để withApiKeyRotation() chuyển sang key
      // kế tiếp NGAY, không lãng phí thời gian retry lại key đã biết là hỏng.
      for (let attempt = 0; attempt < maxRetriesPerKey; attempt++) {
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
          if (isRotatableApiError(err)) throw err // để withApiKeyRotation() bắt và đổi key
          if (attempt === maxRetriesPerKey - 1) {
            if (err instanceof VibeCheckProxyError) throw err
            throw new VibeCheckProxyError(err?.message || 'Gemini generate error', 502)
          }
          await new Promise((res) => setTimeout(res, 1200 * 2 ** attempt))
        }
      }
      throw new VibeCheckProxyError('All retries failed', 502)
    }, { envSource })
  } catch (err) {
    if (err instanceof VibeCheckProxyError) throw err
    throw new VibeCheckProxyError(
      err?.message ||
        'GEMINI_API_KEY not configured. Vibe Check cần một API key Gemini thật (trả phí, lấy tại Google AI Studio) để so sánh các model Gemini thật — không có bản thay thế miễn phí tương đương. Thêm biến GEMINI_API_KEY (hoặc GEMINI_API_KEY1, GEMINI_API_KEY2, ... cho nhiều key) trong Vercel → Settings → Environment Variables.',
      err?.status || 501,
    )
  }
}
