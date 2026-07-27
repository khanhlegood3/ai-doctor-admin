import React, { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

const TRIPOSPLAT_GITHUB_URL = 'https://github.com/VAST-AI-Research/TripoSplat'
const TRIPOSPLAT_MODEL_URL = 'https://huggingface.co/VAST-AI/TripoSplat'
const TRIPOSPLAT_MODEL_README_URL = 'https://huggingface.co/VAST-AI/TripoSplat/blob/main/README.md'
const TRIPOSPLAT_SPACE_URL = 'https://huggingface.co/spaces/VAST-AI/TripoSplat'
const TRIPOSPLAT_SPACE_EMBED_URL = 'https://vast-ai-triposplat.hf.space'
const TRIPOSPLAT_SPACE_ID = 'VAST-AI/TripoSplat'
const GRADIO_CLIENT_CDN = 'https://esm.sh/@gradio/client@1.18.0'
const IMAGE_TOKEN = '$IMAGE_FILE'

const DEFAULT_API_ARGS = JSON.stringify([
  IMAGE_TOKEN,
], null, 2)

const OUTPUT_EXTENSIONS = /\.(ply|splat|glb|gltf|obj|stl|zip|mp4|png|jpg|jpeg)(\?|$)/i

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
    if (OUTPUT_EXTENSIONS.test(value)) files.push({ name: value.split('/').pop()?.split('?')[0] || 'triposplat-output', url: value })
    return files
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectFiles(item, files))
    return files
  }
  if (typeof value === 'object') {
    const url = value.url || value.path || value.name
    if (typeof url === 'string' && OUTPUT_EXTENSIONS.test(url)) {
      files.push({ name: value.orig_name || url.split('/').pop()?.split('?')[0] || 'triposplat-output', url })
    }
    Object.values(value).forEach((item) => collectFiles(item, files))
  }
  return files
}

