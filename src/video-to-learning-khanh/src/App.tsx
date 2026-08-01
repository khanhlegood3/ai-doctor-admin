// Chuyển thể từ dự án AI Studio "video-to-learning-app" (Aaron Wade) vào
// ai-doctor-admin — bản CẬP NHẬT hỗ trợ dán NHIỀU link cùng lúc (video
// YouTube thường, YouTube Shorts, kênh YouTube, hoặc trang web bất kỳ) thay
// vì chỉ 1 video YouTube như bản gốc.
//
// Mỗi link được phân loại bằng classifyLinkList() (xem lib/linkClassifier.ts)
// rồi xử lý TUẦN TỰ (không song song — tránh dồn dập gọi Groq/Gemini cùng
// lúc, dễ dính rate limit):
//   - youtube_video / youtube_short  -> sinh spec từ video (transcript) rồi
//     sinh code, y hệt luồng cũ (xem runVideoToLearningGenerate).
//   - website                        -> sinh spec từ nội dung trang web
//     (xem runPageToLearningGenerate), rồi sinh code y hệt.
//   - youtube_channel                -> KHÔNG gọi AI (channel không có nội
//     dung đơn để tóm tắt) — chỉ lưu lại link vào lịch sử với status
//     'saved-only', đúng như videoToLearningHistory.js đã thiết kế.
//
// Sau MỖI item (dù thành công hay lỗi) đều lưu lịch sử vào CẢ HAI nơi:
//   - IndexedDB cục bộ (historyStorage.ts) — luôn có sẵn, kể cả mất mạng.
//   - MongoDB qua server (historyClient.ts) — bản "chính", admin xem được.

import { useEffect, useRef, useState } from 'react';
import { generateTextWithMeta } from './lib/textGeneration';
import { parseHTML, parseJSON } from './lib/parse';
import {
  CODE_REGION_CLOSER,
  SPEC_ADDENDUM,
  SPEC_FROM_VIDEO_PROMPT,
} from './lib/prompts';
import { getYoutubeEmbedUrl, validateYoutubeUrl } from './lib/youtube';
import { classifyLinkList, LINK_TYPE_LABELS, type ClassifiedLink, type LinkType } from './lib/linkClassifier';
import { addHistoryEntry, getHistoryEntries, type HistoryEntry } from './lib/history/historyStorage';
import { saveHistoryToServer, fetchHistoryFromServer } from './lib/history/historyClient';
import { getIdentity } from './lib/identity';

type ItemStatus = 'pending' | 'processing' | 'done' | 'error' | 'saved-only';
type TabKey = 'render' | 'code' | 'spec' | 'history';

interface QueueItem extends ClassifiedLink {
  status: ItemStatus;
  spec?: string;
  code?: string;
  error?: string | null;
  aiSource?: string | null;
  pageTitle?: string | null;
}

type ExampleVideo = {
  title: string;
  url: string;
};

// Đúng 12 video mẫu từ file public/data/examples.json của dự án AI Studio gốc
// "video-to-learning-app" (Aaron Wade).
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

function getYoutubeThumbnailUrl(url: string): string {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  const videoId = match && match[2].length === 11 ? match[2] : null;
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '';
}

const STATUS_LABEL: Record<ItemStatus, string> = {
  pending: 'Đang chờ',
  processing: 'Đang xử lý...',
  done: 'Xong',
  'saved-only': 'Đã lưu',
  error: 'Lỗi',
};

