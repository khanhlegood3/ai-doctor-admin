import React from 'react'

/**
 * BringAnyIdeaToLifeEmbedSection.jsx
 * -----------------------------------------------------------------------
 * Bản "để tái sử dụng" của tính năng "Bring Any Idea to Life" (chụp/upload
 * ảnh phác thảo, PDF, video hoặc dán link -> AI dựng thành 1 app web chạy
 * được thật) — theo đúng pattern của PoseCameraDinoJumpSection.jsx, để
 * nhúng được vào trang "Game sức khỏe" công khai trên landing page mà
 * không cần đăng nhập.
 *
 * Bên trong vẫn là app con Vite multi-page riêng
 * (src/bring-any-idea-to-life-khanh/index.html) nhúng qua iframe
 * cùng-origin, gọi tới /api/groq-proxy (provider "bring-any-idea-to-life")
 * — endpoint này chạy trên chính domain landing page nên vẫn hoạt động
 * bình thường khi nhúng iframe (không phải cross-origin).
 *
 * Props: giống PoseCameraDinoJumpSection (lang, variant, title, subtitle,
 * className, frameHeight).
 */
const BRING_ANY_IDEA_TO_LIFE_APP_URL = '/src/bring-any-idea-to-life-khanh/index.html'

export default function BringAnyIdeaToLifeEmbedSection({
  lang = 'vi',
  variant = 'panel',
  title,
  subtitle,
  className = '',
  frameHeight = 'h-[640px] sm:h-[760px]',
}) {
  const isHero = variant === 'hero'

  const heading =
    title ?? (lang === 'vi' ? '✨ Biến Mọi Ý Tưởng Thành Hiện Thực' : '✨ Bring Any Idea to Life')

  const desc =
    subtitle ??
    (lang === 'vi'
      ? 'Chụp ảnh phác thảo trên giấy, whiteboard, hay dán link video/ảnh bất kỳ — AI đọc hình và dựng ngay thành 1 app web chạy được thật, ngay trong trình duyệt.'
      : 'Snap a photo of a napkin sketch or whiteboard, or paste any video/image link — AI reads it and builds a real, working web app right in your browser.')

  if (isHero) {
    return (
      <section
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 sm:p-8 ${className}`}
        aria-label="Bring Any Idea to Life app"
      >
        <div className="text-white mb-4">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-[#00C2FF] mb-1">
            AI APP BUILDER
          </div>
          <h2 className="text-2xl sm:text-3xl font-black leading-tight">{heading}</h2>
          <p className="text-sm text-gray-300 mt-2 max-w-2xl leading-relaxed">{desc}</p>
        </div>
        <div className={`rounded-2xl overflow-hidden border border-white/10 bg-black ${frameHeight}`}>
          <iframe
            title="Bring Any Idea to Life"
            src={BRING_ANY_IDEA_TO_LIFE_APP_URL}
            className="w-full h-full border-0"
            allow="clipboard-read; clipboard-write; fullscreen"
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
          <div className="ai-healthcare-vision-kicker">AI APP BUILDER</div>
          <h2>{heading}</h2>
          <p>{desc}</p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Bring Any Idea to Life app">
        <iframe
          title="Bring Any Idea to Life"
          src={BRING_ANY_IDEA_TO_LIFE_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="clipboard-read; clipboard-write; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>
      <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 10 }}>
        Powered by Zero to Forever Foundation Platform
      </p>
    </div>
  )
}
