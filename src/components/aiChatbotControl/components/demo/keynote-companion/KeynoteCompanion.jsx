/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { useEffect, useRef } from 'react'
import { Modality } from '@google/genai'

import BasicFace from '../basic-face/BasicFace'
import { useLiveAPIContext } from '../../../contexts/LiveAPIContext'
import { createSystemInstructions } from '../../../lib/prompts'
import { useAgent, useUser } from '../../../lib/state'

export default function KeynoteCompanion() {
  const { client, connected, setConfig } = useLiveAPIContext()
  const faceCanvasRef = useRef(null)
  const user = useUser()
  const { current } = useAgent()

  // Set the configuration for the Live API
  useEffect(() => {
    setConfig({
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: current.voice },
        },
      },
      systemInstruction: {
        parts: [
          {
            text: createSystemInstructions(current, user),
          },
        ],
      },
    })
  }, [setConfig, user, current])

  // Initiate the session when the Live API connection is established
  // Instruct the model to send an initial greeting message
  useEffect(() => {
    const beginSession = async () => {
      if (!connected) return
      client.send(
        {
          text: 'Greet the user and introduce yourself and your role.',
        },
        true
      )
    }
    beginSession()
  }, [client, connected])

  return (
    <div className="keynote-companion">
      <BasicFace canvasRef={faceCanvasRef} color={current.bodyColor} />
    </div>
  )
}