export default function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [items, setItems] = useState<QueueItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('render');
  const [iframeKey, setIframeKey] = useState(0);

  const [historyEntries, setHistoryEntries] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const identity = getIdentity();
  const selected = selectedIndex !== null ? items[selectedIndex] : null;

  // --- Lịch sử: nạp từ IndexedDB ngay (nhanh), rồi đối chiếu/merge từ
  // server (bản "chính", đầy đủ hơn nếu người dùng đổi máy).
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const local = await getHistoryEntries(identity.uuid).catch(() => [] as HistoryEntry[]);
      setHistoryEntries(local);
      if (identity.uuid) {
        const remote = await fetchHistoryFromServer(identity.uuid);
        if (remote.length) setHistoryEntries(remote);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistHistory = async (entry: {
    type: LinkType;
    link: string;
    title?: string | null;
    aiSource?: string | null;
    status: 'success' | 'error' | 'saved-only';
    errorMessage?: string | null;
    specPreview?: string | null;
  }) => {
    // Lưu cục bộ trước (luôn thành công, không phụ thuộc mạng)...
    try {
      await addHistoryEntry({
        ownerUuid: identity.uuid,
        type: entry.type,
        link: entry.link,
        title: entry.title ?? null,
        aiSource: entry.aiSource ?? null,
        status: entry.status,
        errorMessage: entry.errorMessage ?? null,
        specPreview: entry.specPreview ?? null,
      });
    } catch (err) {
      console.warn('[video-to-learning] addHistoryEntry (IndexedDB) failed:', err);
    }
    // ...rồi bắn lên server (không chặn UI nếu lỗi, xem historyClient.ts).
    if (identity.uuid) {
      saveHistoryToServer({
        uuid: identity.uuid,
        userId: identity.userId,
        name: identity.name,
        type: entry.type,
        link: entry.link,
        title: entry.title ?? null,
        aiSource: entry.aiSource ?? null,
        status: entry.status,
        errorMessage: entry.errorMessage ?? null,
        specPreview: entry.specPreview ?? null,
      });
    }
  };

  const updateItem = (index: number, patch: Partial<QueueItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  // Xử lý 1 item trong hàng đợi: video/short -> pipeline transcript+Groq cũ,
  // website -> pipeline text trang web, channel -> chỉ lưu link.
  const processItem = async (index: number, item: QueueItem) => {
    updateItem(index, { status: 'processing', error: null });

    if (item.type === 'youtube_channel') {
      await persistHistory({ type: item.type, link: item.url, status: 'saved-only' });
      updateItem(index, { status: 'saved-only' });
      return;
    }

    try {
      const isWebsite = item.type === 'website';
      const specResponse = await generateTextWithMeta(
        isWebsite ? { prompt: SPEC_FROM_VIDEO_PROMPT, pageUrl: item.url } : { prompt: SPEC_FROM_VIDEO_PROMPT, videoUrl: item.url },
      );
      const generatedSpec = parseJSON(specResponse.text).spec + SPEC_ADDENDUM;
      updateItem(index, { spec: generatedSpec, aiSource: specResponse.source, pageTitle: specResponse.pageTitle ?? null });

      const codeResponse = await generateTextWithMeta({ prompt: generatedSpec });
      const generatedCode = parseHTML(codeResponse.text, CODE_REGION_CLOSER);

      updateItem(index, { status: 'done', code: generatedCode });
      setIframeKey((k) => k + 1);

      await persistHistory({
        type: item.type,
        link: item.url,
        title: specResponse.pageTitle ?? null,
        aiSource: specResponse.source ?? null,
        status: 'success',
        specPreview: generatedSpec.slice(0, 500),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Đã có lỗi không xác định xảy ra.';
      updateItem(index, { status: 'error', error: message });
      await persistHistory({ type: item.type, link: item.url, status: 'error', errorMessage: message });
    }
  };

  const runQueue = async (queue: QueueItem[]) => {
    setIsBusy(true);
    for (let i = 0; i < queue.length; i++) {
      // eslint-disable-next-line no-await-in-loop
      await processItem(i, queue[i]);
    }
    setIsBusy(false);
    loadHistory();
  };

  const handleSubmit = async () => {
    const raw = textareaRef.current?.value.trim() || '';
    if (!raw || isBusy) return;

    const classified = classifyLinkList(raw);
    if (!classified.length) {
      alert('Không tìm thấy link hợp lệ nào trong nội dung đã dán.');
      return;
    }

    // Kiểm tra sơ bộ các link video YouTube (giữ hành vi validate cũ) —
    // short/channel/website không cần bước này.
    for (const link of classified) {
      if (link.type === 'youtube_video') {
        // eslint-disable-next-line no-await-in-loop
        const result = await validateYoutubeUrl(link.url);
        if (!result.isValid) {
          console.warn('[video-to-learning] link YouTube có thể không hợp lệ:', link.url, result.error);
        }
      }
    }

    const queue: QueueItem[] = classified.map((c) => ({ ...c, status: 'pending' }));
    setItems(queue);
    setSelectedIndex(0);
    setActiveTab('render');
    await runQueue(queue);
  };

  const handleExampleClick = async (example: ExampleVideo) => {
    if (isBusy) return;
    const queue: QueueItem[] = [{ raw: example.url, url: example.url, type: 'youtube_video', status: 'pending' }];
    setItems(queue);
    setSelectedIndex(0);
    setActiveTab('render');
    if (textareaRef.current) textareaRef.current.value = example.url;
    await runQueue(queue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !isBusy) {
      handleSubmit();
    }
  };

  const handleCodeChange = (value: string) => {
    if (selectedIndex === null) return;
    updateItem(selectedIndex, { code: value });
  };

  const rerenderFromCode = () => {
    setIframeKey((k) => k + 1);
    setActiveTab('render');
  };

  const loadingLabel = isBusy
    ? `Đang xử lý ${items.filter((i) => i.status === 'done' || i.status === 'error' || i.status === 'saved-only').length + 1}/${items.length}...`
    : 'Tạo ứng dụng học tập';

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_1fr] gap-6">
        {/* Left column: input + queue */}
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              🎬 Video/Web → Ứng dụng học tập
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Dán 1 hoặc nhiều link (video YouTube, Shorts, kênh YouTube, hoặc trang web bất kỳ) — mỗi dòng 1 link.
              AI sẽ tạo mini-app tương tác cho từng link.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="link-list" className="text-sm text-slate-300">
              Link (mỗi dòng 1 link, hoặc cách nhau bằng dấu phẩy):
            </label>
            <textarea
              ref={textareaRef}
              id="link-list"
              rows={4}
              placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/shorts/...\nhttps://www.youtube.com/@mot-kenh\nhttps://vi.wikipedia.org/wiki/...'}
              disabled={isBusy}
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm outline-none focus:border-sky-500 disabled:opacity-50 font-mono resize-y"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={isBusy}
            className="w-full rounded-lg bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:cursor-not-allowed transition-colors px-4 py-2 font-semibold"
          >
            {loadingLabel}
          </button>

          {/* Hàng đợi các link đã phân loại */}
          {items.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold text-slate-300">Danh sách ({items.length})</h3>
              <div className="flex flex-col gap-1 max-h-64 overflow-auto pr-1">
                {items.map((it, idx) => (
                  <button
                    key={`${it.url}-${idx}`}
                    onClick={() => {
                      setSelectedIndex(idx);
                      setActiveTab('render');
                    }}
                    className={`text-left rounded-md border px-2.5 py-1.5 text-xs flex items-center gap-2 transition-colors ${
                      selectedIndex === idx ? 'border-sky-500 bg-slate-800' : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                  >
                    <span>{LINK_TYPE_LABELS[it.type].icon}</span>
                    <span className="flex-1 truncate text-slate-300">{it.url}</span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 ${
                        it.status === 'error'
                          ? 'bg-red-900/50 text-red-300'
                          : it.status === 'done' || it.status === 'saved-only'
                            ? 'bg-emerald-900/50 text-emerald-300'
                            : it.status === 'processing'
                              ? 'bg-sky-900/50 text-sky-300'
                              : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {STATUS_LABEL[it.status]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selected && (selected.type === 'youtube_video' || selected.type === 'youtube_short') && (
            <div className="relative w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={getYoutubeEmbedUrl(selected.url)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="youtube-preview"
              />
            </div>
          )}

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
            Video/Short được phân tích qua phụ đề (transcript) + AI Groq. Trang web được phân tích qua nội dung text trích từ HTML.
            Link kênh YouTube chỉ được lưu lại (không gọi AI). Miễn phí hoàn toàn.
          </p>
        </div>

        {/* Right column: generated content + history */}
        <div className="flex flex-col min-h-[70vh] rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          <div className="flex border-b border-slate-800 px-2">
            {(
              [
                ['render', 'Xem trước'],
                ['code', 'Mã HTML'],
                ['spec', 'Spec'],
                ['history', 'Lịch sử'],
              ] as [TabKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  if (key === 'history') loadHistory();
                }}
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
            {activeTab === 'history' ? (
              <div className="absolute inset-0 overflow-auto p-4">
                {historyLoading ? (
                  <p className="text-slate-500 text-sm">Đang tải lịch sử...</p>
                ) : historyEntries.length === 0 ? (
                  <p className="text-slate-500 text-sm">Chưa có lịch sử nào.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {historyEntries.map((h, i) => (
                      <div key={h._id || h.id || i} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                          <span>{LINK_TYPE_LABELS[(h.type as LinkType) || 'website']?.icon}</span>
                          <span className="truncate flex-1">{h.title || h.link}</span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 ${
                              h.status === 'error'
                                ? 'bg-red-900/50 text-red-300'
                                : 'bg-emerald-900/50 text-emerald-300'
                            }`}
                          >
                            {h.status}
                          </span>
                        </div>
                        <div className="text-slate-500 mt-1 truncate">{h.link}</div>
                        <div className="text-slate-600 mt-1 flex items-center gap-2">
                          <span>{h.aiSource || '—'}</span>
                          <span>·</span>
                          <span>{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                        </div>
                        {h.specPreview && <p className="text-slate-400 mt-2 line-clamp-3 whitespace-pre-wrap">{h.specPreview}</p>}
                        {h.errorMessage && <p className="text-red-400 mt-2">{h.errorMessage}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : !selected ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
                Dán link ở bên trái để bắt đầu
              </div>
            ) : selected.status === 'error' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2">
                <div className="text-4xl">⚠️</div>
                <h3 className="text-lg font-semibold">Có lỗi xảy ra</h3>
                <p className="text-slate-400 text-sm">{selected.error || 'Đã có lỗi không xác định.'}</p>
              </div>
            ) : selected.status === 'pending' || selected.status === 'processing' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="h-10 w-10 rounded-full border-4 border-slate-700 border-t-sky-500 animate-spin" />
                <p className="text-slate-400 text-sm">
                  {selected.spec ? 'Đang tạo mã ứng dụng từ spec...' : 'Đang phân tích nội dung...'}
                </p>
              </div>
            ) : selected.status === 'saved-only' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-2">
                <div className="text-4xl">📺</div>
                <h3 className="text-lg font-semibold">Đã lưu link kênh YouTube</h3>
                <p className="text-slate-400 text-sm">Kênh YouTube không được tóm tắt bằng AI — link đã được lưu vào lịch sử.</p>
              </div>
            ) : activeTab === 'render' ? (
              <iframe
                key={iframeKey}
                srcDoc={selected.code}
                title="rendered-app"
                sandbox="allow-scripts"
                className="absolute inset-0 w-full h-full bg-white"
              />
            ) : activeTab === 'code' ? (
              <div className="absolute inset-0 flex flex-col">
                <textarea
                  value={selected.code}
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
                {selected.spec}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
