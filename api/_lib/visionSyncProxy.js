// api/_lib/visionSyncProxy.js
// Backend cho tính năng "Vision Sync" (chuyển đổi từ vision-sync.zip, app AI
// Studio gốc gọi thẳng @google/genai + API key nhúng client — KHÔNG an toàn).
// DÙNG CHUNG endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// `provider: 'vision-sync'`) — không tạo Serverless Function mới vì Vercel
// giới hạn 12 functions (đã dùng hết, xem api/groq-proxy.js).
//
// Hai nhánh:
//   1. `vibe` — mô tả "soundscape" 3-5 từ dựa trên vật thể/biểu cảm nhận
//      diện được. Bản gốc gọi model Gemini (gemini-flash-lite-latest).
//      Ở đây đổi sang GROQ (đã có GROQ_API_KEY, miễn phí) — giữ đúng tinh
//      thần "$0, không cần key Gemini trả phí" như Pet Passport/Comic Hero
//      đã áp dụng trước đó.
//   2. `liveToken` — Lyria Realtime Music (ai.live.music.connect) là tính
//      năng ĐỘC QUYỀN của Gemini, không có thay thế miễn phí tương đương
//      (Groq/Pollinations không sinh audio realtime). Nhánh này CẦN
//      GEMINI_API_KEY thật (trả phí, lấy tại Google AI Studio). Thay vì trả
//      thẳng API key thật về client, server tạo EPHEMERAL TOKEN dùng
//      ai.authTokens.create() (đúng khuyến nghị bảo mật chính thức của
//      Google cho kết nối Live API client-to-server — xem
//      https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens).
//      Token này sống ngắn hạn (mặc định 30 phút, dùng 1 lần) và CHỈ dùng
//      được cho Live API — không phải API key đầy đủ.
//
// KEY POOL / AUTO-ROTATION: cả 2 nhánh đều gọi qua withApiKeyRotation() (xem
// api/_lib/apiKeyPool.js) — nếu key đang dùng bị hết hạn mức/billing, tự
// động thử key kế tiếp trong GROQ_API_KEY*/GEMINI_API_KEY* pool thay vì
// quăng lỗi ngay cho client.

import { GoogleGenAI } from '@google/genai'
import { withApiKeyRotation, toRotatableHttpError } from './apiKeyPool.js'

export class VisionSyncProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VisionSyncProxyError'
    this.status = status
  }
}

export async function runVisionSyncVibe({ objects, emotion, envSource } = {}) {
  const objectList = Array.isArray(objects) && objects.length ? objects.join(', ') : 'none'
  const safeEmotion = typeof emotion === 'string' && emotion ? emotion : 'neutral'
  const prompt = `You are a soundscape generator. Based on the following scene, output ONLY a 3-5 word ambient soundscape description (e.g., "tribal rhythmic drone", "cyberpunk electronic drone" or "melancholy acoustic ambient"). Do not include any other text, quotes, or punctuation. Never output "pop", "upbeat", or "energetic". Everything must be ambient, but based on the expression. Scene: a person is feeling ${safeEmotion} and the following objects are visible: ${objectList}.`

  try {
    const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
      const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 20,
          temperature: 0.9,
        }),
      })
      if (!upstream.ok) throw await toRotatableHttpError(upstream, 'Groq')
      return upstream.json()
    }, { envSource })

    const text = data?.choices?.[0]?.message?.content?.trim()?.replace(/^["'.]+|["'.]+$/g, '')
    return { text: text || 'ambient drone, relaxing' }
  } catch (err) {
    if (err instanceof VisionSyncProxyError) throw err
    throw new VisionSyncProxyError(err?.message || 'Groq error', err?.status || 500)
  }
}

export async function createVisionSyncLiveToken({ envSource } = {}) {
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
    if (err instanceof VisionSyncProxyError) throw err
    const status = err?.status === 501
      ? 501
      : err?.status || 500
    const message = err?.status === 501
      ? 'GEMINI_API_KEY not configured. Lyria realtime music needs a real (paid) Gemini API key from Google AI Studio — add it in Vercel → Settings → Environment Variables as GEMINI_API_KEY (or GEMINI_API_KEY1, GEMINI_API_KEY2, ... for multiple keys). (The vibe/soundscape text feature above already works without this, via Groq.)'
      : (err?.message || 'Failed to create Gemini ephemeral token')
    throw new VisionSyncProxyError(message, status)
  }
}
