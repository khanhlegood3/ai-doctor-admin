// Chuyển thể từ dự án AI Studio "video-to-learning-app" (Aaron Wade) vào
// ai-doctor-admin — bản CẬP NHẬT hỗ trợ dán NHIỀU link cùng lúc (video
// YouTube thường, YouTube Shorts, kênh YouTube, hoặc trang web bất kỳ) thay
// vì chỉ 1 video YouTube như bản gốc.
//
// Mỗi link được phân loại bằng classifyLinkList() (xem lib/linkClassifier.ts)
// rồi xử lý TUẦN TỰ (không song song — tránh dồn dập gọi Groq/Gemini cùng
// lúc, dễ dính rate limit):
//   - youtube_video / youtube_short / facebook_video -> sinh spec từ video rồi
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
import { generateImageToCode, readImageFileAsBase64 } from './lib/imageToCode';
import { parseHTML, parseJSON } from './lib/parse';
import {
  CODE_REGION_CLOSER,
  SPEC_ADDENDUM,
  SPEC_FROM_VIDEO_PROMPT,
} from './lib/prompts';
import { getFacebookEmbedUrl, getYoutubeEmbedUrl, getYouTubeVideoId, validateYoutubeUrl } from './lib/youtube';
import { classifyLinkList, LINK_TYPE_LABELS, type ClassifiedLink, type LinkType } from './lib/linkClassifier';
import { addHistoryEntry, getHistoryEntries, type HistoryEntry } from './lib/history/historyStorage';
import { saveHistoryToServer, fetchHistoryFromServer } from './lib/history/historyClient';
import { saveCreationToR2, loadAllCreationsFromR2, type R2CreationRecord } from './lib/history/historyR2Client';
import { getIdentity, getOrCreateGuestUuid } from './lib/identity';
import exampleHistoryData from './lib/history/examples.json';
import { UploadedVideoPreview } from './components/UploadedVideoPreview';

type ItemStatus = 'pending' | 'processing' | 'done' | 'error' | 'saved-only';
type TabKey = 'render' | 'code' | 'spec' | 'history';

interface QueueItem extends ClassifiedLink {
  status: ItemStatus;
  spec?: string;
  code?: string;
  error?: string | null;
  aiSource?: string | null;
  pageTitle?: string | null;
  // Chỉ dùng cho type 'image' (tính năng "Ảnh → Sketch tương tác", chuyển
  // thể từ image-to-code.zip) — data URL để hiện preview ảnh đã upload,
  // và base64/mimeType thuần để gửi lên proxy (xem lib/imageToCode.ts).
  imagePreviewUrl?: string;
  imageBase64?: string;
  imageMimeType?: string;
  // Chỉ dùng cho type 'uploaded_video' (tính năng "Tải video lên" — video
  // file thật, không phải link) — xem lib/uploadedVideo.ts.
  videoTranscript?: string;
  videoMimeType?: string;
}

type ExampleVideo = {
  title: string;
  url: string;
  spec?: string;
  code?: string;
};

// Mock data có sẵn từ lịch sử mẫu để mở app thật nhanh: click ví dụ sẽ nạp
// ngay spec/code đã generate sẵn, không gọi AI. Người dùng vẫn sửa HTML ở tab
// "Mã HTML" rồi bấm "Cập nhật xem trước" như bình thường.
const EXAMPLE_VIDEOS: ExampleVideo[] = (exampleHistoryData as ExampleVideo[]).map((example, index) => ({
  ...example,
  title: example.title || `Ví dụ ${index + 1}`,
}));

