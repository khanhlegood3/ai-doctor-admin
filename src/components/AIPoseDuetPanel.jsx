import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useMediaPipeVision } from './webcam/useMediaPipeVision.js'
import { drawPose } from './webcam/drawOverlay.js'
import './AIPoseDuetPanel.css'

// Chuyển từ HTML gốc (dùng @mediapipe/pose + camera_utils qua CDN <script>) sang
// React "đúng chuẩn" của repo: tái dùng useMediaPipeVision() (MediaPipe Tasks Vision,
// đã có sẵn cho Face/Pose/Object ở AIVisionWebcam.jsx) + drawPose() từ drawOverlay.js.
// Không tải thêm thư viện CDN nào — dễ bảo trì, cùng một pipeline pose với các trang khác.

function extractYouTubeId(url) {
  if (!url) return null
  try {
    if (url.includes('youtube.com/shorts/')) {
      return url.split('youtube.com/shorts/')[1]?.split('?')[0] || null
    }
    if (url.includes('v=')) {
      return url.split('v=')[1]?.split('&')[0] || null
    }
    if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1]?.split('?')[0] || null
    }
  } catch {
    return null
  }
  return null
}

export default function AIPoseDuetPanel() {
  const { lang } = useApp()
  const t = (vi, en) => (lang === 'vi' ? vi : en)

  // ----- 1. Nhập link YouTube -----
  const [ytLink, setYtLink] = useState('')
  const [videoId, setVideoId] = useState(null)
  const [linkError, setLinkError] = useState('')

  const handleLoadVideo = useCallback(() => {
    const id = extractYouTubeId(ytLink.trim())
    if (!id) {
      setLinkError(t('Vui lòng nhập một link YouTube hợp lệ!', 'Please enter a valid YouTube link!'))
      return
    }
    setLinkError('')
    setVideoId(id)
  }, [ytLink, lang])

  // ----- 2. Mô phỏng AI Pose vẽ đè lên iframe YouTube (Frame 2) -----
  // Do trình duyệt không thể trích xuất khung hình từ iframe YouTube (CORS),
  // đây vẫn là animation mô phỏng — giữ nguyên hành vi bản HTML gốc.
  const mockCanvasRef = useRef(null)
  const mockRafRef = useRef(null)

  useEffect(() => {
    if (!videoId) return
    const canvas = mockCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const parent = canvas.parentElement
    canvas.width = parent.clientWidth
    canvas.height = parent.clientHeight

    let time = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      time += 0.05

      const cx = canvas.width / 2
      const cy = canvas.height / 2
      const bounce = Math.sin(time * 2) * 20
      const sway = Math.cos(time) * 30

      const head = { x: cx + sway * 0.2, y: cy - 100 + bounce }
      const neck = { x: cx + sway * 0.3, y: cy - 60 + bounce }
      const shoulderL = { x: cx - 40 + sway * 0.3, y: cy - 50 + bounce }
      const shoulderR = { x: cx + 40 + sway * 0.3, y: cy - 50 + bounce }
      const hipL = { x: cx - 25, y: cy + 50 + bounce * 0.5 }
      const hipR = { x: cx + 25, y: cy + 50 + bounce * 0.5 }
      const elbowL = { x: cx - 70 + Math.sin(time * 3) * 20, y: cy - 20 + bounce }
      const wristL = { x: cx - 90 + Math.sin(time * 3) * 40, y: cy - 60 + bounce }
      const elbowR = { x: cx + 70 - Math.cos(time * 2.5) * 20, y: cy - 20 + bounce }
      const wristR = { x: cx + 90 - Math.cos(time * 2.5) * 40, y: cy - 70 + bounce }

      const bones = [
        [head, neck], [neck, shoulderL], [neck, shoulderR],
        [shoulderL, elbowL], [elbowL, wristL],
        [shoulderR, elbowR], [elbowR, wristR],
        [shoulderL, hipL], [shoulderR, hipR], [hipL, hipR],
      ]

      ctx.lineWidth = 4
      ctx.strokeStyle = '#00ffff'
      ctx.shadowBlur = 10
      ctx.shadowColor = '#00ffff'
      bones.forEach(([a, b]) => {
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      })

      const joints = [head, neck, shoulderL, shoulderR, elbowL, elbowR, wristL, wristR, hipL, hipR]
      ctx.fillStyle = '#ffffff'
      ctx.shadowBlur = 5
      joints.forEach((j) => {
        ctx.beginPath()
        ctx.arc(j.x, j.y, 5, 0, Math.PI * 2)
        ctx.fill()
      })

      mockRafRef.current = requestAnimationFrame(draw)
    }
    draw()

    const onResize = () => {
      if (canvas.offsetParent !== null) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      }
    }
    window.addEventListener('resize', onResize)

    return () => {
      if (mockRafRef.current) cancelAnimationFrame(mockRafRef.current)
      window.removeEventListener('resize', onResize)
    }
  }, [videoId])

  // ----- 3. AI Duet Camera thực tế (webcam + MediaPipe Pose Landmarker) -----
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  const [camOpen, setCamOpen] = useState(false)
  const [camStarting, setCamStarting] = useState(false)
  const [camError, setCamError] = useState('')
  const [poseReady, setPoseReady] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [duetStatus, setDuetStatus] = useState('')
  const [slowLoadHint, setSlowLoadHint] = useState(false)

  const vision = useMediaPipeVision()
  const visionRef = useRef(vision)
  visionRef.current = vision

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    streamRef.current?.getTracks?.().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamOpen(false)
    setCamStarting(false)
    setPoseReady(false)
    setSlowLoadHint(false)
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
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCamOpen(true)
      setSlowLoadHint(false)
      await visionRef.current.ensureLoaded({ face: false, pose: true, object: false })
    } catch (error) {
      console.error('AI Pose Duet camera error:', error)
      setCamError(t('Lỗi truy cập Camera. Vui lòng cấp quyền camera.', 'Camera access error. Please grant camera permission.'))
      stopCamera()
    } finally {
      setCamStarting(false)
    }
  }, [stopCamera, lang])


  useEffect(() => {
    if (!camOpen || poseReady) { setSlowLoadHint(false); return }
    const timer = setTimeout(() => setSlowLoadHint(true), 10_000)
    return () => clearTimeout(timer)
  }, [camOpen, poseReady])

  const retryLoadModel = useCallback(() => {
    setSlowLoadHint(false)
    visionRef.current.ensureLoaded({ face: false, pose: true, object: false })
  }, [])

  // Vòng lặp phát hiện pose thời gian thực cho khung Duet Camera
  useEffect(() => {
    if (!camOpen) return
    let cancelled = false

    const loop = async () => {
      if (cancelled) return
      const video = videoRef.current
      const canvas = canvasRef.current
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
          console.error('AI Pose Duet detection failed:', error)
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

  const toggleRecord = useCallback(() => {
    setIsRecording((prev) => {
      const next = !prev
      setDuetStatus(next
        ? ''
        : t('Đã lưu video Duet vào thư viện của bạn! (Tính năng mô phỏng)', 'Duet video saved to your library! (Simulated feature)'))
      return next
    })
  }, [lang])

  return (
    <div className="pd-root space-y-6">
      {/* Panel: Nhập Video */}
      <div className="pd-glass p-5">
        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
          🎬 Video → <span className="text-cyan-400">{t('Ứng dụng học tập', 'Learning app')}</span>
        </h3>
        <p className="text-slate-400 text-sm mb-4">
          {t(
            'Dán link YouTube (hoặc Shorts), AI sẽ tạo ra ứng dụng tương tác giúp người học nắm bắt nội dung & chuyển động.',
            'Paste a YouTube (or Shorts) link and AI will turn it into an interactive app that helps learners follow the content & movement.'
          )}
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-300 uppercase">
              {t('Link video YouTube:', 'YouTube video link:')}
            </label>
            <div className="pd-neon-border rounded-lg bg-slate-900 mt-1 overflow-hidden">
              <input
                type="text"
                value={ytLink}
                onChange={(e) => setYtLink(e.target.value)}
                className="w-full bg-transparent border-none p-3 text-sm text-white focus:outline-none"
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          </div>
          {linkError && <p className="text-xs text-red-400">{linkError}</p>}
          <button
            type="button"
            onClick={handleLoadVideo}
            className="pd-btn-gradient w-full py-3 rounded-lg font-bold text-white shadow-lg flex justify-center items-center gap-2"
          >
            <span>{t('Tạo ứng dụng phân tích AI', 'Create AI analysis app')}</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Grid: Video gốc / AI Pose Extract / Duet Camera */}
      {videoId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Frame 1: Video Gốc */}
          <div className="pd-glass p-3 flex flex-col items-center">
            <h4 className="text-sm font-bold text-slate-300 mb-2 w-full text-center uppercase tracking-wide">
              1. {t('Video Gốc', 'Original Video')}
            </h4>
            <div className="pd-video-container">
              <iframe
                title="Original video"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=0&rel=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <div className="pd-floating-badge text-slate-200">{t('Nguồn gốc', 'Source')}</div>
            </div>
          </div>

          {/* Frame 2: AI Pose Simulation */}
          <div className="pd-glass p-3 flex flex-col items-center">
            <h4 className="text-sm font-bold text-cyan-400 mb-2 w-full text-center uppercase tracking-wide flex justify-center items-center gap-1">
              ✨ 2. {t('Trích Xuất Tư Thế AI', 'AI Pose Extract')}
            </h4>
            <div className="pd-video-container relative">
              <iframe
                title="AI pose extract"
                src={`https://www.youtube.com/embed/${videoId}?autoplay=0&mute=1&rel=0&controls=0`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <div className="absolute inset-0 bg-black/40 pointer-events-none z-0" />
              <canvas ref={mockCanvasRef} className="pd-canvas-overlay" />
              <div className="pd-floating-badge text-cyan-300" style={{ borderColor: 'rgba(6,182,212,0.5)' }}>
                {t('Mô phỏng thị giác', 'Vision simulation')}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              {t(
                '*Do giới hạn bảo mật (CORS), web không thể quét trực tiếp pixel từ iframe YouTube. Đây là mô phỏng lớp phủ AI.',
                '*Due to browser security (CORS), the page cannot read pixels directly from the YouTube iframe. This is a simulated AI overlay.'
              )}
            </p>
          </div>

          {/* Frame 3: Duet Camera (Thực tế — MediaPipe Pose Landmarker) */}
          <div className="pd-glass p-3 flex flex-col items-center" style={{ border: '1px solid rgba(217,70,239,0.3)' }}>
            <h4 className="text-sm font-bold text-fuchsia-400 mb-2 w-full text-center uppercase tracking-wide flex justify-center items-center gap-2">
              {isRecording && <span className="pd-recording-dot" />}
              3. {t('AI Duet Camera', 'AI Duet Camera')}
            </h4>
            <div className="pd-video-container bg-slate-900 relative">
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
                <video ref={videoRef} autoPlay playsInline muted style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {camOpen && <canvas ref={canvasRef} className="pd-canvas-overlay" style={{ transform: 'scaleX(-1)' }} />}

              {camOpen && !poseReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 p-4 text-center">
                  <div className="flex flex-col items-center max-w-[220px]">
                    {vision.status !== 'error' && (
                      <svg className="animate-spin h-8 w-8 text-cyan-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    )}
                    <span className="text-xs text-cyan-400 font-mono">
                      {vision.status === 'error'
                        ? t('Không tải được mô hình AI Pose', 'Could not load the AI pose model')
                        : t('Tải mô hình AI...', 'Loading AI model...')}
                    </span>
                    {slowLoadHint && vision.status !== 'error' && (
                      <p className="text-[11px] text-amber-300 mt-2 leading-snug">
                        {t('Tải hơi lâu — có thể do mạng chậm. Bạn có thể chờ thêm hoặc thử lại.', 'This is taking longer than usual — the network may be slow. You can wait or retry.')}
                      </p>
                    )}
                    {vision.status === 'error' && vision.error && (
                      <p className="text-[10px] text-red-300 mt-2 break-words">{vision.error}</p>
                    )}
                    {(slowLoadHint || vision.status === 'error') && (
                      <button type="button" onClick={retryLoadModel} className="mt-3 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-full text-xs font-bold">
                        {t('Thử lại', 'Retry')}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {camOpen && poseReady && (
                <div className="pd-floating-badge text-fuchsia-300" style={{ borderColor: 'rgba(217,70,239,0.5)' }}>
                  {t('Thời gian thực AI', 'Real-time AI')}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleRecord}
              disabled={!camOpen || !poseReady}
              className="mt-3 w-full py-2 rounded text-sm transition font-medium flex justify-center items-center gap-2 border"
              style={
                isRecording
                  ? { background: 'rgba(127,29,29,0.5)', borderColor: '#ef4444', color: '#f87171' }
                  : { background: '#1e293b', borderColor: '#475569', color: '#fff' }
              }
            >
              <span>{isRecording ? t('⏹ Dừng Duet', '⏹ Stop Duet') : t('⏺ Bắt đầu Duet', '⏺ Start Duet')}</span>
            </button>
            {duetStatus && <p className="text-xs text-emerald-400 mt-2 text-center">{duetStatus}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
