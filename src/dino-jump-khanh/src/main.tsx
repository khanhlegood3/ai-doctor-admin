import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin, giống cách
// vision-sync-khanh và video-to-learning-khanh đang làm — không vendor
// Tailwind riêng.
import '../../index.css';

// PHÒNG VỆ (giống mediapipe-khanh/vision-sync-khanh): id riêng thay vì
// "root" dùng chung để không tự vẽ đè lên app chính nếu chunk này lỡ bị
// nạp trên trang đó.
const rootEl = document.getElementById('dino-jump-khanh-root');
if (!rootEl) {
  console.warn('[dino-jump-khanh] Không tìm thấy phần tử #dino-jump-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
