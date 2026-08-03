/**
 * Free-voice replacement for the original chatterbots `use-live-api.ts` hook.
 *
 * Instead of the paid Gemini Live API (bidirectional PCM audio streaming),
 * this drives the companion with:
 *  - the browser's free SpeechRecognition API for speech-to-text
 *  - the server-side /api/groq-proxy ('ai-chatbot-control' provider) for the
 *    reply text — the Gemini key (GEMINI_API_KEY) lives only on the server,
 *    never in the browser bundle (see lib/geminiTextClient.js)
 *  - the browser's free SpeechSynthesis API for text-to-speech
 * No client-side API key is needed at all.
 *
 * Lịch sử hội thoại (messages) được lưu vào CÙNG IndexedDB mà toàn dự án dùng
 * chung — src/lib/globalChatbotStorage.js (DB 'global-ai-chatbot-db', khoá
 * theo uuid của user, cùng pattern với GlobalAIChatbot.jsx / trang "Anh
 * Hùng" / trang "Lịch sử Chat với AI"). Nhờ vậy hội thoại với companion ở
 * đây cũng tự động hiện trong "Lịch sử Chat với AI" — không cần store riêng.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgent, useUser } from '../lib/state'
import { createSystemInstructions } from '../lib/prompts'
import { callGeminiAPI } from '../lib/geminiTextClient'
import { useAuth } from '../../../context/AuthContext'
import { getGlobalChatHistory, saveGlobalChatHistory, clearGlobalChatHistory, ownerKeyOf, GLOBAL_CHATBOT_SYNC_EVENT } from '../../../lib/globalChatbotStorage.js'

function detectIsVietnamese(text) {
  return /[àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(
    text
  )
}

function pickVoice(lang) {
  const voices = window.speechSynthesis?.getVoices?.() || []
  return (
    voices.find(v => v.lang?.toLowerCase() === lang.toLowerCase()) ||
    voices.find(v => v.lang?.toLowerCase().startsWith(lang.slice(0, 2))) ||
    null
  )
}

function makeMessage(role, text) {
  return { id: `${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), role, text }
}

export function useVoiceCompanion() {
  const { current: agent } = useAgent()
  const user = useUser()
  const { user: authUser } = useAuth()
  const userKey = authUser?.uuid || null
  const ownerKey = ownerKeyOf(userKey)

  const [connected, setConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [volume, setVolume] = useState(0)
  const [error, setError] = useState(null)
  const [messages, setMessages] = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  // Gợi ý nhẹ khi mic không bắt được giọng nói (KHÔNG phải lỗi thật, xem
  // recognition.onerror bên dưới) — tự ẩn sau vài giây, giúp user biết để
  // kiểm tra micro thay vì thấy im lặng khó hiểu.
  const [listenHint, setListenHint] = useState(null)

  const recognitionRef = useRef(null)
  const utteranceRef = useRef(null)
  const volumeIntervalRef = useRef(null)
  const agentRef = useRef(agent)
  const userRef = useRef(user)
  const messagesRef = useRef(messages)
  const instanceIdRef = useRef(`ai-chatbot-control-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  const skipNextBroadcastRef = useRef(false)
  agentRef.current = agent
  userRef.current = user
  messagesRef.current = messages

  // Nạp lịch sử đã lưu ngay khi biết danh tính user (uuid) — kể cả khách
  // (guest, ownerKeyOf(null) === 'guest') vẫn có lịch sử riêng, không mất dữ liệu.
  useEffect(() => {
    let cancelled = false
    setHistoryLoaded(false)
    getGlobalChatHistory(userKey).then(history => {
      if (!cancelled) {
        setMessages(history)
        setHistoryLoaded(true)
      }
    })
    return () => { cancelled = true }
  }, [userKey])

  const persistAndBroadcast = useCallback((nextMessages) => {
    saveGlobalChatHistory(userKey, nextMessages)
    window.dispatchEvent(new CustomEvent(GLOBAL_CHATBOT_SYNC_EVENT, {
      detail: { ownerKey, messages: nextMessages, instanceId: instanceIdRef.current },
    }))
  }, [ownerKey, userKey])

  const pushMessage = useCallback((role, text) => {
    setMessages(prev => {
      const next = [...prev, makeMessage(role, text)]
      persistAndBroadcast(next)
      return next
    })
  }, [persistAndBroadcast])

  const clearHistory = useCallback(() => {
    setMessages([])
    clearGlobalChatHistory(userKey)
    window.dispatchEvent(new CustomEvent(GLOBAL_CHATBOT_SYNC_EVENT, {
      detail: { ownerKey, messages: [], instanceId: instanceIdRef.current },
    }))
  }, [ownerKey, userKey])

  useEffect(() => {
    const onSync = (event) => {
      const detail = event.detail || {}
      if (detail.ownerKey !== ownerKey) return
      if (detail.instanceId === instanceIdRef.current) return
      skipNextBroadcastRef.current = true
      setMessages(detail.messages || [])
    }
    window.addEventListener(GLOBAL_CHATBOT_SYNC_EVENT, onSync)
    return () => window.removeEventListener(GLOBAL_CHATBOT_SYNC_EVENT, onSync)
  }, [ownerKey])

  useEffect(() => {
    if (!historyLoaded || !skipNextBroadcastRef.current) return
    skipNextBroadcastRef.current = false
    saveGlobalChatHistory(userKey, messages)
  }, [historyLoaded, messages, userKey])

  useEffect(() => {
    if (!listenHint) return
    const t = setTimeout(() => setListenHint(null), 6000)
    return () => clearTimeout(t)
  }, [listenHint])


  const stopVolumeAnimation = useCallback(() => {
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current)
      volumeIntervalRef.current = null
    }
    setVolume(0)
  }, [])

  const startVolumeAnimation = useCallback(() => {
    let t = 0
    volumeIntervalRef.current = setInterval(() => {
      t += 1
      // Pseudo mouth-movement while speaking — there's no real amplitude
      // data from SpeechSynthesis, so approximate it with a gentle wobble.
      setVolume(0.25 + Math.abs(Math.sin(t / 2)) * 0.35)
    }, 90)
  }, [])

  const speak = useCallback(
    text => {
      if (!text || !window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const isVi = detectIsVietnamese(text)
      utterance.lang = isVi ? 'vi-VN' : 'en-US'
      const voice = pickVoice(utterance.lang)
      if (voice) utterance.voice = voice

      utterance.onstart = () => {
        setSpeaking(true)
        startVolumeAnimation()
      }
      utterance.onend = () => {
        setSpeaking(false)
        stopVolumeAnimation()
        utteranceRef.current = null
      }
      utterance.onerror = () => {
        setSpeaking(false)
        stopVolumeAnimation()
        utteranceRef.current = null
      }
      // QUAN TRỌNG: Chrome không giữ strong reference tới SpeechSynthesisUtterance
      // — nếu không lưu lại ở đâu đó (ví dụ biến ref này), garbage collector có
      // thể dọn utterance giữa chừng, khiến speak() chạy nhưng KHÔNG phát ra
      // tiếng gì (không lỗi, không log, im lặng hoàn toàn). Đây là bug đã biết
      // của Chrome (crbug liên quan tới SpeechSynthesisUtterance bị GC sớm).
      utteranceRef.current = utterance
      window.speechSynthesis.speak(utterance)
    },
    [startVolumeAnimation, stopVolumeAnimation]
  )

  const askCompanion = useCallback(
    async (userText, { recordUserMessage = true } = {}) => {
      const systemInstruction = createSystemInstructions(
        agentRef.current,
        userRef.current
      )
      // Lịch sử TRƯỚC câu hỏi này — câu hỏi hiện tại đi riêng qua `prompt`,
      // không lặp lại trong `history` (tránh Gemini nhận 2 lần cùng 1 câu).
      const priorHistory = messagesRef.current
      if (recordUserMessage) pushMessage('user', userText)
      setThinking(true)
      try {
        const reply = await callGeminiAPI(userText, systemInstruction, priorHistory)
        pushMessage('assistant', reply)
        speak(reply)
      } finally {
        setThinking(false)
      }
    },
    [speak, pushMessage]
  )

  const startListening = useCallback(() => {
    if (!connected || speaking || listening || thinking) return
    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionImpl) {
      setError(
        new Error(
          'Trình duyệt này không hỗ trợ nhận diện giọng nói (SpeechRecognition). Vui lòng dùng Google Chrome.'
        )
      )
      return
    }

    const recognition = new SpeechRecognitionImpl()
    recognition.lang = navigator.language?.startsWith('vi') ? 'vi-VN' : 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = event => {
      const text = event.results?.[0]?.[0]?.transcript
      if (text) {
        setListenHint(null)
        askCompanion(text).catch(err => setError(err))
      }
    }
    recognition.onerror = event => {
      console.warn('[useVoiceCompanion] recognition error:', event.error)
      if (event.error === 'no-speech') {
        // Mic có quyền truy cập nhưng không bắt được tiếng nói — thường do
        // thiết bị mic sai/tắt tiếng ở cấp hệ điều hành hoặc trong Chrome
        // (kiểm tra icon ổ khoá cạnh URL → Micro), KHÔNG phải lỗi của app.
        setListenHint(
          'Không nghe thấy giọng nói. Hãy kiểm tra đúng micro đang chọn trong Chrome (biểu tượng ổ khoá cạnh URL) rồi thử lại.'
        )
        return
      }
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError(
          new Error(
            'Trình duyệt đã chặn quyền micro. Vào biểu tượng ổ khoá cạnh URL → Micro → Cho phép, rồi tải lại trang.'
          )
        )
        return
      }
      if (event.error !== 'aborted') {
        setError(new Error(`Lỗi nhận diện giọng nói: ${event.error}`))
      }
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setListening(true)
    setListenHint(null)
    recognition.start()
  }, [connected, speaking, listening, thinking, askCompanion])

  const connect = useCallback(async () => {
    setError(null)
    try {
      // Chỉ tự động chào khi CHƯA có lịch sử (hội thoại mới hoàn toàn) — nếu
      // user đã có lịch sử cũ (mở lại trang, bấm connect lần 2...), giữ nguyên
      // im lặng chờ user nói tiếp, tránh chèn thêm lời chào lặp lại vào lịch sử
      // đã lưu mỗi lần bấm connect.
      if (messagesRef.current.length === 0) {
        await askCompanion(
          'Greet the user and introduce yourself and your role in one or two short sentences.',
          { recordUserMessage: false }
        )
      }
      setConnected(true)
    } catch (err) {
      setError(err)
      setConnected(false)
    }
  }, [askCompanion])

  const disconnect = useCallback(() => {
    setConnected(false)
    setListening(false)
    recognitionRef.current?.stop()
    recognitionRef.current = null
    window.speechSynthesis?.cancel()
    stopVolumeAnimation()
    setSpeaking(false)
  }, [stopVolumeAnimation])

  // Clean everything up on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
      window.speechSynthesis?.cancel()
      if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current)
    }
  }, [])

  return {
    connected,
    listening,
    speaking,
    thinking,
    volume,
    error,
    setError,
    connect,
    disconnect,
    startListening,
    messages,
    historyLoaded,
    clearHistory,
    listenHint,
  }
}
