/**
 * Free replacement for the original chatterbots `use-live-api.ts` hook.
 *
 * Instead of the paid Gemini Live API (bidirectional PCM audio streaming),
 * this drives the companion with:
 *  - the browser's free SpeechRecognition API for speech-to-text
 *  - the existing free VITE_GEMINI_API_KEY `generateContent` endpoint (see
 *    lib/geminiTextClient.js) for the reply text
 *  - the browser's free SpeechSynthesis API for text-to-speech
 * No extra API key or billing is required beyond the Gemini key this project
 * already uses elsewhere.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAgent, useUser } from '../lib/state'
import { createSystemInstructions } from '../lib/prompts'
import { callGeminiAPI } from '../lib/geminiTextClient'

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

export function useVoiceCompanion({ apiKey }) {
  const { current: agent } = useAgent()
  const user = useUser()

  const [connected, setConnected] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [volume, setVolume] = useState(0)
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const volumeIntervalRef = useRef(null)
  const agentRef = useRef(agent)
  const userRef = useRef(user)
  agentRef.current = agent
  userRef.current = user

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
      }
      utterance.onerror = () => {
        setSpeaking(false)
        stopVolumeAnimation()
      }
      window.speechSynthesis.speak(utterance)
    },
    [startVolumeAnimation, stopVolumeAnimation]
  )

  const askCompanion = useCallback(
    async userText => {
      try {
        const systemInstruction = createSystemInstructions(
          agentRef.current,
          userRef.current
        )
        const reply = await callGeminiAPI(apiKey, userText, systemInstruction)
        speak(reply)
      } catch (err) {
        setError(err)
      }
    },
    [apiKey, speak]
  )

  const startListening = useCallback(() => {
    if (!connected || speaking || listening) return
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
      if (text) askCompanion(text)
    }
    recognition.onerror = event => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        setError(new Error(`Lỗi nhận diện giọng nói: ${event.error}`))
      }
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    setListening(true)
    recognition.start()
  }, [connected, speaking, listening, askCompanion])

  const connect = useCallback(async () => {
    setError(null)
    setConnected(true)
    await askCompanion(
      'Greet the user and introduce yourself and your role in one or two short sentences.'
    )
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
    volume,
    error,
    setError,
    connect,
    disconnect,
    startListening,
  }
}
