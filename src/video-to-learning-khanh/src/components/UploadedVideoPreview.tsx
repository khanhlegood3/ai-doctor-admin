// src/video-to-learning-khanh/src/components/UploadedVideoPreview.tsx
//
// Hiện lại VIDEO GỐC đã upload (không phải nội dung AI sinh ra) — cho phép
// người dùng xem lại file mình đã tải lên. Một số video (đặc biệt .mov/
// QuickTime quay từ iPhone, mimeType "video/quicktime") không phát trực
// tiếp được trên Chrome/Edge/Firefox (chỉ Safari giải mã được codec bên
// trong) — cùng vấn đề đã gặp ở "Bring Any Idea to Life" (xem
// bring-any-idea-to-life-khanh/src/components/LivePreview.tsx), nên xử lý
// y hệt: bắt lỗi phát video -> cho phép chuyển mã sang MP4 ngay trong trình
// duyệt bằng ffmpeg.wasm (không cần server) -> phát bản đã chuyển mã.
//
// KHÁC LivePreview.tsx: chưa cache bản MP4 đã chuyển mã lên R2 (session-
// only) — Video to Learning không có cơ chế "patch lại 1 record đã lưu"
// theo id ổn định như Bring Any Idea to Life, nên tạm để mỗi lần xem lại tự
// chuyển mã lại. Có thể bổ sung sau nếu cần.
import React, { useEffect, useRef, useState } from 'react';

interface UploadedVideoPreviewProps {
  videoUrl: string;
  mimeType?: string | null;
  // id ổn định của video này trên R2 (HistoryEntry.r2Id / QueueItem.videoUploadId)
  // — cần để upload bản MP4 đã chuyển mã vào ĐÚNG chỗ (xem lib/uploadedVideo.ts).
  // Không có (undefined) thì tính năng cache bị bỏ qua, chỉ chuyển mã tạm
  // trong phiên xem hiện tại (giống hành vi ban đầu).
  uploadId?: string;
  // URL R2 vĩnh viễn của bản MP4 ĐÃ chuyển mã từ TRƯỚC (lần xem trước) —
  // có thì phát THẲNG luôn, không cần thử phát bản gốc/chuyển mã lại.
  cachedTranscodedUrl?: string | null;
  // Gọi sau khi chuyển mã MỚI xong + upload cache lên R2 thành công, để
  // App.tsx lưu lại (IndexedDB + R2 creation JSON) cho lần xem sau.
  onCached?: (transcodedVideoUrl: string) => Promise<void>;
}

export const UploadedVideoPreview: React.FC<UploadedVideoPreviewProps> = ({ videoUrl, mimeType, uploadId, cachedTranscodedUrl, onCached }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [transcodeError, setTranscodeError] = useState<string | null>(null);
  const [transcodedBlobUrl, setTranscodedBlobUrl] = useState<string | null>(null);
  const transcodedBlobUrlRef = useRef<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');

  useEffect(() => {
    setPlaybackError(false);
    setTranscodeError(null);
    setTranscodeProgress(0);
    setTranscodedBlobUrl(null);
    setCacheStatus('idle');
    if (transcodedBlobUrlRef.current) {
      URL.revokeObjectURL(transcodedBlobUrlRef.current);
      transcodedBlobUrlRef.current = null;
    }
  }, [videoUrl]);
  useEffect(() => () => {
    if (transcodedBlobUrlRef.current) URL.revokeObjectURL(transcodedBlobUrlRef.current);
  }, []);

  const handleTranscode = async () => {
    if (isTranscoding) return;
    setIsTranscoding(true);
    setTranscodeError(null);
    setTranscodeProgress(0);
    try {
      const { transcodeVideoToMp4 } = await import('../lib/videoTranscode');
      const blob = await transcodeVideoToMp4(videoUrl, { onProgress: setTranscodeProgress });
      const url = URL.createObjectURL(blob);
      transcodedBlobUrlRef.current = url;
      setTranscodedBlobUrl(url);
      setPlaybackError(false);

      // Cache lên R2 CHẠY NỀN (không chặn việc xem video vừa chuyển mã) —
      // chỉ khi có uploadId (biết chỗ để lưu) và callback từ App.tsx.
      if (uploadId && onCached) {
        setCacheStatus('uploading');
        (async () => {
          try {
            const { uploadTranscodedMp4ToR2 } = await import('../lib/uploadedVideo');
            const publicUrl = await uploadTranscodedMp4ToR2(uploadId, blob);
            await onCached(publicUrl);
            setCacheStatus('done');
          } catch (cacheErr) {
            console.warn('[video-to-learning] Cache bản MP4 lên R2 thất bại (không ảnh hưởng video đang xem):', cacheErr);
            setCacheStatus('error');
          }
        })();
      }
    } catch (err) {
      setTranscodeError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsTranscoding(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="border-b border-slate-800 px-4 py-2">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-sky-400"
        >
          📹 Xem lại video gốc đã tải lên
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-slate-800 bg-black/40 px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">📹 Video gốc đã tải lên</span>
        <button type="button" onClick={() => setIsOpen(false)} className="text-xs text-slate-500 hover:text-slate-300">
          Đóng ✕
        </button>
      </div>

      {cachedTranscodedUrl ? (
        <video key={cachedTranscodedUrl} src={cachedTranscodedUrl} controls playsInline preload="metadata" className="max-h-64 w-full rounded" />
      ) : transcodedBlobUrl ? (
        <div className="flex flex-col items-center gap-1.5">
          <video key={transcodedBlobUrl} src={transcodedBlobUrl} controls playsInline preload="metadata" className="max-h-64 w-full rounded" />
          {cacheStatus === 'uploading' && <p className="text-[11px] text-slate-500">Đang lưu bản MP4 lên R2 để lần sau khỏi chuyển đổi lại...</p>}
          {cacheStatus === 'done' && <p className="text-[11px] text-emerald-400">Đã lưu — lần xem sau sẽ phát ngay, không cần chuyển đổi lại.</p>}
          {cacheStatus === 'error' && <p className="text-[11px] text-amber-400">Xem được nhưng chưa lưu cache lên R2 — lần sau có thể phải chuyển đổi lại.</p>}
        </div>
      ) : playbackError ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-4 text-center">
          <p className="text-xs text-slate-400">
            Trình duyệt không phát được định dạng video này{mimeType ? ` (${mimeType})` : ''}. File có thể là .mov/QuickTime (quay từ
            iPhone) — chỉ Safari phát trực tiếp được, Chrome/Edge/Firefox thường không hỗ trợ.
          </p>
          {isTranscoding ? (
            <div className="flex w-full max-w-xs flex-col items-center gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-sky-500 transition-all" style={{ width: `${Math.round(transcodeProgress * 100)}%` }} />
              </div>
              <p className="text-[11px] text-slate-500">Đang chuyển đổi sang MP4... {Math.round(transcodeProgress * 100)}%</p>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleTranscode}
                className="rounded-md bg-emerald-600/80 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white"
              >
                Chuyển đổi sang MP4 để xem
              </button>
              <a
                href={videoUrl}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Tải video gốc
              </a>
            </div>
          )}
          {transcodeError && <p className="text-[11px] text-red-400">Chuyển đổi thất bại: {transcodeError}</p>}
        </div>
      ) : (
        <video
          key={videoUrl}
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          onError={() => setPlaybackError(true)}
          className="max-h-64 w-full rounded"
        />
      )}
    </div>
  );
};
