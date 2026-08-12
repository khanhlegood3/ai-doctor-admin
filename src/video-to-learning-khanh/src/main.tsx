import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin, giống cách
// vision-sync-khanh và mediapipe-khanh đang làm — không vendor Tailwind riêng.
import '../../index.css';

const rootEl = document.getElementById('video-to-learning-khanh-root');
if (!rootEl) {
  console.warn('[video-to-learning-khanh] Không tìm thấy phần tử #video-to-learning-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
