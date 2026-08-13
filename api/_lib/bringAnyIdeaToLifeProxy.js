// api/_lib/bringAnyIdeaToLifeProxy.js
// Backend cho tính năng "Bring Any Idea to Life" (chuyển đổi từ
// bring-any-idea-to-life.zip, app AI Studio gốc gọi thẳng @google/genai +
// API key nhúng client bằng process.env.API_KEY — KHÔNG an toàn để deploy
// thật). DÙNG CHUNG endpoint /api/groq-proxy (xem api/groq-proxy.js, field
// provider: 'bring-any-idea-to-life') — không tạo Serverless Function mới
// vì Vercel giới hạn 12 functions (đã dùng hết).
//
// TÍNH NĂNG: người dùng upload 1 ảnh/PDF (bản vẽ tay, sơ đồ, ảnh vật thể đời
// thường...), AI "nhìn" ảnh rồi sinh ra 1 trang HTML/CSS/JS độc lập, tương
// tác được — system instruction giữ nguyên y hệt bản gốc services/gemini.ts.
//
// KIẾN TRÚC FALLBACK TỰ ĐỘNG (Groq trước — MIỄN PHÍ, Gemini dự phòng — free
// tier nhưng giới hạn chặt/dễ hết quota, xem ghi chú bên dưới):
//   Bản đầu tiên của proxy này gọi thẳng Gemini 3 Pro (model trả phí) và bị
//   lỗi 429 "limit: 0" ngay cả khi có key — vì tài khoản Google AI Studio
//   miễn phí không được cấp quota cho model Pro (limit 0 trên free tier,
//   không phải do hết hạn mức mà do free tier vốn KHÔNG có quota cho model
//   này). Đổi sang dùng Groq trước (giống Video to Learning/Vibe Tracking):
//     - qwen/qwen3.6-27b: model multimodal (ảnh + text) MIỄN PHÍ của Groq,
//       hỗ trợ vision + sinh code tốt (agentic coding), thay cho
//       meta-llama/llama-4-scout-17b-16e-instruct đã bị Groq khai tử (xem
//       console.groq.com/docs/deprecations, thông báo 17/06/2026). Đây là
//       model vision hiện hành của Groq tại thời điểm viết code này — nếu
//       Groq lại đổi/khai tử model này trong tương lai, chỉ cần sửa hằng số
//       GROQ_VISION_MODEL bên dưới.
//   Nếu Groq lỗi ở TẤT CẢ các key (rate limit, model bị khai tử, outage...)
//   → tự động chuyển sang Gemini (dùng gemini-3.6-flash — bản Flash rẻ/free
//   tier thật, thay vì gemini-3-pro-preview — để tăng khả năng còn quota,
//   xem videoToLearningProxy.js dùng cùng model Flash này với lý do tương
//   tự) — chấp nhận chất lượng thấp hơn 1 chút ở nhánh dự phòng.
//
// KHÔNG chạy song song 2 bên cùng lúc — chỉ gọi Gemini khi Groq THỰC SỰ gặp
// sự cố, để tiết kiệm quota/tiền.

import { GoogleGenAI } from '@google/genai'
import { withApiKeyRotation, withApiKeyRacingThenRotation, getApiKeyByLabel, isRotatableApiError, toRotatableHttpError, countApiKeyPool } from './apiKeyPool.js'
import { fetchImageAsBase64, ImageUrlFetchError } from './imageUrlFetch.js'
import { fetchWebpageText, WebpageTextError } from './webpageText.js'
import { isFacebookVideoUrl, resolveFacebookVideo, FacebookVideoError } from './facebookVideo.js'
import { createR2PresignedUploadUrl, genR2Key } from './r2Storage.js'

export class BringAnyIdeaToLifeProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'BringAnyIdeaToLifeProxyError'
    this.status = status
  }
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b' // model vision MIỄN PHÍ hiện hành của Groq (xem ghi chú đầu file)
const GEMINI_MODEL = 'gemini-3.6-flash' // model Flash còn free tier thật, dùng làm dự phòng khi Groq lỗi
const R2_VIDEO_KEY_PREFIX = 'bring-any-idea-to-life/video-uploads'
const timeoutMs = 55_000 // thấp hơn timeout Serverless Function của Vercel (ảnh/PDF/text)
// Video (upload trực tiếp hoặc link YouTube/Facebook) tốn nhiều thời gian xử lý hơn
// ảnh tĩnh — dùng timeout dài hơn, vẫn dưới maxDuration 120s của api/groq-proxy.js
// (xem vercel.json), giống hệt GEMINI_TIMEOUT_MS của videoToLearningProxy.js.
const videoTimeoutMs = 110_000
// LƯU Ý QUAN TRỌNG (bài học từ sự cố 504 Gateway Timeout thực tế): tăng SỐ
// LẦN RETRY không giúp gì nếu mỗi lần retry vẫn được phép "ăn" trọn lại
// timeoutMs/videoTimeoutMs — 4 attempt x 55s có thể cộng dồn tới hơn 3 phút,
// vượt xa giới hạn thời gian THẬT SỰ mà nền tảng Vercel cho phép (khác với
// con số maxDuration khai báo trong vercel.json, vốn có thể bị nền tảng âm
// thầm giới hạn thấp hơn tuỳ gói) — khi đó Vercel tự cắt ngang bằng 504
// TRƯỚC KHI code kịp trả lỗi rõ ràng của riêng nó, làm mất luôn cả những lần
// retry đáng lẽ có thể thành công. Vì vậy KHÔNG dùng "số lần retry cố định",
// mà dùng "ngân sách thời gian cố định" — xem retryWithinBudget() bên dưới:
// tổng thời gian của TẤT CẢ các lần thử (kể cả retry) không bao giờ vượt quá
// đúng effectiveTimeoutMs ban đầu (con số đã biết là AN TOÀN dưới giới hạn
// thật của nền tảng, vì bản gốc chỉ gọi 1 lần với timeout này và không bao
// giờ bị 504). Chỉ retry khi lỗi là loại "thất bại nhanh" (503 quá tải,
// network reset...) và vẫn còn đủ ngân sách cho 1 lần thử nữa — KHÔNG retry
// sau khi đã hết hẳn 1 lượt timeout (đằng nào retry cũng sẽ timeout tiếp,
// chỉ tổ ngốn thêm ngân sách và làm tăng nguy cơ bị 504 giữa chừng).
const MIN_ATTEMPT_BUDGET_MS = 8_000 // dưới mức này thì không đáng thử thêm 1 lần nữa
const geminiRetryDelayMs = (attempt) => Math.min(800 * 2 ** attempt, 2000)

