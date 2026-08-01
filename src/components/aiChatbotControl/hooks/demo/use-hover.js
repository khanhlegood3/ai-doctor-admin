/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { useEffect, useRef, useState } from 'react'

export default function useHover({ amplitude = 10, frequency = 0.5 } = {}) {
  const [offset, setOffset] = useState(0)
  const startTimeRef = useRef(Date.now())
  const animationFrameRef = useRef(0)

  useEffect(() => {
    const animate = () => {
      // Calculate time elapsed in seconds since the animation started
      const elapsed = (Date.now() - startTimeRef.current) / 1000
      // Create smooth sinusoidal motion
      const newOffset = Math.sin(elapsed * frequency * Math.PI) * amplitude

      setOffset(newOffset)
      animationFrameRef.current = requestAnimationFrame(animate)
    }

    // Start the animation loop
    animationFrameRef.current = requestAnimationFrame(animate)

    // Cancel animation frame when component unmounts or when amplitude/frequency changes
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [amplitude, frequency])

  return offset
}
