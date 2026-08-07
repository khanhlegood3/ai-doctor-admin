import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin, giống cách
// dino-jump-khanh, vision-sync-khanh, video-to-learning-khanh đang làm —
// không vendor Tailwind riêng.
import '../../index.css';
// Vài class/keyframes riêng của Dino pal (rainbow-border, animate-rotate-
// gradient, animate-reverse-ping, ...) không có sẵn trong index.css dùng
// chung — tách riêng ra file nhỏ này thay vì import nguyên index.css gốc
// của dino-pal.zip (bản gốc dùng cú pháp @theme/@custom-variant của
// Tailwind v4, không tương thích Tailwind v3 mà dự án đang dùng).
import './dino-pal.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