const withTimeout = (promise, ms) => {
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), ms)
  })
  return Promise.race([promise, timeout])
}

// Giữ nguyên y hệt system instruction gốc trong services/gemini.ts.
const SYSTEM_INSTRUCTION = `You are an expert AI Engineer and Product Designer specializing in "bringing artifacts to life".
Your goal is to take a user uploaded file or video—which might be a polished UI design, a messy napkin sketch, a photo of a whiteboard with jumbled notes, a picture of a real-world object (like a messy desk), or a video (uploaded directly, or a YouTube/Facebook video link) showing a process, demo, tutorial, or scene, or a webpage/homepage/channel URL whose text content describes a product, creator, community, or workflow—and instantly generate a fully functional, interactive, single-page HTML/JS/CSS application.

CORE DIRECTIVES:
1. **Analyze & Abstract**: Look at the image or watch the video.
    - **Sketches/Wireframes**: Detect buttons, inputs, and layout. Turn them into a modern, clean UI.
    - **Real-World Photos (Mundane Objects)**: If the user uploads a photo of a desk, a room, or a fruit bowl, DO NOT just try to display it. **Gamify it** or build a **Utility** around it.
      - *Cluttered Desk* -> Create a "Clean Up" game where clicking items (represented by emojis or SVG shapes) clears them, or a Trello-style board.
      - *Fruit Bowl* -> A nutrition tracker or a still-life painting app.
    - **Documents/Forms**: specific interactive wizards or dashboards.
    - **Videos**: Identify the key subject, action, process, or steps shown across the video (not just a single frame). If it's a tutorial or demo, turn it into an interactive step-by-step walkthrough or simulator of that process. If it's a real-world scene or activity, gamify it or build a utility inspired by what happens in it, same spirit as the real-world photo case above.
    - **Webpages / Channels / Homepages**: Use the extracted page title, URL, headings, and text to infer the core brand, navigation, audience, products, and calls-to-action. Turn that into an interactive landing page, dashboard, guide, funnel, or mini-app inspired by the source.

2. **NO EXTERNAL IMAGES**:
    - **CRITICAL**: Do NOT use <img src="..."> with external URLs (like imgur, placeholder.com, or generic internet URLs). They will fail.
    - **INSTEAD**: Use **CSS shapes**, **inline SVGs**, **Emojis**, or **CSS gradients** to visually represent the elements you see in the input.
    - If you see a "coffee cup" in the input, render a ☕ emoji or draw a cup with CSS. Do not try to load a jpg of a coffee cup.

3. **Make it Interactive**: The output MUST NOT be static. It needs buttons, sliders, drag-and-drop, or dynamic visualizations.
4. **Self-Contained**: The output must be a single HTML file with embedded CSS (<style>) and JavaScript (<script>). No external dependencies unless absolutely necessary (Tailwind via CDN is allowed).
5. **Robust & Creative**: If the input is messy or ambiguous, generate a "best guess" creative interpretation. Never return an error. Build *something* fun and functional.

RESPONSE FORMAT:
Return ONLY the raw HTML code. Do not wrap it in markdown code blocks (\`\`\`html ... \`\`\`). Start immediately with <!DOCTYPE html>.`

