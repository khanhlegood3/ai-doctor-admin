/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo), adapted to read
 * `error`/`setError` from the free VoiceCompanionContext instead of
 * subscribing to a Gemini Live `client` event emitter.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { useLiveAPIContext } from '../../contexts/VoiceCompanionContext'
import React from 'react'

export default function ErrorScreen() {
  const { error, setError } = useLiveAPIContext()

  if (!error) {
    return <div style={{ display: 'none' }} />
  }

  const errorMessage =
    error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED')
      ? 'Gemini API miễn phí có giới hạn số lượt gọi mỗi ngày. Vui lòng thử lại sau ít phút hoặc vào ngày mai.'
      : error?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.'

  return (
    <div className="error-screen">
      <div style={{ fontSize: 48 }}>💔</div>
      <div
        className="error-message-container"
        style={{ fontSize: 22, lineHeight: 1.2, opacity: 0.5 }}
      >
        {errorMessage}
      </div>
      <button className="close-button" onClick={() => setError(null)}>
        Close
      </button>
    </div>
  )
}
