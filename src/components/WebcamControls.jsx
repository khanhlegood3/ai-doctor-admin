import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  Camera, Video, Upload, RefreshCw, Eye, Clock,
  Square, Settings, Brain, X, Download, Zap, ZapOff,
  Circle, StopCircle, Activity, Bone, HeartPulse, ScanFace, Boxes,
} from 'lucide-react'
import { FaceLandmarker, FilesetResolver, DrawingUtils, ObjectDetector } from '@mediapipe/tasks-vision'
import { useApp } from '../context/AppContext'
import { MEDIAPIPE_VISION_WASM_URL } from '../lib/mediapipeWasmPath'
import { MEDIAPIPE_MODEL_URLS } from '../lib/mediapipeModelPath'

// WASM files served directly from node_modules via Vite ?url import — no CDN, no public/wasm copy needed.
const MEDIAPIPE_WASM_URL = MEDIAPIPE_VISION_WASM_URL
// Model .task/.tflite: thử local trước (public/models/, xem
// scripts-copy-mediapipe-models.mjs), rơi về CDN gốc của Google nếu lỗi/thiếu.
const FACE_LANDMARKER_MODEL_URLS = MEDIAPIPE_MODEL_URLS.face
const OBJECT_DETECTOR_MODEL_URLS = MEDIAPIPE_MODEL_URLS.object

// BUG tương tự đã sửa ở useMediaPipeVision.js: FilesetResolver.forVisionTasks()
// và createFromOptions() không có timeout thì delegate GPU treo là treo vĩnh
// viễn (đặc biệt Safari iOS/WebGL) — component sẽ kẹt mãi ở "loading" không
// bao giờ báo lỗi cho người dùng biết mà retry.
const INIT_TIMEOUT_MS = 15_000

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

/** Thử model local trước, GPU trước rồi CPU nếu GPU treo/lỗi; nếu cả local
 * lẫn GPU/CPU đều lỗi thì rơi về model CDN gốc (cũng thử GPU rồi CPU). */
async function createLandmarkerRobust(Klass, fileset, modelUrls, extraOptions, label) {
  const tryDelegates = (modelAssetPath) =>
    withTimeout(
      Klass.createFromOptions(fileset, { baseOptions: { modelAssetPath, delegate: 'GPU' }, ...extraOptions }),
      INIT_TIMEOUT_MS,
      `${label} GPU delegate init`,
    ).catch((gpuError) => {
      console.warn(`${label} GPU delegate failed/timed out, retrying on CPU:`, gpuError)
      return withTimeout(
        Klass.createFromOptions(fileset, { baseOptions: { modelAssetPath, delegate: 'CPU' }, ...extraOptions }),
        INIT_TIMEOUT_MS,
        `${label} CPU delegate init`,
      )
    })

  try {
    return await tryDelegates(modelUrls.local)
  } catch (localError) {
    console.warn(`${label} local model failed, falling back to CDN:`, localError)
    return tryDelegates(modelUrls.cdn)
  }
}

/**
 * WebcamControls
 *
 * Self-contained AI Doctor webcam UI per WEBCAM_CONTROLS_GUIDE.md:
 * - Camera OFF by default, AI HUD placeholder visible
 * - Floating glassmorphism control bar + settings drawer
 * - Overlay / Clock / Border toggles
 * - Capture, Record, Upload image, Save (export PNG)
 * - Front/rear camera switch (mobile) + flash/torch
 *
 * onCapture / onSave receive a File (PNG) so the parent panel
 * can route it into Medical Records / upload pipeline.
 */