export default function TwoDTo3DAssetPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'
  const [sourceImage, setSourceImage] = useState(null)
  const [sourcePreview, setSourcePreview] = useState('')
  const [spaceId, setSpaceId] = useState(TRIPOSPLAT_SPACE_ID)
  const [apiEndpoint, setApiEndpoint] = useState('/predict')
  const [apiArgs, setApiArgs] = useState(DEFAULT_API_ARGS)
  const [hfToken, setHfToken] = useState('')
  const [status, setStatus] = useState('Sẵn sàng chạy realtime qua Hugging Face Space VAST-AI/TripoSplat.')
  const [apiSchema, setApiSchema] = useState(null)
  const [rawResponse, setRawResponse] = useState(null)
  const [assetFiles, setAssetFiles] = useState([])
  const [busy, setBusy] = useState(false)

  const palette = useMemo(() => ({
    bg: isDark ? '#030712' : '#f3f7fb',
    card: isDark ? 'rgba(10,18,34,0.94)' : '#ffffff',
    card2: isDark ? 'rgba(15,23,42,0.86)' : '#eef6ff',
    border: isDark ? 'rgba(125,211,252,0.20)' : 'rgba(14,116,144,0.14)',
    text: isDark ? '#e5eefb' : '#162033',
    text2: isDark ? '#9fb0c8' : '#5e6a7d',
    cyan: '#22d3ee',
    violet: '#a78bfa',
    green: '#34d399',
    amber: '#fbbf24',
    red: '#fb7185',
  }), [isDark])

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]
    setSourceImage(file || null)
    setSourcePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return file ? URL.createObjectURL(file) : ''
    })
    setRawResponse(null)
    setAssetFiles([])
    if (file) setStatus(`Đã chọn ảnh 2D: ${file.name}. Có thể bấm “Chạy realtime”.`)
  }

  const inspectApi = () => {
    setBusy(true)
    setStatus('Đang đọc schema realtime API từ Hugging Face Space...')
    loadGradioClient()
      .then((Client) => Client.connect(spaceId, hfToken ? { hf_token: hfToken } : undefined))
      .then((client) => client.view_api())
      .then((schema) => {
        setApiSchema(schema)
        setStatus('Đã tải schema API. Nếu endpoint mặc định khác, hãy copy endpoint/args từ schema vào form.')
      })
      .catch((error) => setStatus(`Không đọc được schema API: ${error?.message || error}`))
      .finally(() => setBusy(false))
  }

  const generateAsset = () => {
    if (!sourceImage) {
      setStatus('Vui lòng upload ảnh 2D trước khi chạy TripoSplat.')
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
    setStatus('Đang gửi ảnh tới Hugging Face Space TripoSplat để tạo 3D Gaussian asset...')
    loadGradioClient()
      .then((Client) => Client.connect(spaceId, hfToken ? { hf_token: hfToken } : undefined))
      .then((client) => client.predict(apiEndpoint, replaceImageToken(parsedArgs, sourceImage)))
      .then((result) => {
        setRawResponse(result)
        const files = collectFiles(result?.data || result)
        setAssetFiles(files)
        setStatus(files.length ? `Hoàn tất realtime. Tìm thấy ${files.length} output (.ply/.splat/preview).` : 'API đã trả kết quả nhưng chưa nhận diện được file output. Hãy xem Raw response hoặc dùng app nhúng bên dưới.')
      })
      .catch((error) => setStatus(`Không chạy được realtime API: ${error?.message || error}. Hãy bấm “Đọc API”, nhập HF token nếu Space yêu cầu, hoặc dùng app nhúng bên dưới.`))
      .finally(() => setBusy(false))
  }

  return (
    <div style={{ minHeight: '100%', background: palette.bg, color: palette.text, padding: '28px clamp(16px, 4vw, 42px)' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <section style={{ border: `1px solid ${palette.border}`, background: `radial-gradient(circle at 16% 8%, rgba(34,211,238,.22), transparent 34%), radial-gradient(circle at 84% 12%, rgba(167,139,250,.20), transparent 32%), ${palette.card}`, borderRadius: 30, padding: '28px clamp(18px, 4vw, 38px)', boxShadow: isDark ? '0 28px 90px rgba(0,0,0,.42)' : '0 24px 70px rgba(14,116,144,.12)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ maxWidth: 780 }}>
              <div style={{ color: palette.cyan, fontSize: 12, fontWeight: 950, letterSpacing: '.16em', textTransform: 'uppercase' }}>2D to 3D Asset · TripoSplat Official Inference</div>
              <h1 style={{ margin: '10px 0 8px', fontSize: 'clamp(30px, 4vw, 52px)', lineHeight: 1.02 }}>Biến một ảnh 2D thành 3D Gaussian asset</h1>
              <p style={{ margin: 0, color: palette.text2, fontSize: 15, lineHeight: 1.7 }}>
                Panel này kết nối <strong>official inference code</strong> của VAST-AI Research với model weights <strong>VAST-AI/TripoSplat</strong> và Hugging Face Space realtime để xuất asset dạng <strong>.ply</strong> / <strong>.splat</strong> có thể mở bằng Gaussian Splat viewer.
              </p>
            </div>
            <div style={{ minWidth: 230, color: palette.text2, fontSize: 12, fontWeight: 800, lineHeight: 1.6 }}>
              External GitHub/Hugging Face project links are hidden from the admin menu UI.
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 390px), 1fr))', gap: 18, marginTop: 18 }}>
          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>🚀 Realtime Hugging Face API</h2>
            <label style={labelStyle(palette)}>Ảnh 2D đầu vào</label>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ ...inputStyle(palette), padding: 10 }} />
            {sourcePreview && <img src={sourcePreview} alt="2D source preview" style={{ width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 18, border: `1px solid ${palette.border}`, background: palette.card2, marginTop: 12 }} />}

            <label style={labelStyle(palette)}>Hugging Face Space ID</label>
            <input value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={inputStyle(palette)} />

            <label style={labelStyle(palette)}>Endpoint Gradio API</label>
            <input value={apiEndpoint} onChange={(e) => setApiEndpoint(e.target.value)} placeholder="/predict hoặc endpoint trong schema" style={inputStyle(palette)} />

            <label style={labelStyle(palette)}>API args JSON ({IMAGE_TOKEN} = file ảnh upload)</label>
            <textarea value={apiArgs} onChange={(e) => setApiArgs(e.target.value)} rows={5} style={{ ...inputStyle(palette), fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />

            <label style={labelStyle(palette)}>Hugging Face token nếu Space yêu cầu</label>
            <input value={hfToken} onChange={(e) => setHfToken(e.target.value)} type="password" placeholder="hf_..." style={inputStyle(palette)} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
              <button type="button" onClick={inspectApi} disabled={busy} style={actionButton(palette, busy, palette.amber, '#1f1300')}>🔎 Đọc API</button>
              <button type="button" onClick={generateAsset} disabled={busy} style={actionButton(palette, busy, palette.cyan, '#001018')}>{busy ? 'Đang chạy...' : '⚡ Chạy realtime'}</button>
            </div>
            <p style={{ color: status.startsWith('Không') ? palette.red : palette.text2, fontSize: 12, lineHeight: 1.6 }}>{status}</p>
          </section>

          <section style={cardStyle(palette)}>
            <h2 style={{ margin: '0 0 12px', fontSize: 20 }}>📦 Output asset</h2>
            <div style={{ display: 'grid', gap: 12 }}>
              {[
                ['🖼️', 'Input', sourceImage?.name || 'Chưa chọn ảnh'],
                ['🧠', 'TripoSplat', 'Single-image → variable-count 3D Gaussians'],
                ['🧊', 'Export', assetFiles.length ? `${assetFiles.length} file output` : '.ply / .splat / preview'],
                ['👁️', 'Viewer', 'Mở bằng SparkJS, SuperSplat hoặc Gaussian Splat viewer'],
              ].map(([icon, title, body]) => (
                <div key={title} style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, alignItems: 'center', padding: 12, borderRadius: 16, border: `1px solid ${palette.border}`, background: palette.card2 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, display: 'grid', placeItems: 'center', background: 'rgba(34,211,238,.14)', fontSize: 22 }}>{icon}</div>
                  <div><strong>{title}</strong><div style={{ color: palette.text2, fontSize: 12, marginTop: 3 }}>{body}</div></div>
                </div>
              ))}
            </div>

            {assetFiles.length > 0 && (
              <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
                {assetFiles.map((file, index) => (
                  <a key={`${file.url}-${index}`} href={file.url} target="_blank" rel="noreferrer" download style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: palette.text, textDecoration: 'none', border: `1px solid ${palette.border}`, background: palette.card2, borderRadius: 14, padding: '10px 12px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                    <strong style={{ color: palette.cyan }}>Download ↗</strong>
                  </a>
                ))}
              </div>
            )}

            <div style={{ marginTop: 16, padding: 14, borderRadius: 18, background: palette.card2, border: `1px dashed ${palette.border}`, color: palette.text2, fontSize: 13, lineHeight: 1.65 }}>
              Official repo mô tả TripoSplat là pipeline tạo 3D Gaussians chất lượng cao từ một ảnh, code inference tối giản và export .ply/.splat. Model README yêu cầu đặt weights trong thư mục <code>ckpts/</code> khi chạy official inference code cục bộ.
            </div>
          </section>
        </div>

        <section style={{ ...cardStyle(palette), marginTop: 18 }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 20 }}>🖥️ Hugging Face Space realtime nhúng</h2>
          <p style={{ marginTop: 0, color: palette.text2, fontSize: 13, lineHeight: 1.6 }}>
            Nếu Space đổi endpoint hoặc browser bị giới hạn CORS/token, hãy dùng UI chính thức nhúng bên dưới để chạy realtime trực tiếp.
          </p>
          <iframe title="VAST-AI TripoSplat Hugging Face Space" src={TRIPOSPLAT_SPACE_EMBED_URL} style={{ width: '100%', height: 760, border: `1px solid ${palette.border}`, borderRadius: 18, background: palette.card2 }} allow="camera; microphone; clipboard-read; clipboard-write; fullscreen" />
          {(apiSchema || rawResponse) && (
            <details open style={{ marginTop: 14 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 900 }}>API schema / Raw response</summary>
              <pre style={{ overflow: 'auto', maxHeight: 380, background: palette.card2, color: palette.text, border: `1px solid ${palette.border}`, borderRadius: 14, padding: 12, fontSize: 11 }}>{JSON.stringify({ apiSchema, rawResponse }, null, 2)}</pre>
            </details>
          )}
        </section>

        {(prevLabel || nextLabel) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 18 }}>
            {prevLabel ? <button type="button" onClick={onPrev} style={navButton(palette)}>← {prevLabel}</button> : <span />}
            {nextLabel ? <button type="button" onClick={onNext} style={navButton(palette)}>{nextLabel} →</button> : <span />}
          </div>
        )}
      </div>
    </div>
  )
}

