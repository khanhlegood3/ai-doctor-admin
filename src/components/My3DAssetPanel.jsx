import React, { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

const TRELLIS_REPO_URL = 'https://github.com/microsoft/TRELLIS.2'
const TRELLIS_MODEL_URL = 'https://huggingface.co/microsoft/TRELLIS.2-4B'
const TRELLIS_SPACE_URL = 'https://huggingface.co/spaces/microsoft/TRELLIS.2'
const TRELLIS_SPACE_ID = 'microsoft/TRELLIS.2'
const GRADIO_CLIENT_CDN = 'https://esm.sh/@gradio/client@1.18.0'
const IMAGE_TOKEN = '$IMAGE_FILE'

const PROMPT_PRESETS = [
  'Ảnh sản phẩm y tế thành mô hình GLB có PBR material',
  'Nhân vật chăm sóc sức khỏe phong cách 3D mascot',
  'Thiết bị phòng khám mini với texture kim loại và nhựa',
]

const DEFAULT_API_ARGS = JSON.stringify([
  IMAGE_TOKEN,
  0,
  true,
], null, 2)

const loadGradioClient = () => import(/* @vite-ignore */ GRADIO_CLIENT_CDN).then((module) => module.Client)

function replaceImageToken(value, imageFile) {
  if (Array.isArray(value)) return value.map((item) => replaceImageToken(item, imageFile))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceImageToken(item, imageFile)]))
  }
  return value === IMAGE_TOKEN ? imageFile : value
}

function collectFiles(value, files = []) {
  if (!value) return files
  if (typeof value === 'string') {
    if (/\.(glb|gltf|obj|stl|ply|zip|mp4)(\?|$)/i.test(value)) files.push({ name: value.split('/').pop()?.split('?')[0] || 'asset', url: value })
    return files
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectFiles(item, files))
    return files
  }
  if (typeof value === 'object') {
    const url = value.url || value.path || value.name
    if (typeof url === 'string' && /\.(glb|gltf|obj|stl|ply|zip|mp4)(\?|$)/i.test(url)) {
      files.push({ name: value.orig_name || url.split('/').pop()?.split('?')[0] || 'asset', url })
    }
    Object.values(value).forEach((item) => collectFiles(item, files))
  }
  return files
}

