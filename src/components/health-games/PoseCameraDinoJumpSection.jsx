import React from 'react'

/**
 * PoseCameraDinoJumpSection.jsx
 * -----------------------------------------------------------------------
 * Bản "để tái sử dụng" (reusable) của tính năng "Khủng long nhảy bằng
 * camera AI có pose" — trước đây chỉ có ở DinoJumpPanel.jsx (1 chỗ dùng
 * trong app chính). Tách ra component chung này để nhúng được ở NHIỀU
 * nơi khác nhau (đầu trang landing, trang "Game sức khỏe", …) mà không
 * lặp code.
 *
 * Bên trong vẫn là app con Vite multi-page riêng
 * (src/dino-jump-khanh/index.html) nhúng qua iframe cùng-origin — dùng
 * MediaPipe Pose Landmarker để phát hiện người chơi nhảy thật qua camera,
 * không gọi AI API trả phí nào.
 *
 * Camera mặc định MỞ ngay khi load (showVision = true trong DinoGame.tsx)
 * — người dùng vẫn có thể tự ẩn/hiện khung xem camera qua checkbox
 * "Show Camera Feed (Debug)" có sẵn trong game (giữ nguyên hành vi/toggle
 * của code cũ, chỉ đổi giá trị mặc định).
 *
 * Props:
 *  - lang        'vi' | 'en'                 (default 'vi')
 *  - variant      'panel' | 'hero'            (default 'panel')
 *                 'panel' : card trắng full, giống DinoJumpPanel gốc
 *                           (dùng trong menu sản phẩm / trang con)
 *                 'hero'  : nền tối trong suốt, gọn hơn, hợp đặt ngay
 *                           trên đầu trang landing (trong khu vực Hero)
 *  - title        override tiêu đề (optional)
 *  - subtitle     override mô tả (optional)
 *  - className    thêm class ngoài cho <section> gốc (optional)
 *  - frameHeight  chiều cao khung game khi variant='hero' (optional,
 *                 default 'h-[420px] sm:h-[520px]')
 */
const DINO_JUMP_APP_URL = '/src/dino-jump-khanh/index.html'

export default function PoseCameraDinoJumpSection({
  lang = 'vi',
  variant = 'panel',
  title,
  subtitle,
  className = '',
  frameHeight = 'h-[420px] sm:h-[520px]',
}) {
  const isHero = variant === 'hero'

  const heading =
    title ?? (lang === 'vi' ? '🦖 AI camera control dino jump' : '🦖 AI camera control dino jump')

  const desc =
    subtitle ??
    (lang === 'vi'
      ? 'Bật camera và nhảy thật ngoài đời để điều khiển khủng long né xương rồng — AI (MediaPipe) theo dõi chuyển động cơ thể bạn theo thời gian thực, không cần bàn phím hay chuột. Camera tự bật sẵn, bạn có thể ẩn/hiện khung xem camera bất cứ lúc nào.'
      : 'Turn on your camera and jump for real to control the dino past the cacti — AI (MediaPipe) tracks your body movement in real time, no keyboard or mouse needed. The camera starts on by default; you can show/hide the camera preview anytime.')

  if (isHero) {
    return (
      <section
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-8 ${className}`}
        aria-label="AI camera control dino jump app"
      >
        <div className="text-white mb-4">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#00C2FF] mb-1">
            AI CAMERA CONTROL
          </div>
          <h2 className="text-2xl sm:text-3xl font-black leading-tight">{heading}</h2>
          <p className="text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">{desc}</p>
        </div>
        <div className={`rounded-2xl overflow-hidden border border-white/10 bg-black ${frameHeight}`}>
          <iframe
            title="AI camera control dino jump"
            src={DINO_JUMP_APP_URL}
            className="w-full h-full border-0"
            allow="camera; fullscreen; clipboard-read; clipboard-write"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-3">
          {lang === 'vi' ? 'Powered by Zero to Forever Foundation Platform' : 'Powered by Zero to Forever Foundation Platform'}
        </p>
      </section>
    )
  }

  return (
    <div className={`animate-fade ai-healthcare-vision-page ${className}`}>
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">AI CAMERA CONTROL</div>
          <h2>{heading}</h2>
          <p>{desc}</p>
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
      <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 10 }}>
        Powered by Zero to Forever Foundation Platform
      </p>
    </div>
  )
}
