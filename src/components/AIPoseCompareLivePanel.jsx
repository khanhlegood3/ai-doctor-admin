import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useMediaPipeVision } from './webcam/useMediaPipeVision.js'
import './AIPoseDuetPanel.css'

// So sánh tư thế BẰNG CAMERA THẬT — khác với tab "Ghép Tư Thế" (demo tĩnh,
// kéo-thả trên canvas, không dùng camera). Ở đây dùng đúng pipeline AI thị
// giác đã có trong dự án (useMediaPipeVision → MediaPipe Tasks Vision
// PoseLandmarker, cùng hạ tầng với AIVisionWebcam.jsx / Vibe Check / Vibe
// Tracking) để lấy landmark khung xương thật từ webcam, tính góc khớp thật
// (vai/khuỷu/hông/gối) và so với góc của tư thế mục tiêu → điểm % thật,
// cập nhật mỗi khung hình.

// Chỉ số landmark theo chuẩn BlazePose (33 điểm) của MediaPipe Pose Landmarker
const LM = {
  leftShoulder: 11, rightShoulder: 12,
  leftElbow: 13, rightElbow: 14,
  leftWrist: 15, rightWrist: 16,
  leftHip: 23, rightHip: 24,
  leftKnee: 25, rightKnee: 26,
  leftAnkle: 27, rightAnkle: 28,
}

// Mỗi tư thế mục tiêu = góc (độ) tại các khớp chính. Góc đo tại điểm giữa
// của 3 điểm A-B-C (vd góc khuỷu = góc tại khuỷu, tạo bởi vai-khuỷu-cổ tay).
const TARGET_POSES = {
  stand: {
    label: { vi: 'Đứng Thẳng', en: 'Stand Straight' },
    icon: '🧍',
    angles: { leftElbow: 165, rightElbow: 165, leftShoulder: 15, rightShoulder: 15, leftHip: 170, rightHip: 170, leftKnee: 170, rightKnee: 170 },
  },
  handsUp: {
    label: { vi: 'Giơ Tay Lên Trời', en: 'Hands Up' },
    icon: '🙌',
    angles: { leftElbow: 165, rightElbow: 165, leftShoulder: 170, rightShoulder: 170, leftHip: 170, rightHip: 170, leftKnee: 170, rightKnee: 170 },
  },
  tPose: {
    label: { vi: 'Dang Tay Ngang (Chữ T)', en: 'T-Pose (Arms Out)' },
    icon: '🤸',
    angles: { leftElbow: 165, rightElbow: 165, leftShoulder: 85, rightShoulder: 85, leftHip: 170, rightHip: 170, leftKnee: 170, rightKnee: 170 },
  },
  squat: {
    label: { vi: 'Ngồi Xổm', en: 'Squat' },
    icon: '🏋️',
    angles: { leftElbow: 150, rightElbow: 150, leftShoulder: 25, rightShoulder: 25, leftHip: 90, rightHip: 90, leftKnee: 95, rightKnee: 95 },
  },
}

function angleAt(a, b, c) {
  if (!a || !b || !c) return null
  const v1x = a.x - b.x, v1y = a.y - b.y
  const v2x = c.x - b.x, v2y = c.y - b.y
  const mag1 = Math.hypot(v1x, v1y)
  const mag2 = Math.hypot(v2x, v2y)
  if (mag1 < 1e-6 || mag2 < 1e-6) return null
  let cos = (v1x * v2x + v1y * v2y) / (mag1 * mag2)
  cos = Math.max(-1, Math.min(1, cos))
  return (Math.acos(cos) * 180) / Math.PI
}

