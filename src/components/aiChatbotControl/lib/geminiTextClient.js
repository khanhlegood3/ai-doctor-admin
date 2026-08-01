/**
 * Gemini text client for the "AI chatbot control" panel — calls the
 * server-side proxy at /api/groq-proxy (provider: 'ai-chatbot-control')
 * instead of hitting generativelanguage.googleapis.com directly from the
 * browser. The Gemini key (GEMINI_API_KEY, no VITE_ prefix) now lives only
 * on the server and is never bundled into client JS — see
 * api/_lib/aiChatbotControlProxy.js.
 */

export async function callGeminiAPI(prompt, systemInstruction) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'ai-chatbot-control',
      prompt,
      systemInstruction,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || `HTTP error! status: ${res.status}`)
  }

  return data?.result || 'Không có phản hồi từ AI.'
}
