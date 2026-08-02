import { useCallback, useRef, useState } from 'react'
import { MEDIAPIPE_VISION_WASM_URL } from '../../lib/mediapipeWasmPath'
import { MEDIAPIPE_MODEL_URLS } from '../../lib/mediapipeModelPath'

// Hand Landmarker riêng cho tính năng Touchless Control (Medical Visual
// Playground) — TÁCH RIÊNG khỏi useMediaPipeVision.js (Face/Pose/Object) vì
// đây là model nặng nhất trong nhóm Tasks Vision và chỉ Playground mới cần,
// tránh việc các trang khác (đang dùng useMediaPipeVision cho Face/Pose)
// vô tình tải thêm model Hand không dùng tới.
const WASM_URL = MEDIAPIPE_VISION_WASM_URL
const HAND_MODEL_URLS = MEDIAPIPE_MODEL_URLS.hand
// Cùng bug đã sửa ở useMediaPipeVision.js: không có timeout thì delegate GPU
// treo là treo vĩnh viễn, Retry vô dụng. Và model giờ thử local
// (public/models/, xem scripts-copy-mediapipe-models.mjs) trước khi rơi về CDN.
const CREATE_LANDMARKER_TIMEOUT_MS = 15_000

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`))
    }, ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

/**
 * status: 'idle' | 'loading' | 'ready' | 'error'
 * Trả về helper detectVideoFrame(video) -> { landmarks: [[{x,y,z}, ...], ...] } | null
 */
export function useHandTracking() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const visionRef = useRef({ fileset: null, landmarker: null, mode: 'VIDEO', loadingPromise: null })

  const ensureLoaded = useCallback(async () => {
    const v = visionRef.current
    if (v.landmarker) {
      if (status !== 'ready') setStatus('ready')
      return
    }
    if (v.loadingPromise) return v.loadingPromise

    setStatus('loading')
    setError('')

    v.loadingPromise = (async () => {
      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      if (!v.fileset) {
        v.fileset = await withTimeout(
          FilesetResolver.forVisionTasks(WASM_URL),
          CREATE_LANDMARKER_TIMEOUT_MS,
          'MediaPipe WASM fileset load',
        )
      }

      const createWithDelegateFallback = (modelAssetPath) =>
        withTimeout(
          HandLandmarker.createFromOptions(v.fileset, {
            baseOptions: { modelAssetPath, delegate: 'GPU' },
            runningMode: 'VIDEO',
            numHands: 1,
          }),
          CREATE_LANDMARKER_TIMEOUT_MS,
          'HandLandmarker GPU delegate init',
        ).catch((gpuError) => {
          console.warn('HandLandmarker GPU delegate failed/timed out, retrying on CPU:', gpuError)
          return withTimeout(
            HandLandmarker.createFromOptions(v.fileset, {
              baseOptions: { modelAssetPath, delegate: 'CPU' },
              runningMode: 'VIDEO',
              numHands: 1,
            }),
            CREATE_LANDMARKER_TIMEOUT_MS,
            'HandLandmarker CPU delegate init',
          )
        })

      try {
        v.landmarker = await createWithDelegateFallback(HAND_MODEL_URLS.local)
      } catch (localError) {
        console.warn('HandLandmarker local model failed, falling back to CDN:', localError)
        v.landmarker = await createWithDelegateFallback(HAND_MODEL_URLS.cdn)
      }
    })()

    try {
      await v.loadingPromise
      setStatus('ready')
    } catch (err) {
      console.error('Failed to load MediaPipe Hand Landmarker:', err)
      setError(err?.message || String(err))
      setStatus('error')
    } finally {
      v.loadingPromise = null
    }
  }, [status])

  /** Chạy nhận diện trên 1 khung hình <video>. Trả về mảng landmarks đã chuẩn hoá (0..1) của bàn tay đầu tiên, hoặc null. */
  const detectVideoFrame = useCallback((video) => {
    const v = visionRef.current
    if (!v.landmarker || !video || video.readyState < 2) return null
    const result = v.landmarker.detectForVideo(video, performance.now())
    if (!result?.landmarks?.length) return null
    return result.landmarks
  }, [])

  return { status, error, ensureLoaded, detectVideoFrame }
}
