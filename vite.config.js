import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { runInbodyOcr } from './api/_lib/inbodyOcr.js'
import { runGeminiComicGenerate } from './api/_lib/geminiComic.js'
import { runDinoPalGenerate, DinoPalProxyError } from './api/_lib/dinoPalProxy.js'
import { runVisionSyncVibe, createVisionSyncLiveToken, VisionSyncProxyError } from './api/_lib/visionSyncProxy.js'
import { runVibeTrackingEmotionAnalysis, runVibeTrackingSignAnalysis, VibeTrackingProxyError } from './api/_lib/vibeTrackingProxy.js'
import { runVibeCheckGenerate, VibeCheckProxyError } from './api/_lib/vibeCheckProxy.js'
import { runVideoToLearningGenerate, VideoToLearningProxyError } from './api/_lib/videoToLearningProxy.js'
import { fetchYoutubeClipToR2, KolYoutubeDownloadError } from './api/_lib/kolYoutubeDownload.js'
import { fetchFacebookClipToR2, FacebookDownloadError } from './api/_lib/facebookDownload.js'
import { createKolR2UploadUrl, KolR2UploadError } from './api/_lib/kolR2Upload.js'
import { createVideoAnalyzerR2UploadUrl, uploadVideoAnalyzerFromR2, checkVideoAnalyzerFile, generateVideoAnalyzerContent, VideoAnalyzerProxyError } from './api/_lib/videoAnalyzerProxy.js'
import { runBringAnyIdeaToLifeGenerate, BringAnyIdeaToLifeProxyError, createBringAnyIdeaToLifeVideoUploadUrl, uploadBringAnyIdeaToLifeVideoToGemini, checkBringAnyIdeaToLifeVideoFile } from './api/_lib/bringAnyIdeaToLifeProxy.js'
import { runImageToCodeGenerate, ImageToCodeProxyError } from './api/_lib/imageToCodeProxy.js'

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

          if (parsed.provider === 'dino-pal') {
            try {
              const payload = await runDinoPalGenerate({ name: parsed.name, envSource: env })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[dino-pal-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error instanceof DinoPalProxyError ? error.status : 500
              res.end(JSON.stringify({ error: error?.message || 'Dino pal proxy error' }))
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

          if (parsed.provider === 'video-analyzer') {
            try {
              let payload
              if (parsed.action === 'initR2Upload') {
                payload = await createVideoAnalyzerR2UploadUrl({ mimeType: parsed.mimeType, envSource: env })
              } else if (parsed.action === 'uploadToGemini') {
                payload = await uploadVideoAnalyzerFromR2({
                  publicUrl: parsed.publicUrl,
                  mimeType: parsed.mimeType,
                  displayName: parsed.displayName,
                  envSource: env,
                })
              } else if (parsed.action === 'checkFile') {
                payload = await checkVideoAnalyzerFile({ fileName: parsed.fileName, envSource: env })
              } else if (parsed.action === 'generate') {
                payload = await generateVideoAnalyzerContent({
                  promptText: parsed.promptText,
                  fileUri: parsed.fileUri,
                  mimeType: parsed.mimeType,
                  envSource: env,
                })
              } else {
                throw new VideoAnalyzerProxyError('Unknown video-analyzer action', 400)
              }
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[video-analyzer-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Video Analyzer proxy error' }))
            }
            return
          }

          if (parsed.provider === 'bring-any-idea-to-life') {
            try {
              const payload = await runBringAnyIdeaToLifeGenerate({
                prompt: parsed.prompt,
                fileBase64: parsed.fileBase64,
                mimeType: parsed.mimeType,
                videoUrl: parsed.videoUrl,
                imageUrl: parsed.imageUrl,
                webUrl: parsed.webUrl,
                geminiFileUri: parsed.geminiFileUri,
                geminiFileMimeType: parsed.geminiFileMimeType,
                geminiKeyLabel: parsed.geminiKeyLabel,
                frameImages: Array.isArray(parsed.frameImages) ? parsed.frameImages : undefined,
                envSource: env,
              })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[bring-any-idea-to-life-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Bring Any Idea to Life proxy error' }))
            }
            return
          }

          if (parsed.provider === 'bring-any-idea-to-life-video-upload') {
            try {
              let payload
              if (parsed.action === 'init') {
                payload = await createBringAnyIdeaToLifeVideoUploadUrl({ mimeType: parsed.mimeType, envSource: env })
              } else if (parsed.action === 'uploadToGemini') {
                payload = await uploadBringAnyIdeaToLifeVideoToGemini({
                  publicUrl: parsed.publicUrl,
                  mimeType: parsed.mimeType,
                  displayName: parsed.displayName,
                  envSource: env,
                })
              } else if (parsed.action === 'checkFile') {
                payload = await checkBringAnyIdeaToLifeVideoFile({ fileName: parsed.fileName, geminiKeyLabel: parsed.geminiKeyLabel, envSource: env })
              } else {
                throw new BringAnyIdeaToLifeProxyError('Unknown bring-any-idea-to-life-video-upload action', 400)
              }
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[bring-any-idea-to-life-video-upload-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error?.status || 500
              res.end(JSON.stringify({ error: error?.message || 'Bring Any Idea to Life video upload error' }))
            }
            return
          }

          if (parsed.provider === 'image-to-code') {
            try {
              const payload = await runImageToCodeGenerate({
                imageBase64: parsed.imageBase64,
                mimeType: parsed.mimeType,
                userInput: parsed.userInput,
                envSource: env,
              })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[image-to-code-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error instanceof ImageToCodeProxyError ? error.status : 500
              res.end(JSON.stringify({ error: error?.message || 'Image to Code proxy error' }))
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

          if (parsed.provider === 'kol-facebook-fetch') {
            try {
              const payload = await fetchFacebookClipToR2(parsed.facebookUrl, { envSource: env })
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = 200
              res.end(JSON.stringify(payload))
            } catch (error) {
              console.error('[kol-facebook-fetch-dev-middleware]', error?.message || error)
              res.setHeader('Content-Type', 'application/json')
              res.statusCode = error instanceof FacebookDownloadError ? error.status : 500
              res.end(JSON.stringify({ error: error?.message || 'KOL Facebook fetch error' }))
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

  // Liệt kê cả 2 dạng tên (camelCase dùng làm key entry trong
  // rollupOptions.input bên dưới, VÀ kebab-case nếu chunk output thực tế
  // lại dùng dạng đó, ví dụ "inbody-khanh-<hash>.js") — chỉ liệt kê 1 dạng
  // từng khiến filter im lặng bỏ sót do không khớp chuỗi, làm mất tác dụng
  // cô lập. Đưa ra ngoài dùng chung cho cả 2 chỗ lọc bên dưới (JS
  // modulepreload VÀ CSS <link rel="stylesheet">) để tránh lệch danh sách.
  const subAppEntryNames = [
    'mediapipeKhanh', 'visionSyncKhanh', 'videoToLearningKhanh',
    'videoToLearningKhanhAdmin', 'dinoJumpKhanh', 'prismHairKhanh',
    'dinoPalKhanh', 'vibeTrackingKhanh', 'vibeCheckKhanh',
    'videoAnalyzerKhanh', 'bringAnyIdeaToLifeKhanh',
    'humanTankCameraKeyReact', 'coTheTankCameraKeyReact',
    'bodyProtectionHtmlReact', 'inbodyKhanh', 'inbody-khanh',
  ]

  // FIX: ngoài <link rel="modulepreload"> (đã lọc ở modulePreload.resolveDependencies
  // bên dưới), Vite/Rollup còn tự chèn <link rel="stylesheet"> của CSS thuộc
  // các app con "-khanh" KHÔNG liên quan vào <head> của trang chủ (và của
  // các app con khác) — resolveDependencies KHÔNG áp dụng cho CSS, chỉ cho
  // JS modulepreload. Hậu quả nghiêm trọng hơn cả phần JS: CSS của
  // mediapipe-khanh có rule toàn cục "body{height:100vh;overflow:hidden}"
  // (không scope), nên khi <link> này bị chèn vào trang chủ, nó GHI ĐÈ
  // luôn overflow của <body> trang chủ → chặn cuộn trang NGAY khi vừa
  // load xong, dù khoá overflow không hề nằm trong code trang chủ. Đây là
  // nguyên nhân gốc của lỗi "scroll không được khi vừa vào loading trang"
  // (xác nhận bằng repro build: xem <link rel="stylesheet" href="mediapipeKhanh-*.css">
  // và "dinoJumpKhanh-*.css" xuất hiện trong index.html của entry "main").
  // Plugin dưới đây dùng transformIndexHtml (order: 'post', chạy sau khi
  // Vite đã tự chèn asset tags) để gỡ bỏ các <link rel="stylesheet"> không
  // thuộc về entry hiện tại, cùng logic với resolveDependencies bên dưới.
  function stripForeignSubAppCssPlugin() {
    return {
      name: 'strip-foreign-subapp-css',
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          const hostName = ctx.chunk?.name || ''
          const hostBelongsToSubApp = subAppEntryNames.some((name) => hostName.includes(name))
          return html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*/g, (tag, href) => {
            const depBelongsToOtherSubApp = subAppEntryNames.some(
              (name) => href.includes(name) && !hostName.includes(name),
            )
            if (depBelongsToOtherSubApp) return ''
            if (!hostBelongsToSubApp && subAppEntryNames.some((name) => href.includes(name))) {
              return ''
            }
            return tag
          })
        },
      },
    }
  }

  return {
    plugins: [react(), inbodyOcrDevMiddleware(env), geminiComicDevMiddleware(env), stripForeignSubAppCssPlugin()],
    // Include .wasm so Vite processes `?url` imports from node_modules/@mediapipe
    assetsInclude: ['**/*.wasm', '**/*.PNG', '**/*.JPG', '**/*.JPEG', '**/*.HEIC'],
    build: {
      // Cả 2 lần `vite build` (BUILD_TARGET=main rồi BUILD_TARGET=subapps)
      // đều ghi ra CÙNG 1 thư mục `dist`. Vite mặc định emptyOutDir=true
      // khi outDir nằm trong root -> lần build subapps chạy SAU sẽ XOÁ
      // SẠCH output của lần build main chạy TRƯỚC nếu không tắt đi. Chỉ
      // dọn dist 1 LẦN DUY NHẤT, ở lần build đầu tiên (main); lần build
      // subapps chỉ được PHÉP GHI THÊM vào, không được xoá.
      emptyOutDir: process.env.BUILD_TARGET !== 'subapps',
      // FIX: trang chủ (entry "main") đang bị Rollup/Vite tự chèn
      // <link rel="modulepreload"> cho chunk của các app con KHÔNG liên
      // quan (mediapipe-khanh, vision-sync-khanh, vibe-tracking-khanh,
      // dino-jump-khanh, inbody-khanh, vibe-check-khanh, ...) ngay trong
      // <head> — khiến trình duyệt tự tải + chạy MediaPipe/camera/audio
      // NGAY khi vừa mở trang chủ (chưa bấm gì), gây "Trang không phản
      // hồi" ~50s. Nguyên nhân: build gộp >15 entry HTML trong 1 lần
      // `vite build` (xem comment "Cô lập code nguồn của từng app con"
      // bên dưới — vốn chỉ mới xử lý phần chunk-splitting, chưa xử lý
      // phần modulepreload). resolveDependencies dưới đây lọc lại: mỗi
      // trang HTML CHỈ được preload chunk của chính nó + chunk dùng
      // chung thật sự (không khớp pattern "<Tên>Khanh-<hash>.js" của bất
      // kỳ entry app con nào khác).
      modulePreload: {
        resolveDependencies: (filename, deps, { hostId }) => {
          const hostBelongsToSubApp = subAppEntryNames.some((name) => hostId.includes(name))
          return deps.filter((dep) => {
            const depBelongsToOtherSubApp = subAppEntryNames.some(
              (name) => dep.includes(name) && !hostId.includes(name),
            )
            if (depBelongsToOtherSubApp) return false
            // Trang chủ ("main", không thuộc app con nào) không cần
            // preload bất kỳ chunk "-khanh"/game nào của app con khác.
            if (!hostBelongsToSubApp && subAppEntryNames.some((name) => dep.includes(name))) {
              return false
            }
            return true
          })
        },
      },
      // FIX GỐC RỄ (thay cho việc vá manualChunks từng trường hợp một —
      // xem lịch sử 33c5614/3876809/lần sửa "shared-app-styles" ở dưới,
      // mỗi lần vá lại lòi ra 1 kiểu leak MỚI: react nhét nhầm chunk, CSS
      // dùng chung bị xoá nhầm, rồi giờ tới `import "./mediapipeKhanh-*.js"`
      // side-effect-only mà Rollup TỰ giữ lại dù binding đã bị tree-shake
      // hết — xác nhận qua build --minify false: 2 dòng `import
      // "./mediapipeKhanh-*.js"` / `import "./visionSyncKhanh-*.js"`
      // KHÔNG có named export nào, chỉ để đảm bảo side-effect, main.js vẫn
      // TỰ chạy code app con dù không hề cần symbol nào của nó).
      // NGUYÊN NHÂN THẬT SỰ: build 15 entry HTML trong CÙNG 1 lần
      // `vite build` khiến Rollup's chunk-splitting algorithm có vô số
      // cách "hợp lý" để nhóm module dùng chung, và không có cách nào vá
      // bằng manualChunks đủ để loại trừ HẾT các trường hợp — mỗi lần vá
      // xong lại lòi ra 1 dạng leak khác. Cách triệt để: KHÔNG cho trang
      // chủ ("main") build CÙNG LÚC với bất kỳ app con "-khanh" nào nữa —
      // tách thành 2 lần gọi `vite build` riêng biệt (xem package.json:
      // "build" giờ chạy "build:main" rồi "build:subapps", điều khiển qua
      // biến môi trường BUILD_TARGET). Khi build main ĐƠN ĐỘC, Rollup
      // không có module nào của 14 entry còn lại trong đồ thị để nhầm lẫn
      // — loại bỏ HẲN cả lớp lỗi này bằng cấu trúc, không phải heuristic.
      rollupOptions: {
      input: (() => {
        const ALL_INPUTS = {
          main: resolve(__dirname, 'index.html'),
          mediapipeKhanh: resolve(__dirname, 'src/mediapipe-khanh/index.html'),
          visionSyncKhanh: resolve(__dirname, 'src/vision-sync-khanh/index.html'),
          videoToLearningKhanh: resolve(__dirname, 'src/video-to-learning-khanh/index.html'),
          videoToLearningKhanhAdmin: resolve(__dirname, 'src/video-to-learning-khanh/admin.html'),
          dinoJumpKhanh: resolve(__dirname, 'src/dino-jump-khanh/index.html'),
          prismHairKhanh: resolve(__dirname, 'src/prism-hair-khanh/index.html'),
          dinoPalKhanh: resolve(__dirname, 'src/dino-pal-khanh/index.html'),
          vibeTrackingKhanh: resolve(__dirname, 'src/vibe-tracking-khanh/index.html'),
          vibeCheckKhanh: resolve(__dirname, 'src/vibe-check-khanh/index.html'),
          videoAnalyzerKhanh: resolve(__dirname, 'src/video-analyzer-khanh/index.html'),
          bringAnyIdeaToLifeKhanh: resolve(__dirname, 'src/bring-any-idea-to-life-khanh/index.html'),
          humanTankCameraKeyReact: resolve(__dirname, 'src/games/human-tank-camera-key.html'),
          coTheTankCameraKeyReact: resolve(__dirname, 'src/games/co-the-tank-camera-key.html'),
          bodyProtectionHtmlReact: resolve(__dirname, 'src/games/body-protection-html.html'),
        }
        const target = process.env.BUILD_TARGET // 'main' | 'subapps' | undefined
        if (target === 'main') return { main: ALL_INPUTS.main }
        if (target === 'subapps') {
          const { main, ...rest } = ALL_INPUTS
          return rest
        }
        // Không set BUILD_TARGET (vd `vite build` chạy tay, hoặc dev
        // server) -> giữ nguyên hành vi cũ, build/serve tất cả gộp chung.
        return ALL_INPUTS
      })(),
        output: {
          // Cô lập code nguồn của từng app con "-khanh" (Dino Jump, Vision
          // Sync, Prism Hair, Bring Any Idea to Life, ...) vào chunk riêng
          // của chính nó, KHÔNG cho Rollup gộp/tách xen kẽ giữa các entry
          // khi build cùng lúc >15 trang trong 1 lần `vite build`. Thêm sau
          // khi phát hiện lỗi "DEMO_IMAGE_URL is not defined" trên Production
          // (bringAnyIdeaToLifeKhanh) ngay sau khi thêm entry prism-hair-khanh
          // — không tái hiện được ổn định ở local, nghi do Rollup tree-shake/
          // chunk-splitting tự động bị nhầm khi số lượng entry tăng lên. Việc
          // cô lập từng app con theo tên thư mục giúp loại bỏ hẳn rủi ro này
          // mà không ảnh hưởng tới vendor chunk chung (node_modules vẫn được
          // Rollup tự gộp bình thường vì không khớp pattern bên dưới).
          manualChunks: (() => {
            // Cache DÙNG CHUNG giữa mọi lần gọi manualChunks (không phải mỗi
            // module 1 cache riêng) — tránh duyệt lại đồ thị import nhiều
            // lần cho cùng 1 module khi Rollup gọi callback này lặp lại.
            const outsideReachCache = new Map()
            function isReachableFromOutsideSubApp(id, ownName, getModuleInfo, visiting) {
              if (outsideReachCache.has(id)) return outsideReachCache.get(id)
              if (visiting.has(id)) return false // cắt vòng lặp (circular import) — coi như chưa xác định được từ nhánh này
              visiting.add(id)
              const info = getModuleInfo(id)
              let result = false
              for (const importerId of info?.importers || []) {
                if (/[\\/]node_modules[\\/]/.test(importerId)) continue // vendor code KHÔNG được tự ý import ngược app source -> bỏ qua, không tính là "outside" hợp lệ ở đây
                const importerMatch = importerId.match(/[\\/]src[\\/]([a-z0-9-]+-khanh)[\\/]/)
                const importerSameSubApp = importerMatch && importerMatch[1] === ownName
                if (!importerSameSubApp) {
                  // Importer là code trang chủ HOẶC 1 app con "-khanh" KHÁC
                  // -> module này thật sự dùng chung, không phải riêng của
                  // app con ownName.
                  result = true
                  break
                }
                // Importer cùng app con -> đệ quy lên tiếp: chính importer
                // đó có bị import từ bên ngoài không (bắt các trường hợp
                // gián tiếp qua nhiều lớp file nội bộ trước khi chạm ra
                // ngoài — đây là lý do fix nông 1-lớp trước đó KHÔNG đủ,
                // xác nhận bằng build thật vẫn còn "Circular chunk" +
                // main.js vẫn static-import dinoJumpKhanh/mediapipeKhanh/
                // vibeTrackingKhanh/visionSyncKhanh sau lần sửa đầu).
                if (isReachableFromOutsideSubApp(importerId, ownName, getModuleInfo, visiting)) {
                  result = true
                  break
                }
              }
              visiting.delete(id)
              outsideReachCache.set(id, result)
              return result
            }
            return function manualChunks(id, { getModuleInfo }) {
            // Ép các thư viện dùng chung phổ biến nhất (react, react-dom,
            // jsx-runtime) luôn về 1 vendor chunk cố định, kiểm tra TRƯỚC
            // rule "-khanh" bên dưới. Nếu không, khi build gộp >15 entry
            // trong 1 lần `vite build`, Rollup có thể "nhét" bản build
            // react/react-dom dùng chung vào bên trong đúng 1 app con cụ
            // thể (vd visionSyncKhanh, ~2.7MB) — và vì đó là nơi DUY NHẤT
            // chứa react trong toàn bộ build, main.js (trang chủ) buộc phải
            // import react TỪ chunk app con đó, kéo theo toàn bộ code +
            // side-effect top-level của app con (Tone.js banner, MediaPipe
            // GPU init, ...) chạy ngay trên trang chủ dù không hề dùng tới.
            // Phát hiện qua Network > Initiator chain: main.js → chính là
            // initiator trực tiếp của visionSyncKhanh-*.js.
            // Mở rộng: KHÔNG chỉ react/react-dom mà TOÀN BỘ node_modules đều
            // ép về 1 (hoặc vài) vendor chunk cố định trước rule "-khanh".
            // Lý do: sau khi cô lập riêng react/react-dom vẫn còn thấy
            // main.js phải import chéo từ vibeTrackingKhanh/dinoJumpKhanh/
            // vibeCheckKhanh/inbody-khanh/visionSyncKhanh — tức còn nhiều
            // package npm dùng chung khác (icon, state, utils, ...) bị lọt
            // tương tự react lúc trước. Gộp hẳn node_modules về vendor
            // chung là cách chuẩn, chặn dứt điểm cả lớp lỗi này thay vì vá
            // từng package một.
            if (/[\\/]node_modules[\\/]/.test(id)) {
              return 'vendor'
            }
            // FIX: src/index.css (Tailwind + toàn bộ CSS gốc của cả site) được
            // TẤT CẢ 9 app con "-khanh" import DÙNG CHUNG qua
            // `import '../../index.css'` (xem comment trong từng main.tsx) —
            // không phải app con nào có CSS riêng. Vì nhiều entry HTML cùng
            // import 1 file CSS này, Rollup gộp nó vào 1 chunk CSS chung DUY
            // NHẤT, nhưng lại tự đặt tên chunk đó trùng tên 1 trong các app
            // con (vd "visionSyncKhanh-*.css") thay vì "main". Hậu quả:
            // stripForeignSubAppCssPlugin ở trên (vốn chỉ nhằm chặn CSS
            // RIÊNG của app con khác leak sang) hiểu nhầm đây là CSS riêng
            // của visionSyncKhanh và XOÁ LUÔN <link> CSS này khỏi trang chủ —
            // khiến trang chủ/landing/chooseRole/hero/login build ra KHÔNG
            // CÓ file CSS nào (xác nhận qua build thật: dist/index.html
            // không còn thẻ <link rel="stylesheet"> nào), vỡ toàn bộ layout
            // kể cả các class Tailwind điều khiển scroll — nguyên nhân của
            // lỗi "landing/2 trang anh hùng/login không scroll được".
            // Ép file này về 1 chunk tên cố định, KHÔNG trùng bất kỳ tên nào
            // trong subAppEntryNames, để không bao giờ bị 2 filter ở trên
            // (modulePreload + CSS) coi nhầm là "CSS riêng của app con khác"
            // và xoá mất — chunk này sẽ được giữ lại đúng ở MỌI entry cần nó.
            if (/[\\/]src[\\/]index\.css(\?|$)/.test(id)) {
              return 'shared-app-styles'
            }
            const match = id.match(/[\\/]src[\\/]([a-z0-9-]+-khanh)[\\/]/)
            if (match) {
              const ownName = match[1]
              // FIX (cùng nguyên lý với index.css ở trên, tổng quát hoá):
              // 1 module tuy NẰM VẬT LÝ trong thư mục "-khanh" nhưng lại
              // được import TRỰC TIẾP bởi ≥1 module KHÔNG thuộc app con đó
              // (vd trang chủ, hoặc 1 app con khác) → đây là dependency
              // DÙNG CHUNG thực sự, không phải code riêng của app con này.
              // Nếu vẫn ép nó vào chunk riêng của app con, entry dùng
              // chung (trang chủ) buộc phải static-import cả chunk đó,
              // kéo theo TOÀN BỘ side-effect top-level của app con (Tone.js
              // tự start AudioContext, MediaPipe GPU init, createRoot cố
              // mount...) chạy ngay trên trang chủ dù không hề dùng tới.
              // XÁC NHẬN qua Console Production thật (sau khi đã có guard
              // #id không crash ở 33c5614): visionSyncKhanh/dinoJumpKhanh/
              // mediapipeKhanh/vibeTrackingKhanh vẫn cùng load + chạy log
              // "bỏ qua khởi tạo" NGAY khi vừa mở trang chủ landing — main.js
              // (dist/assets/main-*.js) chứa thẳng
              // `import{...}from"./dinoJumpKhanh-*.js"` v.v. Rollup cũng tự
              // cảnh báo lúc build: "Circular chunk: dino-jump-khanh ->
              // mediapipe-khanh -> vendor -> dino-jump-khanh".
              // Chỉ kiểm tra importer TRỰC TIẾP (không đệ quy hết đồ thị,
              // đủ bắt các trường hợp đã xác nhận, tránh build quá chậm) —
              // nếu có ≥1 importer trực tiếp không phải cùng app con này
              // và không phải node_modules → coi là "dùng chung", gộp
              // vào 'vendor' (đã ổn định, không bị 2 filter CSS/modulepreload
              // đụng tới vì không khớp subAppEntryNames).
              const hasOutsideImporter = isReachableFromOutsideSubApp(id, ownName, getModuleInfo, new Set())
              if (hasOutsideImporter) return 'vendor'
              return ownName
            }
          }
          })(),
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
