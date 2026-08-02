// src/components/health-games/remixKol/KolPoseMakerPanel.jsx
// "Make Pose" — xử lý AI Pose THẬT (không mô phỏng) trên 1 video KOL đã có
// trong thư viện (thô, do user upload file hoặc server tải từ YouTube).
//
// Cách hoạt động:
//   1. Phát video nguồn (đã lưu dạng dataURL/Blob cùng-origin — KHÔNG phải
//      iframe YouTube, nên đọc pixel được, không dính CORS).
//   2. Mỗi khung hình: chạy PoseLandmarker (MediaPipe Tasks Vision,
//      numPoses tối đa 2 người) để lấy toạ độ khung xương thật.
//   3. Vẽ khung hình gốc + khung xương lên 1 canvas offscreen, capture
//      canvas đó thành MediaStream (canvas.captureStream) + ghép track audio
//      gốc (video.captureStream() nếu trình duyệt hỗ trợ), ghi lại bằng
//      MediaRecorder → ra 1 video .webm mới có pose ghép sẵn.
//   4. User bấm "Lưu vào thư viện" → lưu vào IndexedDB (kolVideoStorage.js),
//      liên kết `linkedRawId` về video gốc — để nút "Remix" ở thư viện được
//      bật lên.
//
// Xử lý ở tốc độ phát thực (1x) trong lúc ghi — cách đơn giản, ổn định nhất
// để capture đúng khung hình + audio đồng bộ, không cần pipeline render
// offline phức tạp.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { useMediaPipeVision } from '../../webcam/useMediaPipeVision.js'
import { drawPose } from '../../webcam/drawOverlay.js'
import { saveKolPosedVideo, dataUrlToObjectUrl } from './kolVideoStorage.js'
import '../../AIPoseDuetPanel.css'

const RECORDER_MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
]

function pickSupportedMimeType() {
  if (typeof MediaRecorder === 'undefined') return ''
  return RECORDER_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) || ''
}

