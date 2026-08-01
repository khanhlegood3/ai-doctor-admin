// api/groq-whisper.js
// Vercel Serverless Function — proxy Groq Whisper STT (speech-to-text).
//
// Accepts multipart/form-data with an audio file field named "file".
// Forwards to Groq's /openai/v1/audio/transcriptions endpoint.
// Model: whisper-large-v3-turbo (fast, multilingual, free on Groq)
//
// Env var required: GROQ_API_KEY (same key as groq-proxy.js)
//
// KEY POOL / AUTO-ROTATION: đọc GROQ_API_KEY, GROQ_API_KEY1, GROQ_API_KEY2,
// ... và tự động rotate sang key kế tiếp khi key đang dùng hết hạn mức/
// billing — xem api/_lib/apiKeyPool.js.

import { withApiKeyRotation, toRotatableHttpError, ApiKeyPoolError } from './_lib/apiKeyPool.js'

export const config = { api: { bodyParser: false } }

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', c => chunks.push(c))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

// Minimal multipart parser — extracts the first file part as a Buffer
// and reads the "language" text field if present.
function parseMultipart(buffer, boundary) {
  const sep = Buffer.from(`--${boundary}`)
  const end = Buffer.from(`--${boundary}--`)
  const parts = []
  let start = 0

  while (start < buffer.length) {
    const sepIdx = buffer.indexOf(sep, start)
    if (sepIdx === -1) break
    const headerStart = sepIdx + sep.length + 2 // skip \r\n
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    if (headerEnd === -1) break
    const header = buffer.slice(headerStart, headerEnd).toString()
    const bodyStart = headerEnd + 4
    const nextSep = buffer.indexOf(sep, bodyStart)
    const bodyEnd = nextSep === -1 ? buffer.length : nextSep - 2 // trim \r\n before next sep
    parts.push({ header, body: buffer.slice(bodyStart, bodyEnd) })
    start = nextSep === -1 ? buffer.length : nextSep
    if (buffer.indexOf(end, start) === start) break
  }

  let fileBuffer = null, fileName = 'audio.webm', mimeType = 'audio/webm', language = null

  for (const { header, body } of parts) {
    const nameMatch = header.match(/name="([^"]+)"/)
    const fileMatch = header.match(/filename="([^"]+)"/)
    const ctMatch  = header.match(/Content-Type:\s*([^\r\n]+)/i)
    if (!nameMatch) continue
    const fieldName = nameMatch[1]
    if (fieldName === 'file' && fileMatch) {
      fileBuffer = body
      fileName   = fileMatch[1]
      mimeType   = ctMatch ? ctMatch[1].trim() : 'audio/webm'
    } else if (fieldName === 'language') {
      language = body.toString().trim()
    }
  }

  return { fileBuffer, fileName, mimeType, language }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const contentType = req.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/)
  if (!boundaryMatch) {
    return res.status(400).json({ error: 'Expected multipart/form-data with boundary' })
  }
  const boundary = boundaryMatch[1]

  let rawBuffer
  try {
    rawBuffer = await streamToBuffer(req)
  } catch (e) {
    return res.status(400).json({ error: 'Failed to read body: ' + e.message })
  }

  const { fileBuffer, fileName, mimeType, language } = parseMultipart(rawBuffer, boundary)
  if (!fileBuffer) {
    return res.status(400).json({ error: 'No audio file found in request' })
  }

  // Build FormData for Groq upstream
  // We construct multipart manually to avoid Node deps like form-data.
  const upstreamBoundary = `----GroqWhisperBoundary${Date.now()}`
  const CRLF = '\r\n'

  const fileHeader =
    `--${upstreamBoundary}${CRLF}` +
    `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
    `Content-Type: ${mimeType}${CRLF}${CRLF}`

  const modelPart =
    `--${upstreamBoundary}${CRLF}` +
    `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
    `whisper-large-v3-turbo${CRLF}`

  const langPart = language
    ? `--${upstreamBoundary}${CRLF}` +
      `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
      `${language}${CRLF}`
    : ''

  const responsePart =
    `--${upstreamBoundary}${CRLF}` +
    `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}` +
    `json${CRLF}`

  const closingBoundary = `--${upstreamBoundary}--${CRLF}`

  const bodyParts = [
    Buffer.from(fileHeader),
    fileBuffer,
    Buffer.from(CRLF + modelPart + langPart + responsePart + closingBoundary),
  ]
  const bodyBuffer = Buffer.concat(bodyParts)

  try {
    const { status, data } = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
      const upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${upstreamBoundary}`,
          'Content-Length': String(bodyBuffer.length),
        },
        body: bodyBuffer,
      })

      const text = await upstream.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = { raw: text } }

      if (!upstream.ok) {
        console.error('[groq-whisper] Groq', upstream.status, ':', text.slice(0, 300))
        throw await toRotatableHttpError(upstream, 'Groq')
      }

      return { status: upstream.status, data: parsed }
    })

    return res.status(status).json(data)
  } catch (err) {
    console.error('[groq-whisper] error:', err?.message)
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
