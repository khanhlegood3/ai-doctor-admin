import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Dùng đúng công nghệ của "Video Analyzer"/"Vision Sync": app con độc lập
// (Vite multi-page build riêng, xem vite.config.js) được nhúng qua iframe
// cùng-origin, không phải component React import trực tiếp — vì
// bring-any-idea-to-life-khanh là một dự án AI Studio hoàn chỉnh riêng
// (React 19 + Gemini 3 Pro sinh app HTML/JS tương tác từ ảnh/PDF upload),
// tách biệt giữ cho an toàn/không xung đột dependency với app chính (xem
// src/bring-any-idea-to-life-khanh/). API key Gemini KHÔNG nằm ở client —
// app con gọi qua /api/groq-proxy (provider: 'bring-any-idea-to-life'), xem
// api/_lib/bringAnyIdeaToLifeProxy.js.
const BRING_ANY_IDEA_TO_LIFE_APP_URL = '/src/bring-any-idea-to-life-khanh/index.html'

export default function BringAnyIdeaToLifePanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">BRING ANY IDEA TO LIFE</div>
          <h2>✨ Biến Mọi Ý Tưởng Thành Hiện Thực</h2>
          <p>
            {lang === 'vi'
              ? 'Tải lên ảnh chụp một bản vẽ tay, sơ đồ, bố cục phòng, hoặc bất kỳ vật thể nào bạn nghĩ ra — AI (Gemini) sẽ "nhìn" và ngay lập tức biến nó thành một ứng dụng web tương tác, chạy được thật.'
              : 'Upload an image of a sketch, diagram, floor layout, or anything you can think of — Gemini will instantly turn it into a fully interactive, working web app.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Bring Any Idea to Life app">
        <iframe
          title="Bring Any Idea to Life"
          src={BRING_ANY_IDEA_TO_LIFE_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