// Bug đã gặp: qwen/qwen3.6-27b là reasoning model, mặc định trả về cả khối
// <think>...</think> TRƯỚC phần code thật. Hệ quả kép:
//   1. cleanHtml() trước đây chỉ dọn markdown fence, không dọn <think> — nên
//      toàn bộ nội dung suy luận (text thô, không phải HTML) bị nhét thẳng
//      vào iframe preview và hiển thị ra như text thường (không phải web app
//      thật) — đây là nguyên nhân của bug "chỉ ra text/JSON, không ra web
//      preview" và cũng là nguyên nhân bug màu chữ trùng nền trước đó.
//   2. Không set max_tokens → phần <think> (có thể rất dài) ngốn gần hết
//      ngân sách token, khiến HTML thật bị cắt cụt giữa chừng (thiếu
//      </style>, <body>, <script>...) trước khi kịp sinh xong.
// Fix: (a) reasoning_format: 'hidden' để Groq tự bỏ hẳn phần suy luận khỏi
// response (model vẫn "nghĩ" nhưng không trả về, theo docs Groq), dồn toàn
// bộ ngân sách token cho code thật; (b) đặt max_tokens đủ lớn cho 1 trang
// HTML/CSS/JS đầy đủ; (c) cleanHtml() vẫn dọn phòng hờ <think> nếu lỡ còn
// sót (ví dụ nhánh fallback Gemini, hoặc Groq đổi hành vi trong tương lai).
// LƯU Ý QUAN TRỌNG (sự cố thực tế 13/08/2026): free tier "on_demand" của Groq
// giới hạn TPM (tokens per minute) = 8000 cho model này — và giới hạn đó áp
// dụng cho TỪNG REQUEST (input + max_tokens dành cho output), KHÔNG PHẢI chỉ
// tính tổng nhiều request cộng dồn trong 1 phút. Log lỗi thực tế: "Limit
// 8000, Requested 11204" với max_tokens=8000 -> suy ra input (system
// instruction ~750 token + prompt + 1 ảnh 1080x720) đã chiếm ~3200 token.
// Lần sửa ĐẦU TIÊN chỉ hạ max_tokens xuống 4000 để né lỗi 429 — nhưng lại
// gây ra bug MỚI: HTML bị cắt cụt giữa chừng (chạm max_tokens trước khi sinh
// xong đủ </style>/</body>/</script>) -> trang trắng, xem finish_reason ===
// 'length' trong callGroqVision() ở trên (nay coi là lỗi thay vì "thành
// công" âm thầm trả HTML hỏng).
// FIX ĐÚNG (2 phần, không chỉ chỉnh 1 con số): (a) giảm dimension ảnh gửi
// lên (xem MAX_DIMENSION trong lib/imageCompress.ts, 1600 -> 1024px) để
// giảm token ẢNH tốn cho input, chừa nhiều ngân sách hơn cho output; (b)
// tăng max_tokens lên 5500 (thay vì giữ nguyên 8000 gốc, vốn đã được chứng
// minh vượt quá 8000 TPM ngay cả khi ảnh nhỏ hơn) — với input đã giảm còn
// ước tính ~1800-2200 token (750 system + ảnh 1024px nhẹ hơn nhiều), tổng
// input + max_tokens vẫn nằm dưới 8000 với biên độ an toàn cho prompt dài
// hơn. Nếu vẫn gặp finish_reason 'length' với ảnh phức tạp/prompt dài, hạ
// tiếp con số này hoặc dimension ảnh, KHÔNG tăng ngược lại quá 8000 - (input
// ước tính) vì sẽ lại ăn lỗi 429 TPM như cũ.
//
// SỰ CỐ LẶP LẠI LẦN 2 (14/08/2026): estimate ~1800-2200 token input ở trên
// SAI TRONG THỰC TẾ — log lỗi mới cho thấy "Limit 8000, Requested 8704" với
// max_tokens=5500, tức input THẬT SỰ đã ~3200 token ngay cả ở ảnh 1024px
// (ảnh chụp màn hình/screenshot có nhiều chi tiết/text tốn nhiều token hơn
// ảnh chụp vật thể đơn giản dùng để test ban đầu). QUAN TRỌNG: đổi SANG KEY
// KHÁC (rotation/racing) KHÔNG giúp gì cho lỗi này — "Request too large" là
// giới hạn TPM CỦA MODEL trên toàn bộ free tier "on_demand", ÁP DỤNG NHƯ
// NHAU cho MỌI key/tài khoản free, không phải lỗi "riêng key này hết hạn
// mức" — đổi key nào cũng lỗi y hệt. Cách fix DUY NHẤT thật sự hiệu quả là
// giảm tiếp kích thước request. Hạ thêm: MAX_DIMENSION 1024 -> 768 (giảm
// mạnh token ảnh, vì token ảnh tỉ lệ ~bậc 2 theo cạnh: 768² / 1024² ≈ 0.56)
// và GROQ_MAX_TOKENS 5500 -> 4800 (chừa thêm biên độ ~700 token) — mục tiêu
// input (~2000-2400) + max_tokens (4800) ≈ 6800-7200, có biên độ an toàn rõ
// rệt dưới mức 8000 thay vì sát nút như trước.
const GROQ_MAX_TOKENS = 4800

