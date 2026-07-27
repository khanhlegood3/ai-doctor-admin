import React, { useMemo, useRef, useState } from 'react'
import NavButtons from './NavButtons.jsx'

const DEFAULT_XRAY = 'https://www.mediplus.vn/wp-content/uploads/2021/08/e9800b6989507e0e2741.jpg'

const organs = [
  { name: 'Lungs', status: 'X-ray depth fusion', risk: 18, color: 'var(--cyan)', hex: '#00e5ff', top: '18%', left: '50%' },
  { name: 'Heart', status: 'Cardio mesh stable', risk: 12, color: 'var(--red)', hex: '#ff4d6d', top: '38%', left: '50%' },
  { name: 'Liver', status: 'Texture confidence 91%', risk: 24, color: 'var(--amber)', hex: '#f5a623', top: '55%', left: '42%' },
  { name: 'Kidney', status: 'Bilateral symmetry scan', risk: 15, color: 'var(--violet)', hex: '#9c6fff', top: '62%', left: '58%' },
]

const pipeline = [
  'Input X-ray / CT / MRI image',
  'Panoramic latent path planning',
  'Organ-aware 3D Gaussian field',
  'Digital Twin health simulation',
]

// "3D Organ Reconstruction" trong panel này là hình minh hoạ dựng bằng
// CSS/HTML (silhouette + node vị trí % + vòng quét xoay) — không phải file
// model 3D thật xuất ra được (khác với avatar hồ sơ ở UserProfilePanel).
// Vì vậy nút Download ở đây rasterize lại đúng bố cục silhouette + vị trí
// từng organ-node (dùng lại toạ độ top/left % và màu hex ở mảng `organs`
// bên trên) thành ảnh PNG thật qua SVG -> <canvas>, không cần thư viện chụp
// DOM nào khác.
function buildOrganReconstructionSVG({ organList, twinScore, size = 900 }) {
  const stageH = size
  const stageW = size
  const silW = stageW * 0.22
  const silH = stageH * 0.62
  const silX = (stageW - silW) / 2
  const silY = stageH * 0.16
  const headR = silW * 0.34
  const headCx = stageW / 2
  const headCy = silY - headR * 0.55

  const nodes = organList.map((organ) => {
    const topPct = parseFloat(organ.top) / 100
    const leftPct = parseFloat(organ.left) / 100
    return {
      ...organ,
      cx: stageW * leftPct,
      cy: silY + silH * ((topPct * 360 - 8) / (360 * 0.82)), // xấp xỉ lại tỉ lệ top(%) gốc (tính trên khung cao 360px, trừ margin 8%/10%) sang toạ độ silhouette thật
    }
  })

  const nodeMarkup = nodes.map((n) => `
    <ellipse cx="${n.cx.toFixed(1)}" cy="${n.cy.toFixed(1)}" rx="26" ry="20" fill="${n.hex}33" stroke="${n.hex}" stroke-width="2"/>
    <text x="${(n.cx + 34).toFixed(1)}" y="${(n.cy + 4).toFixed(1)}" font-family="monospace" font-size="15" font-weight="900" fill="${n.hex}">${n.name} · ${n.risk}%</text>
  `).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${stageW} ${stageH}">
    <defs>
      <linearGradient id="silGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="rgba(0,229,255,0.20)"/>
        <stop offset="100%" stop-color="rgba(156,111,255,0.16)"/>
      </linearGradient>
      <pattern id="grid" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M 26 0 L 0 0 0 26" fill="none" stroke="rgba(0,229,255,0.08)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="${stageW}" height="${stageH}" rx="28" fill="#05070d"/>
    <rect width="${stageW}" height="${stageH}" rx="28" fill="url(#grid)"/>
    <ellipse cx="${stageW / 2}" cy="${stageH / 2}" rx="${stageW * 0.42}" ry="${stageH * 0.42}" fill="none" stroke="rgba(0,229,255,0.36)" stroke-dasharray="6 8"/>
    <ellipse cx="${stageW / 2}" cy="${stageH / 2}" rx="${stageW * 0.36}" ry="${stageH * 0.22}" fill="none" stroke="rgba(0,229,255,0.28)" stroke-dasharray="6 8"/>
    <circle cx="${headCx}" cy="${headCy}" r="${headR}" fill="rgba(0,229,255,0.08)" stroke="rgba(0,229,255,0.34)"/>
    <rect x="${silX}" y="${silY}" width="${silW}" height="${silH}" rx="${silW * 0.36}" fill="url(#silGrad)" stroke="rgba(0,229,255,0.38)"/>
    <line x1="${stageW / 2}" y1="${silY + silH * 0.08}" x2="${stageW / 2}" y2="${silY + silH * 0.9}" stroke="#00e5ff" stroke-opacity="0.6" stroke-width="2"/>
    ${nodeMarkup}
    <text x="28" y="${stageH - 56}" font-family="monospace" font-size="20" font-weight="900" fill="#00e5ff">3D ORGAN RECONSTRUCTION</text>
    <text x="28" y="${stageH - 30}" font-family="monospace" font-size="13" fill="rgba(232,240,248,0.6)">Body Twin Fidelity: ${twinScore} · Organ Meshes: 12</text>
    <text x="${stageW - 28}" y="${stageH - 30}" font-family="monospace" font-size="13" fill="#00e5ff" text-anchor="end">360° explorable path</text>
  </svg>`
}

async function downloadOrganReconstructionPNG({ organList, twinScore }) {
  const svg = buildOrganReconstructionSVG({ organList, twinScore, size: 900 })
  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = svgUrl
    })
    const canvas = document.createElement('canvas')
    canvas.width = 900
    canvas.height = 900
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, 900, 900)
    const pngUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = pngUrl
    a.download = `matrix3d-organ-reconstruction-${Date.now()}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
    return true
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

function OrganReconstructionDownloadButton({ twinScore }) {
  const [state, setState] = useState('idle') // 'idle' | 'downloading' | 'done' | 'error'

  const handleDownload = async () => {
    setState('downloading')
    try {
      await downloadOrganReconstructionPNG({ organList: organs, twinScore })
      setState('done')
    } catch (err) {
      console.warn('Download 3D Organ Reconstruction failed', err)
      setState('error')
    }
    setTimeout(() => setState('idle'), 2200)
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={state === 'downloading'}
      style={{
        marginTop: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 800,
        border: '1px solid rgba(0,229,255,0.4)', background: 'rgba(0,229,255,0.12)', color: '#00e5ff',
        cursor: state === 'downloading' ? 'wait' : 'pointer', opacity: state === 'downloading' ? 0.7 : 1, width: '100%',
      }}
    >
      {state === 'downloading' && '⏳ Đang tải...'}
      {state === 'done' && '✅ Đã tải xong (.png)'}
      {state === 'error' && '⚠️ Lỗi, thử lại'}
      {state === 'idle' && '⬇️ Download (.png)'}
    </button>
  )
}

function MatrixCard({ title, children, accent = 'var(--cyan)' }) {
  return (
    <section className="matrix3d-card" style={{ '--matrix-accent': accent }}>
      <div className="matrix3d-card-title">{title}</div>
      {children}
    </section>
  )
}

export default function Matrix3DBodyPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const inputRef = useRef(null)
  const [scan, setScan] = useState(DEFAULT_XRAY)
  const [fileName, setFileName] = useState('Demo chest X-ray · Mediplus reference')
  const [isDragging, setIsDragging] = useState(false)
  const [hasUploaded, setHasUploaded] = useState(false)

  const twinScore = useMemo(() => {
    const base = fileName.startsWith('Demo') ? 87 : 94
    return `${base}%`
  }, [fileName])

  const handleFile = (file) => {
    if (!file || !file.type?.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      setScan(reader.result)
      setFileName(file.name)
      setHasUploaded(true)
    }
    reader.readAsDataURL(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    handleFile(event.dataTransfer.files?.[0])
  }

  return (
    <div className="matrix3d-page animate-fade">
      <div className="matrix3d-hero">
        <div className="matrix3d-hero-copy">
          <div className="matrix3d-kicker">Matrix-3D Digital Twin Health Body</div>
          <h2>Matrix-3D Body</h2>
          <p>
            Trang mô phỏng nội tạng người từ hình X-quang đầu vào, lấy cảm hứng từ Matrix-3D:
            một ảnh y tế được chuyển thành không gian 3D có thể khám phá, theo dõi cơ quan và
            chuẩn bị dữ liệu cho Digital Twin y tế.
          </p>
          <div className="matrix3d-hero-actions">
            <button type="button" onClick={() => inputRef.current?.click()}>Upload X-ray image</button>
          </div>
        </div>

        <div
          className={`matrix3d-upload ${isDragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => event.key === 'Enter' && inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.dcm"
            onChange={(event) => handleFile(event.target.files?.[0])}
            style={{ display: 'none' }}
          />
          <img src={scan} alt="Uploaded X-ray input for Matrix-3D Body" />
          <div className="matrix3d-upload-overlay">
            <span>INPUT FIRST SCREEN</span>
            <strong>{fileName}</strong>
            <small>Kéo thả hoặc bấm để upload ảnh X-quang / CT / MRI</small>
          </div>
        </div>
      </div>

      {hasUploaded && (
        <div className="matrix3d-3dviewer">
          <iframe
            src="https://caskanatomy.info/open3dviewer/?model=overview-skeleton&export=on"
            title="Cask Anatomy 3D Viewer"
            allow="fullscreen"
            allowFullScreen
          />
        </div>
      )}

      <div className="matrix3d-grid">
        <MatrixCard title="3D Organ Reconstruction" accent="var(--cyan)">
          <div className="matrix3d-body-stage">
            <div className="matrix3d-body-silhouette">
              <div className="matrix3d-spine" />
              {organs.map((organ) => (
                <div
                  key={organ.name}
                  className="matrix3d-organ-node"
                  style={{ top: organ.top, left: organ.left, '--organ-color': organ.color }}
                >
                  <span />
                </div>
              ))}
            </div>
            <div className="matrix3d-scan-ring ring-one" />
            <div className="matrix3d-scan-ring ring-two" />
            <div className="matrix3d-trajectory">360° explorable path</div>
          </div>
          <OrganReconstructionDownloadButton twinScore={twinScore} />
        </MatrixCard>

        <MatrixCard title="Health Body Signals" accent="var(--green)">
          <div className="matrix3d-score-row">
            <div>
              <span>Body Twin Fidelity</span>
              <strong>{twinScore}</strong>
            </div>
            <div>
              <span>Organ Meshes</span>
              <strong>12</strong>
            </div>
          </div>
          <div className="matrix3d-organ-list">
            {organs.map((organ) => (
              <div key={organ.name} className="matrix3d-organ-row">
                <div>
                  <strong>{organ.name}</strong>
                  <span>{organ.status}</span>
                </div>
                <div className="matrix3d-risk-bar">
                  <i style={{ width: `${organ.risk + 52}%`, background: organ.color }} />
                </div>
                <em>{organ.risk}%</em>
              </div>
            ))}
          </div>
        </MatrixCard>

        <MatrixCard title="Matrix-3D Medical Pipeline" accent="var(--violet)">
          <div className="matrix3d-pipeline">
            {pipeline.map((step, index) => (
              <div key={step} className="matrix3d-pipeline-step">
                <b>{String(index + 1).padStart(2, '0')}</b>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </MatrixCard>
      </div>

      <NavButtons onNext={onNext} nextLabel={nextLabel || 'Omnidirectional 3D Body'} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
