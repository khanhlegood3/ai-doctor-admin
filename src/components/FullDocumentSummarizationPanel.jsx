// src/components/FullDocumentSummarizationPanel.jsx
// Full-Document Summarization — powered by RAG Lab (ColPali visual embeddings + LLM)
// Inspired by: https://github.com/inkind79/rag-lab

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import NavButtons from './NavButtons.jsx'
import { isHeicFile, convertHeicToJpeg } from '../lib/heicConvert.js'
import { loadPdfJs } from '../lib/pdfjsLoader.js'

// ─── Constants ────────────────────────────────────────────────────────────────
const CHUNK_SIZE = 4 // pages per chunk (mirrors rag-lab sequential chunking)

const PROMPT_TEMPLATES = [
  { id: 'summarize',    icon: '📋', label: 'Tóm tắt toàn bộ',       en: 'Summarize the entire document thoroughly, covering all key sections.',                                prompt: 'Tóm tắt toàn bộ tài liệu này một cách đầy đủ, bao gồm tất cả các phần quan trọng.' },
  { id: 'keypoints',   icon: '🎯', label: 'Điểm chính',             en: 'Extract the key points and main findings from this document.',                                       prompt: 'Trích xuất các điểm chính và phát hiện quan trọng từ tài liệu này.' },
  { id: 'clinical',    icon: '🏥', label: 'Phân tích lâm sàng',     en: 'Analyze this document from a clinical perspective, highlighting diagnoses, treatments, and outcomes.', prompt: 'Phân tích tài liệu từ góc độ lâm sàng, nêu bật chẩn đoán, điều trị và kết quả.' },
  { id: 'structured',  icon: '🗂️', label: 'Cấu trúc có hệ thống',  en: 'Organize the document content into a structured format: background, method, results, conclusion.',  prompt: 'Sắp xếp nội dung tài liệu thành định dạng có hệ thống: bối cảnh, phương pháp, kết quả, kết luận.' },
  { id: 'questions',   icon: '❓', label: 'Câu hỏi & Giải đáp',    en: 'Generate the top questions this document answers and provide concise answers.',                       prompt: 'Tạo ra các câu hỏi hàng đầu mà tài liệu này trả lời và cung cấp câu trả lời ngắn gọn.' },
  { id: 'risk',        icon: '⚠️', label: 'Rủi ro & Cảnh báo',    en: 'Identify risks, warnings, contraindications, or red flags in this document.',                        prompt: 'Xác định các rủi ro, cảnh báo, chống chỉ định hoặc dấu hiệu nguy hiểm trong tài liệu.' },
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
      borderRadius: 12, border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
      background: isDark ? 'rgba(99,102,241,0.05)' : 'rgba(99,102,241,0.03)',
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.2))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 900, color: isDark ? '#a5b4fc' : '#4338ca',
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#e0e7ff' : '#1e1b4b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

// ─── Chunk progress bar ───────────────────────────────────────────────────────
function ChunkProgress({ current, total, isDark }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#a5b4fc' : '#4338ca' }}>
          Đang xử lý chunk {current}/{total}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: isDark ? '#a5b4fc' : '#4338ca' }}>{pct}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.1)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function FullDocumentSummarizationPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'

  const [pages, setPages]               = useState([])       // uploaded pages/images
  const [selectedTemplate, setTemplate] = useState('summarize')
  const [customPrompt, setCustomPrompt] = useState('')
  const [useCustom, setUseCustom]       = useState(false)
  const [processing, setProcessing]     = useState(false)
  const [chunkCurrent, setChunkCurrent] = useState(0)
  const [chunkTotal, setChunkTotal]     = useState(0)
  const [summaries, setSummaries]       = useState([])       // per-chunk summaries
  const [finalSummary, setFinalSummary] = useState('')
  const [error, setError]               = useState(null)
  const [dragOver, setDragOver]         = useState(false)
  const [lang, setLang]                 = useState('vi')
  const [copied, setCopied]             = useState(false)
  const [ingesting, setIngesting]       = useState(false) // converting HEIC → JPEG, etc.
  const fileInputRef = useRef(null)
  const abortRef     = useRef(null)

  // ── Color tokens ──
  const bg      = isDark ? 'var(--bg2,#07090f)'             : '#f4f7fb'
  const surface = isDark ? 'rgba(255,255,255,0.03)'         : '#ffffff'
  const border  = isDark ? 'rgba(255,255,255,0.08)'         : 'rgba(0,0,0,0.08)'
  const text    = isDark ? '#e0e7ff'                        : '#1e1b4b'
  const text2   = isDark ? 'rgba(224,231,255,0.55)'        : '#5b6a8a'
  const accent  = isDark ? '#a5b4fc'                        : '#4338ca'
  const accentBg = isDark ? 'rgba(99,102,241,0.12)'        : 'rgba(99,102,241,0.08)'

