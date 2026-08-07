import React from 'react'

/**
 * DinoPalSection.jsx
 * -----------------------------------------------------------------------
 * "Nuôi thú ảo" (tamagotchi) chú khủng long Chrome Dino — chuyển thể từ
 * dino-pal.zip, cặp đôi thân thiện với tính năng "Khủng long nhảy bằng
 * camera AI" (DinoJumpPanel.jsx / PoseCameraDinoJumpSection.jsx): cùng
 * chung nhân vật T-Rex pixel từ trang "No Internet" của Chrome, nhưng ở
 * đây là chăm sóc (chải lông, cho ăn, chơi cùng) thay vì điều khiển nhảy.
 *
 * Cũng là app con Vite multi-page riêng (src/dino-pal-khanh/index.html)
 * nhúng qua iframe cùng-origin, y hệt mô hình dino-jump-khanh. Chỉ có 1
 * lệnh gọi AI (lúc "nhận nuôi") — đi qua endpoint dùng chung /api/groq-proxy
 * (provider: 'dino-pal', Groq miễn phí), không dùng Gemini/API key ở
 * client.
 *
 * Props:
 *  - lang        'vi' | 'en'    (default 'vi')
 *  - className    thêm class ngoài cho <section> gốc (optional)
 *  - frameHeight  chiều cao khung game (optional, default 'h-[560px] sm:h-[640px]')
 */
const DINO_PAL_APP_URL = '/src/dino-pal-khanh/index.html'

export default function DinoPalSection({
  lang = 'vi',
  className = '',
  frameHeight = 'h-[560px] sm:h-[640px]',
}) {
  const heading = lang === 'vi' ? '🦖 Nuôi thú ảo Dino Pal' : '🦖 Dino Pal virtual pet'

  const desc =
    lang === 'vi'
      ? 'Chải lông, cho ăn, chơi cùng và chăm sóc chú khủng long Chrome của bạn để kiếm tiền trong game — mua phụ kiện ở shop và nuôi lớn tới cấp cao nhất trước khi chú "trưởng thành".'
      : 'Brush, feed, play and care for your Chrome Dino to earn in-game currency — redeem it in the shop and raise your dino to the highest level before it grows up.'

  return (
    <section
      className={`rounded-3xl border border-gray-200 bg-white overflow-hidden ${className}`}
      aria-label="Dino Pal virtual pet app"
    >
      <div className="p-5 sm:p-6 pb-0">
        <h2 className="text-xl sm:text-2xl font-black text-gray-900">{heading}</h2>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">{desc}</p>
      </div>
      <div className={`mt-4 overflow-hidden bg-black ${frameHeight}`}>
        <iframe
          title="Dino Pal virtual pet"
          src={DINO_PAL_APP_URL}
          className="w-full h-full border-0"
          allow="autoplay"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <p className="text-[11px] text-gray-400 text-center py-3">
        Powered by Zero to Forever Foundation Platform
      </p>
    </section>
  )
}
