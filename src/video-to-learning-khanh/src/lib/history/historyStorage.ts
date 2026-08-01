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

export async function clearHistory(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
