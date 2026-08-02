import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { runInbodyOcr } from './api/_lib/inbodyOcr.js'
import { runGeminiComicGenerate } from './api/_lib/geminiComic.js'
import { runVisionSyncVibe, createVisionSyncLiveToken, VisionSyncProxyError } from './api/_lib/visionSyncProxy.js'
import { runVibeTrackingEmotionAnalysis, runVibeTrackingSignAnalysis, VibeTrackingProxyError } from './api/_lib/vibeTrackingProxy.js'
import { runVibeCheckGenerate, VibeCheckProxyError } from './api/_lib/vibeCheckProxy.js'
import { runVideoToLearningGenerate, VideoToLearningProxyError } from './api/_lib/videoToLearningProxy.js'
import { fetchYoutubeClipToR2, KolYoutubeDownloadError } from './api/_lib/kolYoutubeDownload.js'
import { createKolR2UploadUrl, KolR2UploadError } from './api/_lib/kolR2Upload.js'

// Plugin dev-server: chạy OCR THẬT (Claude Vision) ngay trong `npm run dev`,
// không cần deploy lên Vercel mới test được nút "Convert InBody Image
// thành .CSV". Middleware này bắt riêng path /api/inbody-analyze và xử lý
// tại đây (không cho rơi xuống proxy /api chung ở dưới, vì proxy đó forward
// sang backend FastAPI khác — không có route này).
function inbodyOcrDevMiddleware(env) {
  return {
    name: 'inbody-ocr-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/inbody-analyze', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', async () => {
          try {
            const { image, mediaType, previousRecord } = body ? JSON.parse(body) : {}
            const analysis = await runInbodyOcr({
              image,
              mediaType,
              previousRecord,
              envSource: env,
            })
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 200
            res.end(JSON.stringify({ analysis }))
          } catch (error) {
            console.error('[inbody-ocr-dev-middleware]', error?.message || error)
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = error?.code === 'NO_IMAGE' ? 400 : 500
            res.end(JSON.stringify({ error: error?.message || 'Lỗi OCR.' }))
          }
        })
      })
    },
  }
}

