import React from 'react'
import { useApp } from '../context/AppContext'

// App tĩnh độc lập (React/TS build bằng Vite riêng) được nhúng qua iframe
// cùng-origin từ public/games/chess-chat/, giống cách các app/game khác
// (Remix Sức Khoẻ KOL, Bảo Vệ Cơ Thể...) được phục vụ trực tiếp bởi Vercel/Vite.
const CHESS_CHAT_APP_URL = '/games/chess-chat/index.html'

export default function ChessChatPanel() {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">CHESS CHAT</div>
          <h2>♟️ Chess Chat</h2>
          <p>
            {lang === 'en'
              ? 'Play chess and chat with each piece — every piece has its own AI personality and voice.'
              : 'Chơi cờ vua và trò chuyện với từng quân cờ — mỗi quân có cá tính và giọng nói AI riêng.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Chess Chat">
        <iframe
          title="Chess Chat"
          src={CHESS_CHAT_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="fullscreen; microphone"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>
    </div>
  )
}
