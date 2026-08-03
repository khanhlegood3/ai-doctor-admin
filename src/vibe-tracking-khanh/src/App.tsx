// Chuyển đổi từ vibeviz.zip (app AI Studio độc lập: React 19 + MediaPipe
// FaceLandmarker/HandLandmarker + Gemini). Nhúng theo đúng công nghệ của
// "Vision Sync"/"Video to Learning" — app con độc lập (Vite multi-page
// build riêng, xem vite.config.js) qua iframe cùng-origin, không phải
// component React import trực tiếp — giữ tách biệt để không xung đột
// dependency với app chính (xem src/vibe-tracking-khanh/).
import { useState } from 'react';
import { AudioLines, Hand } from 'lucide-react';
import VibeVizTab from './components/VibeVizTab';
import CustomAnalyticsTab from './components/CustomAnalyticsTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'vibeviz' | 'sign'>('sign');

  return (
    <div className="min-h-screen w-full max-w-full bg-slate-900 text-slate-50 p-2 sm:p-4 xl:p-5 font-sans flex flex-col items-stretch overflow-x-hidden">
      <header className="mb-4 text-center w-full">
        <h1 className="text-3xl sm:text-4xl font-black mb-2 text-indigo-400 italic uppercase tracking-tighter flex items-center justify-center gap-3">
          <AudioLines className="w-10 h-10" />
          VibeViz
        </h1>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-6">
          Multi-Perspective Analytics + AI Insights
        </p>

        {/* Tab Navigation */}
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3 sm:gap-4 border-b-4 border-slate-800 pb-4">
          <button
            onClick={() => setActiveTab('sign')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all focus:outline-none focus:ring-4 focus:ring-emerald-500 ${
              activeTab === 'sign'
                ? 'bg-emerald-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <Hand className="w-5 h-5" />
            Sign Language
          </button>
          <button
            onClick={() => setActiveTab('vibeviz')}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl font-black uppercase tracking-widest text-sm transition-all focus:outline-none focus:ring-4 focus:ring-indigo-500 ${
              activeTab === 'vibeviz'
                ? 'bg-indigo-600 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] -translate-y-1'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            <AudioLines className="w-5 h-5" />
            Emotion Mesh
          </button>
        </div>
      </header>

      <main className="w-full max-w-full min-w-0 flex-1 flex flex-col items-stretch overflow-x-hidden">
        {activeTab === 'vibeviz' ? <VibeVizTab /> : <CustomAnalyticsTab />}
      </main>
    </div>
  );
}
