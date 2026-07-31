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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