function cleanHtml(text) {
  let out = text || ''
  // Dọn hẳn khối <think>...</think> nếu model lỡ trả kèm (phòng hờ, xem ghi chú trên).
  out = out.replace(/<think>[\s\S]*?<\/think>/gi, '')
  // Phòng trường hợp bị cắt cụt giữa chừng khối <think> (không có thẻ đóng):
  // bỏ luôn từ <think> tới hết, vì phần sau đó (nếu có) không phải HTML thật.
  out = out.replace(/<think>[\s\S]*$/i, '')
  // Dọn markdown fence nếu model vẫn lỡ bọc bất chấp system instruction.
  out = out.replace(/^\s*```html\s*/i, '').replace(/^\s*```\s*/, '').replace(/```\s*$/, '')
  return out.trim()
}

// --- Groq (vision, miễn phí, ưu tiên gọi trước) ---
async function callGroqVision({ prompt, fileBase64, mimeType, envSource }) {
  const content = [{ type: 'text', text: prompt }]
  if (fileBase64 && mimeType) {
    content.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${fileBase64}` } })
  }

  const body = {
    model: GROQ_VISION_MODEL,
    messages: [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content },
    ],
    temperature: 0.5,
    max_tokens: GROQ_MAX_TOKENS,
    reasoning_format: 'hidden', // qwen3.x: ẩn hẳn <think>, dồn token cho code thật (xem ghi chú trên)
  }

  // Đua song song 2 key đầu để giảm độ trễ, rồi TỰ ĐỘNG dò tuần tự các key
  // dự phòng còn lại trong pool nếu cả nhóm đua đều lỗi (sự cố thực tế
  // 13/08/2026: withApiKeyRacing() đơn thuần chỉ đua đúng 2 key rồi bỏ cuộc,
  // 2 key dự phòng khác trong pool 4 key KHÔNG BAO GIỜ được thử tới — xem
  // ghi chú đầy đủ ở withApiKeyRacingThenRotation() trong apiKeyPool.js).
  const data = await withApiKeyRacingThenRotation('GROQ_API_KEY', async (apiKey) => {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
    return res.json()
  }, { envSource })

  const choice = data?.choices?.[0]
  // BUG THỰC TẾ (sự cố 13/08/2026): trước đây hàm này coi MỌI content trả về
  // (kể cả bị cắt cụt giữa chừng vì chạm max_tokens) là THÀNH CÔNG — nên khi
  // hạ GROQ_MAX_TOKENS để né lỗi 429 "Request too large" (xem ghi chú ở
  // GROQ_MAX_TOKENS bên dưới), HTML bị cắt cụt (thiếu </style>/</body>/
  // </script>) vẫn được trả thẳng cho client -> hiện trang TRẮNG, không có
  // lỗi nào được báo. Groq trả `finish_reason: 'length'` khi bị cắt vì hết
  // max_tokens (khác 'stop' = sinh xong bình thường) — coi trường hợp này là
  // THẤT BẠI để runBringAnyIdeaToLifeGenerate() tự động rơi xuống Gemini,
  // thay vì âm thầm trả về HTML hỏng.
  if (choice?.finish_reason === 'length') {
    throw new Error(
      'Groq trả về HTML bị cắt cụt (chạm giới hạn max_tokens trước khi sinh xong trang) — ảnh/prompt có thể quá phức tạp cho ngân sách token miễn phí.',
    )
  }

  return choice?.message?.content || ''
}


// --- Upload video LỚN qua R2 thay vì nhồi base64 vào JSON body ---
// TẠI SAO: base64 video được gửi thẳng trong JSON body (inlineData) trước
// đây bị giới hạn cứng bởi Vercel Serverless Function (~4.5MB request body,
// base64 lại phình ~33% so với file gốc) — nên client phải chặn upload
// video/PDF ở mức MAX_UNCOMPRESSED_FILE_BYTES = 3MB (xem App.tsx), khiến
// video "vài MB" (rất bình thường, kể cả video 10-15 giây) đã bị từ chối.
// GIẢI PHÁP (giống hệt video-analyzer-khanh — xem videoAnalyzerProxy.js):
//   1. initVideoUpload  — server ký presigned PUT URL lên R2 (KHÔNG qua
//                         Serverless Function body, không giới hạn 4.5MB).
//                         Trình duyệt PUT bytes video thẳng lên R2.
//   2. uploadVideoToGemini — SAU KHI upload R2 xong, server (không phải
//                         trình duyệt, nên không bị CORS từ phía Gemini)
//                         tải bytes từ R2 rồi đẩy sang Gemini Files API
//                         (ai.files.upload) — trả về 1 fileUri Gemini có thể
//                         "xem" thẳng, không cần base64 trong request nữa.
//   3. checkVideoFile   — poll trạng thái xử lý (PROCESSING -> ACTIVE),
//                         Gemini cần vài giây để xử lý video vừa upload.
//   4. Nhánh video của runBringAnyIdeaToLifeGenerate() nhận geminiFileUri đã
//      upload sẵn, gọi callGemini với fileData:{fileUri} y hệt cách đã dùng
//      cho link YouTube — không còn giới hạn 3MB nào áp dụng cho video nữa.

function extFromMimeType(mimeType) {
  const sub = String(mimeType || '').split('/')[1] || 'mp4'
  return sub.split(';')[0]
}

