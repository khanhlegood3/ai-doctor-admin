import React, { useState } from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import PoseCameraDinoJumpSection from './health-games/PoseCameraDinoJumpSection.jsx'
import DinoPalSection from './health-games/DinoPalSection.jsx'

// Cùng mô hình với Vision Sync / Video to Learning: app con độc lập (Vite
// multi-page build riêng, xem vite.config.js) được nhúng qua iframe
// cùng-origin, chuyển thể từ dino-jump_.zip (app AI Studio "Dino Jump!").
// Game dùng MediaPipe Pose Landmarker để phát hiện người chơi nhảy thật
// (qua camera) và điều khiển khủng long né xương rồng — không gọi bất kỳ
// AI API trả phí nào (không Gemini, không backend), toàn bộ chạy client-side.
//
// Phần khung camera-AI-pose thật (iframe + nội dung) đã được tách ra
// component dùng chung PoseCameraDinoJumpSection.jsx để tái sử dụng ở
// nhiều nơi khác (đầu trang landing, trang "Game sức khỏe", …). File này
// chỉ còn giữ khung panel + NavButtons điều hướng giữa các mục.
//
// Cập nhật: thêm tab "Dino Pal" — chuyển thể từ dino-pal.zip, cặp đôi thân
// thiện với Dino Jump (cùng nhân vật T-Rex pixel Chrome), nhưng là app
// "nuôi thú ảo" (chải lông/cho ăn/chơi cùng) thay vì điều khiển nhảy bằng
// camera. Xem DinoPalSection.jsx và src/dino-pal-khanh/.
const TABS = [
  { id: 'jump', labelVi: '🦖 Dino Jump', labelEn: '🦖 Dino Jump' },
  { id: 'pal', labelVi: '🐣 Dino Pal', labelEn: '🐣 Dino Pal' },
]

export default function DinoJumpPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()
  const [activeTab, setActiveTab] = useState('jump')

  return (
    <>
      <div className="flex justify-center gap-2 mb-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {lang === 'vi' ? tab.labelVi : tab.labelEn}
          </button>
        ))}
      </div>

      {activeTab === 'jump' ? (
        <PoseCameraDinoJumpSection lang={lang} variant="panel" />
      ) : (
        <DinoPalSection lang={lang} />
      )}

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </>
  )
}
