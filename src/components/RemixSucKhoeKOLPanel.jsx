import React, { useState } from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import RemixSucKhoeKOLCameraSection from './health-games/RemixSucKhoeKOLCameraSection.jsx'
import AIPoseDuetPanel from './AIPoseDuetPanel.jsx'
import KolVideoLibraryPanel from './health-games/remixKol/KolVideoLibraryPanel.jsx'
import KolPoseMakerPanel from './health-games/remixKol/KolPoseMakerPanel.jsx'
import KolRemixPlayerPanel from './health-games/remixKol/KolRemixPlayerPanel.jsx'

// Trang tĩnh độc lập (HTML/canvas/Tailwind CDN, không cần build) được nhúng
// qua iframe cùng-origin từ public/games/, giống cách các game
// "Bảo Vệ Cơ Thể" khác được phục vụ trực tiếp bởi Vercel/Vite.
const REMIX_SUC_KHOE_KOL_APP_URL = '/games/remix-suc-khoe-tu-kol.html'

const TAB_META = {
  compare: {
    label: { vi: '🎯 So Sánh Tư Thế (Camera AI)', en: '🎯 Pose Compare (AI Camera)' },
    desc: {
      vi: 'Bật camera thật — AI (MediaPipe Pose Landmarker) đo góc khớp tay/chân của bạn theo thời gian thực và chấm điểm % khớp với tư thế mục tiêu. Đây là AI thị giác thật, không phải mô phỏng.',
      en: 'Turn on your real camera — AI (MediaPipe Pose Landmarker) measures your joint angles in real time and scores how closely you match the target pose. Real computer vision, not a simulation.',
    },
  },
  duet: {
    label: { vi: '🎬 AI Pose Duet & Học Tập', en: '🎬 AI Pose Duet & Learning' },
    desc: {
      vi: 'Dán link video KOL từ YouTube, xem AI trích xuất chuyển động, rồi mở camera để "duet" tập theo cùng KOL bằng khung xương AI thời gian thực.',
      en: 'Paste a KOL YouTube video link, watch AI extract the movement, then open your camera to "duet" and train along with the KOL using real-time AI skeleton tracking.',
    },
  },
  match: {
    label: { vi: '🧍 Ghép Tư Thế (Demo tĩnh)', en: '🧍 Pose Match (Static Demo)' },
    desc: {
      vi: 'Phiên bản demo tĩnh không cần camera: kéo các khớp trên mô hình để khớp với tư thế mục tiêu, hoặc xem chế độ đa đối tượng mô phỏng nhiều camera cùng lúc.',
      en: 'A static, camera-free demo: drag the joints on your model to match the target pose, or preview multi-subject/multi-camera mode.',
    },
  },
  library: {
    label: { vi: '📼 Video KOL của tôi (AI Pose thật)', en: '📼 My KOL Videos (real AI Pose)' },
    desc: {
      vi: 'Tải video KOL thô (dán link YouTube hoặc upload file), chạy AI Pose THẬT (MediaPipe, tối đa 2 người) để ghép khung xương, lưu lại và Remix cùng video đã ghép pose.',
      en: 'Load a raw KOL video (YouTube link or file upload), run REAL AI Pose (MediaPipe, up to 2 people) to overlay a skeleton, save it, and Remix alongside the posed video.',
    },
  },
}

export default function RemixSucKhoeKOLPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()
  // 'compare' = So sánh tư thế bằng camera AI thật (chính, mặc định)
  // 'duet'    = AI Pose Duet & Học Tập (video KOL + camera duet thật)
  // 'match'   = Ghép Tư Thế — demo tĩnh cũ, không dùng camera
  const [tab, setTab] = useState('compare')
  const meta = TAB_META[tab]

  // Điều hướng CON bên trong tab 'library' — "mang video qua màn hình trang
  // remix xử lý ghép pose" nghĩa là chuyển subView trong CHÍNH trang này,
  // không cần route/URL riêng: 'list' (thư viện) -> 'makePose' (xử lý AI
  // Pose thật) -> quay lại 'list', hoặc 'list' -> 'remix' (chỉ khi video đã
  // có bản pose) -> quay lại 'list'.
  const [librarySubView, setLibrarySubView] = useState('list') // 'list' | 'makePose' | 'remix'
  const [libraryActiveRaw, setLibraryActiveRaw] = useState(null)
  const [libraryActivePosed, setLibraryActivePosed] = useState(null)

  const handleMakePose = (rawVideo) => {
    setLibraryActiveRaw(rawVideo)
    setLibrarySubView('makePose')
  }
  const handleRemix = (posedVideo) => {
    if (!posedVideo) return // nút Remix đã bị disable ở UI khi chưa có bản pose — phòng hờ double-check
    setLibraryActivePosed(posedVideo)
    setLibrarySubView('remix')
  }
  const handlePoseSaved = () => {
    // KolVideoLibraryPanel tự refresh qua sự kiện 'cdoc_medical_records_changed'
    // (đã bắn trong saveKolPosedVideo) — chỉ cần quay lại danh sách.
    setLibrarySubView('list')
  }

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">REMIX SỨC KHOẺ TỪ KOL</div>
          <h2>🕺 Remix Sức Khoẻ từ KOL</h2>
          <p>{meta.desc[lang] || meta.desc.vi}</p>
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(TAB_META).map(([key, m]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setLibrarySubView('list') }}
            className={`pd-tab-btn${tab === key ? ' pd-active' : ''}`}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: tab === key ? undefined : 'rgba(255,255,255,0.04)',
              color: tab === key ? undefined : '#94a3b8',
              cursor: 'pointer',
            }}
          >
            {m.label[lang] || m.label.vi}
          </button>
        ))}
      </div>

      {tab === 'compare' && <RemixSucKhoeKOLCameraSection variant="panel" hideHeader />}
      {tab === 'duet' && <AIPoseDuetPanel />}

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

      {tab === 'library' && librarySubView === 'list' && (
        <KolVideoLibraryPanel onMakePose={handleMakePose} onRemix={handleRemix} />
      )}
      {tab === 'library' && librarySubView === 'makePose' && (
        <KolPoseMakerPanel
          rawVideo={libraryActiveRaw}
          onSaved={handlePoseSaved}
          onCancel={() => setLibrarySubView('list')}
        />
      )}
      {tab === 'library' && librarySubView === 'remix' && (
        <KolRemixPlayerPanel
          posedVideo={libraryActivePosed}
          onBack={() => setLibrarySubView('list')}
        />
      )}

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
