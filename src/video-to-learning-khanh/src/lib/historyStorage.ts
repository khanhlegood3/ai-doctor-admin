// src/video-to-learning-khanh/src/lib/historyStorage.ts
// Lưu lịch sử "Video to Learning" CỤC BỘ trên trình duyệt bằng IndexedDB —
// cùng pattern raw IndexedDB đã dùng cho Wiki Med Vision / Heirloom Recipes
// (xem src/lib/heirloomRecipesStorage.js), không thêm dependency mới (idb).
//
// Đây là bản sao "nhanh, luôn có sẵn ngay cả khi mất mạng/MongoDB lỗi" của
// lịch sử — bản ĐẦY ĐỦ/xem chéo thiết bị + admin xem được nằm ở MongoDB qua
// /api/groq-proxy (provider: 'video-to-learning-history', xem
// api/_lib/videoToLearningHistory.js). Component gọi CẢ HAI khi lưu 1 lượt
// (xem App.tsx).

import type { LinkType } from './linkClassifier';

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
