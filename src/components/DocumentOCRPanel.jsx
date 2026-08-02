// src/components/DocumentOCRPanel.jsx
// Document OCR — Trích xuất văn bản từ ảnh & PDF bằng Groq Vision (llama-4-scout)
// Converted from FullDocumentSummarizationPanel.jsx

import React, { useState, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import NavButtons from './NavButtons.jsx'
import { isHeicFile, convertHeicToJpeg } from '../lib/heicConvert.js'
import { loadPdfJs } from '../lib/pdfjsLoader.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const OCR_MODES = [
  { id: 'full',       icon: '📄', label: 'Trích xuất toàn bộ',    en: 'Extract all text',           prompt: 'Extract ALL text from this document exactly as it appears. Preserve layout, line breaks, and structure. Output plain text only.' },
  { id: 'table',      icon: '📊', label: 'Nhận dạng bảng biểu',   en: 'Extract tables',             prompt: 'Extract all tables from this document. Format each table in Markdown with proper columns and rows.' },
  { id: 'structured', icon: '🗂️', label: 'Trích xuất có cấu trúc', en: 'Structured extraction',    prompt: 'Extract text and organize it into structured sections (headings, paragraphs, lists). Use Markdown formatting.' },
  { id: 'medical',    icon: '🏥', label: 'Hồ sơ y tế',            en: 'Medical record OCR',        prompt: 'Extract all text from this medical document. Identify and label: patient info, diagnoses, medications, lab values, dates, and doctor notes.' },
  { id: 'handwriting',icon: '✍️', label: 'Chữ viết tay',          en: 'Handwriting recognition',   prompt: 'Recognize and transcribe all handwritten text in this image as accurately as possible.' },
  { id: 'numbers',    icon: '🔢', label: 'Chỉ số & Số liệu',      en: 'Numbers & values only',     prompt: 'Extract all numeric values, measurements, lab results, dates, and codes from this document. Present as a structured list.' },
]

// ─── Markdown renderer (minimal) ─────────────────────────────────────────────
function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(99,102,241,0.12);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 style="margin:18px 0 8px;font-size:15px;font-weight:800;color:inherit">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:22px 0 10px;font-size:17px;font-weight:900;color:inherit">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:24px 0 12px;font-size:20px;font-weight:900;color:inherit">$1</h1>')
    .replace(/^[-•] (.+)$/gm, '<li style="margin:4px 0 4px 18px;list-style:disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li style="margin:4px 0 4px 18px;list-style:decimal">$2</li>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 12px">')
    .replace(/\n/g, '<br/>')
}

