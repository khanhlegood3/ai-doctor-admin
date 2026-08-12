import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './components/App.tsx';
// Chuyển đổi từ vibecheck.zip (app AI Studio độc lập: React 19 + Tailwind
// v4 riêng qua @tailwindcss/vite). KHÔNG dùng chung index.css của app chính
// (khác với vision-sync-khanh/vibe-tracking-khanh) vì main.css gốc của
// VibeCheck định nghĩa cả trăm class tiện ích riêng (bg-primary, chip,
// v.v.) mà UI các component bên dưới phụ thuộc trực tiếp — dùng riêng
// tránh xung đột và đảm bảo đủ class. Đã đổi "@import 'tailwindcss'" (cú
// pháp v4) sang 3 directive @tailwind chuẩn v3 trong main.css để tương
// thích pipeline PostCSS + tailwind.config.js hiện có của repo (content
// glob đã bao gồm "./src/**/*.{js,ts,jsx,tsx}" nên vẫn qué được các class
// Tailwind thuần dùng xen kẽ trong component, ví dụ "flex", "py-2"...).
import './main.css';

// PHÒNG VỆ (giống mediapipe-khanh/vision-sync-khanh): id riêng thay vì
// "root" dùng chung để không tự vẽ đè lên app chính nếu chunk này lỡ bị
// nạp trên trang đó.
const rootEl = document.getElementById('vibe-check-khanh-root');
if (!rootEl) {
  console.warn('[vibe-check-khanh] Không tìm thấy phần tử #vibe-check-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
