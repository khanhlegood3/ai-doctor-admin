import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin thay vì
// vendor riêng Tailwind v4 (bản gốc AI Studio dùng @tailwindcss/vite) — v4
// sẽ xung đột với pipeline PostCSS + tailwind.config.js hiện có của repo.
// tailwind.config.js đã có content glob "./src/**/*.{js,ts,jsx,tsx}" nên các
// class Tailwind dùng trong App.tsx bên dưới vẫn được compile bình thường.
import '../../index.css';

// PHÒNG VỆ (giống mediapipe-khanh): dùng id riêng "vision-sync-khanh-root"
// thay vì "root" dùng chung — trước đây trùng đúng id div#root của app
// React chính (ai-doctor-admin), nên nếu chunk này lỡ bị nạp trên trang đó
// vì bất kỳ lý do build/chunk-splitting nào, nó sẽ tự vẽ đè lên app chính
// và chạy toàn bộ camera/GPU/audio ngay lập tức — đây chính là nguyên nhân
// gây "trang đơ ngay khi vừa mở, chưa bấm gì". Nếu không tìm thấy phần tử
// của chính mình thì chỉ log rồi bỏ qua, không throw/crash.
const rootEl = document.getElementById('vision-sync-khanh-root');
if (!rootEl) {
  console.warn('[vision-sync-khanh] Không tìm thấy phần tử #vision-sync-khanh-root trong DOM — bỏ qua khởi tạo thay vì crash.');
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