function cardStyle(palette) {
  return { border: `1px solid ${palette.border}`, background: palette.card, borderRadius: 24, padding: 18, boxShadow: '0 18px 54px rgba(15,23,42,.10)' }
}
function labelStyle(palette) { return { display: 'block', color: palette.text2, fontSize: 12, fontWeight: 850, margin: '12px 0 6px' } }
function inputStyle(palette) { return { width: '100%', boxSizing: 'border-box', border: `1px solid ${palette.border}`, borderRadius: 12, background: palette.card2, color: palette.text, padding: '11px 12px', outline: 'none', font: 'inherit' } }
function linkButton(background, color) { return { display: 'inline-flex', justifyContent: 'center', textDecoration: 'none', borderRadius: 14, padding: '11px 14px', background, color, fontWeight: 950, fontSize: 13, boxShadow: '0 12px 32px rgba(0,0,0,.18)' } }
function actionButton(palette, busy, background, color) { return { border: 'none', borderRadius: 14, padding: '12px 14px', cursor: busy ? 'wait' : 'pointer', fontWeight: 950, color, background: busy ? palette.text2 : background } }
function navButton(palette) { return { border: `1px solid ${palette.border}`, background: palette.card2, color: palette.text, borderRadius: 14, padding: '11px 14px', cursor: 'pointer', fontWeight: 850 } }
