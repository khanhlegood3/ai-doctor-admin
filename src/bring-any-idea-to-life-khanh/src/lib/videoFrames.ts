/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Trích xuất vài khung hình tĩnh từ 1 file video NGAY TRÊN TRÌNH DUYỆT (qua
// <video> + <canvas>, không cần ffmpeg/server) — mục đích: cho phép thử Groq
// (miễn phí) TRƯỚC cho cả video, giống hệt luồng ảnh/PDF, thay vì luôn phải
// upload nguyên video lên R2 rồi qua Gemini Files API (chỉ để dành khi Groq
// thật sự lỗi — xem callGroqVideoFrames trong api/_lib/bringAnyIdeaToLifeProxy.js).
//
// KÍCH THƯỚC/CHẤT LƯỢNG khung hình cố tình nhỏ hơn NHIỀU so với ảnh thường
// (MAX_DIMENSION=768 ở imageCompress.ts): Groq free tier giới hạn CỨNG 8000
// token/request (input+output cộng lại — xem ghi chú GROQ_PLAN_MAX_TOKENS
// trong bringAnyIdeaToLifeProxy.js, 1 ảnh 768px đơn lẻ đã tốn ~3200 token).
// Gửi NHIỀU khung hình cùng lúc trong 1 request sẽ cộng dồn token theo từng
// ảnh — nếu giữ nguyên 768px, chỉ 2-3 khung hình đã vượt xa TPM 8000. Hạ
// xuống 384px + JPEG quality thấp hơn giữ mỗi khung hình ở mức nhẹ (~700-900
// token ước tính), để 3 khung hình cộng lại vẫn nằm trong ngân sách an toàn,
// tương đương khoảng 1 ảnh 768px bình thường.
const FRAME_MAX_DIMENSION = 384;
const FRAME_JPEG_QUALITY = 0.6;
// 3 khung hình (đầu/giữa/cuối) đủ để nắm được hành động/tiến trình chính
// trong hầu hết video ngắn (demo, tutorial, cảnh sinh hoạt) mà không tốn quá
// nhiều ngân sách token — nhiều hơn nữa dễ làm Groq trả lỗi 429 "Request too
// large" ngay từ bước 1 (planFromImage/planFromFrames).
const DEFAULT_FRAME_COUNT = 3;

export interface ExtractedVideoFrame {
  base64: string; // KHÔNG kèm prefix "data:...;base64,"
  mimeType: 'image/jpeg';
}

/**
 * Trích `frameCount` khung hình JPEG nhỏ, lấy đều theo timeline của video
 * (bỏ qua sát mép đầu/cuối vì thường là khung đen/chuyển cảnh). Trả về mảng
 * base64 (không prefix), sẵn sàng gửi lên server làm content ảnh cho Groq.
 *
 * Có thể reject (ví dụ codec trình duyệt không decode được, hoặc video quá
 * ngắn/hỏng) — nơi gọi (App.tsx) cần bắt lỗi và tự fallback sang upload
 * nguyên video lên Gemini Files API như luồng cũ.
 */
export function extractVideoFrames(file: File, frameCount: number = DEFAULT_FRAME_COUNT): Promise<ExtractedVideoFrame[]> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    // muted + playsInline cần thiết để Safari mobile cho phép load/seek mà
    // không đòi hỏi tương tác người dùng hay tự mở fullscreen native.
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = objectUrl;

    const canvas = document.createElement('canvas');
    const frames: ExtractedVideoFrame[] = [];
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute('src');
      video.load();
    };

    const fail = (err: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err instanceof Error ? err : new Error(String(err)));
    };

    // Vài trình duyệt/codec không bao giờ bắn 'loadedmetadata' nếu file hỏng
    // — chặn bằng timeout thay vì treo vô hạn.
    const hardTimeout = setTimeout(() => fail(new Error('Hết thời gian chờ đọc metadata video để trích khung hình.')), 15_000);

    video.onerror = () => fail(video.error?.message || 'Trình duyệt không đọc được video để trích khung hình.');

    video.onloadedmetadata = async () => {
      clearTimeout(hardTimeout);
      const duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        fail(new Error('Không xác định được thời lượng video.'));
        return;
      }

      let { videoWidth: width, videoHeight: height } = video;
      if (!width || !height) {
        fail(new Error('Không xác định được kích thước khung hình video.'));
        return;
      }
      if (width > FRAME_MAX_DIMENSION || height > FRAME_MAX_DIMENSION) {
        const scale = FRAME_MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fail(new Error('Không tạo được canvas context để trích khung hình.'));
        return;
      }

      // Lấy mốc thời gian đều nhau, tránh sát mép 0/duration (thường là khung
      // đen hoặc chưa decode được frame đầu tiên).
      const timestamps: number[] = [];
      for (let i = 0; i < frameCount; i++) {
        const fraction = (i + 1) / (frameCount + 1);
        timestamps.push(Math.min(duration * fraction, Math.max(duration - 0.05, 0)));
      }

      const seekAndCapture = (time: number): Promise<void> =>
        new Promise((res, rej) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            try {
              ctx.drawImage(video, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', FRAME_JPEG_QUALITY);
              const base64 = dataUrl.split(',')[1];
              if (base64) frames.push({ base64, mimeType: 'image/jpeg' });
              res();
            } catch (e) {
              rej(e);
            }
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = time;
        });

      try {
        for (const t of timestamps) {
          await seekAndCapture(t);
        }
        if (settled) return;
        settled = true;
        cleanup();
        if (frames.length === 0) {
          reject(new Error('Không trích được khung hình nào từ video.'));
        } else {
          resolve(frames);
        }
      } catch (e) {
        fail(e);
      }
    };
  });
}
