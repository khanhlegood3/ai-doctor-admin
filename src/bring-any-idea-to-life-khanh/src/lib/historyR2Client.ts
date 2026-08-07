// src/bring-any-idea-to-life-khanh/src/lib/historyR2Client.ts
// Gọi /api/groq-proxy (provider: 'bring-any-idea-to-life-save-r2') để sao
// lưu 1 creation lên Cloudflare R2 (bucket S3-compatible dùng chung, xem
// api/_lib/r2Storage.js) — song song với historyStorage.ts (IndexedDB cục
// bộ). Lỗi ở đây KHÔNG được chặn UX chính vì IndexedDB đã lưu xong trước đó.

export interface SaveCreationToR2Payload {
  id: string;
  name: string;
  html: string;
  imageBase64?: string; // kèm hoặc không kèm tiền tố data:...;base64,
  mimeType?: string;
  timestamp: string; // ISO string
}

export interface SaveCreationToR2Result {
  jsonUrl: string;
  imageUrl: string | null;
}

export async function saveCreationToR2(payload: SaveCreationToR2Payload): Promise<SaveCreationToR2Result | null> {
  try {
    const res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'bring-any-idea-to-life-save-r2', ...payload }),
    });
    if (!res.ok) {
      console.warn('[bring-any-idea-to-life] saveCreationToR2 failed with status', res.status);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn('[bring-any-idea-to-life] saveCreationToR2 failed:', err);
    return null;
  }
}
