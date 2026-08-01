/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo), adapted to the
 * free architecture: greeting + reply generation now happen inside
 * hooks/useVoiceCompanion.js (connect() sends the greeting itself), so this
 * component just needs to render the animated face.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { useRef } from 'react'

import BasicFace from '../basic-face/BasicFace'
import { useAgent } from '../../../lib/state'

export default function KeynoteCompanion() {
  const faceCanvasRef = useRef(null)
  const { current } = useAgent()

  return (
    <div className="keynote-companion">
      <BasicFace canvasRef={faceCanvasRef} color={current.bodyColor} />
    </div>
  )
}
