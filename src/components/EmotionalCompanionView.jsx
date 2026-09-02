import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { EMOTIONAL_QUICK_PROMPTS } from '../lib/generalPractitionerChat.js'
import {
  getGlobalChatHistory,
  saveGlobalChatHistory,
  ownerKeyOf,
} from '../lib/globalChatbotStorage.js'
import { callGroqChat, useVoiceInput, useTTS, GROQ_VISION_MODEL } from '../lib/groqAiClient.js'
import { MAX_FILES } from '../lib/useGlobalAIChatbotEngine.js'
import { extractPdfTextForInBody, pdfPageToImageForInBody } from '../lib/inbodyImageConvert.js'

// ── Cùng event name với useGlobalAIChatbotEngine → sync 2 chiều realtime ──
const SYNC_EVENT = 'global-ai-chatbot-sync'

const BLUE    = '#0058bc'
const PRIMARY = '#0070eb'
const SURFACE = '#f9f9fb'
const INK     = '#1D1D1F'
const MUTED   = '#86868B'
const HEALTHY = '#68D391'
const ATTENTION = '#FF8A7A'
const GENERAL_DOCTOR_PLAYLIST_EMBED_URL =
  'https://www.youtube.com/embed/videoseries?list=PLhPgpmsoyA4GrZ5mGrOPyf1wb1Ke1Zw8p'

const GP_SYSTEM_VI = `Bạn là AI Bác sĩ đa khoa (General Practitioner AI) — người đồng hành sức khỏe và cảm xúc thân thiện.
Vai trò: lắng nghe triệu chứng (bắt đầu khi nào, mức độ 0-10, thuốc đang dùng, dị ứng), hỗ trợ cảm xúc (lo lắng, mất ngủ, stress), tư vấn sức khỏe phổ thông, phân tích ảnh/tài liệu y tế nếu đính kèm.
Quy tắc: Tiếng Việt, giọng ấm áp, súc tích 3-6 câu. KHÔNG chẩn đoán/kê đơn thay bác sĩ. Nếu có dấu hiệu cấp cứu (đau ngực, khó thở nặng, đột quỵ, co giật, tự hại): khuyên gọi cấp cứu ngay.`

const GP_SYSTEM_EN = `You are a General Practitioner AI — a friendly health and emotional companion.
Role: listen to symptoms (onset, severity 0-10, medications, allergies), provide emotional support (anxiety, insomnia, stress), give general health info, analyze medical images/documents if attached.
Rules: Warm tone, concise (3-6 sentences). NEVER diagnose or prescribe — always encourage booking a doctor. If emergency signs appear (chest pain, severe dyspnea, stroke, seizure, self-harm): advise calling emergency services immediately.`

const GP_WELCOME_VI = 'Xin chào! Tôi là AI Bác sĩ đa khoa, luôn sẵn sàng lắng nghe và hỗ trợ bạn. Hãy kể cho tôi nghe bạn đang cảm thấy thế nào, hoặc mô tả triệu chứng — tôi sẽ đồng hành cùng bạn. Bạn cũng có thể nói chuyện bằng giọng nói 🎙️ hoặc gửi ảnh y tế để tôi phân tích 🖼️.'
const GP_WELCOME_EN = "Hello! I'm your General Practitioner AI, always ready to listen and support you. Tell me how you're feeling or describe your symptoms — I'm here with you. You can also speak with your voice 🎙️ or send medical images for analysis 🖼️."

const panelShell = {
  minHeight: 920, borderRadius: 28, overflow: 'hidden',
  background: SURFACE, border: '1px solid rgba(0,0,0,0.08)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.10)', color: '#1a1c1d', position: 'relative',
}
const glass = {
  background: 'rgba(255,255,255,0.76)', backdropFilter: 'blur(20px)',
  border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 10px 40px rgba(0,0,0,0.06)',
}

