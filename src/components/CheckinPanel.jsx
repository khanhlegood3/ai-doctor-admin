import React, { useEffect, useRef, useState } from 'react'
import { PATIENT } from '../data/mockData.js'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext.jsx'
import NavButtons from './NavButtons.jsx'
import { QUICK_PROMPTS } from '../lib/generalPractitionerChat.js'
import {
  getGlobalChatHistory,
  saveGlobalChatHistory,
  ownerKeyOf,
} from '../lib/globalChatbotStorage.js'
import { callGroqChat, useVoiceInput, useTTS, GROQ_VISION_MODEL } from '../lib/groqAiClient.js'
import { MAX_FILES } from '../lib/useGlobalAIChatbotEngine.js'

// Cùng event name với useGlobalAIChatbotEngine (GlobalAIChatbot.jsx / ChatHistoryPanel.jsx)
// và EmotionalCompanionView.jsx → mọi nơi mở song song đều nhận cập nhật realtime,
// không cần đóng/mở lại.
const SYNC_EVENT = 'global-ai-chatbot-sync'

const CHECKIN_SYSTEM_VI = `Bạn là AI Bác sĩ đa khoa ảo trong phần "Symptom & History Check-in" — hỗ trợ thu thập triệu chứng và tiền sử bệnh để xây dựng digital twin cho bệnh nhân.

Vai trò của bạn:
1. Lắng nghe và khai thác kỹ triệu chứng: bắt đầu khi nào, kéo dài bao lâu, mức độ 0-10, sốt/ho/đau/tiêu hóa/giấc ngủ/tâm trạng, thuốc đang dùng, dị ứng, tiền sử bệnh cá nhân và gia đình.
2. Nếu người dùng đính kèm ảnh (vd: vùng da, kết quả xét nghiệm, đơn thuốc) hoặc tài liệu, hãy phân tích kỹ và nêu nhận xét hữu ích.
3. Trả lời các câu hỏi y tế phổ thông rõ ràng, chính xác, dễ hiểu.

Quy tắc:
- Luôn trả lời bằng tiếng Việt có dấu, giọng văn ấm áp, đồng cảm, súc tích.
- Dùng markdown (đậm, danh sách) khi cần cho dễ đọc.
- KHÔNG chẩn đoán bệnh hoặc kê đơn thay bác sĩ — luôn khuyến khích người dùng đặt lịch khám nếu triệu chứng kéo dài, nặng lên hoặc ảnh hưởng sinh hoạt.
- Nếu có dấu hiệu cấp cứu (đau ngực, khó thở nặng, dấu hiệu đột quỵ, co giật, dị ứng nặng, chảy máu không cầm, lú lẫn, nguy cơ tự hại...): khuyên gọi cấp cứu ngay.
- Không nhắc đến tên model, API hoặc chi tiết kỹ thuật nội bộ trong câu trả lời.`

const CHECKIN_SYSTEM_EN = `You are the virtual General Practitioner AI inside "Symptom & History Check-in" — helping collect symptoms and medical history to seed the patient's digital twin.

Your role:
1. Listen closely and probe symptoms: onset, duration, severity 0-10, fever/cough/pain/digestion/sleep/mood, current medications, allergies, and personal/family medical history.
2. If the user attaches images (e.g. skin area, lab results, prescriptions) or documents, analyze them carefully and give a useful assessment.
3. Answer general medical questions clearly, accurately, and helpfully.

Rules:
- Be warm, empathetic, and concise; use markdown (bold, lists) when it helps readability.
- Never diagnose a condition or prescribe treatment — always encourage booking a clinician visit if symptoms persist, worsen, or affect daily activities.
- If a question suggests an emergency (chest pain, severe shortness of breath, stroke signs, seizure, severe allergic reaction, uncontrolled bleeding, confusion, self-harm risk): advise seeking emergency care immediately.
- Never mention model names, APIs, or internal technical details in your reply.`

