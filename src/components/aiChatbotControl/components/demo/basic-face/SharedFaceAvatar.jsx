/**
 * SharedFaceAvatar — khuôn mặt tròn AI, tái dùng phần vẽ canvas gốc của
 * "Trợ lý thoại companion" (renderBasicFace + useHover + useTilt) NHƯNG
 * không phụ thuộc vào VoiceCompanionContext (pipeline Gemini Live riêng
 * của companion). Thay vào đó, `volume` (0–1) được truyền vào trực tiếp
 * từ trạng thái của chatbot chung (đang nghe mic / đang đọc trả lời TTS),
 * để dùng được ở bất kỳ đâu — ví dụ: nhúng vào chính khối chat trên
 * trang "🤖 AI chatbot control".
 *
 * Dựa trên: components/demo/basic-face/BasicFace.jsx + hooks/demo/use-face.js
 * (Ported from chatterbots, Google I/O 2025 Live API Demo — Apache-2.0)
 */
import React, { useEffect, useRef, useState } from 'react'
import { renderBasicFace } from './basic-face-render'
import { useBlink } from '../../../hooks/demo/use-face'
import useHover from '../../../hooks/demo/use-hover'
import useTilt from '../../../hooks/demo/use-tilt'

const AUDIO_OUTPUT_DETECTION_THRESHOLD = 0.05
const TALKING_STATE_COOLDOWN_MS = 900

export default function SharedFaceAvatar({ volume = 0, radius = 120, color, size }) {
  const canvasRef = useRef(null)
  const timeoutRef = useRef(null)
  const [isTalking, setIsTalking] = useState(false)
  const [scale, setScale] = useState(1)

  const eyeScale = useBlink({ speed: 0.0125 })
  const mouthScale = volume / 2
  const hoverPosition = useHover({ amplitude: 4, frequency: 0.5 })
  const tiltAngle = useTilt({ maxAngle: 5, speed: 0.075, isActive: isTalking })

  useEffect(() => {
    if (volume > AUDIO_OUTPUT_DETECTION_THRESHOLD) {
      setIsTalking(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsTalking(false), TALKING_STATE_COOLDOWN_MS)
    }
    return () => {}
  }, [volume])

  useEffect(() => {
    if (!size) { setScale(1); return }
    setScale(size / (radius * 2))
  }, [size, radius])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    renderBasicFace({ ctx, mouthScale, eyeScale, color })
  }, [eyeScale, mouthScale, color])

  return (
    <canvas
      className="shared-face-avatar"
      ref={canvasRef}
      width={radius * 2 * scale}
      height={radius * 2 * scale}
      style={{
        display: 'block',
        borderRadius: '50%',
        transform: `translateY(${hoverPosition}px) rotate(${tiltAngle}deg)`,
        flexShrink: 0,
      }}
    />
  )
}
