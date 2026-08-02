import { useCallback, useRef, useState } from 'react'
import { MEDIAPIPE_VISION_WASM_URL } from '../../lib/mediapipeWasmPath'
import { MEDIAPIPE_MODEL_URLS } from '../../lib/mediapipeModelPath'

// WASM files served directly from node_modules via Vite ?url import — no CDN, no public/wasm copy needed.
// Model .task/.tflite files: tự host trong public/models/ (xem
// scripts-copy-mediapipe-models.mjs + mediapipeModelPath.js), thử local
// trước — nếu lỗi/thiếu file mới fallback về storage.googleapis.com.
const WASM_URL = MEDIAPIPE_VISION_WASM_URL
const MODEL_URLS = MEDIAPIPE_MODEL_URLS

// BUG ĐÃ SỬA (camera kẹt mãi ở "Loading AI pose model...", nút Retry không
// có tác dụng): FilesetResolver.forVisionTasks() và Klass.createFromOptions()
// không có timeout. Trên một số thiết bị (đặc biệt Safari iOS qua WebGL),
// khởi tạo delegate 'GPU' có thể treo VĨNH VIỄN — promise không bao giờ
// resolve lẫn reject. Khi đó v.loadingPromise kẹt ở trạng thái pending mãi
// mãi, status không bao giờ chuyển sang 'error', và vì ensureLoaded() có
// `if (v.loadingPromise) return v.loadingPromise`, bấm "Thử lại" chỉ await
// lại CHÍNH promise đã kẹt đó — không hề bắt đầu lần thử mới.
// → Bọc mọi bước tải bằng withTimeout(): khi hết giờ, promise sẽ reject thật
// sự, status chuyển 'error', loadingPromise được dọn sạch (finally), và lần
// Retry tiếp theo mới thực sự chạy lại. Lưu ý: đây không thể "hủy" lệnh gọi
// MediaPipe gốc đang treo (Tasks Vision không có API hủy), chỉ ngừng chờ nó.
const FILESET_TIMEOUT_MS = 15_000
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
 * Lazily loads MediaPipe Tasks Vision (FaceLandmarker + PoseLandmarker) and exposes
 * helpers to run detection on a live <video> element or a static <img> element.
 *
 * status: 'idle' | 'loading' | 'ready' | 'error'
 */
