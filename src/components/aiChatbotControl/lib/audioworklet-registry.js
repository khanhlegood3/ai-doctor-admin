/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */

/**
 * A registry to map attached worklets by their audio-context
 * Any module using `audioContext.audioWorklet.addModule()` should register the worklet here
 */
export const registeredWorklets = new Map()

export const createWorketFromSrc = (workletName, workletSrc) => {
  const script = new Blob(
    [`registerProcessor("${workletName}", ${workletSrc})`],
    {
      type: 'application/javascript',
    }
  )

  return URL.createObjectURL(script)
}
