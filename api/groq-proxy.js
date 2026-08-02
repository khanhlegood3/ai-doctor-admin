// api/groq-proxy.js
// Vercel Serverless Function — proxy Groq API calls from the browser.
//
// Groq is FREE — no credit card needed. Get your key at: https://console.groq.com
// Add to Vercel env as: GROQ_API_KEY
//
// Model used: llama-3.3-70b-versatile
// Free limits: 14,400 requests/day, 500,000 tokens/minute — very generous.
//
// --- CHIA SẺ SLOT VỚI TÍNH NĂNG "TẠO GAME BẰNG AVATAR CỦA TÔI" ---
// Vercel (gói hiện tại) giới hạn 12 Serverless Functions, nên thay vì thêm
// 1 file api/gemini-comic-proxy.js riêng (sẽ là function thứ 13), tính năng
// Comic Hero Game DÙNG CHUNG endpoint này. Client gửi thêm field
// `provider: 'gemini-comic'` trong body để định tuyến sang nhánh sinh
// text/ảnh (xem runGeminiComicGenerate ở api/_lib/geminiComic.js — tên
// field/hàm giữ nguyên "gemini-comic" vì lý do lịch sử). Nhánh text dùng
// Groq (tái sử dụng GROQ_API_KEY bên dưới, cùng key với Groq passthrough),
// nhánh ảnh vẫn gọi Pollinations ẩn danh (không cần key); nếu không có field
// `provider` này thì xử lý y hệt như trước (Groq passthrough), không đổi
// hành vi cũ.

