/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo), adapted to the
 * free architecture: greeting + reply generation now happen inside
 * hooks/useVoiceCompanion.js (connect() sends the greeting itself).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 *
 * TAP-TO-TALK TRỰC TIẾP TRÊN KHUÔN MẶT AVATAR — thay cho 2 nút mic + play/pause
 * tách rời trước đây (xem ControlTray.jsx, không còn dùng), giờ đồng bộ UX với
 * mic bấm-để-nói trên 2 trang "Anh Hùng" (xem heroPanels/HeroMicVoiceButton.jsx):
 * một điểm chạm duy nhất, không có nút riêng biệt cho "kết nối" và "nói".
 *
 * Luồng bấm vào khuôn mặt:
 *   1. Lần đầu (chưa connected) → connect() — AI chào + đọc to lời chào.
 *   2. Khi đã connected, đang rảnh (không nghe/không nói/không xử lý) → bấm
 *      để bắt đầu ghi âm (startListening — vẫn push-to-talk, tự dừng khi
 *      ngừng nói nhờ SpeechRecognition).
 *   3. Khi đang nghe / đang xử lý / đang nói → bấm không có tác dụng (tránh
 *      chồng chéo trạng thái) — nhãn trạng thái dưới avatar cho biết lý do.
 */
import React, { useRef } from 'react'

import BasicFace from '../basic-face/BasicFace'
import { useAgent } from '../../../lib/state'
import { useLiveAPIContext } from '../../../contexts/VoiceCompanionContext'

export default function KeynoteCompanion() {
  const faceCanvasRef = useRef(null)
  const { current } = useAgent()
  const {
    connected,
    connect,
    listening,
    speaking,
    thinking,
    startListening,
    listenHint,
  } = useLiveAPIContext()

  const busy = listening || speaking || thinking
  const label = listening
    ? 'Đang nghe…'
    : thinking
    ? 'Đang suy nghĩ…'
    : speaking
    ? 'Đang nói…'
    : connected
    ? 'Nhấn vào để nói'
    : 'Nhấn vào để bắt đầu trò chuyện'

  const handleFaceClick = () => {
    if (busy) return
    if (!connected) {
      connect()
      return
    }
    startListening()
  }

  return (
    <div className="keynote-companion">
      <button
        type="button"
        className={`keynote-face-button${listening ? ' is-listening' : ''}${
          speaking ? ' is-speaking' : ''
        }${thinking ? ' is-thinking' : ''}`}
        onClick={handleFaceClick}
        disabled={busy}
        aria-label={label}
        title={label}
      >
        <BasicFace canvasRef={faceCanvasRef} color={current.bodyColor} />
      </button>
      <span className="keynote-face-label">{label}</span>
      {listenHint && <div className="keynote-listen-hint">{listenHint}</div>}
    </div>
  )
}
