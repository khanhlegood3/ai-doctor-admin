// src/components/health-games/remixKol/KolRemixPlayerPanel.jsx
// "Remix" — chỉ mở được cho video đã có bản Pose (đã chạy KolPoseMakerPanel
// ít nhất 1 lần). Khác với "Frame 2" mô phỏng ở AIPoseDuetPanel.jsx (không
// thể đọc pixel từ iframe YouTube), video ở đây là bản do CHÍNH AI xử lý
// thật (khung xương đã ghép sẵn vào video khi lưu), nên phát lại trực tiếp
// bằng thẻ <video> bình thường là thấy pose thật — không cần giả lập.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useMediaPipeVision } from '../../webcam/useMediaPipeVision.js'
import { drawPose } from '../../webcam/drawOverlay.js'
import { dataUrlToObjectUrl } from './kolVideoStorage.js'
import '../../AIPoseDuetPanel.css'

export default function KolRemixPlayerPanel({ posedVideo, onBack }) {
  const { lang } = useApp()
  const t = (vi, en) => (lang === 'vi' ? vi : en)

  const posedVideoRef = useRef(null)
  const objectUrlRef = useRef('')

  useEffect(() => {
    let cancelled = false
    if (!posedVideo?.dataUrl) return
    dataUrlToObjectUrl(posedVideo.dataUrl).then((url) => {
      if (cancelled) { URL.revokeObjectURL(url); return }
      objectUrlRef.current = url
      if (posedVideoRef.current) posedVideoRef.current.src = url
    })
    return () => {
      cancelled = true
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posedVideo?.id])

  // ----- Camera Duet thật (webcam + MediaPipe Pose Landmarker, 1 người) -----
  const camVideoRef = useRef(null)
  const camCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  const [camOpen, setCamOpen] = useState(false)
  const [camStarting, setCamStarting] = useState(false)
  const [camError, setCamError] = useState('')
  const [poseReady, setPoseReady] = useState(false)

  const vision = useMediaPipeVision()
  const visionRef = useRef(vision)
  visionRef.current = vision

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
    if (camVideoRef.current) camVideoRef.current.srcObject = null
    setCamOpen(false)
    setCamStarting(false)
    setPoseReady(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = useCallback(async () => {
    setCamError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(t('Trình duyệt không hỗ trợ truy cập Camera.', 'Browser does not support camera access.'))
      return
    }
    setCamStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 480 }, height: { ideal: 640 } },
        audio: false,
      })
      streamRef.current = stream
      if (camVideoRef.current) {
        camVideoRef.current.srcObject = stream
        await camVideoRef.current.play().catch(() => {})
      }
      setCamOpen(true)
      await visionRef.current.ensureLoaded({ face: false, pose: true, object: false, poseNumPoses: 1 })
      // Tự phát video KOL đã pose song song lúc mở camera, cho trải nghiệm "duet" đúng nghĩa.
      posedVideoRef.current?.play?.().catch(() => {})
    } catch (error) {
      console.error('KolRemix camera error:', error)
      setCamError(t('Lỗi truy cập Camera. Vui lòng cấp quyền camera.', 'Camera access error. Please grant camera permission.'))
      stopCamera()
    } finally {
      setCamStarting(false)
    }
  }, [stopCamera, lang])

  useEffect(() => {
    if (!camOpen) return
    let cancelled = false

    const loop = async () => {
      if (cancelled) return
      const video = camVideoRef.current
      const canvas = camCanvasRef.current
      if (video && canvas && video.readyState >= 2 && visionRef.current.status === 'ready') {
        if (!poseReady) setPoseReady(true)
        if (canvas.width !== video.videoWidth && video.videoWidth) canvas.width = video.videoWidth
        if (canvas.height !== video.videoHeight && video.videoHeight) canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        try {
          const result = await visionRef.current.detectVideoFrame({ video, pose: true })
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          const drawingUtils = visionRef.current.getDrawingUtils(ctx)
          drawPose(ctx, drawingUtils, visionRef.current.getPoseLandmarker(), result.pose)
        } catch (error) {
          console.error('KolRemix camera detection failed:', error)
        }
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camOpen])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            🎬 {t('Remix cùng', 'Remix with')} <span style={{ color: '#d946ef' }}>{posedVideo?.title}</span>
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            {t(
              'Video KOL này đã có khung xương AI ghép sẵn (xử lý thật, không mô phỏng). Bật camera để tập cùng.',
              'This KOL video already has a real AI skeleton baked in (not a simulation). Turn on your camera to train along.'
            )}
          </p>
        </div>
        <button type="button" onClick={onBack} style={{
          padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.15))', color: 'var(--text3)', cursor: 'pointer',
        }}>
          ← {t('Quay lại thư viện', 'Back to library')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Video KOL đã pose thật */}
        <div className="pd-glass p-3 flex flex-col items-center">
          <h4 className="text-sm font-bold text-cyan-400 mb-2 w-full text-center uppercase tracking-wide">
            ✨ {t('Video KOL (AI Pose thật)', 'KOL Video (real AI Pose)')}
          </h4>
          <video ref={posedVideoRef} controls loop playsInline style={{ width: '100%', borderRadius: 10, background: '#000' }} />
        </div>

        {/* Camera Duet thật */}
        <div className="pd-glass p-3 flex flex-col items-center" style={{ border: '1px solid rgba(217,70,239,0.3)' }}>
          <h4 className="text-sm font-bold text-fuchsia-400 mb-2 w-full text-center uppercase tracking-wide">
            {t('AI Duet Camera', 'AI Duet Camera')}
          </h4>
          <div className="pd-video-container bg-slate-900 relative" style={{ width: '100%' }}>
            {!camOpen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/90 p-4 text-center">
                <p className="text-sm text-slate-300 mb-4">
                  {t('Cấp quyền Camera để tập luyện & duet cùng AI.', 'Grant camera access to practice & duet with AI.')}
                </p>
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={camStarting}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(217,70,239,0.5)] transition-all disabled:opacity-50"
                >
                  {camStarting ? t('Đang bật…', 'Starting…') : t('Bật AI Camera', 'Turn on AI Camera')}
                </button>
                {camError && <p className="text-xs text-red-400 mt-3">{camError}</p>}
              </div>
            )}
            {camOpen && (
              <video ref={camVideoRef} autoPlay playsInline muted style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
            {camOpen && <canvas ref={camCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />}
            {camOpen && !poseReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <span className="text-xs text-cyan-400 font-mono">{t('Đang tải mô hình AI...', 'Loading AI model...')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
