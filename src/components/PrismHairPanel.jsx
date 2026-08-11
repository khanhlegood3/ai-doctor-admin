import React from 'react'
import { useApp } from '../context/AppContext'

// Prism Hair — app con Vite multi-page riêng (src/prism-hair-khanh/index.html)
// nhúng qua iframe cùng-origin, chuyển thể từ prism-hair.zip. Dùng MediaPipe
// Image Segmenter để đổi màu tóc real-time qua camera — chạy hoàn toàn
// client-side, không gọi AI API trả phí nào (không Gemini, không backend).
// Cùng mô hình với Dino Jump / Vision Sync / Video to Learning — xem
// vite.config.js (build entry) và src/prism-hair-khanh/.
const PRISM_HAIR_APP_URL = '/src/prism-hair-khanh/index.html'

export default function PrismHairPanel() {
  const { lang } = useApp()

  return (
    <div className="animate-fade" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, minHeight: 'calc(100vh - 96px)' }}>
      <style>{`
        .prism-hair-frame-card {
          position: relative;
          flex: 1;
          min-height: clamp(560px, 74vh, 920px);
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: #05070d;
          box-shadow: 0 24px 80px rgba(0,0,0,0.24);
        }
        .prism-hair-frame {
          width: 100%;
          height: 100%;
          min-height: clamp(560px, 74vh, 920px);
          border: 0;
          display: block;
        }
        @media (max-width: 760px) {
          .prism-hair-frame-card, .prism-hair-frame { min-height: 70vh; }
        }
      `}</style>

      <div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          🎨 {lang === 'en' ? 'Prism Hair' : 'Prism Hair — Đổi Màu Tóc AI'}
        </h2>
        <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
          {lang === 'en'
            ? 'Try on different hair colors instantly with your webcam, powered by real-time MediaPipe hair segmentation. Runs fully in your browser — no photos are uploaded.'
            : 'Thử ngay các màu tóc khác nhau bằng webcam, dùng công nghệ nhận diện tóc MediaPipe theo thời gian thực. Chạy hoàn toàn trên trình duyệt — không tải ảnh lên đâu cả.'}
        </p>
      </div>

      <div className="prism-hair-frame-card">
        <iframe
          title="Prism Hair"
          src={PRISM_HAIR_APP_URL}
          className="prism-hair-frame"
          allow="camera; fullscreen; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}
