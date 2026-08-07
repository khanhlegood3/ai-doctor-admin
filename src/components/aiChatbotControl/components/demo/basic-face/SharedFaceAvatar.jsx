/**
 * SharedFaceAvatar — khuôn mặt tròn AI dùng CHUNG ở 3 nơi:
 *   - Trang "🤖 AI chatbot control" (EmbeddedGlobalAIChat.jsx)
 *   - Nút mic 2 trang "Anh Hùng" (heroPanels/HeroMicVoiceButton.jsx)
 *   - Popup chatbot chung góc màn hình (GlobalAIChatbot.jsx)
 *
 * Màu (bodyColor) + phong cách (faceStyle) đọc/ghi qua kho `useAgent`
 * (aiChatbotControl/lib/state.js, persist localStorage) — CÙNG kho mà
 * "Trợ lý thoại companion" gốc đã dùng, nên chọn 1 lần ở bất kỳ đâu trong
 * 3 nơi trên đều áp dụng ngay cho cả 3 (Zustand store phản ứng tức thời
 * trong cùng tab, và persist để giữ nguyên sau khi tải lại trang / mở
 * trang khác).
 *
 * Animation (eyeScale/mouthScale theo state) không phụ thuộc audio stream
 * thật — dùng đúng công thức đã có sẵn trong HeroMicVoiceButton gốc, để
 * "cảm giác" giống hệt nhau ở cả 3 nơi:
 *   - listening : mắt to hơn (đang nghe)
 *   - thinking  : mắt nhấp nháy nhẹ (đang xử lý/suy nghĩ)
 *   - speaking  : miệng mấp máy theo sóng sin (đang đọc trả lời)
 *   - idle      : chớp mắt thỉnh thoảng
 *
 * trackCursor (mặc định false): khi bật, mắt + mũi "nhìn"/hướng theo vị
 * trí con trỏ chuột trên toàn màn hình (tính góc từ tâm canvas tới
 * clientX/clientY của chuột). CHỈ bật ở trang "🤖 AI chatbot control" theo
 * yêu cầu — không đụng tới giao diện mắt phẳng hiện có ở 2 trang Anh Hùng
 * / popup (trackCursor=false ở đó, giữ nguyên y hệt trước giờ).
 *
 * Dựa trên: components/demo/basic-face/BasicFace.jsx + basic-face-render.js
 * (Ported from chatterbots, Google I/O 2025 Live API Demo — Apache-2.0).
 * Phần vẽ 6 hình nền còn lại, mắt/mũi nhìn theo chuột, và animation theo
 * state là code mới, không đụng vào 2 file gốc đó.
 */
import React, { useEffect, useRef } from 'react'
import { renderBasicFace } from './basic-face-render'

// ─── Vẽ mắt + miệng kiểu PHẲNG gốc (tách riêng từ renderBasicFace để tái dùng cho 6 hình nền còn lại, KHÔNG nhìn theo chuột) ───
function drawEyesAndMouth(ctx, width, height, eyeScale, mouthScale) {
  const eyesCenter = [width / 2, height / 2.425]
  const eyesOffset = width / 15
  const eyeRadius = width / 30
  const openness = Math.max(0.08, eyeScale + 0.1)

  ctx.fillStyle = 'black'
  ;[eyesCenter[0] - eyesOffset, eyesCenter[0] + eyesOffset].forEach(cx => {
    ctx.save()
    ctx.translate(cx, eyesCenter[1])
    ctx.scale(1, openness)
    ctx.beginPath()
    ctx.arc(0, 0, eyeRadius, 0, Math.PI * 2)
    ctx.restore()
    ctx.fill()
  })

  drawMouth(ctx, width, height, mouthScale)
}

function drawMouth(ctx, width, height, mouthScale) {
  const mouthCenter = [width / 2, (height / 2.875) * 1.55]
  const mouthExtent = [width / 10, (height / 5) * mouthScale + 10]
  ctx.save()
  ctx.translate(mouthCenter[0], mouthCenter[1])
  ctx.scale(1, mouthScale + height * 0.002)
  ctx.fillStyle = 'black'
  ctx.beginPath()
  ctx.ellipse(0, 0, mouthExtent[0], mouthExtent[1], 0, 0, Math.PI, false)
  ctx.ellipse(0, 0, mouthExtent[0], mouthExtent[1] * 0.45, 0, 0, Math.PI, true)
  ctx.fill()
  ctx.restore()
}

