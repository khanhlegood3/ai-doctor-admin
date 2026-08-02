// api/_lib/videoAnalyzerProxy.js
// Backend cho tính năng "Video Analyzer" (chuyển đổi từ video-analyzer.zip,
// app AI Studio gốc gọi thẳng @google/genai với API key nhúng client — bản
// gốc dùng `client.files.upload()` (SDK tự lo việc upload video lên Gemini
// Files API) rồi `client.models.generateContent()` với function calling để
// hỏi-đáp về video (mô tả cảnh, phụ đề, biểu đồ, haiku, v.v.).
//
// KHÔNG dùng client.files.upload() (SDK) ở đây vì SDK cần API key ngay
// trong trình duyệt — không an toàn để deploy thật (giống lý do đã đổi ở
// vibe-check-khanh, video-to-learning-khanh...).
//
// ĐÃ THỬ (và bỏ): mở resumable-upload session bằng GEMINI_API_KEY ở server
// rồi trả `uploadUrl` cho trình duyệt PUT thẳng lên Google — bị CHẶN BỞI
// CORS ("No 'Access-Control-Allow-Origin' header") vì endpoint upload của
// Gemini File API chỉ cấp CORS cho request có Origin hợp lệ ngay TỪ BƯỚC
// MỞ SESSION; do bước mở session ở đây chạy trên server (không có Origin
// trình duyệt) nên URL trả về không có quyền CORS cho bước PUT tiếp theo từ
// trình duyệt.
//
// GIẢI PHÁP THẬT: mô phỏng đúng mô hình đã dùng cho video KOL (xem
// kolR2Upload.js/r2Storage.js) — R2 CÓ bật CORS cho origin thật của app:
//   1. initR2Upload  — server ký 1 presigned PUT URL lên Cloudflare R2
//                       (R2_* credentials, KHÔNG phải Gemini key). Trình
//                       duyệt PUT bytes video thẳng lên R2 bằng URL này
//                       (không qua Serverless Function → không giới hạn
//                       kích thước body của Vercel).
//   2. uploadToGemini — SAU KHI upload R2 xong, client gọi action này với
//                       publicUrl vừa upload. Server (không phải trình
//                       duyệt, nên KHÔNG bị CORS) tải bytes từ R2 rồi đẩy
//                       thẳng sang Gemini File API bằng GEMINI_API_KEY thật
//                       — toàn bộ chặng R2 -> Gemini là server-to-server.
//   3. checkFile      — poll trạng thái xử lý file (Gemini cần vài giây-vài
//                       chục giây để xử lý video, PROCESSING -> ACTIVE).
//   4. generate       — gọi generateContent thật kèm fileUri đã upload +
//                       function declarations (set_timecodes...), trả kết
//                       quả function call đã parse sẵn cho client.
//
// LƯU Ý: bước uploadToGemini tải nguyên video vào bộ nhớ server rồi gửi đi
// tiếp trong CÙNG 1 lần chạy function — video quá lớn/quá dài có thể chạm
// giới hạn bộ nhớ/thời gian chạy của Vercel Serverless Function (giống rủi
// ro đã ghi chú ở kolYoutubeDownload.js cho việc tải clip YouTube).
//
// DÙNG CHUNG endpoint /api/groq-proxy (field `provider: 'video-analyzer'`)
// — không tạo Serverless Function mới vì Vercel giới hạn 12 functions (xem
// chú thích đầu api/groq-proxy.js).

import { withApiKeyRotation, toRotatableHttpError } from './apiKeyPool.js'
import { createR2PresignedUploadUrl, genR2Key } from './r2Storage.js'

export class VideoAnalyzerProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VideoAnalyzerProxyError'
    this.status = status
  }
}

const GEMINI_UPLOAD_BASE = 'https://generativelanguage.googleapis.com/upload/v1beta/files'
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'
const R2_KEY_PREFIX = 'video-analyzer/uploads'

// Khai báo function-calling GIỐNG HỆT bản gốc functions.ts của app AI Studio
// (set_timecodes / set_timecodes_with_objects / set_timecodes_with_numeric_values)
// — giữ ở server (không phải client) vì đây là phần "hợp đồng" cố định giữa
// app và Gemini, client chỉ cần gửi tên mode + prompt.
const FUNCTION_DECLARATIONS = [
  {
    name: 'set_timecodes',
    description: 'Set the timecodes for the video with associated text',
    parameters: {
      type: 'OBJECT',
      properties: {
        timecodes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              time: { type: 'STRING' },
              text: { type: 'STRING' },
            },
            required: ['time', 'text'],
          },
        },
      },
      required: ['timecodes'],
    },
  },
  {
    name: 'set_timecodes_with_objects',
    description: 'Set the timecodes for the video with associated text and object list',
    parameters: {
      type: 'OBJECT',
      properties: {
        timecodes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              time: { type: 'STRING' },
              text: { type: 'STRING' },
              objects: { type: 'ARRAY', items: { type: 'STRING' } },
            },
            required: ['time', 'text', 'objects'],
          },
        },
      },
      required: ['timecodes'],
    },
  },
  {
    name: 'set_timecodes_with_numeric_values',
    description: 'Set the timecodes for the video with associated numeric values',
    parameters: {
      type: 'OBJECT',
      properties: {
        timecodes: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              time: { type: 'STRING' },
              value: { type: 'NUMBER' },
            },
            required: ['time', 'value'],
          },
        },
      },
      required: ['timecodes'],
    },
  },
]

