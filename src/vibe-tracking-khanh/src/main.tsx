import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin thay vì
// vendor riêng Tailwind v4 (bản gốc AI Studio "vibeviz" dùng @tailwindcss/vite)
// — v4 sẽ xung đột với pipeline PostCSS + tailwind.config.js hiện có của
// repo (giống cách src/vision-sync-khanh/src/main.tsx đã làm).
// tailwind.config.js đã có content glob "./src/**/*.{js,ts,jsx,tsx}" nên các
// class Tailwind dùng trong App.tsx/components bên dưới vẫn được compile
// bình thường.
import '../../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
