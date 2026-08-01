/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { useEffect, useState, useRef } from 'react'

import { renderBasicFace } from './basic-face-render'

import useFace from '../../../hooks/demo/use-face'
import useHover from '../../../hooks/demo/use-hover'
import useTilt from '../../../hooks/demo/use-tilt'
import { useLiveAPIContext } from '../../../contexts/VoiceCompanionContext'

// Minimum volume level that indicates audio output is occurring
const AUDIO_OUTPUT_DETECTION_THRESHOLD = 0.05

// Amount of delay between end of audio output and setting talking state to false
const TALKING_STATE_COOLDOWN_MS = 2000

export default function BasicFace({ canvasRef, radius = 250, color }) {
  const timeoutRef = useRef(null)

  // Audio output volume
  const { volume } = useLiveAPIContext()

  // Talking state
  const [isTalking, setIsTalking] = useState(false)

  const [scale, setScale] = useState(0.1)

  // Face state
  const { eyeScale, mouthScale } = useFace()
  const hoverPosition = useHover()
  const tiltAngle = useTilt({
    maxAngle: 5,
    speed: 0.075,
    isActive: isTalking,
  })

  useEffect(() => {
    function calculateScale() {
      setScale(Math.min(window.innerWidth, window.innerHeight) / 1000)
    }
    window.addEventListener('resize', calculateScale)
    calculateScale()
    return () => window.removeEventListener('resize', calculateScale)
  }, [])

  // Detect whether the agent is talking based on audio output volume
  // Set talking state when volume is detected
  useEffect(() => {
    if (volume > AUDIO_OUTPUT_DETECTION_THRESHOLD) {
      setIsTalking(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // Enforce a slight delay between end of audio output and setting talking state to false
      timeoutRef.current = setTimeout(
        () => setIsTalking(false),
        TALKING_STATE_COOLDOWN_MS
      )
    }
  }, [volume])

  // Render the face on the canvas
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    renderBasicFace({ ctx, mouthScale, eyeScale, color })
  }, [canvasRef, volume, eyeScale, mouthScale, color, scale])

  return (
    <canvas
      className="basic-face"
      ref={canvasRef}
      width={radius * 2 * scale}
      height={radius * 2 * scale}
      style={{
        display: 'block',
        borderRadius: '50%',
        transform: `translateY(${hoverPosition}px) rotate(${tiltAngle}deg)`,
      }}
    />
  )
}