function getYoutubeThumbnailUrl(url: string): string {
  // Dùng lại getYouTubeVideoId() đã sửa (hỗ trợ cả /shorts/, /embed/, /live/)
  // thay vì regex cũ riêng ở đây — tránh lặp lại đúng bug đã gặp (link
  // Shorts không trích được ID) cho phần thumbnail Ví dụ.
  const videoId = getYouTubeVideoId(url);
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
  // Lỗi tải lịch sử (R2 và/hoặc luồng chung) — TRƯỚC ĐÂY bị nuốt im lặng
  // (chỉ console.warn), khiến "Chưa có lịch sử nào" hiện ra y hệt cả khi
  // thật sự trống LẪN khi tải thất bại (thiếu env R2 trên server, lỗi
  // mạng, CORS, HTTP 500...) — không cách nào phân biệt được từ UI. Giờ
  // hiện rõ lý do thật ra màn hình để tự chẩn đoán được, không cần đoán mò.
  const [historyError, setHistoryError] = useState<string | null>(null);

  const identity = getIdentity();
  // uuid dùng để LƯU lên R2: identity.uuid thật (nếu đã đăng nhập) hoặc uuid
  // ẩn danh riêng cho trình duyệt này (nếu đang duyệt dưới dạng Guest) — xem
  // getOrCreateGuestUuid() trong lib/identity.ts. Việc TẢI R2 (loadHistory
  // bên dưới) thì luôn lấy TOÀN HỆ THỐNG, không cần biết r2Uuid này.
  const r2Uuid = identity.uuid || getOrCreateGuestUuid();
  const selected = selectedIndex !== null ? items[selectedIndex] : null;

  // --- Lịch sử: nạp từ IndexedDB ngay (nhanh), rồi đối chiếu/merge từ
  // server (bản "chính", đầy đủ hơn nếu người dùng đổi máy).
  // Local (IndexedDB) LUÔN là nguồn ƯU TIÊN cho nút Reload vì có
  // fullSpec/fullCode. MongoDB (remote) chỉ có specPreview (không Reload
  // được đầy đủ). R2 (r2Creations) có ĐẦY ĐỦ spec+code như local — dùng để
  // bổ sung các lượt đã tạo từ máy/trình duyệt KHÁC (không có ở IndexedDB
  // máy này) MÀ VẪN Reload được đầy đủ, thay vì chỉ nạp lại link như trước
  // khi có R2 (xem lib/history/historyR2Client.ts + videoToLearningHistoryR2.js).
  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    let r2Failed = false;
    let r2FailReason = '';
    try {
      const local = await getHistoryEntries(identity.uuid).catch(() => [] as HistoryEntry[]);
      const localKeys = new Set(local.map((e) => `${e.link}|${e.createdAt}`));

      // R2 (TOÀN HỆ THỐNG) luôn tải được — KHÔNG phụ thuộc identity.uuid, kể
      // cả khi đang duyệt dưới dạng Guest (chưa đăng nhập). Đây chính là bug
      // trước đó: khối này từng nằm trong `if (identity.uuid)`, nên Guest
      // luôn thấy "Chưa có lịch sử nào" dù R2 có dữ liệu.
      // Lỗi ở bước này (thiếu env R2 trên server, mạng lỗi, HTTP 500...)
      // TRƯỚC ĐÂY bị nuốt hoàn toàn (chỉ console.warn) — khiến UI hiện
      // "Chưa có lịch sử nào" y hệt trường hợp thật sự trống, không cách
      // nào tự chẩn đoán được nguyên nhân thật. Giờ lưu lại lý do để hiện
      // rõ ra UI bên dưới.
      const r2Creations = await loadAllCreationsFromR2().catch((err) => {
        console.warn('[video-to-learning] loadAllCreationsFromR2 failed:', err);
        r2Failed = true;
        r2FailReason = err?.message || String(err);
        return [] as R2CreationRecord[];
      });
      const r2AsHistory = r2Creations.map((c) => ({
        ownerUuid: c.uuid, // giữ đúng chủ sở hữu thật của từng creation (không phải người đang xem)
        type: c.type,
        link: c.link || '',
        title: c.title ?? null,
        aiSource: c.aiSource ?? null,
        status: 'success' as const,
        errorMessage: null,
        specPreview: (c.spec || '').slice(0, 500),
        mimeType: c.mimeType ?? null,
        fullSpec: c.spec,
        fullCode: c.code,
        createdAt: c.timestamp,
      }));
      const r2Keys = new Set(r2AsHistory.map((e) => `${e.link}|${e.createdAt}`));
      const r2Only = r2AsHistory.filter((e) => !localKeys.has(`${e.link}|${e.createdAt}`));

      let merged: any[] = local;
      if (identity.uuid) {
        // MongoDB (metadata riêng của người dùng ĐÃ ĐĂNG NHẬP) — Guest không
        // có bản ghi ở đây nên bỏ qua, R2 ở trên đã đủ để hiển thị lịch sử.
        const remote = await fetchHistoryFromServer(identity.uuid);
        const remoteOnly = remote.filter((r: any) => !localKeys.has(`${r.link}|${r.createdAt}`) && !r2Keys.has(`${r.link}|${r.createdAt}`));
        merged = [...local, ...remoteOnly, ...r2Only].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      } else {
        merged = [...local, ...r2Only].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      }
      setHistoryEntries(merged);
      // Chỉ hiện cảnh báo khi R2 lỗi THẬT SỰ ảnh hưởng tới kết quả hiển thị
      // (danh sách cuối cùng trống) — R2 lỗi nhưng vẫn còn dữ liệu từ
      // IndexedDB/MongoDB thì không cần làm phiền người dùng.
      if (r2Failed && merged.length === 0) {
        setHistoryError(`Không tải được lịch sử từ R2 (${r2FailReason || 'lỗi không xác định'}). Danh sách bên dưới có thể chưa đầy đủ — kiểm tra cấu hình R2 trên server hoặc thử lại.`);
      }
    } catch (err: any) {
      // Bắt luôn lỗi ngoài dự kiến (vd fetchHistoryFromServer/sắp xếp ném
      // lỗi) — TRƯỚC ĐÂY không có catch ở tầng này, nên 1 lỗi bất kỳ sẽ làm
      // setHistoryEntries() không bao giờ chạy, historyEntries giữ nguyên
      // mảng rỗng ban đầu -> UI hiện "Chưa có lịch sử nào" mãi mãi, kể cả
      // khi IndexedDB/R2 thật ra có dữ liệu.
      console.error('[video-to-learning] loadHistory failed:', err);
      setHistoryError(`Tải lịch sử thất bại: ${err?.message || String(err)}`);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const firstMock = EXAMPLE_VIDEOS.find((example) => example.code || example.spec);
    if (firstMock) loadMockExample(firstMock);
    // Chỉ nạp mock ban đầu 1 lần khi mount để không ghi đè thao tác của user.
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
    // MIME của video gốc khi type = 'uploaded_video' — xem HistoryEntry.
    mimeType?: string | null;
    // CHỈ dùng để lưu IndexedDB (nút Reload) — KHÔNG gửi lên server, xem
    // chú thích ở HistoryEntry trong lib/history/historyStorage.ts.
    fullSpec?: string | null;
    fullCode?: string | null;
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
        mimeType: entry.mimeType ?? null,
        fullSpec: entry.fullSpec ?? null,
        fullCode: entry.fullCode ?? null,
      });
    } catch (err) {
      console.warn('[video-to-learning] addHistoryEntry (IndexedDB) failed:', err);
    }
    // ...rồi bắn lên server (không chặn UI nếu lỗi, xem historyClient.ts).
    // CỐ Ý không gửi fullSpec/fullCode lên MongoDB — giữ document Mongo gọn,
    // đủ dùng cho Admin xem/thống kê.
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
    // ...và sao lưu ĐẦY ĐỦ (spec+code) lên R2 — CHỈ khi thực sự có code (bỏ
    // qua 'error'/'saved-only', giống hệt cách Bring Any Idea to Life chỉ
    // gọi saveCreationToR2 sau khi đã có html) — cho phép Reload đầy đủ dù
    // đổi máy/xoá cache, khác Mongo ở trên (chỉ specPreview). Fire-and-forget,
    // không chặn UI nếu lỗi (xem historyR2Client.ts).
    // Dùng r2Uuid (identity thật HOẶC uuid ẩn danh riêng cho Guest) — trước
    // đây chỉ dùng identity.uuid nên Guest (không đăng nhập) KHÔNG BAO GIỜ
    // được sao lưu, khiến bucket luôn trống và nút "Load history from R2"
    // luôn hiện "Chưa có lịch sử nào".
    if (entry.fullCode) {
      saveCreationToR2({
        uuid: r2Uuid,
        id: crypto.randomUUID(),
        type: entry.type,
        link: entry.link,
        title: entry.title ?? null,
        spec: entry.fullSpec ?? '',
        code: entry.fullCode,
        aiSource: entry.aiSource ?? null,
        mimeType: entry.mimeType ?? undefined,
        timestamp: new Date().toISOString(),
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

    // "Ảnh → Sketch tương tác" (chuyển thể từ image-to-code.zip): 1 lệnh gọi
    // AI duy nhất (không có bước spec riêng rồi code riêng như video/web) —
    // xem api/_lib/imageToCodeProxy.js. `spec` ở đây là phần ghi chú suy
    // luận (hành vi/thuật toán/bố cục) model viết TRƯỚC khi sinh code, dùng
    // luôn cho tab "Spec" để nhất quán UI với các loại item khác.
    if (item.type === 'image') {
      try {
        const result = await generateImageToCode({
          imageBase64: item.imageBase64 || '',
          mimeType: item.imageMimeType || 'image/jpeg',
        });
        updateItem(index, { status: 'done', spec: result.spec, code: result.code, aiSource: result.source ?? null });
        setIframeKey((k) => k + 1);

        await persistHistory({
          type: item.type,
          link: item.url,
          title: item.pageTitle ?? null,
          aiSource: result.source ?? null,
          status: 'success',
          specPreview: (result.spec || '').slice(0, 500),
          fullSpec: result.spec,
          fullCode: result.code,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Đã có lỗi không xác định xảy ra.';
        updateItem(index, { status: 'error', error: message });
        await persistHistory({ type: item.type, link: item.url, status: 'error', errorMessage: message });
      }
      return;
    }

    // "Tải video lên" — transcript đã có sẵn (Whisper client-side, xem
    // lib/uploadedVideo.ts), nên chỉ cần bước sinh spec+code y hệt nhánh
    // video/website bên dưới, chỉ khác truyền `videoTranscript` thay vì
    // `videoUrl` (server dùng thẳng transcript này, xem
    // runVideoToLearningGenerate() trong videoToLearningProxy.js).
    if (item.type === 'uploaded_video') {
      try {
        const specResponse = await generateTextWithMeta({ prompt: SPEC_FROM_VIDEO_PROMPT, videoTranscript: item.videoTranscript });
        const generatedSpec = parseJSON(specResponse.text).spec + SPEC_ADDENDUM;
        updateItem(index, { spec: generatedSpec, aiSource: specResponse.source });

        const codeResponse = await generateTextWithMeta({ prompt: generatedSpec });
        const generatedCode = parseHTML(codeResponse.text, CODE_REGION_CLOSER);

        updateItem(index, { status: 'done', code: generatedCode });
        setIframeKey((k) => k + 1);

        await persistHistory({
          type: item.type,
          link: item.url,
          title: item.pageTitle ?? null,
          aiSource: specResponse.source ?? null,
          status: 'success',
          specPreview: generatedSpec.slice(0, 500),
          mimeType: item.videoMimeType ?? null,
          fullSpec: generatedSpec,
          fullCode: generatedCode,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Đã có lỗi không xác định xảy ra.';
        updateItem(index, { status: 'error', error: message });
        await persistHistory({ type: item.type, link: item.url, status: 'error', errorMessage: message, mimeType: item.videoMimeType ?? null });
      }
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
        fullSpec: generatedSpec,
        fullCode: generatedCode,
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

  // Upload 1 ảnh -> tạo 1 QueueItem type 'image' rồi chạy ngay qua hàng đợi
  // (giống hệt luồng dán link, chỉ khác input là file thay vì URL) — xem
  // xử lý ở nhánh `item.type === 'image'` trong processItem() bên trên.
  const handleImageFile = async (file: File) => {
    if (isBusy) return;
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn 1 file ảnh (JPG, PNG, WebP...).');
      return;
    }
    try {
      const { base64, mimeType, dataUrl } = await readImageFileAsBase64(file);
      const item: QueueItem = {
        raw: file.name,
        url: file.name,
        type: 'image',
        status: 'pending',
        pageTitle: file.name,
        imagePreviewUrl: dataUrl,
        imageBase64: base64,
        imageMimeType: mimeType,
      };
      setItems([item]);
      setSelectedIndex(0);
      setActiveTab('render');
      await runQueue([item]);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Không đọc được file ảnh.');
    }
  };

  const handleImageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng file cũ ở lần sau
    if (file) handleImageFile(file);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageFile(file);
  };

  // Trạng thái tiến độ cho "Tải video lên" — hiển thị RIÊNG (không dùng
  // ItemStatus/STATUS_LABEL chung của hàng đợi) vì quá trình này có nhiều
  // bước con (tách audio -> Whisper -> upload R2) diễn ra TRƯỚC khi item
  // thật sự vào hàng đợi xử lý AI.
  const [videoUploadStage, setVideoUploadStage] = useState<string | null>(null);

  // Upload 1 file video -> trích transcript (Whisper) + upload video gốc
  // lên R2 (lib/uploadedVideo.ts) -> tạo 1 QueueItem type 'uploaded_video'
  // rồi chạy qua hàng đợi như các loại khác (xem nhánh
  // `item.type === 'uploaded_video'` trong processItem() bên trên).
  const handleVideoFile = async (file: File) => {
    if (isBusy || videoUploadStage) return;
    if (!file.type.startsWith('video/')) {
      alert('Vui lòng chọn 1 file video (MP4, MOV, WebM...).');
      return;
    }
    const id = crypto.randomUUID();
    try {
      const { processUploadedVideo } = await import('./lib/uploadedVideo');
      const result = await processUploadedVideo(id, file, (p) => {
        if (p.stage === 'extracting-audio') {
          setVideoUploadStage(`Đang tách âm thanh... ${Math.round((p.ratio ?? 0) * 100)}%`);
        } else if (p.stage === 'transcribing') {
          setVideoUploadStage('Đang nhận diện lời nói (Whisper)...');
        } else if (p.stage === 'uploading-video') {
          setVideoUploadStage('Đang tải video lên...');
        }
      });
      setVideoUploadStage(null);

      const item: QueueItem = {
        raw: file.name,
        url: result.publicUrl,
        type: 'uploaded_video',
        status: 'pending',
        pageTitle: file.name,
        videoTranscript: result.transcript,
        videoMimeType: result.mimeType,
      };
      setItems([item]);
      setSelectedIndex(0);
      setActiveTab('render');
      await runQueue([item]);
    } catch (err) {
      setVideoUploadStage(null);
      alert(err instanceof Error ? err.message : 'Không xử lý được video đã tải lên.');
    }
  };

  const handleVideoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) handleVideoFile(file);
  };

  const handleVideoDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleVideoFile(file);
  };

  const buildMockExampleItem = (example: ExampleVideo): QueueItem => ({
    raw: example.url,
    url: example.url,
    type: 'youtube_video',
    status: example.code || example.spec ? 'done' : 'pending',
    spec: example.spec,
    code: example.code,
    aiSource: 'mock-examples.json',
    pageTitle: example.title || null,
  });

  const loadMockExample = (example: ExampleVideo) => {
    const queue: QueueItem[] = [buildMockExampleItem(example)];
    setItems(queue);
    setSelectedIndex(0);
    setActiveTab('render');
    setIframeKey((k) => k + 1);
    if (textareaRef.current) textareaRef.current.value = example.url;
    return queue;
  };

  const handleExampleClick = async (example: ExampleVideo) => {
    if (isBusy) return;
    const queue = loadMockExample(example);

    // Fallback an toàn nếu sau này có ví dụ chỉ có URL mà chưa có spec/code
    // trong examples.json: khi đó mới gọi AI như luồng cũ.
    if (!example.code && !example.spec) {
      await runQueue(queue);
    }
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

  // Nút "Reload" trong tab Lịch sử: nạp lại NGUYÊN VẸN link input + spec/code
  // output đã lưu CỤC BỘ (IndexedDB, có fullSpec/fullCode) — KHÔNG gọi
  // server/AI. Nếu dòng lịch sử này chỉ đến từ server (máy/trình duyệt
  // khác, không có fullSpec/fullCode ở IndexedDB máy này) thì chỉ nạp lại
  // link vào ô nhập, không có output đầy đủ để hiện lại.
  // Muốn gọi lại AI thật sự: dán link vào ô nhập rồi bấm nút "Tạo ứng dụng
  // học tập" bên dưới như bình thường (nút đó luôn gọi server).
  const handleReloadFromHistory = (entry: any) => {
    if (textareaRef.current) textareaRef.current.value = entry.link;

    const hasFullOutput = Boolean(entry.fullSpec || entry.fullCode);
    const reloadedItem: QueueItem = {
      raw: entry.link,
      url: entry.link,
      type: (entry.type as LinkType) || 'website',
      status: entry.status === 'error' ? 'error' : entry.status === 'saved-only' ? 'saved-only' : hasFullOutput ? 'done' : 'error',
      spec: entry.fullSpec || undefined,
      code: entry.fullCode || undefined,
      error:
        entry.status === 'error'
          ? entry.errorMessage || 'Đã có lỗi không xác định.'
          : !hasFullOutput && entry.status !== 'saved-only'
            ? 'Lượt này chỉ đồng bộ từ máy/trình duyệt khác, chưa có bản đầy đủ lưu ở máy này nên không Reload lại output được — chỉ nạp lại link vào ô nhập. Muốn xem lại nội dung, bấm "Tạo ứng dụng học tập" để gọi lại AI.'
            : null,
      aiSource: entry.aiSource ?? null,
      pageTitle: entry.title ?? null,
      videoMimeType: entry.mimeType ?? undefined,
    };

    setItems((prev) => [reloadedItem, ...prev]);
    setSelectedIndex(0);
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
              🎬 Video/Web/Ảnh → Ứng dụng học tập
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Dán 1 hoặc nhiều link (video YouTube, Shorts, kênh YouTube, video/reel Facebook, hoặc trang web bất kỳ) — mỗi dòng 1 link,
              hoặc upload 1 ảnh bên dưới. AI sẽ tạo mini-app/sketch tương tác cho từng link hoặc ảnh.
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
              placeholder={'https://www.youtube.com/watch?v=...\nhttps://www.youtube.com/shorts/...\nhttps://www.youtube.com/@mot-kenh\nhttps://www.facebook.com/watch/?v=...\nhttps://vi.wikipedia.org/wiki/...'}
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

          {/* "Ảnh → Sketch tương tác" (chuyển thể từ image-to-code.zip): thay
              vì dán link, người dùng kéo-thả hoặc chọn 1 ảnh — AI viết 1
              sketch p5.js sáng tạo lấy cảm hứng từ hành vi/đặc điểm của vật
              thể trong ảnh (xem lib/imageToCode.ts). */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-xs text-slate-500">hoặc</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <label
            htmlFor="image-upload"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleImageDrop}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
              isBusy
                ? 'border-slate-800 opacity-50 cursor-not-allowed'
                : 'border-slate-700 hover:border-sky-500 cursor-pointer'
            }`}
          >
            <span className="text-2xl">🖼️</span>
            <span className="text-sm text-slate-300">Kéo-thả ảnh vào đây, hoặc bấm để chọn ảnh</span>
            <span className="text-xs text-slate-500">AI sẽ viết 1 sketch p5.js tương tác lấy cảm hứng từ ảnh</span>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              disabled={isBusy}
              onChange={handleImageInputChange}
              className="hidden"
            />
          </label>

          {/* "Tải video lên" — thay vì dán link YouTube/Facebook, người dùng
              kéo-thả hoặc chọn 1 file video từ máy. AI lấy nội dung qua
              transcript tự nhận diện bằng Groq Whisper (audio tách bằng
              ffmpeg.wasm ngay trong trình duyệt) thay vì phụ đề có sẵn của
              YouTube/Facebook — xem lib/uploadedVideo.ts. */}
          <label
            htmlFor="video-upload"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleVideoDrop}
            className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
              isBusy || videoUploadStage
                ? 'border-slate-800 opacity-50 cursor-not-allowed'
                : 'border-slate-700 hover:border-sky-500 cursor-pointer'
            }`}
          >
            <span className="text-2xl">📹</span>
            <span className="text-sm text-slate-300">
              {videoUploadStage || 'Kéo-thả video vào đây, hoặc bấm để chọn video'}
            </span>
            {!videoUploadStage && (
              <span className="text-xs text-slate-500">Không cần link YouTube/Facebook — dùng file video từ máy (MP4, MOV...)</span>
            )}
            <input
              id="video-upload"
              type="file"
              accept="video/*"
              disabled={isBusy || Boolean(videoUploadStage)}
              onChange={handleVideoInputChange}
              className="hidden"
            />
          </label>

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

          {selected && (selected.type === 'youtube_video' || selected.type === 'youtube_short' || selected.type === 'facebook_video') && (
            <div className="relative w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800" style={{ paddingTop: '56.25%' }}>
              <iframe
                className="absolute inset-0 w-full h-full"
                src={selected.type === 'facebook_video' ? getFacebookEmbedUrl(selected.url) : getYoutubeEmbedUrl(selected.url)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={selected.type === 'facebook_video' ? 'facebook-preview' : 'youtube-preview'}
              />
            </div>
          )}

          {selected && selected.type === 'image' && selected.imagePreviewUrl && (
            <div className="w-full rounded-lg overflow-hidden bg-slate-900 border border-slate-800 p-2">
              <img
                src={selected.imagePreviewUrl}
                alt={selected.url}
                className="w-full max-h-48 object-contain rounded"
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
            Link kênh YouTube chỉ được lưu lại (không gọi AI). Ảnh được AI "nhìn" trực tiếp để viết 1 sketch p5.js tương tác. Miễn phí hoàn toàn.
          </p>
        </div>

        {/* Right column: generated content + history */}
        <div className="flex flex-col min-h-[70vh] rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
          {selected?.type === 'uploaded_video' && (
            <UploadedVideoPreview videoUrl={selected.url} mimeType={selected.videoMimeType} />
          )}
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
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Lịch sử</h3>
                  <div className="h-px flex-1 bg-slate-800"></div>
                  {/* Nút tải thủ công từ R2 — giống hệt "Load history from R2" của
                      Bring Any Idea to Life: tải TOÀN BỘ lịch sử của MỌI người
                      dùng trong hệ thống (không chỉ của riêng máy/trình duyệt
                      này), xem loadAllVideoToLearningCreationsFromR2() trong
                      videoToLearningHistoryR2.js. loadHistory() ở đây ĐÃ TỰ
                      ĐỘNG gộp cả IndexedDB cục bộ + MongoDB (của riêng tôi) +
                      R2 (toàn hệ thống) mỗi khi mở tab này, nên nút này chủ
                      yếu để CHỦ ĐỘNG tải lại mà không cần đổi tab qua lại. */}
                  <button
                    type="button"
                    onClick={() => loadHistory()}
                    disabled={historyLoading}
                    title="Tải lại toàn bộ lịch sử từ R2 (của MỌI người dùng trong hệ thống, bản đầy đủ spec+code)"
                    className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-sky-300 transition-colors hover:border-sky-400 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {historyLoading ? 'Loading R2...' : 'Load history from R2'}
                  </button>
                </div>
                {historyError && (
                  <div className="mb-3 rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-xs text-red-300">
                    {historyError}
                  </div>
                )}
                {historyLoading ? (
                  <p className="text-slate-500 text-sm">Đang tải lịch sử...</p>
                ) : historyEntries.length === 0 ? (
                  <p className="text-slate-500 text-sm">
                    {historyError ? 'Không hiện được lịch sử do lỗi ở trên.' : 'Chưa có lịch sử nào.'}
                  </p>
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
                        <div className="mt-2">
                          <button
                            onClick={() => handleReloadFromHistory(h)}
                            disabled={isBusy}
                            title="Nạp lại link + kết quả đã lưu cục bộ trên máy này, không gọi lại server"
                            className="rounded-md bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-2.5 py-1 text-xs font-medium text-slate-200"
                          >
                            ↺ Reload
                          </button>
                          {!(h.fullSpec || h.fullCode) && h.status !== 'saved-only' && (
                            <span className="ml-2 text-[11px] text-slate-600">(chỉ nạp lại link — chưa có bản đầy đủ trên máy này)</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : !selected ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm px-6 text-center">
                Dán link hoặc upload ảnh ở bên trái để bắt đầu
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
