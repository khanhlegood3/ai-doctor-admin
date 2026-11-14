// src/dino-pal-khanh/src/lib/dinoProgressR2Client.ts
// Gọi /api/groq-proxy (provider: 'dino-pal-save-progress' /
// 'dino-pal-load-progress') để sao lưu/khôi phục tiến trình Dino Pal lên
// Cloudflare R2 (bucket S3-compatible dùng chung, xem api/_lib/r2Storage.js)
// — bản sao lưu BỀN, không mất khi user xoá site data/IndexedDB, khác với
// dinoSharedProgress.ts (IndexedDB, chỉ tồn tại trên trình duyệt hiện tại).
// Lỗi ở đây KHÔNG được chặn UX chính vì IndexedDB đã lưu xong trước đó
// (đúng pattern historyR2Client.ts của Bring Any Idea to Life).
//
// Use the same immutable user UID, including when opened standalone.
// @ts-ignore — shared JS module
import { initializeIdentity } from '../../../../public/device-identity.js';
import type { DinoSharedProgress } from "./dinoSharedProgress";

export async function getDinoPalDeviceId(): Promise<string> {
  return (await initializeIdentity()).uuid;
}

export async function saveDinoProgressToR2(progress: DinoSharedProgress): Promise<boolean> {
  try {
    const res = await fetch("/api/groq-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "dino-pal-save-progress",
        deviceId: await getDinoPalDeviceId(),
        progress,
      }),
    });
    if (!res.ok) {
      console.warn("[dino-pal] saveDinoProgressToR2 failed with status", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[dino-pal] saveDinoProgressToR2 failed:", err);
    return false;
  }
}

export async function loadDinoProgressFromR2(): Promise<DinoSharedProgress | null> {
  try {
    const res = await fetch("/api/groq-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "dino-pal-load-progress", deviceId: await getDinoPalDeviceId() }),
    });
    if (!res.ok) {
      console.warn("[dino-pal] loadDinoProgressFromR2 failed with status", res.status);
      return null;
    }
    const data = await res.json();
    return (data?.progress as DinoSharedProgress) || null;
  } catch (err) {
    console.warn("[dino-pal] loadDinoProgressFromR2 failed:", err);
    return null;
  }
}
