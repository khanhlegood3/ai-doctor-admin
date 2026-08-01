// api/_lib/videoToLearningProxy.js
// Backend cho tính năng "Video to Learning" (chuyển đổi từ
// video-to-learning-app.zip, app AI Studio gốc gọi thẳng @google/genai).
//
// KIẾN TRÚC FALLBACK TỰ ĐỘNG (Groq trước — miễn phí, Gemini dự phòng — vẫn
// free tier nhưng có giới hạn chặt hơn):
//   Bước 1 (sinh spec, có videoUrl):
//     1. Lấy transcript/phụ đề YouTube (miễn phí, không cần key — xem
//        youtubeTranscript.js).
//     2. Nếu lấy được transcript ĐỦ DÀI → gửi cho Groq (miễn phí) kèm
//        transcript, dùng transcript thay cho việc "xem" video.
//     3. Nếu KHÔNG lấy được transcript (video tắt phụ đề), transcript QUÁ
//        NGẮN (< MIN_TRANSCRIPT_CHARS, ví dụ video gần như không nói gì),
//        hoặc bản thân Groq bị lỗi (rate limit, outage...) → TỰ ĐỘNG
//        chuyển sang Gemini, cho xem thẳng video (multimodal thật), không
//        cần transcript.
//   Bước 2 (sinh code từ spec, không có videoUrl, thuần text):
//     Luôn thử Groq trước (đủ mạnh cho việc này, không cần video) → nếu
//     Groq lỗi thì fallback Gemini (text-only, không tốn quota multimodal).
//
// KHÔNG chạy song song 2 bên cùng lúc: mục tiêu ban đầu là tiết kiệm chi
// phí, nên chỉ gọi Gemini khi THỰC SỰ CẦN (Groq không đủ khả năng hoặc bị
// lỗi) thay vì luôn gọi cả 2 rồi chọn kết quả — cách đó tốn gấp đôi quota/
// tiền mà không mang lại lợi ích tương xứng cho use case này.
//
// DÙNG CHUNG endpoint /api/groq-proxy (field `provider: 'video-to-learning'`)
// — không tạo Serverless Function mới vì Vercel giới hạn 12 functions.

import { GoogleGenAI, FinishReason } from '@google/genai'
import { fetchYoutubeTranscript, YoutubeTranscriptError } from './youtubeTranscript.js'

export class VideoToLearningProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VideoToLearningProxyError'
    this.status = status
  }
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile'
const GEMINI_MODEL = 'gemini-3.6-flash' // model Flash mới nhất còn free tier thật
const MIN_TRANSCRIPT_CHARS = 200 // dưới ngưỡng này coi là "nội dung không đủ"
const GEMINI_TIMEOUT_MS = 55_000

// --- Groq (text) ---
async function callGroq({ apiKey, promptText, jsonMode }) {
  if (!apiKey) throw new VideoToLearningProxyError('GROQ_API_KEY not configured', 501)

  const body = {
    model: GROQ_TEXT_MODEL,
    messages: [{ role: 'user', content: promptText }],
    temperature: 0.75,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new VideoToLearningProxyError(`Groq error (${res.status}): ${errText.slice(0, 300)}`, 502)
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

// --- Gemini (multimodal, fallback) ---
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

async function callGemini({ apiKey, promptText, videoUrl }) {
  if (!apiKey) throw new VideoToLearningProxyError('GEMINI_API_KEY not configured', 501)

  const ai = new GoogleGenAI({ apiKey })
  const parts = [{ text: promptText }]
  if (videoUrl) parts.push({ fileData: { mimeType: 'video/mp4', fileUri: videoUrl } })

  const response = await withTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts }],
      config: { temperature: 0.75 },
    }),
    GEMINI_TIMEOUT_MS,
  )

  if (response.promptFeedback?.blockReason) {
    throw new VideoToLearningProxyError(`Nội dung bị chặn (lý do: ${response.promptFeedback.blockReason})`, 400)
  }
  const firstCandidate = response.candidates?.[0]
  if (!firstCandidate) {
    throw new VideoToLearningProxyError('Không có kết quả trả về từ Gemini.', 502)
  }
  if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
    if (firstCandidate.finishReason === FinishReason.SAFETY) {
      throw new VideoToLearningProxyError('Nội dung bị chặn do cài đặt an toàn.', 400)
    }
    throw new VideoToLearningProxyError(`Gemini dừng vì lý do: ${firstCandidate.finishReason}.`, 502)
  }

  return response.text ?? ''
}

