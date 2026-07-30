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
              ? 'Mở camera để nhận diện vật thể (TensorFlow.js) và biểu cảm khuôn mặt (MediaPipe Face Landmarker) theo thời gian thực, đồng thời tạo nhạc nền ambient theo "vibe" của khung cảnh. Tính năng nhạc Lyria cần API key Gemini riêng nên khi chưa cấu hình sẽ tự dùng vibe mặc định — phần nhận diện camera vẫn hoạt động bình thường.'
              : 'Open the camera for realtime object detection (TensorFlow.js) and facial expression tracking (MediaPipe Face Landmarker), plus ambient background music matched to the scene\u2019s "vibe". The Lyria music feature needs its own Gemini API key, so it falls back to a default vibe until configured — camera detection keeps working either way.'}
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
