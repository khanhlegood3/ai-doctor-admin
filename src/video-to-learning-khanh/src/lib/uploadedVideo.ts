// src/video-to-learning-khanh/src/lib/uploadedVideo.ts
//
// Tính năng "Tải video lên" — cho phép người dùng upload 1 file video TỪ
// MÁY (không chỉ dán link YouTube/Facebook như trước) để tạo bài học từ đó.
//
// Vì video-to-learning-proxy.js lấy nội dung video qua TRANSCRIPT (phụ đề
// YouTube/Facebook, xem videoToLearningProxy.js), mà video tự upload thì
// KHÔNG CÓ transcript có sẵn nào — nên quy trình ở đây là:
//   1. Tách audio khỏi video (ffmpeg.wasm, CHẠY TRONG TRÌNH DUYỆT — xem
//      lib/videoTranscode.ts) — chỉ audio, nhẹ hơn nhiều so với gửi cả
//      video, và tránh phải xây thêm hạ tầng xử lý video ở server.
//   2. Gửi audio đó cho Groq Whisper (endpoint /api/groq-whisper CÓ SẴN,
//      cùng cách chess-chat đang dùng cho voice chat) để lấy transcript.
//   3. Song song, upload NGUYÊN VIDEO GỐC lên R2 (để có thể xem lại /
//      chuyển mã sau nếu trình duyệt không phát trực tiếp được — xem
//      videoTranscode.ts + lib/history/historyR2Client.ts, cùng cơ chế với
//      "Bring Any Idea to Life").
//   4. transcript ở bước 2 được gửi thẳng lên server qua field
//      `videoTranscript` (xem lib/textGeneration.ts) — server dùng luôn,
//      bỏ qua bước tự lấy transcript YouTube/Facebook.

import { extractAudioFromVideo } from './videoTranscode';

export interface UploadedVideoResult {
  transcript: string;
  publicUrl: string;
  mimeType: string;
}

export interface UploadedVideoProgress {
  stage: 'extracting-audio' | 'transcribing' | 'uploading-video';
  ratio?: number; // 0..1, chỉ có ở stage 'extracting-audio'
}

async function presignVideoUpload(id: string, contentType: string): Promise<{ uploadUrl: string; publicUrl: string }> {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'video-to-learning-source-upload-url', id, contentType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Không tạo được URL upload R2 (HTTP ${res.status}).`);
  return data;
}

async function uploadVideoFileToR2(id: string, file: File): Promise<string> {
  const contentType = file.type || 'video/mp4';
  const { uploadUrl, publicUrl } = await presignVideoUpload(id, contentType);
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!res.ok) throw new Error(`Upload video lên R2 thất bại (HTTP ${res.status}).`);
  return publicUrl;
}

async function transcribeAudioBlob(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append('file', blob, 'audio.mp3');
  const res = await fetch('/api/groq-whisper', { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Nhận diện giọng nói (Whisper) thất bại (HTTP ${res.status}).`);
  return (data?.text || '').trim();
}

/**
 * Xử lý 1 file video vừa upload: trích transcript (để sinh bài học) +
 * upload video gốc lên R2 (để xem lại). Chạy audio-extraction/transcribe VÀ
 * upload-video-gốc SONG SONG (không phụ thuộc nhau) để nhanh hơn.
 */
export async function processUploadedVideo(
  id: string,
  file: File,
  onProgress?: (p: UploadedVideoProgress) => void,
): Promise<UploadedVideoResult> {
  const transcriptPromise = (async () => {
    onProgress?.({ stage: 'extracting-audio', ratio: 0 });
    const audioBlob = await extractAudioFromVideo(URL.createObjectURL(file), {
      onProgress: (ratio) => onProgress?.({ stage: 'extracting-audio', ratio }),
    });
    onProgress?.({ stage: 'transcribing' });
    const transcript = await transcribeAudioBlob(audioBlob);
    if (!transcript) {
      throw new Error('Không nhận diện được lời nói nào trong video (có thể video không có tiếng, hoặc quá ồn). Hãy thử video khác hoặc dùng link YouTube/Facebook.');
    }
    return transcript;
  })();

  const uploadPromise = (async () => {
    onProgress?.({ stage: 'uploading-video' });
    return uploadVideoFileToR2(id, file);
  })();

  const [transcript, publicUrl] = await Promise.all([transcriptPromise, uploadPromise]);
  return { transcript, publicUrl, mimeType: file.type || 'video/mp4' };
}

/**
 * Upload bản MP4 đã chuyển mã (client-side, xem lib/videoTranscode.ts) lên
 * R2, dùng KHOÁ RIÊNG (`${uploadId}-mp4`) để không đè lên video gốc đã lưu
 * ở khoá `uploadId` — gọi từ components/UploadedVideoPreview.tsx sau khi
 * chuyển mã thành công, để cache lại cho lần xem SAU không phải chuyển mã
 * lại từ đầu (xem App.tsx: handleTranscodedVideoCached).
 */
export async function uploadTranscodedMp4ToR2(uploadId: string, blob: Blob): Promise<string> {
  const file = new File([blob], `${uploadId}-mp4.mp4`, { type: 'video/mp4' });
  return uploadVideoFileToR2(`${uploadId}-mp4`, file);
}
