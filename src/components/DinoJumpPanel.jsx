import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import PoseCameraDinoJumpSection from './health-games/PoseCameraDinoJumpSection.jsx'

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
export default function DinoJumpPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <>
      <PoseCameraDinoJumpSection lang={lang} variant="panel" />
      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </>
  )
}
