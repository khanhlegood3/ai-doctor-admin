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
}

export const UploadedVideoPreview: React.FC<UploadedVideoPreviewProps> = ({ videoUrl, mimeType }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [playbackError, setPlaybackError] = useState(false);
  const [isTranscoding, setIsTranscoding] = useState(false);
  const [transcodeProgress, setTranscodeProgress] = useState(0);
  const [transcodeError, setTranscodeError] = useState<string | null>(null);
  const [transcodedBlobUrl, setTranscodedBlobUrl] = useState<string | null>(null);
  const transcodedBlobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    setPlaybackError(false);
    setTranscodeError(null);
    setTranscodeProgress(0);
    setTranscodedBlobUrl(null);
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

      {transcodedBlobUrl ? (
        <video key={transcodedBlobUrl} src={transcodedBlobUrl} controls playsInline preload="metadata" className="max-h-64 w-full rounded" />
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
