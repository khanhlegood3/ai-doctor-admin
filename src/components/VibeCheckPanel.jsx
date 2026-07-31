import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Chuyển đổi từ vibecheck.zip (app AI Studio độc lập: React 19 + Gemini,
// so sánh nhiều model Gemini/nhiều chế độ sinh code-ảnh cùng lúc). Dùng
// đúng công nghệ của "Vision Sync"/"Vibe Tracking": app con độc lập (Vite
// multi-page build riêng, xem vite.config.js) được nhúng qua iframe
// cùng-origin, không phải component React import trực tiếp — giữ tách
// biệt để không xung đột dependency với app chính (xem
// src/vibe-check-khanh/). Khác các app con trước: tính năng này CẦN
// GEMINI_API_KEY thật (trả phí) cấu hình ở server — xem
// api/_lib/vibeCheckProxy.js.
const VIBE_CHECK_APP_URL = '/src/vibe-check-khanh/index.html'

export default function VibeCheckPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">VIBE CHECK</div>
          <h2>🌡️ Vibe Check</h2>
          <p>
            {lang === 'vi'
              ? 'Nhập 1 prompt và so sánh cách nhiều phiên bản model Gemini (Flash-Lite, Flash, Pro, bản 2.5 và 3, có/không "thinking") thể hiện "vibe" của chúng qua nhiều chế độ: sinh code P5.js, SVG, HTML/JS, ảnh, Three.js wireframe/voxel, hoặc shader GLSL. Tính năng này cần một API key Gemini thật (trả phí) cấu hình riêng ở server — nếu chưa có, trang sẽ báo lỗi rõ ràng khi bấm tạo.'
              : 'Enter a prompt and compare how different Gemini model versions (Flash-Lite, Flash, Pro, versions 2.5 and 3, thinking on/off) express their "vibe" across multiple output modes: P5.js code, SVG, HTML/JS, images, Three.js wireframe/voxel scenes, or GLSL shaders. This feature needs a real (paid) Gemini API key configured on the server — without it, generation will report a clear error.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Vibe Check app">
        <iframe
          title="Vibe Check"
          src={VIBE_CHECK_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