export default function KolPoseMakerPanel({ rawVideo, onSaved, onCancel }) {
  const { lang } = useApp()
  const { user } = useAuth()
  const t = (vi, en) => (lang === 'vi' ? vi : en)

  const videoRef = useRef(null)
  const recordCanvasRef = useRef(null) // offscreen — video + skeleton, dùng để ghi
  const overlayCanvasRef = useRef(null) // hiển thị cho user xem trực tiếp
  const rafRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const objectUrlRef = useRef('')

  const vision = useMediaPipeVision()
  const visionRef = useRef(vision)
  visionRef.current = vision

  const [phase, setPhase] = useState('idle') // idle | loadingModel | processing | done | error
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [resultBlob, setResultBlob] = useState(null)
  const [resultUrl, setResultUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [personCount, setPersonCount] = useState(0)

  // Load video nguồn dạng Blob URL (nhẹ hơn gán thẳng dataURL dài vào <video>).
  useEffect(() => {
    let cancelled = false
    if (!rawVideo?.dataUrl) return
    dataUrlToObjectUrl(rawVideo.dataUrl).then((url) => {
      if (cancelled) { URL.revokeObjectURL(url); return }
      objectUrlRef.current = url
      if (videoRef.current) videoRef.current.src = url
    })
    return () => {
      cancelled = true
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
      if (resultUrl) URL.revokeObjectURL(resultUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawVideo?.id])

  const stopLoop = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  useEffect(() => () => stopLoop(), [stopLoop])

  const handleStart = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    setErrorMsg('')
    setPhase('loadingModel')
    try {
      // numPoses: 2 — đúng yêu cầu "1, tối đa 2 người trong video".
      await visionRef.current.ensureLoaded({ face: false, pose: true, object: false, poseNumPoses: 2 })
    } catch (err) {
      setPhase('error')
      setErrorMsg(err?.message || String(err))
      return
    }

    const recordCanvas = recordCanvasRef.current
    const overlayCanvas = overlayCanvasRef.current
    const w = video.videoWidth || 640
    const h = video.videoHeight || 360
    recordCanvas.width = w
    recordCanvas.height = h
    overlayCanvas.width = w
    overlayCanvas.height = h
    const recordCtx = recordCanvas.getContext('2d')
    const overlayCtx = overlayCanvas.getContext('2d')

    // Ghép audio gốc (nếu trình duyệt hỗ trợ captureStream trên <video>) với
    // video track từ canvas ghi hình — nếu không hỗ trợ, vẫn ghi được video
    // (chỉ thiếu audio), không chặn toàn bộ tính năng.
    const canvasStream = recordCanvas.captureStream(30)
    try {
      const videoCaptureFn = video.captureStream || video.mozCaptureStream
      if (videoCaptureFn) {
        const srcStream = videoCaptureFn.call(video)
        srcStream.getAudioTracks().forEach((track) => canvasStream.addTrack(track))
      }
    } catch (err) {
      console.warn('KolPoseMaker: audio capture unavailable, recording video-only:', err)
    }

    const mimeType = pickSupportedMimeType()
    chunksRef.current = []
    let recorder
    try {
      recorder = mimeType ? new MediaRecorder(canvasStream, { mimeType }) : new MediaRecorder(canvasStream)
    } catch (err) {
      setPhase('error')
      setErrorMsg(t('Trình duyệt không hỗ trợ ghi video (MediaRecorder).', 'Browser does not support video recording (MediaRecorder).'))
      return
    }
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType || 'video/webm' })
      setResultBlob(blob)
      setResultUrl(URL.createObjectURL(blob))
      setPhase('done')
    }
    recorderRef.current = recorder

    const loop = async () => {
      if (video.paused || video.ended) return
      try {
        const result = await visionRef.current.detectVideoFrame({ video, pose: true })
        recordCtx.drawImage(video, 0, 0, w, h)
        overlayCtx.clearRect(0, 0, w, h)
        overlayCtx.drawImage(video, 0, 0, w, h)
        const drawingUtils = visionRef.current.getDrawingUtils(recordCtx)
        const overlayDrawingUtils = visionRef.current.getDrawingUtils(overlayCtx)
        const PoseLandmarker = visionRef.current.getPoseLandmarker()
        drawPose(recordCtx, drawingUtils, PoseLandmarker, result.pose)
        drawPose(overlayCtx, overlayDrawingUtils, PoseLandmarker, result.pose)
        setPersonCount(result.pose?.landmarks?.length || 0)
      } catch (err) {
        console.error('KolPoseMaker frame detect error:', err)
      }
      setProgress(video.duration ? Math.min(100, (video.currentTime / video.duration) * 100) : 0)
      rafRef.current = requestAnimationFrame(loop)
    }

    const onEnded = () => {
      stopLoop()
      try { recorder.stop() } catch { /* already stopped */ }
      video.removeEventListener('ended', onEnded)
    }
    video.addEventListener('ended', onEnded)

    recorder.start(500)
    setPhase('processing')
    video.currentTime = 0
    await video.play().catch(() => {})
    rafRef.current = requestAnimationFrame(loop)
  }, [stopLoop, lang])

  const handleStopEarly = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused) video.pause()
    stopLoop()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [stopLoop])

  const handleSave = useCallback(async () => {
    if (!resultBlob) return
    setSaving(true)
    try {
      const record = await saveKolPosedVideo({
        blob: resultBlob,
        mimeType: resultBlob.type,
        title: t(`${rawVideo?.title || 'Video KOL'} (Đã ghép Pose)`, `${rawVideo?.title || 'KOL Video'} (Pose applied)`),
        linkedRawId: rawVideo?.id,
        durationSeconds: rawVideo?.durationSeconds || 0,
      }, { user })
      onSaved?.(record)
    } catch (err) {
      setErrorMsg(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }, [resultBlob, rawVideo, user, onSaved, lang])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
            🕺 {t('Ghép Pose AI (thật) — ', 'AI Pose Maker (real) — ')}<span style={{ color: 'var(--cyan)' }}>{rawVideo?.title}</span>
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>
            {t(
              'MediaPipe Pose Landmarker thật, phát hiện tối đa 2 người trong video, chạy trực tiếp trên trình duyệt của bạn.',
              'Real MediaPipe Pose Landmarker, detects up to 2 people in the video, runs entirely in your browser.'
            )}
          </p>
        </div>
        <button type="button" onClick={onCancel} style={{
          padding: '8px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
          background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.15))', color: 'var(--text3)', cursor: 'pointer',
        }}>
          ← {t('Quay lại thư viện', 'Back to library')}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 640, margin: '0 auto', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} playsInline style={{ width: '100%', display: 'block' }} />
          <canvas ref={overlayCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
          {/* Canvas offscreen dùng để ghi — không cần hiển thị, ẩn khỏi layout nhưng vẫn trong DOM để captureStream hoạt động */}
          <canvas ref={recordCanvasRef} style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

          {phase === 'processing' && (
            <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '3px 8px', borderRadius: 6 }}>
                ⏺ {t('Đang xử lý', 'Processing')}… {progress.toFixed(0)}%
              </span>
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', background: 'rgba(0,0,0,0.6)', color: personCount > 0 ? '#00e676' : '#ffb74d', padding: '3px 8px', borderRadius: 6 }}>
                {t('Phát hiện', 'Detected')}: {personCount} {t('người', 'people')}
              </span>
            </div>
          )}
        </div>

        {phase === 'idle' && (
          <button type="button" onClick={handleStart} className="pd-btn-gradient" style={{
            padding: '12px 20px', borderRadius: 10, fontWeight: 800, color: '#fff', border: 'none', cursor: 'pointer',
          }}>
            ▶ {t('Bắt đầu xử lý AI Pose', 'Start AI Pose processing')}
          </button>
        )}

        {phase === 'loadingModel' && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
            {t('Đang tải mô hình MediaPipe Pose…', 'Loading MediaPipe Pose model…')}
          </div>
        )}

        {phase === 'processing' && (
          <button type="button" onClick={handleStopEarly} style={{
            padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13,
            background: 'rgba(127,29,29,0.5)', border: '1px solid #ef4444', color: '#f87171', cursor: 'pointer',
          }}>
            ⏹ {t('Dừng và lưu đến đây', 'Stop and save up to here')}
          </button>
        )}

        {phase === 'done' && resultUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>
              ✅ {t('Đã xử lý xong! Xem lại trước khi lưu:', 'Processing done! Preview before saving:')}
            </div>
            <video src={resultUrl} controls style={{ width: '100%', maxWidth: 640, margin: '0 auto', borderRadius: 12, background: '#000' }} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={handleSave} disabled={saving} style={{
                padding: '10px 18px', borderRadius: 8, fontWeight: 800, fontSize: 13,
                background: 'var(--cyan)', color: '#00151a', border: 'none', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
              }}>
                {saving ? t('Đang lưu…', 'Saving…') : t('💾 Lưu vào thư viện', '💾 Save to library')}
              </button>
              <button type="button" onClick={() => { setPhase('idle'); setResultBlob(null); setResultUrl('') }} style={{
                padding: '10px 18px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                background: 'transparent', border: '1px solid var(--border, rgba(255,255,255,0.15))', color: 'var(--text3)', cursor: 'pointer',
              }}>
                {t('Xử lý lại', 'Reprocess')}
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 8, padding: 10 }}>
            {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}
