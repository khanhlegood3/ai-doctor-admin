// src/lib/groqAiClient.js
// Stack AI thật dùng chung: Groq LLM (chat), Groq Whisper (STT), TTS (đọc to).
// Đây là logic đã được WikiMedVisionPanel dùng và kiểm chứng — tách ra thành
// module riêng để GlobalAIChatbot (và các nơi khác) có thể tái sử dụng thay vì
// chạy Transformers.js trong trình duyệt.
//
// Các API serverless phía sau (đã có sẵn trong /api):
//   /api/groq-proxy   → proxy Groq Chat Completions (model xem GROQ_TEXT_MODEL bên dưới)
//   /api/groq-whisper  → proxy Groq Whisper STT (model whisper-large-v3-turbo)
//   /api/google-tts    → proxy Google Translate TTS (giọng tiếng Việt)

import { useCallback, useRef, useState, useEffect } from 'react'

// Nguồn sự thật DUY NHẤT cho tên model Groq dùng ở phía frontend (src/**).
// Groq thông báo ngừng hỗ trợ 'llama-3.3-70b-versatile' và
// 'meta-llama/llama-4-scout-17b-16e-instruct' ngày 17/6/2026, chính thức
// decommission ngày 16/8/2026 (xem https://console.groq.com/docs/deprecations).
// Khi Groq lại deprecate model tiếp theo, chỉ cần sửa đúng 2 dòng dưới đây
// thay vì lục từng file trong src/.
export const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b'
export const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b'
// Giữ tên cũ GROQ_MODEL làm alias để không phải sửa mọi chỗ đã lỡ import —
// nhưng ưu tiên dùng GROQ_TEXT_MODEL ở code mới.
export const GROQ_MODEL = GROQ_TEXT_MODEL
export const GLOBAL_AUDIO_STOP_EVENT = 'ai-doctor-stop-audio'

export function stopAllAudioSources(source = 'unknown') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(GLOBAL_AUDIO_STOP_EVENT, { detail: { source } }))
}

const MIN_VOICE_RECORDING_MS = 700
const MIN_VOICE_RMS = 0.012
const MIN_VOICE_ACTIVE_FRAMES = 4
const WHISPER_SILENCE_HALLUCINATION_PATTERNS = [
  /hãy\s+subscribe\s+cho\s+kênh\s+ghiền\s+mì\s+gõ/i,
  /để\s+không\s+bỏ\s+lỡ\s+những\s+video\s+hấp\s+dẫn/i,
]

function isLikelySilentRecording({ startedAt, voiceStats }) {
  const durationMs = Date.now() - startedAt
  if (durationMs < MIN_VOICE_RECORDING_MS) return true
  if (!voiceStats?.sampledFrames) return false
  return (voiceStats.activeFrames || 0) < MIN_VOICE_ACTIVE_FRAMES && (voiceStats.peakRms || 0) < MIN_VOICE_RMS
}

function isKnownWhisperSilenceHallucination(text) {
  const normalized = String(text || '').normalize('NFC').trim()
  if (!normalized) return true
  return WHISPER_SILENCE_HALLUCINATION_PATTERNS.some(pattern => pattern.test(normalized))
}

// ─── Groq LLM (chat) ──────────────────────────────────────────────────────────
// messages: [{ role: 'user' | 'assistant', content: string }, ...]
export async function callGroqChat(messages, systemPrompt, { maxTokens = 1024, temperature = 0.7 } = {}) {
  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: String(m.content) })),
  ]

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_TEXT_MODEL,
      messages: groqMessages,
      max_tokens: maxTokens,
      temperature,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data)
    throw new Error(`Groq API error: ${res.status} — ${msg}`)
  }

  return data.choices?.[0]?.message?.content || ''
}

