// src/lib/useGlobalAIChatbotEngine.js
// Toàn bộ "bộ não" của Global AI Chatbot (state + xử lý gửi tin nhắn, đính kèm file,
// giọng nói, lưu lịch sử...) được tách ra từ src/components/GlobalAIChatbot.jsx thành
// 1 hook dùng chung. Mục đích: widget chatbot góc màn hình (GlobalAIChatbot.jsx) và
// trang Lịch sử Chat với AI (ChatHistoryPanel.jsx) dùng CHUNG một bộ logic + CHUNG một
// kho lưu trữ (globalChatbotStorage.js) — nên 2 nơi luôn đồng bộ song song: gửi tin ở
// trang nào cũng được lưu vào đúng 1 nơi và nơi còn lại sẽ thấy ngay khi mở lại.

import { useEffect, useRef, useState } from 'react'
import { callGroqChat, useVoiceInput, useTTS } from './groqAiClient.js'
import { getDeterministicFallbackReply } from './huggingFaceTransformersChat.js'
import { getGlobalChatHistory, saveGlobalChatHistory, ownerKeyOf, GLOBAL_CHATBOT_SYNC_EVENT } from './globalChatbotStorage.js'
import { extractPdfTextForInBody, pdfPageToImageForInBody } from './inbodyImageConvert.js'

// Sự kiện đồng bộ TRỰC TIẾP (không cần remount) giữa mọi nơi đang dùng hook này cùng lúc —
// ví dụ: popup chatbot góc màn hình (GlobalAIChatbot.jsx) và trang Lịch sử Chat với AI
// (ChatHistoryPanel.jsx) có thể cùng mở 1 lúc. Gửi tin ở 1 trong 2 nơi sẽ phát sự kiện này,
// nơi còn lại lắng nghe và cập nhật `messages` ngay lập tức — không cần đóng/mở lại popup.
const SYNC_EVENT = GLOBAL_CHATBOT_SYNC_EVENT

export const MAX_FILES = 10

export const quickPrompts = [
  'Cách tải hồ sơ y tế?',
  'Làm sao in kết quả?',
  'AI Healthcare Vision dùng thế nào?',
]

const SYSTEM_PROMPT_VI = `Bạn là chatbot AI chung 🤗 của website Consensus Doctor — một trợ lý thân thiện, đa năng.

Vai trò của bạn:
1. Chào hỏi người dùng và hướng dẫn cách sử dụng website: Upload Records (tải PDF/ảnh/DICOM), AI Healthcare Vision (xem/so sánh ảnh y tế), AI InBody Portal (chỉ số cơ thể), Family Medical Tree (gia phả bệnh lý), Print Portal (in tài liệu), Profile (hồ sơ cá nhân, giao diện, ngôn ngữ).
2. Trả lời các câu hỏi y tế và sức khoẻ phổ thông một cách rõ ràng, chính xác, dễ hiểu — giống một trợ lý kiến thức y tế đáng tin cậy.
3. Trò chuyện tự nhiên về các chủ đề khác nếu người dùng hỏi.

Quy tắc:
- Luôn trả lời bằng tiếng Việt có dấu, giọng văn thân thiện, ấm áp.
- Súc tích nhưng đầy đủ; dùng markdown (đậm, danh sách) khi cần cho dễ đọc.
- Không bao giờ chẩn đoán bệnh hoặc kê đơn thay bác sĩ — luôn khuyến khích người dùng tham khảo bác sĩ/chuyên gia y tế cho các quyết định sức khoẻ cá nhân, đặc biệt với triệu chứng nghiêm trọng.
- Nếu câu hỏi có dấu hiệu cấp cứu (đau ngực, khó thở, ngất, co giật, chảy máu nhiều...), hãy khuyên người dùng đi cấp cứu ngay.
- Không nhắc đến tên model, API, hệ thống nội bộ hoặc bất kỳ chi tiết kỹ thuật nào trong câu trả lời.`