export async function createBringAnyIdeaToLifeVideoUploadUrl({ mimeType, envSource }) {
  if (!mimeType || !mimeType.startsWith('video/')) {
    throw new BringAnyIdeaToLifeProxyError('mimeType phải là video/*.', 400)
  }
  const key = genR2Key(R2_VIDEO_KEY_PREFIX, extFromMimeType(mimeType))
  try {
    return await createR2PresignedUploadUrl({ key, contentType: mimeType, envSource })
  } catch (err) {
    throw new BringAnyIdeaToLifeProxyError(err?.message || 'R2 presign error', err?.status || 502)
  }
}

export async function uploadBringAnyIdeaToLifeVideoToGemini({ publicUrl, mimeType, displayName, envSource }) {
  if (!publicUrl || !mimeType) {
    throw new BringAnyIdeaToLifeProxyError('Missing publicUrl/mimeType', 400)
  }

  let videoBuffer
  try {
    const r2Res = await fetch(publicUrl)
    if (!r2Res.ok) {
      throw new BringAnyIdeaToLifeProxyError(`Không tải được video vừa upload từ R2 (HTTP ${r2Res.status}).`, 502)
    }
    videoBuffer = Buffer.from(await r2Res.arrayBuffer())
  } catch (err) {
    if (err instanceof BringAnyIdeaToLifeProxyError) throw err
    throw new BringAnyIdeaToLifeProxyError(err?.message || 'Không đọc được video từ R2.', 502)
  }

  try {
    // Đua song song (giống callGroqVision/callGemini ở ảnh/PDF) thay vì dò
    // tuần tự — TẠO FILE MỚI trên Gemini Files API không "thuộc về" key nào
    // trước đó (khác hẳn checkFile/generate bên dưới, vốn phải gọi lại ĐÚNG
    // key đã tạo file), nên đua song song vẫn an toàn và giảm độ trễ khi
    // 1-2 key đầu đang bị rate limit. QUAN TRỌNG: phải nhớ lại label của key
    // THẮNG CUỘC (`label` — tham số thứ 2 của callback) và trả về cho
    // client, vì các bước SAU (checkFile, rồi generate) bắt buộc phải dùng
    // lại chính xác key này — file chỉ tồn tại trong tài khoản của key đã
    // upload nó, gọi nhầm key khác sẽ báo lỗi "not found" giả.
    return await withApiKeyRacingThenRotation('GEMINI_API_KEY', async (apiKey, label) => {
      const ai = new GoogleGenAI({ apiKey })
      const file = await ai.files.upload({
        file: new Blob([videoBuffer], { type: mimeType }),
        config: { mimeType, displayName: displayName || 'video' },
      })
      return { name: file.name, state: file.state, uri: file.uri, mimeType: file.mimeType || mimeType, geminiKeyLabel: label }
    }, { envSource })
  } catch (err) {
    if (err instanceof BringAnyIdeaToLifeProxyError) throw err
    throw new BringAnyIdeaToLifeProxyError(err?.message || 'Gemini Files upload error', err?.status || 502)
  }
}

export async function checkBringAnyIdeaToLifeVideoFile({ fileName, geminiKeyLabel, envSource }) {
  if (!fileName) throw new BringAnyIdeaToLifeProxyError('Missing fileName', 400)

  const attempt = async (apiKey, label) => {
    const ai = new GoogleGenAI({ apiKey })
    const file = await ai.files.get({ name: fileName })
    return { name: file.name, state: file.state, uri: file.uri, mimeType: file.mimeType, geminiKeyLabel: label }
  }

  try {
    // File này CHỈ tồn tại trong tài khoản của key đã upload nó (xem
    // uploadBringAnyIdeaToLifeVideoToGemini ở trên) — nếu client đã gửi lại
    // đúng geminiKeyLabel (nhận từ response upload), gọi THẲNG đúng key đó,
    // bỏ qua rotation/racing hoàn toàn (cả 2 đều có thể chọn nhầm key khác
    // không sở hữu file -> lỗi "not found" giả, không phải lỗi quota thật).
    if (geminiKeyLabel) {
      const exactKey = getApiKeyByLabel(geminiKeyLabel, { envSource })
      if (exactKey) return await attempt(exactKey, geminiKeyLabel)
      // Key đó không còn trong env (vd vừa redeploy đổi biến môi trường giữa
      // lúc upload và lúc check) -> rơi về dò tuần tự như cũ, còn hơn lỗi cứng.
      console.warn(`[bring-any-idea-to-life] Không tìm thấy key ${geminiKeyLabel} đã dùng để upload video, dò tuần tự các key khác.`)
    }
    // Không biết geminiKeyLabel (client cũ, hoặc key đã mất) -> dò tuần tự
    // (KHÔNG đua song song) để không tốn quota gọi nhầm key không sở hữu file.
    return await withApiKeyRotation('GEMINI_API_KEY', attempt, { envSource })
  } catch (err) {
    if (err instanceof BringAnyIdeaToLifeProxyError) throw err
    throw new BringAnyIdeaToLifeProxyError(err?.message || 'Gemini Files status error', err?.status || 502)
  }
}


