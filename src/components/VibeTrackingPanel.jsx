import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Chuyển đổi từ vibeviz.zip (app AI Studio độc lập: React 19 + MediaPipe
// FaceLandmarker/HandLandmarker + Gemini). Dùng đúng công nghệ của "Vision
// Sync"/"Video to Learning": app con độc lập (Vite multi-page build riêng,
// xem vite.config.js) được nhúng qua iframe cùng-origin, không phải
// component React import trực tiếp — giữ tách biệt để không xung đột
// dependency với app chính (xem src/vibe-tracking-khanh/).
export const VIBE_TRACKING_APP_URL = '/src/vibe-tracking-khanh/index.html'

export function VibeTrackingEmbedSection({ lang = 'vi', className = '' }) {
  return (
    <div className={`animate-fade ai-healthcare-vision-page vibe-tracking-embed-page ${className}`}>
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">VIBE TRACKING</div>
          <h2>🎭 Vibe Tracking</h2>
          <p>
            {lang === 'vi'
              ? 'Mở camera để phân tích biểu cảm khuôn mặt (MediaPipe Face Landmarker) theo thời gian thực ở tab "Emotion Mesh", hoặc dịch ngôn ngữ ký hiệu tay từ chuỗi toạ độ tay/mặt (MediaPipe Hand + Face Landmarker) ở tab "Sign Language". Cả hai đều dùng AI (miễn phí, qua Groq) để tạo nhận định/bản dịch.'
              : 'Open the camera for realtime facial expression analysis (MediaPipe Face Landmarker) in the "Emotion Mesh" tab, or translate hand sign language from hand/face landmark sequences (MediaPipe Hand + Face Landmarker) in the "Sign Language" tab. Both use AI (free, via Groq) to generate insights/translations.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card vibe-tracking-frame-card" aria-label="Vibe Tracking app">
        <iframe
          title="Vibe Tracking"
          src={VIBE_TRACKING_APP_URL}
          className="ai-healthcare-vision-frame vibe-tracking-frame"
          allow="camera; microphone; fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

    </div>
  )
}

export default function VibeTrackingPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <>
      <VibeTrackingEmbedSection lang={lang} />
      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </>
  )
}