export default function My3DAssetPanel() {
  const { theme } = useApp()
  const isDark = theme === 'dark'
  const [assetName, setAssetName] = useState('My TRELLIS.2 Asset')
  const [prompt, setPrompt] = useState(PROMPT_PRESETS[0])
  const [sourceImage, setSourceImage] = useState(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [spaceId, setSpaceId] = useState(TRELLIS_SPACE_ID)
  const [apiEndpoint, setApiEndpoint] = useState('/generate')
  const [apiArgs, setApiArgs] = useState(DEFAULT_API_ARGS)
  const [hfToken, setHfToken] = useState('')
  const [status, setStatus] = useState('Sẵn sàng kết nối Hugging Face Space chính thức của TRELLIS.2.')
  const [apiSchema, setApiSchema] = useState(null)
  const [assetFiles, setAssetFiles] = useState([])
  const [busy, setBusy] = useState(false)

  const palette = useMemo(() => ({
    bg: isDark ? '#050812' : '#f4f7fb',
    card: isDark ? 'rgba(13,21,40,0.92)' : '#ffffff',
    card2: isDark ? 'rgba(17,29,53,0.9)' : '#eef6ff',
    border: isDark ? 'rgba(96,165,250,0.22)' : 'rgba(37,99,235,0.14)',
    text: isDark ? '#e2e8f0' : '#172033',
    text2: isDark ? '#94a3b8' : '#5b677a',
    accent: '#38bdf8',
    purple: '#a78bfa',
    gold: '#f59e0b',
    green: '#22c55e',
    red: '#fb7185',
  }), [isDark])

  const pipelineSteps = [
    { title: 'Input', body: sourceImage?.name || 'Upload ảnh tham chiếu, rồi gọi Space API', icon: '🖼️' },
    { title: 'Gradio Client', body: `Kết nối ${spaceId} qua @gradio/client`, icon: '🔌' },
    { title: 'TRELLIS.2 Image-to-3D', body: 'Sinh mesh textured/PBR bằng Space hoặc endpoint clone của bạn', icon: '🧠' },
    { title: 'Asset Library', body: assetFiles.length ? `${assetFiles.length} file sẵn sàng tải về` : `${assetName || 'Asset'} → GLB / MP4`, icon: '📦' },
  ]

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    setSourceImage(file || null)
    setSourcePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : ''
    })
    if (file) setStatus(`Đã chọn ảnh nguồn: ${file.name}`)
  }

  const inspectApi = () => {
    setBusy(true)
    setStatus('Đang đọc schema API từ Hugging Face Space...')
    loadGradioClient()
      .then((Client) => Client.connect(spaceId, hfToken ? { hf_token: hfToken } : undefined))
      .then((client) => client.view_api())
      .then((schema) => {
        setApiSchema(schema)
        setStatus('Đã tải schema API. Hãy chọn endpoint phù hợp trong schema nếu endpoint mặc định khác.')
      })
      .catch((error) => setStatus(`Không đọc được schema API: ${error?.message || error}`))
      .finally(() => setBusy(false))
  }

  const generateAsset = () => {
    if (!sourceImage) {
      setStatus('Vui lòng upload ảnh nguồn trước khi gọi TRELLIS.2 API.')
      return
    }

    let parsedArgs
    try {
      parsedArgs = JSON.parse(apiArgs)
    } catch (error) {
      setStatus(`JSON API args không hợp lệ: ${error?.message || error}`)
      return
    }

    setBusy(true)
    setStatus('Đang gửi ảnh tới Hugging Face Space TRELLIS.2...')
    loadGradioClient()
      .then((Client) => Client.connect(spaceId, hfToken ? { hf_token: hfToken } : undefined))
      .then((client) => client.predict(apiEndpoint, replaceImageToken(parsedArgs, sourceImage)))
      .then((result) => {
        const files = collectFiles(result?.data || result)
        setAssetFiles(files)
        setStatus(files.length ? `Hoàn tất. Tìm thấy ${files.length} file output từ TRELLIS.2.` : 'API đã trả kết quả nhưng chưa phát hiện link GLB/MP4. Xem raw response trong API schema/console.')
      })
      .catch((error) => setStatus(`Không tạo được asset qua Space API: ${error?.message || error}. Nếu Space yêu cầu đăng nhập, hãy nhập Hugging Face token hoặc mở app nhúng bên dưới.`))
      .finally(() => setBusy(false))
  }

  return (
    <div style={{ minHeight: '100%', background: palette.bg, color: palette.text, padding: '28px clamp(16px, 4vw, 42px)' }}>
      <div style={{ maxWidth: 1220, margin: '0 auto' }}>
        <section style={{
          border: `1px solid ${palette.border}`,
          background: `radial-gradient(circle at 18% 12%, rgba(56,189,248,0.22), transparent 32%), radial-gradient(circle at 86% 18%, rgba(167,139,250,0.20), transparent 30%), ${palette.card}`,
          borderRadius: 28,
          padding: '26px clamp(18px, 4vw, 36px)',
          boxShadow: isDark ? '0 26px 80px rgba(0,0,0,0.38)' : '0 24px 70px rgba(30,64,175,0.10)',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 760 }}>
              <div style={{ color: palette.accent, fontSize: 12, fontWeight: 900, letterSpacing: '.16em', textTransform: 'uppercase' }}>My 3D Asset · TRELLIS.2 API</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(28px, 4vw, 46px)', lineHeight: 1.02 }}>
                Tạo asset 3D thật qua Hugging Face Space của TRELLIS.2
              </h1>
              <p style={{ margin: 0, color: palette.text2, fontSize: 15, lineHeight: 1.7 }}>
                Kết nối trực tiếp Gradio API của Space <strong>microsoft/TRELLIS.2</strong>, upload ảnh nguồn, gọi endpoint image-to-3D và lưu các output GLB/MP4 vào thư viện asset trong trình duyệt.
              </p>
            </div>
            <div style={{ minWidth: 220, color: palette.text2, fontSize: 12, fontWeight: 800, lineHeight: 1.6 }}>
              External GitHub/Hugging Face project links are hidden from the admin menu UI.
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 18, marginTop: 18 }}>
          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>🎛️ Cấu hình asset & API</h2>
            <label style={labelStyle(palette)}>Tên asset</label>
            <input value={assetName} onChange={(e) => setAssetName(e.target.value)} style={inputStyle(palette)} />

            <label style={labelStyle(palette)}>Prompt / ghi chú metadata</label>
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ ...inputStyle(palette), resize: 'vertical', lineHeight: 1.5 }} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '10px 0 16px' }}>
              {PROMPT_PRESETS.map((item) => (
                <button key={item} type="button" onClick={() => setPrompt(item)} style={{ border: `1px solid ${palette.border}`, background: palette.card2, color: palette.text, borderRadius: 999, padding: '7px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                  {item}
                </button>
              ))}
            </div>

            <label style={labelStyle(palette)}>Ảnh nguồn</label>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ ...inputStyle(palette), padding: 10 }} />
            {sourcePreview && <img src={sourcePreview} alt="3D asset source preview" style={{ width: '100%', maxHeight: 240, objectFit: 'contain', borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.card2, marginTop: 10 }} />}

            <label style={labelStyle(palette)}>Hugging Face Space ID</label>
            <input value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={inputStyle(palette)} />

            <label style={labelStyle(palette)}>Endpoint Gradio API</label>
            <input value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} placeholder="/generate" style={inputStyle(palette)} />

            <label style={labelStyle(palette)}>API args JSON ({IMAGE_TOKEN} = ảnh đã upload)</label>
            <textarea value={apiArgs} onChange={(e) => setApiArgs(e.target.value)} rows={6} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />

            <label style={labelStyle(palette)}>Hugging Face token nếu Space yêu cầu đăng nhập</label>
            <input value={hfToken} onChange={(e) => setHfToken(e.target.value)} type="password" placeholder="hf_..." style={inputStyle(palette)} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={inspectApi} disabled={busy} style={actionButton(palette, busy, palette.gold, '#1f1300')}>🔎 Đọc API</button>
              <button type="button" onClick={generateAsset} disabled={busy} style={actionButton(palette, busy, palette.accent, '#001018')}>{busy ? 'Đang chạy...' : '🚀 Tạo Asset'}</button>
            </div>
            <p style={{ color: status.startsWith('Không') ? palette.red : palette.text2, fontSize: 12, lineHeight: 1.6 }}>{status}</p>
          </section>

          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>🧬 Pipeline TRELLIS.2</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {pipelineSteps.map((step, index) => (
                <div key={step.title} style={{ display: 'grid', gridTemplateColumns: '44px 1fr auto', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.card2 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(56,189,248,0.16)', fontSize: 22 }}>{step.icon}</div>
                  <div>
                    <div style={{ fontWeight: 900 }}>{step.title}</div>
                    <div style={{ color: palette.text2, fontSize: 12, marginTop: 3 }}>{step.body}</div>
                  </div>
                  <div style={{ color: palette.gold, fontFamily: 'monospace', fontWeight: 900 }}>{String(index + 1).padStart(2, '0')}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 16, borderRadius: 22, border: `1px dashed ${palette.border}`, background: isDark ? 'rgba(2,6,23,0.55)' : 'rgba(219,234,254,0.55)', minHeight: 220, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
              <div>
                <div style={{ fontSize: 70, filter: 'drop-shadow(0 18px 24px rgba(56,189,248,0.24))' }}>🧊</div>
                <div style={{ fontSize: 18, fontWeight: 900, marginTop: 8 }}>{assetName || 'My TRELLIS.2 Asset'}</div>
                <div style={{ color: palette.text2, fontSize: 13, marginTop: 8, maxWidth: 420 }}>{prompt}</div>
              </div>
            </div>

            {assetFiles.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>📚 Asset outputs</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {assetFiles.map((file, index) => (
                    <a key={`${file.url}-${index}`} href={file.url} target="_blank" rel="noreferrer" download style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, color: palette.text, textDecoration: 'none', border: `1px solid ${palette.border}`, background: palette.card2, borderRadius: 14, padding: '10px 12px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <strong style={{ color: palette.accent }}>Download ↗</strong>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section style={{ ...cardStyle(palette), marginTop: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>🖥️ Official Hugging Face Space nhúng</h2>
          <p style={{ marginTop: 0, color: palette.text2, fontSize: 13, lineHeight: 1.6 }}>
            Nếu browser/API token bị giới hạn CORS hoặc Space đổi endpoint, bạn vẫn có thể dùng app chính thức ngay trong panel này.
          </p>
          <iframe
            title="Microsoft TRELLIS.2 Hugging Face Space"
            src="https://microsoft-trellis-2.hf.space"
            style={{ width: '100%', height: 760, border: `1px solid ${palette.border}`, borderRadius: 18, background: palette.card2 }}
            allow="camera; microphone; clipboard-read; clipboard-write; fullscreen"
          />
          {apiSchema && (
            <details open style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 900 }}>Schema API từ Gradio Space</summary>
              <pre style={{ overflow: 'auto', maxHeight: 360, background: palette.card2, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 12, fontSize: 11 }}>{JSON.stringify(apiSchema, null, 2)}</pre>
            </details>
          )}
        </section>
      </div>
    </div>
  )
}

function cardStyle(palette) {
  return {
    border: `1px solid ${palette.border}`,
    background: palette.card,
    borderRadius: 24,
    padding: 18,
    boxShadow: '0 18px 54px rgba(15,23,42,0.10)',
  }
}

function labelStyle(palette) {
  return { display: 'block', color: palette.text2, fontSize: 12, fontWeight: 800, margin: '12px 0 6px' }
}

function inputStyle(palette) {
  return {
    width: '100%',
    boxSizing: 'border-box',
    border: `1px solid ${palette.border}`,
    borderRadius: 12,
    background: palette.card2,
    color: palette.text,
    padding: '11px 12px',
    outline: 'none',
    font: 'inherit',
  }
}

function linkButton(background, color) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textDecoration: 'none',
    borderRadius: 14,
    padding: '11px 14px',
    background,
    color,
    fontWeight: 900,
    fontSize: 13,
    boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
  }
}

function actionButton(palette, busy, background, color) {
  return {
    border: 'none',
    borderRadius: 14,
    padding: '12px 14px',
    cursor: busy ? 'wait' : 'pointer',
    fontWeight: 900,
    color,
    background: busy ? palette.text2 : background,
  }
}
