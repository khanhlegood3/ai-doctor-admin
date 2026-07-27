import React, { useEffect, useRef, useState } from 'react'
import { Client } from '@gradio/client'
import { ExternalLink, Github, Image, Loader2, Sparkles, Video } from 'lucide-react'
import { useApp } from '../context/AppContext'

const WAN_LINKS = {
  github: 'https://github.com/Wan-Video/Wan2.1',
  longCatSpace: 'https://huggingface.co/spaces/victor/LongCat-Video-Avatar-1.5',
  longCatBlog: 'https://huggingface.co/blog/victor/building-zerogpu-spaces-autonomously',
  api: 'https://wan.video/api',
  muleRouter: 'https://www.mulerouter.ai/models/wan2-2-i2v-flash',
  modelStudio: 'https://modelstudio.console.alibabacloud.com/ap-southeast-1?spm=a2ty_o05.31384571.0.0.54719f6bnNTc6q&tab=dashboard#/efm/model_experience_center/vision/videoGenerate?modelId=wan2.7-i2v',
}

const POLL_INTERVAL_MS = 15000
const DEFAULT_IMAGE = 'https://wanx.alicdn.com/material/20250318/first_frame.png'

function LinkButton({ href, icon, label, primary, isDark }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 800, textDecoration: 'none', border: primary ? '1px solid transparent' : `1px solid ${isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.12)'}`, background: primary ? 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)' : 'transparent', color: primary ? '#fff' : (isDark ? '#e8f0f8' : '#172033') }}>
      {icon}{label}
    </a>
  )
}

