/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */

const map = new Map()

export const audioContext = (() => {
  const didInteract = new Promise(res => {
    window.addEventListener('pointerdown', res, { once: true })
    window.addEventListener('keydown', res, { once: true })
  })

  return async (options) => {
    try {
      const a = new Audio()
      a.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
      await a.play()
      if (options?.id && map.has(options.id)) {
        const ctx = map.get(options.id)
        if (ctx) {
          return ctx
        }
      }
      const ctx = new AudioContext(options)
      if (options?.id) {
        map.set(options.id, ctx)
      }
      return ctx
    } catch (e) {
      await didInteract
      if (options?.id && map.has(options.id)) {
        const ctx = map.get(options.id)
        if (ctx) {
          return ctx
        }
      }
      const ctx = new AudioContext(options)
      if (options?.id) {
        map.set(options.id, ctx)
      }
      return ctx
    }
  }
})()

export function base64ToArrayBuffer(base64) {
  var binaryString = atob(base64)
  var bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}
