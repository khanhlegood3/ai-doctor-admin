// src/components/aiChatbotControl/EmbeddedGlobalAIChat.jsx
//
// "💬 Chat AI chung" — tab chat văn bản + giọng nói NHÚNG THẲNG vào trang
// "🤖 AI chatbot control", dùng CHUNG một bộ não với:
//   - GlobalAIChatbot.jsx     (popup góc màn hình mọi trang)
//   - ChatHistoryPanel.jsx    (trang "Lịch sử Chat với AI")
//   - heroPanels/HeroMicVoiceButton.jsx (nút mic 2 trang "Anh Hùng")
//
// Tất cả đều gọi useGlobalAIChatbotEngine() → đọc/ghi vào CÙNG 1 kho
// IndexedDB (src/lib/globalChatbotStorage.js, khoá theo user?.uuid), và
// phát/nghe CÙNG 1 sự kiện đồng bộ (GLOBAL_CHATBOT_SYNC_EVENT). Vì vậy:
//   - Chat ở đây → hiện ngay lập tức ở popup góc màn hình & trang Lịch sử
//     Chat (nếu đang mở song song), không cần tải lại trang.
//   - Mở lại tab này sau → thấy lại TOÀN BỘ lịch sử đã chat ở bất kỳ đâu
//     trong dự án (popup, trang Lịch sử Chat, mic 2 trang Anh Hùng...).
//   - Hỗ trợ song ngữ Việt/English tự động theo AppContext (lang), y hệt
//     các nơi khác — không cần cấu hình gì thêm.
//
// Không tạo state/storage riêng — cố tình để trống mọi logic lưu trữ ở
// đây, mượn 100% từ hook dùng chung.

import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext.jsx'
import { useGlobalAIChatbotEngine, quickPrompts, MAX_FILES, getModeLabel } from '../../lib/useGlobalAIChatbotEngine.js'
import SharedFaceAvatar from './components/demo/basic-face/SharedFaceAvatar.jsx'
import FaceAvatarPicker from './components/demo/basic-face/FaceAvatarPicker.jsx'
import { useAgent } from './lib/state'

