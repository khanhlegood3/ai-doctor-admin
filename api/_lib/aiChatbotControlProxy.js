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
// Model dùng `gemini-3.1-flash-lite` qua @google/genai SDK — model stable
// mới hơn, low-latency/cost-effective cho các tác vụ chat text nhẹ. Trước đây
// dùng `gemini-2.5-flash`, nhưng Google có thể trả 404 cho user/API key mới
// ("This model models/gemini-2.5-flash is no longer available to new users"),
// khiến proxy biến thành 502 ở production.
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

const DEFAULT_TEXT_MODEL = 'gemini-3.1-flash-lite'

export async function runAiChatbotControlGenerate({
  prompt,
  systemInstruction,
  history,
  envSource,
}) {
  if (!prompt) {
    throw new AiChatbotControlProxyError('Missing prompt', 400)
  }

  // Lịch sử hội thoại (nếu có) → Gemini "contents" nhiều turn, role 'user'/'model'
  // (Gemini dùng 'model' thay vì 'assistant'). Giới hạn 20 tin nhắn gần nhất để
  // tránh prompt phình quá to — đủ ngữ cảnh cho hội thoại thoại tự nhiên.
  const historyContents = Array.isArray(history)
    ? history
        .filter((m) => m && typeof m.text === 'string' && m.text.trim())
        .slice(-20)
        .map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.text }],
        }))
    : []

  const contents = [...historyContents, { role: 'user', parts: [{ text: prompt }] }]

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
            contents,
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
