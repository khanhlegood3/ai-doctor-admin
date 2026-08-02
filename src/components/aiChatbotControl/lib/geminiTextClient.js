/**
 * Gemini text client for the "AI chatbot control" panel — calls the
 * server-side proxy at /api/groq-proxy (provider: 'ai-chatbot-control')
 * instead of hitting generativelanguage.googleapis.com directly from the
 * browser. The Gemini key (GEMINI_API_KEY, no VITE_ prefix) now lives only
 * on the server and is never bundled into client JS — see
 * api/_lib/aiChatbotControlProxy.js.
 */

export async function callGeminiAPI(prompt, systemInstruction, history = []) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'ai-chatbot-control',
      prompt,
      systemInstruction,
      // Lịch sử hội thoại gần đây (đã lưu qua globalChatbotStorage.js), dạng
      // [{ role: 'user'|'assistant', text }, ...] — backend chuyển thành
      // nhiều turn Gemini (role 'user'/'model') để AI nhớ được ngữ cảnh các
      // câu trước, thay vì mỗi câu hỏi là 1 phiên độc lập như trước đây.
      history,
    }),
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data?.error || `HTTP error! status: ${res.status}`)
  }

  return data?.result || 'Không có phản hồi từ AI.'
}
