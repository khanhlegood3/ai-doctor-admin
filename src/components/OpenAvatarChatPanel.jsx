import React, { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Send, PlugZap, Unplug, OctagonX, Loader2, Github } from 'lucide-react'
import OpenAvatarChatClient, { CONNECTION_STATE } from '../services/openAvatarChatClient'

const DEFAULT_SERVER = 'ws://localhost:8282'

function StatusDot({ state }) {
  const color = {
    [CONNECTION_STATE.IDLE]: '#8a90a0',
    [CONNECTION_STATE.CONNECTING]: '#f4b942',
    [CONNECTION_STATE.INITIALIZING]: '#f4b942',
    [CONNECTION_STATE.READY]: '#00e676',
    [CONNECTION_STATE.CLOSED]: '#8a90a0',
    [CONNECTION_STATE.ERROR]: '#ff5252',
  }[state] || '#8a90a0'
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
}

export default function OpenAvatarChatPanel({ isDark, vi, border, surface, text, text2, text3 }) {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER)
  const [state, setState] = useState(CONNECTION_STATE.IDLE)
  const [micOn, setMicOn] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [avatarLevel, setAvatarLevel] = useState(0)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([]) // {role: 'human'|'avatar', text, id}
  const [errorMsg, setErrorMsg] = useState('')

  const clientRef = useRef(null)
  const scrollRef = useRef(null)
  const humanTurnRef = useRef(null)
  const avatarTurnRef = useRef(null)
  // Buffers that accumulate streamed text chunks for the turn currently in progress.
  // The server streams EchoHumanText/EchoAvatarText as incremental deltas (each message
  // carries only the newly generated piece, not the full text so far) — without
  // accumulating, the bubble only ever shows the last tiny fragment (e.g. a lone ".").
  const humanBufferRef = useRef('')
  const avatarBufferRef = useRef('')
  // Tracks the last message that was fully completed (turn reset) per role, so that if
  // the server re-delivers the exact same "final" text after the turn already closed
  // (observed in practice — a duplicate finalize event for one logical answer), we
  // recognize it as a repeat instead of rendering a second identical bubble.
  const lastFinalizedRef = useRef({ human: { text: '', time: 0 }, avatar: { text: '', time: 0 } })
  const DUPLICATE_WINDOW_MS = 4000

  useEffect(() => {
    return () => { clientRef.current?.disconnect() }
  }, [])

  useEffect(() => {
    // Streaming replies call setMessages once per token (several times a second).
    // 'smooth' scrolling animates over ~300ms, so a new call arriving mid-animation
    // cancels the previous one and restarts from wherever it currently was — over a
    // fast token stream the scroll position can settle a line or two short of the
    // true bottom, visually clipping the top of the newest bubble (looks like the
    // first words of the reply are missing, even though the full text is there).
    // An instant jump-to-bottom on every update avoids that race entirely.
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' })
  }, [messages])

  const appendOrUpdate = (role, textChunk, refKey, mode) => {
    const turnRef = refKey === 'human' ? humanTurnRef : avatarTurnRef
    const bufferRef = refKey === 'human' ? humanBufferRef : avatarBufferRef
    const isNewTurn = !turnRef.current
    if (isNewTurn) {
      const last = lastFinalizedRef.current[refKey]
      if (textChunk && textChunk === last.text && Date.now() - last.time < DUPLICATE_WINDOW_MS) {
        return // drop: server re-sent an already-finalized turn's text verbatim
      }
    }
    // If the server ever sends the full cumulative text (mode === 'full_text'), trust it
    // as-is. Otherwise treat each message as a delta chunk and keep appending to the
    // running buffer for this turn.
    bufferRef.current = mode === 'full_text' ? textChunk : (isNewTurn ? '' : bufferRef.current) + textChunk
    const fullText = bufferRef.current
    setMessages((prev) => {
      if (turnRef.current && prev.length && prev[prev.length - 1].id === turnRef.current) {
        const copy = [...prev]
        copy[copy.length - 1] = { ...copy[copy.length - 1], text: fullText }
        return copy
      }
      const id = `${role}-${Date.now()}`
      // Final safety net: if the message immediately before this one is the same role
      // with byte-identical text, we're looking at a duplicate re-delivery of content
      // that's already on screen (confirmed via server logs to sometimes happen even
      // though the server itself only processed the turn once) — reuse that bubble
      // instead of adding a visually-identical twin underneath it.
      if (prev.length) {
        const last = prev[prev.length - 1]
        // Exact repeat of the last bubble (already-finalized turn re-sent verbatim).
        if (last.role === role && last.text === fullText && fullText) {
          turnRef.current = last.id
          return prev
        }
        // The last bubble was finalized early (e.g. an intermediate end_of_speech),
        // and this "new turn" is actually the same answer continuing/recapping —
        // its text fully contains the previous bubble's text as a prefix. Merge into
        // that bubble instead of rendering a visible duplicate underneath it.
        if (last.role === role && fullText && last.text && fullText.startsWith(last.text)) {
          turnRef.current = last.id
          const copy = [...prev]
          copy[copy.length - 1] = { ...last, text: fullText }
          return copy
        }
      }
      turnRef.current = id
      return [...prev, { id, role, text: fullText }]
    })
  }

  const finalizeTurn = (refKey) => {
    const turnRef = refKey === 'human' ? humanTurnRef : avatarTurnRef
    const bufferRef = refKey === 'human' ? humanBufferRef : avatarBufferRef
    if (bufferRef.current) {
      lastFinalizedRef.current[refKey] = { text: bufferRef.current, time: Date.now() }
    }
    turnRef.current = null
    bufferRef.current = ''
  }

  const handleConnect = async () => {
    setErrorMsg('')
    // A previous connection may have died silently (e.g. heartbeat timeout) and left its
    // chat bubbles on screen. Without clearing here, a brand-new session's first answer
    // renders right under the old session's last answer — which looks exactly like a
    // duplicated/doubled response even though each session only answered once.
    setMessages([])
    humanTurnRef.current = null
    avatarTurnRef.current = null
    humanBufferRef.current = ''
    avatarBufferRef.current = ''
    lastFinalizedRef.current = { human: { text: '', time: 0 }, avatar: { text: '', time: 0 } }
    lastSentRef.current = { text: '', time: 0 }
    const client = new OpenAvatarChatClient({
      onStateChange: setState,
      onHumanText: ({ text: t, mode, endOfSpeech }) => {
        appendOrUpdate('human', t, 'human', mode)
        if (endOfSpeech) finalizeTurn('human')
      },
      onAvatarText: ({ text: t, mode, endOfSpeech }) => {
        appendOrUpdate('avatar', t, 'avatar', mode)
        if (endOfSpeech) finalizeTurn('avatar')
      },
      onAvatarAudioLevel: setAvatarLevel,
      onMicLevel: setMicLevel,
      onError: (err) => setErrorMsg(err.message || String(err)),
      onInterrupted: () => setAvatarLevel(0),
    })
    clientRef.current = client
    try {
      await client.connect(serverUrl)
    } catch (err) {
      setErrorMsg(vi
        ? 'Không kết nối được tới server OpenAvatarChat. Hãy chắc chắn backend đang chạy và địa chỉ đúng.'
        : 'Could not connect to the OpenAvatarChat server. Make sure the backend is running and the URL is correct.')
    }
  }

  const handleDisconnect = () => {
    setMicOn(false)
    clientRef.current?.disconnect()
    clientRef.current = null
  }

  const micTogglingRef = useRef(false)

  const toggleMic = async () => {
    if (!clientRef.current || state !== CONNECTION_STATE.READY) return
    if (micTogglingRef.current) return // guard against a double-fire before setMicOn re-renders
    micTogglingRef.current = true
    try {
      if (micOn) {
        clientRef.current.stopMic()
        setMicOn(false)
      } else {
        try {
          await clientRef.current.startMic()
          setMicOn(true)
        } catch (err) {
          setErrorMsg(vi ? 'Không truy cập được microphone.' : 'Could not access the microphone.')
        }
      }
    } finally {
      micTogglingRef.current = false
    }
  }

  const lastSentRef = useRef({ text: '', time: 0 })

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || state !== CONNECTION_STATE.READY) return
    // Guard against the exact same text being sent twice in quick succession —
    // this happens if Enter-to-submit and a click both fire for one user action,
    // or on a rapid accidental double-click/double-tap.
    const now = Date.now()
    if (lastSentRef.current.text === trimmed && now - lastSentRef.current.time < 1000) return
    lastSentRef.current = { text: trimmed, time: now }

    clientRef.current?.sendText(trimmed)
    setMessages((prev) => [...prev, { id: `human-${Date.now()}`, role: 'human', text: trimmed }])
    humanTurnRef.current = null
    humanBufferRef.current = ''
    avatarTurnRef.current = null
    avatarBufferRef.current = ''
    // The server echoes back the human message it just received (normally used to show
    // ASR transcripts for voice input) — for typed input that echo duplicates the bubble
    // we already added above. Mark it as "already finalized" so that echo gets deduped.
    lastFinalizedRef.current.human = { text: trimmed, time: now }
    setInput('')
  }

  const isConnected = state === CONNECTION_STATE.READY
  const isBusy = state === CONNECTION_STATE.CONNECTING || state === CONNECTION_STATE.INITIALIZING

  const stateLabel = {
    [CONNECTION_STATE.IDLE]: vi ? 'Chưa kết nối' : 'Not connected',
    [CONNECTION_STATE.CONNECTING]: vi ? 'Đang kết nối...' : 'Connecting...',
    [CONNECTION_STATE.INITIALIZING]: vi ? 'Đang khởi tạo phiên...' : 'Initializing session...',
    [CONNECTION_STATE.READY]: vi ? 'Đã kết nối' : 'Connected',
    [CONNECTION_STATE.CLOSED]: vi ? 'Đã ngắt kết nối' : 'Disconnected',
    [CONNECTION_STATE.ERROR]: vi ? 'Lỗi kết nối' : 'Connection error',
  }[state]

  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: text }}>
          {vi ? 'Trò chuyện trực tiếp với AI Avatar' : 'Live chat with your AI Avatar'}
        </div>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12, color: text2, lineHeight: 1.55 }}>
        {vi
          ? 'Đây là client WebSocket thật, nói chuyện trực tiếp với backend OpenAvatarChat (LLM + ASR + TTS) mà bạn tự chạy. Không có dữ liệu giả lập — nếu chưa có server, hãy làm theo hướng dẫn tự host bên dưới.'
          : 'This is a real WebSocket client talking directly to a self-hosted OpenAvatarChat backend (LLM + ASR + TTS). Nothing here is simulated — if you don\'t have a server yet, follow the self-hosting steps below.'}
      </p>

      {/* Connection bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
        <input
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          disabled={isConnected || isBusy}
          placeholder="ws://localhost:8282"
          style={{
            flex: '1 1 220px', minWidth: 180, padding: '8px 10px', borderRadius: 8, fontSize: 12.5,
            border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', color: text,
            fontFamily: 'ui-monospace, monospace',
          }}
        />
        {!isConnected && !isBusy && (
          <button onClick={handleConnect} style={btnStyle(true)}>
            <PlugZap size={14} /> {vi ? 'Kết nối' : 'Connect'}
          </button>
        )}
        {isBusy && (
          <button disabled style={btnStyle(true, true)}>
            <Loader2 size={14} className="spin" /> {vi ? 'Đang kết nối...' : 'Connecting...'}
          </button>
        )}
        {isConnected && (
          <button onClick={handleDisconnect} style={btnStyle(false, false, '#ff5252')}>
            <Unplug size={14} /> {vi ? 'Ngắt kết nối' : 'Disconnect'}
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: text2 }}>
          <StatusDot state={state} /> {stateLabel}
        </div>
      </div>

      {errorMsg && (
        <div style={{ fontSize: 12, color: '#ff5252', marginBottom: 10 }}>{errorMsg}</div>
      )}

      {/* Conversation */}
      <div
        ref={scrollRef}
        style={{
          height: 240, overflowY: 'auto', borderRadius: 10, padding: 10, marginBottom: 10,
          background: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)', border: `1px solid ${border}`,
        }}
      >
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: text3, textAlign: 'center', marginTop: 90 }}>
            {vi ? 'Cuộc trò chuyện sẽ hiện ở đây sau khi kết nối.' : 'Your conversation will appear here once connected.'}
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', justifyContent: m.role === 'human' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
            <div style={{
              maxWidth: '78%', padding: '7px 11px', borderRadius: 10, fontSize: 12.5, lineHeight: 1.5,
              background: m.role === 'human'
                ? 'linear-gradient(135deg, #00b8cc, #6b3fd4)'
                : (isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)'),
              color: m.role === 'human' ? '#fff' : text,
            }}>{m.text}</div>
          </div>
        ))}
      </div>

      {/* Avatar speaking level */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: text3, width: 92 }}>{vi ? 'Avatar đang nói' : 'Avatar speaking'}</span>
        <div style={{ flex: 1, height: 6, borderRadius: 4, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, avatarLevel * 260)}%`, background: '#00e5ff', transition: 'width 0.08s linear' }} />
        </div>
      </div>

      {/* Input row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={toggleMic}
          disabled={!isConnected}
          title={vi ? 'Bật/tắt micro' : 'Toggle microphone'}
          style={{
            ...btnStyle(false, !isConnected, micOn ? '#ff5252' : undefined),
            padding: '9px 12px', position: 'relative',
          }}
        >
          {micOn ? <MicOff size={15} /> : <Mic size={15} />}
          {micOn && (
            <span style={{
              position: 'absolute', inset: -3, borderRadius: 10, border: '2px solid #ff5252',
              opacity: Math.min(1, micLevel * 8), pointerEvents: 'none',
            }} />
          )}
        </button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat && !e.isComposing) handleSend() }}
          disabled={!isConnected}
          placeholder={vi ? 'Nhập tin nhắn...' : 'Type a message...'}
          style={{
            flex: 1, padding: '9px 12px', borderRadius: 8, fontSize: 13,
            border: `1px solid ${border}`, background: isDark ? 'rgba(255,255,255,0.04)' : '#fff', color: text,
          }}
        />
        <button onClick={handleSend} disabled={!isConnected || !input.trim()} style={btnStyle(true, !isConnected || !input.trim())}>
          <Send size={14} />
        </button>
        <button
          onClick={() => clientRef.current?.interrupt()}
          disabled={!isConnected}
          title={vi ? 'Ngắt lời avatar' : 'Interrupt the avatar'}
          style={btnStyle(false, !isConnected, '#f4b942')}
        >
          <OctagonX size={15} />
        </button>
      </div>
    </div>
  )
}

function btnStyle(primary, disabled, accentColor) {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
    padding: '9px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
    border: primary ? '1px solid transparent' : `1px solid ${accentColor || 'rgba(128,128,128,0.35)'}`,
    background: primary ? 'linear-gradient(135deg, #00b8cc, #6b3fd4)' : 'transparent',
    color: primary ? '#fff' : (accentColor || 'inherit'),
    opacity: disabled ? 0.5 : 1,
  }
}
