// api/_lib/chessChatProxy.js
// Backend cho game "Chess Chat" (public/games/chess-chat/, build từ project
// Google AI Studio riêng — xem README của project đó). Bản gốc gọi thẳng
// @google/genai với API key nhúng CỨNG vào bundle client
// (process.env.API_KEY/GEMINI_API_KEY qua `define` trong vite.config.ts) —
// KHÔNG an toàn: bất kỳ ai mở DevTools/View Source đều lấy được key thật để
// dùng trên tài khoản Google AI Studio của chủ dự án. DÙNG CHUNG endpoint
// /api/groq-proxy (field `provider: 'chess-chat'`) — không tạo Serverless
// Function mới vì Vercel giới hạn 12 functions (xem api/groq-proxy.js).
//
// Ba nhánh, đúng 3 chỗ Chess Chat gốc gọi thẳng Gemini phía client:
//   1. `liveToken` — phiên chat thoại thời gian thực với quân cờ (Live API,
//      WebSocket, model gemini-2.5-flash-native-audio-preview-12-2025).
//      CHỈ nhánh Live API mới hỗ trợ EPHEMERAL TOKEN (ai.authTokens.create())
//      — đúng khuyến nghị bảo mật chính thức của Google cho kết nối Live API
//      client-to-server (xem
//      https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens).
//      Token sống ngắn hạn (mặc định 30 phút, dùng 1 lần), CHỈ dùng được cho
//      Live API — không phải API key đầy đủ. Giống hệt pattern đã dùng cho
//      Vision Sync (xem visionSyncProxy.js::createVisionSyncLiveToken).
//   2. `pieceImage` — sinh chân dung quân cờ (model gemini-2.5-flash-image,
//      REST models.generateContent, KHÔNG phải Live API). Ephemeral token
//      KHÔNG áp dụng được cho nhánh này (chỉ Live API mới hỗ trợ) — nên proxy
//      toàn bộ qua backend: client gửi prompt, server gọi Gemini bằng key
//      thật, chỉ trả về ảnh base64 — key không bao giờ rời server.
//   3. `strategist` — "Cố vấn Chiến thuật" phân tích thế cờ (model
//      gemini-2.5-flash, REST models.generateContent, nhận text + optional
//      ảnh bàn cờ dạng inlineData) — cùng lý do như (2), proxy toàn bộ qua
//      backend.
//
// KEY POOL / AUTO-ROTATION: cả 3 nhánh đều gọi qua withApiKeyRotation() (xem
// api/_lib/apiKeyPool.js), dùng chung GEMINI_API_KEY*/pool với Vision Sync và
// Bring Any Idea to Life — nếu key đang dùng hết hạn mức/billing, tự động
// thử key kế tiếp thay vì quăng lỗi ngay cho client.

import { GoogleGenAI, Modality } from '@google/genai'
import { withApiKeyRotation } from './apiKeyPool.js'

const MISSING_KEY_MESSAGE =
  'GEMINI_API_KEY not configured. Chess Chat cần 1 Gemini API key thật (trả phí hoặc free-tier) từ Google AI Studio — thêm trong Vercel → Settings → Environment Variables là GEMINI_API_KEY (hoặc GEMINI_API_KEY1, GEMINI_API_KEY2, ... cho nhiều key), lấy tại https://aistudio.google.com/apikey.'

export class ChessChatProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ChessChatProxyError'
    this.status = status
  }
}

function wrapError(err) {
  if (err instanceof ChessChatProxyError) return err
  const status = err?.status === 501 ? 501 : err?.status || 500
  const message = err?.status === 501 ? MISSING_KEY_MESSAGE : err?.message || 'Chess Chat proxy error'
  return new ChessChatProxyError(message, status)
}

// --- 1. Ephemeral token cho phiên voice chat Live API ---------------------
export async function createChessChatLiveToken({ envSource } = {}) {
  try {
    const token = await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey, apiVersion: 'v1alpha' })
      const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
      const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString()

      const result = await ai.authTokens.create({
        config: {
          uses: 1,
          expireTime,
          newSessionExpireTime,
          httpOptions: { apiVersion: 'v1alpha' },
        },
      })
      if (!result?.name) {
        const err = new Error('Gemini returned no token.')
        err.status = 500
        throw err
      }
      return result.name
    }, { envSource })

    return { token }
  } catch (err) {
    throw wrapError(err)
  }
}

// --- 2. Sinh chân dung quân cờ (REST, proxy toàn bộ) -----------------------
export async function runChessChatPieceImage({ prompt, envSource } = {}) {
  if (typeof prompt !== 'string' || !prompt.trim()) {
    throw new ChessChatProxyError('Missing prompt', 400)
  }

  try {
    const base64ImageBytes = await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
      })

      const parts = response?.candidates?.[0]?.content?.parts || []
      const imagePart = parts.find((p) => p?.inlineData?.data)
      if (!imagePart) {
        const err = new Error('No image data found in the Gemini response.')
        err.status = 500
        throw err
      }
      return imagePart.inlineData.data
    }, { envSource })

    return { base64ImageBytes }
  } catch (err) {
    throw wrapError(err)
  }
}

// --- 3. Cố vấn chiến thuật (REST, text + optional ảnh, proxy toàn bộ) ------
export async function runChessChatStrategist({ parts, envSource } = {}) {
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new ChessChatProxyError('Missing parts', 400)
  }
  // Chỉ nhận 2 dạng part hợp lệ (text hoặc inlineData ảnh JPEG bàn cờ) — chặn
  // sớm payload lạ thay vì chuyển thẳng cho Gemini.
  const safeParts = parts
    .map((p) => {
      if (typeof p?.text === 'string') return { text: p.text }
      if (p?.inlineData?.data && typeof p.inlineData.data === 'string') {
        return { inlineData: { mimeType: p.inlineData.mimeType || 'image/jpeg', data: p.inlineData.data } }
      }
      return null
    })
    .filter(Boolean)
  if (safeParts.length === 0) {
    throw new ChessChatProxyError('No valid parts', 400)
  }

  try {
    const text = await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const ai = new GoogleGenAI({ apiKey })
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: safeParts },
      })
      return response?.text || ''
    }, { envSource })

    return { text }
  } catch (err) {
    throw wrapError(err)
  }
}
