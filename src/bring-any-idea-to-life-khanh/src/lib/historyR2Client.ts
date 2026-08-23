// src/bring-any-idea-to-life-khanh/src/lib/historyR2Client.ts
// Gọi /api/groq-proxy (provider: 'bring-any-idea-to-life-save-r2') để sao
// lưu 1 creation lên Cloudflare R2 (bucket S3-compatible dùng chung, xem
// api/_lib/r2Storage.js) — song song với historyStorage.ts (IndexedDB cục
// bộ). Lỗi ở đây KHÔNG được chặn UX chính vì IndexedDB đã lưu xong trước đó.

export interface SaveCreationToR2Payload {
  id: string;
  name: string;
  html: string;
  imageBase64?: string; // kèm hoặc không kèm tiền tố data:...;base64, (ảnh/PDF, hoặc video upload trực tiếp)
  sourceUrl?: string; // URL R2 public của file gốc upload trực tiếp từ client
  mimeType?: string;
  videoUrl?: string; // Link YouTube/Facebook gốc, nếu creation đến từ link video (không upload file)
  transcodedVideoUrl?: string; // URL R2 vĩnh viễn của bản MP4 đã chuyển mã từ file gốc không phát trực tiếp được (xem videoTranscode.ts)
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


export interface R2CreationRecord {
  id: string;
  name: string;
  html: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  mimeType?: string | null;
  transcodedVideoUrl?: string | null;
  timestamp: string;
}

export async function loadAllCreationsFromR2(): Promise<R2CreationRecord[]> {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'bring-any-idea-to-life-load-r2' }),
  });
  if (!res.ok) {
    const message = await res.text().catch(() => '');
    throw new Error(`Load history from R2 failed (HTTP ${res.status})${message ? `: ${message}` : ''}`);
  }
  const data = await res.json();
  return Array.isArray(data?.creations) ? data.creations : [];
}


export interface SourceUploadUrlResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

async function presignSourceUpload(id: string, contentType: string, fallback: boolean): Promise<SourceUploadUrlResult> {
  const presignRes = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'bring-any-idea-to-life-source-upload-url', id, contentType, fallback }),
  });
  if (!presignRes.ok) {
    const message = await presignRes.text().catch(() => '');
    throw new Error(`Không tạo được URL upload R2 (HTTP ${presignRes.status})${message ? `: ${message}` : ''}`);
  }
  return presignRes.json() as Promise<SourceUploadUrlResult>;
}

// CƠ CHẾ DỰ PHÒNG BUCKET THỨ 2 (13/08/2026): server ký presigned URL nên
// KHÔNG tự biết PUT có thành công hay không — CLIENT (nơi thực sự chạy PUT)
// mới là bên phát hiện lỗi và phải chủ động xin lại URL trỏ sang bucket dự
// phòng (fallback: true, xem createBringAnyIdeaToLifeSourceUploadUrl ở
// bringAnyIdeaToLifeHistoryR2.js). Chỉ retry ĐÚNG 1 LẦN — nếu bucket dự
// phòng cũng lỗi (vd chưa cấu hình R2_BUCKET_NAME1, hoặc CORS chưa bật trên
// bucket dự phòng — xem ghi chú CORS trong r2Storage.js) thì để lỗi bay lên,
// KHÔNG lặp vô hạn.
export async function uploadSourceFileToR2(id: string, file: Blob): Promise<SourceUploadUrlResult> {
  const contentType = file.type || 'application/octet-stream';

  const attemptUpload = async (fallback: boolean): Promise<SourceUploadUrlResult> => {
    const payload = await presignSourceUpload(id, contentType, fallback);
    const uploadRes = await fetch(payload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    });
    if (!uploadRes.ok) {
      throw new Error(`Upload file gốc lên R2 thất bại (HTTP ${uploadRes.status}).`);
    }
    return payload;
  };

  try {
    return await attemptUpload(false);
  } catch (err) {
    console.warn('[bring-any-idea-to-life] Upload bucket chính thất bại, thử bucket dự phòng:', err);
    try {
      return await attemptUpload(true);
    } catch (fallbackErr) {
      throw new Error(
        `Upload file gốc lên R2 thất bại ở cả bucket chính lẫn bucket dự phòng. Lỗi cuối: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`,
      );
    }
  }
}

/**
 * Upload bản MP4 đã chuyển mã (xem lib/videoTranscode.ts) lên R2, dùng
 * KHÓA RIÊNG (`${creationId}-mp4`) để không đè lên file gốc (.mov) đã lưu ở
 * khóa `creationId` — tái sử dụng luôn hạ tầng presigned-upload có sẵn
 * (uploadSourceFileToR2), không cần thêm route backend mới.
 */
export async function uploadTranscodedVideoToR2(creationId: string, blob: Blob): Promise<string> {
  const file = new Blob([blob], { type: 'video/mp4' });
  const result = await uploadSourceFileToR2(`${creationId}-mp4`, file);
  return result.publicUrl;
}