// ─── Page card component ──────────────────────────────────────────────────────
function PageCard({ page, index, isDark }) {
  return (
    <div style={{
      borderRadius: 12, border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
      background: isDark ? 'rgba(16,185,129,0.05)' : 'rgba(16,185,129,0.03)',
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(5,150,105,0.2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, color: isDark ? '#6ee7b7' : '#065f46',
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#d1fae5' : '#064e3b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {page.name}
        </div>
        <div style={{ fontSize: 11, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2 }}>
          {page.type === 'pdf' ? `PDF · Trang ${page.pageNum}` : `Ảnh · ${(page.size / 1024).toFixed(0)} KB`}
        </div>
      </div>
      <div style={{ fontSize: 14 }}>
        {page.type === 'pdf' ? '📄' : '🖼️'}
      </div>
    </div>
  )
}

// ─── OCR progress bar ─────────────────────────────────────────────────────────
function OCRProgress({ current, total, isDark }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#6ee7b7' : '#065f46' }}>
          Đang OCR trang {current}/{total}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#6ee7b7' : '#065f46' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: 'linear-gradient(90deg,#10b981,#059669)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function DocumentOCRPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'

  const [pages, setPages]               = useState([])
  const [selectedMode, setMode]         = useState('full')
  const [customPrompt, setCustomPrompt] = useState('')
  const [useCustom, setUseCustom]       = useState(false)
  const [processing, setProcessing]     = useState(false)
  const [pageCurrent, setPageCurrent]   = useState(0)
  const [pageTotal, setPageTotal]       = useState(0)
  const [ocrResults, setOcrResults]     = useState([])   // per-page OCR text
  const [mergedText, setMergedText]     = useState('')
  const [error, setError]               = useState(null)
  const [dragOver, setDragOver]         = useState(false)
  const [lang, setLang]                 = useState('vi')
  const [copied, setCopied]             = useState(false)
  const [ingesting, setIngesting]       = useState(false)
  const [viewMode, setViewMode]         = useState('merged') // 'merged' | 'pages'
  const fileInputRef = useRef(null)
  const abortRef     = useRef(null)

  // ── Color tokens ──
  const bg       = isDark ? 'var(--bg2,#07090f)'            : '#f4f7fb'
  const surface  = isDark ? 'rgba(255,255,255,0.03)'        : '#ffffff'
  const border   = isDark ? 'rgba(255,255,255,0.08)'        : 'rgba(0,0,0,0.08)'
  const text     = isDark ? '#d1fae5'                       : '#064e3b'
  const text2    = isDark ? 'rgba(209,250,229,0.55)'        : '#5b6a8a'
  const accent   = isDark ? '#6ee7b7'                       : '#065f46'
  const accentBg = isDark ? 'rgba(16,185,129,0.12)'         : 'rgba(16,185,129,0.08)'

  // ── File ingestion ──
  const ingestFiles = useCallback(async (files) => {
    setError(null)
    setIngesting(true)
    const newPages = []
    const conversionErrors = []

    for (const file of files) {
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

      if (isPdf) {
        newPages.push({ id: uid, name: file.name, type: 'pdf', file, pageNum: 1, size: file.size })
      } else if (isHeicFile(file)) {
        try {
          const jpegFile = await convertHeicToJpeg(file)
          newPages.push({ id: uid, name: jpegFile.name, type: 'image', file: jpegFile, size: jpegFile.size })
        } catch (err) {
          console.error('[HEIC convert] failed for', file.name, err)
          conversionErrors.push(file.name)
        }
      } else if (file.type.startsWith('image/')) {
        newPages.push({ id: uid, name: file.name, type: 'image', file, size: file.size })
      }
    }

    setPages(prev => [...prev, ...newPages])
    setOcrResults([])
    setMergedText('')
    if (conversionErrors.length > 0) {
      setError(lang === 'vi'
        ? `Không thể chuyển đổi file HEIC: ${conversionErrors.join(', ')}. Vui lòng thử lưu lại dưới dạng JPG/PNG rồi tải lên.`
        : `Could not convert HEIC file(s): ${conversionErrors.join(', ')}. Please re-save as JPG/PNG and re-upload.`)
    } else {
      setError(null)
    }
    setIngesting(false)
  }, [lang])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false)
    ingestFiles(Array.from(e.dataTransfer.files))
  }, [ingestFiles])

  const onFileChange = useCallback((e) => {
    ingestFiles(Array.from(e.target.files))
    e.target.value = ''
  }, [ingestFiles])

  const removePage = (id) => setPages(prev => prev.filter(p => p.id !== id))
  const clearAll   = () => { setPages([]); setOcrResults([]); setMergedText(''); setError(null) }

  // ── File helpers ──
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

  // ── Render PDF page to canvas → base64 JPEG ──
  const pdfPageToImage = async (file, pageNum = 1) => {
    try {
      const pdfjs = await loadPdfJs()
      const ab     = await file.arrayBuffer()
      const pdf    = await pdfjs.getDocument({ data: ab }).promise
      const page   = await pdf.getPage(Math.min(pageNum, pdf.numPages))
      const vp     = page.getViewport({ scale: 2.0 }) // higher scale = better OCR
      const canvas = document.createElement('canvas')
      canvas.width  = vp.width
      canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
      return { image: canvas.toDataURL('image/jpeg', 0.92).split(',')[1], numPages: pdf.numPages }
    } catch (_) { return null }
  }

  // ── Extract text from PDF via pdf.js (for text-layer PDFs) ──
  const extractPdfText = async (file) => {
    try {
      const pdfjs = await loadPdfJs()
      const ab  = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: ab }).promise
      const texts = []
      for (let p = 1; p <= Math.min(pdf.numPages, 50); p++) {
        const pg = await pdf.getPage(p)
        const tc = await pg.getTextContent()
        const t  = tc.items.map(i => i.str).join(' ').trim()
        if (t) texts.push({ pageNum: p, text: t })
      }
      return texts.length > 0 ? { pages: texts, numPages: pdf.numPages } : null
    } catch (_) { return null }
  }

  // ── Call Groq Vision (llama-4-scout) for OCR ──
  const callGroqVisionOCR = async (b64Image, ocrPrompt, signal) => {
    const res = await fetch('/api/groq-proxy', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: lang === 'vi'
              ? 'Bạn là hệ thống OCR chuyên nghiệp. Hãy trích xuất văn bản chính xác, không thêm bớt, không giải thích.'
              : 'You are a professional OCR system. Extract text accurately without adding or omitting anything. No explanations.',
          },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${b64Image}` } },
              { type: 'text', text: ocrPrompt },
            ],
          },
        ],
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Groq Vision ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
    return data?.choices?.[0]?.message?.content || ''
  }

  // ── Core: OCR each page ──
  const runOCR = useCallback(async () => {
    if (pages.length === 0) { setError('Vui lòng tải lên ít nhất một tài liệu.'); return }
    setProcessing(true); setError(null); setOcrResults([]); setMergedText('')

    const controller = new AbortController()
    abortRef.current = controller

    const modeObj = OCR_MODES.find(m => m.id === selectedMode) || OCR_MODES[0]
    const ocrPrompt = useCustom && customPrompt.trim()
      ? customPrompt.trim()
      : (lang === 'vi' ? modeObj.prompt : modeObj.prompt) // prompt is always English for better OCR accuracy

    const results = []

    try {
      // Build a flat list of tasks: each image or each PDF page
      const tasks = []
      for (const page of pages) {
        if (page.type === 'image') {
          tasks.push({ label: page.name, sourceType: 'image', file: page.file })
        } else if (page.type === 'pdf') {
          // First try text-layer extraction
          const textResult = await extractPdfText(page.file)
          if (textResult && textResult.pages.length > 0) {
            // PDF has text layer — use it directly, skip vision
            for (const tp of textResult.pages) {
              tasks.push({ label: `${page.name} — Trang ${tp.pageNum}`, sourceType: 'pdf-text', text: tp.text })
            }
          } else {
            // Scanned PDF — render each page to image for vision OCR
            const first = await pdfPageToImage(page.file, 1)
            const numPages = first?.numPages || 1
            for (let p = 1; p <= Math.min(numPages, 20); p++) {
              tasks.push({ label: `${page.name} — Trang ${p}`, sourceType: 'pdf-scan', file: page.file, pageNum: p })
            }
          }
        }
      }

      setPageTotal(tasks.length)

      for (let ti = 0; ti < tasks.length; ti++) {
        if (controller.signal.aborted) break
        setPageCurrent(ti + 1)

        const task = tasks[ti]
        let ocrText = ''

        if (task.sourceType === 'pdf-text') {
          // Already have the text from pdf.js
          ocrText = task.text
        } else if (task.sourceType === 'image') {
          const b64 = await toBase64(task.file)
          ocrText = await callGroqVisionOCR(b64, ocrPrompt, controller.signal)
        } else if (task.sourceType === 'pdf-scan') {
          const result = await pdfPageToImage(task.file, task.pageNum)
          if (result?.image) {
            ocrText = await callGroqVisionOCR(result.image, ocrPrompt, controller.signal)
          } else {
            ocrText = lang === 'vi' ? '[Không thể render trang này]' : '[Could not render this page]'
          }
        }

        const entry = { label: task.label, text: ocrText }
        results.push(entry)
        setOcrResults(prev => [...prev, entry])
      }

      // Merge all results
      if (!controller.signal.aborted && results.length > 0) {
        const merged = results.map(r =>
          results.length > 1 ? `--- ${r.label} ---\n${r.text}` : r.text
        ).join('\n\n')
        setMergedText(merged)
      }

    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Đã xảy ra lỗi trong quá trình OCR.')
    } finally {
      setProcessing(false)
      abortRef.current = null
    }
  }, [pages, selectedMode, useCustom, customPrompt, lang])

  const handleStop = () => { abortRef.current?.abort() }

  const handleCopy = () => {
    const txt = mergedText || ocrResults.map(r => `--- ${r.label} ---\n${r.text}`).join('\n\n')
    navigator.clipboard.writeText(txt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const handleDownload = () => {
    const txt = mergedText || ocrResults.map(r => `--- ${r.label} ---\n${r.text}`).join('\n\n')
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = 'ocr-result.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Styles ──
  const card = {
    background: surface, border: `1px solid ${border}`, borderRadius: 16,
    padding: 20, marginBottom: 16,
  }

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '28px 20px 120px', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999,
            padding: '5px 14px', marginBottom: 12,
            background: 'linear-gradient(135deg,rgba(16,185,129,0.15),rgba(5,150,105,0.1))',
            border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <span style={{ fontSize: 12 }}>🔍</span>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: accent, textTransform: 'uppercase' }}>
              Groq Vision · llama-4-scout · OCR
            </span>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, letterSpacing: '-0.03em', color: isDark ? '#d1fae5' : '#064e3b' }}>
            Document{' '}
            <span style={{ background: 'linear-gradient(135deg,#10b981,#059669,#047857)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              OCR
            </span>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: text2, lineHeight: 1.65 }}>
            {lang === 'vi'
              ? 'Tải lên PDF hoặc hình ảnh để trích xuất văn bản bằng AI Vision. Hỗ trợ tài liệu in, chữ viết tay, bảng biểu và PDF scan.'
              : 'Upload PDFs or images to extract text using AI Vision. Supports printed text, handwriting, tables, and scanned PDFs.'}
          </p>
        </div>

        {/* ── Lang toggle ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['vi', 'en'].map(l => (
            <button key={l} type="button" onClick={() => setLang(l)} style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: lang === l ? '#10b981' : border,
              background: lang === l ? accentBg : 'transparent',
              color: lang === l ? accent : text2, fontWeight: 700, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}>
              {l === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
            </button>
          ))}
        </div>

        {/* ── Upload zone ── */}
        <div
          style={{
            ...card,
            border: `2px dashed ${dragOver ? '#10b981' : (isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)')}`,
            background: dragOver ? (isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.04)') : surface,
            cursor: ingesting ? 'wait' : 'pointer', textAlign: 'center', transition: 'all 0.2s',
            opacity: ingesting ? 0.7 : 1, pointerEvents: ingesting ? 'none' : 'auto',
          }}
          onDragOver={(e) => { e.preventDefault(); if (!ingesting) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !ingesting && fileInputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !ingesting && fileInputRef.current?.click()}
          aria-label="Upload documents for OCR"
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.heic,.heif,image/*" multiple disabled={ingesting} onChange={onFileChange} style={{ display: 'none' }} />
          <div style={{ fontSize: 36, marginBottom: 12 }}>{ingesting ? '🔄' : '🔍'}</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: isDark ? '#d1fae5' : '#064e3b', marginBottom: 6 }}>
            {ingesting
              ? (lang === 'vi' ? 'Đang chuyển đổi HEIC → JPEG…' : 'Converting HEIC → JPEG…')
              : (lang === 'vi' ? 'Kéo thả PDF hoặc hình ảnh vào đây để OCR' : 'Drop PDFs or images here to OCR')}
          </div>
          <div style={{ fontSize: 12, color: text2 }}>
            {lang === 'vi'
              ? 'Hỗ trợ: PDF (text & scan), JPG, PNG, WEBP, HEIC · Nhiều file cùng lúc'
              : 'Supports: PDF (text & scanned), JPG, PNG, WEBP, HEIC · Multiple files at once'}
          </div>
          <div style={{ marginTop: 14, display: 'inline-block', padding: '8px 18px', borderRadius: 20, background: accentBg, color: accent, fontWeight: 800, fontSize: 12, border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}` }}>
            {lang === 'vi' ? '+ Chọn file' : '+ Browse files'}
          </div>
        </div>

        {/* ── Page list ── */}
        {pages.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: isDark ? '#d1fae5' : '#064e3b' }}>
                📎 {pages.length} {lang === 'vi' ? 'file đã tải lên' : 'file(s) uploaded'}
              </div>
              <button type="button" onClick={clearAll} style={{
                padding: '4px 12px', borderRadius: 12, border: `1px solid ${border}`,
                background: 'transparent', color: text2, fontSize: 11, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {lang === 'vi' ? '🗑️ Xoá tất cả' : '🗑️ Clear all'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: 8 }}>
              {pages.map((p, i) => (
                <div key={p.id} style={{ position: 'relative' }}>
                  <PageCard page={p} index={i} isDark={isDark} />
                  <button
                    type="button"
                    onClick={() => removePage(p.id)}
                    title="Xoá"
                    style={{
                      position: 'absolute', top: 6, right: 6, width: 20, height: 20,
                      borderRadius: '50%', border: 'none', background: 'rgba(239,68,68,0.15)',
                      color: '#ef4444', fontSize: 11, cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontWeight: 900,
                      fontFamily: 'inherit',
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── OCR mode selector ── */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, color: isDark ? '#d1fae5' : '#064e3b', marginBottom: 14 }}>
            🧩 {lang === 'vi' ? 'Chế độ OCR' : 'OCR mode'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 14 }}>
            {OCR_MODES.map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => { setMode(mode.id); setUseCustom(false) }}
                style={{
                  padding: '10px 12px', borderRadius: 12, border: '1px solid',
                  borderColor: (!useCustom && selectedMode === mode.id) ? '#10b981' : border,
                  background: (!useCustom && selectedMode === mode.id) ? accentBg : 'transparent',
                  color: (!useCustom && selectedMode === mode.id) ? accent : text2,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{mode.icon}</span>
                <span>{lang === 'vi' ? mode.label : mode.en}</span>
              </button>
            ))}
          </div>

          {/* Custom prompt toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: useCustom ? 10 : 0 }}>
            <input
              type="checkbox"
              checked={useCustom}
              onChange={e => setUseCustom(e.target.checked)}
              style={{ accentColor: '#10b981', width: 15, height: 15 }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: text2 }}>
              ✏️ {lang === 'vi' ? 'Tuỳ chỉnh lệnh OCR' : 'Custom OCR instructions'}
            </span>
          </label>

          {useCustom && (
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder={lang === 'vi' ? 'Nhập hướng dẫn trích xuất văn bản…' : 'Enter text extraction instructions…'}
              rows={3}
              style={{
                width: '100%', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.2)'}`,
                background: isDark ? 'rgba(16,185,129,0.06)' : 'rgba(16,185,129,0.03)',
                color: isDark ? '#d1fae5' : '#064e3b', fontSize: 13, padding: '10px 12px', fontFamily: 'inherit',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={processing ? handleStop : runOCR}
            disabled={pages.length === 0 && !processing}
            style={{
              flex: 1, minWidth: 200, padding: '14px 24px', borderRadius: 14,
              border: 'none', cursor: pages.length === 0 && !processing ? 'not-allowed' : 'pointer',
              background: processing
                ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                : (pages.length === 0 ? 'rgba(16,185,129,0.3)' : 'linear-gradient(135deg,#10b981,#059669)'),
              color: '#fff', fontWeight: 900, fontSize: 15, fontFamily: 'inherit',
              transition: 'all 0.2s', boxShadow: processing || pages.length === 0 ? 'none' : '0 8px 24px rgba(16,185,129,0.35)',
            }}
          >
            {processing
              ? `⏹ ${lang === 'vi' ? 'Dừng OCR' : 'Stop OCR'}`
              : `🔍 ${lang === 'vi' ? 'Bắt đầu OCR' : 'Start OCR'}`}
          </button>
          {(mergedText || ocrResults.length > 0) && (
            <>
              <button type="button" onClick={handleCopy} style={{
                padding: '14px 20px', borderRadius: 14, border: `1px solid ${border}`,
                background: 'transparent', color: accent, fontWeight: 800, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {copied ? '✅ Đã sao chép' : '📋 Sao chép'}
              </button>
              <button type="button" onClick={handleDownload} style={{
                padding: '14px 20px', borderRadius: 14, border: `1px solid ${border}`,
                background: 'transparent', color: accent, fontWeight: 800, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                💾 {lang === 'vi' ? 'Tải .txt' : 'Download .txt'}
              </button>
            </>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.3)', background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)', marginBottom: 16 }}>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>⚠️ {error}</div>
          </div>
        )}

        {/* ── Progress ── */}
        {processing && pageTotal > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <OCRProgress current={pageCurrent} total={pageTotal} isDark={isDark} />
            <div style={{ fontSize: 12, color: text2, textAlign: 'center' }}>
              {lang === 'vi'
                ? `Đang nhận dạng văn bản trang ${pageCurrent} / ${pageTotal}…`
                : `Recognizing text on page ${pageCurrent} / ${pageTotal}…`}
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {(mergedText || ocrResults.length > 0) && (
          <div style={{ marginBottom: 16 }}>
            {/* View mode toggle */}
            {ocrResults.length > 1 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                {['merged', 'pages'].map(vm => (
                  <button key={vm} type="button" onClick={() => setViewMode(vm)} style={{
                    padding: '6px 14px', borderRadius: 20, border: '1px solid',
                    borderColor: viewMode === vm ? '#10b981' : border,
                    background: viewMode === vm ? accentBg : 'transparent',
                    color: viewMode === vm ? accent : text2,
                    fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                    {vm === 'merged'
                      ? (lang === 'vi' ? '📄 Gộp toàn bộ' : '📄 Merged view')
                      : (lang === 'vi' ? '📑 Từng trang' : '📑 Per-page view')}
                  </button>
                ))}
              </div>
            )}

            {/* Merged view */}
            {(viewMode === 'merged' || ocrResults.length === 1) && mergedText && (
              <div style={{ ...card, borderColor: 'rgba(16,185,129,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg,#10b981,#059669)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
                  }}>✅</div>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 15, color: isDark ? '#d1fae5' : '#064e3b' }}>
                      {lang === 'vi' ? 'Kết quả OCR' : 'OCR Result'}
                    </div>
                    <div style={{ fontSize: 11, color: text2, marginTop: 2 }}>
                      {ocrResults.length} {lang === 'vi' ? 'trang · ' : 'page(s) · '}
                      {mergedText.length.toLocaleString()} {lang === 'vi' ? 'ký tự' : 'characters'}
                    </div>
                  </div>
                </div>
                <pre style={{
                  fontSize: 13, color: isDark ? '#d1fae5' : '#064e3b', lineHeight: 1.75,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0,
                  fontFamily: "'Courier New', Courier, monospace",
                  background: isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.03)',
                  borderRadius: 10, padding: 14, maxHeight: 520, overflowY: 'auto',
                }}>
                  {mergedText}
                </pre>
              </div>
            )}

            {/* Per-page view */}
            {viewMode === 'pages' && ocrResults.length > 1 && (
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: isDark ? '#d1fae5' : '#064e3b', marginBottom: 12 }}>
                  📑 {lang === 'vi' ? 'Chi tiết từng trang' : 'Per-page details'}
                </div>
                {ocrResults.map((r, i) => (
                  <details key={i} style={{ ...card, marginBottom: 10, cursor: 'pointer' }}>
                    <summary style={{
                      fontWeight: 700, fontSize: 13, color: accent, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      listStyle: 'none', outline: 'none',
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                        background: accentBg, color: accent, fontSize: 11, fontWeight: 900,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}>{i + 1}</span>
                      {r.label}
                      <span style={{ fontSize: 10, color: text2, fontWeight: 600, marginLeft: 4 }}>
                        ({r.text.length.toLocaleString()} {lang === 'vi' ? 'ký tự' : 'chars'})
                      </span>
                    </summary>
                    <pre style={{
                      fontSize: 12, color: isDark ? '#d1fae5' : '#064e3b', lineHeight: 1.7,
                      marginTop: 12, paddingTop: 12, borderTop: `1px solid ${border}`,
                      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      fontFamily: "'Courier New', Courier, monospace",
                      background: isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.03)',
                      borderRadius: 10, padding: 12, maxHeight: 400, overflowY: 'auto',
                    }}>
                      {r.text}
                    </pre>
                  </details>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tech info ── */}
        <div style={{ ...card, background: isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: text2, marginBottom: 10 }}>
            ⚙️ {lang === 'vi' ? 'Công nghệ OCR' : 'OCR technology stack'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['llama-4-scout', lang === 'vi' ? 'Vision OCR · Ảnh & PDF scan' : 'Vision OCR · Images & scanned PDF'],
              ['pdf.js', lang === 'vi' ? 'Text layer extraction' : 'Text layer extraction'],
              ['HEIC → JPEG', lang === 'vi' ? 'Chuyển đổi ảnh iPhone' : 'iPhone photo conversion'],
              ['Multi-page', lang === 'vi' ? 'PDF nhiều trang' : 'Multi-page PDF'],
              ['Export .txt', lang === 'vi' ? 'Tải văn bản OCR' : 'Download OCR text'],
            ].map(([name, desc]) => (
              <div key={name} style={{
                borderRadius: 10, padding: '6px 10px',
                background: accentBg, border: `1px solid ${isDark ? 'rgba(16,185,129,0.2)' : 'rgba(16,185,129,0.15)'}`,
              }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: accent }}>{name}</div>
                <div style={{ fontSize: 10, color: text2, marginTop: 1 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Nav ── */}
        <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} style={{ marginTop: 24 }} />
      </div>
    </div>
  )
}