function buildTranscriptOverridePrompt(originalPrompt, transcript) {
  return `${originalPrompt}

---
GHI CHU QUAN TRONG: ban KHONG duoc xem truc tiep video. Thay vao do, duoi day la transcript (phu de) day du cua video - hay coi day la toan bo nhung gi ban "biet" ve video va dua hoan toan vao no, khong duoc noi rang ban thieu hinh anh hay khong xem duoc video:
"""
${transcript}
"""`
}

// --- Điều phối Groq (mặc định) ↔ Gemini (fallback tự động) ---
export async function runVideoToLearningGenerate({ groqApiKey, geminiApiKey, prompt, videoUrl }) {
  if (!prompt) throw new VideoToLearningProxyError('Missing prompt', 400)
  if (!groqApiKey && !geminiApiKey) {
    throw new VideoToLearningProxyError(
      'Chưa cấu hình GROQ_API_KEY lẫn GEMINI_API_KEY trên server. Thêm ít nhất một trong hai trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }

  // Bước 2: sinh code từ spec (text-only, không có videoUrl)
  if (!videoUrl) {
    if (groqApiKey) {
      try {
        const text = await callGroq({ apiKey: groqApiKey, promptText: prompt, jsonMode: false })
        return { text, source: 'groq' }
      } catch (err) {
        console.warn('[video-to-learning] Groq (code step) failed, falling back to Gemini:', err?.message || err)
      }
    }
    if (!geminiApiKey) {
      throw new VideoToLearningProxyError('Groq gặp sự cố và chưa cấu hình GEMINI_API_KEY để dự phòng.', 502)
    }
    const text = await callGemini({ apiKey: geminiApiKey, promptText: prompt })
    return { text, source: 'gemini-fallback' }
  }

  // Bước 1: sinh spec từ video (có videoUrl)
  let transcriptResult = null
  let transcriptError = null
  try {
    transcriptResult = await fetchYoutubeTranscript(videoUrl)
  } catch (err) {
    transcriptError = err
  }

  const hasEnoughTranscript = Boolean(transcriptResult && transcriptResult.transcript.length >= MIN_TRANSCRIPT_CHARS)

  if (hasEnoughTranscript && groqApiKey) {
    try {
      const finalPrompt = buildTranscriptOverridePrompt(prompt, transcriptResult.transcript)
      const text = await callGroq({ apiKey: groqApiKey, promptText: finalPrompt, jsonMode: true })
      return { text, source: 'groq-transcript' }
    } catch (err) {
      console.warn('[video-to-learning] Groq (spec step) failed, falling back to Gemini:', err?.message || err)
    }
  } else if (transcriptError) {
    console.warn('[video-to-learning] Transcript unavailable, falling back to Gemini:', transcriptError.message)
  } else if (!hasEnoughTranscript) {
    console.warn('[video-to-learning] Transcript too short, falling back to Gemini')
  }

  if (!geminiApiKey) {
    if (transcriptError instanceof YoutubeTranscriptError) {
      throw new VideoToLearningProxyError(transcriptError.message, transcriptError.status)
    }
    throw new VideoToLearningProxyError(
      'Không đủ transcript và Groq gặp sự cố, nhưng chưa cấu hình GEMINI_API_KEY để dự phòng. Hãy thử video khác có phụ đề đầy đủ.',
      502,
    )
  }

  const text = await callGemini({ apiKey: geminiApiKey, promptText: prompt, videoUrl })
  return { text, source: 'gemini-fallback' }
}
