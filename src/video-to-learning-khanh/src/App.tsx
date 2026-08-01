// Chuyển thể từ dự án AI Studio "video-to-learning-app" (Aaron Wade) vào
// ai-doctor-admin — theo đúng mô hình sub-app "-khanh" đã có (xem
// src/vision-sync-khanh/src/App.tsx): giữ TSX, dùng chung Tailwind + trực
// tiếp @google/genai (đã có sẵn trong package.json gốc). Đã lược bớt 2 phụ
// thuộc nặng của bản gốc (@monaco-editor/react, react-tabs) để không phải
// thêm dependency mới: dùng <textarea> thay Monaco và tab tự viết bằng
// state thay react-tabs.

import { useRef, useState } from 'react';
import { generateText } from './lib/textGeneration';
import { parseHTML, parseJSON } from './lib/parse';
import {
  CODE_REGION_CLOSER,
  SPEC_ADDENDUM,
  SPEC_FROM_VIDEO_PROMPT,
} from './lib/prompts';
import { getYoutubeEmbedUrl, validateYoutubeUrl } from './lib/youtube';

type LoadingState = 'idle' | 'loading-spec' | 'loading-code' | 'ready' | 'error';
type TabKey = 'render' | 'code' | 'spec';

type ExampleVideo = {
  title: string;
  url: string;
};