export default function EmbeddedGlobalAIChat({ activePanelLabel, trackCursor = true }) {
  const { theme, lang } = useApp()
  const { user } = useAuth()
  const isDark = theme === 'dark'
  const isVi = lang !== 'en'
  const userKey = user?.uuid || null

  const scrollRef = useRef(null)
  const docInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const audioElementRef = useRef(null)
  const [showPlaybackControls, setShowPlaybackControls] = useState(true)

  const {
    messages,
    input, setInput,
    status,
    mode,
    busy,
    historyLoaded,
    attachedFiles,
    handleFilesSelect, removeAttachedFile,
    submitQuestion,
    speaking, speak, stop, speechPaused, pauseSpeaking, resumeSpeaking, replaySpeaking,
    speechVolume, setSpeechVolume, speechRate, setSpeechRate, hasSpeechReplay,
    recording, transcribing, toggleMic, voiceError,
  } = useGlobalAIChatbotEngine({
    userKey,
    activePanelLabel: activePanelLabel || 'AI chatbot control',
    isVi,
    audioElementRef,
  })

  useEffect(() => {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 30)
  }, [messages, busy])

  const handleMicPress = () => {
    if (speaking) stop()
    toggleMic()
  }

  const faceColor = useAgent(state => state.current?.bodyColor) || '#14b8a6'
  const faceStyle = useAgent(state => state.current?.faceStyle) || 'round'
  const faceState = recording ? 'listening' : (transcribing || busy) ? 'thinking' : speaking ? 'speaking' : 'idle'
  const [showFaceSettings, setShowFaceSettings] = useState(false)

  const border = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 76, 129, 0.16)'
  const text = isDark ? '#e8f0f8' : '#102033'
  const muted = isDark ? 'rgba(226, 232, 240, 0.64)' : '#64748b'
  const shell = isDark ? 'rgba(7, 12, 27, 0.5)' : 'rgba(255, 255, 255, 0.6)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        borderRadius: 18,
        border: `1px solid ${border}`,
        background: shell,
        overflow: 'hidden',
      }}
    >
      <audio ref={audioElementRef} preload="none" style={{ display: 'none' }} />

      <div
        style={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 14px',
          borderBottom: `1px solid ${border}`,
          color: muted,
          fontSize: 11,
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setShowFaceSettings(v => !v)}
          title={isVi ? 'Đổi màu / phong cách khuôn mặt' : 'Change face color / style'}
          style={{ width: 64, height: 64, borderRadius: faceStyle === 'robot' ? 16 : '50%', background: isDark ? 'rgba(15,23,42,0.6)' : '#fff', border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0, cursor: 'pointer', flexShrink: 0 }}
        >
          <SharedFaceAvatar state={faceState} size={62} color={faceColor} style={faceStyle} trackCursor={trackCursor} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ color: '#0f766e', background: isDark ? 'rgba(45, 212, 191, 0.16)' : '#ccfbf1', borderRadius: 999, padding: '3px 8px', fontWeight: 900, alignSelf: 'flex-start' }}>
            {getModeLabel(mode, isVi)}
          </span>
          <span style={{ fontWeight: 800 }}>{status}</span>
        </div>
        <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>
          {isVi ? 'Đồng bộ với chatbot chung toàn dự án' : 'Synced with the project-wide chatbot'}
        </span>
      </div>

      {showFaceSettings && (
        <div style={{ flex: '0 0 auto', padding: '10px 14px', borderBottom: `1px solid ${border}` }}>
          <FaceAvatarPicker isDark={isDark} isVi={isVi} border={border} text={text} muted={muted} />
        </div>
      )}

      <div
        ref={scrollRef}
        style={{ flex: '1 1 auto', minHeight: 0, padding: 14, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        {!historyLoaded && (
          <div style={{ textAlign: 'center', color: muted, fontSize: 12, padding: 20 }}>
            {isVi ? 'Đang tải lịch sử chat...' : 'Loading chat history...'}
          </div>
        )}
        {historyLoaded && messages.map(message => (
          <div key={message.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={message.role === 'user' ? userMsgStyle : botMsgStyle(isDark, text)}>
              {message.imageDataUrls && message.imageDataUrls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.text ? 8 : 0 }}>
                  {message.imageDataUrls.map((img, i) => (
                    img.kind === 'pdf' ? (
                      <div key={i} style={{ width: 56, height: 56, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        📄
                        <span style={{ fontSize: 8, marginTop: 2, maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</span>
                      </div>
                    ) : (
                      <img key={i} src={img.dataUrl} alt={img.name || 'attached'} style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
                    )
                  ))}
                </div>
              )}
              {message.fileNames && message.fileNames.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.text ? 8 : 0 }}>
                  {message.fileNames.map((name, i) => (
                    <span key={i} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.14)' }}>📃 {name}</span>
                  ))}
                </div>
              )}
              {message.text}
            </div>
            {message.role === 'assistant' && (
              <button
                type="button"
                onClick={() => speak(message.text, { restart: true })}
                title={isVi ? 'Đọc to / nghe lại bằng giọng nói' : 'Read aloud / replay with voice'}
                style={speakBtnStyle(isDark, border, muted)}
              >
                🔊
              </button>
            )}
          </div>
        ))}
        {busy && mode === 'thinking' && (
          <div style={botMsgStyle(isDark, text)}>
            <span style={{ display: 'inline-flex', gap: 4 }}>
              <span style={typingDotStyle} /><span style={typingDotStyle} /><span style={typingDotStyle} />
            </span>
          </div>
        )}
      </div>

      {(speaking || hasSpeechReplay) && (
        <div style={{ flex: '0 0 auto', padding: '0 14px 10px' }}>
          <button
            type="button"
            onClick={() => setShowPlaybackControls(v => !v)}
            style={{ border: `1px solid ${border}`, borderRadius: 999, padding: '6px 10px', background: isDark ? 'rgba(15,23,42,0.74)' : '#fff', color: text, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
          >
            🔊 {showPlaybackControls ? (isVi ? 'Ẩn loa' : 'Hide speaker') : (isVi ? 'Hiện loa' : 'Show speaker')}
          </button>
          {showPlaybackControls && (
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {speaking && (
                <button type="button" onClick={speechPaused ? resumeSpeaking : pauseSpeaking} style={smallBtnStyle(isDark, border, text)}>
                  {speechPaused ? (isVi ? '▶️ Nghe tiếp' : '▶️ Resume') : (isVi ? '⏸️ Tạm dừng' : '⏸️ Pause')}
                </button>
              )}
              <button type="button" onClick={replaySpeaking} style={smallBtnStyle(isDark, border, text)}>
                {isVi ? '🔁 Nghe lại' : '🔁 Replay'}
              </button>
              {speaking && (
                <button type="button" onClick={stop} style={{ ...smallBtnStyle(isDark, border, text), background: '#ef4444', color: '#fff', border: 'none' }}>
                  {isVi ? '⏹️ Dừng' : '⏹️ Stop'}
                </button>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: muted, fontWeight: 700 }}>
                {isVi ? 'Âm lượng' : 'Volume'}
                <input type="range" min="0" max="1" step="0.05" value={speechVolume} onChange={e => setSpeechVolume(e.target.value)} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: muted, fontWeight: 700 }}>
                {isVi ? 'Tốc độ' : 'Speed'}
                <input type="range" min="0.5" max="2" step="0.05" value={speechRate} onChange={e => setSpeechRate(e.target.value)} />
              </label>
            </div>
          )}
        </div>
      )}

      {voiceError && (
        <div style={{ flex: '0 0 auto', padding: '0 14px 10px', color: '#ef4444', fontSize: 11, fontWeight: 700 }}>
          {voiceError}
        </div>
      )}

      {attachedFiles.length > 0 && (
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: '0 14px 10px', overflowX: 'auto', scrollbarWidth: 'thin' }}>
          {attachedFiles.map(f => (
            <div key={f.id} style={{ position: 'relative', flexShrink: 0 }}>
              {f.kind === 'image' ? (
                <img src={f.dataUrl} alt={f.name} title={f.name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
              ) : (
                <div title={f.name} style={{ width: 52, height: 52, borderRadius: 12, background: isDark ? 'rgba(15,23,42,0.74)' : '#fff', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                  {f.kind === 'pdf' ? '📄' : '📃'}
                  <span style={{ fontSize: 8, marginTop: 2, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: text }}>{f.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachedFile(f.id)}
                title={isVi ? 'Bỏ file' : 'Remove file'}
                style={{ position: 'absolute', top: -6, right: -6, border: 'none', background: '#fff', color: '#1a2035', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', fontSize: 11, lineHeight: '18px', padding: 0, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', fontWeight: 800 }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div style={{ flex: '0 0 auto', display: 'flex', gap: 6, padding: '0 14px 10px', overflowX: 'auto', scrollbarWidth: 'thin' }}>
        {quickPrompts.map(prompt => (
          <button key={prompt} type="button" disabled={busy} onClick={() => submitQuestion(prompt)} style={quickBtnStyle(isDark, border, text)}>
            {prompt}
          </button>
        ))}
      </div>

      <form
        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'stretch', gap: 8, padding: 14, borderTop: `1px solid ${border}` }}
        onSubmit={(event) => {
          event.preventDefault()
          submitQuestion()
        }}
      >
        <input
          ref={docInputRef}
          type="file"
          accept="image/*,application/pdf,text/plain,text/csv,.csv,.txt,.md"
          multiple
          onChange={handleFilesSelect}
          style={{ display: 'none' }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFilesSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => docInputRef.current?.click()}
          disabled={busy || attachedFiles.length >= MAX_FILES}
          title={isVi ? `Tải file (PDF, văn bản, CSV, hình ảnh) — tối đa ${MAX_FILES} file` : `Upload files (PDF, text, CSV, images) — up to ${MAX_FILES}`}
          style={{ ...iconBtnStyle(isDark, border), opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1, cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer', fontWeight: 900, fontSize: 18 }}
        >
          +
        </button>
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder={isVi ? 'Hỏi chatbot chung hoặc nói bằng giọng nói...' : 'Ask the chatbot or use your voice...'}
          rows={2}
          style={inputStyle(isDark, border, text)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submitQuestion()
            }
          }}
        />
        <button
          type="button"
          onClick={handleMicPress}
          disabled={busy && !recording}
          title={recording ? (isVi ? 'Dừng ghi âm' : 'Stop recording') : (isVi ? 'Nói để hỏi' : 'Speak to ask')}
          style={{
            ...iconBtnStyle(isDark, border),
            ...(recording ? { background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: '1px solid rgba(239,68,68,0.6)' } : {}),
            opacity: transcribing ? 0.7 : 1,
            cursor: transcribing ? 'wait' : 'pointer',
          }}
        >
          {transcribing ? '⏳' : recording ? '⏹️' : '🎙️'}
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy || attachedFiles.length >= MAX_FILES}
          title={isVi ? `Tải hình ảnh để AI phân tích sâu (tối đa ${MAX_FILES})` : `Upload images for deep AI analysis (up to ${MAX_FILES})`}
          style={{
            ...iconBtnStyle(isDark, border),
            ...(attachedFiles.length > 0 ? { background: 'linear-gradient(135deg,#14b8a6,#0f766e)', color: '#fff', border: '1px solid rgba(20,184,166,0.6)' } : {}),
            opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1,
            cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer',
          }}
        >
          🖼️
        </button>
        <button
          type="submit"
          disabled={busy || (!input.trim() && attachedFiles.length === 0)}
          style={{ ...sendBtnStyle, opacity: busy || (!input.trim() && attachedFiles.length === 0) ? 0.55 : 1 }}
        >
          {busy ? '...' : (isVi ? 'Gửi' : 'Send')}
        </button>
      </form>
      <div style={{ padding: '0 14px 12px', fontSize: 10.5, color: muted, lineHeight: 1.4 }}>
        {isVi
          ? 'Tin nhắn ở đây được lưu vào IndexedDB và đồng bộ song song với chatbot AI chung ở góc màn hình, trang Lịch sử Chat, và mic thoại 2 trang Anh Hùng.'
          : 'Messages here are saved to IndexedDB and stay in sync with the corner chatbot widget, the Chat History page, and the voice mic on both Hero pages.'}
      </div>
      <style>{`@keyframes globalChatbotDotBounceEmbedded { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }`}</style>
    </div>
  )
}

const typingDotStyle = {
  width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block',
  animation: 'globalChatbotDotBounceEmbedded 1.1s ease-in-out infinite',
}

const userMsgStyle = { alignSelf: 'flex-end', maxWidth: '84%', padding: '11px 13px', borderRadius: '16px 16px 5px 16px', background: 'linear-gradient(135deg, #0f4c81, #2563eb)', color: '#fff', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }

function botMsgStyle(isDark, text) {
  return { alignSelf: 'flex-start', maxWidth: '88%', padding: '11px 13px', borderRadius: '16px 16px 16px 5px', background: isDark ? 'rgba(30, 41, 59, 0.82)' : '#f1f5f9', color: text, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }
}

function speakBtnStyle(isDark, border, muted) {
  return { border: `1px solid ${border}`, borderRadius: 8, padding: '3px 7px', fontSize: 12, cursor: 'pointer', background: isDark ? 'rgba(15,23,42,0.6)' : '#fff', color: muted, lineHeight: 1 }
}

function smallBtnStyle(isDark, border, text) {
  return { border: `1px solid ${border}`, borderRadius: 999, padding: '6px 10px', background: isDark ? 'rgba(15,23,42,0.74)' : '#fff', color: text, fontSize: 11, fontWeight: 800, cursor: 'pointer' }
}

function quickBtnStyle(isDark, border, text) {
  return { flexShrink: 0, border: `1px solid ${border}`, borderRadius: 999, padding: '7px 10px', background: isDark ? 'rgba(15,23,42,0.74)' : '#fff', color: text, fontSize: 11, fontWeight: 800, cursor: 'pointer' }
}

function iconBtnStyle(isDark, border) {
  return { border: `1px solid ${border}`, borderRadius: 14, padding: '0 14px', fontSize: 16, background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', color: isDark ? '#a5b4fc' : '#6366f1', cursor: 'pointer', transition: 'all 0.18s', lineHeight: 1 }
}

function inputStyle(isDark, border, text) {
  return { flex: 1, resize: 'none', border: `1px solid ${border}`, borderRadius: 14, padding: '10px 12px', outline: 'none', font: 'inherit', fontSize: 13, color: text, background: isDark ? 'rgba(15, 23, 42, 0.82)' : '#fff' }
}

const sendBtnStyle = { border: 'none', borderRadius: 14, padding: '0 16px', color: '#fff', background: 'linear-gradient(135deg, #14b8a6, #0f4c81)', fontWeight: 900, cursor: 'pointer' }
