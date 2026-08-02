/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Chuyển đổi từ video-analyzer.zip (app AI Studio độc lập: React 19 +
// @google/genai gọi thẳng client-side). Dùng đúng công nghệ nhúng như
// vision-sync-khanh/vibe-check-khanh: app con Vite multi-page riêng, nhúng
// qua iframe cùng-origin ở VideoAnalyzerPanel.jsx (xem vite.config.js).
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