// ─── Groq Whisper STT hook ────────────────────────────────────────────────────
// Records audio via MediaRecorder, sends to /api/groq-whisper, returns transcript.
// lang: 'vi' | 'en' — passed to Whisper for better accuracy.
export function useVoiceInput(onTranscript, lang = 'vi') {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const recordingStartedAtRef = useRef(0)
  const voiceStatsRef = useRef({ activeFrames: 0, peakRms: 0, sampledFrames: 0 })
  const silenceMonitorRef = useRef(null)
  const onTranscriptRef = useRef(onTranscript)

  useEffect(() => {
    onTranscriptRef.current = onTranscript
  }, [onTranscript])

  const start = useCallback(async () => {
    if (recording || transcribing) return
    try {
      setError('')
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error(lang === 'vi'
          ? 'Trình duyệt này chưa hỗ trợ ghi âm trực tiếp.'
          : 'This browser does not support direct voice recording.')
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recordingStartedAtRef.current = Date.now()
      voiceStatsRef.current = { activeFrames: 0, peakRms: 0, sampledFrames: 0 }

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor()
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 1024
        const source = audioContext.createMediaStreamSource(stream)
        source.connect(analyser)
        const samples = new Float32Array(analyser.fftSize)
        let frameId = 0
        const sampleVoiceLevel = () => {
          analyser.getFloatTimeDomainData(samples)
          let sumSquares = 0
          for (let i = 0; i < samples.length; i += 1) sumSquares += samples[i] * samples[i]
          const rms = Math.sqrt(sumSquares / samples.length)
          voiceStatsRef.current.sampledFrames += 1
          voiceStatsRef.current.peakRms = Math.max(voiceStatsRef.current.peakRms, rms)
          if (rms >= MIN_VOICE_RMS) voiceStatsRef.current.activeFrames += 1
          frameId = window.requestAnimationFrame(sampleVoiceLevel)
        }
        frameId = window.requestAnimationFrame(sampleVoiceLevel)
        silenceMonitorRef.current = () => {
          window.cancelAnimationFrame(frameId)
          source.disconnect()
          audioContext.close().catch(() => {})
        }
      }

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        silenceMonitorRef.current?.()
        silenceMonitorRef.current = null
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const silenceRecording = isLikelySilentRecording({
          startedAt: recordingStartedAtRef.current,
          voiceStats: voiceStatsRef.current,
        })
        if (!blob.size || silenceRecording) {
          setTranscribing(false)
          return
        }
        setTranscribing(true)
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
          const formData = new FormData()
          formData.append('file', blob, `voice.${ext}`)
          formData.append('language', lang === 'vi' ? 'vi' : 'en')
          const res = await fetch('/api/groq-whisper', { method: 'POST', body: formData })
          const data = await res.json()
          if (!res.ok) throw new Error(data?.error?.message || data?.error || `Whisper API error: ${res.status}`)
          const transcript = data?.text?.trim()
          if (transcript && !isKnownWhisperSilenceHallucination(transcript)) onTranscriptRef.current?.(transcript)
        } catch (err) {
          console.error('[Whisper STT] error:', err)
          setError(lang === 'vi'
            ? 'Tôi chưa nghe rõ hoặc chưa chuyển giọng nói thành chữ được. Vui lòng thử lại.'
            : 'I could not hear clearly or transcribe your voice. Please try again.')
        } finally {
          setTranscribing(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      console.error('[Whisper STT] mic error:', err)
      setRecording(false)
      setTranscribing(false)
      setError(err?.message || (lang === 'vi' ? 'Không truy cập được microphone.' : 'Could not access the microphone.'))
    }
  }, [recording, transcribing, lang])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  const toggle = useCallback(() => {
    stopAllAudioSources('voice-input')
    if (recording) stop(); else start()
  }, [recording, start, stop])

  useEffect(() => {
    const handleGlobalStop = () => stop()
    window.addEventListener(GLOBAL_AUDIO_STOP_EVENT, handleGlobalStop)
    return () => window.removeEventListener(GLOBAL_AUDIO_STOP_EVENT, handleGlobalStop)
  }, [stop])

  return { recording, transcribing, toggle, error }
}

// ─── TTS (Text-to-Speech) ────────────────────────────────────────────────────
// Tiếng Việt: dùng Google Translate TTS qua proxy /api/google-tts (tránh CORS)
// Tiếng Anh : dùng Web Speech API (sẵn có trên mọi browser)

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Chia text thành các đoạn ≤ maxLen ký tự, cắt tại ranh giới câu
function splitChunks(text, maxLen = 180) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  const chunks = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > maxLen && cur) { chunks.push(cur.trim()); cur = s }
    else cur += s
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.filter(Boolean)
}

