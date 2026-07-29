// src/components/comicHero/geminiComicClient.js
// Client cho tính năng "Tạo Game bằng Avatar của Tôi". Bản gốc
// (infinite-heroes) gọi thẳng @google/genai từ trình duyệt với API key
// nhúng vào bundle — KHÔNG an toàn để dùng trong app production này. Ở đây
// ta gọi qua Serverless Function api/groq-proxy.js (giữ API key trên
// server) — DÙNG CHUNG endpoint với Groq (không tạo file /api mới) vì
// Vercel giới hạn 12 Serverless Functions; endpoint định tuyến dựa vào
// field `provider: 'gemini-comic'` trong body (xem api/groq-proxy.js).

const MODEL_V3 = 'gemini-3-pro-image-preview'
export const MODEL_IMAGE_GEN_NAME = MODEL_V3
export const MODEL_TEXT_NAME = MODEL_V3

async function callGeminiProxy(payload) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'gemini-comic', ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Gemini proxy error (${res.status})`)
    err.status = res.status
    err.raw = data
    throw err
  }
  return data
}

// Sinh nội dung dạng văn bản (JSON) — dùng cho kịch bản từng trang truyện.
export async function generateComicText({ model = MODEL_TEXT_NAME, contents, config } = {}) {
  return callGeminiProxy({ action: 'generateContent', model, contents, config })
}

// Sinh ảnh (trả về base64 + mimeType của phần inlineData đầu tiên).
export async function generateComicImage({ model = MODEL_IMAGE_GEN_NAME, contents, config } = {}) {
  return callGeminiProxy({ action: 'generateContent', model, contents, config })
}

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

// Chuyển 1 URL ảnh (vd: avatar hiện có của user) thành base64 JPEG-friendly
// data để dùng làm ảnh tham chiếu nhân vật. Trả về null nếu thất bại (vd do
// CORS) — nơi gọi nên tự fallback về việc yêu cầu người dùng tải ảnh lên.
export async function imageUrlToBase64(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('[comicHero] Không thể chuyển avatar hiện có sang base64:', e?.message || e)
    return null
  }
}
