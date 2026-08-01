// api/_lib/videoToLearningProxy.js
// Backend cho tính năng "Video to Learning" (chuyển đổi từ
// video-to-learning-app.zip, app AI Studio gốc gọi thẳng @google/genai +
// API key nhúng client qua VITE_GEMINI_API_KEY — KHÔNG an toàn để deploy
// thật, vì biến có tiền tố VITE_ được Vite nhúng thẳng vào file JS công
// khai, ai mở DevTools cũng lấy được key). DÙNG CHUNG endpoint
// /api/groq-proxy (xem api/groq-proxy.js, field
// `provider: 'video-to-learning'`) — không tạo Serverless Function mới vì
// Vercel giới hạn 12 functions (đã dùng hết).
//
// Gọi Gemini thật server-side (2.5 Flash để phân tích video, 2.5 Pro để
// sinh code từ spec) bằng GEMINI_API_KEY — biến này ĐÃ CÓ SẴN trong dự án,
// dùng chung với Vibe Check / Vision Sync Live Token (xem
// vibeCheckProxy.js, visionSyncProxy.js). Client không bao giờ thấy key,
// chỉ gửi { modelName, prompt, videoUrl? } lên server và nhận lại { text }.

import { GoogleGenAI, FinishReason } from '@google/genai'

export class VideoToLearningProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VideoToLearningProxyError'
    this.status = status
  }
}

const timeoutMs = 55_000 // dưới giới hạn thời gian chạy Serverless Function của Vercel
const maxRetries = 2

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

export async function runVideoToLearningGenerate({ geminiApiKey, modelName, prompt, videoUrl }) {
  if (!geminiApiKey) {
    throw new VideoToLearningProxyError(
      'GEMINI_API_KEY chưa được cấu hình trên server. Thêm biến GEMINI_API_KEY trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }
  if (!modelName || !prompt) {
    throw new VideoToLearningProxyError('Missing modelName or prompt', 400)
  }

  const ai = new GoogleGenAI({ apiKey: geminiApiKey })

  const parts = [{ text: prompt }]
  if (videoUrl) {
    parts.push({ fileData: { mimeType: 'video/mp4', fileUri: videoUrl } })
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const modelPromise = ai.models.generateContent({
        model: modelName,
        contents: [{ role: 'user', parts }],
        config: { temperature: 0.75 },
      })

      const response = await withTimeout(modelPromise, timeoutMs)

      if (response.promptFeedback?.blockReason) {
        throw new VideoToLearningProxyError(
          `Nội dung bị chặn (lý do: ${response.promptFeedback.blockReason})`,
          400,
        )
      }
      if (!response.candidates || response.candidates.length === 0) {
        throw new VideoToLearningProxyError('Không có kết quả trả về từ mô hình.', 502)
      }

      const firstCandidate = response.candidates[0]
      if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
        if (firstCandidate.finishReason === FinishReason.SAFETY) {
          throw new VideoToLearningProxyError('Nội dung bị chặn do cài đặt an toàn.', 400)
        }
        throw new VideoToLearningProxyError(`Dừng vì lý do: ${firstCandidate.finishReason}.`, 502)
      }

      return { text: response.text ?? '' }
    } catch (err) {
      if (attempt === maxRetries - 1) {
        if (err instanceof VideoToLearningProxyError) throw err
        throw new VideoToLearningProxyError(err?.message || 'Gemini generate error', 502)
      }
      await new Promise((resolve) => setTimeout(resolve, 1200 * 2 ** attempt))
    }
  }
  throw new VideoToLearningProxyError('All retries failed', 502)
}
