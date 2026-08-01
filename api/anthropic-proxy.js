// api/anthropic-proxy.js
// Vercel Serverless Function — proxy Anthropic API calls from the browser.
//
// KEY POOL / AUTO-ROTATION: đọc ANTHROPIC_API_KEY, ANTHROPIC_API_KEY1,
// ANTHROPIC_API_KEY2, ... và tự động rotate sang key kế tiếp nếu key đang
// dùng hết hạn mức/billing (401/402/429) — xem api/_lib/apiKeyPool.js.

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body
  try {
    body = await parseBody(req)
  } catch (e) {
    return res.status(400).json({ error: 'Failed to parse request body: ' + e.message })
  }

  // Log what we're sending (mask key)
  console.log('[anthropic-proxy] model:', body.model, '| messages:', body.messages?.length, '| first role:', body.messages?.[0]?.role)

  try {
    // withApiKeyRotation() tự đọc ANTHROPIC_API_KEY, ANTHROPIC_API_KEY1, ...
    // và tự chuyển key khi gặp lỗi hết hạn mức/billing (xem
    // toRotatableHttpError() để lỗi HTTP không-ok được nhận diện đúng).
    const { status, data } = await withApiKeyRotation('ANTHROPIC_API_KEY', async (apiKey) => {
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      const text = await upstream.text()
      let parsed
      try { parsed = JSON.parse(text) } catch { parsed = { raw: text } }

      if (!upstream.ok) {
        console.error('[anthropic-proxy] Anthropic', upstream.status, ':', text.slice(0, 500))
        throw await toRotatableHttpError(upstream, 'Anthropic')
      }

      return { status: upstream.status, data: parsed }
    })

    return res.status(status).json(data)
  } catch (err) {
    console.error('[anthropic-proxy] error:', err?.message)
    if (err instanceof ApiKeyPoolError) {
      return res.status(err.status).json({ error: err.message })
    }
    // Lỗi không-rotatable (vd 400 bad request) vẫn cần forward đúng status/
    // body gốc từ Anthropic cho client thay vì luôn trả 500.
    if (typeof err?.status === 'number' && err.rawBody !== undefined) {
      let parsed
      try { parsed = JSON.parse(err.rawBody) } catch { parsed = { error: err.message } }
      return res.status(err.status).json(parsed)
    }
    return res.status(500).json({ error: err?.message || 'Proxy fetch error' })
  }
}
