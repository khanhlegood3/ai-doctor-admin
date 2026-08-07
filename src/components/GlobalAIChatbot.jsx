import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext.jsx'
import { useGlobalAIChatbotEngine, quickPrompts, MAX_FILES, getModeLabel } from '../lib/useGlobalAIChatbotEngine.js'
import SharedFaceAvatar from './aiChatbotControl/components/demo/basic-face/SharedFaceAvatar.jsx'
import FaceAvatarPicker from './aiChatbotControl/components/demo/basic-face/FaceAvatarPicker.jsx'
import { useAgent } from './aiChatbotControl/lib/state'

// Single named export used by the journey panels; do not add a second no-op export below.
export function CompactGlobalAIChatBar({ activePanelLabel }) {
  const { theme, lang } = useApp()
  const { user } = useAuth()
  const isDark = theme === 'dark'
  const isVi = lang !== 'en'
  const userKey = user?.uuid || null
  const docInputRef = useRef(null)
  const imageInputRef = useRef(null)
  const audioElementRef = useRef(null)
  const [showPlaybackControls, setShowPlaybackControls] = useState(true)

  const {
    input, setInput,
    busy,
    attachedFiles,
    handleFilesSelect,
    submitQuestion,
    recording, transcribing, toggleMic,
    speaking, stop, speechPaused, pauseSpeaking, resumeSpeaking, replaySpeaking,
    speechVolume, setSpeechVolume, speechRate, setSpeechRate, hasSpeechReplay,
  } = useGlobalAIChatbotEngine({ userKey, activePanelLabel, isVi, audioElementRef })

  const submitFromBar = () => {
    if (!input.trim() && attachedFiles.length === 0) return
    submitQuestion()
  }

  const handleMicPress = () => {
    if (speaking) stop()
    toggleMic()
  }

  const shell = isDark ? '#070d20' : '#eef6ff'
  const control = isDark ? '#171d3a' : '#ffffff'
  const border = isDark ? '#323a66' : '#b9c9e8'
  const text = isDark ? '#e6ecff' : '#102033'
  const muted = isDark ? '#9aa3b7' : '#64748b'

  return (
    <form
      aria-label={isVi ? 'Bộ chat AI chung' : 'Shared AI chat bar'}
      onSubmit={(event) => {
        event.preventDefault()
        submitFromBar()
      }}
      style={{
        width: 'min(100%, 760px)',
        display: 'grid',
        gridTemplateColumns: '80px minmax(0, 1fr) 92px 92px 112px',
        gap: 14,
        alignItems: 'stretch',
        padding: 14,
        borderRadius: 26,
        background: shell,
        boxShadow: isDark ? '0 24px 70px rgba(0,0,0,0.34)' : '0 18px 54px rgba(15,76,129,0.14)',
        border: `1px solid ${isDark ? 'rgba(148,163,184,0.10)' : 'rgba(15,76,129,0.10)'}`,
      }}
    >
      <audio ref={audioElementRef} preload="none" style={{ display: 'none' }} />
      <input ref={docInputRef} type="file" accept="image/*,application/pdf,text/plain,text/csv,.csv,.txt,.md" multiple onChange={handleFilesSelect} style={{ display: 'none' }} />
      <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelect} style={{ display: 'none' }} />
      <button type="button" onClick={() => docInputRef.current?.click()} disabled={busy} title={isVi ? 'Đính kèm file' : 'Attach files'} style={{ border: `2px solid ${border}`, borderRadius: 26, background: control, color: isDark ? '#dbe5ff' : '#1e3a8a', fontSize: 34, fontWeight: 900, cursor: busy ? 'not-allowed' : 'pointer' }}>+</button>
      <textarea
        value={input}
        onChange={event => setInput(event.target.value)}
        placeholder={isVi ? 'Hỏi chatbot chung\nhoặc nói bằng giọng nói' : 'Ask the shared chatbot\nor use your voice'}
        rows={2}
        onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            submitFromBar()
          }
        }}
        style={{ resize: 'none', minHeight: 92, border: `2px solid ${border}`, borderRadius: 24, padding: '22px 24px', outline: 'none', font: 'inherit', fontSize: 24, lineHeight: 1.45, color: text, background: control }}
      />
      <button type="button" onClick={handleMicPress} disabled={busy && !recording} title={recording ? (isVi ? 'Dừng ghi âm' : 'Stop recording') : (isVi ? 'Nói để hỏi' : 'Speak to ask')} style={{ border: `2px solid ${recording ? '#ef4444' : border}`, borderRadius: 26, background: recording ? 'linear-gradient(135deg,#ef4444,#dc2626)' : control, color: recording ? '#fff' : text, fontSize: 30, cursor: transcribing ? 'wait' : 'pointer' }}>{transcribing ? '⏳' : recording ? '⏹️' : '🎙️'}</button>
      <button type="button" onClick={() => imageInputRef.current?.click()} disabled={busy} title={isVi ? 'Tải hình ảnh cho AI phân tích' : 'Upload image for AI analysis'} style={{ border: `2px solid ${attachedFiles.length ? '#14b8a6' : border}`, borderRadius: 26, background: control, color: text, fontSize: 30, cursor: busy ? 'not-allowed' : 'pointer' }}>🖼️</button>
      <button type="submit" disabled={busy || (!input.trim() && attachedFiles.length === 0)} style={{ border: 'none', borderRadius: 26, color: '#d8e7ea', background: 'linear-gradient(135deg,#187c86,#0f6674)', fontWeight: 900, fontSize: 24, cursor: busy ? 'wait' : 'pointer', opacity: busy || (!input.trim() && attachedFiles.length === 0) ? 0.65 : 1 }}>{busy ? '...' : speaking ? (isVi ? 'Đọc' : 'Play') : (isVi ? 'Gửi' : 'Send')}</button>
      {(speaking || hasSpeechReplay) && (
        <PlaybackControlsRegion
          isVi={isVi}
          isDark={isDark}
          compact
          visible={showPlaybackControls}
          onToggleVisible={() => setShowPlaybackControls(v => !v)}
          speaking={speaking}
          paused={speechPaused}
          onPause={pauseSpeaking}
          onResume={resumeSpeaking}
          onStop={stop}
          onReplay={replaySpeaking}
          volume={speechVolume}
          onVolumeChange={setSpeechVolume}
          rate={speechRate}
          onRateChange={setSpeechRate}
          style={{ gridColumn: '1 / -1' }}
        />
      )}
      {attachedFiles.length > 0 && <div style={{ gridColumn: '1 / -1', color: muted, fontSize: 12, fontWeight: 800 }}>{isVi ? `Đã đính kèm ${attachedFiles.length} file` : `${attachedFiles.length} file(s) attached`}</div>}
    </form>
  )
}