const SYSTEM_INSTRUCTION =
  'When given a video and a query, call the relevant function only once with the appropriate timecodes and text for the video'

// --- Bước 1: ký presigned PUT URL lên R2 (KHÔNG cần GEMINI_API_KEY) ---
// Trình duyệt PUT bytes video thẳng lên R2 bằng uploadUrl này — bucket R2
// đã bật CORS cho origin thật của app (xem r2Storage.js), khác hẳn endpoint
// upload của Gemini vốn không cấp CORS cho session mở từ server.
function extFromMimeType(mimeType) {
  const sub = String(mimeType || '').split('/')[1] || 'mp4'
  return sub.split(';')[0]
}

export async function createVideoAnalyzerR2UploadUrl({ mimeType, envSource }) {
  if (!mimeType || !mimeType.startsWith('video/')) {
    throw new VideoAnalyzerProxyError('mimeType phải là video/*.', 400)
  }
  const key = genR2Key(R2_KEY_PREFIX, extFromMimeType(mimeType))
  try {
    return await createR2PresignedUploadUrl({ key, contentType: mimeType, envSource })
  } catch (err) {
    throw new VideoAnalyzerProxyError(err?.message || 'Video Analyzer R2 presign error', err?.status || 502)
  }
}

// --- Bước 2: server tải bytes từ R2 rồi đẩy sang Gemini File API ---
// Server-to-server (R2 -> server -> Gemini), không đi qua trình duyệt nên
// không bị CORS. Dùng giao thức resumable của Gemini nhưng chạy trọn cả
// start + finalize trong 1 lần gọi vì server đã có sẵn toàn bộ bytes.
export async function uploadVideoAnalyzerFromR2({ publicUrl, mimeType, displayName, envSource }) {
  if (!publicUrl || !mimeType) {
    throw new VideoAnalyzerProxyError('Missing publicUrl/mimeType', 400)
  }

  let videoBuffer
  try {
    const r2Res = await fetch(publicUrl)
    if (!r2Res.ok) {
      throw new VideoAnalyzerProxyError(`Không tải được video vừa upload từ R2 (HTTP ${r2Res.status}).`, 502)
    }
    videoBuffer = Buffer.from(await r2Res.arrayBuffer())
  } catch (err) {
    if (err instanceof VideoAnalyzerProxyError) throw err
    throw new VideoAnalyzerProxyError(err?.message || 'Không đọc được video từ R2.', 502)
  }

  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const startRes = await fetch(`${GEMINI_UPLOAD_BASE}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(videoBuffer.length),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: displayName || 'video' } }),
      })
      if (!startRes.ok) throw await toRotatableHttpError(startRes, 'Gemini Files (init)')

      const uploadUrl = startRes.headers.get('x-goog-upload-url')
      if (!uploadUrl) {
        throw new VideoAnalyzerProxyError('Gemini did not return an upload URL', 502)
      }

      const finalizeRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Length': String(videoBuffer.length),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: videoBuffer,
      })
      if (!finalizeRes.ok) throw await toRotatableHttpError(finalizeRes, 'Gemini Files (upload)')

      const data = await finalizeRes.json()
      const fileResource = data.file || data
      return {
        name: fileResource.name,
        state: fileResource.state,
        uri: fileResource.uri,
        mimeType: fileResource.mimeType || mimeType,
      }
    }, { envSource })
  } catch (err) {
    if (err instanceof VideoAnalyzerProxyError) throw err
    throw new VideoAnalyzerProxyError(err?.message || 'Video Analyzer Gemini upload error', err?.status || 502)
  }
}

// --- Bước 3: poll trạng thái xử lý file (PROCESSING -> ACTIVE) ---
export async function checkVideoAnalyzerFile({ fileName, envSource }) {
  if (!fileName) throw new VideoAnalyzerProxyError('Missing fileName', 400)

  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const res = await fetch(
        `${GEMINI_API_BASE}/${fileName}?key=${encodeURIComponent(apiKey)}`,
        { method: 'GET' },
      )
      if (!res.ok) throw await toRotatableHttpError(res, 'Gemini Files (get)')
      const data = await res.json()
      return { name: data.name, state: data.state, uri: data.uri, mimeType: data.mimeType }
    }, { envSource })
  } catch (err) {
    if (err instanceof VideoAnalyzerProxyError) throw err
    throw new VideoAnalyzerProxyError(err?.message || 'Video Analyzer file-status error', err?.status || 502)
  }
}

// --- Bước 4: generateContent thật + function calling ---
export async function generateVideoAnalyzerContent({ promptText, fileUri, mimeType, envSource }) {
  if (!promptText || !fileUri || !mimeType) {
    throw new VideoAnalyzerProxyError('Missing promptText/fileUri/mimeType', 400)
  }

  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const res = await fetch(
        `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [{ text: promptText }, { fileData: { mimeType, fileUri } }],
              },
            ],
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            generationConfig: { temperature: 0.5 },
            tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
          }),
        },
      )

      if (!res.ok) throw await toRotatableHttpError(res, 'Gemini generateContent')
      const data = await res.json()

      const parts = data?.candidates?.[0]?.content?.parts || []
      const call = parts.find((p) => p.functionCall)?.functionCall || null

      return { functionCall: call ? { name: call.name, args: call.args } : null }
    }, { envSource })
  } catch (err) {
    if (err instanceof VideoAnalyzerProxyError) throw err
    throw new VideoAnalyzerProxyError(err?.message || 'Video Analyzer generate error', err?.status || 502)
  }
}
