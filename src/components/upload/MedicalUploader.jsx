import { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import {
  getAllRecords,
  saveRecord,
  deleteRecord,
  updateAnalysis,
  detectFileType,
  formatBytes,
  fileToBase64,
  fileToDataUrl,
  fileTypeLabel,
  fileTypeIcon,
} from '../../lib/medicalStorage.js'
import { notifyUpload } from '../../hooks/useMedicalData.js'
import { buildImageConvertedInBodyRecord, parseInBodyCsv, recordsToInBodyCsv, summarizeInBodyRecords } from '../../lib/inbodyCsv.js'
import { convertInBodyImageToCsv, fileToBase64Promise } from '../../lib/inbodyImageConvert.js'
import { useTTS } from '../../lib/groqAiClient.js'
import { isHeicFile, ensureBrowserSafeImage } from '../../lib/heicConvert.js'
import { loadPdfJs } from '../../lib/pdfjsLoader.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_COLORS = {
  xray: '#00e5ff', ct: '#9c6fff', mri: '#f48fb1', pdf: '#ffb74d', photo: '#00e676', video: '#83f7ff', csv: '#b3ff5f',
}
const ACCEPT  = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf,text/csv,.csv,.heic,.heif,video/mp4,video/webm,video/quicktime,video/*'
const MAX_MB  = 20


const UPLOADER_TEXT = {
  vi: {
    delete: 'Xóa', deleteWithIcon: '🗑 Xóa', confirmDelete: 'Xóa hồ sơ này?',
    fileTooLarge: 'File "{name}" quá lớn (tối đa {max}MB)', unsupportedType: 'Định dạng không hỗ trợ: {type}', readError: 'Lỗi khi đọc file. Vui lòng thử lại.', unknownError: 'Không xác định', errorPrefix: 'Lỗi',
    title: 'Hồ Sơ Y Tế', subtitle: 'Upload X-Ray · CT · MRI · PDF · CSV InBody · Ảnh hồ sơ · Lưu local vĩnh viễn', upload: 'Tải lên', camera: 'Camera', cameraStarting: 'Đang mở camera…', capturePhoto: 'Chụp ảnh', closeCamera: 'Đóng camera', cameraHelp: 'Camera thật đang mở. Canh khung hồ sơ rồi nhấn Chụp ảnh.', switchCamera: 'Đổi camera', overlay: 'Lớp phủ', aiDocumentScan: 'AI Document Scan', library: 'Thư viện',
    apiKeyPrompt: 'Nhập Anthropic API key để phân tích AI (lưu local, không gửi server):', save: 'Lưu', processing: 'Đang xử lý file…', dragDrop: 'Kéo thả file vào đây', clickSelect: 'hoặc nhấn để chọn file', pdfRecord: 'PDF hồ sơ', photoRecord: 'Ảnh chụp', maxHint: 'Tối đa 20MB · JPG, PNG, WebP, HEIC, PDF, CSV InBody', recentRecords: 'Hồ sơ gần đây', viewAll: 'Xem tất cả {count} hồ sơ →', noRecords: 'Chưa có hồ sơ nào. Upload file đầu tiên!', backToLibrary: 'Quay lại thư viện', useForCompare: 'So sánh bên Compare →', type: 'Loại', size: 'Kích thước', uploaded: 'Upload', notes: 'GHI CHÚ', notesPlaceholder: 'Thêm ghi chú về hồ sơ này…', saveNotes: 'Lưu ghi chú', aiAnalysis: 'PHÂN TÍCH AI', aiAnalyzeHelp: 'Để AI phân tích hồ sơ này', analyzeWithClaude: 'Phân tích với Claude AI', requiresKey: 'Cần Anthropic API key', enterKey: 'Nhập key', claudeAnalyzing: 'Claude đang phân tích…', aiConfidence: 'Độ tin cậy AI', aiDisclaimer: 'Phân tích AI chỉ mang tính hỗ trợ, không thay thế chẩn đoán của bác sĩ.', reAnalyze: 'Phân tích lại',
  },
  en: {
    delete: 'Delete', deleteWithIcon: '🗑 Delete', confirmDelete: 'Delete this record?',
    fileTooLarge: 'File "{name}" is too large (max {max}MB)', unsupportedType: 'Unsupported file type: {type}', readError: 'Could not read the file. Please try again.', unknownError: 'Unknown', errorPrefix: 'Error',
    title: 'Medical Records', subtitle: 'Upload X-Ray · CT · MRI · PDF · InBody CSV · Images · Stored locally', upload: 'Upload', camera: 'Camera', cameraStarting: 'Opening camera…', capturePhoto: 'Capture photo', closeCamera: 'Close camera', cameraHelp: 'Live camera is open. Frame the record, then capture.', switchCamera: 'Switch camera', overlay: 'Overlay', aiDocumentScan: 'AI Document Scan', library: 'Library',
    apiKeyPrompt: 'Enter Anthropic API key for AI analysis (stored locally):', save: 'Save', processing: 'Processing file…', dragDrop: 'Drag & drop files here', clickSelect: 'or click to select', pdfRecord: 'PDF record', photoRecord: 'Photo', maxHint: 'Max 20MB · JPG, PNG, WebP, HEIC, PDF, InBody CSV', recentRecords: 'Recent records', viewAll: 'View all {count} records →', noRecords: 'No records yet. Upload your first file!', backToLibrary: 'Back to library', useForCompare: 'Use for Compare →', type: 'Type', size: 'Size', uploaded: 'Uploaded', notes: 'NOTES', notesPlaceholder: 'Add notes about this record…', saveNotes: 'Save notes', aiAnalysis: 'AI ANALYSIS', aiAnalyzeHelp: 'Let AI analyze this medical file', analyzeWithClaude: 'Analyze with Claude AI', requiresKey: 'Requires Anthropic API key', enterKey: 'Enter key', claudeAnalyzing: 'Claude analyzing…', aiConfidence: 'AI Confidence', aiDisclaimer: "AI analysis is for support only and does not replace a doctor\'s diagnosis.", reAnalyze: 'Re-analyze',
  },
}

function uploadText(lang, key, vars = {}) {
  const template = UPLOADER_TEXT[lang]?.[key] || UPLOADER_TEXT.vi[key] || key
  return Object.entries(vars).reduce((text, [name, value]) => text.replace(`{${name}}`, value), template)
}

function scanTimestamp(lang, date = new Date()) {
  return date.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function drawScanOverlay(ctx, width, height, { label, timestamp }) {
  const pad = Math.max(18, Math.round(width * 0.035))
  const line = Math.max(3, Math.round(width * 0.006))
  const corner = Math.min(width, height) * 0.16
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.96)'
  ctx.lineWidth = line + 2
  ctx.shadowColor = 'rgba(0,229,255,0.95)'
  ctx.shadowBlur = 16
  ;[
    [pad, pad, pad + corner, pad, pad, pad + corner],
    [width - pad, pad, width - pad - corner, pad, width - pad, pad + corner],
    [pad, height - pad, pad + corner, height - pad, pad, height - pad - corner],
    [width - pad, height - pad, width - pad - corner, height - pad, width - pad, height - pad - corner],
  ].forEach(([ax, ay, bx, by, cx, cy]) => {
    ctx.beginPath()
    ctx.moveTo(ax, ay)
    ctx.lineTo(bx, by)
    ctx.moveTo(ax, ay)
    ctx.lineTo(cx, cy)
    ctx.stroke()
  })

  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(0,12,24,0.70)'
  const boxW = Math.min(width - pad * 2, Math.max(360, width * 0.48))
  const boxH = Math.max(74, height * 0.095)
  const boxX = width - pad - boxW
  const boxY = height - pad - boxH
  ctx.fillRect(boxX, boxY, boxW, boxH)
  ctx.strokeStyle = 'rgba(0,229,255,0.82)'
  ctx.lineWidth = Math.max(2, line - 1)
  ctx.strokeRect(boxX, boxY, boxW, boxH)
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${Math.max(18, width * 0.026)}px sans-serif`
  ctx.fillText(label, boxX + 16, boxY + 30)
  ctx.fillStyle = '#83f7ff'
  ctx.font = `700 ${Math.max(15, width * 0.021)}px monospace`
  ctx.fillText(timestamp, boxX + 16, boxY + 58)
  ctx.restore()
}

function ScanOverlayBadge({ label, timestamp }) {
  return (
    <div style={{ position: 'absolute', inset: 12, pointerEvents: 'none', zIndex: 3 }}>
      <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(255,255,255,0.92)', borderRadius: 12, boxShadow: '0 0 0 1px rgba(0,229,255,0.75), 0 0 26px rgba(0,229,255,0.34) inset' }} />
      {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => (
        <div key={`${v}-${h}`} style={{ position: 'absolute', [v]: 0, [h]: 0, width: 48, height: 48, borderColor: '#83f7ff', borderStyle: 'solid', borderWidth: `${v === 'top' ? 4 : 0}px ${h === 'right' ? 4 : 0}px ${v === 'bottom' ? 4 : 0}px ${h === 'left' ? 4 : 0}px`, borderRadius: `${v === 'top' && h === 'left' ? 12 : 0}px ${v === 'top' && h === 'right' ? 12 : 0}px ${v === 'bottom' && h === 'right' ? 12 : 0}px ${v === 'bottom' && h === 'left' ? 12 : 0}px` }} />
      ))}
      <div style={{ position: 'absolute', right: 14, bottom: 14, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(131,247,255,0.72)', background: 'rgba(0,12,24,0.72)', boxShadow: '0 0 18px rgba(0,229,255,0.22)' }}>
        <div style={{ color: '#fff', fontSize: 12, fontWeight: 900, letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ color: '#83f7ff', fontSize: 11, marginTop: 4, fontFamily: 'var(--font-mono, monospace)', fontWeight: 800 }}>{timestamp}</div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
      background: active ? 'rgba(0,229,255,0.1)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
      color: active ? '#00e5ff' : 'rgba(255,255,255,0.5)',
      fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6,
    }}>{children}</button>
  )
}

function RecordThumb({ record, onClick, onDelete, lang }) {
  const color = TYPE_COLORS[record.fileType] || '#aaa'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      <div onClick={onClick} style={{ cursor: 'pointer', flex: 1 }}>
        {record.mimeType?.startsWith('video/') ? (
          <div style={{ height: 90, background: 'rgba(131,247,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 28 }}>🎥</div>
        ) : record.mimeType === 'application/pdf' ? (
          <div style={{ height: 90, background: 'rgba(255,171,64,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📄</div>
        ) : record.fileType === 'csv' ? (
          <div style={{ height: 90, background: 'linear-gradient(135deg,rgba(179,255,95,0.12),rgba(0,229,255,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 28 }}>📈</div>
        ) : (
          <img src={record.dataUrl} alt={record.filename}
            style={{ width: '100%', height: 90, objectFit: 'cover' }} />
        )}
        <div style={{ padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color, fontFamily: 'monospace' }}>{fileTypeLabel(record.fileType)}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.filename}
          </div>
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); onDelete() }} style={{
        margin: '0 8px 8px', padding: '5px 0', borderRadius: 6, cursor: 'pointer',
        background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)',
        color: 'rgba(255,82,82,0.8)', fontSize: 11, width: 'calc(100% - 16px)',
      }}>{uploadText(lang, 'deleteWithIcon')}</button>
    </div>
  )
}

function RecordCard({ record, onClick, onDelete, lang }) {
  const color = TYPE_COLORS[record.fileType] || '#aaa'
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
    }}>
      <div onClick={onClick}>
        {record.mimeType === 'application/pdf' ? (
          <div style={{ height: 130, background: 'rgba(255,171,64,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40 }}>📄</div>
        ) : record.fileType === 'csv' ? (
          <div style={{ height: 130, background: 'linear-gradient(135deg,rgba(179,255,95,0.12),rgba(0,229,255,0.06))', display: 'flex', alignItems: 'center', justifyContent: 'center', color, fontSize: 40 }}>📈</div>
        ) : (
          <img src={record.dataUrl} alt={record.filename}
            style={{ width: '100%', height: 130, objectFit: 'cover' }} />
        )}
        <div style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace',
              background: `${color}18`, color, border: `1px solid ${color}40`,
            }}>{fileTypeLabel(record.fileType)}</span>
            {record.aiAnalysis && <span style={{ fontSize: 9, color: '#00e676' }}>✓ AI</span>}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {record.filename}
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>
            {new Date(record.uploadedAt).toLocaleDateString('vi-VN')} · {formatBytes(record.size)}
          </div>
        </div>
      </div>
      <div style={{ padding: '0 12px 12px' }}>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{
          background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.2)',
          borderRadius: 6, padding: '5px 12px', color: 'rgba(255,82,82,0.7)',
          fontSize: 11, cursor: 'pointer', width: '100%',
        }}>{uploadText(lang, 'delete')}</button>
      </div>
    </div>
  )
}

function MetaRow({ k, v, vColor }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{k}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: vColor || 'rgba(255,255,255,0.7)', maxWidth: '55%', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  )
}


// ─── Markdown renderer (minimal, mirrors FullDocumentSummarizationPanel) ────
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(16,185,129,0.12);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="margin:18px 0 8px;font-size:15px;font-weight:800;color:inherit">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:22px 0 10px;font-size:17px;font-weight:900;color:inherit">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:24px 0 12px;font-size:20px;font-weight:900;color:inherit">$1</h1>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin:4px 0 4px 18px;list-style:disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0 4px 18px;list-style:decimal">$2</li>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 12px">')
    .replace(/\n/g, '<br/>')
}

function readFileText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result || ''))
    r.onerror = rej
    r.readAsText(file, 'utf-8')
  })
}

function isCsvFile(file) {
  return file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' || file.name?.toLowerCase().endsWith('.csv')
}

function isSupportedUploadFile(file) {
  return file.type.startsWith('image/') || file.type === 'application/pdf' || isCsvFile(file) || isHeicFile(file) || file.type.startsWith('video/')
}

// ─── Video → frame ảnh (dùng cho OCR / AI phân tích / Convert CSV) ────────────
// Groq Vision và Claude Vision đều KHÔNG nhận video trực tiếp — phải trích 1
// khung hình (frame) làm ảnh JPEG đại diện rồi mới đưa vào các API phân tích.
function extractVideoFrameBase64(dataUrl, seekRatio = 0.3) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    video.src = dataUrl

    const cleanup = () => {
      video.onloadedmetadata = null
      video.onseeked = null
      video.onerror = null
    }

    video.onloadedmetadata = () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1
      const target = Math.min(Math.max(duration * seekRatio, 0.05), Math.max(duration - 0.05, 0.05))
      try { video.currentTime = target } catch { video.currentTime = 0 }
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth || 1280
        canvas.height = video.videoHeight || 720
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const frameDataUrl = canvas.toDataURL('image/jpeg', 0.9)
        cleanup()
        resolve({ base64: frameDataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl: frameDataUrl })
      } catch (err) {
        cleanup()
        reject(err)
      }
    }
    video.onerror = () => { cleanup(); reject(new Error('Không đọc được video để trích khung hình')) }
  })
}

// Trả về { base64, mimeType } để đưa vào các API Vision (Groq/Claude).
// Nếu record là video → tự trích 1 frame làm ảnh đại diện; ngược lại dùng
// nguyên base64Data/mimeType đã lưu sẵn của record (ảnh/PDF như cũ).
async function getAnalysisImageSource(record) {
  if (record?.mimeType?.startsWith('video/')) {
    const frame = await extractVideoFrameBase64(record.dataUrl)
    return { base64: frame.base64, mimeType: frame.mimeType }
  }
  const base64 = record?.base64Data || (record?.dataUrl ? record.dataUrl.split(',')[1] : null)
  return { base64, mimeType: record?.mimeType || 'image/jpeg' }
}

function recordText(record) {
  if (record.textContent) return record.textContent
  if (!record.base64Data) return ''
  try {
    return decodeURIComponent(escape(atob(record.base64Data)))
  } catch {
    try { return atob(record.base64Data) } catch { return '' }
  }
}

function formatMetric(value, unit = '', digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${Number(value).toFixed(digits).replace(/\.0$/, '')}${unit ? ` ${unit}` : ''}`
}

function InBodyMetricTile({ label, value, unit, delta, color = '#b3ff5f' }) {
  const hasDelta = delta !== null && delta !== undefined && Number.isFinite(delta)
  return (
    <div style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 14 }}>
      <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#fff', fontSize: 24, fontWeight: 900 }}>{formatMetric(value, unit)}</div>
      {hasDelta && (
        <div style={{ color: delta >= 0 ? '#00e676' : '#ff7676', fontSize: 11, marginTop: 6, fontFamily: 'monospace' }}>
          {delta >= 0 ? '+' : ''}{formatMetric(delta, unit)} {label === 'Tỷ lệ mỡ' ? 'so với lần đầu' : 'trend'}
        </div>
      )}
      <div style={{ height: 3, background: `${color}66`, borderRadius: 99, marginTop: 10 }} />
    </div>
  )
}

function InBodyLineChart({ records, metric, label, unit, color }) {
  const values = records.map(record => record[metric]).filter(value => value !== null && value !== undefined)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const width = 360
  const height = 150
  const pad = 28
  const points = records.map((record, index) => {
    const value = record[metric]
    const x = records.length === 1 ? width / 2 : pad + (index * (width - pad * 2)) / (records.length - 1)
    const y = value == null ? height - pad : pad + ((max - value) * (height - pad * 2)) / range
    return { x, y, value, record }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')

  return (
    <div style={{ background: 'rgba(7,16,28,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 13 }}>{label}</div>
        <div style={{ color, fontFamily: 'monospace', fontSize: 12 }}>{formatMetric(points.at(-1)?.value, unit)}</div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 150, overflow: 'visible' }} role="img" aria-label={label}>
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="rgba(255,255,255,0.14)" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="rgba(255,255,255,0.10)" />
        {[0.25, 0.5, 0.75].map(tick => <line key={tick} x1={pad} x2={width - pad} y1={pad + tick * (height - pad * 2)} y2={pad + tick * (height - pad * 2)} stroke="rgba(255,255,255,0.05)" />)}
        <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((point, index) => (
          <g key={`${metric}-${point.record.rawDate}`}>
            <circle cx={point.x} cy={point.y} r="5" fill="#07101c" stroke={color} strokeWidth="3" />
            <text x={point.x} y={height - 8} fill="rgba(255,255,255,0.45)" fontSize="10" textAnchor="middle">#{index + 1}</text>
          </g>
        ))}
        <text x={pad - 6} y={pad + 4} fill="rgba(255,255,255,0.38)" fontSize="10" textAnchor="end">{formatMetric(max, unit)}</text>
        <text x={pad - 6} y={height - pad + 4} fill="rgba(255,255,255,0.38)" fontSize="10" textAnchor="end">{formatMetric(min, unit)}</text>
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.38)', fontSize: 10 }}>
        {records.map(record => <span key={`${metric}-date-${record.rawDate}`}>{record.date.slice(11) || record.shortDate}</span>)}
      </div>
    </div>
  )
}

function InBodyCsvDashboard({ record }) {
  const records = parseInBodyCsv(recordText(record))
  const { first, latest, diff } = summarizeInBodyRecords(records)

  if (!records.length) {
    return <div style={{ padding: 30, color: 'rgba(255,255,255,0.55)' }}>Không đọc được dữ liệu InBody CSV.</div>
  }

  const charts = [
    { metric: 'weight', label: 'Cân nặng theo thời gian', unit: 'kg', color: '#00e5ff' },
    { metric: 'muscle', label: 'Cơ xương theo thời gian', unit: 'kg', color: '#9c6fff' },
    { metric: 'fat', label: 'Tỷ lệ mỡ theo thời gian', unit: '%', color: '#ff7676' },
    { metric: 'score', label: 'Điểm InBody theo thời gian', unit: '', color: '#b3ff5f' },
  ]

  return (
    <div style={{ width: '100%', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ color: '#b3ff5f', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em' }}>INBODY CSV · {records.length} DÒNG DỮ LIỆU</div>
          <h3 style={{ margin: '6px 0 0', fontSize: 22 }}>Đồ thị sức khoẻ theo thời gian</h3>
          <div style={{ color: 'rgba(255,255,255,0.48)', fontSize: 12, marginTop: 4 }}>{first?.date} → {latest?.date}</div>
        </div>
        <div style={{ color: '#83f7ff', fontFamily: 'monospace', fontSize: 12, alignSelf: 'center' }}>Thiết bị {latest?.device || '-'}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(120px,1fr))', gap: 10, marginBottom: 14 }}>
        <InBodyMetricTile label="Cân nặng" value={latest.weight} unit="kg" delta={diff('weight')} color="#00e5ff" />
        <InBodyMetricTile label="Cơ xương" value={latest.muscle} unit="kg" delta={diff('muscle')} color="#9c6fff" />
        <InBodyMetricTile label="Tỷ lệ mỡ" value={latest.fat} unit="%" delta={diff('fat')} color="#ff7676" />
        <InBodyMetricTile label="Điểm InBody" value={latest.score} unit="" delta={diff('score')} color="#b3ff5f" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(240px,1fr))', gap: 12 }}>
        {charts.map(chart => <InBodyLineChart key={chart.metric} records={records} {...chart} />)}
      </div>

      <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontFamily: 'monospace' }}>3 dòng dữ liệu gốc từ file CSV</div>
        {records.map(row => (
          <div key={row.rawDate} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(6,1fr)', gap: 8, padding: '9px 12px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.72)' }}>
            <span>{row.date}</span><span>{formatMetric(row.weight, 'kg')}</span><span>{formatMetric(row.muscle, 'kg')}</span><span>{formatMetric(row.fat, '%')}</span><span>BMI {formatMetric(row.bmi)}</span><span>Score {formatMetric(row.score, '', 0)}</span><span>ECW {formatMetric(row.ecwRatio, '', 3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}


function CsvRecordInsights({ record }) {
  const records = parseInBodyCsv(recordText(record))
  const { latest, previous, diff } = summarizeInBodyRecords(records)
  if (!records.length) return null
  const prevWeight = latest?.weight != null && previous?.weight != null ? latest.weight - previous.weight : null
  const prevFat = latest?.fat != null && previous?.fat != null ? latest.fat - previous.fat : null
  const insights = [
    `Đã lấy đúng ${records.length} dòng dữ liệu trong file CSV để dựng dashboard thời gian.`,
    `Lần đo mới nhất: ${latest.date}, cân nặng ${formatMetric(latest.weight, 'kg')}, BMI ${formatMetric(latest.bmi)} và điểm InBody ${formatMetric(latest.score, '', 0)}.`,
    `So với lần đầu: cân nặng ${diff('weight') >= 0 ? '+' : ''}${formatMetric(diff('weight'), 'kg')}, cơ xương ${diff('muscle') >= 0 ? '+' : ''}${formatMetric(diff('muscle'), 'kg')}, mỡ ${diff('fat') >= 0 ? '+' : ''}${formatMetric(diff('fat'), '%')}.`,
    `So với lần trước: cân nặng ${prevWeight >= 0 ? '+' : ''}${formatMetric(prevWeight, 'kg')} · mỡ ${prevFat >= 0 ? '+' : ''}${formatMetric(prevFat, '%')}.`,
  ]
  const rows = [
    ['BMR', formatMetric(latest.bmr, 'kcal', 0)],
    ['Nước cơ thể', formatMetric(latest.water, 'L')],
    ['Mỡ nội tạng', formatMetric(latest.visceralFatLevel, 'Level', 0)],
    ['Protein', formatMetric(latest.protein, 'kg')],
    ['Khoáng chất', formatMetric(latest.minerals, 'kg')],
    ['Góc pha', formatMetric(latest.phaseAngle, '°')],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: 'rgba(179,255,95,0.06)', border: '1px solid rgba(179,255,95,0.18)', borderRadius: 14, padding: 18 }}>
        <div style={{ color: '#b3ff5f', fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.08em', marginBottom: 10 }}>CSV INBODY AUTO ANALYSIS</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 1.8 }}>
          {insights.map(item => <li key={item}>{item}</li>)}
        </ul>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(130px,1fr))', gap: 10 }}>
        {rows.map(([label, value]) => (
          <div key={label} style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 12 }}>
            <div style={{ color: 'rgba(255,255,255,0.42)', fontSize: 11 }}>{label}</div>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 17, marginTop: 5 }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: '10px 12px', background: 'rgba(255,183,77,0.08)', border: '1px solid rgba(255,183,77,0.2)', borderRadius: 8, fontSize: 11, color: 'rgba(255,183,77,0.85)' }}>
        ⚠️ Dữ liệu CSV chỉ hỗ trợ theo dõi sức khoẻ và không thay thế tư vấn y khoa trực tiếp.
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MedicalUploader({ patientId, onSelectImage }) {
  const { lang } = useApp()
  const { user } = useAuth()
  const recordScope = { ownerUuid: user?.uuid, includeUnowned: !!user?.isAdmin }

  const [view, setView]                   = useState('upload')  // 'upload' | 'library' | 'detail'
  const [records, setRecords]             = useState([])
  const [selected, setSelected]           = useState(null)
  const [dragging, setDragging]           = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analyzing, setAnalyzing]         = useState(false)
  const [analysisStream, setAnalysisStream] = useState('')
  const [converting, setConverting]       = useState(false)
  const [error, setError]                 = useState('')
  const [apiKey, setApiKey]               = useState('')
  const [showApiInput, setShowApiInput]   = useState(false)
  const [pdfObjectUrl, setPdfObjectUrl]   = useState(null)
  const [notes, setNotes]                 = useState('')
  const [ocrRunning, setOcrRunning]       = useState(false)
  const [ocrText, setOcrText]             = useState('')
  const [ocrError, setOcrError]           = useState('')
  const [ocrCopied, setOcrCopied]         = useState(false)
  const [summarizing, setSummarizing]     = useState(false)
  const [summaryText, setSummaryText]     = useState('')
  const [summaryError, setSummaryError]   = useState('')
  const [summaryCopied, setSummaryCopied] = useState(false)
  // Đọc to — dùng CHUNG hook useTTS với trang "Lịch sử Chat với AI"
  // (tiếng Việt → Google Translate TTS qua proxy, tiếng Anh → Web Speech API).
  // Web Speech API thuần không đọc đúng tiếng Việt trên hầu hết máy vì thiếu
  // giọng vi-VN cài sẵn, nên dùng đúng cơ chế đã chạy ổn ở trang Lịch sử Chat.
  const tts = useTTS(lang)
  const [speakingWhich, setSpeakingWhich] = useState(null) // 'ocr' | 'summary' | null
  useEffect(() => { if (!tts.speaking) setSpeakingWhich(null) }, [tts.speaking])
  const speakingOcr = tts.speaking && speakingWhich === 'ocr'
  const speakingSummary = tts.speaking && speakingWhich === 'summary'
  function speakOrStop(text, which) {
    if (tts.speaking && speakingWhich === which) { tts.stop(); setSpeakingWhich(null); return }
    setSpeakingWhich(which)
    tts.speak(text)
  }
  const [aiTab, setAiTab]                 = useState('ocr') // 'ocr' | 'summary'
  const [cameraOpen, setCameraOpen]       = useState(false)
  const [cameraStarting, setCameraStarting] = useState(false)
  const [cameraError, setCameraError]     = useState('')
  const [cameraFacingMode, setCameraFacingMode] = useState('environment')
  const [scanOverlayOn, setScanOverlayOn] = useState(true)
  const [scanNow, setScanNow] = useState(new Date())
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const stopCamera = useCallback(() => {
    const stream = streamRef.current
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop()
        stream.removeTrack(track)
      })
    }
    streamRef.current = null
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
      videoRef.current.load()
    }
    setCameraOpen(false)
    setCameraStarting(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (!cameraOpen) return undefined
    setScanNow(new Date())
    const timer = window.setInterval(() => setScanNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [cameraOpen])

  useEffect(() => {
    loadRecords()
    const saved = localStorage.getItem('ai-clinic-api-key')
    if (saved) setApiKey(saved)
  }, [user?.email, user?.isAdmin])

  // Dừng đọc to khi chuyển sang hồ sơ khác (tránh đọc nhầm nội dung cũ)
  useEffect(() => {
    tts.stop()
    setSpeakingWhich(null)
  }, [selected?.id])

  // Convert PDF dataUrl to blob URL for iframe rendering
  useEffect(() => {
    if (!selected?.dataUrl || selected?.mimeType !== 'application/pdf') {
      setPdfObjectUrl(null)
      return
    }
    try {
      const base64 = selected.dataUrl.split(',')[1]
      if (!base64) return
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      setPdfObjectUrl(url)
      return () => URL.revokeObjectURL(url)
    } catch {
      setPdfObjectUrl(null)
    }
  }, [selected?.id, selected?.dataUrl])

  async function loadRecords() {
    const recs = await getAllRecords(recordScope)
    setRecords(recs)
  }

  function openDetail(record) {
    setSelected(record)
    setNotes(record.notes || '')
    setOcrText('')
    setOcrError('')
    setOcrCopied(false)
    setSummaryText('')
    setSummaryError('')
    setSummaryCopied(false)
    setAiTab('ocr')
    setView('detail')
  }

  // ─── File processing ────────────────────────────────────────────────────
  const processFiles = useCallback(async (files) => {
    setError('')
    const arr = Array.from(files)

    for (const file of arr) {
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(uploadText(lang, 'fileTooLarge', { name: file.name, max: MAX_MB }))
        continue
      }
      if (!isSupportedUploadFile(file)) {
        setError(uploadText(lang, 'unsupportedType', { type: file.type || file.name }))
        continue
      }

      setUploading(true)
      setUploadProgress(10)

      try {
        // HEIC/HEIF (default iPhone photo format) can't be displayed by most
        // browsers nor accepted by vision APIs — convert to JPEG up front so
        // every downstream step (preview, storage, AI analysis) just works.
        const safeFile = await ensureBrowserSafeImage(file)

        const progressInterval = setInterval(() => {
          setUploadProgress(p => Math.min(p + 15, 85))
        }, 150)

        const isCsv = isCsvFile(safeFile)
        const [dataUrl, base64Data, textContent] = await Promise.all([
          fileToDataUrl(safeFile),
          fileToBase64(safeFile),
          isCsv ? readFileText(safeFile) : Promise.resolve(''),
        ])

        clearInterval(progressInterval)
        setUploadProgress(100)

        const record = {
          id:         `med_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          filename:   safeFile.name,
          name:       safeFile.name,
          fileType:   detectFileType(safeFile.type, safeFile.name),
          type:       detectFileType(safeFile.type, safeFile.name),
          mimeType:   safeFile.type || (isCsv ? 'text/csv' : 'image/jpeg'),
          size:       safeFile.size,
          uploadedAt: new Date().toISOString(),
          dataUrl,
          base64Data,
          notes:      isCsv ? `InBody CSV · ${parseInBodyCsv(textContent).length} dòng dữ liệu` : '',
          textContent,
          ownerUuid:   user?.uuid || null,
          ownerEmail:  user?.email || '',
          ownerName:   user?.name || '',
          ownerAvatar: user?.avatar || '',
          ownerProvider: user?.provider || '',
        }

        await saveRecord(record, { ownerUuid: user?.uuid })
        notifyUpload()
        await loadRecords()

        setTimeout(() => {
          setUploading(false)
          setUploadProgress(0)
          setSelected(record)
          setNotes(record.notes || '')
          setView('detail')
        }, 400)

      } catch {
        setError(uploadText(lang, 'readError'))
        setUploading(false)
        setUploadProgress(0)
      }
    }
  }, [user?.email, user?.name, user?.avatar, user?.provider, lang])

  const openCamera = useCallback(async (nextFacingMode = cameraFacingMode) => {
    setCameraError('')
    // Stop any existing stream before opening a new one
    const existingStream = streamRef.current
    if (existingStream) {
      existingStream.getTracks().forEach(track => track.stop())
      streamRef.current = null
      if (videoRef.current) { videoRef.current.srcObject = null }
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(lang === 'vi'
        ? 'Trình duyệt không hỗ trợ camera trực tiếp. Vui lòng dùng HTTPS hoặc thử trình duyệt khác.'
        : 'Live camera requires HTTPS. Please try a different browser or connection.')
      return
    }
    setCameraStarting(true)
    let stream = null
    try {
      // Try with ideal high-res constraints first
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: nextFacingMode }, width: { ideal: 1600 }, height: { ideal: 1200 } },
        audio: false,
      })
    } catch {
      // Fallback: minimal constraints (works on more devices/browsers)
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      } catch (e2) {
        const msg = e2?.name === 'NotAllowedError'
          ? (lang === 'vi' ? 'Quyền camera bị từ chối. Vui lòng cho phép camera trong cài đặt trình duyệt rồi thử lại.' : 'Camera permission denied. Please allow camera access in your browser settings and try again.')
          : e2?.name === 'NotFoundError'
          ? (lang === 'vi' ? 'Không tìm thấy camera. Hãy kiểm tra thiết bị có camera không.' : 'No camera found on this device.')
          : (lang === 'vi' ? `Không thể mở camera: ${e2?.message || e2?.name || 'Unknown error'}` : `Cannot open camera: ${e2?.message || e2?.name || 'Unknown error'}`)
        setCameraError(msg)
        setCameraStarting(false)
        return
      }
    }
    streamRef.current = stream
    setCameraFacingMode(nextFacingMode)
    setCameraOpen(true)
    setCameraStarting(false)
    window.setTimeout(() => {
      if (videoRef.current) videoRef.current.srcObject = stream
    }, 0)
  }, [cameraFacingMode, lang])

  const switchCamera = useCallback(() => {
    const nextFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user'
    openCamera(nextFacingMode)
  }, [cameraFacingMode, openCamera])

  const captureCameraPhoto = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    if (cameraFacingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (cameraFacingMode === 'user') ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (scanOverlayOn) {
      drawScanOverlay(ctx, canvas.width, canvas.height, {
        label: uploadText(lang, 'aiDocumentScan'),
        timestamp: scanTimestamp(lang, scanNow),
      })
    }
    canvas.toBlob(blob => {
      if (!blob) {
        setCameraError(lang === 'vi' ? 'Không chụp được ảnh từ camera.' : 'Could not capture a camera photo.')
        return
      }
      const file = new File([blob], `camera_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, { type: 'image/jpeg' })
      stopCamera()
      processFiles([file])
    }, 'image/jpeg', 0.92)
  }, [cameraFacingMode, lang, processFiles, scanNow, scanOverlayOn, stopCamera])

  const onDragOver  = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop      = e => { e.preventDefault(); setDragging(false); processFiles(e.dataTransfer.files) }
  const onFileChange = e => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = '' }
  const onCameraChange = e => { if (e.target.files?.length) processFiles(e.target.files); e.target.value = '' }

  async function handleDelete(id) {
    if (!confirm(uploadText(lang, 'confirmDelete'))) return
    // Nếu record có beMeoProofId → xóa đồng bộ ảnh khỏi proof map (localStorage metadata
    // + sessionStorage dataUrl) để không sót base64 ảnh trong bộ nhớ trình duyệt
    const rec = records.find(r => r.id === id)
    if (rec?.beMeoProofId) {
      const pid = rec.beMeoProofId
      // Xoá metadata trong localStorage (format mới, nhẹ)
      try {
        const meta = JSON.parse(localStorage.getItem('be_meo_nuoc_proof_map_meta') || '{}')
        delete meta[pid]
        localStorage.setItem('be_meo_nuoc_proof_map_meta', JSON.stringify(meta))
      } catch (_) {}
      // Xoá dataUrl thật trong sessionStorage (nơi ảnh base64 thực sự nằm sau fix mới)
      try { sessionStorage.removeItem('be_meo_nuoc_proof_map_' + pid) } catch (_) {}
      // Xoá luôn format cũ (legacy, nếu còn sót) để không bao giờ tái xuất hiện
      try {
        const proofMap = JSON.parse(localStorage.getItem('be_meo_nuoc_proof_map') || '{}')
        delete proofMap[pid]
        localStorage.setItem('be_meo_nuoc_proof_map', JSON.stringify(proofMap))
      } catch (_) {}
      // Xóa luôn proofId khỏi tin nhắn chat để nút Xem lại không còn hiện
      try {
        const msgs = JSON.parse(localStorage.getItem('be-meo-nuoc-chat-v1') || '[]')
        const updated = msgs.map(m => m.proofId === pid ? { ...m, proofId: null } : m)
        localStorage.setItem('be-meo-nuoc-chat-v1', JSON.stringify(updated))
      } catch (_) {}
      // Báo ngay cho WaterDrinkChatBotPanel (nếu đang mount trong tab này) để forward
      // vào iframe và gỡ nút "Xem lại" tức thì, không cần đợi reload trang
      window.dispatchEvent(new CustomEvent('BE_MEO_TASK_PROOF_DELETED', { detail: { proofId: pid } }))
    }
    await deleteRecord(id, recordScope)
    notifyUpload()
    await loadRecords()
    if (selected?.id === id) { setSelected(null); setView('upload') }
  }

  async function saveNotes() {
    if (!selected) return
    const updated = { ...selected, notes }
    await saveRecord(updated, { ownerUuid: user?.uuid })
    notifyUpload()
    setSelected(updated)
    await loadRecords()
  }

  async function saveCsvRecordFromText(csvText, filename, extra = {}) {
    const file = new File([csvText], filename, { type: 'text/csv' })
    const [dataUrl, base64Data] = await Promise.all([fileToDataUrl(file), fileToBase64(file)])
    const record = {
      id: `inbody_csv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      filename,
      name: filename,
      fileType: 'csv',
      type: 'csv',
      mimeType: 'text/csv',
      size: file.size,
      uploadedAt: new Date().toISOString(),
      dataUrl,
      base64Data,
      textContent: csvText,
      notes: `InBody CSV · ${parseInBodyCsv(csvText).length} dòng dữ liệu`,
      ownerUuid: user?.uuid || null,
      ownerEmail: user?.email || '',
      ownerName: user?.name || '',
      ownerAvatar: user?.avatar || '',
      ownerProvider: user?.provider || '',
      sourceModule: 'inbody-image-convert',
      ...extra,
    }
    await saveRecord(record, { ownerUuid: user?.uuid })
    notifyUpload()
    await loadRecords()
    setSelected(record)
    setNotes(record.notes || '')
    setView('detail')
    return record
  }

  async function convertSelectedInBodyImageToCsv() {
    if (!selected || selected.fileType === 'csv') return

    setConverting(true)
    try {
      // Video: Groq Vision không nhận video trực tiếp → trích 1 frame ảnh JPEG
      // đại diện trước, rồi đưa frame đó vào luồng phân tích như ảnh thường.
      const { base64, mimeType } = await getAnalysisImageSource(selected)

      if (!base64) {
        console.error('[InBody Convert] No base64 data available for record', selected.filename)
        return
      }

      const existingCsv   = records.find(r => r.fileType === 'csv' && r.textContent)
      const fallbackRecord = existingCsv ? parseInBodyCsv(recordText(existingCsv)).at(-1) : null

      // Delegate all 3 steps (metrics JSON + date extraction fallback + CSV build)
      // to the shared lib — same logic as AI inbody Portal tab.
      const { csvText } = await convertInBodyImageToCsv({
        base64Image:    base64,
        mediaType:      mimeType,
        file:           null,          // no File object available from stored record
        fallbackRecord,
        sourceName:     selected.filename,
        // selected.aiAnalysis comes from Claude (free-text), not the metrics JSON
        // that convertInBodyImageToCsv expects — always run a fresh Groq Vision pass.
        cachedAnalysis: null,
      })

      const safeName = selected.filename.replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '_') || 'InBody_Image'
      await saveCsvRecordFromText(csvText, `${safeName}_converted.csv`, {
        notes: `Converted from InBody image: ${selected.filename}`,
        convertedFromRecordId: selected.id,
      })
    } catch (err) {
      console.error('[InBody Convert]', err)
    } finally {
      setConverting(false)
    }
  }

  // ─── AI Analysis (CSV → Groq text; ảnh/PDF/video → Anthropic Claude, stream) ──
  async function analyzeWithAI(record) {
    const isCsv = record.fileType === 'csv' || record.mimeType === 'text/csv'

    // CSV: dữ liệu đã là text (InBody) → dùng Groq (miễn phí, không cần API key)
    // để AI đọc và nhận xét trực tiếp trên dữ liệu, không cần Vision.
    if (isCsv) {
      setAnalyzing(true)
      setAnalysisStream('')
      try {
        const csvText = recordText(record)
        const systemMsg = lang === 'vi'
          ? 'Bạn là bác sĩ AI chuyên phân tích chỉ số thành phần cơ thể InBody. Đọc kỹ dữ liệu CSV và đưa ra nhận xét.'
          : 'You are an AI physician specializing in InBody body-composition data. Read the CSV data carefully and give an assessment.'
        const userPrompt = lang === 'vi'
          ? `Đây là dữ liệu InBody dạng CSV (mỗi dòng là 1 lần đo):\n\n${csvText}\n\n---\nHãy phân tích và cung cấp:\n1. Nhận xét tổng quát về xu hướng các chỉ số qua các lần đo\n2. Điểm cần lưu ý (chỉ số bất thường, tăng/giảm đáng kể)\n3. Mức độ ưu tiên: Bình thường / Cần theo dõi / Cần khám sớm / Cần khám ngay\n4. Gợi ý cải thiện (tập luyện, dinh dưỡng)\n\nTrả lời bằng tiếng Việt, ngắn gọn, rõ ràng. Nhắc đây là hỗ trợ AI, không thay thế bác sĩ.`
          : `Here is InBody data in CSV form (each row is one measurement):\n\n${csvText}\n\n---\nPlease provide:\n1. General assessment of trends across measurements\n2. Notable points (abnormal metrics, significant increases/decreases)\n3. Priority level: Normal / Monitor / See a doctor soon / Urgent care\n4. Improvement suggestions (training, nutrition)\n\nAnswer in English, concisely and clearly. Remind the user this is AI support and does not replace a physician.`

        const res = await fetch('/api/groq-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 1024,
            messages: [
              { role: 'system', content: systemMsg },
              { role: 'user', content: userPrompt },
            ],
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Groq ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
        const fullText = data?.choices?.[0]?.message?.content || ''
        setAnalysisStream(fullText)

        const analysis = {
          summary: fullText, findings: [], recommendation: '',
          confidence: 0.8, analyzedAt: new Date().toISOString(), engine: 'groq',
        }
        await updateAnalysis(record.id, analysis, recordScope)
        notifyUpload()
        setSelected(prev => prev ? { ...prev, aiAnalysis: analysis } : prev)
        await loadRecords()
      } catch (err) {
        setAnalysisStream(`❌ ${uploadText(lang, 'errorPrefix')}: ${err instanceof Error ? err.message : uploadText(lang, 'unknownError')}`)
      } finally {
        setAnalyzing(false)
      }
      return
    }

    if (!apiKey) { setShowApiInput(true); return }

    setAnalyzing(true)
    setAnalysisStream('')

    const typeLabel = fileTypeLabel(record.fileType)
    const prompt = lang === 'en'
      ? `You are an AI physician specializing in diagnostic imaging. Analyze this ${typeLabel} and provide:

1. **General assessment** of image quality and modality
2. **Abnormal findings** if any: location, estimated size, features
3. **Priority level**: Normal / Monitor / See a doctor soon / Urgent care
4. **Suggested** follow-up tests or consultations
5. **Important notes**

Answer in English, concisely and clearly. Remind the user this is AI support and does not replace a physician.`
      : `Bạn là bác sĩ AI chuyên khoa chẩn đoán hình ảnh. Phân tích ${typeLabel} này và cung cấp:

1. **Nhận xét tổng quát** về chất lượng và loại hình ảnh
2. **Phát hiện bất thường** (nếu có): vị trí, kích thước ước tính, đặc điểm
3. **Mức độ ưu tiên**: Bình thường / Cần theo dõi / Cần khám sớm / Cần khám ngay
4. **Gợi ý** xét nghiệm hoặc khám bổ sung
5. **Lưu ý quan trọng**

Trả lời bằng tiếng Việt, ngắn gọn và rõ ràng. Nhắc nhở đây là hỗ trợ AI, không thay thế bác sĩ.`

    try {
      const isPdf = record.mimeType === 'application/pdf'
      const isVideo = record.mimeType?.startsWith('video/')
      // Claude Vision không nhận video trực tiếp → trích 1 frame ảnh JPEG đại
      // diện rồi gửi frame đó như ảnh thường (giống Groq Vision ở các luồng khác).
      const { base64: visionBase64, mimeType: visionMimeType } = isVideo
        ? await getAnalysisImageSource(record)
        : { base64: record.base64Data, mimeType: record.mimeType }

      const body = {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        stream: true,
        messages: [{
          role: 'user',
          content: isPdf
            ? [{ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: record.base64Data } }, { type: 'text', text: prompt }]
            : [{ type: 'image',    source: { type: 'base64', media_type: visionMimeType,   data: visionBase64 } }, { type: 'text', text: isVideo ? `${prompt}\n\n(Lưu ý: đây là 1 khung hình được trích từ video gốc.)` : prompt }],
        }],
      }

      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })

      if (!resp.ok) {
        const err = await resp.json()
        throw new Error(err.error?.message || 'API error')
      }

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()
      let fullText  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'content_block_delta' && data.delta?.text) {
              fullText += data.delta.text
              setAnalysisStream(fullText)
            }
          } catch {}
        }
      }

      const analysis = {
        summary: fullText, findings: [], recommendation: '',
        confidence: 0.85, analyzedAt: new Date().toISOString(),
      }
      await updateAnalysis(record.id, analysis, recordScope)
      notifyUpload()
      setSelected(prev => prev ? { ...prev, aiAnalysis: analysis } : prev)
      await loadRecords()

    } catch (err) {
      setAnalysisStream(`❌ ${uploadText(lang, 'errorPrefix')}: ${err instanceof Error ? err.message : uploadText(lang, 'unknownError')}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // ─── OCR — Trích xuất toàn bộ (CSV: đọc trực tiếp · ảnh/PDF/video: Groq Vision) ──
  async function runOCR(record) {
    if (!record) return
    const isPdf = record.mimeType === 'application/pdf'
    const isVideo = record.mimeType?.startsWith('video/')
    const isCsv = record.fileType === 'csv' || record.mimeType === 'text/csv'

    setOcrRunning(true)
    setOcrError('')
    setOcrText('')

    // CSV: dữ liệu vốn đã là text — không cần gọi Vision, đọc trực tiếp.
    if (isCsv) {
      const text = recordText(record)
      if (!text) {
        setOcrError(lang === 'vi' ? 'Không lấy được dữ liệu CSV.' : 'Could not read CSV data.')
      } else {
        setOcrText(text)
      }
      setOcrRunning(false)
      return
    }

    const b64 = record.base64Data || (record.dataUrl ? record.dataUrl.split(',')[1] : null)
    if (!b64) {
      setOcrError(lang === 'vi' ? 'Không lấy được dữ liệu file để OCR.' : 'Could not read file data for OCR.')
      setOcrRunning(false)
      return
    }

    const ocrPrompt = lang === 'vi'
      ? 'Trích xuất TOÀN BỘ văn bản có trong tài liệu này, giữ đúng thứ tự, định dạng và cấu trúc gốc (bảng, đoạn, danh sách). Không tóm tắt, không bỏ sót, không thêm bình luận.'
      : 'Extract the ENTIRE text content from this document, preserving the original order, formatting, and structure (tables, paragraphs, lists). Do not summarize, omit anything, or add commentary.'

    try {
      let imageB64 = b64
      let mimeForVision = record.mimeType || 'image/jpeg'

      // Video: Groq Vision không nhận video trực tiếp → trích 1 frame ảnh JPEG
      // đại diện rồi OCR trên frame đó (như ảnh thường).
      if (isVideo) {
        const frame = await extractVideoFrameBase64(record.dataUrl)
        imageB64 = frame.base64
        mimeForVision = frame.mimeType
      }

      // Scanned PDFs need to be rasterized to an image first for vision OCR
      if (isPdf) {
        const pdfjs = await loadPdfJs()
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const pdf = await pdfjs.getDocument({ data: bytes }).promise
        const pageTexts = []
        for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
          const page = await pdf.getPage(p)
          const vp = page.getViewport({ scale: 2.0 })
          const canvas = document.createElement('canvas')
          canvas.width = vp.width
          canvas.height = vp.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
          const pageB64 = canvas.toDataURL('image/jpeg', 0.92).split(',')[1]

          const res = await fetch('/api/groq-proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'meta-llama/llama-4-scout-17b-16e-instruct',
              max_tokens: 2048,
              messages: [
                { role: 'system', content: lang === 'vi'
                  ? 'Bạn là hệ thống OCR chuyên nghiệp. Hãy trích xuất văn bản chính xác, không thêm bớt, không giải thích.'
                  : 'You are a professional OCR system. Extract text accurately without adding or omitting anything. No explanations.' },
                { role: 'user', content: [
                  { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${pageB64}` } },
                  { type: 'text', text: ocrPrompt },
                ] },
              ],
            }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(`Groq Vision ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
          const pageText = data?.choices?.[0]?.message?.content || ''
          pageTexts.push(`── Trang ${p} ──\n${pageText}`)
        }
        setOcrText(pageTexts.join('\n\n'))
      } else {
        const res = await fetch('/api/groq-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            max_tokens: 2048,
            messages: [
              { role: 'system', content: lang === 'vi'
                ? 'Bạn là hệ thống OCR chuyên nghiệp. Hãy trích xuất văn bản chính xác, không thêm bớt, không giải thích.'
                : 'You are a professional OCR system. Extract text accurately without adding or omitting anything. No explanations.' },
              { role: 'user', content: [
                { type: 'image_url', image_url: { url: `data:${mimeForVision};base64,${imageB64}` } },
                { type: 'text', text: ocrPrompt },
              ] },
            ],
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(`Groq Vision ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
        setOcrText(data?.choices?.[0]?.message?.content || '')
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : (lang === 'vi' ? 'Lỗi OCR không xác định' : 'Unknown OCR error'))
    } finally {
      setOcrRunning(false)
    }
  }

  // ─── Summarize — Tóm tắt toàn bộ (mirrors FullDocumentSummarizationPanel) ──
  async function runSummarize(record) {
    if (!record) return
    const isPdf = record.mimeType === 'application/pdf'
    const isCsv = record.fileType === 'csv' || record.mimeType === 'text/csv'
    const b64 = record.base64Data || (record.dataUrl ? record.dataUrl.split(',')[1] : null)
    if (!isCsv && !b64) {
      setSummaryError(lang === 'vi' ? 'Không lấy được dữ liệu file để tóm tắt.' : 'Could not read file data to summarize.')
      return
    }

    setSummarizing(true)
    setSummaryError('')
    setSummaryText('')

    const userPrompt = lang === 'vi'
      ? 'Tóm tắt toàn bộ tài liệu này một cách đầy đủ, bao gồm tất cả các phần quan trọng.'
      : 'Summarize the entire document thoroughly, covering all key sections.'

    const systemMsg = lang === 'vi'
      ? 'Bạn là chuyên gia phân tích tài liệu y tế. Phân tích kỹ, súc tích, dùng Markdown.'
      : 'You are a medical document expert. Be thorough, concise, use Markdown.'

    const instruction = lang === 'vi'
      ? `\n\n---\nYêu cầu: ${userPrompt}\n\nPhân tích và tóm tắt toàn bộ nội dung.`
      : `\n\n---\nRequest: ${userPrompt}\n\nAnalyze and summarize all content.`

    const callGroqText = async (messages) => {
      const res = await fetch('/api/groq-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1024, messages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`Groq ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
      return data?.choices?.[0]?.message?.content || ''
    }

    const callGroqVision = async (contentParts) => {
      const res = await fetch('/api/groq-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: systemMsg },
            { role: 'user', content: contentParts },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`Groq Vision ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
      return data?.choices?.[0]?.message?.content || ''
    }

    try {
      let resultText = ''

      if (isCsv) {
        // CSV: dữ liệu vốn đã là text → dùng Groq text model trực tiếp, không cần Vision.
        const csvText = recordText(record)
        resultText = await callGroqText([
          { role: 'system', content: systemMsg },
          { role: 'user', content: csvText + instruction },
        ])
      } else if (isPdf) {
        // Try text-layer extraction first
        const pdfjs = await loadPdfJs()
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
        const pdf = await pdfjs.getDocument({ data: bytes }).promise

        const textParts = []
        for (let p = 1; p <= Math.min(pdf.numPages, 50); p++) {
          const pg = await pdf.getPage(p)
          const tc = await pg.getTextContent()
          const t = tc.items.map(i => i.str).join(' ').trim()
          if (t) textParts.push(t)
        }

        if (textParts.length > 0) {
          // Text-based PDF → text model
          const combined = textParts.join('\n\n---\n\n')
          resultText = await callGroqText([
            { role: 'system', content: systemMsg },
            { role: 'user', content: combined + instruction },
          ])
        } else {
          // Scanned PDF → render pages to images → vision model
          const visionParts = []
          for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
            const page = await pdf.getPage(p)
            const vp = page.getViewport({ scale: 1.5 })
            const canvas = document.createElement('canvas')
            canvas.width = vp.width
            canvas.height = vp.height
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
            const pageB64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
            visionParts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${pageB64}` } })
          }
          const contentParts = [...visionParts, { type: 'text', text: instruction }]
          resultText = await callGroqVision(contentParts)
        }
      } else {
        // Image record (hoặc video → đã trích 1 frame ảnh đại diện) → vision model
        const isVideo = record.mimeType?.startsWith('video/')
        const { base64: imgB64, mimeType: mime } = isVideo
          ? await extractVideoFrameBase64(record.dataUrl).then(f => ({ base64: f.base64, mimeType: f.mimeType }))
          : { base64: b64, mimeType: record.mimeType || 'image/jpeg' }
        const contentParts = [
          { type: 'image_url', image_url: { url: `data:${mime};base64,${imgB64}` } },
          { type: 'text', text: isVideo ? `${instruction}\n\n(Lưu ý: đây là 1 khung hình được trích từ video gốc.)` : instruction },
        ]
        resultText = await callGroqVision(contentParts)
      }

      setSummaryText(resultText)
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : (lang === 'vi' ? 'Lỗi tóm tắt không xác định' : 'Unknown summarization error'))
    } finally {
      setSummarizing(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100%', background: '#04060f', fontFamily: "'DM Sans', sans-serif", color: '#e8f0f8', padding: 24 }}>
      <input ref={cameraInputRef} type="file" accept="image/*" capture={cameraFacingMode} onChange={onCameraChange} style={{ display: 'none' }} />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.3} }
        .uploader-fade { animation: fade-in 0.3s ease both; }
        .uploader-hover:hover { transform: scale(1.02); transition: transform 0.15s; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>
            📁 {uploadText(lang, 'title')}
          </h2>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontFamily: 'monospace' }}>
            {uploadText(lang, 'subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <TabBtn active={view === 'upload'}  onClick={() => setView('upload')}>
            + {uploadText(lang, 'upload')}
          </TabBtn>
          <TabBtn active={cameraOpen} onClick={() => { setView('upload'); if (!uploading) openCamera() }}>
            📷 {cameraStarting ? uploadText(lang, 'cameraStarting') : uploadText(lang, 'camera')}
          </TabBtn>
          <TabBtn active={view === 'library'} onClick={() => setView('library')}>
            {uploadText(lang, 'library')}
            {records.length > 0 && (
              <span style={{ background: 'rgba(0,229,255,0.2)', color: '#00e5ff', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>
                {records.length}
              </span>
            )}
          </TabBtn>
        </div>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#ff5252' }}>
          ⚠️ {error}
        </div>
      )}

      {/* ── UPLOAD VIEW ─────────────────────────────────────────────────── */}
      {view === 'upload' && (
        <div className="uploader-fade">
          {cameraError && (
            <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,82,82,0.25)', background: 'rgba(255,82,82,0.08)', color: '#ff5252', fontSize: 12 }}>
              ⚠️ {cameraError}
            </div>
          )}

          {cameraOpen && (
            <div className="uploader-fade" style={{ marginBottom: 20, border: '1px solid rgba(0,229,255,0.22)', borderRadius: 16, padding: 14, background: 'rgba(0,229,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div style={{ color: '#00e5ff', fontSize: 12, fontWeight: 700 }}>📷 {uploadText(lang, 'camera')}</div>
                <button type="button" onClick={stopCamera} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                  {uploadText(lang, 'closeCamera')}
                </button>
              </div>
              <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ display: 'block', width: '100%', maxHeight: 420, objectFit: 'contain', transform: cameraFacingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                {scanOverlayOn && <ScanOverlayBadge label={uploadText(lang, 'aiDocumentScan')} timestamp={scanTimestamp(lang, scanNow)} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{uploadText(lang, 'cameraHelp')}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={switchCamera} style={{ border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.06)', color: '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontWeight: 800, fontSize: 12 }}>
                    🔄 {uploadText(lang, 'switchCamera')}
                  </button>
                  <button type="button" onClick={() => setScanOverlayOn(v => !v)} style={{ border: '1px solid rgba(131,247,255,0.34)', background: scanOverlayOn ? 'rgba(0,229,255,0.16)' : 'rgba(255,255,255,0.06)', color: scanOverlayOn ? '#83f7ff' : '#fff', borderRadius: 10, padding: '10px 12px', cursor: 'pointer', fontWeight: 800, fontSize: 12 }}>
                    ▣ {uploadText(lang, 'overlay')}
                  </button>
                  <button type="button" onClick={captureCameraPhoto} style={{ border: 'none', background: 'linear-gradient(135deg,#00b8cc,#6b3fd4)', color: '#fff', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                    📸 {uploadText(lang, 'capturePhoto')}
                  </button>
                </div>
              </div>
            </div>
          )}


          {/* Drop zone */}
          <div
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={() => !uploading && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#00e5ff' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 16, padding: '52px 24px', textAlign: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              background: dragging ? 'rgba(0,229,255,0.04)' : 'rgba(255,255,255,0.02)',
              transition: 'all 0.2s', marginBottom: 20,
            }}
          >
            {uploading ? (
              <div>
                <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 14, color: '#00e5ff', marginBottom: 16 }}>
                  {uploadText(lang, 'processing')}
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, maxWidth: 300, margin: '0 auto', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#00b8cc,#7c4dff)',
                    width: `${uploadProgress}%`, transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🩻</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
                  {uploadText(lang, 'dragDrop')}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                  {uploadText(lang, 'clickSelect')}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {['X-Ray JPG/PNG', 'CT Scan', 'MRI', uploadText(lang, 'pdfRecord'), 'InBody CSV', uploadText(lang, 'photoRecord')].map(label => (
                    <span key={label} style={{
                      padding: '4px 12px', borderRadius: 20, fontSize: 11,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.5)',
                    }}>{label}</span>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 14 }}>
                  {uploadText(lang, 'maxHint')}
                </div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple accept={ACCEPT} onChange={onFileChange} style={{ display: 'none' }} />

          {/* Recent records */}
          {records.length > 0 && (
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 12 }}>
                {uploadText(lang, 'recentRecords')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 10 }}>
                {records.slice(0, 6).map(r => (
                  <RecordThumb key={r.id} record={r}
                    onClick={() => openDetail(r)}
                    onDelete={() => handleDelete(r.id)}
                    lang={lang}
                  />
                ))}
              </div>
              {records.length > 6 && (
                <button onClick={() => setView('library')} style={{
                  marginTop: 12, width: '100%', padding: '10px',
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 10, color: 'rgba(255,255,255,0.4)', fontSize: 12, cursor: 'pointer',
                }}>
                  {uploadText(lang, 'viewAll', { count: records.length })}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LIBRARY VIEW ─────────────────────────────────────────────────── */}
      {view === 'library' && (
        <div className="uploader-fade">
          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.3)' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
              <div>{uploadText(lang, 'noRecords')}</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 14 }}>
              {records.map(r => (
                <RecordCard key={r.id} record={r}
                  onClick={() => openDetail(r)}
                  onDelete={() => handleDelete(r.id)}
                  lang={lang}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DETAIL VIEW ──────────────────────────────────────────────────── */}
      {view === 'detail' && selected && (
        <div className="uploader-fade">
          <button onClick={() => setView('library')} style={{
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '7px 14px', color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: 12, marginBottom: 20,
          }}>← {uploadText(lang, 'backToLibrary')}</button>

          {/* ── Single-column layout: full-width preview + meta + notes + AI ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Preview — full width, double height */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{
                flex: '1 1 480px', minWidth: 0,
                background: '#000', borderRadius: 14, overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
                minHeight: 480, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {selected.fileType === 'csv' ? (
                <div style={{ width: '100%', padding: 14, boxSizing: 'border-box' }}>
                  <InBodyCsvDashboard record={selected} />
                </div>
              ) : selected.mimeType?.startsWith('video/') ? (
                <video src={selected.dataUrl} controls style={{ maxWidth: '100%', maxHeight: 640, borderRadius: 8 }} />
              ) : selected.mimeType === 'application/pdf' ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
                  {pdfObjectUrl ? (
                    <iframe
                      src={pdfObjectUrl}
                      title={selected.filename}
                      style={{ width: '100%', height: 520, border: 'none', display: 'block' }}
                    />
                  ) : (
                    <div style={{ color: 'rgba(0,229,255,0.7)', fontSize: 11, fontFamily: 'monospace', padding: 24 }}>Đang tải PDF...</div>
                  )}
                  <button
                    onClick={() => onSelectImage?.(selected.dataUrl, records, { selectedRecord: selected })}
                    style={{
                      margin: '12px 0', padding: '10px 22px', background: 'linear-gradient(135deg,#00b8cc,#6b3fd4)',
                      border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >🔬 {uploadText(lang, 'useForCompare')}</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '12px 0', width: '100%' }}>
                  <img
                    src={selected.dataUrl} alt={selected.filename}
                    style={{ maxWidth: '100%', maxHeight: 640, objectFit: 'contain', borderRadius: 8, cursor: 'pointer' }}
                    onClick={() => onSelectImage?.(selected.dataUrl, records, { selectedRecord: selected })}
                  />
                  <button
                    onClick={() => onSelectImage?.(selected.dataUrl, records, { selectedRecord: selected })}
                    style={{
                      padding: '10px 22px', background: 'linear-gradient(135deg,#00b8cc,#6b3fd4)',
                      border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >🔬 {uploadText(lang, 'useForCompare')}</button>
                </div>
              )}
              </div>

              {/* OCR side panel — hiện cho mọi loại file, kể cả CSV (đọc text trực tiếp) */}
              {true && (
                <div style={{ flex: '1 1 320px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Tab switcher */}
                  <div style={{ display: 'flex', gap: 0, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <button
                      onClick={() => setAiTab('ocr')}
                      style={{
                        flex: 1, padding: '12px 14px', border: 'none', cursor: 'pointer',
                        background: aiTab === 'ocr' ? 'rgba(16,185,129,0.16)' : 'rgba(255,255,255,0.03)',
                        color: aiTab === 'ocr' ? '#10b981' : 'rgba(255,255,255,0.5)',
                        fontSize: 13, fontWeight: aiTab === 'ocr' ? 800 : 600,
                        borderBottom: `2px solid ${aiTab === 'ocr' ? '#10b981' : 'transparent'}`,
                      }}
                    >🔍 {lang === 'vi' ? 'Nhận dạng chữ viết OCR' : 'OCR Text Recognition'}</button>
                    <button
                      onClick={() => setAiTab('summary')}
                      style={{
                        flex: 1, padding: '12px 14px', border: 'none', cursor: 'pointer',
                        background: aiTab === 'summary' ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.03)',
                        color: aiTab === 'summary' ? '#a5b4fc' : 'rgba(255,255,255,0.5)',
                        fontSize: 13, fontWeight: aiTab === 'summary' ? 800 : 600,
                        borderBottom: `2px solid ${aiTab === 'summary' ? '#8b5cf6' : 'transparent'}`,
                      }}
                    >🚀 {lang === 'vi' ? 'AI phân tích' : 'AI Analysis'}</button>
                  </div>

                  {/* ── Tab: Nhận dạng chữ viết OCR ── */}
                  {aiTab === 'ocr' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => runOCR(selected)}
                          disabled={ocrRunning}
                          style={{
                            flex: '1 1 auto', padding: '14px 20px', borderRadius: 14, cursor: ocrRunning ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg,#10b981,#059669)', border: 'none',
                            color: '#fff', fontSize: 14, fontWeight: 800, opacity: ocrRunning ? 0.6 : 1,
                            boxShadow: '0 0 20px rgba(16,185,129,0.35)',
                          }}
                        >{ocrRunning ? '⏳ Đang OCR…' : '🔍 Bắt đầu OCR'}</button>
                        {ocrText && !ocrRunning && (
                          <>
                            <button
                              onClick={() => speakOrStop(ocrText, 'ocr')}
                              style={{
                                padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.3)',
                                background: speakingOcr ? 'rgba(16,185,129,0.16)' : 'transparent', color: '#10b981', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                              }}
                            >{speakingOcr ? '⏹️ Dừng đọc' : '🔊 Đọc to'}</button>
                            <button
                              onClick={() => { navigator.clipboard?.writeText(ocrText); setOcrCopied(true); setTimeout(() => setOcrCopied(false), 2000) }}
                              style={{
                                padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.3)',
                                background: 'transparent', color: '#10b981', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                              }}
                            >{ocrCopied ? '✅ Đã sao chép' : '📋 Sao chép'}</button>
                            <button
                              onClick={() => {
                                const blob = new Blob([ocrText], { type: 'text/plain;charset=utf-8' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url; a.download = `${(selected.filename || 'ocr-result').replace(/\.[^.]+$/, '')}.txt`; a.click()
                                URL.revokeObjectURL(url)
                              }}
                              style={{
                                padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(16,185,129,0.3)',
                                background: 'transparent', color: '#10b981', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                              }}
                            >💾 {lang === 'vi' ? 'Tải .txt' : 'Download .txt'}</button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                        Trích xuất toàn bộ · Groq Vision · llama-4-scout
                      </div>

                      {ocrError && (
                        <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#ff5252' }}>
                          ⚠️ {ocrError}
                        </div>
                      )}

                      {ocrRunning && !ocrText && (
                        <div style={{
                          background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)',
                          borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 1s infinite' }} />
                          <span style={{ fontSize: 12, color: '#10b981', fontFamily: 'monospace' }}>
                            {lang === 'vi' ? 'Đang trích xuất văn bản…' : 'Extracting text…'}
                          </span>
                        </div>
                      )}

                      {ocrText && (
                        <div style={{
                          background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: 16, padding: 20,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: 'linear-gradient(135deg,#10b981,#059669)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                            }}>✅</div>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 15, color: '#d1fae5' }}>
                                {lang === 'vi' ? 'Kết quả OCR' : 'OCR Result'}
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                                {ocrText.length.toLocaleString()} {lang === 'vi' ? 'ký tự' : 'characters'}
                              </div>
                            </div>
                          </div>
                          <pre style={{
                            fontSize: 13, color: '#d1fae5', lineHeight: 1.75,
                            whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                            fontFamily: "'Courier New', Courier, monospace",
                            background: 'rgba(16,185,129,0.04)',
                            borderRadius: 10, padding: 14, maxHeight: 480, overflowY: 'auto',
                          }}>
                            {ocrText}
                          </pre>
                        </div>
                      )}

                      {!ocrText && !ocrRunning && !ocrError && (
                        <div style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                          borderRadius: 16, padding: '28px 18px', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>🔍</div>
                          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
                            {lang === 'vi' ? 'Nhấn "Bắt đầu OCR" để trích xuất văn bản' : 'Click "Start OCR" to extract text'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab: AI phân tích (Tóm tắt) ── */}
                  {aiTab === 'summary' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => runSummarize(selected)}
                          disabled={summarizing}
                          style={{
                            flex: '1 1 auto', padding: '14px 20px', borderRadius: 14, cursor: summarizing ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none',
                            color: '#fff', fontSize: 14, fontWeight: 800, opacity: summarizing ? 0.6 : 1,
                            boxShadow: '0 0 20px rgba(99,102,241,0.35)',
                          }}
                        >{summarizing ? '⏳ Đang tóm tắt…' : '🚀 Bắt đầu tóm tắt'}</button>
                        {summaryText && !summarizing && (
                          <>
                            <button
                              onClick={() => speakOrStop(summaryText, 'summary')}
                              style={{
                                padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(99,102,241,0.3)',
                                background: speakingSummary ? 'rgba(99,102,241,0.18)' : 'transparent', color: '#a5b4fc', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                              }}
                            >{speakingSummary ? '⏹️ Dừng đọc' : '🔊 Đọc to'}</button>
                            <button
                              onClick={() => { navigator.clipboard?.writeText(summaryText); setSummaryCopied(true); setTimeout(() => setSummaryCopied(false), 2000) }}
                              style={{
                                padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(99,102,241,0.3)',
                                background: 'transparent', color: '#a5b4fc', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                              }}
                            >{summaryCopied ? '✅ Đã sao chép' : '📋 Sao chép'}</button>
                            <button
                              onClick={() => {
                                const blob = new Blob([summaryText], { type: 'text/plain;charset=utf-8' })
                                const url = URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.href = url; a.download = `${(selected.filename || 'summary-result').replace(/\.[^.]+$/, '')}_summary.txt`; a.click()
                                URL.revokeObjectURL(url)
                              }}
                              style={{
                                padding: '14px 18px', borderRadius: 14, border: '1px solid rgba(99,102,241,0.3)',
                                background: 'transparent', color: '#a5b4fc', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                              }}
                            >💾 {lang === 'vi' ? 'Tải .txt' : 'Download .txt'}</button>
                          </>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                        Tóm tắt toàn bộ · Groq · llama-3.3-70b / llama-4-scout
                      </div>

                      {summaryError && (
                        <div style={{ background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#ff5252' }}>
                          ⚠️ {summaryError}
                        </div>
                      )}

                      {summarizing && !summaryText && (
                        <div style={{
                          background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.15)',
                          borderRadius: 16, padding: 18, display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6', animation: 'pulse-dot 1s infinite' }} />
                          <span style={{ fontSize: 12, color: '#a5b4fc', fontFamily: 'monospace' }}>
                            {lang === 'vi' ? 'Đang tóm tắt tài liệu…' : 'Summarizing document…'}
                          </span>
                        </div>
                      )}

                      {summaryText && (
                        <div style={{
                          background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.3)',
                          borderRadius: 16, padding: 20,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: 10,
                              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                            }}>✨</div>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 15, color: '#e0e7ff' }}>
                                {lang === 'vi' ? 'Tóm tắt toàn bộ' : 'Full Summary'}
                              </div>
                              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                                {summaryText.length.toLocaleString()} {lang === 'vi' ? 'ký tự' : 'characters'}
                              </div>
                            </div>
                          </div>
                          <div
                            style={{ fontSize: 14, color: '#e0e7ff', lineHeight: 1.75, maxHeight: 480, overflowY: 'auto' }}
                            dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 12px">${renderMarkdown(summaryText)}</p>` }}
                          />
                        </div>
                      )}

                      {!summaryText && !summarizing && !summaryError && (
                        <div style={{
                          background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                          borderRadius: 16, padding: '28px 18px', textAlign: 'center',
                        }}>
                          <div style={{ fontSize: 28, marginBottom: 10 }}>🚀</div>
                          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.4)' }}>
                            {lang === 'vi' ? 'Nhấn "Bắt đầu tóm tắt" để AI phân tích tài liệu' : 'Click "Start Summarize" to let AI analyze the document'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Meta */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
              <MetaRow k={uploadText(lang, 'type')}      v={fileTypeLabel(selected.fileType)} vColor={TYPE_COLORS[selected.fileType]} />
              <MetaRow k="File"                                   v={selected.filename} />
              <MetaRow k={uploadText(lang, 'size')} v={formatBytes(selected.size)} />
              <MetaRow k={uploadText(lang, 'uploaded')} v={new Date(selected.uploadedAt).toLocaleString('vi-VN')} />
            </div>

            {selected.fileType !== 'csv' && selected.fileType !== 'pdf' && (
              <button onClick={convertSelectedInBodyImageToCsv} disabled={converting} style={{
                width: '100%', padding: '11px 14px', borderRadius: 10, cursor: converting ? 'not-allowed' : 'pointer',
                background: 'linear-gradient(135deg,rgba(179,255,95,0.22),rgba(0,229,255,0.12))', border: '1px solid rgba(179,255,95,0.35)',
                color: '#b3ff5f', fontSize: 12, fontWeight: 800, opacity: converting ? 0.6 : 1,
              }}>{converting ? '⏳ Đang convert...' : '📈 Convert InBody Image thành .CSV'}</button>
            )}

            {/* Notes */}
            <div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                {uploadText(lang, 'notes')}
              </div>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder={uploadText(lang, 'notesPlaceholder')}
                rows={3}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '10px 14px', color: '#e8f0f8', fontSize: 12,
                  resize: 'vertical', outline: 'none', fontFamily: "'DM Sans',sans-serif", boxSizing: 'border-box',
                }}
              />
              <button onClick={saveNotes} style={{
                marginTop: 8, padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)',
                color: '#00e5ff', fontSize: 12,
              }}>{uploadText(lang, 'saveNotes')}</button>
            </div>

            {/* AI Analysis — below notes/save */}
            <div>
              <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 12 }}>
                {uploadText(lang, 'aiAnalysis')}
              </div>

              {selected.fileType === 'csv' && <CsvRecordInsights record={selected} />}

              {!selected.aiAnalysis && !analyzing && !analysisStream && (
                selected.fileType === 'csv' ? (
                  <div style={{
                    background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                    borderRadius: 14, padding: '32px 24px', textAlign: 'center', marginTop: 12,
                  }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>🧠</div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                      {lang === 'vi' ? 'Để AI (Groq) đọc và nhận xét dữ liệu InBody CSV này' : 'Let AI (Groq) read and assess this InBody CSV data'}
                    </div>
                    <button onClick={() => analyzeWithAI(selected)} style={{
                      padding: '12px 28px', borderRadius: 10, cursor: 'pointer',
                      background: 'linear-gradient(135deg,#b3ff5f,#00e5ff)',
                      color: '#04060f', fontSize: 14, fontWeight: 700, border: 'none',
                    }}>▶ {lang === 'vi' ? 'Phân tích AI (Groq)' : 'Analyze with AI (Groq)'}</button>
                  </div>
                ) : (
                <div style={{
                  background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
                  borderRadius: 14, padding: '32px 24px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                    {uploadText(lang, 'aiAnalyzeHelp')}
                  </div>
                  <button onClick={() => analyzeWithAI(selected)} style={{
                    padding: '12px 28px', borderRadius: 10, cursor: 'pointer',
                    background: 'linear-gradient(135deg,#00b8cc,#6b3fd4)',
                    color: '#fff', fontSize: 14, fontWeight: 600, border: 'none',
                  }}>▶ {uploadText(lang, 'analyzeWithClaude')}</button>
                  {/* API Key input — shown below Analyze button */}
                  {showApiInput && (
                    <div className="uploader-fade" style={{
                      background: 'rgba(255,171,64,0.08)', border: '1px solid rgba(255,171,64,0.25)',
                      borderRadius: 12, padding: '14px 18px', marginTop: 14,
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 12, color: '#ffb74d', flex: 1 }}>
                        {uploadText(lang, 'apiKeyPrompt')}
                      </span>
                      <input
                        type="password" placeholder="sk-ant-..."
                        value={apiKey}
                        onChange={e => { setApiKey(e.target.value); localStorage.setItem('ai-clinic-api-key', e.target.value) }}
                        style={{
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,171,64,0.3)',
                          borderRadius: 8, padding: '8px 14px', color: '#fff', fontSize: 12,
                          fontFamily: 'monospace', width: 260, outline: 'none',
                        }}
                      />
                      <button onClick={() => setShowApiInput(false)} style={{
                        background: 'rgba(255,171,64,0.15)', border: '1px solid rgba(255,171,64,0.3)',
                        borderRadius: 8, padding: '8px 16px', color: '#ffb74d', cursor: 'pointer', fontSize: 12,
                      }}>{uploadText(lang, 'save')}</button>
                    </div>
                  )}
                  {!apiKey && !showApiInput && (
                    <div style={{ fontSize: 11, color: 'rgba(255,171,64,0.7)', marginTop: 10 }}>
                      {uploadText(lang, 'requiresKey')}
                      <button onClick={() => setShowApiInput(true)} style={{
                        background: 'none', border: 'none', color: '#ffb74d',
                        cursor: 'pointer', textDecoration: 'underline', fontSize: 11, marginLeft: 4,
                      }}>{uploadText(lang, 'enterKey')}</button>
                    </div>
                  )}
                </div>
                )
              )}

              {(analyzing || analysisStream) && (
                <div style={{
                  background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)',
                  borderRadius: 14, padding: 18,
                }}>
                  {analyzing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e5ff', animation: 'pulse-dot 1s infinite' }} />
                      <span style={{ fontSize: 11, color: '#00e5ff', fontFamily: 'monospace' }}>
                        {uploadText(lang, 'claudeAnalyzing')}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: 13, lineHeight: 1.8, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto' }}>
                    {analysisStream}
                  </div>
                </div>
              )}

              {selected.aiAnalysis && !analyzing && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 14, padding: 18 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.85, color: 'rgba(255,255,255,0.85)', whiteSpace: 'pre-wrap', maxHeight: 420, overflowY: 'auto' }}>
                      {selected.aiAnalysis.summary}
                    </div>
                  </div>
                  {/* Confidence bar */}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                      <span>{uploadText(lang, 'aiConfidence')}</span>
                      <span style={{ color: '#00e676', fontFamily: 'monospace' }}>{Math.round((selected.aiAnalysis.confidence || 0.85) * 100)}%</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${(selected.aiAnalysis.confidence || 0.85) * 100}%`, height: '100%', background: '#00e676', borderRadius: 2 }} />
                    </div>
                  </div>
                  <div style={{ padding: '8px 12px', background: 'rgba(255,183,77,0.08)', border: '1px solid rgba(255,183,77,0.2)', borderRadius: 8, fontSize: 11, color: 'rgba(255,183,77,0.8)' }}>
                    ⚠️ {uploadText(lang, 'aiDisclaimer')}
                  </div>
                  <button onClick={() => { setAnalysisStream(''); analyzeWithAI(selected) }} style={{
                    padding: '10px 20px', borderRadius: 10, cursor: 'pointer',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.5)', fontSize: 12, alignSelf: 'flex-start',
                  }}>↺ {uploadText(lang, 'reAnalyze')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
