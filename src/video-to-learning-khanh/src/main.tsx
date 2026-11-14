import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// @ts-ignore — shared browser identity module
import { initializeIdentity } from '../../../public/device-identity.js';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin, giống cách
// vision-sync-khanh và mediapipe-khanh đang làm — không vendor Tailwind riêng.
import '../../index.css';

const rootEl = document.getElementById('video-to-learning-khanh-root');
if (!rootEl) {
  console.warn('[video-to-learning-khanh] Không tìm thấy phần tử #video-to-learning-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  initializeIdentity().then(() => createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )).catch(() => { rootEl.textContent = 'Không khởi tạo được UID. Vui lòng cho phép lưu dữ liệu trang web và tải lại.'; });
}
