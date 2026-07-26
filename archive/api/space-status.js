// api/space-status.js
// Vercel Serverless Function — kiểm tra trạng thái thật của một hay nhiều
// Hugging Face Space TRƯỚC KHI người dùng bấm "Generate", để hiện thông
// báo rõ ràng ("Space đang lỗi build") thay vì để họ bấm rồi mới ăn lỗi 502
// từ lam-generate.js.
//
// Dùng API công khai của Hugging Face: GET /api/spaces/{namespace}/{repo}
// (không cần token cho Space công khai). Gọi từ SERVER (không phải trình
// duyệt) vì 2 lý do: (1) tránh phát sinh thêm domain lạ mà CSP/CORS phía
// client phải xử lý, (2) gom nhiều Space vào 1 lần round-trip từ client.
//
// GET /api/space-status?spaces=3DAIGC/LAM
// -> { results: [ { space, stage, ready, label, url } ] }
//
// "stage" là giá trị thô từ Hugging Face (RUNNING, BUILDING, RUNTIME_ERROR,
// BUILD_ERROR, SLEEPING, PAUSED, STOPPED, NO_APP_FILE, ...). Nếu API đổi
// field hoặc lỗi mạng, trả "unknown" — KHÔNG suy diễn thành "ok" hay "lỗi"
// khi không chắc, để không tự ý chặn nhầm khi Space thực ra vẫn chạy tốt.

const READY_STAGES = new Set(['RUNNING', 'RUNNING_BUILDING'])
const LABELS_VI = {
  RUNNING: 'Đang chạy',
  RUNNING_BUILDING: 'Đang chạy (đang build bản mới)',
  BUILDING: 'Đang build...',
  SLEEPING: 'Đang ngủ (sẽ tự thức khi có request)',
  STOPPED: 'Đã dừng',
  PAUSED: 'Đã tạm dừng (chủ Space tắt)',
  BUILD_ERROR: 'Lỗi build',
  RUNTIME_ERROR: 'Lỗi runtime',
  NO_APP_FILE: 'Thiếu app file',
  CONFIG_ERROR: 'Lỗi cấu hình',
  unknown: 'Không xác định',
}
const LABELS_EN = {
  RUNNING: 'Running',
  RUNNING_BUILDING: 'Running (building an update)',
  BUILDING: 'Building...',
  SLEEPING: 'Sleeping (wakes on next request)',
  STOPPED: 'Stopped',
  PAUSED: 'Paused by owner',
  BUILD_ERROR: 'Build error',
  RUNTIME_ERROR: 'Runtime error',
  NO_APP_FILE: 'Missing app file',
  CONFIG_ERROR: 'Config error',
  unknown: 'Unknown',
}

async function checkOne(spaceId) {
  const url = `https://huggingface.co/api/spaces/${spaceId}`
  try {
    const resp = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!resp.ok) {
      return { space: spaceId, stage: 'unknown', ready: null, httpStatus: resp.status }
    }
    const json = await resp.json()
    const stage = json?.runtime?.stage || 'unknown'
    return {
      space: spaceId,
      stage,
      ready: READY_STAGES.has(stage),
      hardware: json?.runtime?.hardware?.current || null,
    }
  } catch (err) {
    return { space: spaceId, stage: 'unknown', ready: null, error: err?.message }
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const spacesParam = req.query?.spaces || new URL(req.url, 'http://x').searchParams.get('spaces')
  const spaceIds = String(spacesParam || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!spaceIds.length) {
    return res.status(400).json({ error: 'Query param "spaces" is required, e.g. ?spaces=3DAIGC/LAM' })
  }
  if (spaceIds.length > 5) {
    return res.status(400).json({ error: 'Too many spaces in one request (max 5).' })
  }

  const results = await Promise.all(spaceIds.map(checkOne))
  const withLabels = results.map(r => ({
    ...r,
    labelVi: LABELS_VI[r.stage] || LABELS_VI.unknown,
    labelEn: LABELS_EN[r.stage] || LABELS_EN.unknown,
    hfUrl: `https://huggingface.co/spaces/${r.space}`,
  }))

  // Cache ngắn ở tầng CDN/browser (Space có thể đổi trạng thái bất cứ lúc nào)
  res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=15')
  return res.status(200).json({ results: withLabels })
}
