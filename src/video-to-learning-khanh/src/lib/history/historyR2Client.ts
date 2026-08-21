// src/video-to-learning-khanh/src/lib/history/historyR2Client.ts
// Gọi /api/groq-proxy (provider: 'video-to-learning-save-r2' /
// 'video-to-learning-load-r2') để sao lưu ĐẦY ĐỦ 1 creation (spec+code) lên
// Cloudflare R2 — song song với historyStorage.ts (IndexedDB cục bộ) và
// historyClient.ts (MongoDB, chỉ metadata + specPreview, xem ghi chú ở đó).
// Lỗi ở đây KHÔNG được chặn UX chính vì IndexedDB đã lưu xong trước đó.
// Cùng kiến trúc với src/bring-any-idea-to-life-khanh/src/lib/historyR2Client.ts,
// chỉ khác: scope theo uuid (Video to Learning đã có định danh người dùng ổn
// định, xem lib/identity.ts) thay vì lưu phẳng ẩn danh.

import type { LinkType } from '../linkClassifier';

export interface SaveCreationToR2Payload {
  uuid: string;
  id: string;
  type: LinkType;
  link: string;
  title?: string | null;
  spec: string;
  code: string;
  aiSource?: string | null;
  timestamp: string; // ISO string
}

export async function saveCreationToR2(payload: SaveCreationToR2Payload): Promise<void> {
  try {
    await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'video-to-learning-save-r2', ...payload }),
    });
  } catch (err) {
    console.warn('[video-to-learning] saveCreationToR2 failed:', err);
  }
}

export interface R2CreationRecord {
  id: string;
  uuid: string;
  type: LinkType;
  link: string | null;
  title: string | null;
  spec: string;
  code: string;
  aiSource: string | null;
  timestamp: string;
}

/**
 * Tải creation từ R2. Không truyền `uuid` (hoặc truyền `undefined`) sẽ tải
 * TOÀN BỘ hệ thống (mọi người dùng) — giống hệt nút "Load history from R2"
 * của Bring Any Idea to Life. Truyền `uuid` cụ thể nếu chỉ muốn xem lịch sử
 * của đúng 1 người dùng.
 */
export async function loadAllCreationsFromR2(uuid?: string): Promise<R2CreationRecord[]> {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(uuid ? { provider: 'video-to-learning-load-r2', uuid } : { provider: 'video-to-learning-load-r2', all: true }),
  });
  if (!res.ok) {
    const message = await res.text().catch(() => '');
    throw new Error(`Load history from R2 failed (HTTP ${res.status})${message ? `: ${message}` : ''}`);
  }
  const data = await res.json();
  return Array.isArray(data?.creations) ? data.creations : [];
}
