/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { useEffect, useRef, useState } from 'react'
import { useLiveAPIContext } from '../../contexts/LiveAPIContext'

function easeOutQuint(x) {
  return 1 - Math.pow(1 - x, 5)
}

// Constrain value between lower and upper limits
function clamp(x, lowerlimit, upperlimit) {
  if (x < lowerlimit) x = lowerlimit
  if (x > upperlimit) x = upperlimit
  return x
}

// GLSL smoothstep implementation
function smoothstep(edge0, edge1, x) {
  // Scale, bias, and saturate to range [0,1]
  x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0)
  // Apply cubic polynomial smoothing
  return x * x * (3 - 2 * x)
}

export function useBlink({ speed }) {
  const [eyeScale, setEyeScale] = useState(1)
  const [frame, setFrame] = useState(0)

  const frameId = useRef(-1)

  useEffect(() => {
    function nextFrame() {
      frameId.current = window.requestAnimationFrame(() => {
        setFrame(frame + 1)
        let s = easeOutQuint((Math.sin(frame * speed) + 1) * 2)
        s = smoothstep(0.1, 0.25, s)
        s = Math.min(1, s)
        setEyeScale(s)
        nextFrame()
      })
    }

    nextFrame()

    return () => {
      window.cancelAnimationFrame(frameId.current)
    }
  }, [speed, eyeScale, frame])

  return eyeScale
}

export default function useFace() {
  const { volume } = useLiveAPIContext()
  const eyeScale = useBlink({ speed: 0.0125 })

  return { eyeScale, mouthScale: volume / 2 }
}
