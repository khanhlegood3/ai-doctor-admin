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
import { fetchWebpageText, WebpageTextError } from './webpageText.js'
import { withApiKeyRotation, toRotatableHttpError, countApiKeyPool } from './apiKeyPool.js'

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
// KEY POOL / AUTO-ROTATION: thử lần lượt GROQ_API_KEY, GROQ_API_KEY1,
// GROQ_API_KEY2, ... (xem api/_lib/apiKeyPool.js) trước khi coi Groq là
// "gặp sự cố" và fallback sang Gemini — tránh fallback sang Gemini (quota
// chặt hơn) chỉ vì 1 key Groq bị hết hạn mức trong khi vẫn còn key dự phòng.
async function callGroq({ promptText, jsonMode, envSource }) {
  const body = {
    model: GROQ_TEXT_MODEL,
    messages: [{ role: 'user', content: promptText }],
    temperature: 0.75,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  try {
    const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
      const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
      return res.json()
    }, { envSource })

    return data?.choices?.[0]?.message?.content || ''
  } catch (err) {
    throw new VideoToLearningProxyError(err?.message || 'Groq error', err?.status || 502)
  }
}

// --- Gemini (multimodal, fallback) ---
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))])

// KEY POOL / AUTO-ROTATION: thử lần lượt GEMINI_API_KEY, GEMINI_API_KEY1,
// GEMINI_API_KEY2, ... (xem api/_lib/apiKeyPool.js) khi key đang dùng hết
// hạn mức/billing, trước khi báo lỗi cho client.
async function callGemini({ promptText, videoUrl, envSource }) {
  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
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
    }, { envSource })
  } catch (err) {
    if (err instanceof VideoToLearningProxyError) throw err
    throw new VideoToLearningProxyError(err?.message || 'Gemini error', err?.status || 502)
  }
}

function buildTranscriptOverridePrompt(originalPrompt, transcript, sourceLabel = 'video') {
  const noun = sourceLabel === 'page' ? 'trang web' : 'video'
  return `${originalPrompt}

---
GHI CHU QUAN TRONG: ban KHONG duoc xem truc tiep ${noun}. Thay vao do, duoi day la toan bo noi dung van ban da trich ra tu ${noun} nay - hay coi day la toan bo nhung gi ban "biet" ve ${noun} va dua hoan toan vao no, khong duoc noi rang ban thieu hinh anh hay khong xem duoc ${noun}:
"""
${transcript}
"""`
}

