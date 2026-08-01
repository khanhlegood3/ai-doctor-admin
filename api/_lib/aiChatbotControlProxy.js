// api/_lib/aiChatbotControlProxy.js
// Backend cho panel "AI chatbot control" (chuyển đổi từ chatterbots.zip —
// app gốc gọi thẳng Gemini Live API kèm API key nhúng client, KHÔNG an
// toàn). DÙNG CHUNG endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// `provider: 'ai-chatbot-control'`) — không tạo Serverless Function mới vì
// Vercel giới hạn 12 functions (đã dùng hết, xem api/groq-proxy.js).
//
// Thay vì Gemini Live API (audio streaming 2 chiều, trả phí/giới hạn quota
// riêng), panel này chỉ cần sinh REPLY DẠNG TEXT — giọng nói vào/ra vẫn
// chạy hoàn toàn miễn phí ở trình duyệt (Web SpeechRecognition +
// SpeechSynthesis, xem src/components/aiChatbotControl/hooks/useVoiceCompanion.js).
// Model dùng `gemini-2.5-flash` qua @google/genai SDK — model chuẩn (không
// phải preview date-stamped) đã được xác nhận hoạt động với SDK này ở tính
// năng Vibe Check (xem src/vibe-check-khanh/src/lib/models.ts). LƯU Ý: model
// `gemini-2.5-flash-preview-09-2025` dùng ở AffiliateSystemControlPanel.jsx
// chỉ hoạt động qua REST fetch thẳng, KHÔNG dùng được với
// `ai.models.generateContent()` của SDK — dùng nhầm model đó từng gây lỗi
// 502 (Gemini trả lỗi cho model không hợp lệ, proxy bắt được và trả 502).
// Gọi từ SERVER thay vì client, dùng chung biến GEMINI_API_KEY (không có tiền tố
// VITE_, nên KHÔNG bao giờ lọt vào bundle trình duyệt) — biến này đã có sẵn
// trong project, dùng chung với Vibe Check / Vision Sync Live Music.

import { GoogleGenAI } from '@google/genai'

export class AiChatbotControlProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'AiChatbotControlProxyError'
    this.status = status
  }
}

const timeoutMs = 25_000
const maxRetries = 3

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash'

export async function runAiChatbotControlGenerate({
  geminiApiKey,
  prompt,
  systemInstruction,
}) {
  if (!geminiApiKey) {
    throw new AiChatbotControlProxyError(
      'GEMINI_API_KEY not configured. Thêm biến GEMINI_API_KEY (không có tiền tố VITE_) trong Vercel → Settings → Environment Variables, lấy key miễn phí tại https://aistudio.google.com/apikey.',
      501,
    )
  }
  if (!prompt) {
    throw new AiChatbotControlProxyError('Missing prompt', 400)
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey })

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const modelPromise = ai.models.generateContent({
        model: DEFAULT_TEXT_MODEL,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      })

      const response = await withTimeout(modelPromise, timeoutMs)
      const text = response.text
      if (!text) throw new AiChatbotControlProxyError('No text data found', 502)
      return { result: text }
    } catch (err) {
      const isRateLimited = /429|RESOURCE_EXHAUSTED/i.test(err?.message || '')
      if (attempt === maxRetries - 1) {
        if (err instanceof AiChatbotControlProxyError) throw err
        throw new AiChatbotControlProxyError(
          isRateLimited
            ? 'Gemini API miễn phí đã hết lượt gọi trong ngày hôm nay. Vui lòng thử lại sau.'
            : err?.message || 'Gemini generate error',
          isRateLimited ? 429 : 502,
        )
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt))
    }
  }
  throw new AiChatbotControlProxyError('All retries failed', 502)
}
