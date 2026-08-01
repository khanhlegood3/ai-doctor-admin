/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo), adapted to the
 * free architecture. The original mic button toggled mute on a continuous
 * PCM audio stream to the Gemini Live API. The free version has no
 * always-on audio stream (that requires the paid Live API), so the mic
 * button is push-to-talk: tap it, speak, and the browser's SpeechRecognition
 * API transcribes it, sends it to the free Gemini text endpoint, and speaks
 * the reply back with SpeechSynthesis.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { memo, useEffect, useRef } from 'react'
import cn from 'classnames'

import { useLiveAPIContext } from '../../../contexts/VoiceCompanionContext'
import { useUI } from '../../../lib/state'

function ControlTray({ children }) {
  const connectButtonRef = useRef(null)

  const { showAgentEdit } = useUI()
  const {
    connected,
    connect,
    disconnect,
    listening,
    speaking,
    startListening,
  } = useLiveAPIContext()

  // Stop the current agent if the user is editing the agent or user config
  useEffect(() => {
    if (showAgentEdit) {
      if (connected) disconnect()
    }
  }, [showAgentEdit, connected, disconnect])

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus()
    }
  }, [connected])

  const micDisabled = !connected || speaking

  return (
    <section className="control-tray">
      <nav className={cn('actions-nav', { disabled: !connected })}>
        <button
          className={cn('action-button mic-button', {
            connected: listening,
          })}
          disabled={micDisabled}
          onClick={startListening}
          title={
            speaking
              ? 'Đang nói…'
              : listening
              ? 'Đang nghe…'
              : 'Nhấn để nói'
          }
        >
          <span className="material-symbols-outlined filled">
            {speaking ? 'volume_up' : listening ? 'graphic_eq' : 'mic'}
          </span>
        </button>
        {children}
      </nav>

      <div className={cn('connection-container', { connected })}>
        <div className="connection-button-container">
          <button
            ref={connectButtonRef}
            className={cn('action-button connect-toggle', { connected })}
            onClick={connected ? disconnect : connect}
          >
            <span className="material-symbols-outlined filled">
              {connected ? 'pause' : 'play_arrow'}
            </span>
          </button>
        </div>
        <span className="text-indicator">Streaming</span>
      </div>
    </section>
  )
}

export default memo(ControlTray)
