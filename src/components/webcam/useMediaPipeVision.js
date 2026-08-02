import { useCallback, useRef, useState } from 'react'
import { MEDIAPIPE_VISION_WASM_URL } from '../../lib/mediapipeWasmPath'

// WASM files served directly from node_modules via Vite ?url import — no CDN, no public/wasm copy needed.
// Model .task/.tflite files are still fetched from Google Storage at runtime (too large to bundle).
const WASM_URL = MEDIAPIPE_VISION_WASM_URL
const FACE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const POSE_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
const OBJECT_MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite'

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
  })

  const createLandmarker = useCallback(async (Klass, fileset, modelAssetPath, extraOptions) => {
    try {
      return await Klass.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate: 'GPU' },
        ...extraOptions,
      })
    } catch (gpuError) {
      console.warn('MediaPipe GPU delegate failed, retrying on CPU:', gpuError)
      return await Klass.createFromOptions(fileset, {
        baseOptions: { modelAssetPath, delegate: 'CPU' },
        ...extraOptions,
      })
    }
  }, [])

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
        v.fileset = await FilesetResolver.forVisionTasks(WASM_URL)
      }
      if (face && !v.face) {
        v.face = await createLandmarker(FaceLandmarker, v.fileset, FACE_MODEL_URL, {
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        })
        v.faceMode = 'VIDEO'
      }
      if (pose && !poseAlreadyReadyForCount) {
        // poseNumPoses > 1 (vd trang Remix KOL: 1-2 người trong video) cần
        // tạo lại landmarker nếu số người yêu cầu đổi so với lần tạo trước
        // (PoseLandmarker không hỗ trợ đổi numPoses qua setOptions()).
        if (v.pose) {
          try { v.pose.close() } catch { /* ignore */ }
        }
        v.pose = await createLandmarker(PoseLandmarker, v.fileset, POSE_MODEL_URL, {
          runningMode: 'VIDEO',
          numPoses: poseNumPoses,
        })
        v.poseMode = 'VIDEO'
        v.poseNumPoses = poseNumPoses
      }
      if (object && !v.object) {
        v.object = await createLandmarker(ObjectDetector, v.fileset, OBJECT_MODEL_URL, {
          runningMode: 'VIDEO',
          scoreThreshold: 0.5,
          maxResults: 5,
        })
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
