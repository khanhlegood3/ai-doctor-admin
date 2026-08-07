// src/bring-any-idea-to-life-khanh/src/lib/historyStorage.ts
// Lưu lịch sử "Bring Any Idea to Life" CỤC BỘ trên trình duyệt bằng
// IndexedDB — thay cho localStorage (key 'gemini_app_history') trước đây
// trong App.tsx, vốn chỉ có quota ~5MB và dễ đầy vì mỗi creation kèm 1 ảnh
// gốc base64 (xem cảnh báo "Local storage full or error saving history" đã
// bỏ). IndexedDB không giới hạn cứng ~5MB, chạy async (không block UI khi
// list dài), và lưu được nhiều creation hơn hẳn.
//
// Đây là bản ĐỌC NHANH, LUÔN CÓ SẴN kể cả khi mất mạng. Bản sao lưu bền theo
// thời gian (không phụ thuộc trình duyệt/thiết bị hiện tại) nằm ở Cloudflare
// R2 qua historyR2Client.ts (provider 'bring-any-idea-to-life-save-r2', xem
// api/_lib/bringAnyIdeaToLifeHistoryR2.js) — App.tsx gọi CẢ HAI khi lưu 1
// creation mới, theo đúng pattern đã dùng cho Video to Learning (xem
// src/video-to-learning-khanh/src/lib/history/historyStorage.ts).

const DB_NAME = 'bring-any-idea-to-life-history-db';
const DB_VERSION = 1;
const STORE = 'creations';

export interface StoredCreation {
  id: string;
  name: string;
  html: string;
  originalImage?: string; // Base64 data URL — giữ cục bộ để hiện lại tức thì, không cần chờ R2
  videoUrl?: string; // Link YouTube/Facebook gốc, nếu creation đến từ link video (không upload file)
  timestamp: string; // ISO string (IndexedDB struct clone được Date, nhưng dùng string cho nhất quán khi merge với dữ liệu cũ từ localStorage)
  r2JsonUrl?: string | null; // URL public của bản JSON đầy đủ trên R2 (điền sau khi saveCreationToR2 thành công)
  r2ImageUrl?: string | null; // URL public của ảnh gốc trên R2
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
        const s = db.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Thêm hoặc ghi đè 1 creation (dùng put — id do client sinh sẵn bằng crypto.randomUUID()). */
export async function putCreation(creation: StoredCreation): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(creation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Vá thêm field (vd r2JsonUrl/r2ImageUrl) sau khi saveCreationToR2 trả về, không cần đọc lại nguyên bản ghi trước. */
export async function patchCreation(id: string, patch: Partial<StoredCreation>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result as StoredCreation | undefined;
      if (existing) store.put({ ...existing, ...patch });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Lấy toàn bộ lịch sử, mới nhất trước. */
export async function getAllCreations(): Promise<StoredCreation[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows = (req.result as StoredCreation[]) || [];
      rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCreation(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
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

// --- Di trú 1 lần từ localStorage ('gemini_app_history') sang IndexedDB ---
// Chạy 1 lần khi user cũ (đã có lịch sử lưu theo cơ chế cũ) mở lại app sau
// bản cập nhật này, để không mất lịch sử đã tạo trước đó. An toàn để gọi
// nhiều lần — tự xoá key localStorage sau khi di trú xong nên lần sau là no-op.
export async function migrateFromLocalStorageOnce(): Promise<void> {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const saved = window.localStorage.getItem('gemini_app_history');
  if (!saved) return;
  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item?.id || !item?.html) continue;
        await putCreation({
          id: item.id,
          name: item.name || 'New Creation',
          html: item.html,
          originalImage: item.originalImage,
          timestamp: new Date(item.timestamp || Date.now()).toISOString(),
        });
      }
    }
  } catch (e) {
    console.error('[bring-any-idea-to-life] migrate from localStorage failed:', e);
  } finally {
    window.localStorage.removeItem('gemini_app_history');
  }
}