export default function WebcamControls({
  onCapture,
  onSave,
  onUpload,
  onRecordStart,
  onRecordStop,
  className = '',
}) {
  const { lang } = useApp()
  const t = (vi, en) => (lang === 'vi' ? vi : en)

  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [flashEnabled, setFlashEnabled] = useState(false)
  const [flashSupported, setFlashSupported] = useState(true)
  const [showOverlay, setShowOverlay] = useState(true)
  const [showClock, setShowClock] = useState(true)
  const [showBorder, setShowBorder] = useState(true)
  const [showObjectDetection, setShowObjectDetection] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [selectedCamera, setSelectedCamera] = useState('front')
  const [cameraDevices, setCameraDevices] = useState([]) // [{ deviceId, label }]
  const [cameraDeviceIndex, setCameraDeviceIndex] = useState(0)
  const [now, setNow] = useState(new Date())
  const [statusMsg, setStatusMsg] = useState('')
  const [previewState, setPreviewState] = useState(null) // { url, file, kind: 'capture' | 'save' | 'upload', sourceImage? }
  const [previewOverlayOn, setPreviewOverlayOn] = useState(true)
  const [previewBusy, setPreviewBusy] = useState(false)

  const videoRef = useRef(null)
  const overlayCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const recordedChunksRef = useRef([])
  const fileInputRef = useRef(null)
  const faceLandmarkerRef = useRef(null)
  const lastFaceResultRef = useRef(null)
  const imageLandmarkerRef = useRef(null)
  const objectDetectorRef = useRef(null)
  const lastObjectResultRef = useRef(null)
  const imageObjectDetectorRef = useRef(null)
  const [faceMeshReady, setFaceMeshReady] = useState(false)
  const [objectDetectionReady, setObjectDetectionReady] = useState(false)

  /* ---------------- clock ---------------- */
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const formatClock = (d) => {
    const pad = (n) => String(n).padStart(2, '0')
    return {
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    }
  }

  /* ---------------- face mesh drawing ---------------- */
  const drawFaceMesh = useCallback((ctx, canvas, result) => {
    if (!result?.faceLandmarks?.length) return
    const drawingUtils = new DrawingUtils(ctx)
    for (const landmarks of result.faceLandmarks) {
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
        color: 'rgba(0,229,255,0.35)',
        lineWidth: 1,
      })
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL, {
        color: 'rgba(131,247,255,0.9)',
        lineWidth: 2,
      })
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, {
        color: 'rgba(156,111,255,0.9)',
        lineWidth: 1.5,
      })
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, {
        color: 'rgba(156,111,255,0.9)',
        lineWidth: 1.5,
      })
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, {
        color: 'rgba(255,180,173,0.9)',
        lineWidth: 1.5,
      })
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, {
        color: 'rgba(156,111,255,0.7)',
        lineWidth: 1.2,
      })
      drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, {
        color: 'rgba(156,111,255,0.7)',
        lineWidth: 1.2,
      })
    }
  }, [])

  /* ---------------- object detection drawing ---------------- */
  const drawObjectDetections = useCallback((ctx, canvas, result) => {
    if (!result?.detections?.length) return
    result.detections.forEach((detection) => {
      const box = detection.boundingBox
      if (!box) return
      const { originX: x, originY: y, width: w, height: h } = box

      ctx.strokeStyle = 'rgba(0,229,255,0.9)'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)

      const category = detection.categories?.[0]
      if (category) {
        const label = `${category.categoryName} ${(category.score * 100).toFixed(0)}%`
        ctx.font = '600 13px sans-serif'
        const textWidth = ctx.measureText(label).width
        const labelH = 20
        const labelY = Math.max(y - labelH, 0)
        ctx.fillStyle = 'rgba(0,229,255,0.85)'
        ctx.fillRect(x, labelY, textWidth + 12, labelH)
        ctx.fillStyle = '#03131a'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(label, x + 6, labelY + labelH / 2)
        ctx.textBaseline = 'alphabetic'
      }
    })
  }, [])

  /* lazy-load the FaceLandmarker model once, when overlay is needed */
  useEffect(() => {
    if (!isCameraOpen || !showOverlay || faceLandmarkerRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const vision = await withTimeout(
          FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL),
          INIT_TIMEOUT_MS,
          'MediaPipe WASM fileset load',
        )
        const landmarker = await createLandmarkerRobust(
          FaceLandmarker, vision, FACE_LANDMARKER_MODEL_URLS,
          { runningMode: 'VIDEO', numFaces: 1 },
          'FaceLandmarker',
        )
        if (cancelled) {
          landmarker.close?.()
          return
        }
        faceLandmarkerRef.current = landmarker
        setFaceMeshReady(true)
      } catch (err) {
        console.error('FaceLandmarker init error:', err)
      }
    })()
    return () => { cancelled = true }
  }, [isCameraOpen, showOverlay])

  /* lazy-load the ObjectDetector model once, when object detection overlay is needed */
  useEffect(() => {
    if (!isCameraOpen || !showObjectDetection || objectDetectorRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const vision = await withTimeout(
          FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL),
          INIT_TIMEOUT_MS,
          'MediaPipe WASM fileset load',
        )
        const detector = await createLandmarkerRobust(
          ObjectDetector, vision, OBJECT_DETECTOR_MODEL_URLS,
          { runningMode: 'VIDEO', scoreThreshold: 0.5, maxResults: 5 },
          'ObjectDetector',
        )
        if (cancelled) {
          detector.close?.()
          return
        }
        objectDetectorRef.current = detector
        setObjectDetectionReady(true)
      } catch (err) {
        console.error('ObjectDetector init error:', err)
      }
    })()
    return () => { cancelled = true }
  }, [isCameraOpen, showObjectDetection])

  useEffect(() => () => {
    faceLandmarkerRef.current?.close?.()
    faceLandmarkerRef.current = null
    imageLandmarkerRef.current?.close?.()
    imageLandmarkerRef.current = null
    objectDetectorRef.current?.close?.()
    objectDetectorRef.current = null
    imageObjectDetectorRef.current?.close?.()
    imageObjectDetectorRef.current = null
  }, [])

  const getImageLandmarker = async () => {
    if (imageLandmarkerRef.current) return imageLandmarkerRef.current
    const vision = await withTimeout(
      FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL),
      INIT_TIMEOUT_MS,
      'MediaPipe WASM fileset load',
    )
    const landmarker = await createLandmarkerRobust(
      FaceLandmarker, vision, FACE_LANDMARKER_MODEL_URLS,
      { runningMode: 'IMAGE', numFaces: 1 },
      'FaceLandmarker (image)',
    )
    imageLandmarkerRef.current = landmarker
    return landmarker
  }

  const getImageObjectDetector = async () => {
    if (imageObjectDetectorRef.current) return imageObjectDetectorRef.current
    const vision = await withTimeout(
      FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL),
      INIT_TIMEOUT_MS,
      'MediaPipe WASM fileset load',
    )
    const detector = await createLandmarkerRobust(
      ObjectDetector, vision, OBJECT_DETECTOR_MODEL_URLS,
      { runningMode: 'IMAGE', scoreThreshold: 0.5, maxResults: 5 },
      'ObjectDetector (image)',
    )
    imageObjectDetectorRef.current = detector
    return detector
  }


  /* ---------------- overlay HUD drawing (border + clock) ---------------- */
  const drawHud = useCallback((ctx, w, h, { withBorder, withClock }) => {
    if (withBorder) {
      ctx.strokeStyle = 'rgba(0,229,255,0.6)'
      ctx.lineWidth = 2
      const cornerLen = Math.min(36, w * 0.06, h * 0.06)
      const corners = [
        [12, 12, 1, 1],
        [w - 12, 12, -1, 1],
        [12, h - 12, 1, -1],
        [w - 12, h - 12, -1, -1],
      ]
      corners.forEach(([x, y, dx, dy]) => {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + dx * cornerLen, y)
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + dy * cornerLen)
        ctx.stroke()
      })
    }

    if (withClock) {
      const { time, date } = formatClock(new Date())
      ctx.font = '700 16px monospace'
      ctx.fillStyle = 'rgba(0,229,255,0.9)'
      ctx.textAlign = 'right'
      ctx.fillText(time, w - 16, 28)
      ctx.font = '500 11px monospace'
      ctx.fillStyle = 'rgba(0,229,255,0.6)'
      ctx.fillText(date, w - 16, 44)
    }
  }, [])

  /* live overlay loop while camera is open */
  useEffect(() => {
    if (!isCameraOpen) return
    let raf
    const loop = () => {
      const canvas = overlayCanvasRef.current
      const video = videoRef.current
      if (canvas && video && video.videoWidth) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
        }
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        if (showOverlay) {
          const landmarker = faceLandmarkerRef.current
          if (landmarker && video.currentTime >= 0) {
            try {
              const result = landmarker.detectForVideo(video, performance.now())
              lastFaceResultRef.current = result
            } catch (err) {
              // detection can throw if video isn't ready yet; ignore frame
            }
          }
          drawFaceMesh(ctx, canvas, lastFaceResultRef.current)
          drawHud(ctx, canvas.width, canvas.height, { withBorder: showBorder, withClock: showClock })
        } else {
          lastFaceResultRef.current = null
          drawHud(ctx, canvas.width, canvas.height, { withBorder: showBorder, withClock: showClock })
        }

        if (showObjectDetection) {
          const detector = objectDetectorRef.current
          if (detector && video.currentTime >= 0) {
            try {
              const result = detector.detectForVideo(video, performance.now())
              lastObjectResultRef.current = result
            } catch (err) {
              // detection can throw if video isn't ready yet; ignore frame
            }
          }
          drawObjectDetections(ctx, canvas, lastObjectResultRef.current)
        } else {
          lastObjectResultRef.current = null
        }
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [isCameraOpen, showOverlay, showBorder, showClock, showObjectDetection, drawHud, drawFaceMesh, drawObjectDetections])

  /* ---------------- camera lifecycle ---------------- */
  const refreshCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cams = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
      setCameraDevices(cams)
      return cams
    } catch (err) {
      console.error('enumerateDevices error:', err)
      return []
    }
  }

  const startStream = async (constraintsVideo) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: constraintsVideo,
      audio: true,
    })
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      await videoRef.current.play().catch(() => {})
    }
    const track = stream.getVideoTracks()[0]
    const caps = track?.getCapabilities?.() || {}
    setFlashSupported(!!caps.torch)
    setFlashEnabled(false)
    return stream
  }

  const openCamera = async () => {
    setStatusMsg('')
    try {
      await startStream({ facingMode: selectedCamera === 'front' ? 'user' : 'environment' })
      const cams = await refreshCameraDevices()
      // figure out which device we actually opened so "switch camera" can cycle from it
      const activeDeviceId = streamRef.current?.getVideoTracks?.()[0]?.getSettings?.().deviceId
      const idx = cams.findIndex((c) => c.deviceId === activeDeviceId)
      setCameraDeviceIndex(idx >= 0 ? idx : 0)
      setIsCameraOpen(true)
    } catch (err) {
      setStatusMsg(
        t('Không thể truy cập camera. Vui lòng cấp quyền.', 'Could not access camera. Please grant permission.')
      )
      console.error('getUserMedia error:', err)
    }
  }

  const closeCamera = () => {
    if (isRecording) stopRecording()
    streamRef.current?.getTracks()?.forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsCameraOpen(false)
    setFlashEnabled(false)
  }

  useEffect(() => () => {
    streamRef.current?.getTracks()?.forEach((track) => track.stop())
  }, [])

  /**
   * Switch camera works on laptops/tablets (multiple physical cameras,
   * cycled by deviceId) as well as phones (front/back, cycled by
   * facingMode as a fallback when deviceId switching isn't available).
   */
  const switchCamera = async () => {
    if (!isCameraOpen) return
    streamRef.current?.getTracks()?.forEach((track) => track.stop())

    try {
      let cams = cameraDevices
      if (!cams.length || cams.every((c) => !c.label)) {
        cams = await refreshCameraDevices()
      }

      if (cams.length > 1) {
        // Multiple cameras detected (typical on laptops/tablets, or phones
        // that expose distinct front/back device IDs): cycle through them.
        const nextIndex = (cameraDeviceIndex + 1) % cams.length
        try {
          await startStream({ deviceId: { exact: cams[nextIndex].deviceId } })
          setCameraDeviceIndex(nextIndex)
          return
        } catch (err) {
          console.error('switchCamera deviceId error, falling back to facingMode:', err)
        }
      }

      // Fallback: toggle front/back facing camera (phones/tablets)
      const next = selectedCamera === 'front' ? 'rear' : 'front'
      setSelectedCamera(next)
      await startStream({ facingMode: next === 'front' ? 'user' : 'environment' })
    } catch (err) {
      console.error('switchCamera error:', err)
      setStatusMsg(t('Không thể đổi camera.', 'Could not switch camera.'))
    }
  }

  /* ---------------- flash / torch ---------------- */
  const toggleFlash = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    const next = !flashEnabled
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] })
      setFlashEnabled(next)
    } catch (err) {
      setFlashSupported(false)
      setStatusMsg(t('Đèn flash không khả dụng trên thiết bị này.', 'Flash unavailable on this device.'))
      console.error('torch error:', err)
    }
  }

  /* ---------------- capture / save ---------------- */
  const composeFrame = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return null
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    if (showOverlay) {
      drawFaceMesh(ctx, canvas, lastFaceResultRef.current)
      drawHud(ctx, canvas.width, canvas.height, { withBorder: showBorder, withClock: showClock })
    }
    if (showObjectDetection) {
      drawObjectDetections(ctx, canvas, lastObjectResultRef.current)
    }
    return canvas
  }

  const canvasToFile = (canvas, prefix) =>
    new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null)
        const file = new File([blob], `${prefix}_${Date.now()}.png`, { type: 'image/png' })
        resolve(file)
      }, 'image/png')
    })

  /* Draw an <img> + (optional) face mesh + HUD + object detections onto a canvas */
  const composeImage = (img, { withOverlay, faceResult, withObjectDetection, objectResult }) => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth || img.width
    canvas.height = img.naturalHeight || img.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    if (withOverlay) {
      drawFaceMesh(ctx, canvas, faceResult)
      drawHud(ctx, canvas.width, canvas.height, { withBorder: showBorder, withClock: showClock })
    }
    if (withObjectDetection) {
      drawObjectDetections(ctx, canvas, objectResult)
    }
    return canvas
  }

  const handleCapture = async () => {
    const canvas = composeFrame()
    if (!canvas) {
      setStatusMsg(t('Camera chưa sẵn sàng.', 'Camera not ready yet.'))
      return
    }
    const file = await canvasToFile(canvas, 'ai_doctor_capture')
    const url = URL.createObjectURL(file)
    setPreviewOverlayOn(true)
    setPreviewState({ url, file, kind: 'capture' })
    setStatusMsg('')
  }

  const handleSave = async () => {
    const canvas = composeFrame()
    if (!canvas) {
      setStatusMsg(t('Không có khung hình để lưu.', 'No frame available to save.'))
      return
    }
    const file = await canvasToFile(canvas, 'ai_doctor_save')
    const url = URL.createObjectURL(file)
    setPreviewOverlayOn(true)
    setPreviewState({ url, file, kind: 'save' })
    setStatusMsg('')
  }

  const closePreview = () => {
    if (previewState?.url) URL.revokeObjectURL(previewState.url)
    if (previewState?.sourceImg) URL.revokeObjectURL(previewState.sourceImg.src)
    setPreviewState(null)
  }

  /* Re-render the preview canvas with/without overlay (used for capture/save/upload) */
  const rebuildPreview = async (overlayOn) => {
    if (!previewState) return
    setPreviewBusy(true)
    try {
      let canvas
      if (previewState.kind === 'upload' && previewState.sourceImg) {
        canvas = composeImage(previewState.sourceImg, {
          withOverlay: overlayOn,
          faceResult: previewState.faceResult,
          withObjectDetection: overlayOn,
          objectResult: previewState.objectResult,
        })
      } else if (previewState.kind === 'capture' || previewState.kind === 'save') {
        if (overlayOn) {
          canvas = composeFrame()
        } else {
          const video = videoRef.current
          if (video && video.videoWidth) {
            canvas = document.createElement('canvas')
            canvas.width = video.videoWidth
            canvas.height = video.videoHeight
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
          }
        }
      }
      if (!canvas) return
      const prefix = previewState.kind === 'upload'
        ? 'ai_doctor_upload'
        : previewState.kind === 'capture' ? 'ai_doctor_capture' : 'ai_doctor_save'
      const file = await canvasToFile(canvas, prefix)
      const url = URL.createObjectURL(file)
      if (previewState.url) URL.revokeObjectURL(previewState.url)
      setPreviewState((prev) => (prev ? { ...prev, url, file } : prev))
    } finally {
      setPreviewBusy(false)
    }
  }

  const handleToggleOverlay = (checked) => {
    setPreviewOverlayOn(checked)
    rebuildPreview(checked)
  }

  const confirmPreview = () => {
    if (!previewState) return
    const { file, kind } = previewState
    if (kind === 'capture') {
      setStatusMsg(t('Đã chụp ảnh và lưu vào hồ sơ.', 'Frame captured and saved to records.'))
      onCapture?.(file)
    } else if (kind === 'upload') {
      setStatusMsg(t('Đã tải ảnh và lưu vào hồ sơ.', 'Image uploaded and saved to records.'))
      onUpload?.(file)
    } else {
      setStatusMsg(t('Đã lưu ảnh.', 'Image saved.'))
      if (onSave) {
        onSave(file)
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name
        a.click()
        URL.revokeObjectURL(url)
      }
    }
    closePreview()
  }

  const downloadPreview = () => {
    if (!previewState) return
    const { file } = previewState
    const url = URL.createObjectURL(file)
    const a = document.createElement('a')
    a.href = url
    a.download = file.name
    a.click()
    URL.revokeObjectURL(url)
  }

  /* ---------------- recording ---------------- */
  const recordStreamRef = useRef(null)
  const recordRafRef = useRef(null)

  const startRecording = () => {
    if (!streamRef.current) return
    recordedChunksRef.current = []
    try {
      let recordStream

      if (showOverlay || showObjectDetection) {
        // Bake the live AI overlay (face mesh + HUD + object detection) into
        // the recording by drawing video + overlay canvas onto a dedicated
        // capture canvas and recording that canvas' stream instead of the
        // raw camera stream.
        const video = videoRef.current
        const overlayCanvas = overlayCanvasRef.current
        const captureCanvas = document.createElement('canvas')
        captureCanvas.width = video?.videoWidth || overlayCanvas?.width || 1280
        captureCanvas.height = video?.videoHeight || overlayCanvas?.height || 720
        const ctx = captureCanvas.getContext('2d')

        const drawFrame = () => {
          if (video && video.videoWidth) {
            if (captureCanvas.width !== video.videoWidth || captureCanvas.height !== video.videoHeight) {
              captureCanvas.width = video.videoWidth
              captureCanvas.height = video.videoHeight
            }
            ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height)
          }
          if (overlayCanvas && overlayCanvas.width) {
            ctx.drawImage(overlayCanvas, 0, 0, captureCanvas.width, captureCanvas.height)
          }
          recordRafRef.current = requestAnimationFrame(drawFrame)
        }
        recordRafRef.current = requestAnimationFrame(drawFrame)

        recordStream = captureCanvas.captureStream(30)
        // include microphone audio from the camera stream, if any
        streamRef.current.getAudioTracks().forEach((track) => recordStream.addTrack(track))
      } else {
        // No AI overlay requested: record the raw camera stream directly
        recordStream = streamRef.current
      }

      recordStreamRef.current = recordStream

      const recorder = new MediaRecorder(recordStream, { mimeType: 'video/webm' })
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        if (recordRafRef.current) {
          cancelAnimationFrame(recordRafRef.current)
          recordRafRef.current = null
        }
        recordStreamRef.current = null
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `ai_doctor_record_${Date.now()}.webm`, { type: 'video/webm' })
        onRecordStop?.(file)
      }
      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
      onRecordStart?.()
    } catch (err) {
      console.error('MediaRecorder error:', err)
      setStatusMsg(t('Không thể bắt đầu ghi hình.', 'Could not start recording.'))
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setIsRecording(false)
  }

  const toggleRecording = () => {
    if (!isCameraOpen) return
    if (isRecording) stopRecording()
    else startRecording()
  }

  /* ---------------- upload image ---------------- */
  const handleUploadClick = () => fileInputRef.current?.click()
  const handleUploadChange = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setStatusMsg(t('Đang xử lý ảnh...', 'Processing image...'))
    try {
      const imgUrl = URL.createObjectURL(file)
      const img = await new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = imgUrl
      })

      let faceResult = null
      if (showOverlay) {
        try {
          const landmarker = await getImageLandmarker()
          faceResult = landmarker.detect(img)
        } catch (err) {
          console.error('Image face detection error:', err)
        }
      }

      let objectResult = null
      if (showObjectDetection) {
        try {
          const detector = await getImageObjectDetector()
          objectResult = detector.detect(img)
        } catch (err) {
          console.error('Image object detection error:', err)
        }
      }

      const canvas = composeImage(img, {
        withOverlay: showOverlay,
        faceResult,
        withObjectDetection: showObjectDetection,
        objectResult,
      })
      const outFile = await canvasToFile(canvas, 'ai_doctor_upload')
      const url = URL.createObjectURL(outFile)
      setPreviewOverlayOn(showOverlay || showObjectDetection)
      setPreviewState({ url, file: outFile, kind: 'upload', sourceImg: img, faceResult, objectResult })
      setStatusMsg('')
    } catch (err) {
      console.error('Upload processing error:', err)
      setStatusMsg(t('Không thể xử lý ảnh tải lên.', 'Could not process the uploaded image.'))
    }
  }

  /* ---------------- presets ---------------- */
  const applyPreset = (preset) => {
    switch (preset) {
      case 'medical':
        setShowOverlay(true); setShowClock(true); setShowBorder(true); setShowObjectDetection(false); break
      case 'telemedicine':
        setShowOverlay(false); setShowClock(true); setShowBorder(false); setShowObjectDetection(false); break
      case 'research':
        setShowOverlay(true); setShowClock(true); setShowBorder(true); setShowObjectDetection(true); break
      case 'screenshot':
        setShowOverlay(false); setShowClock(false); setShowBorder(false); setShowObjectDetection(false); break
      default: break
    }
  }

  const clock = formatClock(now)

  return (
    <div className={`webcam-controls ${className}`}>
      <div className={`webcam-controls__viewport ${showBorder ? 'has-border' : ''}`}>
        {/* live video */}
        <video
          ref={videoRef}
          className="webcam-controls__video"
          style={{ display: isCameraOpen ? 'block' : 'none' }}
          playsInline
          muted
        />
        <canvas
          ref={overlayCanvasRef}
          className="webcam-controls__overlay-canvas"
          style={{ display: isCameraOpen ? 'block' : 'none' }}
        />

        {/* AI Doctor placeholder (camera off) */}
        {!isCameraOpen && (
          <div className="webcam-controls__placeholder">
            {showBorder && <div className="webcam-controls__hud-border" />}
            {showOverlay && (
              <div className="webcam-controls__hud-badge">
                <Activity size={14} /> {t('AI OVERLAY ĐANG HOẠT ĐỘNG', 'AI OVERLAY ACTIVE')}
              </div>
            )}
            {showClock && (
              <div className="webcam-controls__hud-clock">
                <div className="time">{clock.time}</div>
                <div className="date">{clock.date}</div>
              </div>
            )}

            <div className="webcam-controls__placeholder-body">
              <Brain size={64} className="webcam-controls__brain-icon" />
              <h3>{t('AI DOCTOR VISION', 'AI DOCTOR VISION')}</h3>
              <p>{t('AI Overlay đang chạy • Mở camera để bắt đầu', 'AI Overlay is running • Open camera to start')}</p>

              <div className="webcam-controls__hud-chips">
                <span><ScanFace size={14} /> {t('Lưới khuôn mặt', 'Face Mesh')}</span>
                <span><Boxes size={14} /> {t('Nhận diện vật thể', 'Object Detection')}</span>
                <span><Bone size={14} /> {t('Khung xương', 'Skeleton')}</span>
                <span><HeartPulse size={14} /> {t('Nhịp tim', 'Heart Rate')}</span>
                <span><Activity size={14} /> {t('Tư thế', 'Posture')}</span>
              </div>

              <button type="button" className="webcam-controls__open-btn" onClick={openCamera}>
                <Camera size={24} />
                <span>
                  <b>{t('MỞ CAMERA', 'OPEN CAMERA')}</b>
                  <small>{t('Bắt đầu quét AI trực tiếp', 'Start AI Livestream Scan')}</small>
                </span>
              </button>
            </div>
          </div>
        )}

        {/* LIVE indicator + top-right clock when camera on */}
        {isCameraOpen && (
          <>
            <div className="webcam-controls__live-badge">
              <span className="dot" /> {t('TRỰC TIẾP', 'LIVE')}
            </div>
            <button
              type="button"
              className="webcam-controls__close-fab"
              onClick={closeCamera}
              title={t('Đóng camera', 'Close camera')}
              aria-label="Close camera"
            >
              <X size={18} />
            </button>
            {showOverlay && (
              <div className="webcam-controls__facemesh-badge">
                <ScanFace size={12} />
                {faceMeshReady
                  ? t('Face Mesh: hoạt động', 'Face Mesh: active')
                  : t('Face Mesh: đang tải...', 'Face Mesh: loading...')}
              </div>
            )}
            {showObjectDetection && (
              <div className={`webcam-controls__facemesh-badge webcam-controls__objdet-badge ${showOverlay ? 'stacked' : ''}`}>
                <Boxes size={12} />
                {objectDetectionReady
                  ? t('Nhận diện vật thể: hoạt động', 'Object Detection: active')
                  : t('Nhận diện vật thể: đang tải...', 'Object Detection: loading...')}
              </div>
            )}
            {showClock && (
              <div className="webcam-controls__hud-clock top-right">
                <div className="time">{clock.time}</div>
                <div className="date">{clock.date}</div>
              </div>
            )}
            <button
              type="button"
              className={`webcam-controls__flash-fab ${flashEnabled ? 'active' : ''}`}
              onClick={toggleFlash}
              title={flashSupported ? t('Đèn flash', 'Flash') : t('Đèn flash không khả dụng', 'Flash unavailable')}
              aria-label="Flash"
              disabled={!flashSupported}
            >
              {flashEnabled ? <Zap size={18} /> : <ZapOff size={18} />}
            </button>
            <button
              type="button"
              className="webcam-controls__settings-fab"
              onClick={() => setShowSettings((s) => !s)}
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            {isRecording && (
              <div className={`webcam-controls__rec-badge ${showOverlay && showObjectDetection ? 'stacked-2' : ''}`}>
                <Circle size={10} fill="currentColor" /> REC
              </div>
            )}
          </>
        )}

        {/* settings drawer (glassmorphism) */}
        {showSettings && (
          <div className="webcam-controls__drawer">
            <div className="webcam-controls__drawer-header">
              <span>{t('Cài đặt', 'Settings')}</span>
              <button type="button" onClick={() => setShowSettings(false)}><X size={16} /></button>
            </div>

            <label className="webcam-controls__drawer-row">
              <span><Eye size={15} /> {t('Lớp phủ AI', 'AI Overlay')}</span>
              <input type="checkbox" checked={showOverlay} onChange={(e) => setShowOverlay(e.target.checked)} />
            </label>
            <label className="webcam-controls__drawer-row">
              <span><Boxes size={15} /> {t('Nhận diện vật thể (AI)', 'Object Detection (AI)')}</span>
              <input
                type="checkbox"
                checked={showObjectDetection}
                onChange={(e) => setShowObjectDetection(e.target.checked)}
              />
            </label>
            <label className="webcam-controls__drawer-row">
              <span><Clock size={15} /> {t('Đồng hồ', 'Clock')}</span>
              <input type="checkbox" checked={showClock} onChange={(e) => setShowClock(e.target.checked)} />
            </label>
            <label className="webcam-controls__drawer-row">
              <span><Square size={15} /> {t('Viền', 'Border')}</span>
              <input type="checkbox" checked={showBorder} onChange={(e) => setShowBorder(e.target.checked)} />
            </label>

            <div className="webcam-controls__drawer-presets">
              <button type="button" onClick={() => applyPreset('medical')}>{t('Quét y tế', 'Medical Scan')}</button>
              <button type="button" onClick={() => applyPreset('telemedicine')}>{t('Khám từ xa', 'Telemedicine')}</button>
              <button type="button" onClick={() => applyPreset('research')}>{t('Nghiên cứu AI', 'AI Research')}</button>
              <button type="button" onClick={() => applyPreset('screenshot')}>{t('Chụp màn hình', 'Screenshot')}</button>
            </div>
          </div>
        )}

        {/* floating toolbar */}
        {isCameraOpen && (
          <div className="webcam-controls__toolbar">
            <button type="button" title={t('Đổi camera', 'Switch camera')} onClick={switchCamera}>
              <RefreshCw size={18} />
            </button>
            <button type="button" title={t('Tải ảnh lên', 'Upload image')} onClick={handleUploadClick}>
              <Upload size={18} />
            </button>
            <button type="button" className="webcam-controls__capture-btn" title={t('Chụp ảnh', 'Capture')} onClick={handleCapture}>
              <span className="ring" />
            </button>
            <button
              type="button"
              title={isRecording ? t('Dừng ghi hình', 'Stop recording') : t('Ghi hình', 'Record video')}
              onClick={toggleRecording}
              className={isRecording ? 'active' : ''}
            >
              {isRecording ? <StopCircle size={18} /> : <Video size={18} />}
            </button>
            <button type="button" className="webcam-controls__close-btn" title={t('Đóng camera', 'Close camera')} onClick={closeCamera}>
              <X size={18} />
            </button>
          </div>
        )}

        {/* upload-only toolbar when camera is off */}
        {!isCameraOpen && (
          <div className="webcam-controls__toolbar idle">
            <button type="button" title={t('Tải ảnh lên', 'Upload image')} onClick={handleUploadClick}>
              <Upload size={18} />
              <span>{t('Tải ảnh', 'Upload')}</span>
            </button>
          </div>
        )}

        {/* captured / uploaded image preview */}
        {previewState && (
          <div className="webcam-controls__preview">
            <img src={previewState.url} alt="preview" className="webcam-controls__preview-img" />

            <label className="webcam-controls__preview-overlay-toggle">
              <input
                type="checkbox"
                checked={previewOverlayOn}
                disabled={previewBusy}
                onChange={(e) => handleToggleOverlay(e.target.checked)}
              />
              <Eye size={14} />
              {t('Lớp phủ AI', 'AI Overlay')}
              {previewBusy && <span className="webcam-controls__preview-busy">…</span>}
            </label>

            <div className="webcam-controls__preview-toolbar">
              <button type="button" className="webcam-controls__preview-close" onClick={closePreview}>
                <X size={18} />
                <span>{previewState.kind === 'upload' ? t('Hủy', 'Cancel') : t('Chụp lại', 'Retake')}</span>
              </button>
              <button type="button" className="webcam-controls__preview-download" onClick={downloadPreview}>
                <Download size={18} />
                <span>{t('Tải xuống', 'Download')}</span>
              </button>
              <button type="button" className="webcam-controls__preview-confirm" onClick={confirmPreview}>
                <Camera size={18} />
                <span>
                  {previewState.kind === 'capture' && t('Lưu vào hồ sơ', 'Save to records')}
                  {previewState.kind === 'save' && t('Lưu ảnh', 'Save image')}
                  {previewState.kind === 'upload' && t('Xác nhận tải lên', 'Confirm upload')}
                </span>
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleUploadChange}
        />
      </div>

      {statusMsg && <div className="webcam-controls__status">{statusMsg}</div>}
    </div>
  )
}
