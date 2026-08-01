import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Trang tĩnh độc lập (HTML/canvas/Tailwind CDN, không cần build) được nhúng
// qua iframe cùng-origin từ public/games/, giống cách các game
// "Bảo Vệ Cơ Thể" khác được phục vụ trực tiếp bởi Vercel/Vite.
const REMIX_SUC_KHOE_KOL_APP_URL = '/games/remix-suc-khoe-tu-kol.html'

export default function RemixSucKhoeKOLPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">REMIX SỨC KHOẺ TỪ KOL</div>
          <h2>🕺 Remix Sức Khoẻ từ KOL</h2>
          <p>
            {lang === 'vi'
              ? 'Ghép tư thế theo động tác mẫu (mô phỏng ước lượng tư thế AI): kéo các khớp trên mô hình của bạn để khớp với tư thế mục tiêu, hoặc xem chế độ đa đối tượng mô phỏng nhiều camera cùng lúc.'
              : 'Match your pose against a target pose (AI pose-estimation simulation): drag the joints on your model to line up with the target, or switch to multi-subject mode to preview multi-camera tracking.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Remix Sức Khoẻ từ KOL app">
        <iframe
          title="Remix Sức Khoẻ từ KOL"
          src={REMIX_SUC_KHOE_KOL_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