function computeLiveAngles(landmarks) {
  if (!landmarks) return null
  const get = (i) => {
    const p = landmarks[i]
    if (!p || (p.visibility != null && p.visibility < 0.4)) return null
    return p
  }
  return {
    leftElbow: angleAt(get(LM.leftShoulder), get(LM.leftElbow), get(LM.leftWrist)),
    rightElbow: angleAt(get(LM.rightShoulder), get(LM.rightElbow), get(LM.rightWrist)),
    leftShoulder: angleAt(get(LM.leftElbow), get(LM.leftShoulder), get(LM.leftHip)),
    rightShoulder: angleAt(get(LM.rightElbow), get(LM.rightShoulder), get(LM.rightHip)),
    leftHip: angleAt(get(LM.leftShoulder), get(LM.leftHip), get(LM.leftKnee)),
    rightHip: angleAt(get(LM.rightShoulder), get(LM.rightHip), get(LM.rightKnee)),
    leftKnee: angleAt(get(LM.leftHip), get(LM.leftKnee), get(LM.leftAnkle)),
    rightKnee: angleAt(get(LM.rightHip), get(LM.rightKnee), get(LM.rightAnkle)),
  }
}

// Mỗi khớp → (các) đoạn xương liên quan, để tô màu đúng phần cơ thể theo độ khớp
const JOINT_SEGMENTS = {
  leftElbow: [[LM.leftShoulder, LM.leftElbow], [LM.leftElbow, LM.leftWrist]],
  rightElbow: [[LM.rightShoulder, LM.rightElbow], [LM.rightElbow, LM.rightWrist]],
  leftShoulder: [[LM.leftShoulder, LM.leftElbow]],
  rightShoulder: [[LM.rightShoulder, LM.rightElbow]],
  leftHip: [[LM.leftHip, LM.leftKnee]],
  rightHip: [[LM.rightHip, LM.rightKnee]],
  leftKnee: [[LM.leftHip, LM.leftKnee], [LM.leftKnee, LM.leftAnkle]],
  rightKnee: [[LM.rightHip, LM.rightKnee], [LM.rightKnee, LM.rightAnkle]],
}

const TORSO_SEGMENTS = [
  [LM.leftShoulder, LM.rightShoulder],
  [LM.leftHip, LM.rightHip],
  [LM.leftShoulder, LM.leftHip],
  [LM.rightShoulder, LM.rightHip],
]

function jointScore(diff) {
  if (diff == null) return null
  return Math.max(0, 100 - diff * 1.6)
}

function colorForScore(score) {
  if (score == null) return 'rgba(148,163,184,0.6)'
  if (score >= 80) return '#10b981'
  if (score >= 50) return '#f59e0b'
  return '#ef4444'
}

