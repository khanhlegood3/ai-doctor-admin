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

  // --- Nhánh Comic Hero (text: Groq | ảnh: Pollinations ẩn danh) ---
  if (body.provider === 'gemini-comic') {
    console.log('[groq-proxy] (gemini-comic) action:', body.action)
    try {
      const payload = await runGeminiComicGenerate({
        apiKey: process.env.GROQ_API_KEY,
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

  // --- Nhánh Groq (mặc định, hành vi gốc không đổi) ---
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    console.error('[groq-proxy] GROQ_API_KEY is not set')
    return res.status(500).json({
      error: 'GROQ_API_KEY not configured. Get a free key at https://console.groq.com and add it in Vercel → Settings → Environment Variables.',
    })
  }

  console.log('[groq-proxy] model:', body.model, '| messages:', body.messages?.length)

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })

    const text = await upstream.text()
    let data
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    if (!upstream.ok) {
      console.error('[groq-proxy] Groq', upstream.status, ':', text.slice(0, 500))
    }

    return res.status(upstream.status).json(data)
  } catch (err) {
    console.error('[groq-proxy] fetch error:', err?.message)
    return res.status(500).json({ error: err?.message || 'Proxy fetch error' })
  }
}
