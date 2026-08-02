import React from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'

// Dùng đúng công nghệ của "Vision Sync": app con độc lập (Vite multi-page
// build riêng, xem vite.config.js) được nhúng qua iframe cùng-origin, không
// phải component React import trực tiếp — vì video-analyzer-khanh là một
// dự án AI Studio hoàn chỉnh riêng (React 19 + @google/genai function
// calling để hỏi-đáp về video: tóm tắt, phụ đề, biểu đồ, haiku...), tách
// biệt giữ cho an toàn/không xung đột dependency với app chính (xem
// src/video-analyzer-khanh/). API key Gemini KHÔNG nằm ở client — app con
// gọi qua /api/groq-proxy (provider: 'video-analyzer'), xem
// api/_lib/videoAnalyzerProxy.js.
const VIDEO_ANALYZER_APP_URL = '/src/video-analyzer-khanh/index.html'

export default function VideoAnalyzerPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()

  return (
    <div className="animate-fade ai-healthcare-vision-page">
      <section className="ai-healthcare-vision-header">
        <div>
          <div className="ai-healthcare-vision-kicker">VIDEO ANALYZER</div>
          <h2>🎬 Phân Tích Video</h2>
          <p>
            {lang === 'vi'
              ? 'Kéo-thả 1 video vào khung bên dưới, sau đó chọn cách khám phá: tạo phụ đề theo cảnh, tóm tắt thành đoạn văn, liệt kê các khoảnh khắc chính, làm bảng vật thể theo mốc thời gian, sáng tác haiku, vẽ biểu đồ (độ hấp dẫn/mức độ quan trọng/số người) theo thời gian video, hoặc tự nhập yêu cầu tuỳ ý — AI (Gemini) sẽ "xem" video thật và trả lời kèm mốc thời gian để bấm nhảy tới đúng đoạn.'
              : 'Drag and drop a video into the frame below, then explore it: scene-by-scene captions, a paragraph summary, key moments, a table of objects per timestamp, a haiku, a chart (excitement/importance/people count) over time, or a fully custom prompt — Gemini actually watches the video and answers with clickable timecodes.'}
          </p>
        </div>
      </section>

      <section className="ai-healthcare-vision-frame-card" aria-label="Video Analyzer app">
        <iframe
          title="Video Analyzer"
          src={VIDEO_ANALYZER_APP_URL}
          className="ai-healthcare-vision-frame"
          allow="fullscreen; clipboard-read; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </section>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