function CompanionTile({ icon, color, title, subtitle, onClick }) {
  return (
    <button type="button" onClick={onClick}
      style={{ ...glass, padding: 24, borderRadius: 26, border: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', fontFamily: 'inherit' }}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: `${color}25`, display: 'grid', placeItems: 'center', color, marginBottom: 16, fontSize: 22 }}>{icon}</div>
      <h3 style={{ margin: 0, fontSize: 15, color: INK }}>{title}</h3>
      <p style={{ margin: '6px 0 0', color: MUTED, fontSize: 13 }}>{subtitle}</p>
    </button>
  )
}

function fmtTime(iso, lang) {
  try { return new Date(iso).toLocaleTimeString(lang === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' }) }
  catch { return '' }
}

function makeMsg(role, text, extra = {}) {
  return { id: `gp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, role, text, createdAt: new Date().toISOString(), ...extra }
}
function makeWelcome(isVi) {
  return { id: 'gp-welcome', role: 'assistant', text: isVi ? GP_WELCOME_VI : GP_WELCOME_EN, createdAt: new Date().toISOString() }
}

export default function EmotionalCompanionView({ onOpenStressRelief, onOpenInBody }) {
  const { lang } = useApp()
  const { user } = useAuth()
  const isVi = lang !== 'en'
  const userKey   = user?.uuid || null
  const ownerKey  = ownerKeyOf(userKey)

  // ── Sync giữa mọi instance dùng chung kho này (cùng pattern useGlobalAIChatbotEngine) ──
  const instanceId          = useRef(`gp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`)
  const skipBroadcastRef    = useRef(false)
  const historyLoadedRef    = useRef(false)

  const [messages,       setMessages]       = useState(() => [makeWelcome(isVi)])
  const [chatPrompt,     setChatPrompt]     = useState('')
  const [busy,           setBusy]           = useState(false)
  const [attachedFiles,  setAttachedFiles]  = useState([])
  const [speakingMsgId,  setSpeakingMsgId]  = useState(null)

  const scrollRef   = useRef(null)
  const docInputRef = useRef(null)
  const imgInputRef = useRef(null)

  // ── TTS ──
  const ttsVi = useTTS('vi')
  const ttsEn = useTTS('en')
  const activeTts  = isVi ? ttsVi : ttsEn
  const isSpeaking = ttsVi.speaking || ttsEn.speaking
  useEffect(() => { if (!isSpeaking) setSpeakingMsgId(null) }, [isSpeaking])

  // ── STT ──
  const { recording, transcribing, toggle: toggleMic } = useVoiceInput(
    (text) => setChatPrompt(prev => prev ? `${prev} ${text}` : text),
    isVi ? 'vi' : 'en'
  )

  // ── Auto-scroll ──
  useEffect(() => {
    window.setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 30)
  }, [messages, busy])

  // ── Load lịch sử từ CÙNG kho với GlobalAIChatbot ──
  useEffect(() => {
    let cancelled = false
    historyLoadedRef.current = false
    ;(async () => {
      const saved = await getGlobalChatHistory(userKey)
      if (cancelled) return
      setMessages(saved.length > 0 ? saved : [makeWelcome(isVi)])
      historyLoadedRef.current = true
    })()
    return () => { cancelled = true }
  }, [userKey])

  // ── Lắng nghe sync từ GlobalAIChatbot (hoặc nơi khác) đang mở song song ──
  useEffect(() => {
    const onSync = (e) => {
      const d = e.detail || {}
      if (d.ownerKey !== ownerKey) return
      if (d.instanceId === instanceId.current) return   // do chính mình phát → bỏ qua
      skipBroadcastRef.current = true
      setMessages(d.messages || [])
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [ownerKey])

  // ── Lưu + phát sync mỗi khi messages đổi ──
  useEffect(() => {
    if (!historyLoadedRef.current) return
    saveGlobalChatHistory(userKey, messages)
    if (skipBroadcastRef.current) { skipBroadcastRef.current = false; return }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, {
      detail: { ownerKey, messages, instanceId: instanceId.current },
    }))
  }, [messages, userKey, ownerKey])

  // ── File helpers ──
  const readDataUrl = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result||'')); r.onerror = rej; r.readAsDataURL(f) })
  const readText    = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result||'')); r.onerror = rej; r.readAsText(f,'utf-8') })
  const isTextLike  = (f) => /\.(txt|csv|md)$/i.test(f.name||'') || ['text/plain','text/csv'].includes(f.type)

  const handleFilesSelect = async (e) => {
    const files = Array.from(e.target.files||[]); e.target.value = ''
    if (!files.length) return
    const room = MAX_FILES - attachedFiles.length
    if (room <= 0) { window.alert(isVi ? `Tối đa ${MAX_FILES} file.` : `Max ${MAX_FILES} files.`); return }
    const entries = []
    for (const f of files.slice(0, room)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2,7)}`
      try {
        if (f.type.startsWith('image/')) {
          const dataUrl = await readDataUrl(f)
          entries.push({ id, kind:'image', dataUrl, base64: dataUrl.split(',')[1]||'', mimeType: f.type, name: f.name })
        } else if (f.type === 'application/pdf') {
          // Groq vision chỉ nhận ảnh thật (jpeg/png/...), KHÔNG nhận PDF thô qua image_url
          // (gửi thẳng base64 PDF sẽ bị Groq trả lỗi "invalid image data").
          // Nên: thử trích xuất text trước (PDF dạng text), nếu không có thì render trang 1 → JPEG.
          const pdfText = await extractPdfTextForInBody(f)
          if (pdfText) {
            entries.push({ id, kind:'text', name: f.name, mimeType:'application/pdf', textContent: pdfText })
          } else {
            const imgB64 = await pdfPageToImageForInBody(f, 1)
            if (imgB64) {
              entries.push({ id, kind:'image', dataUrl: `data:image/jpeg;base64,${imgB64}`, base64: imgB64, mimeType:'image/jpeg', name: f.name })
            } else {
              console.error('Could not process PDF (no text, render failed):', f.name)
            }
          }
        } else if (isTextLike(f)) {
          entries.push({ id, kind:'text', name: f.name, mimeType: f.type||'text/plain', textContent: await readText(f) })
        }
      } catch(err) { console.error('read file:', f.name, err) }
    }
    if (entries.length) setAttachedFiles(prev => [...prev, ...entries])
  }
  const removeFile = (id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))

  // ── Gửi tin nhắn ──
  const submitChat = async () => {
    const prompt = chatPrompt.trim()
    const files  = attachedFiles
    if (!prompt && files.length === 0) return
    if (busy) return

    setChatPrompt(''); setAttachedFiles([]); setBusy(true)

    // Tin nhắn user — role: 'user' (đồng bộ format với GlobalAIChatbot)
    const userMsg = makeMsg('user', prompt || (isVi ? `[Đã gửi ${files.length} file]` : `[Sent ${files.length} file(s)]`), {
      imageDataUrls: files.filter(f => f.kind==='image').map(f => ({ dataUrl: f.dataUrl, kind: f.kind, name: f.name })),
      fileNames:     files.filter(f => f.kind==='text').map(f => f.name),
    })
    setMessages(prev => [...prev, userMsg])

    const systemPrompt = isVi ? GP_SYSTEM_VI : GP_SYSTEM_EN

    try {
      let reply = ''

      if (files.length > 0) {
        const visionFiles = files.filter(f => f.kind==='image')
        const textBlock   = files.filter(f => f.kind==='text').map(f => `--- ${f.name} ---\n${f.textContent}`).join('\n\n')
        const instruction = (prompt || (isVi ? 'Phân tích tài liệu/hình ảnh y tế này.' : 'Analyze this medical document/image.')) + (textBlock ? `\n\n---\n${textBlock}` : '')

        if (visionFiles.length > 0) {
          const res = await fetch('/api/groq-proxy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: GROQ_VISION_MODEL, max_tokens: 1024,
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: [
                  ...visionFiles.map(f => ({ type:'image_url', image_url:{ url:`data:${f.mimeType};base64,${f.base64}` } })),
                  { type:'text', text: instruction },
                ]},
              ],
            }),
          })
          const data = await res.json().catch(()=>({}))
          if (!res.ok) throw new Error(data?.error?.message || `Groq Vision ${res.status}`)
          reply = data?.choices?.[0]?.message?.content || ''
        } else {
          reply = await callGroqChat([{ role:'user', content: instruction }], systemPrompt)
        }
      } else {
        // Chat văn bản — gửi history (đã dùng format 'assistant' nhất quán)
        const history = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.text }))
        history.push({ role: 'user', content: prompt })
        reply = await callGroqChat(history, systemPrompt)
      }

      // Tin AI — role: 'assistant' (đồng bộ format với GlobalAIChatbot)
      setMessages(prev => [...prev, makeMsg('assistant', reply || (isVi ? 'Xin lỗi, chưa có phản hồi phù hợp.' : 'Sorry, no response generated.'))])
    } catch(err) {
      console.error('GP AI error:', err)
      setMessages(prev => [...prev, makeMsg('assistant', isVi
        ? 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau ít phút.'
        : 'Sorry, I ran into a connection issue. Please try again in a moment.')])
    } finally {
      setBusy(false)
    }
  }

  const toggleSpeak = (msgId, text) => {
    if (speakingMsgId === msgId && isSpeaking) { ttsVi.stop(); ttsEn.stop(); setSpeakingMsgId(null); return }
    ttsVi.stop(); ttsEn.stop(); setSpeakingMsgId(msgId); activeTts.speak(text)
  }

  const resetChat = () => {
    ttsVi.stop(); ttsEn.stop()
    const welcome = [makeWelcome(isVi)]
    setMessages(welcome); setChatPrompt(''); setAttachedFiles([])
  }

  return (
    <div style={panelShell}>
      {/* ── Header ── */}
      <div style={{ position:'sticky', top:0, zIndex:10, height:64, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 20px', ...glass }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <img alt="Patient Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAtKXZ8Z8xPdcddYd3_3LBUEgNXwg0eUvQSbHPBE7s4E0uhgb1LmS8wv5Igo9RqOekFLODV8AnqqJ87x2V5HuMj4zhCQDQhBlHpwDeVC7qg754k6-pXFeqwK9QDHldUAg7tHwQvn2isqzLDdinvGpzXK9ceLKuMGv8Qw1zBWtZb50Y2DehAH-CvqixV5e8bGLSTG3FNFmQ8DSlRQQBa6dpkXRs-tUXnA6dpiVBpbS9Wgl61ud3uxjSzBXi6HI0SnVuiskg5fquAGSs5" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover', background:'#e1dfe3' }} />
          <b style={{ fontSize:22, color:INK }}>Digital Twin</b>
        </div>
        <span style={{ fontSize:22 }}>🔔</span>
      </div>

      <main style={{ maxWidth:820, margin:'0 auto', padding:'28px 20px 200px' }}>
        {/* ── Intro ── */}
        <section style={{ marginBottom:28 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:52, height:52, borderRadius:18, background:BLUE, display:'grid', placeItems:'center', color:'#fff', boxShadow:'0 12px 30px rgba(0,88,188,0.24)', fontSize:28 }}>🤖</div>
            <div>
              <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:INK }}>{isVi ? 'Xin chào, tôi là AI Bác sĩ đa khoa' : 'Hello, I am the General Practitioner AI'}</h1>
              <p style={{ margin:'4px 0 0', color:MUTED, fontSize:16 }}>{isVi ? 'Lắng nghe · tâm sự · hỗ trợ cảm xúc · phân tích ảnh y tế' : 'Listen · chat · emotional support · medical image analysis'}</p>
            </div>
          </div>
        </section>

        {/* ── Tiles + playlist ── */}
        <section style={{ display:'grid', gridTemplateColumns:'repeat(2, minmax(0, 1fr))', gap:16, marginBottom:28 }}>
          <CompanionTile icon="📝" color={ATTENTION} title={isVi ? 'Góc xả stress' : 'Stress journal'} subtitle={isVi ? 'Mở không gian xả stress chuyên sâu' : 'Open the immersive stress relief room'} onClick={onOpenStressRelief} />
          <CompanionTile icon="💚" color={HEALTHY}   title={isVi ? 'Khẳng định' : 'Affirmations'} subtitle={isVi ? 'Mở cổng InBody' : 'Open the InBody portal'} onClick={onOpenInBody} />
          <div style={{ gridColumn:'1 / -1', padding:24, borderRadius:28, ...glass, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'relative', zIndex:2 }}>
              <span style={{ display:'inline-block', padding:'5px 12px', borderRadius:999, background:'rgba(0,88,188,0.10)', color:BLUE, fontSize:12, fontWeight:800, marginBottom:14 }}>{isVi ? 'Hoạt động đề xuất' : 'Suggested activity'}</span>
              <h3 style={{ margin:0, fontSize:26, color:INK }}>{isVi ? 'Playlist chăm sóc tinh thần cùng AI Bác sĩ đa khoa' : 'Mental wellness playlist with the GP AI'}</h3>
              <p style={{ margin:'10px 0 16px', maxWidth:620, color:MUTED, lineHeight:1.55 }}>{isVi ? 'Phát các video hướng dẫn thư giãn, chăm sóc sức khoẻ tinh thần và phục hồi năng lượng ngay trong trang này.' : 'Play relaxation, emotional-care, and recovery videos directly inside this page.'}</p>
              <div style={{ position:'relative', width:'100%', aspectRatio:'16 / 9', borderRadius:20, overflow:'hidden', border:'1px solid rgba(0,88,188,0.14)', boxShadow:'0 18px 46px rgba(0,88,188,0.16)', background:'#000' }}>
                <iframe title={isVi ? 'Playlist AI Bác sĩ đa khoa đồng hành cảm xúc' : 'GP AI emotional companion playlist'} src={GENERAL_DOCTOR_PLAYLIST_EMBED_URL} style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:0 }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              </div>
            </div>
            <div style={{ position:'absolute', right:-40, bottom:-40, width:170, height:170, borderRadius:'50%', background:'rgba(0,88,188,0.06)', animation:'hj-breathe 8s ease-in-out infinite' }} />
          </div>
        </section>

        {/* ── Chat ── */}
        <section style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* Chat header */}
          <div style={{ display:'flex', justifyContent:'space-between', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ color:MUTED, fontSize:12, fontWeight:800 }}>
                {isVi
                  ? `${messages.length} tin nhắn · Groq AI · giọng nói · file · đồng bộ với Global Chat`
                  : `${messages.length} messages · Groq AI · voice · files · synced with Global Chat`}
              </span>
              {busy && (
                <span style={{ fontSize:11, padding:'3px 10px', borderRadius:20, background:'rgba(0,88,188,0.10)', color:BLUE, fontWeight:700, animation:'gpPulse 1.4s ease-in-out infinite' }}>
                  {isVi ? 'AI đang soạn…' : 'AI thinking…'}
                </span>
              )}
            </div>
            <button type="button" onClick={resetChat}
              style={{ border:'1px solid rgba(0,88,188,0.14)', background:'rgba(0,88,188,0.06)', color:BLUE, borderRadius:999, padding:'8px 12px', fontSize:12, fontWeight:900, cursor:'pointer' }}>
              {isVi ? 'Tạo lại cuộc trò chuyện' : 'Reset chat'}
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} style={{ display:'flex', flexDirection:'column', gap:14, maxHeight:480, overflowY:'auto', paddingRight:4 }}>
            {messages.map(msg => {
              // Hỗ trợ cả 'user'|'assistant' (format mới) lẫn 'agent' (format cũ trong storage cũ)
              const isUser = msg.role === 'user'
              return (
                <div key={msg.id} style={{ display:'flex', justifyContent:isUser?'flex-end':'flex-start', gap:12, marginLeft:isUser?60:0, marginRight:isUser?0:60 }}>
                  {!isUser && <div style={{ width:34, height:34, borderRadius:'50%', background:BLUE, color:'#fff', flexShrink:0, display:'grid', placeItems:'center' }}>🤖</div>}
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ background:isUser?PRIMARY:'rgba(255,255,255,0.76)', color:isUser?'#fff':INK, padding:'16px 20px', borderRadius:isUser?'24px 24px 4px 24px':'4px 24px 24px 24px', border:isUser?'none':'1px solid rgba(255,255,255,0.45)', boxShadow:'0 4px 12px rgba(0,0,0,0.06)', lineHeight:1.65 }}>
                      <div style={{ fontSize:10, fontWeight:900, letterSpacing:'.06em', color:isUser?'rgba(255,255,255,0.78)':BLUE, marginBottom:6 }}>
                        {isUser ? (isVi?'BẠN':'YOU') : 'AI BÁC SĨ ĐA KHOA'}
                      </div>
                      {/* Ảnh/PDF đính kèm */}
                      {msg.imageDataUrls?.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:msg.text?8:0 }}>
                          {msg.imageDataUrls.map((img,i) => (
                            img.kind==='pdf'
                              ? <div key={i} style={{ width:52, height:52, borderRadius:10, background:'rgba(255,255,255,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize:18 }}>📄<span style={{ fontSize:8, marginTop:2, maxWidth:44, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{img.name}</span></div>
                              : <img key={i} src={img.dataUrl} alt={img.name||'img'} style={{ width:52, height:52, borderRadius:10, objectFit:'cover' }} />
                          ))}
                        </div>
                      )}
                      {msg.fileNames?.length > 0 && (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:msg.text?8:0 }}>
                          {msg.fileNames.map((name,i) => <span key={i} style={{ fontSize:10, padding:'3px 8px', borderRadius:8, background:'rgba(255,255,255,0.2)' }}>📃 {name}</span>)}
                        </div>
                      )}
                      <p style={{ margin:0, whiteSpace:'pre-wrap' }}>{msg.text}</p>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:isUser?'flex-end':'space-between', gap:8, marginTop:8 }}>
                        <span style={{ opacity:.55, fontSize:12 }}>{fmtTime(msg.createdAt, lang)}</span>
                        {!isUser && (
                          <button type="button" onClick={() => toggleSpeak(msg.id, msg.text)}
                            title={speakingMsgId===msg.id&&isSpeaking ? (isVi?'Dừng đọc':'Stop') : (isVi?'Đọc to':'Read aloud')}
                            style={{ background:'rgba(0,88,188,0.10)', border:'none', borderRadius:20, padding:'4px 10px', fontSize:13, color:BLUE, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                            {speakingMsgId===msg.id&&isSpeaking ? '⏸' : '🔊'}
                            <span style={{ fontSize:10, fontWeight:700 }}>{speakingMsgId===msg.id&&isSpeaking ? (isVi?'Dừng':'Stop') : (isVi?'Nghe':'Listen')}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Typing indicator */}
            {busy && (
              <div style={{ display:'flex', justifyContent:'flex-start', gap:12, marginRight:60 }}>
                <div style={{ width:34, height:34, borderRadius:'50%', background:BLUE, color:'#fff', flexShrink:0, display:'grid', placeItems:'center' }}>🤖</div>
                <div style={{ background:'rgba(255,255,255,0.76)', padding:'16px 20px', borderRadius:'4px 24px 24px 24px', border:'1px solid rgba(255,255,255,0.45)', boxShadow:'0 4px 12px rgba(0,0,0,0.06)', display:'flex', gap:5, alignItems:'center' }}>
                  {[0,.2,.4].map((d,i)=><span key={i} style={{ width:8, height:8, borderRadius:'50%', background:BLUE, display:'inline-block', animation:`gpTypingDot 1.2s ${d}s ease-in-out infinite` }}/>)}
                </div>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {(EMOTIONAL_QUICK_PROMPTS[lang]||EMOTIONAL_QUICK_PROMPTS.vi).map(p => (
              <button key={p} type="button" disabled={busy} onClick={()=>setChatPrompt(p)}
                style={{ border:'1px solid rgba(0,88,188,0.14)', background:'rgba(0,88,188,0.06)', color:BLUE, borderRadius:999, padding:'8px 12px', fontSize:12, fontWeight:800, cursor:busy?'not-allowed':'pointer', opacity:busy?.6:1 }}>
                {p}
              </button>
            ))}
          </div>
        </section>
      </main>

      {/* ── Input bar (sticky bottom) ── */}
      <div style={{ position:'absolute', left:0, right:0, bottom:0, zIndex:16, maxWidth:820, margin:'0 auto', padding:'0 20px 20px' }}>
        {/* File previews */}
        {attachedFiles.length > 0 && (
          <div style={{ ...glass, borderRadius:20, padding:'10px 14px', marginBottom:8, display:'flex', gap:8, overflowX:'auto', scrollbarWidth:'thin' }}>
            {attachedFiles.map(f => (
              <div key={f.id} style={{ position:'relative', flexShrink:0 }}>
                {f.kind==='image'
                  ? <img src={f.dataUrl} alt={f.name} title={f.name} style={{ width:48, height:48, borderRadius:10, objectFit:'cover' }}/>
                  : <div title={f.name} style={{ width:48, height:48, borderRadius:10, background:'#f0f2fa', border:'1px solid rgba(0,88,188,0.15)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                      {f.kind==='pdf'?'📄':'📃'}
                      <span style={{ fontSize:7, marginTop:2, maxWidth:40, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:MUTED }}>{f.name}</span>
                    </div>}
                <button type="button" onClick={()=>removeFile(f.id)}
                  style={{ position:'absolute', top:-5, right:-5, border:'none', background:'#fff', color:INK, borderRadius:'50%', width:16, height:16, cursor:'pointer', fontSize:10, lineHeight:'16px', padding:0, textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.3)', fontWeight:800 }}>×</button>
              </div>
            ))}
          </div>
        )}

        {/* Input row */}
        <div style={{ ...glass, display:'flex', alignItems:'center', gap:8, padding:8, borderRadius:999 }}>
          <input ref={docInputRef} type="file" accept="image/*,application/pdf,text/plain,text/csv,.csv,.txt,.md" multiple onChange={handleFilesSelect} style={{ display:'none' }}/>
          <input ref={imgInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelect} style={{ display:'none' }}/>

          {/* + Đính kèm */}
          <button type="button" onClick={()=>docInputRef.current?.click()} disabled={busy||attachedFiles.length>=MAX_FILES}
            title={isVi?`Đính kèm PDF / văn bản / ảnh (tối đa ${MAX_FILES})`:`Attach PDF / text / image (max ${MAX_FILES})`}
            style={{ ...btn('#f3f3f5',BLUE), opacity:(busy||attachedFiles.length>=MAX_FILES)?.5:1, cursor:(busy||attachedFiles.length>=MAX_FILES)?'not-allowed':'pointer', fontSize:18, fontWeight:900 }}>
            +
          </button>

          {/* Text input */}
          <input value={chatPrompt} onChange={e=>setChatPrompt(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') submitChat() }}
            placeholder={transcribing?(isVi?'Đang nhận diện giọng nói…':'Transcribing…'):(isVi?'Tâm sự với AI Bác sĩ đa khoa… (Enter để gửi)':'Talk with the GP AI… (Enter to send)')}
            disabled={busy}
            style={{ flex:1, border:'none', background:'transparent', outline:'none', fontSize:15, color:INK, padding:'0 6px' }}/>

          {/* 🖼️ Ảnh */}
          <button type="button" onClick={()=>imgInputRef.current?.click()} disabled={busy||attachedFiles.length>=MAX_FILES}
            title={isVi?'Gửi ảnh để AI phân tích':'Send image for AI analysis'}
            style={{ ...btn(attachedFiles.length>0?'rgba(0,88,188,0.14)':'#f3f3f5', BLUE), opacity:(busy||attachedFiles.length>=MAX_FILES)?.5:1, cursor:(busy||attachedFiles.length>=MAX_FILES)?'not-allowed':'pointer', fontSize:18 }}>
            🖼️
          </button>

          {/* 🎙️ Mic */}
          <button type="button" onClick={toggleMic} disabled={busy&&!recording}
            title={recording?(isVi?'Dừng ghi âm':'Stop recording'):(isVi?'Nói để tâm sự':'Speak to chat')}
            style={{ ...btn(recording?'#ef4444':'#f3f3f5', recording?'#fff':MUTED), opacity:transcribing?.7:1, cursor:transcribing?'wait':'pointer', fontSize:18 }}>
            {transcribing?'⏳':recording?'⏹️':'🎙️'}
          </button>

          {/* ↑ Gửi */}
          <button type="button" onClick={submitChat} disabled={busy||(!chatPrompt.trim()&&attachedFiles.length===0)}
            style={{ ...btn(BLUE,'#fff'), opacity:(busy||(!chatPrompt.trim()&&attachedFiles.length===0))?.45:1, cursor:(busy||(!chatPrompt.trim()&&attachedFiles.length===0))?'not-allowed':'pointer', fontSize:20 }}>
            {busy?'…':'↑'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes gpTypingDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes gpPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </div>
  )
}

function btn(bg, color) {
  return { width:42, height:42, borderRadius:'50%', border:'none', background:bg, color, display:'grid', placeItems:'center', cursor:'pointer', fontSize:20, flexShrink:0 }
}