export function useMediaPipeVision() {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const visionRef = useRef({
    fileset: null,
    face: null,
    pose: null,
    object: null,
    faceMode: 'VIDEO',
    poseMode: 'VIDEO',
    poseNumPoses: 1,
    objectMode: 'VIDEO',
    FaceLandmarker: null,
    PoseLandmarker: null,
    ObjectDetector: null,
    DrawingUtils: null,
    loadingPromise: null,
    // Nhớ "GPU delegate đã treo/lỗi" theo từng loại landmarker, để lần tải
    // sau (Retry, hoặc bật lại camera) bỏ qua thẳng CPU thay vì tốn thêm
    // 15s chờ GPU treo lại lần nữa trên cùng thiết bị.
    gpuFailed: { face: false, pose: false, object: false },
    // Nhớ "model local đã lỗi/thiếu" theo từng loại, để không tốn thêm
    // timeout thử lại local mỗi lần — đi thẳng CDN cho các lần sau.
    localModelFailed: { face: false, pose: false, object: false },
  })

  const createWithDelegateFallback = useCallback(async (Klass, fileset, modelAssetPath, extraOptions, gpuFailedKey) => {
    const v = visionRef.current
    if (!v.gpuFailed[gpuFailedKey]) {
      try {
        return await withTimeout(
          Klass.createFromOptions(fileset, {
            baseOptions: { modelAssetPath, delegate: 'GPU' },
            ...extraOptions,
          }),
          CREATE_LANDMARKER_TIMEOUT_MS,
          `GPU delegate init (${gpuFailedKey})`,
        )
      } catch (gpuError) {
        console.warn('MediaPipe GPU delegate failed/timed out, falling back to CPU:', gpuError)
        v.gpuFailed[gpuFailedKey] = true
      }
    }
    return withTimeout(
      Klass.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        ...extraOptions,
      }),
      CREATE_LANDMARKER_TIMEOUT_MS,
      `CPU delegate init (${gpuFailedKey})`,
    )
  }, [])

  // Thử model tự host (local, nhanh) trước; nếu lỗi/thiếu file (404, mạng
  // hỏng, v.v.) mới rơi về CDN gốc của Google. Bọc riêng từng đường dẫn bằng
  // GPU->CPU fallback ở trên, để lỗi delegate và lỗi nguồn model không lẫn
  // vào nhau khi debug.
  const createLandmarker = useCallback(async (Klass, fileset, modelUrls, extraOptions, key) => {
    const v = visionRef.current
    if (!v.localModelFailed[key]) {
      try {
        return await createWithDelegateFallback(Klass, fileset, modelUrls.local, extraOptions, key)
      } catch (localError) {
        console.warn(`MediaPipe local model failed for "${key}", falling back to CDN:`, localError)
        v.localModelFailed[key] = true
      }
    }
    return createWithDelegateFallback(Klass, fileset, modelUrls.cdn, extraOptions, key)
  }, [createWithDelegateFallback])

  const ensureLoaded = useCallback(async ({ face = true, pose = true, object = false, poseNumPoses = 1 } = {}) => {
    const v = visionRef.current
    const poseAlreadyReadyForCount = v.pose && v.poseNumPoses === poseNumPoses
    if ((!face || v.face) && (!pose || poseAlreadyReadyForCount) && (!object || v.object)) {
      if (status !== 'ready') setStatus('ready')
      return
    }
    if (v.loadingPromise) return v.loadingPromise

    setStatus('loading')
    setError('')

    v.loadingPromise = (async () => {
      const tasksVision = await import('@mediapipe/tasks-vision')
      const { FilesetResolver, FaceLandmarker, PoseLandmarker, ObjectDetector, DrawingUtils } = tasksVision
      v.FaceLandmarker = FaceLandmarker
      v.PoseLandmarker = PoseLandmarker
      v.ObjectDetector = ObjectDetector
      v.DrawingUtils = DrawingUtils

      if (!v.fileset) {
        v.fileset = await withTimeout(
          FilesetResolver.forVisionTasks(WASM_URL),
          FILESET_TIMEOUT_MS,
          'MediaPipe WASM fileset load',
        )
      }
      if (face && !v.face) {
        v.face = await createLandmarker(FaceLandmarker, v.fileset, MODEL_URLS.face, {
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        }, 'face')
        v.faceMode = 'VIDEO'
      }
      if (pose && !poseAlreadyReadyForCount) {
        // poseNumPoses > 1 (vd trang Remix KOL: 1-2 người trong video) cần
        // tạo lại landmarker nếu số người yêu cầu đổi so với lần tạo trước
        // (PoseLandmarker không hỗ trợ đổi numPoses qua setOptions()).
        if (v.pose) {
          try { v.pose.close() } catch { /* ignore */ }
        }
        v.pose = await createLandmarker(PoseLandmarker, v.fileset, MODEL_URLS.pose, {
          runningMode: 'VIDEO',
          numPoses: poseNumPoses,
        }, 'pose')
        v.poseMode = 'VIDEO'
        v.poseNumPoses = poseNumPoses
      }
      if (object && !v.object) {
        v.object = await createLandmarker(ObjectDetector, v.fileset, MODEL_URLS.object, {
          runningMode: 'VIDEO',
          scoreThreshold: 0.5,
          maxResults: 5,
        }, 'object')
        v.objectMode = 'VIDEO'
      }
    })()

    try {
      await v.loadingPromise
      setStatus('ready')
    } catch (err) {
      console.error('Failed to load MediaPipe Tasks Vision:', err)
      setError(err?.message || String(err))
      setStatus('error')
    } finally {
      v.loadingPromise = null
    }
  }, [status, createLandmarker])

  /** Run detection on a live <video> frame. Returns { face, pose, object } results. */
  const detectVideoFrame = useCallback(async ({ video, face, pose, object }) => {
    const v = visionRef.current
    const result = {}
    const now = performance.now()
    if (face && v.face) {
      if (v.faceMode !== 'VIDEO') {
        await v.face.setOptions({ runningMode: 'VIDEO' })
        v.faceMode = 'VIDEO'
      }
      result.face = v.face.detectForVideo(video, now)
    }
    if (pose && v.pose) {
      if (v.poseMode !== 'VIDEO') {
        await v.pose.setOptions({ runningMode: 'VIDEO' })
        v.poseMode = 'VIDEO'
      }
      result.pose = v.pose.detectForVideo(video, now)
    }
    if (object && v.object) {
      if (v.objectMode !== 'VIDEO') {
        await v.object.setOptions({ runningMode: 'VIDEO' })
        v.objectMode = 'VIDEO'
      }
      result.object = v.object.detectForVideo(video, now)
    }
    return result
  }, [])

  /** Run a one-shot detection on a static <img> element (uploaded photo). */
  const detectImage = useCallback(async ({ image, face, pose, object }) => {
    const v = visionRef.current
    const result = {}
    if (face && v.face) {
      if (v.faceMode !== 'IMAGE') {
        await v.face.setOptions({ runningMode: 'IMAGE' })
        v.faceMode = 'IMAGE'
      }
      result.face = v.face.detect(image)
    }
    if (pose && v.pose) {
      if (v.poseMode !== 'IMAGE') {
        await v.pose.setOptions({ runningMode: 'IMAGE' })
        v.poseMode = 'IMAGE'
      }
      result.pose = v.pose.detect(image)
    }
    if (object && v.object) {
      if (v.objectMode !== 'IMAGE') {
        await v.object.setOptions({ runningMode: 'IMAGE' })
        v.objectMode = 'IMAGE'
      }
      result.object = v.object.detect(image)
    }
    return result
  }, [])

  const getDrawingUtils = useCallback((ctx) => {
    const DrawingUtils = visionRef.current.DrawingUtils
    return DrawingUtils ? new DrawingUtils(ctx) : null
  }, [])

  const getFaceLandmarker = useCallback(() => visionRef.current.FaceLandmarker, [])
  const getPoseLandmarker = useCallback(() => visionRef.current.PoseLandmarker, [])
  const getObjectDetector = useCallback(() => visionRef.current.ObjectDetector, [])

  return {
    status,
    error,
    ensureLoaded,
    detectVideoFrame,
    detectImage,
    getDrawingUtils,
    getFaceLandmarker,
    getPoseLandmarker,
    getObjectDetector,
  }
}
