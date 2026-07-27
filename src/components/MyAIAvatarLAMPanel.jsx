import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

const LAM_REPO_URL = 'https://github.com/aigc3d/LAM'
const LAM_PROJECT_URL = 'https://aigc3d.github.io/projects/LAM/'
const DEFAULT_LAM_SERVER_URL = 'http://127.0.0.1:7860'
const LAM_SERVER_STORAGE_KEY = 'ai_doctor_lam_gradio_server_url'
const DEFAULT_MOTION_VIDEO = 'assets/sample_motion/export/wink/wink.mp4'

function normalizeServerUrl(value) {
  const trimmed = String(value || '').trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_LAM_SERVER_URL
}

function toAbsoluteUrl(serverUrl, path = '') {
  return new URL(path || '/', `${normalizeServerUrl(serverUrl)}/`).toString()
}

function readSavedServerUrl() {
  if (typeof window === 'undefined') return DEFAULT_LAM_SERVER_URL
  return normalizeServerUrl(window.localStorage.getItem(LAM_SERVER_STORAGE_KEY) || DEFAULT_LAM_SERVER_URL)
}

function parseSseData(text) {
  return text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s*/, '').trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) } catch { return line }
    })
}

function extractUploadPath(responseJson) {
  if (Array.isArray(responseJson)) return responseJson[0]
  if (Array.isArray(responseJson?.files)) return responseJson.files[0]
  if (Array.isArray(responseJson?.data)) return responseJson.data[0]
  return responseJson?.path || responseJson?.file || responseJson?.name || ''
}

