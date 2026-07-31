/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// ĐÃ ĐỔI: bản gốc gọi thẳng @google/genai với API key nhúng client
// (process.env.GEMINI_API_KEY) — không an toàn để deploy thật. Ở đây gọi
// qua Serverless Function /api/groq-proxy (provider: 'vibe-check') — server
// dùng GEMINI_API_KEY thật (biến môi trường, không lộ ra client) để gọi
// Gemini thật, vì tính năng cốt lõi của VibeCheck (so sánh nhiều model
// Gemini + sinh ảnh thật) không thể thay bằng Groq miễn phí mà không phá
// vỡ mục đích của tính năng — xem api/_lib/vibeCheckProxy.js. Logic
// retry/timeout đã chuyển vào đó (server-side), client chỉ cần gọi 1 lần.
import limit from 'p-limit'

type LlmGenParams = {
  model: string
  systemInstruction: string
  prompt: string
  promptImage: string | null
  imageOutput?: boolean
  thinking?: boolean
  thinkingCapable?: boolean
}

const limiter = limit(9)

export default ({
  model,
  systemInstruction,
  prompt,
  promptImage,
  imageOutput,
  thinking,
  thinkingCapable
}: LlmGenParams) =>
  limiter(async () => {
    const res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'vibe-check',
        model,
        systemInstruction,
        prompt,
        promptImage,
        imageOutput,
        thinking,
        thinkingCapable
      })
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data?.error || `Vibe Check proxy error (${res.status})`)
    }
    if (!data?.result) {
      throw new Error('No result returned from Vibe Check proxy')
    }

    return data.result as string
  })