export default function AIPoseCompareLivePanel() {
  const { lang } = useApp()
  const t = (vi, en) => (lang === 'vi' ? vi : en)

  const [targetKey, setTargetKey] = useState('stand')
  const targetRef = useRef(TARGET_POSES[targetKey])
  useEffect(() => { targetRef.current = TARGET_POSES[targetKey] }, [targetKey])

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)

  const [camOpen, setCamOpen] = useState(false)
  const [camStarting, setCamStarting] = useState(false)
  const [camError, setCamError] = useState('')
  const [poseReady, setPoseReady] = useState(false)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  // BUG ĐÃ SỬA: trước đây nếu ensureLoaded() lỗi (mạng chậm/chặn CDN
  // storage.googleapis.com, model .task không tải được), vision.status
  // chuyển sang 'error' nhưng overlay vẫn chỉ check `=== 'ready'` -> spinner
  // "Đang tải mô hình AI Pose..." quay MÃI MÃI, không báo lỗi, không có
  // cách nào thoát ra ngoài bấm tắt camera. Giờ thêm timer cảnh báo tải
  // chậm + hiện rõ lỗi (nếu có) kèm nút "Thử lại".
  const [slowLoadHint, setSlowLoadHint] = useState(false)

  const vision = useMediaPipeVision()
  const visionRef = useRef(vision)
  visionRef.current = vision

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    streamRef.current?.getTracks?.().forEach((tr) => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCamOpen(false)
    setCamStarting(false)
    setPoseReady(false)
    setScore(0)
    setSlowLoadHint(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  const startCamera = useCallback(async () => {
    setCamError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(t('Trình duyệt không hỗ trợ Camera.', 'Browser does not support camera.'))
      return
    }
    setCamStarting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 854 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {})
      }
      setCamOpen(true)
      setBestScore(0)
      await visionRef.current.ensureLoaded({ face: false, pose: true, object: false })
    } catch (error) {
      console.error('AI Pose Compare camera error:', error)
      setCamError(t('Không thể mở Camera. Vui lòng cấp quyền camera.', 'Could not open camera. Please grant camera permission.'))
      stopCamera()
    } finally {
      setCamStarting(false)
    }
  }, [stopCamera, lang])

  // Cảnh báo "tải chậm" sau 10s nếu camera đã mở mà model AI vẫn chưa sẵn
  // sàng (kể cả khi vision.status đang 'loading' chứ chưa hẳn 'error') —
  // model .task tải từ storage.googleapis.com có thể mất lâu trên mạng
  // yếu/di động, hoặc bị chặn hoàn toàn (khi đó sẽ không bao giờ xong).
  useEffect(() => {
    if (!camOpen || poseReady) { setSlowLoadHint(false); return }
    const timer = setTimeout(() => setSlowLoadHint(true), 10_000)
    return () => clearTimeout(timer)
  }, [camOpen, poseReady])

  const retryLoadModel = useCallback(() => {
    setSlowLoadHint(false)
    visionRef.current.ensureLoaded({ face: false, pose: true, object: false })
  }, [])

  // Vòng lặp: lấy landmark thật từ webcam mỗi khung hình, tính góc khớp thật,
  // so với tư thế mục tiêu, ra điểm % thật + vẽ khung xương tô màu theo độ khớp.
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
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        try {
          const result = await visionRef.current.detectVideoFrame({ video, pose: true })
          const landmarks = result?.pose?.landmarks?.[0] || null
          const liveAngles = computeLiveAngles(landmarks)
          const target = targetRef.current.angles

          let totalScore = 0
          let count = 0
          const jointScores = {}
          if (liveAngles) {
            Object.keys(target).forEach((key) => {
              const live = liveAngles[key]
              if (live == null) { jointScores[key] = null; return }
              const s = jointScore(Math.abs(live - target[key]))
              jointScores[key] = s
              totalScore += s
              count += 1
            })
          }
          const overall = count > 0 ? Math.round(totalScore / count) : 0
          setScore(overall)
          setBestScore((prev) => Math.max(prev, overall))

          if (landmarks) {
            const toPx = (i) => {
              const p = landmarks[i]
              if (!p) return null
              return { x: p.x * canvas.width, y: p.y * canvas.height }
            }
            ctx.save()
            ctx.lineCap = 'round'
            TORSO_SEGMENTS.forEach(([i, j]) => {
              const p1 = toPx(i); const p2 = toPx(j)
              if (!p1 || !p2) return
              ctx.beginPath()
              ctx.moveTo(p1.x, p1.y)
              ctx.lineTo(p2.x, p2.y)
              ctx.lineWidth = 4
              ctx.strokeStyle = 'rgba(6,182,212,0.85)'
              ctx.shadowBlur = 8
              ctx.shadowColor = 'rgba(6,182,212,0.6)'
              ctx.stroke()
            })
            Object.entries(JOINT_SEGMENTS).forEach(([jointKey, segments]) => {
              const color = colorForScore(jointScores[jointKey])
              segments.forEach(([i, j]) => {
                const p1 = toPx(i); const p2 = toPx(j)
                if (!p1 || !p2) return
                ctx.beginPath()
                ctx.moveTo(p1.x, p1.y)
                ctx.lineTo(p2.x, p2.y)
                ctx.lineWidth = 5
                ctx.strokeStyle = color
                ctx.shadowBlur = 10
                ctx.shadowColor = color
                ctx.stroke()
              })
            })
            ctx.shadowBlur = 0
            Object.values(LM).forEach((idx) => {
              const p = toPx(idx)
              if (!p) return
              ctx.beginPath()
              ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
              ctx.fillStyle = '#fff'
              ctx.fill()
            })
            ctx.restore()
          }
        } catch (error) {
          console.error('AI Pose Compare detection failed:', error)
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

  const scoreColor = score >= 85 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171'

  return (
    <div className="pd-root space-y-4">
      <div className="pd-glass p-4">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wide mb-3">
          {t('Chọn Tư Thế Mục Tiêu', 'Choose Target Pose')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(TARGET_POSES).map(([key, pose]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTargetKey(key)}
              className={`pd-tab-btn${targetKey === key ? ' pd-active' : ''}`}
              style={{
                padding: '10px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: targetKey === key ? undefined : 'rgba(255,255,255,0.04)',
                color: targetKey === key ? undefined : '#94a3b8',
                cursor: 'pointer', textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>{pose.icon}</div>
              {pose.label[lang] || pose.label.vi}
            </button>
          ))}
        </div>
      </div>

      <div className="pd-glass p-3" style={{ maxWidth: 480, margin: '0 auto' }}>
        <div className="pd-video-container bg-slate-900 relative">
          {!camOpen && (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/90 p-4 text-center">
              <p className="text-sm text-slate-300 mb-4">
                {t('Mở camera để AI chấm điểm tư thế của bạn theo thời gian thực.', 'Open your camera for real-time AI pose scoring.')}
              </p>
              <button
                type="button"
                onClick={startCamera}
                disabled={camStarting}
                className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-[0_0_15px_rgba(6,182,212,0.5)] transition-all disabled:opacity-50"
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10 p-4">
              {vision.status === 'error' ? (
                <div className="flex flex-col items-center text-center gap-2">
                  <span className="text-2xl">⚠️</span>
                  <p className="text-xs text-red-400 max-w-[260px]">
                    {t('Không tải được mô hình AI Pose', 'Could not load the AI pose model')}
                    {vision.error ? `: ${vision.error}` : '.'}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-[260px]">
                    {t(
                      'Có thể do mạng chậm hoặc chặn kết nối tới storage.googleapis.com. Kiểm tra mạng rồi thử lại.',
                      'This may be due to a slow network or a block on storage.googleapis.com. Check your connection and try again.',
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={retryLoadModel}
                    className="mt-1 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-full text-xs font-bold"
                  >
                    {t('Thử lại', 'Retry')}
                  </button>
                  <button type="button" onClick={stopCamera} className="text-[11px] text-slate-400 underline mt-1">
                    {t('Tắt camera', 'Turn off camera')}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <svg className="animate-spin h-8 w-8 text-cyan-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-xs text-cyan-400 font-mono">{t('Tải mô hình AI Pose...', 'Loading AI pose model...')}</span>
                  {slowLoadHint && (
                    <div className="flex flex-col items-center gap-2 mt-3">
                      <span className="text-[11px] text-amber-400 max-w-[240px] text-center">
                        {t(
                          'Tải hơi lâu — có thể do mạng chậm. Bạn có thể chờ thêm hoặc thử lại.',
                          'This is taking a while — your network may be slow. You can keep waiting or try again.',
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={retryLoadModel}
                        className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-full text-xs font-bold"
                      >
                        {t('Thử lại', 'Retry')}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {camOpen && poseReady && (
            <>
              <div style={{ position: 'absolute', top: 10, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 20, pointerEvents: 'none' }}>
                <div style={{ fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', color: '#94a3b8', background: 'rgba(15,23,42,0.8)', padding: '2px 10px', borderRadius: 999, marginBottom: 2 }}>
                  {t('Độ khớp tư thế', 'Pose match')}
                </div>
                <div style={{ fontSize: 34, fontWeight: 900, color: scoreColor, textShadow: `0 0 12px ${scoreColor}` }}>
                  {score}<span style={{ fontSize: 16 }}>%</span>
                </div>
              </div>
              <div className="pd-floating-badge" style={{ left: 10, right: 'auto', bottom: 10, top: 'auto' }}>
                {t('Tốt nhất', 'Best')}: {bestScore}%
              </div>
            </>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-500 text-center px-4">
        {t(
          'Powered by Zero to Forever Foundation Platform — AI thị giác thật, chạy ngay trên trình duyệt, đo góc khớp tay/chân của bạn và so khớp với tư thế mục tiêu, không phải mô phỏng.',
          'Powered by Zero to Forever Foundation Platform — real on-device computer vision, measuring your joint angles and matching them against the target pose, not a simulation.'
        )}
      </p>
    </div>
  )
}