function makeMsg(role, text, extra = {}) {
  return {
    id: `gp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    role,
    text,
    createdAt: new Date().toISOString(),
    ...extra,
  }
}

function makeWelcome(lang) {
  return {
    id: 'checkin-welcome',
    role: 'assistant',
    text: lang === 'en'
      ? "Hello, I'm your virtual General Practitioner AI. Tell me your symptoms, how you're feeling, when it started, severity, current medicines, allergies, and medical history. You can also talk to me with voice or send photos/documents for analysis."
      : 'Xin chào, tôi là AI Bác sĩ đa khoa ảo. Bạn có thể mô tả triệu chứng, bắt đầu từ khi nào, mức độ nặng, thuốc đang dùng, dị ứng và tiền sử bệnh. Bạn cũng có thể nói chuyện bằng giọng nói hoặc gửi ảnh/tài liệu để tôi phân tích.',
    createdAt: new Date().toISOString(),
  }
}

const Tag = ({ children, color = 'cyan' }) => {
  const colors = {
    cyan:   { bg: 'rgba(0,229,255,0.1)',   color: 'var(--cyan)',   border: 'rgba(0,229,255,0.2)'   },
    violet: { bg: 'rgba(156,111,255,0.1)', color: 'var(--violet)', border: 'rgba(156,111,255,0.2)' },
    green:  { bg: 'rgba(0,230,118,0.1)',   color: 'var(--green)',  border: 'rgba(0,230,118,0.2)'   },
    amber:  { bg: 'rgba(255,183,77,0.1)',  color: 'var(--amber)',  border: 'rgba(255,183,77,0.2)'  },
    red:    { bg: 'rgba(255,82,82,0.1)',   color: 'var(--red)',    border: 'rgba(255,82,82,0.2)'   },
  }
  const c = colors[color]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '4px 11px',
      borderRadius: 4, fontSize: 11, fontFamily: 'var(--font-mono)',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>{children}</span>
  )
}

const Row = ({ k, v, vColor }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '7px 0', borderBottom: '1px solid var(--border)',
  }}>
    <span style={{ fontSize: 11, color: 'var(--text3)' }}>{k}</span>
    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500, color: vColor || 'var(--cyan)' }}>{v}</span>
  </div>
)

const GP_PLAYLIST_EMBED_URL = 'https://www.youtube.com/embed/videoseries?list=PLhPgpmsoyA4GrZ5mGrOPyf1wb1Ke1Zw8p'

const Card = ({ title, children }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
    <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 12 }}>{title}</div>
    {children}
  </div>
)

export default function CheckinPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { t, lang } = useApp()
  const { user } = useAuth()
  const userKey = user?.uuid || null
  const ownerKey = ownerKeyOf(userKey)
  const isVi = lang !== 'en'

  const [symptomPrompt, setSymptomPrompt] = useState('')
  const [chatMessages, setChatMessages] = useState(() => [makeWelcome(lang)])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [selectedMessageIds, setSelectedMessageIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([])
  const [speakingMsgId, setSpeakingMsgId] = useState(null)

  const instanceIdRef = useRef(`checkin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const skipBroadcastRef = useRef(false)
  const docInputRef = useRef(null)
  const imageInputRef = useRef(null)
  // Tự động đọc to câu trả lời của AI ngay sau khi gửi tin (không cần bấm nút 🔊).
  // Chỉ áp dụng cho tin nhắn do CHÍNH mình gửi (không tự đọc khi nhận sync từ nơi khác).
  const autoSpeakNextRef = useRef(false)
  const lastAutoSpokenIdRef = useRef(null)

  const { recording, transcribing, toggle: toggleMic } = useVoiceInput(
    (text) => setSymptomPrompt(prev => (prev ? `${prev} ${text}` : text)),
    isVi ? 'vi' : 'en',
  )
  const { speaking, speak, stop: stopSpeaking } = useTTS(isVi ? 'vi' : 'en')
  useEffect(() => { if (!speaking) setSpeakingMsgId(null) }, [speaking])

  // Sau khi AI trả lời xong (busy chuyển về false) và tin nhắn đó là do mình vừa gửi,
  // tự động phát giọng đọc câu trả lời mới nhất — không cần bấm nút 🔊 nữa.
  useEffect(() => {
    if (busy || !historyLoaded || !autoSpeakNextRef.current) return
    const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant' && m.id !== 'checkin-welcome')
    if (!lastAssistant || lastAssistant.id === lastAutoSpokenIdRef.current) return
    lastAutoSpokenIdRef.current = lastAssistant.id
    autoSpeakNextRef.current = false
    setSpeakingMsgId(lastAssistant.id)
    speak(lastAssistant.text)
  }, [busy, historyLoaded, chatMessages, speak])

  useEffect(() => {
    let cancelled = false
    setHistoryLoaded(false)
    ;(async () => {
      const saved = await getGlobalChatHistory(userKey)
      if (cancelled) return
      setChatMessages(saved.length > 0 ? saved : [makeWelcome(lang)])
      setHistoryLoaded(true)
    })()
    return () => { cancelled = true }
  }, [userKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onSync = (event) => {
      const detail = event.detail || {}
      if (detail.ownerKey !== ownerKey) return
      if (detail.instanceId === instanceIdRef.current) return
      skipBroadcastRef.current = true
      setChatMessages(detail.messages || [])
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [ownerKey])

  useEffect(() => {
    if (!historyLoaded) return
    saveGlobalChatHistory(userKey, chatMessages)
    if (skipBroadcastRef.current) {
      skipBroadcastRef.current = false
      return
    }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, {
      detail: { ownerKey, messages: chatMessages, instanceId: instanceIdRef.current },
    }))
  }, [chatMessages, historyLoaded, userKey, ownerKey])

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const readFileAsText = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsText(file, 'utf-8')
  })
  const isTextLikeFile = (file) =>
    file.type === 'text/plain' || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel' ||
    /\.(txt|csv|md)$/i.test(file.name || '')

  const handleFilesSelect = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return

    const room = MAX_FILES - attachedFiles.length
    if (room <= 0) {
      window.alert(isVi ? `Bạn chỉ có thể đính kèm tối đa ${MAX_FILES} file cùng lúc.` : `You can attach up to ${MAX_FILES} files at once.`)
      return
    }
    const toProcess = files.slice(0, room)
    if (files.length > room) {
      window.alert(isVi ? `Chỉ ${room} file đầu tiên được thêm vào (tối đa ${MAX_FILES} file).` : `Only the first ${room} files were added (max ${MAX_FILES}).`)
    }

    const newEntries = []
    for (const file of toProcess) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      try {
        if (file.type.startsWith('image/')) {
          const dataUrl = await readFileAsDataUrl(file)
          newEntries.push({ id, kind: 'image', dataUrl, base64: dataUrl.split(',')[1] || '', mimeType: file.type || 'image/jpeg', name: file.name })
        } else if (file.type === 'application/pdf') {
          const dataUrl = await readFileAsDataUrl(file)
          newEntries.push({ id, kind: 'pdf', dataUrl, base64: dataUrl.split(',')[1] || '', mimeType: 'application/pdf', name: file.name })
        } else if (isTextLikeFile(file)) {
          const textContent = await readFileAsText(file)
          newEntries.push({ id, kind: 'text', name: file.name, mimeType: file.type || 'text/plain', textContent })
        } else {
          console.warn('Unsupported file type for checkin chat attachment:', file.type, file.name)
        }
      } catch (err) {
        console.error('Failed to read file', file.name, err)
      }
    }
    if (newEntries.length) setAttachedFiles(prev => [...prev, ...newEntries])
  }
  const removeAttachedFile = (id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))

  const submitSymptomPrompt = async (rawPrompt = symptomPrompt) => {
    const prompt = rawPrompt.trim()
    const files = attachedFiles
    if (!prompt && files.length === 0) return
    if (busy) return

    setSymptomPrompt('')
    setAttachedFiles([])
    setBusy(true)
    autoSpeakNextRef.current = true

    const userMsg = makeMsg('user', prompt || (isVi ? `[Đã gửi ${files.length} file]` : `[Sent ${files.length} file(s)]`), {
      imageDataUrls: files.filter(f => f.kind === 'image' || f.kind === 'pdf').map(f => ({ dataUrl: f.dataUrl, kind: f.kind, name: f.name })),
      fileNames: files.filter(f => f.kind === 'text').map(f => f.name),
    })
    setChatMessages(prev => [...prev, userMsg])

    const systemPrompt = isVi ? CHECKIN_SYSTEM_VI : CHECKIN_SYSTEM_EN

    try {
      let answer = ''

      if (files.length > 0) {
        const visionFiles = files.filter(f => f.kind === 'image' || f.kind === 'pdf')
        const textBlock = files.filter(f => f.kind === 'text').map(f => `--- ${f.name} ---\n${f.textContent}`).join('\n\n')
        const defaultPrompt = isVi
          ? 'Hãy phân tích sâu (các) tài liệu/hình ảnh này (đặc biệt nếu là tài liệu y tế: X-quang, CT, MRI, kết quả xét nghiệm, đơn thuốc...). Mô tả những gì quan sát được, lưu ý điểm bất thường nếu có, và đưa ra nhận xét hữu ích.'
          : 'Please analyze these documents/images in depth (especially if medical: X-ray, CT, MRI, lab result, prescription...). Describe what you observe, note any abnormalities, and give a helpful assessment.'
        const instruction = (prompt || defaultPrompt) + (textBlock ? `\n\n---\n${textBlock}` : '')

        if (visionFiles.length > 0) {
          const GROQ_MAX_IMAGES_PER_REQUEST = 5
          const batches = []
          for (let i = 0; i < visionFiles.length; i += GROQ_MAX_IMAGES_PER_REQUEST) {
            batches.push(visionFiles.slice(i, i + GROQ_MAX_IMAGES_PER_REQUEST))
          }
          const batchAnswers = []
          for (let b = 0; b < batches.length; b++) {
            const batch = batches[b]
            const batchInstruction = batches.length > 1
              ? `${instruction}\n\n${isVi
                  ? `(Đây là nhóm ảnh ${b + 1}/${batches.length}. Chỉ phân tích các ảnh trong nhóm này.)`
                  : `(This is image batch ${b + 1}/${batches.length}. Only analyze the images in this batch.)`}`
              : instruction
            const res = await fetch('/api/groq-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: GROQ_VISION_MODEL,
                max_tokens: 1024,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: [
                    ...batch.map(f => ({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } })),
                    { type: 'text', text: batchInstruction },
                  ] },
                ],
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error?.message || `Groq Vision ${res.status}`)
            batchAnswers.push(data?.choices?.[0]?.message?.content || '')
          }
          answer = batches.length > 1
            ? batchAnswers.map((a, i) => `${isVi ? `Nhóm ảnh ${i + 1}/${batches.length}: ` : `Image batch ${i + 1}/${batches.length}: `}\n${a}`).join('\n\n---\n\n')
            : batchAnswers[0]
        } else {
          answer = await callGroqChat([{ role: 'user', content: instruction }], systemPrompt)
        }
      } else {
        const history = chatMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({ role: m.role, content: m.text }))
        history.push({ role: 'user', content: prompt })
        answer = await callGroqChat(history, systemPrompt)
      }

      setChatMessages(prev => [...prev, makeMsg('assistant', answer || (isVi ? 'Xin lỗi, tôi chưa có phản hồi phù hợp.' : 'Sorry, I could not generate a good answer.'))])
    } catch (error) {
      console.error('Checkin GP AI error:', error)
      setChatMessages(prev => [...prev, makeMsg('assistant', isVi
        ? 'Xin lỗi, tôi đang gặp sự cố kết nối AI. Vui lòng thử lại sau ít phút.'
        : 'Sorry, I ran into an AI connection issue. Please try again in a moment.')])
    } finally {
      setBusy(false)
    }
  }

  const toggleSpeak = (msgId, text) => {
    if (speakingMsgId === msgId && speaking) { stopSpeaking(); setSpeakingMsgId(null); return }
    stopSpeaking()
    setSpeakingMsgId(msgId)
    speak(text)
  }

  const toggleMessageSelection = (id) => {
    setSelectedMessageIds(prev => (
      prev.includes(id)
        ? prev.filter(messageId => messageId !== id)
        : [...prev, id]
    ))
  }

  const deleteMessage = (id) => {
    setChatMessages(prev => prev.filter(message => message.id !== id))
    setSelectedMessageIds(prev => prev.filter(messageId => messageId !== id))
  }

  const deleteSelectedMessages = () => {
    if (selectedMessageIds.length === 0) return
    setChatMessages(prev => prev.filter(message => !selectedMessageIds.includes(message.id)))
    setSelectedMessageIds([])
  }

  const resetChatHistory = () => {
    stopSpeaking()
    autoSpeakNextRef.current = false
    lastAutoSpokenIdRef.current = null
    setChatMessages([makeWelcome(lang)])
    setSelectedMessageIds([])
    setAttachedFiles([])
  }

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{t('checkinTitle')}</h2>
          <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4 }}>Seed data extraction for digital twin construction</p>
        </div>
        <Tag color="violet">{t('seedCollection')}</Tag>
      </div>

      <Card title={lang === 'en' ? 'Virtual General Practitioner AI Agent' : 'AI Bác sĩ đa khoa ảo'}>
        <div className="gp-agent-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>
                  {lang === 'en' ? 'General symptom prompt' : 'Nhập prompt khai báo triệu chứng'}
                </div>
                <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
                  {lang === 'en'
                    ? 'Chat with a virtual General Practitioner to describe any symptom: fever, pain, cough, digestion, sleep, mood, medications, allergies, or medical history. Talk by voice, or attach photos/documents for deep AI analysis.'
                    : 'Chat với AI Bác sĩ đa khoa để mô tả mọi triệu chứng: sốt, đau, ho, tiêu hóa, giấc ngủ, tâm trạng, thuốc, dị ứng hoặc tiền sử bệnh. Bạn có thể nói bằng giọng nói, hoặc đính kèm ảnh/tài liệu để AI phân tích sâu.'}
                </p>
              </div>
              <Tag color="green">GENERAL PRACTITIONER AI</Tag>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ color: 'var(--text3)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                {lang === 'en'
                  ? `${chatMessages.length} messages · Groq AI · voice · files · auto voice reply · synced with Global Chat`
                  : `${chatMessages.length} tin nhắn · Groq AI · giọng nói · file · tự động đọc trả lời · đồng bộ với Global Chat`}
                {busy && (lang === 'en' ? ' · AI thinking…' : ' · AI đang soạn…')}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={deleteSelectedMessages}
                  disabled={selectedMessageIds.length === 0}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: selectedMessageIds.length ? 'rgba(255,82,82,0.12)' : 'rgba(255,255,255,0.03)',
                    color: selectedMessageIds.length ? 'var(--red)' : 'var(--text3)',
                    cursor: selectedMessageIds.length ? 'pointer' : 'not-allowed',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {lang === 'en' ? `Delete selected (${selectedMessageIds.length})` : `Xóa đã chọn (${selectedMessageIds.length})`}
                </button>
                <button
                  type="button"
                  onClick={resetChatHistory}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text2)',
                    cursor: 'pointer',
                    fontSize: 10,
                    fontWeight: 700,
                  }}
                >
                  {lang === 'en' ? 'Reset history' : 'Tạo lại lịch sử'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
              {chatMessages.map((message, index) => {
                const isUser = message.role === 'user'
                const selected = selectedMessageIds.includes(message.id)
                return (
                  <div
                    key={message.id || `${message.role}-${index}`}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      width: 'min(100%, 88%)',
                      display: 'flex',
                      gap: 8,
                      alignItems: 'flex-start',
                      flexDirection: isUser ? 'row-reverse' : 'row',
                    }}
                  >
                    <button
                      type="button"
                      aria-label={selected ? 'Uncheck chat message' : 'Check chat message'}
                      title={selected ? (lang === 'en' ? 'Uncheck' : 'Bỏ chọn') : (lang === 'en' ? 'Check to delete' : 'Chọn để xóa')}
                      onClick={() => toggleMessageSelection(message.id)}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        border: `1px solid ${selected ? 'var(--green)' : 'var(--border2)'}`,
                        background: selected ? 'rgba(0,230,118,0.16)' : 'rgba(255,255,255,0.04)',
                        color: selected ? 'var(--green)' : 'var(--text3)',
                        cursor: 'pointer',
                        flexShrink: 0,
                        fontSize: 13,
                        fontWeight: 900,
                        lineHeight: 1,
                      }}
                    >
                      {selected ? '✓' : ''}
                    </button>

                    <div
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                        background: selected
                          ? 'rgba(0,230,118,0.08)'
                          : isUser ? 'rgba(0,229,255,0.12)' : 'rgba(156,111,255,0.12)',
                        border: `1px solid ${selected ? 'rgba(0,230,118,0.28)' : isUser ? 'rgba(0,229,255,0.24)' : 'rgba(156,111,255,0.24)'}`,
                        color: 'var(--text)',
                        fontSize: 12,
                        lineHeight: 1.65,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: isUser ? 'var(--cyan)' : 'var(--violet)' }}>
                          {isUser ? (lang === 'en' ? 'YOU' : 'BẠN') : 'AI GENERAL PRACTITIONER'}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteMessage(message.id)}
                          title={lang === 'en' ? 'Delete this message' : 'Xóa tin nhắn này'}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text3)',
                            cursor: 'pointer',
                            fontSize: 12,
                            fontWeight: 800,
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>

                      {message.imageDataUrls?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.text ? 8 : 0 }}>
                          {message.imageDataUrls.map((img, i) => (
                            img.kind === 'pdf' ? (
                              <div key={i} style={{ width: 52, height: 52, borderRadius: 10, background: 'rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                📄
                                <span style={{ fontSize: 8, marginTop: 2, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</span>
                              </div>
                            ) : (
                              <img key={i} src={img.dataUrl} alt={img.name || 'attached'} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                            )
                          ))}
                        </div>
                      )}
                      {message.fileNames?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.text ? 8 : 0 }}>
                          {message.fileNames.map((name, i) => (
                            <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.08)' }}>📃 {name}</span>
                          ))}
                        </div>
                      )}

                      {message.text}

                      {!isUser && (
                        <div style={{ marginTop: 6 }}>
                          <button
                            type="button"
                            onClick={() => toggleSpeak(message.id, message.text)}
                            title={speakingMsgId === message.id && speaking ? (lang === 'en' ? 'Stop' : 'Dừng đọc') : (lang === 'en' ? 'Read aloud' : 'Đọc to')}
                            style={{
                              border: '1px solid var(--border)',
                              background: 'rgba(255,255,255,0.04)',
                              color: 'var(--violet)',
                              borderRadius: 8,
                              padding: '3px 8px',
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            {speakingMsgId === message.id && speaking ? '⏸ ' + (lang === 'en' ? 'Stop' : 'Dừng') : '🔊 ' + (lang === 'en' ? 'Listen' : 'Nghe')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {busy && (
                <div style={{ alignSelf: 'flex-start', width: 'min(100%, 88%)', padding: '10px 12px', borderRadius: '14px 14px 14px 3px', background: 'rgba(156,111,255,0.12)', border: '1px solid rgba(156,111,255,0.24)' }}>
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', display: 'inline-block', animation: 'checkinTypingDot 1.1s ease-in-out infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', display: 'inline-block', animation: 'checkinTypingDot 1.1s 0.2s ease-in-out infinite' }} />
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--violet)', display: 'inline-block', animation: 'checkinTypingDot 1.1s 0.4s ease-in-out infinite' }} />
                  </span>
                </div>
              )}
            </div>

            {attachedFiles.length > 0 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
                {attachedFiles.map(f => (
                  <div key={f.id} style={{ position: 'relative', flexShrink: 0 }}>
                    {f.kind === 'image' ? (
                      <img src={f.dataUrl} alt={f.name} title={f.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div title={f.name} style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {f.kind === 'pdf' ? '📄' : '📃'}
                        <span style={{ fontSize: 7, marginTop: 2, maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text3)' }}>{f.name}</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachedFile(f.id)}
                      title={lang === 'en' ? 'Remove file' : 'Bỏ file'}
                      style={{ position: 'absolute', top: -6, right: -6, border: 'none', background: '#fff', color: '#1a2035', borderRadius: '50%', width: 16, height: 16, cursor: 'pointer', fontSize: 10, lineHeight: '16px', padding: 0, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', fontWeight: 800 }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input ref={docInputRef} type="file" accept="application/pdf,text/plain,text/csv,.csv,.txt,.md" multiple onChange={handleFilesSelect} style={{ display: 'none' }} />
              <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelect} style={{ display: 'none' }} />

              <textarea
                value={symptomPrompt}
                onChange={e => setSymptomPrompt(e.target.value)}
                onKeyDown={e => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitSymptomPrompt()
                }}
                placeholder={lang === 'en'
                  ? 'Example: I have fever, cough, headache, stomach pain, insomnia, or anxiety. It started 3 days ago...'
                  : 'Ví dụ: Tôi bị sốt, ho, đau đầu, đau bụng, mất ngủ hoặc lo lắng. Triệu chứng bắt đầu 3 ngày trước...'}
                rows={4}
                disabled={busy}
                style={{
                  width: '100%',
                  resize: 'vertical',
                  minHeight: 104,
                  borderRadius: 12,
                  border: '1px solid var(--border2)',
                  background: 'rgba(0,0,0,0.22)',
                  color: 'var(--text)',
                  padding: 12,
                  outline: 'none',
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  opacity: busy ? 0.7 : 1,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ color: 'var(--text3)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  {lang === 'en' ? 'Press Ctrl/⌘ + Enter to send' : 'Nhấn Ctrl/⌘ + Enter để gửi'}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => docInputRef.current?.click()}
                    disabled={busy || attachedFiles.length >= MAX_FILES}
                    title={lang === 'en' ? `Attach files (PDF, text, CSV) — up to ${MAX_FILES}` : `Đính kèm file (PDF, văn bản, CSV) — tối đa ${MAX_FILES}`}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1px solid var(--border2)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text2)',
                      cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer',
                      opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1,
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    📎
                  </button>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={busy || attachedFiles.length >= MAX_FILES}
                    title={lang === 'en' ? `Upload images for deep AI analysis — up to ${MAX_FILES}` : `Tải ảnh để AI phân tích sâu — tối đa ${MAX_FILES}`}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${attachedFiles.length ? 'rgba(0,230,118,0.4)' : 'var(--border2)'}`,
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text2)',
                      cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer',
                      opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1,
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    🖼️
                  </button>
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={busy && !recording}
                    title={recording ? (lang === 'en' ? 'Stop recording' : 'Dừng ghi âm') : (lang === 'en' ? 'Speak to describe symptoms' : 'Nói để khai báo triệu chứng')}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${recording ? 'var(--red)' : 'var(--border2)'}`,
                      background: recording ? 'linear-gradient(135deg, var(--red), #dc2626)' : 'rgba(255,255,255,0.04)',
                      color: recording ? '#fff' : 'var(--text2)',
                      cursor: transcribing ? 'wait' : 'pointer',
                      fontSize: 14,
                      fontWeight: 800,
                    }}
                  >
                    {transcribing ? '⏳' : recording ? '⏹️' : '🎙️'}
                  </button>
                  <button
                    type="button"
                    onClick={() => submitSymptomPrompt()}
                    disabled={busy || (!symptomPrompt.trim() && attachedFiles.length === 0)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 10,
                      border: 'none',
                      background: (symptomPrompt.trim() || attachedFiles.length > 0) && !busy
                        ? 'linear-gradient(135deg, var(--cyan2), var(--violet2))'
                        : 'rgba(255,255,255,0.06)',
                      color: (symptomPrompt.trim() || attachedFiles.length > 0) && !busy ? '#fff' : 'var(--text3)',
                      cursor: busy || (!symptomPrompt.trim() && attachedFiles.length === 0) ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {busy
                      ? (lang === 'en' ? 'Sending…' : 'Đang gửi…')
                      : (lang === 'en' ? 'Send to GP AI Doctor →' : 'Gửi cho AI Bác sĩ đa khoa →')}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ padding: 12, borderRadius: 12, background: 'rgba(255,183,77,0.08)', border: '1px solid rgba(255,183,77,0.18)' }}>
              <div style={{ color: 'var(--amber)', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                {lang === 'en' ? 'Safety note' : 'Lưu ý an toàn'}
              </div>
              <p style={{ color: 'var(--text2)', fontSize: 11, lineHeight: 1.65 }}>
                {lang === 'en'
                  ? 'This check-in supports symptom collection and is not a diagnosis. Seek urgent care for chest pain, severe shortness of breath, stroke signs, severe allergic reaction, uncontrolled bleeding, confusion, or self-harm risk.'
                  : 'Phần check-in này hỗ trợ thu thập triệu chứng, không phải chẩn đoán. Hãy đi cấp cứu nếu đau ngực, khó thở nặng, dấu hiệu đột quỵ, dị ứng nặng, chảy máu không cầm, lú lẫn hoặc nguy cơ tự hại.'}
              </p>
            </div>

            <div style={{ padding: 12, borderRadius: 12, background: 'var(--surface2)', border: '1px solid var(--border)' }}>
              <div style={{ color: 'var(--cyan)', fontSize: 11, fontWeight: 800, marginBottom: 8 }}>
                {lang === 'en' ? 'Quick prompts' : 'Prompt gợi ý'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(QUICK_PROMPTS[lang] || QUICK_PROMPTS.vi).map(prompt => (
                  <button
                    key={prompt}
                    type="button"
                    disabled={busy}
                    onClick={() => setSymptomPrompt(prompt)}
                    style={{
                      textAlign: 'left',
                      padding: 9,
                      borderRadius: 9,
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.03)',
                      color: 'var(--text2)',
                      cursor: busy ? 'not-allowed' : 'pointer',
                      opacity: busy ? 0.6 : 1,
                      fontSize: 11,
                      lineHeight: 1.45,
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card title={lang === 'en' ? 'Suggested activity' : 'Hoạt động đề xuất'}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: 16, alignItems: 'center' }}>
          <div>
            <div style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>
              {lang === 'en' ? 'Play the GP AI emotional-care playlist inside Symptom Check-in' : 'Phát playlist chăm sóc tinh thần cùng AI Bác sĩ đa khoa ngay trong Kiểm tra triệu chứng'}
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6, lineHeight: 1.65 }}>
              {lang === 'en'
                ? 'Use these relaxation and recovery videos while you describe symptoms, mood, sleep, stress, medicines, allergies, or medical history to the same GP AI chat.'
                : 'Bạn có thể vừa xem video thư giãn/phục hồi, vừa mô tả triệu chứng, tâm trạng, giấc ngủ, stress, thuốc, dị ứng hoặc tiền sử bệnh cho cùng AI Bác sĩ đa khoa.'}
            </p>
          </div>
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', background: '#000' }}>
            <iframe
              title={lang === 'en' ? 'GP AI suggested activity playlist' : 'Playlist hoạt động đề xuất AI Bác sĩ đa khoa'}
              src={GP_PLAYLIST_EMBED_URL}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Card title={t('personalHistory')}>
          <Row k={t('name')}     v={PATIENT.name} />
          <Row k="Age"           v={PATIENT.age} />
          <Row k="Location"      v={PATIENT.location} />
          <Row k="Smoker"        v={PATIENT.smoker} vColor="var(--amber)" />
          <Row k="Exercise"      v={PATIENT.exercise} vColor="var(--green)" />
          <Row k="BMI"           v={PATIENT.bmi} />
        </Card>
        <Card title={t('familyHistory')}>
          <Row k={t('relation_father')}  v={PATIENT.familyHistory.father}  vColor="var(--red)" />
          <Row k={t('relation_mother')}  v={PATIENT.familyHistory.mother}  vColor="var(--amber)" />
          <Row k={t('relation_sibling')} v={PATIENT.familyHistory.sibling} vColor="var(--green)" />
          <Row k="BRCA"    v={PATIENT.genomics.brca}         vColor="var(--green)" />
          <Row k="EGFR"    v={PATIENT.genomics.egfr}         vColor="var(--red)" />
          <Row k="T790M"   v={PATIENT.genomics.t790m}        vColor="var(--amber)" />
        </Card>
      </div>

      <Card title={t('currentSymptoms')}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {PATIENT.symptoms.map(s => (
            <Tag key={s} color={s.includes('cough') ? 'red' : 'amber'}>{s}</Tag>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
          Duration: {PATIENT.symptomDuration} · Severity: {PATIENT.symptomSeverity}
        </div>
      </Card>

      <Card title={t('envSignals')}>
        {[
          { icon: '📍', text: `HCMC Air Quality Index: ${PATIENT.aqi} · Unhealthy for Sensitive Groups`, color: 'var(--amber)' },
          { icon: '📰', text: 'New EGFR inhibitor trial results — Nature Medicine, May 2026', color: 'var(--cyan)' },
          { icon: '💊', text: PATIENT.currentDrug, color: 'var(--green)' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6, background: 'var(--surface2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0,
            }}>{item.icon}</div>
            <span style={{ fontSize: 12, color: item.color }}>{item.text}</span>
          </div>
        ))}
      </Card>

      <NavButtons onNext={onNext} nextLabel={nextLabel || t('familyTree')} onPrev={onPrev} prevLabel={prevLabel} />

      <style>{`
        @keyframes checkinTypingDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  )
}
