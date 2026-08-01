import React from 'react'
import { useApp } from '../../context/AppContext'

// Cùng mô hình iframe cùng-origin với VideoToLearningPanel.jsx (trang chính
// của user) — nhưng trỏ tới admin.html (entry point riêng, xem
// src/video-to-learning-khanh/admin.html + src/main-admin.tsx) để mount
// AdminHistoryPanel.tsx thay vì App.tsx. Tách route Vite riêng (thay vì
// nhúng chung index.html rồi tự chuyển tab bằng JS) để không phải tải cả
// logic sinh app học tập (transcript, Groq, iframe render...) chỉ để xem
// thống kê admin.
const VIDEO_TO_LEARNING_ADMIN_URL = '/src/video-to-learning-khanh/admin.html'

export default function VideoToLearningAdminPanel() {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">VIDEO TO LEARNING · ADMIN</div>
          <h2>📊 Quản Trị Video to Learning</h2>
          <p>
            {lang === 'vi'
              ? 'Xem toàn bộ user đã dùng tính năng Video to Learning: link video/short/kênh YouTube/trang web đã dán, nội dung AI trả về theo thời gian, và các số liệu xu hướng sử dụng.'
              : 'See every user who has used the Video to Learning feature: which video/short/channel/website links were submitted, what AI generated over time, and usage trend analytics.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Video to Learning admin app">
        <iframe
          title="Video to Learning Admin"
          src={VIDEO_TO_LEARNING_ADMIN_URL}
          className="ai-healthcare-vision-frame"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>
    </div>
  )
}