import { runGeminiComicGenerate, GeminiComicError } from './_lib/geminiComic.js'
import { runVisionSyncVibe, createVisionSyncLiveToken, VisionSyncProxyError } from './_lib/visionSyncProxy.js'
import { runVibeTrackingEmotionAnalysis, runVibeTrackingSignAnalysis, VibeTrackingProxyError } from './_lib/vibeTrackingProxy.js'
import { runVibeCheckGenerate, VibeCheckProxyError } from './_lib/vibeCheckProxy.js'
import { runAiChatbotControlGenerate, AiChatbotControlProxyError } from './_lib/aiChatbotControlProxy.js'
import { runVideoToLearningGenerate, runPageToLearningGenerate, VideoToLearningProxyError } from './_lib/videoToLearningProxy.js'
import { saveHistoryEntry, listHistoryEntries, getAdminOverview, VideoToLearningHistoryError } from './_lib/videoToLearningHistory.js'
import { fetchYoutubeClipAsBase64, KolYoutubeDownloadError } from './_lib/kolYoutubeDownload.js'
import { withApiKeyRotation, toRotatableHttpError, ApiKeyPoolError } from './_lib/apiKeyPool.js'

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) }
      catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body
  try {
    body = await parseBody(req)
  } catch (e) {
    return res.status(400).json({ error: 'Failed to parse request body: ' + e.message })
  }

  // --- Nhánh Vision Sync (vibe: Groq free | liveToken: Gemini ephemeral token) ---
  if (body.provider === 'vision-sync') {
    console.log('[groq-proxy] (vision-sync) action:', body.action)
    try {
      if (body.action === 'vibe') {
        const payload = await runVisionSyncVibe({
          objects: body.objects,
          emotion: body.emotion,
        })
        return res.status(200).json(payload)
      }
      if (body.action === 'liveToken') {
        const payload = await createVisionSyncLiveToken({})
        return res.status(200).json(payload)
      }
      return res.status(400).json({ error: 'Unknown vision-sync action' })
    } catch (err) {
      console.error('[groq-proxy] (vision-sync) error:', err?.message || err)
      const status = err instanceof VisionSyncProxyError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'Vision Sync proxy error' })
    }
  }

  // --- Nhánh Vibe Tracking (emotion: Groq free | sign: Groq free) ---
  if (body.provider === 'vibe-tracking') {
    console.log('[groq-proxy] (vibe-tracking) action:', body.action)
    try {
      if (body.action === 'emotion') {
        const payload = await runVibeTrackingEmotionAnalysis({
          avgBlendshapes: body.avgBlendshapes,
          dominantEmotion: body.dominantEmotion,
          vibeValue: body.vibeValue,
          numFaces: body.numFaces,
        })
        return res.status(200).json(payload)
      }
      if (body.action === 'sign') {
        const payload = await runVibeTrackingSignAnalysis({
          compactData: body.compactData,
        })
        return res.status(200).json(payload)
      }
      return res.status(400).json({ error: 'Unknown vibe-tracking action' })
    } catch (err) {
      console.error('[groq-proxy] (vibe-tracking) error:', err?.message || err)
      const status = err instanceof VibeTrackingProxyError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'Vibe Tracking proxy error' })
    }
  }

  // --- Nhánh Vibe Check (Gemini thật server-side, cần GEMINI_API_KEY trả phí) ---
  if (body.provider === 'vibe-check') {
    console.log('[groq-proxy] (vibe-check) model:', body.model)
    try {
      const payload = await runVibeCheckGenerate({
        model: body.model,
        systemInstruction: body.systemInstruction,
        prompt: body.prompt,
        promptImage: body.promptImage,
        imageOutput: body.imageOutput,
        thinking: body.thinking,
        thinkingCapable: body.thinkingCapable,
      })
      return res.status(200).json(payload)
    } catch (err) {
      console.error('[groq-proxy] (vibe-check) error:', err?.message || err)
      const status = err instanceof VibeCheckProxyError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'Vibe Check proxy error' })
    }
  }

  // --- Nhánh AI chatbot control (Gemini thật server-side, dùng chung GEMINI_API_KEY) ---
  if (body.provider === 'ai-chatbot-control') {
    console.log('[groq-proxy] (ai-chatbot-control) prompt length:', body.prompt?.length)
    try {
      const payload = await runAiChatbotControlGenerate({
        prompt: body.prompt,
        systemInstruction: body.systemInstruction,
      })
      return res.status(200).json(payload)
    } catch (err) {
      console.error('[groq-proxy] (ai-chatbot-control) error:', err?.message || err)
      const status = err instanceof AiChatbotControlProxyError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'AI chatbot control proxy error' })
    }
  }

  // --- Nhánh Video to Learning (transcript YouTube miễn phí + Groq, dùng chung GROQ_API_KEY) ---
  // Từ bản cập nhật hỗ trợ nhiều loại link: `pageUrl` (thay cho `videoUrl`)
  // -> nhánh "Website to Learning" (xem runPageToLearningGenerate).
  if (body.provider === 'video-to-learning') {
    console.log('[groq-proxy] (video-to-learning) hasVideoUrl:', Boolean(body.videoUrl), '| hasPageUrl:', Boolean(body.pageUrl))
    try {
      if (body.pageUrl) {
        const payload = await runPageToLearningGenerate({
          prompt: body.prompt,
          pageUrl: body.pageUrl,
        })
        return res.status(200).json(payload)
      }
      const payload = await runVideoToLearningGenerate({
        prompt: body.prompt,
        videoUrl: body.videoUrl,
      })
      return res.status(200).json(payload)
    } catch (err) {
      console.error('[groq-proxy] (video-to-learning) error:', err?.message || err)
      const status = err instanceof VideoToLearningProxyError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'Video to Learning proxy error' })
    }
  }

  // --- Nhánh lịch sử Video to Learning (MongoDB, KHÔNG gọi AI) ---
  // Dùng chung endpoint này (không tạo Serverless Function mới, xem lý do ở
  // đầu file) để lưu/đọc lịch sử theo uuid — cho cả người dùng xem lại lịch
  // sử của chính mình lẫn Admin xem lịch sử của bất kỳ user nào (action
  // 'list' không phân biệt 2 trường hợp, đúng mô hình bảo mật hiện tại: admin
  // gating hoàn toàn ở client, xem thêm affiliate-admin-stats.js).
  if (body.provider === 'video-to-learning-history') {
    console.log('[groq-proxy] (video-to-learning-history) action:', body.action)
    try {
      if (body.action === 'save') {
        const payload = await saveHistoryEntry({
          uuid: body.uuid,
          userId: body.userId,
          name: body.name,
          type: body.type,
          link: body.link,
          title: body.title,
          aiSource: body.aiSource,
          status: body.status,
          errorMessage: body.errorMessage,
          specPreview: body.specPreview,
        })
        return res.status(201).json(payload)
      }
      if (body.action === 'list') {
        const payload = await listHistoryEntries({ uuid: body.uuid, limit: body.limit })
        return res.status(200).json(payload)
      }
      return res.status(400).json({ error: 'Unknown video-to-learning-history action' })
    } catch (err) {
      console.error('[groq-proxy] (video-to-learning-history) error:', err?.message || err)
      const status = err instanceof VideoToLearningHistoryError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'Video to Learning history error' })
    }
  }

  // --- Nhánh thống kê Admin cho Video to Learning (MongoDB, chỉ đọc) ---
  if (body.provider === 'video-to-learning-admin-stats') {
    console.log('[groq-proxy] (video-to-learning-admin-stats) action:', body.action)
    try {
      const payload = await getAdminOverview({ recentLimit: body.recentLimit, perUserLimit: body.perUserLimit })
      return res.status(200).json(payload)
    } catch (err) {
      console.error('[groq-proxy] (video-to-learning-admin-stats) error:', err?.message || err)
      return res.status(500).json({ error: err?.message || 'Video to Learning admin stats error' })
    }
  }


  // --- Nhánh AI Pose thật cho video KOL (trang Remix Sức Khoẻ từ KOL) ---
  // Tải 1 clip YouTube NGẮN về server rồi trả base64 cho client — xem giới
  // hạn/rủi ro chi tiết ở đầu api/_lib/kolYoutubeDownload.js. Nhánh này CỐ Ý
  // fail rõ ràng (không phải bug) khi video dài/nặng hoặc bị YouTube chặn —
  // client sẽ tự fallback sang cho user chọn file để upload thủ công.
  if (body.provider === 'kol-youtube-fetch') {
    console.log('[groq-proxy] (kol-youtube-fetch) youtubeUrl:', body.youtubeUrl)
    try {
      const payload = await fetchYoutubeClipAsBase64(body.youtubeUrl)
      return res.status(200).json(payload)
    } catch (err) {
      console.error('[groq-proxy] (kol-youtube-fetch) error:', err?.message || err)
      const status = err instanceof KolYoutubeDownloadError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'KOL YouTube fetch error' })
    }
  }

  // --- Nhánh Comic Hero (text: Groq | ảnh: Pollinations ẩn danh) ---
  if (body.provider === 'gemini-comic') {
    console.log('[groq-proxy] (gemini-comic) action:', body.action)
    try {
      const payload = await runGeminiComicGenerate({
        action: body.action,
        contents: body.contents,
        config: body.config,
      })
      return res.status(200).json(payload)
    } catch (err) {
      console.error('[groq-proxy] (gemini-comic) error:', err?.message || err)
      const status = err instanceof GeminiComicError ? err.status : 500
      return res.status(status).json({ error: err?.message || 'Comic generate proxy error' })
    }
  }

  // --- Nhánh Groq (mặc định, hành vi gốc không đổi, chỉ thêm key pool) ---
  // KEY POOL / AUTO-ROTATION: đọc GROQ_API_KEY, GROQ_API_KEY1, GROQ_API_KEY2,
  // ... GROQ_API_KEYn (không giới hạn số lượng) và tự động rotate sang key
  // kế tiếp khi key đang dùng hết hạn mức/billing (xem api/_lib/apiKeyPool.js)
  // — thay vì quăng lỗi real-time ngay cho client khi 1 key hết tiền.
  console.log('[groq-proxy] model:', body.model, '| messages:', body.messages?.length)

  try {
    const { status, data } = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
      const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      })

      const text = await upstream.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = { raw: text } }

      if (!upstream.ok) {
        console.error('[groq-proxy] Groq', upstream.status, ':', text.slice(0, 500))
        throw await toRotatableHttpError(upstream, 'Groq')
      }

      return { status: upstream.status, data: parsed }
    })

    return res.status(status).json(data)
  } catch (err) {
    console.error('[groq-proxy] error:', err?.message)
    if (err instanceof ApiKeyPoolError) {
      return res.status(err.status).json({ error: err.message })
    }
    if (typeof err?.status === 'number' && err.rawBody !== undefined) {
      let parsed
      try { parsed = JSON.parse(err.rawBody) } catch { parsed = { error: err.message } }
      return res.status(err.status).json(parsed)
    }
    return res.status(500).json({ error: err?.message || 'Proxy fetch error' })
  }
}
