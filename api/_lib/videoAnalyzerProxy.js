// api/_lib/videoAnalyzerProxy.js
// Backend cho tính năng "Video Analyzer" (chuyển đổi từ video-analyzer.zip,
// app AI Studio gốc gọi thẳng @google/genai với API key nhúng client — bản
// gốc dùng `client.files.upload()` (SDK tự lo việc upload video lên Gemini
// Files API) rồi `client.models.generateContent()` với function calling để
// hỏi-đáp về video (mô tả cảnh, phụ đề, biểu đồ, haiku, v.v.).
//
// KHÔNG dùng client.files.upload() (SDK) ở đây vì SDK cần API key ngay
// trong trình duyệt — không an toàn để deploy thật (giống lý do đã đổi ở
// vibe-check-khanh, video-to-learning-khanh...). Thay vào đó dùng THẲNG
// giao thức resumable-upload REST của Gemini File API, chia làm 2 bước, mô
// phỏng đúng mô hình "presigned URL" đã dùng cho video KOL/R2 (xem
// kolR2Upload.js):
//   1. initUpload (ở đây, cần GEMINI_API_KEY thật) — mở một upload session
//      với Google, trả về `uploadUrl` là 1 URL TẠM THỜI đã có sẵn quyền ghi
//      (Google ký ngay trong URL đó) — client dùng URL này để PUT thẳng
//      bytes video LÊN GOOGLE, không đi qua Serverless Function này nữa
//      → tránh giới hạn kích thước body của Vercel Serverless Function.
//   2. checkFile (ở đây, cần GEMINI_API_KEY thật) — poll trạng thái xử lý
//      file (Gemini cần vài giây-vài chục giây để xử lý video sau khi
//      upload xong, trạng thái PROCESSING → ACTIVE).
//   3. generate (ở đây, cần GEMINI_API_KEY thật) — gọi generateContent thật
//      kèm fileUri đã upload + function declarations (set_timecodes...),
//      trả kết quả function call đã parse sẵn cho client.
//
// DÙNG CHUNG endpoint /api/groq-proxy (field `provider: 'video-analyzer'`)
// — không tạo Serverless Function mới vì Vercel giới hạn 12 functions (xem
// chú thích đầu api/groq-proxy.js).

import { withApiKeyRotation, toRotatableHttpError } from './apiKeyPool.js'

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

// --- Bước 1: mở resumable-upload session với Gemini File API ---
// Trả về uploadUrl (đã có quyền ghi tạm thời) — client PUT bytes thẳng lên
// đây, KHÔNG cần API key.
export async function initVideoAnalyzerUpload({ mimeType, numBytes, displayName, envSource }) {
  if (!mimeType || !numBytes) {
    throw new VideoAnalyzerProxyError('Missing mimeType/numBytes', 400)
  }

  try {
    return await withApiKeyRotation('GEMINI_API_KEY', async (apiKey) => {
      const res = await fetch(`${GEMINI_UPLOAD_BASE}?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(numBytes),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: displayName || 'video' } }),
      })

      if (!res.ok) throw await toRotatableHttpError(res, 'Gemini Files (init)')

      const uploadUrl = res.headers.get('x-goog-upload-url')
      if (!uploadUrl) {
        throw new VideoAnalyzerProxyError('Gemini did not return an upload URL', 502)
      }
      return { uploadUrl }
    }, { envSource })
  } catch (err) {
    if (err instanceof VideoAnalyzerProxyError) throw err
    throw new VideoAnalyzerProxyError(err?.message || 'Video Analyzer upload-init error', err?.status || 502)
  }
}

// --- Bước 2: poll trạng thái xử lý file (PROCESSING -> ACTIVE) ---
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

// --- Bước 3: generateContent thật + function calling ---
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