export function useTTS(lang = 'vi', externalAudioRef = null) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [volume, setVolumeState] = useState(1)
  const [rate, setRateState] = useState(lang === 'vi' ? 1 : 0.95)
  const stopRef = useRef(false)
  const audioRef = useRef(null)
  const utteranceRef = useRef(null)
  const lastTextRef = useRef('')
  const currentResolveRef = useRef(null)
  const volumeRef = useRef(1)
  const rateRef = useRef(lang === 'vi' ? 1 : 0.95)

  const setVolume = useCallback((nextVolume) => {
    const safeVolume = Math.min(1, Math.max(0, Number(nextVolume) || 0))
    volumeRef.current = safeVolume
    setVolumeState(safeVolume)
    if (audioRef.current) audioRef.current.volume = safeVolume
    if (utteranceRef.current) utteranceRef.current.volume = safeVolume
  }, [])

  const setRate = useCallback((nextRate) => {
    const safeRate = Math.min(2, Math.max(0.5, Number(nextRate) || 1))
    rateRef.current = safeRate
    setRateState(safeRate)
    if (audioRef.current) audioRef.current.playbackRate = safeRate
    if (utteranceRef.current) utteranceRef.current.rate = safeRate
  }, [])

  const stop = useCallback(() => {
    stopRef.current = true
    setSpeaking(false)
    setPaused(false)
    if (currentResolveRef.current) {
      currentResolveRef.current()
      currentResolveRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      if (externalAudioRef?.current && audioRef.current === externalAudioRef.current) {
        audioRef.current.removeAttribute('src')
        audioRef.current.load?.()
      }
      audioRef.current = null
    }
    utteranceRef.current = null
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  }, [externalAudioRef])

  const speak = useCallback(async (text, { restart = false } = {}) => {
    stopAllAudioSources('tts')
    if (speaking) {
      if (!restart) { stop(); return }
      stop()
      await new Promise(resolve => setTimeout(resolve, 0))
    }
    const clean = stripMarkdown(text)
    if (!clean) return
    lastTextRef.current = clean
    stopRef.current = false
    setPaused(false)

    if (lang === 'vi') {
      // ── Google Translate TTS qua proxy (tránh CORS) ──
      const chunks = splitChunks(clean, 180)
      setSpeaking(true)
      for (const chunk of chunks) {
        if (stopRef.current) break
        const url = `/api/google-tts?tl=vi&q=${encodeURIComponent(chunk)}`
        const audio = externalAudioRef?.current || new Audio()
        audio.src = url
        audio.volume = volumeRef.current
        audio.playbackRate = rateRef.current
        audioRef.current = audio
        await new Promise((res) => {
          currentResolveRef.current = res
          audio.onended = res
          audio.onerror = res
          audio.play().catch(res)
        })
        currentResolveRef.current = null
        audioRef.current = null
      }
      if (!stopRef.current) setSpeaking(false)
      if (!stopRef.current) setPaused(false)
    } else {
      // ── Web Speech API cho tiếng Anh ──
      if (!window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(clean)
      utter.lang = 'en-US'
      utter.rate = rateRef.current
      utter.volume = volumeRef.current
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => v.lang.startsWith('en') && v.localService)
        || voices.find(v => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.onstart = () => { setSpeaking(true); setPaused(false) }
      await new Promise((resolve) => {
        currentResolveRef.current = resolve
        utter.onend = () => {
          setSpeaking(false)
          setPaused(false)
          utteranceRef.current = null
          currentResolveRef.current = null
          resolve()
        }
        utter.onerror = () => {
          setSpeaking(false)
          setPaused(false)
          utteranceRef.current = null
          currentResolveRef.current = null
          resolve()
        }
        utteranceRef.current = utter
        window.speechSynthesis.speak(utter)
      })
    }
  }, [speaking, lang, stop, externalAudioRef])

  const pause = useCallback(() => {
    if (!speaking || paused) return
    if (audioRef.current) audioRef.current.pause()
    if (window.speechSynthesis) window.speechSynthesis.pause()
    setPaused(true)
  }, [speaking, paused])

  const resume = useCallback(() => {
    if (!speaking || !paused) return
    if (audioRef.current) audioRef.current.play().catch(() => {})
    if (window.speechSynthesis) window.speechSynthesis.resume()
    setPaused(false)
  }, [speaking, paused])

  const replay = useCallback(() => {
    if (!lastTextRef.current) return
    speak(lastTextRef.current, { restart: true })
  }, [speak])

  useEffect(() => () => stop(), [stop])
  useEffect(() => {
    const handleGlobalStop = () => stop()
    window.addEventListener(GLOBAL_AUDIO_STOP_EVENT, handleGlobalStop)
    return () => window.removeEventListener(GLOBAL_AUDIO_STOP_EVENT, handleGlobalStop)
  }, [stop])

  return { speaking, speak, stop, paused, pause, resume, replay, volume, setVolume, rate, setRate, hasReplay: Boolean(lastTextRef.current) }
}