export default function GlobalAIChatbot({ activePanelLabel }) {
  const { theme, lang } = useApp()
  const { user } = useAuth()
  // Storage key for chat history — `uuid` is the same identifier field for every
  // user type (guest or signed-in), so each guest's history stays separate too.
  const userKey = user?.uuid || null
  const isDark = theme === 'dark'
  const isVi = lang !== 'en'

  const [open, setOpen] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const fileInputRef = useRef(null)
  const docInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const scrollRef = useRef(null)
  const audioElementRef = useRef(null)
  const [showPlaybackControls, setShowPlaybackControls] = useState(true)

  // Toàn bộ state + logic gửi tin/đính kèm file/giọng nói/lưu lịch sử dùng CHUNG 1 hook
  // với trang "Lịch sử Chat với AI" (src/components/ChatHistoryPanel.jsx) VÀ với nút mic
  // trao đổi thoại trực tiếp trên 2 trang "Anh Hùng" (heroPanels/HeroMicVoiceButton.jsx)
  // — tất cả cùng đọc/ghi vào src/lib/globalChatbotStorage.js, nên luôn đồng bộ song song
  // với nhau: nói/gửi ở bất kỳ đâu trong số này, popup này (nếu đang mở) sẽ tự cập nhật
  // theo ngay, và khi mở lại popup sau đó cũng thấy đủ lịch sử.
  // Hook tự động đọc to (TTS) câu trả lời mới nhất ngay sau khi AI trả lời xong.
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
    recording, transcribing, toggleMic,
  } = useGlobalAIChatbotEngine({ userKey, activePanelLabel, isVi, audioElementRef })

  const styles = useMemo(() => createStyles(isDark, fullscreen), [isDark, fullscreen])

  const faceColor = useAgent(state => state.current?.bodyColor) || '#14b8a6'
  const faceStyle = useAgent(state => state.current?.faceStyle) || 'round'
  const faceState = recording ? 'listening' : (transcribing || busy) ? 'thinking' : speaking ? 'speaking' : 'idle'
  const [showFaceSettings, setShowFaceSettings] = useState(false)
  const pickerBorder = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 76, 129, 0.16)'
  const pickerText = isDark ? '#e6ecff' : '#102033'
  const pickerMuted = isDark ? '#9aa3b7' : '#64748b'

  useEffect(() => {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 30)
  }, [messages, busy])

  const handleMicPress = () => {
    if (speaking) stop()
    toggleMic()
  }

  const openChatHistory = () => {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('navigate-to-chat-history'))
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="global-ai-chatbot-fab" style={styles.fab} aria-label="Mở Hero AI">
        <span style={styles.fabIcon}>🦸</span>
        <span>
          <strong>Hero AI 🤗</strong>
          <small></small>
        </span>
      </button>
    )
  }

  const toggleFullscreenLabel = fullscreen ? (isVi ? 'Thu nhỏ' : 'Exit fullscreen') : (isVi ? 'Phóng to toàn màn hình' : 'Expand to fullscreen')
  const resizeIcon = fullscreen ? '⤡' : '⤢'

  return (
    <section className="global-ai-chatbot-panel" style={styles.panel} aria-label="Hero AI">
      <audio ref={audioElementRef} preload="none" style={{ display: 'none' }} />
      <button
        type="button"
        onClick={() => setFullscreen(v => !v)}
        style={styles.resizeBtnTop}
        title={toggleFullscreenLabel}
        aria-label={fullscreen ? 'Thu nhỏ chatbot' : 'Phóng to chatbot'}
      >
        {resizeIcon}
      </button>
      <button
        type="button"
        onClick={() => setFullscreen(v => !v)}
        style={styles.resizeBtnBottom}
        title={toggleFullscreenLabel}
        aria-label={fullscreen ? 'Thu nhỏ chatbot ở cạnh dưới' : 'Phóng to chatbot ở cạnh dưới'}
      >
        {resizeIcon}
      </button>
      <button type="button" onClick={() => setOpen(false)} style={{ ...styles.closeBtn, ...styles.closeTopLeft }} aria-label="Đóng chatbot ở góc trên trái">×</button>
      <button type="button" onClick={() => setOpen(false)} style={{ ...styles.closeBtn, ...styles.closeBottomLeft }} aria-label="Đóng chatbot ở góc dưới trái">×</button>
      <button type="button" onClick={() => setOpen(false)} style={{ ...styles.closeBtn, ...styles.closeBottomRight }} aria-label="Đóng chatbot ở góc dưới phải">×</button>
      <header style={{ ...styles.header, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => setShowFaceSettings(v => !v)}
          title={isVi ? 'Đổi màu / phong cách khuôn mặt' : 'Change face color / style'}
          style={{ width: 44, height: 44, borderRadius: faceStyle === 'robot' ? 12 : (faceStyle === 'round' ? '50%' : 10), background: isDark ? 'rgba(15,23,42,0.6)' : '#fff', border: `1px solid ${pickerBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: 0, cursor: 'pointer', flexShrink: 0, marginRight: 10 }}
        >
          <SharedFaceAvatar state={faceState} color={faceColor} style={faceStyle} size={42} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.title}>🦸 Hero AI 🤗</div>
          <div style={styles.subtitle}>{status}</div>
        </div>
        <button type="button" onClick={() => setOpen(false)} style={{ ...styles.closeBtn, ...styles.closeTopRight }} aria-label="Đóng chatbot">×</button>
      </header>

      {showFaceSettings && (
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${pickerBorder}` }}>
          <FaceAvatarPicker isDark={isDark} isVi={isVi} border={pickerBorder} text={pickerText} muted={pickerMuted} />
        </div>
      )}

      <div style={styles.metaRow}>
        <span style={styles.badge}>{getModeLabel(mode, isVi)}</span>
        <span style={styles.current}>{isVi ? 'Trợ lý website · Groq AI + giọng nói · tự động đọc trả lời' : 'Website assistant · Groq AI + voice · auto voice reply'}</span>
        <button type="button" onClick={openChatHistory} style={styles.historyBtn}>
          {isVi ? 'Xem lịch sử Chat' : 'View chat history'}
        </button>
        <span style={styles.current}>{isVi ? 'Mục hiện tại: ' : 'Current section: '}{activePanelLabel || 'Website'}</span>
      </div>

      <div ref={scrollRef} style={styles.messages}>
        {messages.map(message => (
          <div key={message.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: message.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={message.role === 'user' ? styles.userMsg : styles.botMsg}>
              {message.imageDataUrls && message.imageDataUrls.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: message.text ? 8 : 0 }}>
                  {message.imageDataUrls.map((img, i) => (
                    img.kind === 'pdf' ? (
                      <div key={i} style={{ width: 64, height: 64, borderRadius: 10, background: 'rgba(255,255,255,0.12)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        📄
                        <span style={{ fontSize: 8, marginTop: 2, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{img.name}</span>
                      </div>
                    ) : (
                      <img key={i} src={img.dataUrl} alt={img.name || 'attached'} style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', display: 'block' }} />
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
                style={styles.speakBtn}
              >
                🔊
              </button>
            )}
          </div>
        ))}
        {busy && mode === 'thinking' && (
          <div style={styles.botMsg}>
            <span style={styles.typingDots}>
              <span /><span /><span />
            </span>
          </div>
        )}
      </div>

      {(speaking || hasSpeechReplay) && (
        <PlaybackControlsRegion
          isVi={isVi}
          isDark={isDark}
          visible={showPlaybackControls}
          onToggleVisible={() => setShowPlaybackControls(v => !v)}
          speaking={speaking}
          paused={speechPaused}
          onPause={pauseSpeaking}
          onResume={resumeSpeaking}
          onStop={stop}
          onReplay={replaySpeaking}
          volume={speechVolume}
          onVolumeChange={setSpeechVolume}
          rate={speechRate}
          onRateChange={setSpeechRate}
        />
      )}

      {attachedFiles.length > 0 && (
        <div style={{ flex: '0 0 auto', display: 'flex', gap: 8, padding: '10px 14px 0', overflowX: 'auto', scrollbarWidth: 'thin' }}>
          {attachedFiles.map(f => (
            <div key={f.id} style={{ position: 'relative', flexShrink: 0 }}>
              {f.kind === 'image' ? (
                <img src={f.dataUrl} alt={f.name} title={f.name} style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', display: 'block' }} />
              ) : f.kind === 'pdf' ? (
                <div title={f.name} style={{ width: 56, height: 56, borderRadius: 12, background: styles.quickBtn.background, border: `1px solid ${styles.disclaimer.color}22`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  📄
                  <span style={{ fontSize: 8, marginTop: 2, maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: styles.disclaimer.color }}>{f.name}</span>
                </div>
              ) : (
                <div title={f.name} style={{ width: 56, height: 56, borderRadius: 12, background: styles.quickBtn.background, border: `1px solid ${styles.disclaimer.color}22`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                  📃
                  <span style={{ fontSize: 8, marginTop: 2, maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: styles.disclaimer.color }}>{f.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeAttachedFile(f.id)}
                title={isVi ? 'Bỏ file' : 'Remove file'}
                style={{
                  position: 'absolute', top: -6, right: -6, border: 'none',
                  background: '#fff', color: '#1a2035', borderRadius: '50%',
                  width: 18, height: 18, cursor: 'pointer', fontSize: 11, lineHeight: '18px',
                  padding: 0, textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', fontWeight: 800,
                }}
              >×</button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.quickRow}>
        {quickPrompts.map(prompt => (
          <button key={prompt} type="button" disabled={busy} onClick={() => submitQuestion(prompt)} style={styles.quickBtn}>
            {prompt}
          </button>
        ))}
      </div>

      <form
        style={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          submitQuestion()
        }}
      >
        {/* Hidden file inputs: general documents (pdf/text/csv/image) and camera capture */}
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
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilesSelect}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => docInputRef.current?.click()}
          disabled={busy || attachedFiles.length >= MAX_FILES}
          title={isVi ? `Tải file (PDF, văn bản, CSV, hình ảnh) — tối đa ${MAX_FILES} file` : `Upload files (PDF, text, CSV, images) — up to ${MAX_FILES}`}
          style={{
            ...styles.micBtn,
            opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1,
            cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer',
            fontWeight: 900, fontSize: 18,
          }}
        >
          +
        </button>
        <textarea
          value={input}
          onChange={event => setInput(event.target.value)}
          placeholder={isVi ? 'Hỏi chatbot chung hoặc nói bằng giọng nói...' : 'Ask the chatbot or use your voice...'}
          rows={2}
          style={styles.input}
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
            ...styles.micBtn,
            ...(recording ? styles.micBtnActive : {}),
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
            ...styles.micBtn,
            ...(attachedFiles.length > 0 ? styles.imageBtnActive : {}),
            opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1,
            cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer',
          }}
        >
          🖼️
        </button>
        <button type="submit" disabled={busy || (!input.trim() && attachedFiles.length === 0)} style={{ ...styles.sendBtn, opacity: busy || (!input.trim() && attachedFiles.length === 0) ? 0.55 : 1 }}>
          {busy ? '...' : (isVi ? 'Gửi' : 'Send')}
        </button>
      </form>
      <div style={styles.disclaimer}>{isVi
        ? 'Thông tin chỉ mang tính hỗ trợ, không thay thế tư vấn, chẩn đoán hoặc điều trị của bác sĩ.'
        : 'Information is for support purposes only and does not replace a doctor\'s advice, diagnosis, or treatment.'}</div>
      <style>{`
        @keyframes globalChatbotDotBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes globalChatbotMicPulse { 0%,100%{box-shadow:0 0 0 3px rgba(239,68,68,0.25)} 50%{box-shadow:0 0 0 7px rgba(239,68,68,0.1)} }
        @keyframes globalChatbotSpeakerPulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.2);opacity:0.18} }
      `}</style>
    </section>
  )
}

function VoicePlaybackControls({
  isVi,
  isDark,
  compact = false,
  speaking,
  paused,
  onPause,
  onResume,
  onStop,
  onReplay,
  volume,
  onVolumeChange,
  rate,
  onRateChange,
  style,
}) {
  const panelBg = isDark ? 'rgba(15,23,42,0.92)' : '#ffffff'
  const border = isDark ? 'rgba(148,163,184,0.22)' : 'rgba(20,184,166,0.20)'
  const text = isDark ? '#e5edf8' : '#102033'
  const muted = isDark ? 'rgba(226,232,240,0.68)' : '#64748b'
  const controlBg = isDark ? 'rgba(255,255,255,0.08)' : '#ecfdf5'

  return (
    <div
      style={{
        flex: '0 0 auto',
        margin: compact ? 0 : '0 14px 10px',
        padding: compact ? 10 : 12,
        borderRadius: compact ? 18 : 20,
        border: `1px solid ${border}`,
        background: panelBg,
        color: text,
        boxShadow: isDark ? '0 16px 36px rgba(0,0,0,0.24)' : '0 12px 28px rgba(15,76,129,0.10)',
        ...style,
      }}
      aria-label={isVi ? 'Điều khiển âm thanh AI đang phát' : 'AI voice playback controls'}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span
            style={{
              position: 'relative',
              width: compact ? 36 : 42,
              height: compact ? 36 : 42,
              borderRadius: '50%',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(135deg,#10b981,#0f766e)',
              color: '#fff',
              fontSize: compact ? 19 : 22,
              boxShadow: '0 10px 24px rgba(16,185,129,0.28)',
              flexShrink: 0,
            }}
          >
            🔊
            {speaking && !paused && (
              <span
                style={{
                  position: 'absolute',
                  inset: -3,
                  borderRadius: '50%',
                  border: '2px solid rgba(16,185,129,0.38)',
                  animation: 'globalChatbotSpeakerPulse 1.25s ease-in-out infinite',
                }}
              />
            )}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: compact ? 12 : 13 }}>
              {isVi ? 'AI đang nói' : 'AI is speaking'}
            </div>
            <div style={{ color: muted, fontSize: compact ? 10.5 : 11, marginTop: 2 }}>
              {speaking
                ? (paused ? (isVi ? 'Đã tạm dừng' : 'Paused') : (isVi ? 'Đang phát câu trả lời' : 'Playing reply'))
                : (isVi ? 'Sẵn sàng nghe lại' : 'Ready to replay')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {speaking && (
            <button
              type="button"
              onClick={paused ? onResume : onPause}
              title={paused ? (isVi ? 'Nghe tiếp' : 'Resume') : (isVi ? 'Tạm dừng nghe' : 'Pause')}
              style={{ border: 'none', borderRadius: 999, width: 32, height: 32, background: controlBg, color: text, cursor: 'pointer', fontWeight: 950 }}
            >
              {paused ? '▶' : '⏸'}
            </button>
          )}
          <button
            type="button"
            onClick={onReplay}
            title={isVi ? 'Nghe lại' : 'Replay'}
            style={{ border: 'none', borderRadius: 999, width: 32, height: 32, background: controlBg, color: text, cursor: 'pointer', fontWeight: 950 }}
          >
            ↻
          </button>
          {speaking && (
            <button
              type="button"
              onClick={onStop}
              title={isVi ? 'Dừng hẳn việc nghe' : 'Stop playback'}
              style={{ border: 'none', borderRadius: 999, width: 32, height: 32, background: 'rgba(239,68,68,0.16)', color: '#ef4444', cursor: 'pointer', fontWeight: 950 }}
            >
              ■
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 8, marginTop: 10, fontSize: compact ? 10.5 : 11, fontWeight: 850 }}>
        <label style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) 38px', alignItems: 'center', gap: 8 }}>
          <span>{isVi ? 'Âm lượng' : 'Volume'}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(event) => onVolumeChange(event.target.value)}
            aria-label={isVi ? 'Điều chỉnh nghe to nhỏ' : 'Adjust volume'}
          />
          <span style={{ textAlign: 'right', color: muted }}>{Math.round(volume * 100)}%</span>
        </label>
        <label style={{ display: 'grid', gridTemplateColumns: '70px minmax(0,1fr) 38px', alignItems: 'center', gap: 8 }}>
          <span>{isVi ? 'Tốc độ' : 'Speed'}</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.05"
            value={rate}
            onChange={(event) => onRateChange(event.target.value)}
            aria-label={isVi ? 'Điều chỉnh nghe nhanh chậm' : 'Adjust playback speed'}
          />
          <span style={{ textAlign: 'right', color: muted }}>{rate.toFixed(2)}×</span>
        </label>
      </div>
    </div>
  )
}

function PlaybackControlsRegion({
  isVi,
  isDark,
  compact = false,
  visible,
  onToggleVisible,
  style,
  ...controlProps
}) {
  const toggleStyle = {
    flex: '0 0 auto',
    margin: compact ? 0 : '0 14px 10px',
    border: `1px solid ${isDark ? 'rgba(148,163,184,0.22)' : 'rgba(20,184,166,0.20)'}`,
    borderRadius: 999,
    padding: compact ? '7px 10px' : '8px 12px',
    background: isDark ? 'rgba(15,23,42,0.92)' : '#ffffff',
    color: isDark ? '#e5edf8' : '#102033',
    cursor: 'pointer',
    fontSize: compact ? 11 : 12,
    fontWeight: 900,
    boxShadow: isDark ? '0 12px 28px rgba(0,0,0,0.18)' : '0 10px 22px rgba(15,76,129,0.08)',
    ...style,
  }

  return (
    <>
      <button
        type="button"
        onClick={onToggleVisible}
        style={toggleStyle}
        aria-expanded={visible}
        aria-label={visible ? (isVi ? 'Ẩn vùng loa AI' : 'Hide AI speaker controls') : (isVi ? 'Hiện vùng loa AI' : 'Show AI speaker controls')}
      >
        🔊 {visible ? (isVi ? 'Ẩn loa' : 'Hide speaker') : (isVi ? 'Hiện loa' : 'Show speaker')}
      </button>
      {visible && (
        <VoicePlaybackControls
          isVi={isVi}
          isDark={isDark}
          compact={compact}
          style={style}
          {...controlProps}
        />
      )}
    </>
  )
}

function createStyles(isDark, fullscreen) {
  const shell = isDark ? 'rgba(7, 12, 27, 0.96)' : 'rgba(255, 255, 255, 0.96)'
  const border = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 76, 129, 0.16)'
  const text = isDark ? '#e8f0f8' : '#102033'
  const muted = isDark ? 'rgba(226, 232, 240, 0.64)' : '#64748b'
  return {
    fab: {
      position: 'fixed',
      right: 18,
      bottom: 104,
      zIndex: 230,
      border: `1px solid ${border}`,
      borderRadius: 999,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      color: '#fff',
      background: 'linear-gradient(135deg, #0f4c81, #14b8a6)',
      boxShadow: '0 18px 48px rgba(15, 76, 129, 0.32)',
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    fabIcon: { fontSize: 24, width: 32, height: 32, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.16)', borderRadius: '50%' },
    panel: fullscreen ? {
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 240,
      width: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      border: 'none',
      borderRadius: 0,
      overflow: 'hidden',
      minHeight: 0,
      background: shell,
      color: text,
      boxShadow: 'none',
      backdropFilter: 'blur(18px)',
      transition: 'all 0.22s ease',
    } : {
      position: 'fixed',
      right: 18,
      bottom: 104,
      zIndex: 240,
      width: 'min(410px, calc(100vw - 28px))',
      height: 'min(680px, calc(100dvh - 126px))',
      maxHeight: 'calc(100dvh - 126px)',
      display: 'flex',
      flexDirection: 'column',
      border: `1px solid ${border}`,
      borderRadius: 24,
      overflow: 'hidden',
      minHeight: 0,
      background: shell,
      color: text,
      boxShadow: '0 28px 90px rgba(0,0,0,0.34)',
      backdropFilter: 'blur(18px)',
      transition: 'all 0.22s ease',
    },
    header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 54px', color: '#fff', background: 'linear-gradient(135deg, #0f4c81, #14b8a6)' },
    title: { fontSize: 16, fontWeight: 900, textAlign: 'left' },
    subtitle: { marginTop: 4, fontSize: 11, opacity: 0.82, lineHeight: 1.35, textAlign: 'left' },
    closeBtn: { border: 'none', background: 'rgba(255,255,255,0.18)', color: '#fff', borderRadius: 10, width: 34, height: 34, cursor: 'pointer', fontSize: 23, lineHeight: '32px', fontWeight: 900, boxShadow: '0 8px 22px rgba(0,0,0,0.22)', zIndex: 3 },
    closeTopRight: { position: 'absolute', top: 12, right: 12 },
    closeTopLeft: { position: 'absolute', top: 12, left: 12 },
    closeBottomLeft: { position: 'absolute', bottom: 12, left: 12, background: 'rgba(15,76,129,0.9)' },
    closeBottomRight: { position: 'absolute', bottom: 12, right: 12, background: 'rgba(15,76,129,0.9)' },
    resizeBtnTop: { position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', border: 'none', background: 'rgba(255,255,255,0.24)', color: '#fff', borderRadius: 12, width: 42, height: 34, cursor: 'pointer', fontSize: 18, lineHeight: '34px', fontWeight: 900, boxShadow: '0 8px 22px rgba(0,0,0,0.22)', zIndex: 4 },
    resizeBtnBottom: { position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', border: 'none', background: 'rgba(15,76,129,0.92)', color: '#fff', borderRadius: 12, width: 42, height: 34, cursor: 'pointer', fontSize: 18, lineHeight: '34px', fontWeight: 900, boxShadow: '0 8px 22px rgba(0,0,0,0.28)', zIndex: 4 },
    metaRow: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${border}`, color: muted, fontSize: 11, flexWrap: 'wrap' },
    badge: { color: '#0f766e', background: isDark ? 'rgba(45, 212, 191, 0.16)' : '#ccfbf1', borderRadius: 999, padding: '4px 8px', fontWeight: 900 },
    current: { minWidth: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    historyBtn: { border: `1px solid ${isDark ? 'rgba(45, 212, 191, 0.35)' : 'rgba(15,118,110,0.22)'}`, borderRadius: 999, background: isDark ? 'rgba(45, 212, 191, 0.16)' : '#ccfbf1', color: '#0f766e', cursor: 'pointer', fontSize: 11, fontWeight: 900, padding: '4px 10px' },
    messages: { flex: '1 1 auto', minHeight: 0, padding: 14, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 10 },
    botMsg: { alignSelf: 'flex-start', maxWidth: '88%', padding: '11px 13px', borderRadius: '16px 16px 16px 5px', background: isDark ? 'rgba(30, 41, 59, 0.82)' : '#f1f5f9', color: text, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
    userMsg: { alignSelf: 'flex-end', maxWidth: '84%', padding: '11px 13px', borderRadius: '16px 16px 5px 16px', background: 'linear-gradient(135deg, #0f4c81, #2563eb)', color: '#fff', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
    speakBtn: {
      border: `1px solid ${border}`, borderRadius: 8, padding: '3px 7px', fontSize: 12, cursor: 'pointer',
      background: isDark ? 'rgba(15,23,42,0.6)' : '#fff', color: muted, lineHeight: 1,
    },
    typingDots: { display: 'inline-flex', gap: 4 },
    quickRow: { flex: '0 0 auto', display: 'flex', gap: 6, padding: '0 14px 12px', overflowX: 'auto', scrollbarWidth: 'thin' },
    quickBtn: { flexShrink: 0, border: `1px solid ${border}`, borderRadius: 999, padding: '7px 10px', background: isDark ? 'rgba(15,23,42,0.74)' : '#fff', color: text, fontSize: 11, fontWeight: 800, cursor: 'pointer' },
    form: { flex: '0 0 auto', display: 'flex', alignItems: 'stretch', gap: 8, padding: 14, borderTop: `1px solid ${border}` },
    input: { flex: 1, resize: 'none', border: `1px solid ${border}`, borderRadius: 14, padding: '10px 12px', outline: 'none', font: 'inherit', fontSize: 13, color: text, background: isDark ? 'rgba(15, 23, 42, 0.82)' : '#fff' },
    micBtn: {
      border: `1px solid ${border}`, borderRadius: 14, padding: '0 14px', fontSize: 16,
      background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)', color: isDark ? '#a5b4fc' : '#6366f1',
      cursor: 'pointer', transition: 'all 0.18s', lineHeight: 1,
    },
    micBtnActive: {
      background: 'linear-gradient(135deg,#ef4444,#dc2626)', color: '#fff', border: '1px solid rgba(239,68,68,0.6)',
      animation: 'globalChatbotMicPulse 1.2s ease-in-out infinite',
    },
    imageBtnActive: {
      background: 'linear-gradient(135deg,#14b8a6,#0f766e)', color: '#fff', border: '1px solid rgba(20,184,166,0.6)',
    },
    sendBtn: { border: 'none', borderRadius: 14, padding: '0 16px', color: '#fff', background: 'linear-gradient(135deg, #14b8a6, #0f4c81)', fontWeight: 900, cursor: 'pointer' },
    disclaimer: { flex: '0 0 auto', padding: '0 64px 54px', color: muted, fontSize: 10.5, lineHeight: 1.4, textAlign: 'center' },
  }
}