// --- Gemini (multimodal, dự phòng khi Groq lỗi cho ảnh/PDF; BẮT BUỘC cho video vì
// Groq vision (qwen) không hỗ trợ video) ---
async function callGemini({ prompt, fileBase64, mimeType, videoUrl, geminiFileUri, geminiFileMimeType, geminiKeyLabel, envSource }) {
  const isVideo = Boolean(videoUrl) || Boolean(geminiFileUri) || /^video\//i.test(mimeType || '')
  const effectiveTimeoutMs = isVideo ? videoTimeoutMs : timeoutMs

  // Tách phần gọi Gemini thực sự ra 1 hàm riêng (nhận thẳng apiKey) để dùng
  // được theo 3 cách khác nhau bên dưới: (a) 1 key CỤ THỂ đã biết trước
  // (nhánh geminiFileUri có geminiKeyLabel), (b) đua song song nhiều key
  // (withApiKeyRacing), (c) dò tuần tự (withApiKeyRotation, fallback khi
  // không có geminiKeyLabel).
  const attemptGeminiGenerate = async (geminiApiKey) => {
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })

    const parts = [{ text: prompt }]
    if (geminiFileUri) {
      // Video LỚN đã upload sẵn qua R2 -> Gemini Files API (xem
      // uploadBringAnyIdeaToLifeVideoToGemini ở trên) — dùng thẳng fileUri
      // đó, không cần base64 trong request này nữa (khác videoUrl bên dưới,
      // vốn là link YouTube/Facebook để Gemini tự tải).
      parts.push({ fileData: { mimeType: geminiFileMimeType || mimeType || 'video/mp4', fileUri: geminiFileUri } })
    } else if (videoUrl) {
      // videoUrl ở đây LUÔN đã sẵn sàng cho Gemini đọc thẳng: link YouTube
      // gốc (Gemini hỗ trợ fileUri là URL YouTube), hoặc URL mp4 CDN trực
      // tiếp đã resolve từ link Facebook (xem runBringAnyIdeaToLifeGenerate
      // bên dưới) — KHÔNG bao giờ là URL trang facebook.com thô, vì Gemini
      // không đọc được (cần đăng nhập/JS).
      parts.push({ fileData: { mimeType: 'video/mp4', fileUri: videoUrl } })
    } else if (fileBase64 && mimeType) {
      // Ảnh/PDF hoặc video upload trực tiếp từ máy người dùng đều đi qua nhánh này.
      parts.push({ inlineData: { data: fileBase64, mimeType } })
    }

    const callStartedAt = Date.now()
    let lastErr
    let attempt = 0
    while (true) {
      const elapsed = Date.now() - callStartedAt
      const remaining = effectiveTimeoutMs - elapsed
      if (remaining < MIN_ATTEMPT_BUDGET_MS) break // hết ngân sách, không thử thêm nữa

      try {
        const modelPromise = ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            // NGUYÊN NHÂN THẬT SỰ của các lần treo/timeout 55s gần đây: Gemini
            // 3.x (gemini-3.6-flash) mặc định bật "dynamic thinking" — tự ý
            // suy luận ẩn (không trả về, không tính vào text response) trước
            // khi sinh nội dung thật, thời lượng tuỳ độ phức tạp CỦA MODEL tự
            // đánh giá — với 1 tác vụ nặng như "sinh nguyên 1 trang HTML/CSS/
            // JS tương tác từ ảnh", model có thể tự cho phép suy luận rất lâu,
            // dễ vượt quá effectiveTimeoutMs mà không hề trả lỗi (vì nó vẫn
            // đang "nghĩ", không phải bị treo mạng) — khớp với đúng triệu
            // chứng quan sát được (luôn treo ngay sát mốc 55s).
            // FIX: tắt hẳn thinking (thinkingBudget: 0 = DISABLED, xem type
            // ThinkingConfig của @google/genai) cho nhánh dự phòng này — đây
            // chỉ là fallback khi Groq lỗi, ưu tiên PHẢN HỒI NHANH hơn là suy
            // luận sâu, và HTML/CSS/JS tự chứa không thực sự cần reasoning
            // phức tạp kiểu toán/logic để sinh ra.
            thinkingConfig: { thinkingBudget: 0 },
            // Bỏ temperature: Gemini 3.x KHÔNG hỗ trợ chỉnh temperature/top_p/
            // top_k tuỳ ý (giá trị custom bị ÂM THẦM bỏ qua, xem tài liệu
            // migration Gemini 3.x của Google) — giữ lại chỉ gây hiểu nhầm.
          },
        })

        // Timeout của LẦN THỬ NÀY = phần ngân sách còn lại (không phải trọn
        // effectiveTimeoutMs mỗi lần) — đảm bảo tổng cộng mọi lần thử (kể cả
        // retry) không bao giờ vượt quá effectiveTimeoutMs ban đầu.
        const response = await withTimeout(modelPromise, remaining)

        const html = response.text || ''
        if (!html) throw new BringAnyIdeaToLifeProxyError('Không có nội dung trả về từ Gemini.', 502)
        return html
      } catch (err) {
        if (isRotatableApiError(err)) throw err // để withApiKeyRotation()/withApiKeyRacing() bắt và đổi key
        lastErr = err
        if (err?.message === 'timeout') {
          // Lần thử này đã ăn hết phần ngân sách của nó — retry chỉ có nghĩa
          // nếu vẫn còn đủ ngân sách CHO LẦN SAU (kiểm tra lại ở đầu vòng
          // lặp), không cố retry ngay lập tức như lỗi 503 quá tải bên dưới.
          continue
        }
        attempt += 1
        await new Promise((res) => setTimeout(res, Math.min(geminiRetryDelayMs(attempt), Math.max(remaining - MIN_ATTEMPT_BUDGET_MS, 0))))
      }
    }

    if (lastErr instanceof BringAnyIdeaToLifeProxyError) throw lastErr
    if (lastErr?.message === 'timeout') {
      throw new BringAnyIdeaToLifeProxyError(
        `Gemini xử lý quá lâu (vượt quá ${Math.round(effectiveTimeoutMs / 1000)} giây). File/video có thể quá lớn hoặc model đang quá tải — hãy thử lại, dùng file gọn hơn, hoặc đợi ít phút.`,
        504,
      )
    }
    throw new BringAnyIdeaToLifeProxyError(lastErr?.message || 'Gemini generate error', 502)
  }

  // Nhánh video đã upload qua Gemini Files API: fileUri đó CHỈ tồn tại trong
  // ĐÚNG 1 tài khoản (tài khoản đã upload nó, xem
  // uploadBringAnyIdeaToLifeVideoToGemini — nay cũng đua song song, nên
  // KHÔNG thể đoán bằng sticky index nữa) — nếu đã biết chính xác key nào đã
  // upload (geminiKeyLabel, do client gửi lại từ response upload), gọi
  // THẲNG đúng key đó, bỏ qua cả rotation lẫn racing (cả 2 đều có thể chọn
  // nhầm key khác không sở hữu file -> lỗi "not found" giả, không phải lỗi
  // quota thật).
  if (geminiFileUri && geminiKeyLabel) {
    const exactKey = getApiKeyByLabel(geminiKeyLabel, { envSource })
    if (exactKey) return await attemptGeminiGenerate(exactKey)
    // Key đó không còn trong env (vd vừa redeploy đổi biến môi trường giữa
    // lúc upload và lúc generate) -> rơi về dò tuần tự như cũ, còn hơn lỗi cứng.
    console.warn(`[bring-any-idea-to-life] Không tìm thấy key ${geminiKeyLabel} đã dùng để upload video, dò tuần tự các key khác.`)
  }

  // Ảnh/PDF/text hoặc video dạng link (không gắn với tài khoản nào) thì đua
  // song song bình thường để giảm độ trễ khi 1-2 key đầu đang bị rate limit
  // tạm thời. Nhánh video geminiFileUri KHÔNG có geminiKeyLabel hợp lệ (rơi
  // xuống đây) thì dò tuần tự (rotation) để không tốn quota gọi nhầm key
  // không sở hữu file.
  const runWithKeys = geminiFileUri ? withApiKeyRotation : withApiKeyRacingThenRotation
  return await runWithKeys('GEMINI_API_KEY', (geminiApiKey) => attemptGeminiGenerate(geminiApiKey), { envSource })
}

