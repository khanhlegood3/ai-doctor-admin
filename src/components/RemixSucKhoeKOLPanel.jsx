import React, { useState } from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import AIPoseDuetPanel from './AIPoseDuetPanel.jsx'

// Trang tĩnh độc lập (HTML/canvas/Tailwind CDN, không cần build) được nhúng
// qua iframe cùng-origin từ public/games/, giống cách các game
// "Bảo Vệ Cơ Thể" khác được phục vụ trực tiếp bởi Vercel/Vite.
const REMIX_SUC_KHOE_KOL_APP_URL = '/games/remix-suc-khoe-tu-kol.html'

export default function RemixSucKhoeKOLPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()
  const t = (vi, en) => (lang === 'vi' ? vi : en)
  // 'match'  = game ghép tư thế (iframe tĩnh, không cần build)
  // 'duet'   = AI Pose Duet & Học Tập (component React thuần, MediaPipe Tasks Vision)
  const [tab, setTab] = useState('match')

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">REMIX SỨC KHOẺ TỪ KOL</div>
          <h2>🕺 Remix Sức Khoẻ từ KOL</h2>
          <p>
            {tab === 'match'
              ? t(
                  'Ghép tư thế theo động tác mẫu (mô phỏng ước lượng tư thế AI): kéo các khớp trên mô hình của bạn để khớp với tư thế mục tiêu, hoặc xem chế độ đa đối tượng mô phỏng nhiều camera cùng lúc.',
                  'Match your pose against a target pose (AI pose-estimation simulation): drag the joints on your model to line up with the target, or switch to multi-subject mode to preview multi-camera tracking.'
                )
              : t(
                  'Dán link video KOL từ YouTube, xem AI trích xuất chuyển động, rồi mở camera để "duet" tập theo cùng KOL bằng khung xương AI thời gian thực.',
                  'Paste a KOL YouTube video link, watch AI extract the movement, then open your camera to "duet" and train along with the KOL using real-time AI skeleton tracking.'
                )}
          </p>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setTab('match')}
          className={`pd-tab-btn${tab === 'match' ? ' pd-active' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            background: tab === 'match' ? undefined : 'rgba(255,255,255,0.04)',
            color: tab === 'match' ? undefined : '#94a3b8',
            cursor: 'pointer',
          }}
        >
          🧍 {t('Ghép Tư Thế', 'Pose Match')}
        </button>
        <button
          type="button"
          onClick={() => setTab('duet')}
          className={`pd-tab-btn${tab === 'duet' ? ' pd-active' : ''}`}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            background: tab === 'duet' ? undefined : 'rgba(255,255,255,0.04)',
            color: tab === 'duet' ? undefined : '#94a3b8',
            cursor: 'pointer',
          }}
        >
          🎬 {t('AI Pose Duet & Học Tập', 'AI Pose Duet & Learning')}
        </button>
      </div>

      {tab === 'match' && (
        <section className="ai-healthcare-vision-frame-card" aria-label="Remix Sức Khoẻ từ KOL - Pose Match">
          <iframe
            title="Remix Sức Khoẻ từ KOL - Pose Match"
            src={REMIX_SUC_KHOE_KOL_APP_URL}
            className="ai-healthcare-vision-frame"
            allow="fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </section>
      )}

      {tab === 'duet' && <AIPoseDuetPanel />}

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
