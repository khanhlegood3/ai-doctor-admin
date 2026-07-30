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

import { GoogleGenAI } from '@google/genai'

export class VisionSyncProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VisionSyncProxyError'
    this.status = status
  }
}

export async function runVisionSyncVibe({ groqApiKey, objects, emotion }) {
  if (!groqApiKey) {
    throw new VisionSyncProxyError(
      'GROQ_API_KEY not configured. Get a free key at https://console.groq.com and add it in Vercel → Settings → Environment Variables.',
      500,
    )
  }

  const objectList = Array.isArray(objects) && objects.length ? objects.join(', ') : 'none'
  const safeEmotion = typeof emotion === 'string' && emotion ? emotion : 'neutral'
  const prompt = `You are a soundscape generator. Based on the following scene, output ONLY a 3-5 word ambient soundscape description (e.g., "tribal rhythmic drone", "cyberpunk electronic drone" or "melancholy acoustic ambient"). Do not include any other text, quotes, or punctuation. Never output "pop", "upbeat", or "energetic". Everything must be ambient, but based on the expression. Scene: a person is feeling ${safeEmotion} and the following objects are visible: ${objectList}.`

  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 20,
      temperature: 0.9,
    }),
  })

  const data = await upstream.json().catch(() => ({}))
  if (!upstream.ok) {
    throw new VisionSyncProxyError(data?.error?.message || `Groq error (${upstream.status})`, upstream.status)
  }

  const text = data?.choices?.[0]?.message?.content?.trim()?.replace(/^["'.]+|["'.]+$/g, '')
  return { text: text || 'ambient drone, relaxing' }
}

export async function createVisionSyncLiveToken({ geminiApiKey }) {
  if (!geminiApiKey) {
    throw new VisionSyncProxyError(
      'GEMINI_API_KEY not configured. Lyria realtime music needs a real (paid) Gemini API key from Google AI Studio — add it in Vercel → Settings → Environment Variables as GEMINI_API_KEY. (The vibe/soundscape text feature above already works without this, via Groq.)',
      501,
    )
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey, apiVersion: 'v1alpha' })
  const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString()
  const newSessionExpireTime = new Date(Date.now() + 60 * 1000).toISOString()

  try {
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        httpOptions: { apiVersion: 'v1alpha' },
      },
    })
    if (!token?.name) {
      throw new VisionSyncProxyError('Gemini returned no token.', 500)
    }
    return { token: token.name }
  } catch (err) {
    if (err instanceof VisionSyncProxyError) throw err
    throw new VisionSyncProxyError(err?.message || 'Failed to create Gemini ephemeral token', 500)
  }
}
