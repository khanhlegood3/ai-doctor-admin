// src/video-to-learning-khanh/src/lib/historyClient.ts
// Gọi /api/groq-proxy (provider: 'video-to-learning-history') để lưu/đọc
// lịch sử THEO SERVER (MongoDB) — xem api/_lib/videoToLearningHistory.js.
// Song song với historyStorage.ts (IndexedDB cục bộ): mỗi lượt dùng được
// lưu ở CẢ HAI nơi, MongoDB là bản "chính", IndexedDB chỉ để hiện nhanh/khi
// mất mạng.

import type { LinkType } from './linkClassifier';

export interface SaveHistoryPayload {
  uuid: string;
  userId?: string | null;
  name?: string | null;
  type: LinkType;
  link: string;
  title?: string | null;
  aiSource?: string | null;
  status: 'success' | 'error' | 'saved-only';
  errorMessage?: string | null;
  specPreview?: string | null;
}

export async function saveHistoryToServer(payload: SaveHistoryPayload): Promise<void> {
  try {
    await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'video-to-learning-history', action: 'save', ...payload }),
    });
  } catch (err) {
    // Lỗi lưu server KHÔNG được làm gián đoạn trải nghiệm chính (đã có
    // IndexedDB làm bản lưu cục bộ) — chỉ log để chẩn đoán.
    console.warn('[video-to-learning] saveHistoryToServer failed:', err);
  }
}

export async function fetchHistoryFromServer(uuid: string, limit = 100): Promise<any[]> {
  try {
    const res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'video-to-learning-history', action: 'list', uuid, limit }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    return data.items || [];
  } catch (err) {
    console.warn('[video-to-learning] fetchHistoryFromServer failed:', err);
    return [];
  }
}
