/**
 * SharedFaceAvatar — khuôn mặt tròn AI, tái dùng phần vẽ canvas gốc của
 * "Trợ lý thoại companion" (renderBasicFace + useHover + useTilt) NHƯNG
 * không phụ thuộc vào VoiceCompanionContext (pipeline Gemini Live riêng
 * của companion). Thay vào đó, `volume` (0–1) được truyền vào trực tiếp
 * từ trạng thái của chatbot chung (đang nghe mic / đang đọc trả lời TTS),
 * để dùng được ở bất kỳ đâu — ví dụ: nhúng vào chính khối chat trên
 * trang "🤖 AI chatbot control".
 *
 * Hỗ trợ tuỳ chỉnh:
 *   - color: màu nền khuôn mặt (bất kỳ mã màu CSS nào)
 *   - style: 'round' (mặt tròn ấm áp, mắt/miệng bo tròn — mặc định,
 *     dùng renderBasicFace gốc) hoặc 'robot' (mắt/miệng vuông vức, tự vẽ
 *     thêm ở đây, không đụng vào file basic-face-render.js gốc)
 *
 * LƯU Ý QUAN TRỌNG: renderBasicFace gốc vẽ vòng tròn nền với bán kính
 * `width/2 - 20` (số cứng theo px). Ở kích thước nhỏ (<= ~40px) thì
 * bán kính này ra 0 hoặc âm → khuôn mặt biến mất hoàn toàn. Vì vậy
 * component này ép kích thước tối thiểu (MIN_RENDER_SIZE) để luôn hiển
 * thị được, bất kể `size` truyền vào nhỏ cỡ nào.
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
// renderBasicFace gốc trừ cứng 20px cho bán kính nền → cần canvas tối
// thiểu ~112px để hình tròn không bị biến mất hoặc méo quá nhỏ.
const MIN_RENDER_SIZE = 112

function renderRobotFace(ctx, { eyeScale: eyesOpenness, mouthScale: mouthOpenness, color }) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)

  ctx.fillStyle = color || '#0f4c81'
  ctx.beginPath()
  const r = 14
  const pad = 8
  ctx.moveTo(pad + r, pad)
  ctx.arcTo(width - pad, pad, width - pad, height - pad, r)
  ctx.arcTo(width - pad, height - pad, pad, height - pad, r)
  ctx.arcTo(pad, height - pad, pad, pad, r)
  ctx.arcTo(pad, pad, width - pad, pad, r)
  ctx.closePath()
  ctx.fill()

  const eyesCenter = [width / 2, height / 2.425]
  const eyesOffset = width / 15
  const eyeSize = width / 16
  const openness = Math.max(0.15, eyesOpenness + 0.1)
  ctx.fillStyle = 'black'
  ;[eyesCenter[0] - eyesOffset, eyesCenter[0] + eyesOffset].forEach(cx => {
    ctx.fillRect(cx - eyeSize / 2, eyesCenter[1] - (eyeSize * openness) / 2, eyeSize, eyeSize * openness)
  })

  const mouthWidth = width / 4.5
  const mouthHeight = Math.max(3, (height / 8) * mouthOpenness)
  const mouthCenter = [width / 2, (height / 2.875) * 1.55]
  ctx.fillRect(mouthCenter[0] - mouthWidth / 2, mouthCenter[1] - mouthHeight / 2, mouthWidth, mouthHeight)
}

export default function SharedFaceAvatar({ volume = 0, radius = 120, color, size, style = 'round' }) {
  const canvasRef = useRef(null)
  const timeoutRef = useRef(null)
  const [isTalking, setIsTalking] = useState(false)

  const eyeScale = useBlink({ speed: 0.0125 })
  const mouthScale = volume / 2
  const hoverPosition = useHover({ amplitude: 4, frequency: 0.5 })
  const tiltAngle = useTilt({ maxAngle: 5, speed: 0.075, isActive: isTalking })

  const renderSize = Math.max(size || radius * 2, MIN_RENDER_SIZE)

  useEffect(() => {
    if (volume > AUDIO_OUTPUT_DETECTION_THRESHOLD) {
      setIsTalking(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setIsTalking(false), TALKING_STATE_COOLDOWN_MS)
    }
  }, [volume])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    if (style === 'robot') {
      renderRobotFace(ctx, { eyeScale, mouthScale, color })
    } else {
      renderBasicFace({ ctx, mouthScale, eyeScale, color })
    }
  }, [eyeScale, mouthScale, color, style])

  return (
    <canvas
      className="shared-face-avatar"
      ref={canvasRef}
      width={renderSize}
      height={renderSize}
      style={{
        display: 'block',
        width: size || radius * 2,
        height: size || radius * 2,
        borderRadius: style === 'robot' ? 14 : '50%',
        transform: `translateY(${hoverPosition}px) rotate(${tiltAngle}deg)`,
        flexShrink: 0,
      }}
    />
  )
}
