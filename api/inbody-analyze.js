// api/inbody-analyze.js
// Vercel Serverless Function — OCR THẬT cho ảnh kết quả InBody bằng Claude Vision.
// Logic gọi Anthropic được tách sang api/_lib/inbodyOcr.js để dùng chung với
// middleware dev-server trong vite.config.js (xem comment ở đó).

import { runInbodyOcr } from './_lib/inbodyOcr.js';

// Helper: parse raw body thành JSON (một số runtime của Vercel không tự parse)
function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { image, mediaType, previousRecord } = body;

    // KEY POOL / AUTO-ROTATION: runInbodyOcr() tự đọc ANTHROPIC_API_KEY,
    // ANTHROPIC_API_KEY1, ANTHROPIC_API_KEY2, ... từ process.env và tự
    // rotate khi 1 key hết hạn mức/billing (xem api/_lib/apiKeyPool.js).
    const analysis = await runInbodyOcr({
      image,
      mediaType,
      previousRecord,
    });

    return res.status(200).json({ analysis });
  } catch (error) {
    console.error('InBody analyze error:', error?.message || error);
    if (error?.code === 'NO_API_KEY') {
      return res.status(500).json({ error: 'Server configuration error: missing ANTHROPIC_API_KEY', detail: error.message });
    }
    if (error?.code === 'NO_IMAGE') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({
      error: 'Lỗi phân tích OCR. Vui lòng thử lại.',
      detail: error?.message,
    });
  }
}
