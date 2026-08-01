import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminHistoryPanel from './AdminHistoryPanel.tsx';
// Dùng chung file CSS/Tailwind (v3) của toàn bộ ai-doctor-admin — giống
// main.tsx (trang chính của sub-app này), không vendor Tailwind riêng.
import '../../index.css';

// Entry point RIÊNG cho trang Admin của "Video to Learning" (xem admin.html)
// — tách khỏi main.tsx (trang chính, dành cho user thường) vì đây là 2 màn
// hình hoàn toàn khác nhau (1 bên tạo app học tập, 1 bên xem thống kê toàn
// hệ thống). Được nhúng qua <iframe> cùng-origin từ
// src/components/admin/VideoToLearningAdminPanel.jsx, đúng mô hình sub-app
// đã dùng cho trang chính.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AdminHistoryPanel />
  </StrictMode>,
);
