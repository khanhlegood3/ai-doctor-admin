import React from 'react'
import { useApp } from '../../context/AppContext'
import AIPoseCompareLivePanel from '../AIPoseCompareLivePanel.jsx'

/**
 * RemixSucKhoeKOLCameraSection.jsx
 * -----------------------------------------------------------------------
 * Bản "để tái sử dụng" (reusable) của tính năng "Remix Sức Khỏe KOL bằng
 * camera AI có pose" — trước đây tính năng này (AIPoseCompareLivePanel)
 * chỉ được nhúng trực tiếp, không có phần chữ giới thiệu, ở đúng 1 chỗ
 * (tab "So Sánh Tư Thế" trong RemixSucKhoeKOLPanel.jsx). Tách khung
 * heading + panel này ra component chung để nhúng được ở NHIỀU nơi khác
 * nhau (vd: ngay dưới khối "2 khung xương pose" User vs KOL trên trang
 * landing "Remix Sức Khỏe") mà không lặp code.
 *
 * Bên trong vẫn dùng đúng AIPoseCompareLivePanel.jsx — pipeline AI thị
 * giác thật (MediaPipe Pose Landmarker qua useMediaPipeVision) đo góc
 * khớp tay/chân theo thời gian thực và chấm điểm % khớp với tư thế mục
 * tiêu, không đổi logic camera bên trong.
 *
 * Camera mặc định KHÔNG mở sẵn (camOpen = false ngay trong
 * AIPoseCompareLivePanel.jsx, giữ nguyên như code cũ) — người dùng tự
 * bấm nút "Bật camera" / "Tắt camera" có sẵn trong panel để ẩn/hiện
 * camera khi muốn.
 *
 * Props:
 *  - variant   'panel' | 'light'   (default 'panel')
 *              'panel' : khung tối, dùng class ai-healthcare-vision-*
 *                        có sẵn trong app (giống các trang camera AI
 *                        khác như Vision Sync, Dino Jump, …)
 *              'light' : card nền trắng bo góc, hợp đặt trong các khối
 *                        landing page nền sáng (vd HealthRemixWeb3Ecosystem)
 *  - title     override tiêu đề (optional)
 *  - subtitle  override mô tả (optional)
 *  - className thêm class ngoài cho khung gốc (optional)
 */
export default function RemixSucKhoeKOLCameraSection({
  variant = 'panel',
  title,
  subtitle,
  className = '',
  hideHeader = false,
}) {
  const { lang } = useApp()

  const heading =
    title ?? (lang === 'vi' ? '🎯 So Sánh Tư Thế (Camera AI)' : '🎯 Pose Compare (AI Camera)')

  const desc =
    subtitle ??
    (lang === 'vi'
      ? 'Bật camera thật — AI (MediaPipe Pose Landmarker) đo góc khớp tay/chân của bạn theo thời gian thực và chấm điểm % khớp với tư thế mục tiêu (KOL). Đây là AI thị giác thật, không phải mô phỏng. Camera không tự mở, bạn tự bấm nút để bật/tắt.'
      : 'Turn on your real camera — AI (MediaPipe Pose Landmarker) measures your joint angles in real time and scores how closely you match the target (KOL) pose. Real computer vision, not a simulation. The camera does not open automatically; you turn it on/off yourself.')

  if (variant === 'light') {
    return (
      <div className={`bg-white rounded-3xl p-6 sm:p-8 card-shadow-hr border border-gray-50 ${className}`}>
        {!hideHeader && (
          <div className="mb-5">
            <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mb-3">
              REMIX SỨC KHOẺ TỪ KOL
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">{heading}</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-2xl leading-relaxed">{desc}</p>
          </div>
        )}
        <AIPoseCompareLivePanel />
      </div>
    )
  }

  return (
    <div className={`animate-fade ai-healthcare-vision-page ${className}`}>
      {!hideHeader && (
        <section className="ai-healthcare-vision-header">
          <div>
            <div className="ai-healthcare-vision-kicker">REMIX SỨC KHOẺ TỪ KOL</div>
            <h2>{heading}</h2>
            <p>{desc}</p>
          </div>
        </section>
      )}
      <AIPoseCompareLivePanel />
    </div>
  )
}