// --- Điều phối Groq (mặc định, miễn phí, chỉ ảnh/PDF/text) ↔ Gemini (bắt buộc cho
// video, fallback tự động cho ảnh/PDF/text) ---
export async function runBringAnyIdeaToLifeGenerate({ prompt, fileBase64, mimeType, videoUrl, imageUrl, webUrl, geminiFileUri, geminiFileMimeType, geminiKeyLabel, envSource }) {
  if (!prompt) throw new BringAnyIdeaToLifeProxyError('Missing prompt', 400)

  // "Đọc hình từ URL": tải ảnh về SERVER trước (tránh CORS/hotlink khi fetch
  // từ trình duyệt, xem imageUrlFetch.js), rồi coi như file ảnh bình thường —
  // dùng chung pipeline Groq/Gemini bên dưới, không cần nhánh riêng.
  if (imageUrl && !fileBase64) {
    try {
      const fetched = await fetchImageAsBase64(imageUrl)
      fileBase64 = fetched.base64
      mimeType = fetched.mimeType
    } catch (err) {
      if (err instanceof ImageUrlFetchError) throw new BringAnyIdeaToLifeProxyError(err.message, err.status)
      throw new BringAnyIdeaToLifeProxyError(err?.message || 'Không tải được ảnh từ URL.', 502)
    }
  }


  // "Đọc website/kênh/trang chủ từ URL": trích text server-side rồi ghép vào
  // prompt text-only. Nhánh này cho phép áp dụng mọi link web http/https,
  // không còn ép các link không phải video thành ảnh trực tiếp.
  if (webUrl && !fileBase64 && !videoUrl && !imageUrl) {
    try {
      const page = await fetchWebpageText(webUrl)
      prompt = `${prompt}\n\nSOURCE WEBPAGE URL: ${page.url}\nSOURCE WEBPAGE TITLE: ${page.title || 'Untitled'}\nSOURCE WEBPAGE TEXT:\n${page.text}`
    } catch (err) {
      if (err instanceof WebpageTextError) throw new BringAnyIdeaToLifeProxyError(err.message, err.status)
      throw new BringAnyIdeaToLifeProxyError(err?.message || 'Không đọc được nội dung trang web.', 502)
    }
  }

  const hasGroq = countApiKeyPool('GROQ_API_KEY', { envSource }) > 0
  const hasGemini = countApiKeyPool('GEMINI_API_KEY', { envSource }) > 0

  if (!hasGroq && !hasGemini) {
    throw new BringAnyIdeaToLifeProxyError(
      'Chưa cấu hình GROQ_API_KEY lẫn GEMINI_API_KEY (hoặc các biến *_API_KEY1, *_API_KEY2, ...) trên server. Thêm ít nhất một trong hai trong Vercel → Settings → Environment Variables rồi redeploy.',
      501,
    )
  }

  // Video (upload trực tiếp hoặc link YouTube/Facebook): Groq vision (qwen) KHÔNG
  // hỗ trợ video, chỉ ảnh — bắt buộc đi thẳng Gemini, không thử Groq trước.
  const isVideo = Boolean(videoUrl) || Boolean(geminiFileUri) || /^video\//i.test(mimeType || '')
  if (isVideo) {
    if (!hasGemini) {
      throw new BringAnyIdeaToLifeProxyError(
        'Xử lý video (tải lên hoặc link YouTube/Facebook) cần GEMINI_API_KEY (Groq chưa hỗ trợ video). Thêm biến GEMINI_API_KEY trong Vercel → Settings → Environment Variables rồi redeploy.',
        501,
      )
    }
    // Video upload trực tiếp LỚN (đã qua R2 -> Gemini Files API ở client
    // trước khi gọi action generate, xem InputArea.tsx/App.tsx): dùng thẳng
    // geminiFileUri, bỏ qua toàn bộ nhánh resolve link Facebook/base64 bên
    // dưới vì không áp dụng ở đây.
    if (geminiFileUri) {
      const html = cleanHtml(await callGemini({ prompt, geminiFileUri, geminiFileMimeType, geminiKeyLabel, envSource }))
      return { html, source: 'gemini' }
    }
    // Gemini "xem" thẳng URL YouTube qua fileUri (hoạt động OK), NHƯNG với
    // Facebook thì KHÔNG — Gemini không tải/đọc được trang facebook.com
    // (cần đăng nhập/JS để render). Phải resolve link Facebook thành URL
    // mp4 CDN công khai trước (browser_native_hd_url/sd_url), giống hệt
    // cách videoToLearningProxy.js xử lý — xem api/_lib/facebookVideo.js.
    let effectiveVideoUrl = videoUrl
    if (videoUrl && isFacebookVideoUrl(videoUrl)) {
      try {
        const resolved = await resolveFacebookVideo(videoUrl)
        effectiveVideoUrl = resolved.directUrl
      } catch (err) {
        if (err instanceof FacebookVideoError) throw new BringAnyIdeaToLifeProxyError(err.message, err.status)
        throw new BringAnyIdeaToLifeProxyError(err?.message || 'Không lấy được video Facebook để phân tích.', 422)
      }
    }
    const html = cleanHtml(await callGemini({ prompt, fileBase64, mimeType, videoUrl: effectiveVideoUrl, envSource }))
    return { html, source: 'gemini' }
  }

  // Lưu lại lý do Groq lỗi (nếu có) để gộp vào thông báo lỗi cuối cùng — trước
  // đây lỗi Groq chỉ console.warn() (không ai thấy trên client), nên khi cả
  // Gemini dự phòng cũng lỗi (vd hết quota), người dùng chỉ thấy mỗi lỗi
  // Gemini và tưởng lầm Groq chưa từng được thử/không hoạt động, trong khi
  // thực ra có thể Groq đã thử và lỗi trước — gộp cả 2 giúp chẩn đoán đúng
  // (thiếu GROQ_API_KEY trên Vercel? hay Groq key cũng hết quota?).
  let groqErrorMessage
  if (hasGroq) {
    try {
      const html = cleanHtml(await callGroqVision({ prompt, fileBase64, mimeType, envSource }))
      if (html) return { html, source: 'groq' }
    } catch (err) {
      groqErrorMessage = err?.message || String(err)
      console.warn('[bring-any-idea-to-life] Groq failed on all keys, falling back to Gemini:', groqErrorMessage)
    }
  }

  if (!hasGemini) {
    throw new BringAnyIdeaToLifeProxyError(
      'Groq gặp sự cố ở tất cả các key (hoặc chưa cấu hình) và chưa có GEMINI_API_KEY để dự phòng. Thêm biến GROQ_API_KEY (miễn phí, lấy tại console.groq.com) hoặc GEMINI_API_KEY trong Vercel → Settings → Environment Variables.',
      502,
    )
  }

  try {
    const html = cleanHtml(await callGemini({ prompt, fileBase64, mimeType, envSource }))
    return { html, source: 'gemini-fallback' }
  } catch (err) {
    if (!hasGroq) throw err // Groq chưa cấu hình -> không có gì để gộp, giữ nguyên lỗi Gemini
    const geminiMsg = err?.message || String(err)
    throw new BringAnyIdeaToLifeProxyError(
      groqErrorMessage
        ? `Groq lỗi: ${groqErrorMessage}. Gemini (dự phòng) cũng lỗi: ${geminiMsg}`
        : geminiMsg,
      err?.status || 502,
    )
  }
}