// ─── Vẽ mắt (tròng trắng + con ngươi lệch theo hướng chuột) + mũi + miệng — dùng khi trackCursor=true ───
function drawGazeEyesNoseMouth(ctx, width, height, eyeScale, mouthScale, gaze) {
  const eyesCenter = [width / 2, height / 2.425]
  const eyesOffset = width / 15
  const scleraRadius = width / 20
  const pupilRadius = width / 44
  const openness = Math.max(0.1, eyeScale + 0.1)
  const maxPupilOffset = scleraRadius - pupilRadius - 1

  ;[eyesCenter[0] - eyesOffset, eyesCenter[0] + eyesOffset].forEach(cx => {
    // Tròng trắng (sclera), bóp theo chiều dọc khi chớp mắt
    ctx.save()
    ctx.translate(cx, eyesCenter[1])
    ctx.scale(1, openness)
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(0, 0, scleraRadius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Con ngươi (đen) lệch về phía con trỏ chuột
    const px = cx + gaze.x * maxPupilOffset
    const py = eyesCenter[1] + gaze.y * maxPupilOffset * Math.min(1, openness)
    ctx.fillStyle = '#0f172a'
    ctx.beginPath()
    ctx.arc(px, py, pupilRadius * Math.min(1, openness + 0.3), 0, Math.PI * 2)
    ctx.fill()
  })

  // Mũi nhỏ — dịch nhẹ theo hướng chuột giống mắt, cho cảm giác "hướng mặt" theo con trỏ
  const noseCenter = [width / 2 + gaze.x * (width * 0.01), height / 2.425 + height * 0.09 + gaze.y * (height * 0.01)]
  ctx.fillStyle = 'rgba(15, 23, 42, 0.35)'
  ctx.beginPath()
  ctx.ellipse(noseCenter[0], noseCenter[1], width / 60, height / 90, 0, 0, Math.PI * 2)
  ctx.fill()

  drawMouth(ctx, width, height, mouthScale)
}

// Nền hình tròn — công thức giống hệt renderBasicFace gốc (bán kính =
// width/2 - 20) nhưng KHÔNG tự vẽ mắt/miệng, để dùng chung với mắt kiểu
// "nhìn theo chuột" ở trên khi style='round' + trackCursor=true.
function drawRoundBackground(ctx, width, height, color) {
  ctx.fillStyle = color || 'white'
  ctx.beginPath()
  ctx.arc(width / 2, height / 2, width / 2 - 20, 0, Math.PI * 2)
  ctx.fill()
}

function regularPolygonPath(ctx, cx, cy, radius, sides, rotation = 0) {
  ctx.beginPath()
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function starPath(ctx, cx, cy, outerRadius, innerRadius, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath()
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius
    const angle = rotation + (i * Math.PI) / points
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.closePath()
}

function heartPath(ctx, cx, cy, size) {
  ctx.beginPath()
  const topCurveHeight = size * 0.3
  ctx.moveTo(cx, cy + topCurveHeight)
  ctx.bezierCurveTo(cx, cy, cx - size / 2, cy, cx - size / 2, cy + topCurveHeight)
  ctx.bezierCurveTo(cx - size / 2, cy + (size + topCurveHeight) / 2, cx, cy + (size + topCurveHeight) / 1.3, cx, cy + size)
  ctx.bezierCurveTo(cx, cy + (size + topCurveHeight) / 1.3, cx + size / 2, cy + (size + topCurveHeight) / 2, cx + size / 2, cy + topCurveHeight)
  ctx.bezierCurveTo(cx + size / 2, cy, cx, cy, cx, cy + topCurveHeight)
  ctx.closePath()
}

function drawFace({ ctx, style, color, eyeScale, mouthScale, trackCursor, gaze }) {
  const { width, height } = ctx.canvas
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = color || '#0f4c81'
  const cx = width / 2
  const cy = height / 2
  const pad = Math.max(10, width * 0.08)

  if (!trackCursor) {
    switch (style) {
      case 'robot': {
        const r = 14
        ctx.beginPath()
        ctx.moveTo(pad + r, pad)
        ctx.arcTo(width - pad, pad, width - pad, height - pad, r)
        ctx.arcTo(width - pad, height - pad, pad, height - pad, r)
        ctx.arcTo(pad, height - pad, pad, pad, r)
        ctx.arcTo(pad, pad, width - pad, pad, r)
        ctx.closePath()
        ctx.fill()
        break
      }
      case 'triangle':
        regularPolygonPath(ctx, cx, cy + height * 0.06, (width - pad * 2) / 2, 3, -Math.PI / 2)
        ctx.fill()
        break
      case 'star':
        starPath(ctx, cx, cy, (width - pad * 2) / 2, (width - pad * 2) / 4.6)
        ctx.fill()
        break
      case 'hexagon':
        regularPolygonPath(ctx, cx, cy, (width - pad * 2) / 2, 6, Math.PI / 6)
        ctx.fill()
        break
      case 'diamond':
        regularPolygonPath(ctx, cx, cy, (width - pad * 2) / 2, 4, Math.PI / 4)
        ctx.fill()
        break
      case 'heart':
        heartPath(ctx, cx, cy - height * 0.22, width - pad * 2.4)
        ctx.fill()
        break
      case 'round':
      default:
        renderBasicFace({ ctx, eyeScale, mouthScale, color })
        return // renderBasicFace tự vẽ luôn mắt/miệng, không cần gọi thêm
    }
    drawEyesAndMouth(ctx, width, height, eyeScale, mouthScale)
    return
  }

  // ─── Chế độ trackCursor=true: vẽ hình nền (kể cả 'round') rồi vẽ mắt/mũi/miệng nhìn theo chuột ───
  switch (style) {
    case 'robot': {
      const r = 14
      ctx.beginPath()
      ctx.moveTo(pad + r, pad)
      ctx.arcTo(width - pad, pad, width - pad, height - pad, r)
      ctx.arcTo(width - pad, height - pad, pad, height - pad, r)
      ctx.arcTo(pad, height - pad, pad, pad, r)
      ctx.arcTo(pad, pad, width - pad, pad, r)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'triangle':
      regularPolygonPath(ctx, cx, cy + height * 0.06, (width - pad * 2) / 2, 3, -Math.PI / 2)
      ctx.fill()
      break
    case 'star':
      starPath(ctx, cx, cy, (width - pad * 2) / 2, (width - pad * 2) / 4.6)
      ctx.fill()
      break
    case 'hexagon':
      regularPolygonPath(ctx, cx, cy, (width - pad * 2) / 2, 6, Math.PI / 6)
      ctx.fill()
      break
    case 'diamond':
      regularPolygonPath(ctx, cx, cy, (width - pad * 2) / 2, 4, Math.PI / 4)
      ctx.fill()
      break
    case 'heart':
      heartPath(ctx, cx, cy - height * 0.22, width - pad * 2.4)
      ctx.fill()
      break
    case 'round':
    default:
      drawRoundBackground(ctx, width, height, color)
      break
  }
  drawGazeEyesNoseMouth(ctx, width, height, eyeScale, mouthScale, gaze)
}

// state → (eyeScale, mouthScale) theo thời gian — công thức lấy nguyên từ
// HeroMicVoiceButton gốc để giữ đúng "cảm giác" quen thuộc.
function faceValuesForState(state, t) {
  if (state === 'listening') return { eyeScale: 1.15, mouthScale: 0.08 }
  if (state === 'thinking') return { eyeScale: 0.55 + Math.sin(t * 3) * 0.15, mouthScale: 0.08 }
  if (state === 'speaking') return { eyeScale: 1, mouthScale: 0.15 + Math.abs(Math.sin(t * 8)) * 0.35 }
  return { eyeScale: (t % 4) > 3.85 ? 0.15 : 1, mouthScale: 0.12 } // idle: chớp mắt thỉnh thoảng
}

export default function SharedFaceAvatar({ state = 'idle', color, style = 'round', size = 64, trackCursor = false }) {
  const canvasRef = useRef(null)
  const mouseRef = useRef({ x: 0, y: 0, has: false })
  // renderBasicFace (style 'round') trừ cứng 20px cho bán kính nền → cần
  // canvas tối thiểu ~112px nội bộ để không bị biến mất/méo ở size nhỏ.
  const renderSize = Math.max(size, 112)

  useEffect(() => {
    if (!trackCursor) return
    const onMove = (e) => { mouseRef.current = { x: e.clientX, y: e.clientY, has: true } }
    window.addEventListener('mousemove', onMove, { passive: true })
    return () => window.removeEventListener('mousemove', onMove)
  }, [trackCursor])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    let frameId
    const start = performance.now()
    const draw = (now) => {
      const t = (now - start) / 1000
      const { eyeScale, mouthScale } = faceValuesForState(state, t)
      let gaze = { x: 0, y: 0 }
      if (trackCursor && mouseRef.current.has && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = mouseRef.current.x - cx
        const dy = mouseRef.current.y - cy
        const dist = Math.hypot(dx, dy) || 1
        const magnitude = Math.min(1, dist / 380) // càng xa càng "nhìn" lệch nhiều, tối đa ở ~380px
        gaze = { x: (dx / dist) * magnitude, y: (dy / dist) * magnitude }
      }
      drawFace({ ctx, style, color, eyeScale, mouthScale, trackCursor, gaze })
      frameId = requestAnimationFrame(draw)
    }
    frameId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frameId)
  }, [state, style, color, trackCursor])

  return (
    <canvas
      className="shared-face-avatar"
      ref={canvasRef}
      width={renderSize}
      height={renderSize}
      style={{
        display: 'block',
        width: size,
        height: size,
        borderRadius: style === 'round' ? '50%' : style === 'robot' ? 14 : 0,
      }}
    />
  )
}