// Đúng 12 video mẫu từ file public/data/examples.json của dự án AI Studio gốc
// "video-to-learning-app" (Aaron Wade) — bao gồm cả mục cuối (easter egg,
// tiêu đề để trống có chủ đích trong bản gốc).
const EXAMPLE_VIDEOS: ExampleVideo[] = [
  { title: 'How chords work', url: 'https://www.youtube.com/watch?v=JfD0nHrJDC0' },
  { title: 'Understanding fractals', url: 'https://youtu.be/WFtTdf3I6Ug?si=8CO3POAroZcf9Vfj' },
  { title: 'Logic behind Chinese characters', url: 'https://youtu.be/U0EySK4T2aY?si=HV_ZHWS8KdJZmZJP' },
  { title: 'Magical mitosis', url: 'https://www.youtube.com/watch?v=f-ldPgEfAHI' },
  { title: "History of Manhattan's Broadway", url: 'https://www.youtube.com/watch?v=erHe_WF4D1s' },
  { title: 'The craft of the casserole', url: 'https://www.youtube.com/watch?v=hfCwwG8Ats0' },
  { title: 'The craft of the cocktail', url: 'https://www.youtube.com/watch?v=AWnIqpsfyPU' },
  { title: 'Calligraphy & handlettering', url: 'https://www.youtube.com/watch?v=sBoVGqiSzr4' },
  { title: 'Making friends', url: 'https://www.youtube.com/watch?v=I9hJ_Rux9y0' },
  { title: 'Hit more home runs', url: 'https://www.youtube.com/watch?v=zg_tqDklGcs' },
  { title: 'Tie your shoes', url: 'https://www.youtube.com/watch?v=q44kByZmKDs' },
  { title: '', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
];

// Tách videoId từ nhiều dạng link YouTube (watch?v=, youtu.be/, embed/...),
// giống hệt getThumbnailUrl trong ExampleGallery.tsx của bản gốc.
function getYoutubeThumbnailUrl(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
}

export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);

  const [videoUrl, setVideoUrl] = useState('');
  const [validating, setValidating] = useState(false);
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [spec, setSpec] = useState('');
  const [code, setCode] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('render');
  const [iframeKey, setIframeKey] = useState(0);

  const isBusy = validating || loadingState === 'loading-spec' || loadingState === 'loading-code';

  const generateFromVideo = async (url: string) => {
    try {
      setError(null);
      setSpec('');
      setCode('');
      setActiveTab('render');
      setLoadingState('loading-spec');

      const specResponse = await generateText({
        modelName: 'gemini-2.5-flash',
        prompt: SPEC_FROM_VIDEO_PROMPT,
        videoUrl: url,
      });
      const generatedSpec = parseJSON(specResponse).spec + SPEC_ADDENDUM;
      setSpec(generatedSpec);
      setLoadingState('loading-code');

      const codeResponse = await generateText({
        modelName: 'gemini-2.5-pro',
        prompt: generatedSpec,
      });
      const generatedCode = parseHTML(codeResponse, CODE_REGION_CLOSER);
      setCode(generatedCode);
      setIframeKey((k) => k + 1);
      setLoadingState('ready');
    } catch (err) {
      console.error('[video-to-learning] generate error:', err);
      setError(err instanceof Error ? err.message : 'Đã có lỗi không xác định xảy ra.');
      setLoadingState('error');
    }
  };

  const submitUrl = async (value: string) => {
    setValidating(true);
    setVideoUrl('');

    const result = await validateYoutubeUrl(value);
    setValidating(false);

    if (!result.isValid) {
      setError(result.error || 'Link YouTube không hợp lệ');
      setLoadingState('error');
      return;
    }

    setVideoUrl(value);
    await generateFromVideo(value);
  };

  const handleSubmit = async () => {
    const value = inputRef.current?.value.trim() || '';
    if (!value || isBusy) {
      inputRef.current?.focus();
      return;
    }

    await submitUrl(value);
  };

  const handleExampleClick = async (example: ExampleVideo) => {
    if (isBusy) return;
    if (inputRef.current) inputRef.current.value = example.url;
    await submitUrl(example.url);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isBusy) {
      handleSubmit();
    }
  };

  const handleCodeChange = (value: string) => {
    setCode(value);
  };

  const rerenderFromCode = () => {
    setIframeKey((k) => k + 1);
    setActiveTab('render');
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-6">
        {/* Left column: input + video preview */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              🎬 Video → Ứng dụng học tập
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Dán link YouTube, AI sẽ tạo ra một mini-app tương tác giúp người học nắm nội dung video.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="youtube-url" className="text-sm text-slate-300">
              Link video YouTube:
            </label>
            <input
              ref={inputRef}
              id="youtube-url"
              type="text"
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isBusy}
              onKeyDown={handleKeyDown}
              onChange={() => setVideoUrl('')}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isBusy}
            className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors px-4 py-2 font-semibold"
          >
            {validating
              ? 'Đang kiểm tra link...'
              : loadingState === 'loading-spec'
                ? 'Đang phân tích video...'
                : loadingState === 'loading-code'
                  ? 'Đang tạo ứng dụng...'
                  : 'Tạo ứng dụng học tập'}
          </button>

          <div className="relative w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800" style={{ paddingTop: '56.25%' }}>
            {videoUrl ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={getYoutubeEmbedUrl(videoUrl)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="youtube-preview"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm px-4 text-center">
                Video sẽ hiện ở đây sau khi bạn dán link
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-slate-300">Ví dụ</h3>
            <div className="grid grid-cols-2 gap-3">
              {EXAMPLE_VIDEOS.map((example) => (
                <button
                  key={example.url}
                  type="button"
                  onClick={() => handleExampleClick(example)}
                  disabled={isBusy}
                  className="group text-left rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-sky-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="relative w-full bg-slate-800" style={{ paddingTop: '56.25%' }}>
                    <img
                      src={getYoutubeThumbnailUrl(example.url)}
                      alt={example.title || 'Ví dụ ẩn'}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="px-2 py-1.5 text-xs text-slate-300 group-hover:text-sky-400 line-clamp-2 min-h-[2rem] flex items-center justify-center text-center">
                    {example.title}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Video được phân tích bằng Gemini qua máy chủ — không cần cấu hình gì thêm ở trình duyệt.
          </p>
        </div>

        {/* Right column: generated content */}
        <div className="flex flex-col min-h-[70vh] rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="flex border-b border-slate-800 px-2">
            {(
              [
                ['render', 'Xem trước'],
                ['code', 'Mã HTML'],
                ['spec', 'Spec'],
              ] as [TabKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-sky-500 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 relative">
            {loadingState === 'error' && !spec ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2">
                <div className="text-4xl">⚠️</div>
                <h3 className="text-lg font-semibold">Có lỗi xảy ra</h3>
                <p className="text-slate-400 text-sm">{error || 'Đã có lỗi không xác định.'}</p>
              </div>
            ) : loadingState === 'idle' ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
                Dán một link YouTube ở bên trái để bắt đầu
              </div>
            ) : loadingState === 'loading-spec' || loadingState === 'loading-code' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-sky-500 animate-spin" />
                <p className="text-slate-400 text-sm">
                  {loadingState === 'loading-spec' ? 'Đang phân tích nội dung video...' : 'Đang tạo mã ứng dụng từ spec...'}
                </p>
              </div>
            ) : activeTab === 'render' ? (
              <iframe
                key={iframeKey}
                srcDoc={code}
                title="rendered-app"
                sandbox="allow-scripts"
                className="absolute inset-0 w-full h-full bg-white"
              />
            ) : activeTab === 'code' ? (
              <div className="absolute inset-0 flex flex-col">
                <textarea
                  value={code}
                  onChange={(e) => handleCodeChange(e.target.value)}
                  spellCheck={false}
                  className="flex-1 w-full resize-none bg-slate-950 text-slate-200 font-mono text-xs p-4 outline-none"
                />
                <div className="p-2 border-t border-slate-800">
                  <button
                    onClick={rerenderFromCode}
                    className="rounded-md bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-sm font-medium"
                  >
                    Cập nhật xem trước
                  </button>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 overflow-auto p-4 whitespace-pre-wrap font-mono text-xs text-slate-300">
                {spec}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