// ── File ingestion ──
  // HEIC/HEIF detection + conversion now lives in src/lib/heicConvert.js
  // (shared across this panel, Upload Records, and AI InBody Portal).
  const ingestFiles = useCallback(async (files) => {
    setError(null)
    setIngesting(true)
    const newPages = []
    const conversionErrors = []

    for (const file of files) {
      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

      if (isPdf) {
        // Represent each PDF as a single "page" entry (backend would split)
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
    setSummaries([])
    setFinalSummary('')
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
  const clearAll   = () => { setPages([]); setSummaries([]); setFinalSummary(''); setError(null) }

  // ── File helpers ──
  const toBase64 = (file) => new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })

  const readAsText = (file) => new Promise((resolve) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result?.slice(0, 8000) || '')
    r.onerror = () => resolve('')
    r.readAsText(file, 'utf-8')
  })

  // ── Extract text from PDF via pdf.js (self-hosted, dùng chung qua pdfjsLoader) ──
  const extractPdfText = async (file) => {
    try {
      const pdfjs = await loadPdfJs()
      const ab = await file.arrayBuffer()
      const pdf = await pdfjs.getDocument({ data: ab }).promise
      const texts = []
      for (let p = 1; p <= Math.min(pdf.numPages, 30); p++) {
        const page = await pdf.getPage(p)
        const tc   = await page.getTextContent()
        texts.push(tc.items.map(i => i.str).join(' '))
      }
      const out = texts.join('\n\n---\n\n').trim()
      return out.length > 80 ? out.slice(0, 14000) : null
    } catch (_) {
      return null
    }
  }

  // ── Core: sequential chunked summarization ──
  // Images (JPG/PNG)  → Groq llama-4-scout vision (base64 image_url)
  // PDFs text-based   → pdf.js extract text → Groq llama-3.3-70b
  // PDFs scanned      → pdf.js render to canvas → Groq llama-4-scout vision
  // Text files        → Groq llama-3.3-70b
  const runSummarization = useCallback(async () => {
    if (pages.length === 0) { setError('Vui lòng tải lên ít nhất một tài liệu.'); return }
    setProcessing(true); setError(null); setSummaries([]); setFinalSummary('')

    const controller = new AbortController()
    abortRef.current = controller

    const templateObj = PROMPT_TEMPLATES.find(t => t.id === selectedTemplate) || PROMPT_TEMPLATES[0]
    const userPrompt  = useCustom && customPrompt.trim()
      ? customPrompt.trim()
      : (lang === 'vi' ? templateObj.prompt : templateObj.en)

    const chunks = []
    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
      chunks.push(pages.slice(i, i + CHUNK_SIZE))
    }
    setChunkTotal(chunks.length)
    const chunkSummaries = []

    // ── Call Groq text model ──
    const callGroqText = async (messages, signal) => {
      const res = await fetch('/api/groq-proxy', {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 1024, messages }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`Groq ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
      return data?.choices?.[0]?.message?.content || ''
    }

    // ── Call Groq vision model (llama-4-scout) ──
    const callGroqVision = async (contentParts, systemMsg, signal) => {
      const res = await fetch('/api/groq-proxy', {
        method: 'POST', signal,
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

    // ── Render PDF page to canvas → base64 JPEG (for scanned PDFs) ──
    const pdfPageToImage = async (file, pageNum = 1) => {
      try {
        const pdfjs = await loadPdfJs()
        const ab     = await file.arrayBuffer()
        const pdf    = await pdfjs.getDocument({ data: ab }).promise
        const page   = await pdf.getPage(Math.min(pageNum, pdf.numPages))
        const vp     = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width  = vp.width
        canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
        return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      } catch (_) { return null }
    }

    try {
      for (let ci = 0; ci < chunks.length; ci++) {
        if (controller.signal.aborted) break
        setChunkCurrent(ci + 1)

        const chunk = chunks[ci]
        const chunkLabel = lang === 'vi'
          ? `Chunk ${ci + 1}/${chunks.length} — Trang ${ci * CHUNK_SIZE + 1}–${Math.min((ci + 1) * CHUNK_SIZE, pages.length)}`
          : `Chunk ${ci + 1}/${chunks.length} — Pages ${ci * CHUNK_SIZE + 1}–${Math.min((ci + 1) * CHUNK_SIZE, pages.length)}`

        const systemMsg = lang === 'vi'
          ? `Bạn là chuyên gia phân tích tài liệu y tế (RAG Lab · ColPali sequential chunking). Đang xử lý ${chunkLabel}. Phân tích kỹ, súc tích, dùng Markdown.`
          : `You are a medical document expert (RAG Lab · ColPali sequential chunking). Processing ${chunkLabel}. Be thorough, concise, use Markdown.`

        const instruction = lang === 'vi'
          ? `\n\n---\nYêu cầu: ${userPrompt}\n\nĐây là ${chunkLabel}. Phân tích và tóm tắt toàn bộ nội dung.`
          : `\n\n---\nRequest: ${userPrompt}\n\nThis is ${chunkLabel}. Analyze and summarize all content.`

        // Build content — separate image parts vs text parts
        const visionParts = []  // for llama-4-scout
        const textParts   = []  // for llama-3.3-70b

        for (const page of chunk) {
          if (page.type === 'image') {
            // Direct base64 → Groq vision
            try {
              const b64  = await toBase64(page.file)
              const mime = ['image/jpeg','image/png','image/gif','image/webp'].includes(page.file.type)
                ? page.file.type : 'image/jpeg'
              visionParts.push({ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } })
            } catch (_) {
              textParts.push(`[Ảnh: ${page.name}]`)
            }
          } else if (page.type === 'pdf') {
            const pdfText = await extractPdfText(page.file)
            if (pdfText) {
              // Text-based PDF → text model
              textParts.push(`📄 **${page.name}**\n\n${pdfText}`)
            } else {
              // Scanned PDF → render to image → vision model
              const imgB64 = await pdfPageToImage(page.file, 1)
              if (imgB64) {
                visionParts.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imgB64}` } })
              } else {
                textParts.push(`[PDF scan không đọc được: ${page.name}]`)
              }
            }
          } else {
            const txt = await readAsText(page.file)
            textParts.push(txt || `[File: ${page.name}]`)
          }
        }

        let chunkText = ''
        if (visionParts.length > 0) {
          // ── Vision path: Groq llama-4-scout ──
          const contentParts = [
            ...visionParts,
            { type: 'text', text: (textParts.length > 0 ? textParts.join('\n\n') + '\n\n' : '') + instruction },
          ]
          chunkText = await callGroqVision(contentParts, systemMsg, controller.signal)
        } else {
          // ── Text path: Groq llama-3.3-70b ──
          const combined = textParts.join('\n\n---\n\n')
          chunkText = await callGroqText([
            { role: 'system', content: systemMsg },
            { role: 'user',   content: combined + instruction },
          ], controller.signal)
        }

        chunkSummaries.push({ label: chunkLabel, text: chunkText })
        setSummaries(prev => [...prev, { label: chunkLabel, text: chunkText }])
      }

      if (!controller.signal.aborted && chunkSummaries.length > 1) {
        setChunkCurrent(chunks.length)
        const synthesisPrompt = lang === 'vi'
          ? `Tổng hợp các tóm tắt sau thành một bản tóm tắt tổng thể duy nhất, mạch lạc:\n\n${chunkSummaries.map(s => `**${s.label}:**\n${s.text}`).join('\n\n---\n\n')}\n\nYêu cầu gốc: ${userPrompt}`
          : `Synthesize the following into one coherent summary:\n\n${chunkSummaries.map(s => `**${s.label}:**\n${s.text}`).join('\n\n---\n\n')}\n\nOriginal request: ${userPrompt}`

        const synthText = await callGroqText([
          { role: 'system', content: lang === 'vi' ? 'Chuyên gia tổng hợp tài liệu y tế. Dùng Markdown rõ ràng.' : 'Medical document synthesis expert. Use clear Markdown.' },
          { role: 'user',   content: synthesisPrompt },
        ], controller.signal)
        setFinalSummary(synthText)
      } else if (chunkSummaries.length === 1) {
        setFinalSummary(chunkSummaries[0].text)
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || 'Đã xảy ra lỗi khi xử lý tài liệu.')
    } finally {
      setProcessing(false)
      abortRef.current = null
    }
  }, [pages, selectedTemplate, useCustom, customPrompt, lang])

  const handleStop = () => { abortRef.current?.abort() }

  const handleCopy = () => {
    const text = finalSummary || summaries.map(s => `## ${s.label}\n${s.text}`).join('\n\n')
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
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
            background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))',
            border: '1px solid rgba(99,102,241,0.25)',
          }}>
            <span style={{ fontSize: 12 }}>🔬</span>
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: accent, textTransform: 'uppercase' }}>
              Groq Vision · RAG Lab · Sequential Chunking
            </span>
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(24px,4vw,36px)', fontWeight: 900, letterSpacing: '-0.03em', color: text }}>
            Full-Document{' '}
            <span style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Summarization
            </span>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: text2, lineHeight: 1.65 }}>
            Tải lên PDF hoặc hình ảnh tài liệu y tế. Hệ thống sẽ xử lý từng trang theo chunks tuần tự
            và tổng hợp thành bản tóm tắt hoàn chỉnh — như RAG Lab với ColPali visual embeddings.
          </p>
        </div>

        {/* ── Lang toggle ── */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {['vi', 'en'].map(l => (
            <button key={l} type="button" onClick={() => setLang(l)} style={{
              padding: '6px 16px', borderRadius: 20, border: '1px solid',
              borderColor: lang === l ? '#6366f1' : border,
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
            border: `2px dashed ${dragOver ? '#6366f1' : (isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)')}`,
            background: dragOver ? (isDark ? 'rgba(99,102,241,0.08)' : 'rgba(99,102,241,0.04)') : surface,
            cursor: ingesting ? 'wait' : 'pointer', textAlign: 'center', transition: 'all 0.2s',
            opacity: ingesting ? 0.7 : 1, pointerEvents: ingesting ? 'none' : 'auto',
          }}
          onDragOver={(e) => { e.preventDefault(); if (!ingesting) setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !ingesting && fileInputRef.current?.click()}
          role="button" tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && !ingesting && fileInputRef.current?.click()}
          aria-label="Upload documents"
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.heic,.heif,image/*" multiple disabled={ingesting} onChange={onFileChange} style={{ display: 'none' }} />
          <div style={{ fontSize: 36, marginBottom: 12 }}>{ingesting ? '🔄' : '📂'}</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: text, marginBottom: 6 }}>
            {ingesting
              ? (lang === 'vi' ? 'Đang chuyển đổi HEIC → JPEG…' : 'Converting HEIC → JPEG…')
              : (lang === 'vi' ? 'Kéo thả PDF hoặc hình ảnh vào đây' : 'Drop PDFs or images here')}
          </div>
          <div style={{ fontSize: 12, color: text2 }}>
            {lang === 'vi' ? 'Hỗ trợ: PDF, JPG, PNG, WEBP, HEIC (ảnh iPhone) · Nhiều file cùng lúc' : 'Supports: PDF, JPG, PNG, WEBP, HEIC (iPhone photos) · Multiple files at once'}
          </div>
          <div style={{ marginTop: 14, display: 'inline-block', padding: '8px 18px', borderRadius: 20, background: accentBg, color: accent, fontWeight: 800, fontSize: 12, border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}` }}>
            {lang === 'vi' ? '+ Chọn file' : '+ Browse files'}
          </div>
        </div>

        {/* ── Page list ── */}
        {pages.length > 0 && (
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: text }}>
                📎 {pages.length} {lang === 'vi' ? 'trang / tài liệu' : 'page(s) / document(s)'}
                <span style={{ marginLeft: 8, fontSize: 11, color: text2, fontWeight: 600 }}>
                  ({Math.ceil(pages.length / CHUNK_SIZE)} chunks × {CHUNK_SIZE} trang)
                </span>
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

        {/* ── Template selector ── */}
        <div style={card}>
          <div style={{ fontWeight: 800, fontSize: 14, color: text, marginBottom: 14 }}>
            🧩 {lang === 'vi' ? 'Chọn mẫu phân tích' : 'Analysis template'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 14 }}>
            {PROMPT_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => { setTemplate(tpl.id); setUseCustom(false) }}
                style={{
                  padding: '10px 12px', borderRadius: 12, border: '1px solid',
                  borderColor: (!useCustom && selectedTemplate === tpl.id) ? '#6366f1' : border,
                  background: (!useCustom && selectedTemplate === tpl.id) ? accentBg : 'transparent',
                  color: (!useCustom && selectedTemplate === tpl.id) ? accent : text2,
                  fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 16 }}>{tpl.icon}</span>
                <span>{lang === 'vi' ? tpl.label : tpl.id.charAt(0).toUpperCase() + tpl.id.slice(1)}</span>
              </button>
            ))}
          </div>

          {/* Custom prompt toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: useCustom ? 10 : 0 }}>
            <input
              type="checkbox"
              checked={useCustom}
              onChange={e => setUseCustom(e.target.checked)}
              style={{ accentColor: '#6366f1', width: 15, height: 15 }}
            />
            <span style={{ fontSize: 13, fontWeight: 700, color: text2 }}>
              ✏️ {lang === 'vi' ? 'Tuỳ chỉnh prompt' : 'Custom prompt'}
            </span>
          </label>

          {useCustom && (
            <textarea
              value={customPrompt}
              onChange={e => setCustomPrompt(e.target.value)}
              placeholder={lang === 'vi' ? 'Nhập yêu cầu phân tích tài liệu…' : 'Enter document analysis instructions…'}
              rows={3}
              style={{
                width: '100%', borderRadius: 10, border: `1px solid ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(99,102,241,0.2)'}`,
                background: isDark ? 'rgba(99,102,241,0.06)' : 'rgba(99,102,241,0.03)',
                color: text, fontSize: 13, padding: '10px 12px', fontFamily: 'inherit',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
              }}
            />
          )}
        </div>

        {/* ── Action button ── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={processing ? handleStop : runSummarization}
            disabled={pages.length === 0 && !processing}
            style={{
              flex: 1, minWidth: 200, padding: '14px 24px', borderRadius: 14,
              border: 'none', cursor: pages.length === 0 && !processing ? 'not-allowed' : 'pointer',
              background: processing
                ? 'linear-gradient(135deg,#ef4444,#dc2626)'
                : (pages.length === 0 ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)'),
              color: '#fff', fontWeight: 900, fontSize: 15, fontFamily: 'inherit',
              transition: 'all 0.2s', boxShadow: processing || pages.length === 0 ? 'none' : '0 8px 24px rgba(99,102,241,0.35)',
            }}
          >
            {processing
              ? `⏹ ${lang === 'vi' ? 'Dừng xử lý' : 'Stop processing'}`
              : `🚀 ${lang === 'vi' ? 'Bắt đầu tóm tắt' : 'Start summarization'}`}
          </button>
          {(finalSummary || summaries.length > 0) && (
            <button type="button" onClick={handleCopy} style={{
              padding: '14px 20px', borderRadius: 14, border: `1px solid ${border}`,
              background: 'transparent', color: accent, fontWeight: 800, fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              {copied ? '✅ Đã sao chép' : '📋 Sao chép'}
            </button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ ...card, borderColor: 'rgba(239,68,68,0.3)', background: isDark ? 'rgba(239,68,68,0.06)' : 'rgba(239,68,68,0.04)', marginBottom: 16 }}>
            <div style={{ color: '#ef4444', fontWeight: 700, fontSize: 13 }}>⚠️ {error}</div>
          </div>
        )}

        {/* ── Progress ── */}
        {processing && chunkTotal > 0 && (
          <div style={{ ...card, marginBottom: 16 }}>
            <ChunkProgress current={chunkCurrent} total={chunkTotal} isDark={isDark} />
            <div style={{ fontSize: 12, color: text2, textAlign: 'center' }}>
              {lang === 'vi'
                ? `Đang xử lý ${Math.min(chunkCurrent * CHUNK_SIZE, pages.length)} / ${pages.length} trang với ColPali sequential chunking…`
                : `Processing ${Math.min(chunkCurrent * CHUNK_SIZE, pages.length)} / ${pages.length} pages with ColPali sequential chunking…`}
            </div>
          </div>
        )}

        {/* ── Final summary ── */}
        {finalSummary && (
          <div style={{ ...card, borderColor: 'rgba(99,102,241,0.3)', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
              }}>✨</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 15, color: text }}>
                  {lang === 'vi' ? 'Tóm tắt tổng hợp hoàn chỉnh' : 'Final Synthesized Summary'}
                </div>
                <div style={{ fontSize: 11, color: text2, marginTop: 2 }}>
                  {summaries.length} chunks · {pages.length} {lang === 'vi' ? 'trang' : 'pages'}
                </div>
              </div>
            </div>
            <div
              style={{ fontSize: 14, color: text, lineHeight: 1.75 }}
              dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 12px">${renderMarkdown(finalSummary)}</p>` }}
            />
          </div>
        )}

        {/* ── Chunk-by-chunk summaries ── */}
        {summaries.length > 0 && summaries.length > 1 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: text, marginBottom: 12 }}>
              📦 {lang === 'vi' ? 'Chi tiết từng chunk' : 'Per-chunk details'}
            </div>
            {summaries.map((s, i) => (
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
                  {s.label}
                </summary>
                <div
                  style={{ fontSize: 13, color: text, lineHeight: 1.7, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${border}` }}
                  dangerouslySetInnerHTML={{ __html: `<p style="margin:0 0 10px">${renderMarkdown(s.text)}</p>` }}
                />
              </details>
            ))}
          </div>
        )}

        {/* ── Tech info ── */}
        <div style={{ ...card, background: isDark ? 'rgba(99,102,241,0.04)' : 'rgba(99,102,241,0.02)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: text2, marginBottom: 10 }}>
            ⚙️ {lang === 'vi' ? 'Công nghệ nền tảng (RAG Lab)' : 'Powered by RAG Lab technology'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              ['llama-4-scout', lang === 'vi' ? 'Vision · Đọc ảnh/PDF scan' : 'Vision · Images/Scanned PDF'],
                ['llama-3.3-70b', lang === 'vi' ? 'Miễn phí · PDF text' : 'Free · PDF text'],
                ['pdf.js', lang === 'vi' ? 'Extract PDF text' : 'PDF text extraction'],
              ['LanceDB', lang === 'vi' ? 'Vector store' : 'Vector store'],
              ['Chunking tuần tự', lang === 'vi' ? 'Sequential chunks' : 'Sequential chunks'],
              ['Slope-adaptive retrieval', lang === 'vi' ? 'Adaptive retrieval' : 'Adaptive retrieval'],
              ['Mem0', lang === 'vi' ? 'Conversation memory' : 'Conversation memory'],
            ].map(([name, desc]) => (
              <div key={name} style={{
                borderRadius: 10, padding: '6px 10px',
                background: accentBg, border: `1px solid ${isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.15)'}`,
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
