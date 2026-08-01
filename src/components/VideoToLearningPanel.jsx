import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Cùng mô hình với Vision Sync: app con độc lập (Vite multi-page build
// riêng, xem vite.config.js) được nhúng qua iframe cùng-origin, vì
// video-to-learning-khanh là app AI Studio hoàn chỉnh chuyển thể từ
// video-to-learning-app.zip (xem src/video-to-learning-khanh/).
const VIDEO_TO_LEARNING_APP_URL = '/src/video-to-learning-khanh/index.html'

export default function VideoToLearningPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">VIDEO TO LEARNING</div>
          <h2>🎬 Video to Learning</h2>
          <p>
            {lang === 'vi'
              ? 'Dán một link video YouTube có phụ đề, AI sẽ đọc phụ đề để phân tích nội dung và tự tạo ra một mini-app học tập tương tác (HTML) để giúp người học ôn lại ý chính của video.'
              : 'Paste a YouTube video link that has captions, and AI will read the captions to analyze it and generate a self-contained interactive learning mini-app (HTML) that reinforces the video\'s key ideas.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Video to Learning app">
        <iframe
          title="Video to Learning"
          src={VIDEO_TO_LEARNING_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
