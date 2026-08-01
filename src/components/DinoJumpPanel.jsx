import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Cùng mô hình với Vision Sync / Video to Learning: app con độc lập (Vite
// multi-page build riêng, xem vite.config.js) được nhúng qua iframe
// cùng-origin, chuyển thể từ dino-jump_.zip (app AI Studio "Dino Jump!").
// Game dùng MediaPipe Pose Landmarker để phát hiện người chơi nhảy thật
// (qua camera) và điều khiển khủng long né xương rồng — không gọi bất kỳ
// AI API trả phí nào (không Gemini, không backend), toàn bộ chạy client-side.
const DINO_JUMP_APP_URL = '/src/dino-jump-khanh/index.html'

export default function DinoJumpPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">AI CAMERA CONTROL</div>
          <h2>🦖 AI camera control dino jump</h2>
          <p>
            {lang === 'vi'
              ? 'Bật camera và nhảy thật ngoài đời để điều khiển khủng long né xương rồng — AI (MediaPipe) theo dõi chuyển động cơ thể bạn theo thời gian thực, không cần bàn phím hay chuột.'
              : 'Turn on your camera and jump for real to control the dino past the cacti — AI (MediaPipe) tracks your body movement in real time, no keyboard or mouse needed.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="AI camera control dino jump app">
        <iframe
          title="AI camera control dino jump"
          src={DINO_JUMP_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="camera; fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
