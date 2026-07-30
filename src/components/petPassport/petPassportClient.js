// src/components/petPassport/petPassportClient.js
// Client cho tính năng "Pet Passport Adventure". Bản gốc (AI Studio starter
// app) gọi thẳng @google/genai (model "gemini-3.1-flash-image-preview") từ
// trình duyệt với API key nhúng vào bundle (process.env.GEMINI_API_KEY) —
// KHÔNG an toàn để dùng trong app production này.
//
// Ở đây ta CHUYỂN SANG DÙNG ĐÚNG CÔNG NGHỆ CỦA TRANG COMIC (Tạo Game bằng
// Avatar của Tôi): gọi qua Serverless Function api/groq-proxy.js (giữ mọi
// API key trên server), DÙNG CHUNG endpoint + provider `gemini-comic` với
// Comic Hero (xem api/_lib/geminiComic.js, geminiComicClient.js) — không
// tạo Serverless Function mới vì Vercel giới hạn 12 functions, và routing
// đã định tuyến sẵn theo field `provider` trong body.
//
// GHI CHÚ QUAN TRỌNG VỀ GIỚI HẠN KỸ THUẬT (khác với bản gốc):
// Nhánh sinh ẢNH dùng chung với Comic Hero hiện gọi Pollinations.AI (model
// "flux") ẨN DANH — đây là dịch vụ TEXT-TO-IMAGE THUẦN, không nhận ảnh tham
// chiếu (inlineData) để "ghép" đúng khuôn mặt/đặc điểm thú cưng thật từ ảnh
// người dùng tải lên như bản gốc (Gemini 3.1 Flash Image cho phép multi-
// image input để giữ nhất quán nhân vật). Do đó:
//   - Ảnh thú cưng người dùng tải lên vẫn được lưu & hiển thị trong panel
//     "Upload subjects" để tham khảo/đặt tên, NHƯNG ảnh "holiday snap" sinh
//     ra chỉ dựa trên MÔ TẢ VĂN BẢN (tên, loại, giống/màu lông do người dùng
//     nhập thêm nếu có) — không giữ nguyên khuôn mặt thú cưng thật 100%.
//   - Đây là đánh đổi có chủ đích để giữ tính năng $0, không cần API key
//     Gemini trả phí (đúng tinh thần "giống công nghệ trang comic").
export const MODEL_IMAGE_GEN_NAME = 'gemini-3-pro-image-preview'

async function callProxy(payload) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'gemini-comic', ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `Pet Passport proxy error (${res.status})`)
    err.status = res.status
    err.raw = data
    throw err
  }
  return data
}

/**
 * Sinh 1 ảnh "holiday snap" đặt các subject (thú cưng/đồ vật) vào 1 địa
 * điểm nổi tiếng. Trả về { imageUrl, mimeType } hoặc throw nếu thất bại.
 */
export async function generatePetAdventureImage({ subjects, destination, description, aspectRatio }) {
  const subjectPrompt = subjects
    .map((s, idx) => {
      const typeLabel = s.type === 'character' ? 'Pet' : 'Object'
      const typeIdx = subjects.filter((sub, i) => sub.type === s.type && i < idx).length + 1
      return `${s.name} (${typeLabel} ${typeIdx})`
    })
    .join(', ')

  const contents = [
    {
      role: 'user',
      parts: [
        // Vẫn gửi kèm ảnh tham chiếu (inlineData) để tương thích ngược nếu
        // sau này engine ảnh phía server được nâng cấp lên loại hỗ trợ
        // multi-image input thật (vd Gemini có key riêng) — engine hiện tại
        // (Pollinations flux) sẽ tự bỏ qua các phần này, chỉ đọc `text`.
        ...subjects.map((s) => ({ inlineData: { data: s.data, mimeType: s.mimeType } })),
        {
          text: `A cheerful travel photo placing these subjects at a famous global location: ${destination}. `
            + `Subjects: ${subjectPrompt}. `
            + `Additional details: ${description || 'natural pose, joyful holiday mood'}. `
            + `Photorealistic travel photography style, warm lighting, accurate depiction of the landmark.`,
        },
      ],
    },
  ]

  const config = {
    imageConfig: { aspectRatio, imageSize: '1K' },
    responseModalities: ['IMAGE', 'TEXT'],
  }

  const data = await callProxy({ action: 'generateContent', model: MODEL_IMAGE_GEN_NAME, contents, config })
  const part = data?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
  if (!part?.inlineData) throw new Error('No image generated')
  return { imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`, mimeType: part.inlineData.mimeType }
}

export const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
