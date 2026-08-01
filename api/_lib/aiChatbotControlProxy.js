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
//
// KEY POOL / AUTO-ROTATION: nếu GEMINI_API_KEY đang dùng bị hết billing/
// quota (đây là nguyên nhân phổ biến nhất gây lỗi 429 dưới đây), tự động
// thử GEMINI_API_KEY1, GEMINI_API_KEY2, ... (xem api/_lib/apiKeyPool.js)
// trước khi báo lỗi "hết lượt gọi" cho người dùng.

import { GoogleGenAI } from '@google/genai'
import { withApiKeyRotation, isRotatableApiError } from './apiKeyPool.js'

export class AiChatbotControlProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'AiChatbotControlProxyError'
    this.status = status
  }
}

const timeoutMs = 25_000
const maxRetriesPerKey = 3

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash'

export async function runAiChatbotControlGenerate({
  prompt,
  systemInstruction,
  envSource,
}) {
  if (!prompt) {
    throw new AiChatbotControlProxyError('Missing prompt', 400)
  }

  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (geminiApiKey) => {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey })

      for (let attempt = 0; attempt < maxRetriesPerKey; attempt++) {
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
          // Lỗi hết hạn mức/billing → ném ra ngoài NGAY để withApiKeyRotation()
          // chuyển sang key kế tiếp trong pool, không retry lại key đã hỏng.
          if (isRotatableApiError(err)) throw err
          if (attempt === maxRetriesPerKey - 1) {
            if (err instanceof AiChatbotControlProxyError) throw err
            throw new AiChatbotControlProxyError(err?.message || 'Gemini generate error', 502)
          }
          await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
        }
      }
      throw new AiChatbotControlProxyError('All retries failed', 502)
    }, { envSource })
  } catch (err) {
    if (err instanceof AiChatbotControlProxyError) throw err
    // Sau khi ĐÃ thử hết toàn bộ pool key mà vẫn lỗi hết hạn mức, hoặc chưa
    // cấu hình key nào — trả thông báo dễ hiểu cho client.
    const status = err?.status || 501
    const message =
      status === 501
        ? 'GEMINI_API_KEY not configured. Thêm biến GEMINI_API_KEY (hoặc GEMINI_API_KEY1, GEMINI_API_KEY2, ... cho nhiều key, không có tiền tố VITE_) trong Vercel → Settings → Environment Variables, lấy key miễn phí tại https://aistudio.google.com/apikey.'
        : status === 429
          ? 'Gemini API miễn phí đã hết lượt gọi trong ngày hôm nay ở tất cả các key đã cấu hình. Vui lòng thử lại sau hoặc thêm key dự phòng (GEMINI_API_KEY1, GEMINI_API_KEY2, ...).'
          : err?.message || 'Gemini generate error'
    throw new AiChatbotControlProxyError(message, status)
  }
}
