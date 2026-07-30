import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Dùng đúng công nghệ của trang "AI Healthcare Vision": app con độc lập
// (Vite multi-page build riêng, xem vite.config.js) được nhúng qua iframe
// cùng-origin, không phải component React import trực tiếp — vì
// vision-sync-khanh là một dự án AI Studio hoàn chỉnh riêng (React 19 +
// TensorFlow.js coco-ssd + MediaPipe FaceLandmarker + Tone.js), tách biệt
// giữ cho an toàn/không xung đột dependency với app chính (xem
// src/vision-sync-khanh/).
const VISION_SYNC_APP_URL = '/src/vision-sync-khanh/index.html'

export default function VisionSyncPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">VISION SYNC</div>
          <h2>👁️ Vision Sync</h2>
          <p>
            {lang === 'vi'
              ? 'Mở camera để nhận diện vật thể (TensorFlow.js) và biểu cảm khuôn mặt (MediaPipe Face Landmarker) theo thời gian thực, đồng thời tạo mô tả "vibe" âm thanh theo khung cảnh (miễn phí, qua Groq). Nhạc nền Lyria thời gian thực cần API key Gemini thật (trả phí) cấu hình riêng ở server — nếu chưa có, phần camera/vibe vẫn hoạt động bình thường, chỉ nhạc nền sẽ báo thiếu key.'
              : 'Open the camera for realtime object detection (TensorFlow.js) and facial expression tracking (MediaPipe Face Landmarker), plus a scene "vibe" description (free, via Groq). Realtime Lyria background music needs a real (paid) Gemini API key configured on the server — without it, camera detection and the vibe text still work fine; only the music will report a missing key.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Vision Sync app">
        <iframe
          title="Vision Sync"
          src={VISION_SYNC_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="camera; microphone; fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
