// src/video-to-learning-khanh/src/lib/history/historyStorage.ts
// Lưu lịch sử "Video to Learning" CỤC BỘ trên trình duyệt bằng IndexedDB —
// cùng pattern raw IndexedDB đã dùng cho Wiki Med Vision / Heirloom Recipes
// (xem src/lib/heirloomRecipesStorage.js), không thêm dependency mới (idb).
//
// Đây là bản sao "nhanh, luôn có sẵn ngay cả khi mất mạng/MongoDB lỗi" của
// lịch sử — bản ĐẦY ĐỦ/xem chéo thiết bị + admin xem được nằm ở MongoDB qua
// /api/groq-proxy (provider: 'video-to-learning-history', xem
// api/_lib/videoToLearningHistory.js). Component gọi CẢ HAI khi lưu 1 lượt
// (xem App.tsx).
//
// COPY CHO TÍNH NĂNG "-TO-LEARNING" TIẾP THEO: file này (cùng
// historyClient.ts, và backend api/_lib/videoToLearningHistory.js) là
// KHUÔN MẪU thẳng để nhân bản cho 1 tính năng dạng "X to Learning" mới
// (vd "podcast-to-learning-khanh") — CHƯA generic hoá sẵn (identity.ts thì
// có, xem src/lib/khanhIdentity.js) vì DB_NAME/COLLECTION/provider string
// bên dưới gắn chết với "video-to-learning". Khi nhân bản, chỉ cần đổi 4 chỗ:
//   1. DB_NAME bên dưới (mỗi tính năng 1 IndexedDB riêng)
//   2. provider: 'video-to-learning-history' trong historyClient.ts
//   3. COLLECTION trong videoToLearningHistory.js (bản sao)
//   4. type LinkType/HistoryEntry cho đúng loại link của tính năng đó

import type { LinkType } from '../linkClassifier';

const DB_NAME = 'video-to-learning-history-db';
const DB_VERSION = 1;
const STORE = 'entries';

export interface HistoryEntry {
  id?: number; // autoIncrement, do IndexedDB tự gán khi add()
  ownerUuid: string | null; // null = chưa xác định danh tính (khách chưa đăng nhập)
  type: LinkType;
  link: string;
  title?: string | null;
  aiSource?: string | null; // 'groq-transcript' | 'groq-page' | 'gemini-fallback' | null
  status: 'success' | 'error' | 'saved-only';
  errorMessage?: string | null;
  specPreview?: string | null;
  // MIME của video gốc khi type = 'uploaded_video' (link là URL R2 video tự
  // upload) — để biết cần kiểm tra khả năng phát trực tiếp/chuyển mã hay
  // không (xem lib/videoTranscode.ts).
  mimeType?: string | null;
  // URL R2 vĩnh viễn của bản MP4 đã chuyển mã từ video gốc (nếu người dùng
  // từng bấm "Chuyển đổi sang MP4" — xem components/UploadedVideoPreview.tsx).
  transcodedVideoUrl?: string | null;
  // id ỔN ĐỊNH dùng khi lưu creation này lên R2 (video-to-learning/creations/
  // <uuid>/<r2Id>.json) VÀ khi lưu file video gốc/đã chuyển mã (video-to-
  // learning/uploaded-videos/<r2Id>[-mp4].<ext>) — CHỈ có khi type =
  // 'uploaded_video'. Nhờ id ổn định này mà updateHistoryEntryByR2Id() bên
  // dưới + việc gọi lại saveCreationToR2 với CÙNG id (App.tsx) có thể "vá"
  // thêm transcodedVideoUrl vào 1 record đã lưu trước đó, thay vì phải tạo
  // record mới mỗi lần (loại 'website'/'youtube_video'/... không cần việc
  // này nên KHÔNG có field này).
  r2Id?: string | null;
  // Nội dung ĐẦY ĐỦ (không cắt ngắn) — CHỈ lưu ở đây (IndexedDB cục bộ),
  // KHÔNG gửi lên server/Mongo (server chỉ nhận specPreview đã cắt ngắn, xem
  // historyClient.ts) để giữ document Mongo gọn. Dùng cho nút "Reload" ở
  // App.tsx: nạp lại y hệt input/output cũ MÀ KHÔNG cần gọi lại AI.
  fullSpec?: string | null;
  fullCode?: string | null;
  createdAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('ownerUuid', 'ownerUuid', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<HistoryEntry> {
  const db = await openDB();
  const full: HistoryEntry = { ...entry, createdAt: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).add(full);
    req.onsuccess = () => resolve({ ...full, id: req.result as number });
    req.onerror = () => reject(req.error);
  });
}

export async function getHistoryEntries(ownerUuid: string | null): Promise<HistoryEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as HistoryEntry[]) || [];
      const filtered = ownerUuid ? rows.filter((r) => !r.ownerUuid || r.ownerUuid === ownerUuid) : rows;
      filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      resolve(filtered);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Tìm entry cục bộ theo `r2Id` (id ổn định dùng khi lưu creation lên R2 —
 * xem HistoryEntry.r2Id) và vá thêm `patch` vào (vd transcodedVideoUrl sau
 * khi chuyển mã xong) — dùng bởi UploadedVideoPreview.tsx qua App.tsx. Nếu
 * có NHIỀU entry cùng r2Id (không nên xảy ra, nhưng phòng hờ), vá TẤT CẢ.
 */
export async function updateHistoryEntryByR2Id(r2Id: string, patch: Partial<HistoryEntry>): Promise<void> {
  const db = await openDB();
  const all: HistoryEntry[] = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as HistoryEntry[]) || []);
    req.onerror = () => reject(req.error);
  });
  const matches = all.filter((r) => r.r2Id === r2Id);
  if (matches.length === 0) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    matches.forEach((row) => store.put({ ...row, ...patch }));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