const SYSTEM_PROMPT_EN = `You are 🤗, the general AI chatbot of the Consensus Doctor website — a friendly, versatile assistant.

Your role:
1. Greet users and guide them on how to use the website: Upload Records (PDF/image/DICOM upload), AI Healthcare Vision (medical image viewing/comparison), AI InBody Portal (body composition), Family Medical Tree (family medical history), Print Portal (printing documents), Profile (personal info, theme, language).
2. Answer general medical and health questions clearly, accurately, and helpfully — like a trustworthy medical knowledge assistant.
3. Chat naturally about other topics if asked.

Rules:
- Be concise but thorough; use markdown (bold, lists) when helpful for readability.
- Never diagnose conditions or prescribe treatment — always encourage users to consult a doctor or medical professional for personal health decisions, especially for serious symptoms.
- If a question suggests an emergency (chest pain, difficulty breathing, fainting, seizures, heavy bleeding...), advise the user to seek emergency care immediately.
- Never mention model names, APIs, internal systems, or any technical details in your reply.`

// userKey: user?.uuid || null — field nhận diện thống nhất cho mọi loại user (guest hay đã đăng nhập).
// activePanelLabel: tên mục đang xem trên website, dùng để cá nhân hoá vài câu trả lời nhanh.
// isVi: ngôn ngữ hiện tại.
// onMessagesChange: callback tuỳ chọn — gọi mỗi khi `messages` đổi (đã nạp xong lịch sử),
//   dùng để nơi gọi (vd ChatHistoryPanel) tự refresh lại calendar/nhóm-theo-ngày của nó.
// audioElementRef: <audio> element (tuỳ chọn) — dùng để phát TTS ổn định hơn trên
//   mobile/Safari (unlock âm thanh qua đúng 1 element cố định thay vì tạo Audio() mới
//   mỗi lần). Nơi gọi có thể render <audio ref={audioElementRef} /> và truyền vào đây.
// autoSubmitVoice: khi true, kết quả ghi âm (transcript) được GỬI THẲNG luôn
//   (gọi submitQuestion ngay) thay vì chỉ điền vào ô nhập để người dùng sửa lại
//   trước — dùng cho chế độ "chỉ trao đổi thoại" (voice-only), nơi không có ô
//   chatbox hiển thị để sửa chữ. Nội dung vẫn được lưu vào CÙNG kho lưu trữ +
//   phát CÙNG sự kiện đồng bộ (SYNC_EVENT) như chế độ thường, nên nếu người
//   dùng mở popup chat đầy đủ sau đó, toàn bộ đoạn hội thoại thoại đã có sẵn.
export function useGlobalAIChatbotEngine({ userKey, activePanelLabel, isVi, onMessagesChange, audioElementRef, autoSubmitVoice = false }) {
  const systemPrompt = isVi ? SYSTEM_PROMPT_VI : SYSTEM_PROMPT_EN

  const [input, setInput] = useState('')
  const [status, setStatus] = useState(isVi ? 'Sẵn sàng' : 'Ready')
  const [mode, setMode] = useState('idle')
  const [busy, setBusy] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([]) // [{ id, kind: 'image'|'pdf'|'text', dataUrl, base64, mimeType, name, textContent }]
  const [messages, setMessages] = useState(() => [{
    id: 'hello',
    role: 'assistant',
    text: isVi
      ? 'Xin chào! Tôi là trợ lý AI chung của Consensus Doctor. Tôi có thể chào hỏi, trả lời câu hỏi y tế và phổ thông, hướng dẫn tải hồ sơ, phân tích ảnh, InBody, gia phả bệnh lý hoặc Print Portal. Bạn cũng có thể nói chuyện bằng giọng nói 🎙️ hoặc nghe tôi đọc to câu trả lời 🔊.'
      : "Hi! I'm Consensus Doctor's general AI assistant. I can chat, answer health and general questions, and guide you through uploading records, image analysis, InBody, family medical tree, or Print Portal. You can also talk to me with voice 🎙️ or have replies read aloud 🔊.",
  }])

  const {
    speaking, speak, stop: stopSpeaking,
    paused: speechPaused, pause: pauseSpeaking, resume: resumeSpeaking, replay: replaySpeaking,
    volume: speechVolume, setVolume: setSpeechVolume,
    rate: speechRate, setRate: setSpeechRate, hasReplay: hasSpeechReplay,
  } = useTTS(isVi ? 'vi' : 'en', audioElementRef)

  // Tự động đọc to câu trả lời của AI ngay sau khi gửi tin (không cần bấm nút 🔊) —
  // chỉ áp dụng cho tin nhắn do CHÍNH mình vừa gửi (không tự đọc khi nhận sync từ nơi khác).
  const autoSpeakNextRef = useRef(false)
  const lastAutoSpokenIdRef = useRef(null)
  useEffect(() => {
    if (busy || !historyLoaded || !autoSpeakNextRef.current) return
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.id !== 'hello')
    if (!lastAssistant || lastAssistant.id === lastAutoSpokenIdRef.current) return
    lastAutoSpokenIdRef.current = lastAssistant.id
    autoSpeakNextRef.current = false
    speak(lastAssistant.text)
  }, [busy, historyLoaded, messages, speak])

  // Giữ tham chiếu tới bản `submitQuestion` mới nhất (được định nghĩa bên dưới,
  // sau `handleTranscript`) để `handleTranscript` có thể gọi thẳng trong chế độ
  // autoSubmitVoice mà không cần khai báo lại thứ tự hàm trong file.
  const submitQuestionRef = useRef(null)

  const handleTranscript = (text) => {
    if (autoSubmitVoice) {
      submitQuestionRef.current?.(text)
      return
    }
    setInput(prev => (prev ? `${prev} ${text}` : text))
  }
  const { recording, transcribing, toggle: toggleMic, error: voiceError } = useVoiceInput(handleTranscript, isVi ? 'vi' : 'en')

  // ID riêng cho mỗi instance hook (mỗi nơi dùng hook này) để tự phân biệt sự kiện do
  // chính mình phát ra (bỏ qua) với sự kiện do nơi khác phát ra (cần cập nhật theo).
  const instanceIdRef = useRef(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const skipNextBroadcastRef = useRef(false)
  const ownerKey = ownerKeyOf(userKey)

  // Nạp lịch sử chat đã lưu của user (cùng kho IndexedDB cho mọi nơi dùng hook này).
  useEffect(() => {
    let cancelled = false
    setHistoryLoaded(false)
    ;(async () => {
      const saved = await getGlobalChatHistory(userKey)
      if (cancelled) return
      if (saved.length > 0) setMessages(saved)
      setHistoryLoaded(true)
    })()
    return () => { cancelled = true }
  }, [userKey])

  // Lắng nghe tin nhắn mới từ nơi khác (cùng userKey) đang mở song song — cập nhật `messages`
  // ngay lập tức, không cần đóng/mở lại popup hay rời trang.
  useEffect(() => {
    const onSync = (event) => {
      const detail = event.detail || {}
      if (detail.ownerKey !== ownerKey) return
      if (detail.instanceId === instanceIdRef.current) return
      skipNextBroadcastRef.current = true
      setMessages(detail.messages || [])
    }
    window.addEventListener(SYNC_EVENT, onSync)
    return () => window.removeEventListener(SYNC_EVENT, onSync)
  }, [ownerKey])

  // Tự động lưu mỗi khi messages đổi (chỉ sau khi đã nạp lịch sử xong, tránh ghi đè).
  useEffect(() => {
    if (!historyLoaded) return
    saveGlobalChatHistory(userKey, messages)
    onMessagesChange?.(messages)
    if (skipNextBroadcastRef.current) {
      // Vừa nhận update từ nơi khác — không cần phát lại sự kiện (tránh lặp vô ích).
      skipNextBroadcastRef.current = false
      return
    }
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, {
      detail: { ownerKey, messages, instanceId: instanceIdRef.current },
    }))
  }, [messages, historyLoaded, userKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const pushMessage = (message) => {
    setMessages(prev => [...prev, { id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), ...message }])
  }

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
          const base64 = dataUrl.split(',')[1] || ''
          newEntries.push({ id, kind: 'image', dataUrl, base64, mimeType: file.type || 'image/jpeg', name: file.name })
        } else if (file.type === 'application/pdf') {
          // Groq vision chỉ nhận ảnh thật (jpeg/png/...), KHÔNG nhận PDF thô qua image_url
          // (gửi thẳng base64 PDF sẽ bị Groq trả lỗi "invalid image data").
          // Nên: thử trích xuất text trước (PDF dạng text), nếu không có thì render trang 1 → JPEG.
          const pdfText = await extractPdfTextForInBody(file)
          if (pdfText) {
            newEntries.push({ id, kind: 'text', name: file.name, mimeType: 'application/pdf', textContent: pdfText })
          } else {
            const imgB64 = await pdfPageToImageForInBody(file, 1)
            if (imgB64) {
              newEntries.push({ id, kind: 'image', dataUrl: `data:image/jpeg;base64,${imgB64}`, base64: imgB64, mimeType: 'image/jpeg', name: file.name })
            } else {
              console.error('Could not process PDF (no text, render failed):', file.name)
            }
          }
        } else if (isTextLikeFile(file)) {
          const textContent = await readFileAsText(file)
          newEntries.push({ id, kind: 'text', name: file.name, mimeType: file.type || 'text/plain', textContent })
        } else {
          console.warn('Unsupported file type for chat attachment:', file.type, file.name)
        }
      } catch (err) {
        console.error('Failed to read file', file.name, err)
      }
    }
    if (newEntries.length) setAttachedFiles(prev => [...prev, ...newEntries])
  }

  const removeAttachedFile = (id) => setAttachedFiles(prev => prev.filter(f => f.id !== id))

  const submitQuestion = async (rawQuestion = input) => {
    const question = rawQuestion.trim()
    const files = attachedFiles
    if (!question && files.length === 0) return
    if (busy) return
    setInput('')
    setAttachedFiles([])
    setBusy(true)
    autoSpeakNextRef.current = true
    pushMessage({
      role: 'user',
      text: question || (isVi ? `[Đã gửi ${files.length} file]` : `[Sent ${files.length} file(s)]`),
      imageDataUrls: files.filter(f => f.kind === 'image').map(f => ({ dataUrl: f.dataUrl, kind: f.kind, name: f.name })),
      fileNames: files.filter(f => f.kind === 'text').map(f => f.name),
    })

    if (files.length > 0) {
      // ── Multi-file path: images/PDFs → Groq vision; text/CSV → embedded as text ──
      try {
        setStatus(isVi ? 'Đang phân tích file...' : 'Analyzing files...')
        setMode('thinking')

        const visionFiles = files.filter(f => f.kind === 'image')
        const textFiles = files.filter(f => f.kind === 'text')

        const textBlock = textFiles.length
          ? textFiles.map(f => `--- ${f.name} ---\n${f.textContent}`).join('\n\n')
          : ''

        const defaultPrompt = isVi
          ? 'Hãy phân tích sâu (các) tài liệu/hình ảnh này (đặc biệt nếu là tài liệu y tế: X-quang, CT, MRI, kết quả xét nghiệm, hồ sơ...). Mô tả những gì quan sát được, lưu ý các điểm bất thường nếu có, và đưa ra nhận xét hữu ích.'
          : 'Please analyze these documents/images in depth (especially if medical: X-ray, CT, MRI, lab result, document...). Describe what you observe, note any abnormalities, and give a helpful assessment.'

        const instruction = (question || defaultPrompt) + (textBlock ? `\n\n---\n${textBlock}` : '')

        let answer = ''
        if (visionFiles.length > 0) {
          // Groq's vision model only accepts up to 5 images per request, so we
          // split the attached files into batches and merge the responses.
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

            const contentParts = [
              ...batch.map(f => ({ type: 'image_url', image_url: { url: `data:${f.mimeType};base64,${f.base64}` } })),
              { type: 'text', text: batchInstruction },
            ]
            const res = await fetch('/api/groq-proxy', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: 'meta-llama/llama-4-scout-17b-16e-instruct',
                max_tokens: 1024,
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: contentParts },
                ],
              }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data?.error?.message || `Groq Vision ${res.status}`)
            batchAnswers.push(data?.choices?.[0]?.message?.content || '')
          }

          answer = batches.length > 1
            ? batchAnswers
                .map((a, i) => `${isVi ? `Nhóm ảnh ${i + 1}/${batches.length}: ` : `Image batch ${i + 1}/${batches.length}: `}\n${a}`)
                .join('\n\n---\n\n')
            : batchAnswers[0]
        } else {
          // Only text/CSV files → use text model
          answer = await callGroqChat([{ role: 'user', content: instruction }], systemPrompt)
        }

        pushMessage({ role: 'assistant', text: answer || (isVi ? 'Xin lỗi, tôi chưa phân tích được các file này.' : 'Sorry, I could not analyze these files.') })
        setMode('groq')
        setStatus(isVi ? 'Sẵn sàng hỗ trợ · AI thực' : 'Ready to help · real AI')
      } catch (error) {
        console.error('Global chatbot file analysis error:', error)
        pushMessage({
          role: 'assistant',
          text: isVi
            ? 'Xin lỗi, tôi đang gặp sự cố khi phân tích file. Vui lòng thử lại sau ít phút.'
            : 'Sorry, I ran into an issue analyzing the files. Please try again in a moment.',
        })
        setMode('error')
        setStatus(isVi ? 'Lỗi kết nối AI' : 'AI connection error')
      } finally {
        setBusy(false)
      }
      return
    }

    const deterministicAnswer = getDeterministicFallbackReply(question, activePanelLabel)
    if (deterministicAnswer) {
      pushMessage({ role: 'assistant', text: deterministicAnswer })
      setMode('quick-guide')
      setStatus(isVi ? 'Hướng dẫn website · phản hồi nhanh' : 'Website guide · quick reply')
      setBusy(false)
      return
    }

    try {
      setStatus(isVi ? 'Đang suy nghĩ...' : 'Thinking...')
      setMode('thinking')

      const history = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(messages[0]?.id === 'hello' ? 1 : 0)
        .map(m => ({ role: m.role, content: m.text }))
      history.push({ role: 'user', content: question })

      const answer = await callGroqChat(history, systemPrompt)
      pushMessage({ role: 'assistant', text: answer || getDeterministicFallbackReply(question, activePanelLabel) || (isVi ? 'Xin lỗi, tôi chưa có câu trả lời phù hợp.' : "Sorry, I don't have a good answer for that yet.") })
      setMode('groq')
      setStatus(isVi ? 'Sẵn sàng hỗ trợ · AI thực' : 'Ready to help · real AI')
    } catch (error) {
      console.error('Global chatbot Groq error:', error)
      pushMessage({
        role: 'assistant',
        text: isVi
          ? 'Xin lỗi, tôi đang gặp sự cố kết nối AI. Vui lòng thử lại sau ít phút.'
          : 'Sorry, I ran into a connection issue. Please try again in a moment.',
      })
      setMode('error')
      setStatus(isVi ? 'Lỗi kết nối AI' : 'AI connection error')
    } finally {
      setBusy(false)
    }
  }

  submitQuestionRef.current = submitQuestion

  return {
    systemPrompt,
    messages, setMessages,
    input, setInput,
    status, setStatus,
    mode, setMode,
    busy,
    historyLoaded,
    attachedFiles, setAttachedFiles,
    handleFilesSelect, removeAttachedFile,
    submitQuestion, pushMessage,
    speaking, speak, stop: stopSpeaking,
    speechPaused, pauseSpeaking, resumeSpeaking, replaySpeaking,
    speechVolume, setSpeechVolume, speechRate, setSpeechRate, hasSpeechReplay,
    recording, transcribing, toggleMic, voiceError,
  }
}

export function getModeLabel(mode, isVi) {
  if (mode === 'groq') return isVi ? 'AI thực · Groq' : 'Real AI · Groq'
  if (mode === 'quick-guide') return isVi ? 'Hướng dẫn web' : 'Website guide'
  if (mode === 'thinking') return isVi ? 'Đang xử lý...' : 'Processing...'
  if (mode === 'error') return isVi ? 'Lỗi kết nối' : 'Connection error'
  return isVi ? 'Trợ lý website' : 'Website assistant'
}