// --- Điều phối Groq (mặc định) ↔ Gemini (fallback tự động) ---
// `hasGroq`/`hasGemini` giờ nghĩa là "có ÍT NHẤT 1 key trong pool tương ứng"
// (GROQ_API_KEY* / GEMINI_API_KEY*) — chỉ dùng để quyết định NHÁNH nào được
// thử trước, việc rotate GIỮA CÁC KEY của cùng 1 nhánh diễn ra bên trong
// callGroq()/callGemini() (xem api/_lib/apiKeyPool.js).
export async function runVideoToLearningGenerate({ prompt, videoUrl, envSource }) {
  if (!prompt) throw new VideoToLearningProxyError('Missing prompt', 400)

  const hasGroq = countApiKeyPool('GROQ_API_KEY', { envSource }) > 0
  const hasGemini = countApiKeyPool('GEMINI_API_KEY', { envSource }) > 0

  if (!hasGroq && !hasGemini) {
    throw new VideoToLearningProxyError(
      'Chưa cấu hình GROQ_API_KEY lẫn GEMINI_API_KEY (hoặc các biến *_API_KEY1, *_API_KEY2, ...) trên server. Thêm ít nhất một trong hai trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }

  // Bước 2: sinh code từ spec (text-only, không có videoUrl)
  if (!videoUrl) {
    if (hasGroq) {
      try {
        const text = await callGroq({ promptText: prompt, jsonMode: false, envSource })
        return { text, source: 'groq' }
      } catch (err) {
        console.warn('[video-to-learning] Groq (code step) failed on all keys, falling back to Gemini:', err?.message || err)
      }
    }
    if (!hasGemini) {
      throw new VideoToLearningProxyError('Groq gặp sự cố ở tất cả các key và chưa cấu hình GEMINI_API_KEY để dự phòng.', 502)
    }
    const text = await callGemini({ promptText: prompt, envSource })
    return { text, source: 'gemini-fallback' }
  }

  // Bước 1: sinh spec từ video (có videoUrl). Facebook không có transcript
  // miễn phí như YouTube, nên đi thẳng sang Gemini fallback nếu được cấu hình.
  const isFacebookVideo = /(^|\.)facebook\.com$|(^|\.)fb\.watch$/i.test(new URL(videoUrl).hostname)

  let transcriptResult = null
  let transcriptError = null
  if (!isFacebookVideo) {
    try {
      transcriptResult = await fetchYoutubeTranscript(videoUrl)
    } catch (err) {
      transcriptError = err
    }
  }

  const hasEnoughTranscript = Boolean(transcriptResult && transcriptResult.transcript.length >= MIN_TRANSCRIPT_CHARS)

  if (hasEnoughTranscript && hasGroq) {
    try {
      const finalPrompt = buildTranscriptOverridePrompt(prompt, transcriptResult.transcript)
      const text = await callGroq({ promptText: finalPrompt, jsonMode: true, envSource })
      return { text, source: 'groq-transcript' }
    } catch (err) {
      console.warn('[video-to-learning] Groq (spec step) failed on all keys, falling back to Gemini:', err?.message || err)
    }
  } else if (isFacebookVideo) {
    console.warn('[video-to-learning] Facebook video URL detected, using Gemini fallback')
  } else if (transcriptError) {
    console.warn('[video-to-learning] Transcript unavailable, falling back to Gemini:', transcriptError.message)
  } else if (!hasEnoughTranscript) {
    console.warn('[video-to-learning] Transcript too short, falling back to Gemini')
  }

  if (!hasGemini) {
    if (isFacebookVideo) {
      throw new VideoToLearningProxyError('Video Facebook cần GEMINI_API_KEY để AI xem trực tiếp link video. Hãy cấu hình GEMINI_API_KEY hoặc dùng link YouTube có phụ đề.', 501)
    }
    if (transcriptError instanceof YoutubeTranscriptError) {
      throw new VideoToLearningProxyError(transcriptError.message, transcriptError.status)
    }
    throw new VideoToLearningProxyError(
      'Không đủ transcript và Groq gặp sự cố ở tất cả các key, nhưng chưa cấu hình GEMINI_API_KEY để dự phòng. Hãy thử video khác có phụ đề đầy đủ.',
      502,
    )
  }

  const text = await callGemini({ promptText: prompt, videoUrl, envSource })
  return { text, source: 'gemini-fallback' }
}

// --- Nhánh "Website to Learning" (trang web bất kỳ, không phải YouTube) ---
// Khác video: KHÔNG có bước "Gemini xem trực tiếp" (Gemini không xem web live
// được) — nguồn nội dung LUÔN là text đã trích từ HTML (xem webpageText.js),
// nên bước sinh spec ở đây chỉ là 1 lệnh gọi text thuần: Groq trước, Gemini
// TEXT-ONLY (không đính videoUrl) dự phòng — y hệt bước 2 (sinh code) ở trên,
// chỉ khác prompt có kèm nội dung trang web.
export async function runPageToLearningGenerate({ prompt, pageUrl, envSource }) {
  if (!prompt) throw new VideoToLearningProxyError('Missing prompt', 400)
  if (!pageUrl) throw new VideoToLearningProxyError('Missing pageUrl', 400)

  const hasGroq = countApiKeyPool('GROQ_API_KEY', { envSource }) > 0
  const hasGemini = countApiKeyPool('GEMINI_API_KEY', { envSource }) > 0
  if (!hasGroq && !hasGemini) {
    throw new VideoToLearningProxyError(
      'Chưa cấu hình GROQ_API_KEY lẫn GEMINI_API_KEY (hoặc các biến *_API_KEY1, *_API_KEY2, ...) trên server. Thêm ít nhất một trong hai trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }

  let page
  try {
    page = await fetchWebpageText(pageUrl)
  } catch (err) {
    if (err instanceof WebpageTextError) throw new VideoToLearningProxyError(err.message, err.status)
    throw new VideoToLearningProxyError(err?.message || 'Không đọc được nội dung trang web.', 502)
  }

  const finalPrompt = buildTranscriptOverridePrompt(prompt, `(Tiêu đề trang: ${page.title || 'không rõ'})\n\n${page.text}`, 'page')

  if (hasGroq) {
    try {
      const text = await callGroq({ promptText: finalPrompt, jsonMode: true, envSource })
      return { text, source: 'groq-page', pageTitle: page.title }
    } catch (err) {
      console.warn('[video-to-learning] Groq (page step) failed on all keys, falling back to Gemini:', err?.message || err)
    }
  }

  if (!hasGemini) {
    throw new VideoToLearningProxyError('Groq gặp sự cố ở tất cả các key và chưa cấu hình GEMINI_API_KEY để dự phòng.', 502)
  }
  const text = await callGemini({ promptText: finalPrompt, envSource })
  return { text, source: 'gemini-fallback', pageTitle: page.title }
}
