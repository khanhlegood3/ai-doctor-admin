/**
 * Free Gemini text client for the "AI chatbot control" panel.
 *
 * This reuses the exact same VITE_GEMINI_API_KEY + `generateContent` REST
 * pattern already used elsewhere in this project (see
 * src/components/AffiliateSystemControlPanel.jsx) instead of the paid,
 * quota-limited Gemini Live API (bidirectional audio streaming) that the
 * original chatterbots demo depended on. Voice in/out is handled entirely by
 * the browser's free Web Speech APIs (see hooks/useVoiceCompanion.js) — no
 * extra billing, no extra API key.
 */
import { DEFAULT_TEXT_MODEL } from './constants'

export async function callGeminiAPI(apiKey, prompt, systemInstruction) {
  if (!apiKey) {
    throw new Error('Chưa cấu hình VITE_GEMINI_API_KEY trong file .env')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_TEXT_MODEL}:generateContent?key=${apiKey}`
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    ...(systemInstruction
      ? { systemInstruction: { parts: [{ text: systemInstruction }] } }
      : {}),
  }

  const delays = [1000, 2000, 4000, 8000, 16000]
  for (let i = 0; i < delays.length + 1; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        // 429 = free-tier rate limit hit, worth retrying with backoff
        if (res.status === 429 && i < delays.length) {
          throw new Error(`HTTP error! status: ${res.status}`)
        }
        const errBody = await res.text().catch(() => '')
        throw new Error(`HTTP error! status: ${res.status} ${errBody}`)
      }
      const data = await res.json()
      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ||
        'Không có phản hồi từ AI.'
      )
    } catch (err) {
      if (i === delays.length) throw err
      await new Promise(resolve => setTimeout(resolve, delays[i]))
    }
  }
  return 'Lỗi kết nối AI.'
}
