/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { memo, useEffect, useRef, useState } from 'react'
import cn from 'classnames'

import { AudioRecorder } from '../../../lib/audio-recorder'
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext'
import { useUI } from '../../../lib/state'

function ControlTray({ children }) {
  const [audioRecorder] = useState(() => new AudioRecorder())
  const [muted, setMuted] = useState(false)
  const connectButtonRef = useRef(null)

  const { showAgentEdit, showUserConfig } = useUI()
  const { client, connected, connect, disconnect } = useLiveAPIContext()

  // Stop the current agent if the user is editing the agent or user config
  useEffect(() => {
    if (showAgentEdit || showUserConfig) {
      if (connected) disconnect()
    }
  }, [showUserConfig, showAgentEdit, connected, disconnect])

  useEffect(() => {
    if (!connected && connectButtonRef.current) {
      connectButtonRef.current.focus()
    }
  }, [connected])

  useEffect(() => {
    const onData = (base64) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ])
    }
    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData).start()
    } else {
      audioRecorder.stop()
    }
    return () => {
      audioRecorder.off('data', onData)
    }
  }, [connected, client, muted, audioRecorder])

  return (
    <section className="control-tray">
      <nav className={cn('actions-nav', { disabled: !connected })}>
        <button
          className={cn('action-button mic-button')}
          onClick={() => setMuted(!muted)}
        >
          {!muted ? (
            <span className="material-symbols-outlined filled">mic</span>
          ) : (
            <span className="material-symbols-outlined filled">mic_off</span>
          )}
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
