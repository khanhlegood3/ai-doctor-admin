// api/_lib/geminiComic.js
// Logic gọi Google Gemini (@google/genai) dùng chung cho tính năng "Tạo
// Game bằng Avatar của Tôi" (chuyển đổi từ infinite-heroes.zip).
// Được import bởi:
//   - api/groq-proxy.js → Vercel Serverless Function (production), nhánh
//     provider: 'gemini-comic' (dùng chung endpoint với Groq để không vượt
//     quá giới hạn 12 Serverless Functions của Vercel).
//   - vite.config.js    → middleware dev-server, để `npm run dev`
//     cũng gọi Gemini thật, không cần deploy lên Vercel mới test được.

import { GoogleGenAI } from '@google/genai'

export class GeminiComicError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

export async function runGeminiComicGenerate({ apiKey, action = 'generateContent', model, contents, config }) {
  if (!apiKey) {
    throw new GeminiComicError('GEMINI_API_KEY not configured on server', 500)
  }
  if (!model || !contents) {
    throw new GeminiComicError('Missing "model" or "contents" in request body', 400)
  }
  if (action !== 'generateContent') {
    throw new GeminiComicError(`Unsupported action: ${action}`, 400)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const result = await ai.models.generateContent({ model, contents, config })

    return {
      text: (() => { try { return result.text || '' } catch { return '' } })(),
      candidates: (result.candidates || []).map((c) => ({
        content: {
          parts: (c?.content?.parts || []).map((p) => ({
            text: p.text,
            inlineData: p.inlineData ? { mimeType: p.inlineData.mimeType, data: p.inlineData.data } : undefined,
          })),
        },
      })),
    }
  } catch (err) {
    const message = String(err?.message || err || 'Gemini proxy error')
    const isAuthError = /API_KEY_INVALID|permission denied|not found/i.test(message)
    throw new GeminiComicError(message, isAuthError ? 401 : 500)
  }
}
