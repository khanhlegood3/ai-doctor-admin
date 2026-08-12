import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin, giống cách
// dino-jump-khanh, vision-sync-khanh, video-to-learning-khanh đang làm —
// không vendor Tailwind riêng (app gốc dùng Tailwind v4 qua @tailwindcss/vite,
// bản chuyển thể này bỏ đi vì repo chính đã có Tailwind v3 dùng chung).
import '../../index.css';

const rootEl = document.getElementById('prism-hair-khanh-root');
if (!rootEl) {
  console.warn('[prism-hair-khanh] Không tìm thấy phần tử #prism-hair-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
