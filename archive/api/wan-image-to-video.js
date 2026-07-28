// api/wan-image-to-video.js
// Server-side proxy for Alibaba Cloud Model Studio / Wan image-to-video.
// Required env: DASHSCOPE_API_KEY. For Singapore workspace domain, also set
// WAN_WORKSPACE_ID or WAN_API_BASE=https://{WorkspaceId}.ap-southeast-1.maas.aliyuncs.com/api/v1

const MULEROUTER_API_BASE = 'https://api.mulerouter.ai/vendors/alibaba/v1/wan2.2-i2v-flash'

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body)
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) }
      catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

function getApiBase() {
  if (process.env.WAN_API_BASE) return process.env.WAN_API_BASE.replace(/\/$/, '')
  if (process.env.WAN_WORKSPACE_ID) return `https://${process.env.WAN_WORKSPACE_ID}.ap-southeast-1.maas.aliyuncs.com/api/v1`
  return 'https://dashscope.aliyuncs.com/api/v1'
}

function clampInteger(value, min, max, fallback) {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function normalizeMediaUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (/^data:image\/(png|jpe?g|webp|bmp);base64,/i.test(url)) return url
  throw new Error('Ảnh phải là URL http(s) công khai hoặc data URL base64 hợp lệ.')
}

function buildCreatePayload(body) {
  const firstFrameUrl = normalizeMediaUrl(body.firstFrameUrl || body.imageUrl || body.image)
  if (!firstFrameUrl) throw new Error('Vui lòng cung cấp ảnh đầu vào (first frame).')

  const media = [{ type: 'first_frame', url: firstFrameUrl }]
  const lastFrameUrl = normalizeMediaUrl(body.lastFrameUrl)
  if (lastFrameUrl) media.push({ type: 'last_frame', url: lastFrameUrl })

  const prompt = String(body.prompt || '').trim()
  const negativePrompt = String(body.negativePrompt || body.negative_prompt || '').trim()
  const resolution = String(body.resolution || '720P').toUpperCase() === '1080P' ? '1080P' : '720P'
  const duration = clampInteger(body.duration, 2, 15, 5)

  return {
    model: body.model || process.env.WAN_I2V_MODEL || 'wan2.7-i2v-2026-04-25',
    input: {
      ...(prompt ? { prompt } : {}),
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      media,
    },
    parameters: {
      resolution,
      duration,
      prompt_extend: body.promptExtend !== false,
      watermark: body.watermark === true,
      ...(body.seed !== undefined && body.seed !== '' ? { seed: clampInteger(body.seed, 0, 2147483647, 0) } : {}),
    },
  }
}


function buildMuleRouterPayload(body) {
  const image = normalizeMediaUrl(body.firstFrameUrl || body.imageUrl || body.image)
  if (!image) throw new Error('Vui lòng cung cấp ảnh đầu vào (first frame).')

  const prompt = String(body.prompt || '').trim()
  if (!prompt) throw new Error('Vui lòng nhập prompt cho MuleRouter Wan 2.2 I2V Flash.')

  const negativePrompt = String(body.negativePrompt || body.negative_prompt || '').trim()
  const resolution = String(body.resolution || '720P').toUpperCase() === '480P' ? '480P' : '720P'

  return {
    prompt: prompt.slice(0, 800),
    image,
    ...(negativePrompt ? { negative_prompt: negativePrompt.slice(0, 500) } : {}),
    resolution,
    duration: 5,
    prompt_extend: body.promptExtend !== false,
    safety_filter: body.safetyFilter !== false,
    ...(body.seed !== undefined && body.seed !== '' ? { seed: clampInteger(body.seed, 0, 2147483647, 0) } : {}),
  }
}

function normalizeMuleRouterStatus(data) {
  const taskInfo = data.task_info || {}
  const statusMap = {
    pending: 'PENDING',
    processing: 'RUNNING',
    completed: 'SUCCEEDED',
    failed: 'FAILED',
  }
  const taskStatus = statusMap[String(taskInfo.status || '').toLowerCase()] || taskInfo.status || 'UNKNOWN'
  return {
    ...data,
    output: {
      task_id: taskInfo.id,
      task_status: taskStatus,
      video_url: data.videos?.[0],
      videos: data.videos,
      message: taskInfo.error?.detail || taskInfo.error?.title,
      mule_task_info: taskInfo,
    },
  }
}

function normalizeMuleRouterCreate(data) {
  const taskInfo = data.task_info || {}
  return {
    ...data,
    output: {
      task_id: taskInfo.id,
      task_status: taskInfo.status ? normalizeMuleRouterStatus(data).output.task_status : 'PENDING',
      mule_task_info: taskInfo,
    },
  }
}

async function readUpstreamJson(response) {
  const text = await response.text()
  try { return JSON.parse(text) }
  catch { return { raw: text } }
}

export async function wanImageToVideoHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body
  try { body = await parseBody(req) }
  catch (error) { return res.status(400).json({ error: error.message }) }

  const provider = body.provider === 'mulerouter' ? 'mulerouter' : 'dashscope'
  const apiKey = provider === 'mulerouter'
    ? String(body.muleRouterApiKey || process.env.MULE_ROUTER_API_KEY || '').trim()
    : String(body.apiKey || body.dashscopeApiKey || process.env.DASHSCOPE_API_KEY || process.env.WAN_API_KEY || '').trim()
  if (!apiKey) {
    return res.status(500).json({
      error: provider === 'mulerouter'
        ? 'Missing MuleRouter API key. Enter a MuleRouter key in the page textbox or add MULE_ROUTER_API_KEY to server environment variables.'
        : 'Missing DASHSCOPE_API_KEY/WAN_API_KEY. Enter a key in the page textbox or add it to server environment variables.',
    })
  }

  const action = body.action || 'create'
  const apiBase = getApiBase()

  try {
    if (provider === 'mulerouter') {
      if (action === 'status') {
        const taskId = String(body.taskId || body.task_id || '').trim()
        if (!taskId) return res.status(400).json({ error: 'Missing taskId.' })
        const upstream = await fetch(`${MULEROUTER_API_BASE}/generation/${encodeURIComponent(taskId)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        })
        const data = normalizeMuleRouterStatus(await readUpstreamJson(upstream))
        return res.status(upstream.status).json(data)
      }

      const upstream = await fetch(`${MULEROUTER_API_BASE}/generation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(buildMuleRouterPayload(body)),
      })
      const data = normalizeMuleRouterCreate(await readUpstreamJson(upstream))
      return res.status(upstream.status).json(data)
    }

    if (action === 'status') {
      const taskId = String(body.taskId || body.task_id || '').trim()
      if (!taskId) return res.status(400).json({ error: 'Missing taskId.' })
      const upstream = await fetch(`${apiBase}/tasks/${encodeURIComponent(taskId)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const data = await readUpstreamJson(upstream)
      return res.status(upstream.status).json(data)
    }

    const payload = buildCreatePayload(body)
    const upstream = await fetch(`${apiBase}/services/aigc/video-generation/video-synthesis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'X-DashScope-Async': 'enable',
      },
      body: JSON.stringify(payload),
    })
    const data = await readUpstreamJson(upstream)
    return res.status(upstream.status).json(data)
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Wan image-to-video request failed.' })
  }
}

export default wanImageToVideoHandler