function Field({ label, children, hint, text, text2 }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 900, color: text }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11, color: text2, lineHeight: 1.45 }}>{hint}</span>}
    </label>
  )
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function MyImageToVideoPanel({ onPrev, prevLabel }) {
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const vi = lang !== 'en'
  const pollTimerRef = useRef(null)
  const [provider, setProvider] = useState('dashscope')
  const [apiKey, setApiKey] = useState('')
  const [muleRouterApiKey, setMuleRouterApiKey] = useState('')
  const [form, setForm] = useState({
    imageUrl: DEFAULT_IMAGE,
    lastFrameUrl: '',
    prompt: 'Realistic cinematic motion. The camera slowly pushes in, subtle natural movement, soft light, high detail.',
    negativePrompt: 'low resolution, blurry, distorted, bad quality',
    resolution: '720P',
    duration: 5,
    promptExtend: true,
    watermark: true,
    longCatAudio: null,
    longCatPrompt: 'A person is speaking expressively, looking at the camera.',
    longCatResolution: '480p',
    longCatSeed: 42,
    longCatVocalMode: 'Clean speech (fast)',
    longCatAcceleration: 'DBCache faster',
  })
  const [previewImage, setPreviewImage] = useState(DEFAULT_IMAGE)
  const [task, setTask] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [raw, setRaw] = useState(null)
  const [longCatVideoUrl, setLongCatVideoUrl] = useState('')

  const border = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(15,23,42,0.09)'
  const surface = isDark ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.82)'
  const inputBg = isDark ? 'rgba(2,6,23,0.7)' : '#fff'
  const text = isDark ? '#e8f0f8' : '#172033'
  const text2 = isDark ? 'rgba(232,240,248,0.66)' : '#566070'

  useEffect(() => () => window.clearTimeout(pollTimerRef.current), [])

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const pollTask = async (taskId, immediate = false) => {
    window.clearTimeout(pollTimerRef.current)
    if (!immediate) await new Promise(resolve => { pollTimerRef.current = window.setTimeout(resolve, POLL_INTERVAL_MS) })
    try {
      const res = await fetch('/api/wan-image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', taskId, apiKey, muleRouterApiKey, provider }),
      })
      const data = await res.json()
      setRaw(data)
      const output = data.output || {}
      setTask(prev => ({ ...prev, ...output, request_id: data.request_id, usage: data.usage }))
      const nextStatus = output.task_status || 'UNKNOWN'
      setStatus(nextStatus)
      if (nextStatus === 'PENDING' || nextStatus === 'RUNNING') pollTask(taskId)
      if (nextStatus === 'FAILED') setError(output.message || data.message || 'Wan task failed.')
    } catch (err) {
      setError(err?.message || 'Không thể kiểm tra trạng thái task Wan.')
      setStatus('error')
    }
  }

  const submit = async (event) => {
    event.preventDefault()
    if (provider === 'longcat') {
      await submitLongCat()
      return
    }
    window.clearTimeout(pollTimerRef.current)
    setError('')
    setRaw(null)
    setTask(null)
    setLongCatVideoUrl('')
    setStatus('submitting')
    try {
      const res = await fetch('/api/wan-image-to-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...form, firstFrameUrl: form.imageUrl, apiKey, muleRouterApiKey, provider }),
      })
      const data = await res.json()
      setRaw(data)
      if (!res.ok) throw new Error(data.error || data.message || 'Wan API request failed.')
      const output = data.output || {}
      const taskId = output.task_id
      if (!taskId) throw new Error('Wan API không trả về task_id.')
      setTask({ ...output, request_id: data.request_id })
      setStatus(output.task_status || 'PENDING')
      pollTask(taskId, true)
    } catch (err) {
      setError(err?.message || 'Không thể tạo video Wan.')
      setStatus('error')
    }
  }


  const submitLongCat = async () => {
    window.clearTimeout(pollTimerRef.current)
    setError('')
    setRaw(null)
    setTask(null)
    setLongCatVideoUrl('')
    if (!form.longCatAudio) {
      setError(vi ? 'Vui lòng upload audio điều khiển cho LongCat.' : 'Please upload driving audio for LongCat.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    try {
      const imageInput = form.imageUrl?.startsWith('data:') ? await (await fetch(form.imageUrl)).blob() : form.imageUrl
      const client = await Client.connect('victor/LongCat-Video-Avatar-1.5')
      const result = await client.predict('/generate', {
        image_path: imageInput,
        audio_path: form.longCatAudio,
        prompt: form.longCatPrompt,
        resolution: form.longCatResolution,
        seed: Number(form.longCatSeed) || 42,
        vocal_mode: form.longCatVocalMode,
        acceleration: form.longCatAcceleration,
      })
      const output = result?.data?.[0]
      const outputUrl = typeof output === 'string' ? output : (output?.url || output?.path || '')
      setRaw(result)
      setTask({ provider: 'longcat', output })
      setLongCatVideoUrl(outputUrl)
      setStatus('COMPLETED')
      if (!outputUrl) setError(vi ? 'LongCat đã trả kết quả nhưng không tìm thấy URL video trong response.' : 'LongCat returned a result, but no video URL was found in the response.')
    } catch (err) {
      setError(err?.message || (vi ? 'Không thể tạo video avatar LongCat.' : 'Unable to generate LongCat avatar video.'))
      setStatus('error')
    }
  }

  const onFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError(vi ? 'Ảnh tối đa 20 MB theo giới hạn Wan API.' : 'Wan API image limit is 20 MB.')
      return
    }
    const dataUrl = await readFileAsDataUrl(file)
    updateForm('imageUrl', dataUrl)
    setPreviewImage(dataUrl)
  }

  const inputStyle = { width: '100%', boxSizing: 'border-box', border: `1px solid ${border}`, borderRadius: 12, background: inputBg, color: text, padding: '10px 12px', fontFamily: 'inherit', fontSize: 13 }
  const busy = ['submitting', 'PENDING', 'RUNNING'].includes(status)
  const videoUrl = longCatVideoUrl || task?.video_url || task?.videos?.[0]

  return (
    <div style={{ maxWidth: 1120, margin: '0 auto', padding: '4px 4px 40px' }}>
      <div style={{ borderRadius: 24, padding: 24, marginBottom: 18, border: `1px solid ${border}`, background: isDark ? 'radial-gradient(circle at 18% 8%, rgba(6,182,212,0.24), transparent 32%), linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,27,75,0.92))' : 'radial-gradient(circle at 18% 8%, rgba(6,182,212,0.18), transparent 32%), linear-gradient(135deg, #ffffff, #eef6ff)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 54, height: 54, borderRadius: 18, background: 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)', display: 'grid', placeItems: 'center' }}><Video size={26} color="#fff" /></div>
          <div style={{ flex: 1, minWidth: 250 }}>
            <h2 style={{ margin: 0, fontSize: 23, fontWeight: 950, color: text }}>My Image to Video <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 9px', borderRadius: 999, color: '#fff', background: '#7c3aed' }}>{provider === 'longcat' ? 'LongCat Avatar' : 'Wan API thật'}</span></h2>
            <p style={{ margin: '8px 0 0', fontSize: 13.5, color: text2, lineHeight: 1.7, maxWidth: 820 }}>{vi ? 'Tạo video thật từ ảnh bằng Wan image-to-video qua server proxy /api/wan-image-to-video. Bạn có thể nhập DASHSCOPE/Wan key hoặc MuleRouter key ngay trên màn hình, chọn nhà cung cấp, rồi tạo video thật.' : 'Generate real image-to-video output through the server-side /api/wan-image-to-video proxy. You can enter a DASHSCOPE/Wan key or MuleRouter key on this screen, choose a provider, and generate a real video.'}</p>
          </div>
        </div>
        <div style={{ marginTop: 18, color: text2, fontSize: 12.5, fontWeight: 800 }}>
          {vi ? 'Các link dự án ngoài đã được ẩn theo cấu hình nội bộ.' : 'External project links are hidden by internal configuration.'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: 16 }}>
        <form onSubmit={submit} style={{ display: 'grid', gap: 12, background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: 16 }}>
          <Field label={vi ? 'Nhà cung cấp API' : 'API provider'} text={text} text2={text2}>
            <select value={provider} onChange={e => setProvider(e.target.value)} style={inputStyle}>
              <option value="dashscope">Wan / DashScope / Alibaba Model Studio</option>
              <option value="mulerouter">MuleRouter - Wan 2.2 I2V Flash</option>
              <option value="longcat">Hugging Face - LongCat Video Avatar 1.5</option>
            </select>
          </Field>
          {provider === 'longcat' && (
            <div style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 10, color: text2, fontSize: 11.5, lineHeight: 1.55 }}>
              {vi ? 'LongCat tạo video avatar nói theo audio bằng Hugging Face Space victor/LongCat-Video-Avatar-1.5 qua @gradio/client. Upload ảnh chân dung và file audio, sau đó gọi API /generate trực tiếp từ trình duyệt.' : 'LongCat creates a talking avatar video from a reference image and driving audio through the Hugging Face Space victor/LongCat-Video-Avatar-1.5 using @gradio/client. Upload a portrait image and audio file, then call the /generate API directly from the browser.'}
            </div>
          )}
          {provider !== 'longcat' && (<>
          <Field
            label="DASHSCOPE_API_KEY / WAN_API_KEY"
            hint={vi ? 'Bạn có thể nhập key trực tiếp để chạy ngay. Key chỉ được gửi tới server proxy /api/wan-image-to-video cho request hiện tại; cách khuyến nghị khi deploy vẫn là cấu hình biến môi trường trên server.' : 'Enter a key to run immediately. The key is sent only to the /api/wan-image-to-video server proxy for this request; server environment variables are still recommended for deployment.'}
            text={text}
            text2={text2}
          >
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder={vi ? 'Nhập DASHSCOPE_API_KEY hoặc WAN_API_KEY...' : 'Enter DASHSCOPE_API_KEY or WAN_API_KEY...'}
              style={inputStyle}
            />
          </Field>
          <Field
            label="MuleRouter API key"
            hint={vi ? 'Nhập API key tài khoản MuleRouter của bạn để gọi model wan2.2-i2v-flash. Vì lý do bảo mật, key không được hard-code trong source code.' : 'Enter your MuleRouter account API key to call wan2.2-i2v-flash. For security, the key is not hard-coded in source code.'}
            text={text}
            text2={text2}
          >
            <input
              type="password"
              autoComplete="off"
              value={muleRouterApiKey}
              onChange={e => setMuleRouterApiKey(e.target.value)}
              placeholder={vi ? 'Nhập MuleRouter API key...' : 'Enter MuleRouter API key...'}
              style={inputStyle}
            />
          </Field>
          </>)}
          {provider === 'mulerouter' && (
            <div style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 10, color: text2, fontSize: 11.5, lineHeight: 1.55 }}>
              {vi ? 'MuleRouter Wan 2.2 I2V Flash dùng ảnh URL/base64 tối đa 10MB, prompt tối đa 800 ký tự, resolution 480P/720P và duration cố định 5 giây.' : 'MuleRouter Wan 2.2 I2V Flash supports URL/base64 images up to 10MB, prompt up to 800 characters, 480P/720P resolution, and fixed 5-second duration.'}
            </div>
          )}
          <Field label={vi ? 'Ảnh đầu vào (URL hoặc upload)' : 'Input image (URL or upload)'} hint={vi ? 'Wan hỗ trợ URL công khai hoặc data URL base64; ảnh tối đa 20 MB.' : 'Wan supports public URLs or base64 data URLs; max 20 MB.'} text={text} text2={text2}>
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={form.imageUrl.startsWith('data:') ? '(base64 image uploaded)' : form.imageUrl} onChange={e => { updateForm('imageUrl', e.target.value); setPreviewImage(e.target.value) }} style={inputStyle} />
              <input type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={onFile} style={{ color: text }} />
            </div>
          </Field>
          {provider === 'longcat' && (<>
            <Field label={vi ? 'Audio điều khiển' : 'Driving audio'} hint={vi ? 'Upload WAV/MP3/M4A chứa giọng nói để điều khiển avatar.' : 'Upload WAV/MP3/M4A speech audio to drive the avatar.'} text={text} text2={text2}>
              <input type="file" accept="audio/*" onChange={e => updateForm('longCatAudio', e.target.files?.[0] || null)} style={{ color: text }} />
            </Field>
            <Field label="LongCat prompt" text={text} text2={text2}>
              <textarea value={form.longCatPrompt} onChange={e => updateForm('longCatPrompt', e.target.value)} rows={3} style={inputStyle} />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              <Field label="Resolution" text={text}><select value={form.longCatResolution} onChange={e => updateForm('longCatResolution', e.target.value)} style={inputStyle}><option>480p</option><option>720p</option></select></Field>
              <Field label="Seed" text={text}><input type="number" value={form.longCatSeed} onChange={e => updateForm('longCatSeed', e.target.value)} style={inputStyle} /></Field>
              <Field label={vi ? 'Xử lý audio' : 'Audio preprocessing'} text={text}><select value={form.longCatVocalMode} onChange={e => updateForm('longCatVocalMode', e.target.value)} style={inputStyle}><option>Clean speech (fast)</option><option>Noisy speech (slower)</option></select></Field>
              <Field label="Acceleration" text={text}><select value={form.longCatAcceleration} onChange={e => updateForm('longCatAcceleration', e.target.value)} style={inputStyle}><option>DBCache faster</option><option>None</option></select></Field>
            </div>
          </>)}
          {provider !== 'longcat' && (<>
          <Field label={vi ? 'Prompt chuyển động' : 'Motion prompt'} text={text} text2={text2}>
            <textarea value={form.prompt} onChange={e => updateForm('prompt', e.target.value)} rows={4} style={inputStyle} />
          </Field>
          <Field label={vi ? 'Negative prompt' : 'Negative prompt'} text={text} text2={text2}>
            <input value={form.negativePrompt} onChange={e => updateForm('negativePrompt', e.target.value)} style={inputStyle} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Field label="Resolution" text={text}><select value={form.resolution} onChange={e => updateForm('resolution', e.target.value)} style={inputStyle}><option>720P</option><option>480P</option><option disabled={provider === 'mulerouter'}>1080P</option></select></Field>
            <Field label={vi ? 'Thời lượng (2-15s)' : 'Duration (2-15s)'} text={text}><input type="number" min="2" max="15" value={form.duration} onChange={e => updateForm('duration', e.target.value)} style={inputStyle} /></Field>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', color: text, fontSize: 12, fontWeight: 800 }}>
            <label><input type="checkbox" checked={form.promptExtend} onChange={e => updateForm('promptExtend', e.target.checked)} /> Prompt extend</label>
            <label><input type="checkbox" checked={form.watermark} onChange={e => updateForm('watermark', e.target.checked)} /> Watermark</label>
          </div>
          </>)}
          <button type="submit" disabled={busy} style={{ border: 0, borderRadius: 14, padding: '13px 16px', cursor: busy ? 'wait' : 'pointer', color: '#fff', fontWeight: 950, background: busy ? '#64748b' : 'linear-gradient(135deg, #06b6d4, #8b5cf6, #ec4899)' }}>
            {busy ? <><Loader2 size={14} className="spin" /> {provider === 'longcat' ? (vi ? 'Đang chạy LongCat...' : 'Running LongCat...') : (vi ? 'Đang chạy Wan...' : 'Running Wan...')}</> : (provider === 'longcat' ? (vi ? 'Tạo video avatar bằng LongCat' : 'Generate avatar video with LongCat') : (vi ? 'Tạo video thật bằng Wan API' : 'Generate real video with Wan API'))}
          </button>
          {prevLabel && <button type="button" onClick={onPrev} style={{ border: `1px solid ${border}`, borderRadius: 999, background: 'transparent', color: text, padding: '9px 13px', cursor: 'pointer', fontWeight: 800 }}>← {prevLabel}</button>}
        </form>

        <section style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
          <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 20, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: text, fontWeight: 950, marginBottom: 10 }}><Image size={16} /> Preview / Result</div>
            {videoUrl ? <video src={videoUrl} controls style={{ width: '100%', borderRadius: 14, background: '#000' }} /> : <img src={previewImage} alt="Wan input preview" style={{ width: '100%', maxHeight: 360, objectFit: 'contain', borderRadius: 14, background: isDark ? '#020617' : '#f8fafc' }} />}
            <div style={{ marginTop: 10, color: text2, fontSize: 12, lineHeight: 1.6 }}>
              Status: <b style={{ color: text }}>{status}</b>{task?.task_id ? ` · task_id: ${task.task_id}` : ''}
              {videoUrl && <div><a href={videoUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#06b6d4', fontWeight: 900 }}>{vi ? 'Mở / tải video MP4' : 'Open / download MP4'}</a></div>}
            </div>
          </div>
          {error && <div style={{ border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderRadius: 16, padding: 12, fontSize: 13, fontWeight: 800 }}>{error}</div>}
          {raw && <pre style={{ margin: 0, maxHeight: 260, overflow: 'auto', whiteSpace: 'pre-wrap', background: isDark ? '#020617' : '#f8fafc', color: text2, border: `1px solid ${border}`, borderRadius: 16, padding: 12, fontSize: 11 }}>{JSON.stringify(raw, null, 2)}</pre>}
        </section>
      </div>
    </div>
  )
}