export default function MyAIAvatarLAMPanel() {
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const vi = lang === 'vi'
  const selectedFileRef = useRef(null)

  const [serverUrl, setServerUrl] = useState(readSavedServerUrl)
  const [inputServerUrl, setInputServerUrl] = useState(readSavedServerUrl)
  const [apiInfo, setApiInfo] = useState(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState('')
  const [status, setStatus] = useState(vi ? 'Chưa kết nối LAM' : 'LAM not connected')
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('generate')
  const [events, setEvents] = useState([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [motionVideo, setMotionVideo] = useState(DEFAULT_MOTION_VIDEO)
  const [exportOacZip, setExportOacZip] = useState(true)
  const [uploadedLamPath, setUploadedLamPath] = useState('')
  const [generatedResult, setGeneratedResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const palette = useMemo(() => ({
    text: isDark ? '#e8f0f8' : '#172033',
    text2: isDark ? 'rgba(232,240,248,0.68)' : '#526071',
    text3: isDark ? 'rgba(232,240,248,0.45)' : '#7b8794',
    card: isDark ? 'rgba(255,255,255,0.055)' : '#fff',
    card2: isDark ? 'rgba(255,255,255,0.08)' : '#f8fafc',
    border: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)',
    accent: '#00e5ff',
    violet: '#9c6fff',
    green: '#00e676',
    danger: '#ff6b6b',
  }), [isDark])

  const gradioUrl = useMemo(() => toAbsoluteUrl(serverUrl, '/'), [serverUrl])
  const apiInfoUrl = useMemo(() => toAbsoluteUrl(serverUrl, '/gradio_api/info'), [serverUrl])
  const uploadUrl = useMemo(() => toAbsoluteUrl(serverUrl, '/gradio_api/upload'), [serverUrl])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const appendEvent = (type, detail) => {
    const time = new Date().toLocaleTimeString()
    setEvents((current) => [{ time, type, detail }, ...current].slice(0, 60))
  }

  const saveServerUrl = () => {
    const next = normalizeServerUrl(inputServerUrl)
    setServerUrl(next)
    window.localStorage.setItem(LAM_SERVER_STORAGE_KEY, next)
    setApiInfo(null)
    setSelectedEndpoint('')
    setError('')
    appendEvent('server', next)
  }

  const discoverLamApi = async () => {
    setBusy(true)
    setStatus(vi ? 'Đang đọc Gradio API của LAM...' : 'Reading LAM Gradio API...')
    setError('')
    try {
      const response = await fetch(apiInfoUrl, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const info = await response.json()
      const named = info?.named_endpoints || info?.endpoints || {}
      const endpointKeys = Object.keys(named)
      const preferred = endpointKeys.find((key) => /predict|generate|lam|core|submit/i.test(key)) || endpointKeys[0] || '/predict'
      setApiInfo(info)
      setSelectedEndpoint(preferred)
      setStatus(vi ? 'Đã kết nối API LAM Gradio' : 'LAM Gradio API connected')
      appendEvent('api:info', JSON.stringify(info, null, 2))
      return { info, endpoint: preferred }
    } catch (err) {
      const message = err?.message || String(err)
      setStatus(vi ? 'Không đọc được API LAM' : 'Could not read LAM API')
      setError(message)
      appendEvent('error', message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const uploadPortraitToLam = async () => {
    const file = selectedFileRef.current
    if (!file) {
      const message = vi ? 'Hãy chọn ảnh chân dung trước.' : 'Please choose a portrait first.'
      setError(message)
      appendEvent('error', message)
      return ''
    }

    setBusy(true)
    setError('')
    setStatus(vi ? 'Đang upload ảnh vào LAM Gradio...' : 'Uploading portrait to LAM Gradio...')
    try {
      const formData = new FormData()
      formData.append('files', file, file.name)
      const response = await fetch(uploadUrl, { method: 'POST', body: formData })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      const uploadedPath = extractUploadPath(result)
      if (!uploadedPath) throw new Error(vi ? 'Upload thành công nhưng không nhận được file path từ Gradio.' : 'Upload succeeded but Gradio returned no file path.')
      setUploadedLamPath(uploadedPath)
      setStatus(vi ? 'Đã upload ảnh vào LAM' : 'Portrait uploaded to LAM')
      appendEvent('upload', JSON.stringify(result, null, 2))
      return uploadedPath
    } catch (err) {
      const message = err?.message || String(err)
      setStatus(vi ? 'Upload LAM thất bại' : 'LAM upload failed')
      setError(message)
      appendEvent('error', message)
      return ''
    } finally {
      setBusy(false)
    }
  }

  const callLamGenerate = async () => {
    setBusy(true)
    setError('')
    setGeneratedResult(null)
    try {
      const discovered = selectedEndpoint ? { endpoint: selectedEndpoint } : await discoverLamApi()
      const endpoint = discovered?.endpoint || selectedEndpoint || '/predict'
      const uploadedPath = uploadedLamPath || await uploadPortraitToLam()
      if (!uploadedPath) return

      // Mirrors LAM's Gradio app_lam.py source: core_fn receives input image,
      // motion video, a working-dir Gradio State, and the optional OpenAvatarChat ZIP export flag.
      const payload = {
        data: [uploadedPath, motionVideo, null, exportOacZip],
        event_data: null,
        fn_index: 0,
      }
      const callUrl = toAbsoluteUrl(serverUrl, `/gradio_api/call/${endpoint.replace(/^\//, '')}`)
      setStatus(vi ? 'Đang gọi LAM Generate...' : 'Calling LAM Generate...')
      appendEvent('generate:request', `${callUrl}\n${JSON.stringify(payload, null, 2)}`)

      const response = await fetch(callUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const submitted = await response.json()
      appendEvent('generate:submitted', JSON.stringify(submitted, null, 2))

      const eventId = submitted?.event_id || submitted?.eventId
      if (!eventId) {
        setGeneratedResult(submitted)
        setStatus(vi ? 'LAM trả kết quả trực tiếp' : 'LAM returned a direct result')
        return
      }

      const eventUrl = toAbsoluteUrl(serverUrl, `/gradio_api/call/${endpoint.replace(/^\//, '')}/${eventId}`)
      const eventResponse = await fetch(eventUrl, { headers: { Accept: 'text/event-stream' } })
      if (!eventResponse.ok) throw new Error(`Event HTTP ${eventResponse.status}`)
      const eventText = await eventResponse.text()
      const parsedEvents = parseSseData(eventText)
      setGeneratedResult(parsedEvents)
      setStatus(vi ? 'LAM Generate hoàn tất' : 'LAM Generate completed')
      appendEvent('generate:result', JSON.stringify(parsedEvents, null, 2))
    } catch (err) {
      const message = err?.message || String(err)
      setStatus(vi ? 'LAM Generate thất bại' : 'LAM Generate failed')
      setError(message)
      appendEvent('error', message)
    } finally {
      setBusy(false)
    }
  }

  const handlePickImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    selectedFileRef.current = file
    setFileName(file.name)
    setPreviewUrl(URL.createObjectURL(file))
    setUploadedLamPath('')
    setGeneratedResult(null)
    appendEvent('portrait', `${file.name} · ${Math.round(file.size / 1024)}KB`)
  }

  const installCommands = [
    'git clone https://github.com/aigc3d/LAM.git',
    'cd LAM',
    'sh ./scripts/install/install_cu121.sh   # hoặc install_cu118.sh',
    'huggingface-cli download 3DAIGC/LAM-assets --local-dir ./tmp',
    'tar -xf ./tmp/LAM_assets.tar && rm ./tmp/LAM_assets.tar',
    'tar -xf ./tmp/thirdparty_models.tar && rm -r ./tmp/',
    'huggingface-cli download 3DAIGC/LAM-20K --local-dir ./model_zoo/lam_models/releases/lam/lam-20k/step_045500/',
    'python app_lam.py --blender_path /path/to/blender',
  ]

  return (
    <div style={{ padding: 24, color: palette.text, maxWidth: 1440, margin: '0 auto' }}>
      <style>{`
        .lam-card { border:1px solid ${palette.border}; border-radius:22px; background:${palette.card}; box-shadow:${isDark ? '0 20px 70px rgba(0,0,0,.26)' : '0 18px 55px rgba(15,23,42,.08)'}; }
        .lam-btn { border:1px solid ${palette.border}; border-radius:14px; padding:11px 14px; font-weight:900; font-family:inherit; cursor:pointer; }
        .lam-input { border:1px solid ${palette.border}; border-radius:14px; padding:11px 12px; background:${palette.card2}; color:${palette.text}; font-family:inherit; }
        .lam-grid { display:grid; grid-template-columns:minmax(310px, .82fr) minmax(420px, 1.18fr); gap:18px; align-items:start; }
        @media (max-width: 980px) { .lam-grid { grid-template-columns:1fr; } }
      `}</style>

      <section className="lam-card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '26px 28px', background: 'radial-gradient(circle at top left, rgba(0,229,255,.24), transparent 34%), linear-gradient(135deg, rgba(156,111,255,.20), rgba(0,229,255,.10))', borderBottom: `1px solid ${palette.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, letterSpacing: '.16em', textTransform: 'uppercase', color: palette.accent, fontWeight: 900 }}>LAM · One-shot Animatable Gaussian Head</div>
              <h1 style={{ margin: '8px 0 8px', fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 1.05 }}>My AI Avatar</h1>
              <p style={{ margin: 0, maxWidth: 850, color: palette.text2, lineHeight: 1.65 }}>
                {vi
                  ? 'Tính năng LAM thật theo source app_lam.py: upload một ảnh chân dung, chọn motion mẫu, gọi Gradio API Generate để nhận ảnh đã xử lý, video avatar 3D và ZIP export cho OpenAvatarChat khi bật Blender.'
                  : 'A real LAM flow based on app_lam.py: upload one portrait, choose a sample motion, call the Gradio Generate API, and receive the processed image, 3D avatar video, plus an OpenAvatarChat ZIP export when Blender is enabled.'}
              </p>
            </div>
            <div style={{ color: palette.text2, fontSize: 12, fontWeight: 800, lineHeight: 1.6 }}>
              Link GitHub/trang dự án ngoài đã được ẩn theo cấu hình nội bộ.
            </div>
          </div>
        </div>

        <div className="lam-grid" style={{ padding: 18 }}>
          <aside style={{ display: 'grid', gap: 14 }}>
            <div className="lam-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, color: palette.text3, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>{vi ? 'LAM Gradio backend' : 'LAM Gradio backend'}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <input className="lam-input" value={inputServerUrl} onChange={(event) => setInputServerUrl(event.target.value)} placeholder="http://127.0.0.1:7860" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" className="lam-btn" onClick={saveServerUrl} style={{ background: palette.card2, color: palette.text }}>{vi ? 'Lưu URL' : 'Save URL'}</button>
                  <button type="button" className="lam-btn" onClick={discoverLamApi} disabled={busy} style={{ background: 'rgba(0,229,255,.14)', color: palette.accent }}>{vi ? 'Đọc API' : 'Read API'}</button>
                </div>
                <div style={{ color: error ? palette.danger : palette.green, fontSize: 12, fontWeight: 800 }}>{status}</div>
                {error && <div style={{ color: palette.danger, fontSize: 12, lineHeight: 1.5 }}>{error}</div>}
              </div>
            </div>

            <div className="lam-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, color: palette.text3, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>{vi ? 'Input Image' : 'Input Image'}</div>
              <label style={{ display: 'grid', placeItems: 'center', minHeight: 260, border: `2px dashed ${palette.border}`, borderRadius: 20, background: palette.card2, cursor: 'pointer', overflow: 'hidden' }}>
                {previewUrl ? <img src={previewUrl} alt="Selected portrait preview" style={{ width: '100%', height: 260, objectFit: 'cover' }} /> : (
                  <div style={{ textAlign: 'center', padding: 22 }}>
                    <div style={{ fontSize: 46, marginBottom: 10 }}>🧑‍🚀</div>
                    <div style={{ fontWeight: 900 }}>{vi ? 'Chọn ảnh chân dung' : 'Choose a portrait'}</div>
                    <div style={{ color: palette.text3, fontSize: 12, marginTop: 8 }}>{vi ? 'Ảnh chính diện cho LAM one-shot reconstruction' : 'Front-facing image for LAM one-shot reconstruction'}</div>
                  </div>
                )}
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePickImage} style={{ display: 'none' }} />
              </label>
              {fileName && <div style={{ marginTop: 10, color: palette.green, fontSize: 12, fontWeight: 800 }}>✓ {fileName}</div>}
            </div>

            <div className="lam-card" style={{ padding: 18 }}>
              <div style={{ fontSize: 11, color: palette.text3, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 10 }}>{vi ? 'LAM Generate' : 'LAM Generate'}</div>
              <label style={{ display: 'grid', gap: 6, color: palette.text2, fontSize: 12, marginBottom: 10 }}>
                {vi ? 'Motion video trong LAM assets' : 'Motion video in LAM assets'}
                <input className="lam-input" value={motionVideo} onChange={(event) => setMotionVideo(event.target.value)} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.text2, fontSize: 12, marginBottom: 12 }}>
                <input type="checkbox" checked={exportOacZip} onChange={(event) => setExportOacZip(event.target.checked)} />
                {vi ? 'Export ZIP cho OpenAvatarChat (cần Blender path)' : 'Export OpenAvatarChat ZIP (requires Blender path)'}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button type="button" className="lam-btn" onClick={uploadPortraitToLam} disabled={busy} style={{ background: 'rgba(156,111,255,.16)', color: palette.violet }}>{vi ? 'Upload LAM' : 'Upload LAM'}</button>
                <button type="button" className="lam-btn" onClick={callLamGenerate} disabled={busy} style={{ background: 'rgba(0,230,118,.14)', color: palette.green }}>{busy ? (vi ? 'Đang chạy...' : 'Running...') : 'Generate'}</button>
              </div>
              {uploadedLamPath && <div style={{ marginTop: 10, color: palette.text3, fontSize: 11, wordBreak: 'break-all' }}>{uploadedLamPath}</div>}
            </div>
          </aside>

          <main className="lam-card" style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 6, padding: 12, borderBottom: `1px solid ${palette.border}`, background: palette.card2, flexWrap: 'wrap' }}>
              {[['generate', 'Result'], ['gradio', 'LAM Gradio UI'], ['api', 'API'], ['install', vi ? 'Cài đặt LAM' : 'Install LAM'], ['events', 'Events']].map(([id, label]) => (
                <button key={id} type="button" onClick={() => setActiveTab(id)} className="lam-btn" style={{ background: activeTab === id ? 'rgba(0,229,255,.16)' : 'transparent', color: activeTab === id ? palette.accent : palette.text2, padding: '8px 12px' }}>{label}</button>
              ))}
            </div>

            {activeTab === 'generate' && (
              <div style={{ padding: 18, display: 'grid', gap: 12 }}>
                <h2 style={{ margin: 0, color: palette.text }}>{vi ? 'Kết quả LAM' : 'LAM result'}</h2>
                <p style={{ margin: 0, color: palette.text2, lineHeight: 1.65 }}>{vi ? 'Kết quả thường gồm Processed Image, Rendered Video MP4 và đường dẫn ZIP OpenAvatarChat nếu bật export trong app_lam.py.' : 'Results usually include a processed image, rendered MP4 video, and an OpenAvatarChat ZIP path when export is enabled in app_lam.py.'}</p>
                <pre style={{ margin: 0, minHeight: 360, maxHeight: 560, overflow: 'auto', padding: 14, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.card2, color: palette.text, fontSize: 12 }}>{JSON.stringify(generatedResult || { status, uploadedLamPath, endpoint: selectedEndpoint || '(discover API first)' }, null, 2)}</pre>
              </div>
            )}

            {activeTab === 'gradio' && (
              <div>
                <div style={{ padding: '10px 14px', color: palette.text3, fontSize: 12, borderBottom: `1px solid ${palette.border}` }}>{gradioUrl}</div>
                <iframe title="LAM Gradio app_lam.py" src={gradioUrl} style={{ width: '100%', height: 760, border: 0, background: '#fff' }} />
              </div>
            )}

            {activeTab === 'api' && (
              <div style={{ padding: 18, display: 'grid', gap: 12 }}>
                <InfoRow label="Gradio UI" value={gradioUrl} palette={palette} />
                <InfoRow label="API info" value={apiInfoUrl} palette={palette} />
                <InfoRow label="Upload" value={uploadUrl} palette={palette} />
                <InfoRow label="Endpoint" value={selectedEndpoint || '—'} palette={palette} />
                <pre style={{ margin: 0, maxHeight: 520, overflow: 'auto', padding: 14, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.card2, color: palette.text, fontSize: 12 }}>{JSON.stringify(apiInfo || { hint: vi ? 'Bấm “Đọc API” để lấy /gradio_api/info từ backend app_lam.py.' : 'Click “Read API” to fetch /gradio_api/info from the app_lam.py backend.' }, null, 2)}</pre>
              </div>
            )}

            {activeTab === 'install' && (
              <div style={{ padding: 18, color: palette.text2, lineHeight: 1.7 }}>
                <h2 style={{ color: palette.text, marginTop: 0 }}>{vi ? 'Chạy LAM source thật' : 'Run the real LAM source'}</h2>
                <p>{vi ? 'Các lệnh này bám theo README và app_lam.py: cài CUDA build, tải assets/model weights, rồi chạy Gradio app để panel này gọi API.' : 'These commands follow README and app_lam.py: install the CUDA build, download assets/model weights, then run the Gradio app that this panel calls.'}</p>
                <pre style={{ margin: 0, padding: 14, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.card2, color: palette.text, whiteSpace: 'pre-wrap' }}>{installCommands.join('\n')}</pre>
              </div>
            )}

            {activeTab === 'events' && (
              <div style={{ padding: 18, display: 'grid', gap: 10, maxHeight: 760, overflow: 'auto' }}>
                {events.length === 0 && <div style={{ color: palette.text3 }}>{vi ? 'Chưa có event.' : 'No events yet.'}</div>}
                {events.map((event, index) => (
                  <div key={`${event.time}-${index}`} style={{ border: `1px solid ${palette.border}`, borderRadius: 14, padding: 12, background: palette.card2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: palette.text3, fontSize: 11, marginBottom: 6 }}><b>{event.type}</b><span>{event.time}</span></div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: palette.text2, fontSize: 12 }}>{event.detail}</pre>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </section>
    </div>
  )
}

function InfoRow({ label, value, palette }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 12, alignItems: 'center', border: `1px solid ${palette.border}`, borderRadius: 14, padding: '10px 12px', background: palette.card2 }}>
      <div style={{ color: palette.text3, fontSize: 11, fontWeight: 900, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: palette.text, fontSize: 12, wordBreak: 'break-all' }}>{value}</div>
    </div>
  )
}
