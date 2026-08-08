// src/dino-pal-khanh/src/lib/dinoSharedProgress.ts
// Lưu tiến trình nuôi Dino Pal (màu sắc, level/XP, giai đoạn lớn lên, tiền,
// đồ đã mua...) vào IndexedDB — CÙNG DATABASE với dino-jump-khanh (xem file
// giống hệt src/dino-jump-khanh/src/lib/dinoSharedProgress.ts). Vì cả hai
// đều là app con Vite multi-page build ra CÙNG origin (xem vite.config.js,
// nhúng qua iframe cùng-origin như bring-any-idea-to-life-khanh,
// video-to-learning-khanh, ...), IndexedDB không phân biệt theo path/iframe
// mà chỉ theo origin — nên đây chính là cơ chế ĐỒNG BỘ giữa Dino Pal và
// Dino Jump, không cần postMessage/backend round-trip: Dino Pal ghi 1 bản
// ghi duy nhất (id 'pet'), Dino Jump chỉ cần đọc lại là thấy đúng màu +
// level hiện tại của Dino.
//
// Đây là bản ĐỌC NHANH, LUÔN CÓ SẴN kể cả khi mất mạng (giống pattern
// historyStorage.ts của Bring Any Idea to Life). Bản sao lưu bền theo thời
// gian, không phụ thuộc trình duyệt/thiết bị hiện tại, nằm ở Cloudflare R2
// qua dinoProgressR2Client.ts (provider 'dino-pal-save-progress' /
// 'dino-pal-load-progress', xem api/_lib/dinoPalProgressR2.js) — App.tsx của
// Dino Pal gọi CẢ HAI khi lưu tiến trình.

const DB_NAME = "dino-pal-shared-db";
const DB_VERSION = 1;
const STORE = "progress";
const RECORD_ID = "pet"; // 1 bản ghi duy nhất — Dino Pal chỉ nuôi 1 con tại 1 thời điểm
const CHANNEL_NAME = "dino-pal-progress-sync";

export type PetStage = "BABY" | "ADOLESCENT" | "TEENAGER" | "ADULT";

export interface DinoSharedStats {
  hunger: number;
  energy: number;
  cleanliness: number;
  love: number;
}

export interface DinoSharedProgress {
  id: "pet";
  name: string;
  babyColor: string;
  babySecondaryColor: string;
  adultColor: string;
  adultSecondaryColor: string;
  stage: PetStage;
  currentLevel: number;
  experience: number;
  daysPassed: number;
  money: number;
  ownedAccessories: string[];
  equippedAccessory?: string;
  stats: DinoSharedStats;
  // Tính cách/thoại đầy đủ do AI sinh ra lúc "nhận nuôi" — chỉ Dino Pal dùng
  // (để khôi phục nguyên trạng con thú), Dino Jump bỏ qua field này (chỉ
  // cần color + level để đồng bộ màu/cấp độ).
  personality?: unknown;
  updatedAt: string; // ISO string
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** Ghi đè (put) toàn bộ tiến trình hiện tại + báo cho các tab/iframe khác (Dino Jump) cùng origin biết ngay lập tức. */
export async function saveDinoProgress(progress: Omit<DinoSharedProgress, "id" | "updatedAt">): Promise<DinoSharedProgress> {
  const record: DinoSharedProgress = { ...progress, id: RECORD_ID, updatedAt: new Date().toISOString() };
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const channel = getChannel();
  if (channel) {
    channel.postMessage({ type: "update", record });
    channel.close();
  }
  return record;
}

export async function loadDinoProgress(): Promise<DinoSharedProgress | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(RECORD_ID);
    req.onsuccess = () => resolve((req.result as DinoSharedProgress) || null);
    req.onerror = () => reject(req.error);
  });
}

/** Xoá tiến trình đã lưu (gọi khi thú "trưởng thành"/game over và người dùng bắt đầu nuôi con mới). */
export async function clearDinoProgress(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(RECORD_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const channel = getChannel();
  if (channel) {
    channel.postMessage({ type: "clear" });
    channel.close();
  }
}

/** Nghe cập nhật realtime từ tab/iframe khác cùng origin (vd Dino Pal cập nhật, Dino Jump đang mở nghe được ngay). Trả về hàm huỷ đăng ký. */
export function subscribeDinoProgress(onUpdate: (progress: DinoSharedProgress | null) => void): () => void {
  const channel = getChannel();
  if (!channel) return () => {};
  const handler = (event: MessageEvent) => {
    if (event.data?.type === "update") onUpdate(event.data.record as DinoSharedProgress);
    else if (event.data?.type === "clear") onUpdate(null);
  };
  channel.addEventListener("message", handler);
  return () => {
    channel.removeEventListener("message", handler);
    channel.close();
  };
}
