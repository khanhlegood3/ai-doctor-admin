/**
 * TranscriptPanel — hiển thị lịch sử hội thoại với companion (khuôn mặt AI)
 * ngay trong panel "AI chatbot control". Dữ liệu đến từ useVoiceCompanion()
 * (qua VoiceCompanionContext), vốn đọc/ghi CÙNG IndexedDB mà toàn dự án dùng
 * chung (src/lib/globalChatbotStorage.js) — nên lịch sử ở đây luôn khớp với
 * "Lịch sử Chat với AI" và tự động đồng bộ nếu người dùng mở panel khác.
 */
import React, { useEffect, useRef, useState } from 'react'
import { useLiveAPIContext } from '../contexts/VoiceCompanionContext'

export default function TranscriptPanel() {
  const { messages, historyLoaded, clearHistory } = useLiveAPIContext()
  const [expanded, setExpanded] = useState(true)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length, expanded])

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }
    clearHistory()
    setConfirmingClear(false)
  }

  return (
    <div className={`transcript-panel${expanded ? ' expanded' : ''}`}>
      <div className="transcript-panel-header">
        <button
          type="button"
          className="transcript-toggle"
          onClick={() => setExpanded(v => !v)}
        >
          <span className="material-symbols-outlined">
            {expanded ? 'expand_more' : 'expand_less'}
          </span>
          Lịch sử hội thoại {messages.length > 0 ? `(${messages.length})` : ''}
        </button>
        {messages.length > 0 && (
          <button
            type="button"
            className={`transcript-clear${confirmingClear ? ' confirming' : ''}`}
            onClick={handleClear}
            onBlur={() => setConfirmingClear(false)}
          >
            {confirmingClear ? 'Bấm lại để xoá hẳn' : 'Xoá lịch sử'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="transcript-panel-body" ref={scrollRef}>
          {!historyLoaded ? (
            <p className="transcript-empty">Đang tải lịch sử…</p>
          ) : messages.length === 0 ? (
            <p className="transcript-empty">
              Chưa có hội thoại nào. Nhấn nút phát ▶ để bắt đầu, rồi bấm mic để nói.
            </p>
          ) : (
            messages.map(m => (
              <div key={m.id} className={`transcript-line transcript-line-${m.role}`}>
                <span className="transcript-role">{m.role === 'user' ? 'Bạn' : 'AI'}</span>
                <span className="transcript-text">{m.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