// Plugin dev-server: chạy tính năng "Tạo Game bằng Avatar của Tôi" (Comic
// Hero Game, chuyển đổi từ infinite-heroes.zip) ngay trong `npm run dev`.
// Tính năng này DÙNG CHUNG endpoint /api/groq-proxy với Groq (không tạo
// file /api mới vì Vercel giới hạn 12 Serverless Functions — xem
// api/groq-proxy.js). Middleware này bắt path /api/groq-proxy, đọc body 1
// lần để kiểm tra field `provider`:
//   - provider === 'gemini-comic' → xử lý cục bộ (text: Groq thật, ảnh:
//     Pollinations ẩn danh thật) — xem runGeminiComicGenerate.
//   - ngược lại (Groq bình thường) → tự forward nguyên văn body đã đọc sang
//     backend ai-doctor-engine.vercel.app (vì stream request đã bị đọc hết
//     nên không thể để proxy /api chung ở dưới xử lý tiếp — phải tự forward
//     thủ công ở đây để giữ nguyên hành vi Groq cũ trong dev).
function geminiComicDevMiddleware(env) {
  return {
    name: 'gemini-comic-dev-middleware',
    configureServer(server) {
      server.middlewares.use('/api/groq-proxy', (req, res, next) => {
        if (req.method === 'OPTIONS') {
          res.statusCode = 200
          res.end()
          return
        }
        if (req.method !== 'POST') {
          next()
          return
        }
        let rawBody = ''
        req.on('data', (chunk) => { rawBody += chunk })
        req.on('end', async () => {
          let parsed
          try {
            parsed = rawBody ? JSON.parse(rawBody) : {}
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid JSON body' }))
            return
          }

          if (parsed.provider === 'gemini-comic') {
            try {
              // Nhánh text dùng Groq (env.GROQ_API_KEY, cùng key với Groq
              // passthrough bên dưới); nhánh ảnh gọi Pollinations ẩn danh,
              // không cần apiKey — xem runGeminiComicGenerate.
              const payload = await runGeminiComicGenerate({
                action: parsed.action,
                contents: parsed.contents,
                config: parsed.config,
                envSource: env,
              })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[gemini-comic-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Comic generate proxy error' }))
            }
            return
          }

          if (parsed.provider === 'vision-sync') {
            try {
              let payload
              if (parsed.action === 'vibe') {
                payload = await runVisionSyncVibe({
                  objects: parsed.objects,
                  emotion: parsed.emotion,
                  envSource: env,
                })
              } else if (parsed.action === 'liveToken') {
                payload = await createVisionSyncLiveToken({ envSource: env })
              } else {
                throw new VisionSyncProxyError('Unknown vision-sync action', 400)
              }
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[vision-sync-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Vision Sync proxy error' }))
            }
            return
          }

          if (parsed.provider === 'vibe-tracking') {
            try {
              let payload
              if (parsed.action === 'emotion') {
                payload = await runVibeTrackingEmotionAnalysis({
                  avgBlendshapes: parsed.avgBlendshapes,
                  dominantEmotion: parsed.dominantEmotion,
                  vibeValue: parsed.vibeValue,
                  numFaces: parsed.numFaces,
                  envSource: env,
                })
              } else if (parsed.action === 'sign') {
                payload = await runVibeTrackingSignAnalysis({
                  compactData: parsed.compactData,
                  envSource: env,
                })
              } else {
                throw new VibeTrackingProxyError('Unknown vibe-tracking action', 400)
              }
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[vibe-tracking-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Vibe Tracking proxy error' }))
            }
            return
          }

          if (parsed.provider === 'vibe-check') {
            try {
              const payload = await runVibeCheckGenerate({
                model: parsed.model,
                systemInstruction: parsed.systemInstruction,
                prompt: parsed.prompt,
                promptImage: parsed.promptImage,
                imageOutput: parsed.imageOutput,
                thinking: parsed.thinking,
                thinkingCapable: parsed.thinkingCapable,
                envSource: env,
              })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[vibe-check-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Vibe Check proxy error' }))
            }
            return
          }

          if (parsed.provider === 'video-to-learning') {
            try {
              const payload = await runVideoToLearningGenerate({
                prompt: parsed.prompt,
                videoUrl: parsed.videoUrl,
                envSource: env,
              })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[video-to-learning-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Video to Learning proxy error' }))
            }
            return
          }

          if (parsed.provider === 'kol-youtube-fetch') {
            try {
              const payload = await fetchYoutubeClipToR2(parsed.youtubeUrl, { envSource: env })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[kol-youtube-fetch-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error instanceof KolYoutubeDownloadError ? error.status : 500
              res.end(JSON.stringify({ error: error?.message || 'KOL YouTube fetch error' }))
            }
            return
          }

          if (parsed.provider === 'kol-r2-upload-url') {
            try {
              const payload = await createKolR2UploadUrl({ kind: parsed.kind, contentType: parsed.contentType, envSource: env })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[kol-r2-upload-url-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error instanceof KolR2UploadError ? error.status : 500
              res.end(JSON.stringify({ error: error?.message || 'KOL R2 upload URL error' }))
            }
            return
          }

          // Groq bình thường: forward y nguyên sang backend thật (dev-server
          // proxy chung không dùng được nữa vì stream đã bị đọc ở trên).
          try {
            const upstream = await fetch('https://ai-doctor-engine.vercel.app/api/groq-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: rawBody,
            })
            const text = await upstream.text()
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = upstream.status
            res.end(text)
          } catch (error) {
            console.error('[groq-proxy-dev-passthrough]', error?.message || error)
            res.setHeader('Content-Type', 'application/json')
            res.statusCode = 500
            res.end(JSON.stringify({ error: error?.message || 'Groq passthrough error' }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // loadEnv với prefix rỗng để đọc được ANTHROPIC_API_KEY (không có tiền tố
  // VITE_) từ file .env — biến này KHÔNG được đưa vào import.meta.env / bundle
  // client, chỉ dùng nội bộ trong middleware Node ở trên.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), inbodyOcrDevMiddleware(env), geminiComicDevMiddleware(env)],
    // Include .wasm so Vite processes `?url` imports from node_modules/@mediapipe
    assetsInclude: ['**/*.wasm', '**/*.PNG', '**/*.JPG', '**/*.JPEG', '**/*.HEIC'],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          mediapipeKhanh: resolve(__dirname, 'src/mediapipe-khanh/index.html'),
          visionSyncKhanh: resolve(__dirname, 'src/vision-sync-khanh/index.html'),
          videoToLearningKhanh: resolve(__dirname, 'src/video-to-learning-khanh/index.html'),
          videoToLearningKhanhAdmin: resolve(__dirname, 'src/video-to-learning-khanh/admin.html'),
          dinoJumpKhanh: resolve(__dirname, 'src/dino-jump-khanh/index.html'),
          vibeTrackingKhanh: resolve(__dirname, 'src/vibe-tracking-khanh/index.html'),
          vibeCheckKhanh: resolve(__dirname, 'src/vibe-check-khanh/index.html'),
        },
      },
    },
    worker: {
      format: 'es',
    },
    server: {
      proxy: {
        // Proxy /api/* (trừ /api/inbody-analyze đã được middleware ở trên xử
        // lý riêng) và /health sang FastAPI backend.
        // LƯU Ý: đây là reverse-proxy thô (http-proxy), chỉ dùng 1 key
        // ANTHROPIC_API_KEY duy nhất cho dev local — KHÔNG chạy qua
        // withApiKeyRotation()/apiKeyPool.js (cơ chế đó chỉ áp dụng cho
        // Serverless Function thật ở api/anthropic-proxy.js khi deploy lên
        // Vercel). Muốn test rotation cục bộ, dùng `vercel dev` thay vì
        // `npm run dev`.
        '/api/anthropic-proxy': {
          target: 'https://api.anthropic.com',
          changeOrigin: true,
          rewrite: () => '/v1/messages',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const key = process.env.ANTHROPIC_API_KEY || ''
              proxyReq.setHeader('x-api-key', key)
              proxyReq.setHeader('anthropic-version', '2023-06-01')
            })
          },
        },
        '/api': {
          target: 'https://ai-doctor-engine.vercel.app',
          changeOrigin: true,
        },
        '/health': {
          target: 'https://ai-doctor-engine.vercel.app',
          changeOrigin: true,
        },
      },
    },
  }
})
