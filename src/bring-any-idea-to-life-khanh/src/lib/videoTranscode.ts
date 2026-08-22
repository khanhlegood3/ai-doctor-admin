/**
 * videoTranscode.ts
 *
 * Chuyển mã video (vd .mov/QuickTime từ iPhone, mã hoá HEVC/ProRes mà
 * Chrome/Edge/Firefox không phát được) sang MP4 (H.264 + AAC) — chạy HOÀN
 * TOÀN TRONG TRÌNH DUYỆT bằng ffmpeg.wasm, không cần server.
 *
 * TẠI SAO KHÔNG LÀM Ở SERVER (Vercel Serverless):
 * - Dự án đã dùng hết giới hạn 12 Serverless Functions của Vercel (xem
 *   vercel.json / api/*.js) — không có chỗ cho 1 function transcode riêng.
 * - ffmpeg native binary (không phải .wasm) khó cài đặt tin cậy trên
 *   Vercel serverless (kích thước deploy, tương thích kiến trúc CPU).
 * - Vercel serverless có giới hạn thời gian chạy (maxDuration) — video dài/
 *   nặng dễ bị timeout giữa chừng.
 * Chạy trong trình duyệt tránh được cả 3 giới hạn trên (đổi lại: tốc độ
 * chậm hơn native ffmpeg, và người dùng phải tải ~30MB core ffmpeg.wasm lần
 * đầu — nhưng chỉ tải KHI THỰC SỰ CẦN, xem lazy dynamic import bên dưới).
 *
 * Dùng bản CORE ĐƠN LUỒNG (không phải -mt/multi-thread) vì bản multi-thread
 * cần header Cross-Origin-Embedder-Policy: require-corp — header này rất dễ
 * làm VỠ các iframe cùng-origin khác của dự án (chess-chat, vision-sync,
 * v.v.) nếu áp cho cả site. Đơn luồng chậm hơn nhưng không cần header đó,
 * an toàn hơn nhiều cho 1 dự án dùng iframe khắp nơi như thế này.
 */

// Core ffmpeg.wasm (~25MB, gồm .js + .wasm) tải qua CDN lúc runtime, KHÔNG
// bundle vào app — tránh phình bundle chính cho 1 tính năng ít dùng.
const FFMPEG_CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd';

export class VideoTranscodeError extends Error {}

let ffmpegPromise: Promise<any> | null = null;

async function getFFmpeg(onLog?: (message: string) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);
      const ffmpeg = new FFmpeg();
      if (onLog) ffmpeg.on('log', ({ message }: { message: string }) => onLog(message));
      await ffmpeg.load({
        coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      return ffmpeg;
    })().catch((err) => {
      ffmpegPromise = null; // cho phép thử lại lần sau nếu lần này lỗi (vd mất mạng giữa chừng)
      throw err;
    });
  }
  return ffmpegPromise;
}

export interface TranscodeOptions {
  /** 0..1 — tiến độ ước lượng (dựa trên `ratio` mà ffmpeg.wasm báo về). */
  onProgress?: (ratio: number) => void;
  /** Dòng log thô từ ffmpeg (hữu ích để debug khi lỗi khó hiểu). */
  onLog?: (message: string) => void;
}

/**
 * Tải `sourceUrl` về và chuyển mã sang MP4 (H.264 + AAC). Trả về 1 Blob
 * (`video/mp4`) sẵn sàng để tạo Object URL và phát trực tiếp bằng thẻ
 * `<video>` — hoặc upload lên R2 nếu muốn cache lại cho lần sau.
 */
export async function transcodeVideoToMp4(sourceUrl: string, { onProgress, onLog }: TranscodeOptions = {}): Promise<Blob> {
  const { fetchFile } = await import('@ffmpeg/util');
  const ffmpeg = await getFFmpeg(onLog);

  const progressHandler = ({ progress }: { progress: number }) => {
    // ffmpeg.wasm thỉnh thoảng báo progress > 1 hoặc NaN ở vài khung hình
    // đầu/cuối — kẹp lại cho thanh tiến độ không nhảy loạn.
    if (onProgress && Number.isFinite(progress)) onProgress(Math.max(0, Math.min(1, progress)));
  };
  ffmpeg.on('progress', progressHandler);

  const inputName = 'input.src';
  const outputName = 'output.mp4';

  try {
    const data = await fetchFile(sourceUrl);
    await ffmpeg.writeFile(inputName, data);

    // -c:v libx264 (+ preset veryfast để đỡ chậm trên WASM) + -c:a aac:
    // định dạng được MỌI trình duyệt hỗ trợ phát trực tiếp.
    await ffmpeg.exec([
      '-i', inputName,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      '-movflags', '+faststart', // metadata lên đầu file -> phát được ngay trong lúc tải, không cần tải hết
      outputName,
    ]);

    const result = await ffmpeg.readFile(outputName); // Uint8Array (không truyền encoding -> luôn nhị phân, không phải string)
    const bytes = typeof result === 'string' ? new TextEncoder().encode(result) : result;
    return new Blob([bytes], { type: 'video/mp4' });
  } catch (err) {
    throw new VideoTranscodeError(err instanceof Error ? err.message : String(err));
  } finally {
    ffmpeg.off('progress', progressHandler);
    // Dọn file tạm trong filesystem ảo của ffmpeg.wasm (instance được tái sử
    // dụng giữa các lần gọi -> không dọn sẽ tích tụ dần theo phiên).
    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});
  }
}
