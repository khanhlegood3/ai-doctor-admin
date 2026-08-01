// api/_lib/videoToLearningProxy.js
// Backend cho tính năng "Video to Learning" (chuyển đổi từ
// video-to-learning-app.zip, app AI Studio gốc gọi thẳng @google/genai).
//
// CẬP NHẬT: chuyển từ Gemini (GEMINI_API_KEY, trả phí — model gemini-2.5-*
// bị ngừng cấp cho user mới, dòng Pro cũng đã hết free tier từ 4/2026) sang
// TRANSCRIPT YOUTUBE + GROQ, MIỄN PHÍ HOÀN TOÀN:
//   1. Lấy transcript/phụ đề video (xem youtubeTranscript.js — miễn phí,
//      không cần API key, lấy cảm hứng từ cách bradautomates/claude-video
//      ưu tiên caption trước khi phải trích frame video).
//   2. Đưa transcript cho Groq (GROQ_API_KEY, đã có sẵn trong dự án, dùng
//      chung với chatbot chính — free 14.400 request/ngày) để sinh spec rồi
//      sinh code HTML — giống hệt luồng cũ, chỉ đổi "người xem video".
//
// ĐÁNH ĐỔI CẦN BIẾT: giờ chỉ hiểu nội dung qua LỜI THOẠI/PHỤ ĐỀ, không còn
// "nhìn" được hình ảnh trên màn hình (biểu đồ, minh hoạ trực quan...) như
// Gemini multimodal làm được trước đây. Video không bật phụ đề sẽ báo lỗi
// rõ ràng cho người dùng.
//
// DÙNG CHUNG endpoint /api/groq-proxy (field `provider: 'video-to-learning'`)
// — không tạo Serverless Function mới vì Vercel giới hạn 12 functions.

import { fetchYoutubeTranscript, YoutubeTranscriptError } from './youtubeTranscript.js'

export class VideoToLearningProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VideoToLearningProxyError'
    this.status = status
  }
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const TEXT_MODEL = 'llama-3.3-70b-versatile'

async function callGroq({ apiKey, promptText, jsonMode }) {
  const body = {
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: promptText }],
    temperature: 0.75,
  }
  if (jsonMode) body.response_format = { type: 'json_object' }

  const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new VideoToLearningProxyError(`Groq error (${res.status}): ${errText.slice(0, 300)}`, 502)
  }

  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

export async function runVideoToLearningGenerate({ groqApiKey, prompt, videoUrl }) {
  if (!groqApiKey) {
    throw new VideoToLearningProxyError(
      'GROQ_API_KEY chưa được cấu hình trên server. Thêm biến GROQ_API_KEY trong Vercel → Settings → Environment Variables rồi redeploy (lấy free tại https://console.groq.com).',
      501,
    )
  }
  if (!prompt) {
    throw new VideoToLearningProxyError('Missing prompt', 400)
  }

  let finalPrompt = prompt

  // Có videoUrl = bước 1 (sinh spec, cần "xem" video qua transcript).
  // Không có videoUrl = bước 2 (sinh code HTML từ spec, thuần text).
  if (videoUrl) {
    let transcriptResult
    try {
      transcriptResult = await fetchYoutubeTranscript(videoUrl)
    } catch (err) {
      if (err instanceof YoutubeTranscriptError) {
        throw new VideoToLearningProxyError(err.message, err.status)
      }
      throw new VideoToLearningProxyError('Không lấy được phụ đề video: ' + (err?.message || err), 502)
    }
    finalPrompt = `${prompt}\n\n---\nDƯỚI ĐÂY LÀ TRANSCRIPT (PHỤ ĐỀ) CỦA VIDEO — đây là toàn bộ dữ liệu bạn có về video, hãy dựa hoàn toàn vào nội dung này, không được nói rằng bạn thiếu hình ảnh:\n"""\n${transcriptResult.transcript}\n"""`
  }

  try {
    const text = await callGroq({ apiKey: groqApiKey, promptText: finalPrompt, jsonMode: Boolean(videoUrl) })
    return { text }
  } catch (err) {
    if (err instanceof VideoToLearningProxyError) throw err
    throw new VideoToLearningProxyError(err?.message || 'Groq generate error', 502)
  }
}
