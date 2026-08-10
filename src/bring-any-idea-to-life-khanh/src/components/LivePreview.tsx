/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useState, useRef } from 'react';
import { ArrowDownTrayIcon, PlusIcon, ViewColumnsIcon, DocumentIcon, CodeBracketIcon, XMarkIcon, ArrowUpTrayIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Creation } from './CreationHistory';
import { classifyVideoUrl, getVideoEmbedUrl } from '../lib/videoLink';

interface LivePreviewProps {
  creation: Creation | null;
  isLoading: boolean;
  isFocused: boolean;
  onReset: () => void;
  onUploadMissingSource?: (creation: Creation, file: File) => Promise<void>;
  onDeleteUploadedSource?: (creation: Creation) => Promise<void>;
  onRegenerateFromUploadedSource?: (creation: Creation) => Promise<void>;
}

// Add type definition for the global pdfjsLib
declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const LoadingStep = ({ text, active, completed }: { text: string, active: boolean, completed: boolean }) => (
    <div className={`flex items-center space-x-3 transition-all duration-500 ${active || completed ? 'opacity-100 translate-x-0' : 'opacity-30 translate-x-4'}`}>
        <div className={`w-4 h-4 flex items-center justify-center ${completed ? 'text-green-400' : active ? 'text-blue-400' : 'text-zinc-700'}`}>
            {completed ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            ) : active ? (
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse"></div>
            ) : (
                <div className="w-1.5 h-1.5 bg-zinc-700 rounded-full"></div>
            )}
        </div>
        <span className={`font-mono text-xs tracking-wide uppercase ${active ? 'text-zinc-200' : completed ? 'text-zinc-400 line-through' : 'text-zinc-600'}`}>{text}</span>
    </div>
);

const PdfRenderer = ({ dataUrl }: { dataUrl: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderPdf = async () => {
      if (!window.pdfjsLib) {
        setError("PDF library not initialized");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Load the document
        const loadingTask = window.pdfjsLib.getDocument(dataUrl);
        const pdf = await loadingTask.promise;
        
        // Get the first page
        const page = await pdf.getPage(1);
        
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        
        // Calculate scale to make it look good (High DPI)
        const viewport = page.getViewport({ scale: 2.0 });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        await page.render(renderContext).promise;
        setLoading(false);
      } catch (err) {
        console.error("Error rendering PDF:", err);
        setError("Could not render PDF preview.");
        setLoading(false);
      }
    };

    renderPdf();
  }, [dataUrl]);

  if (error) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 p-6 text-center">
            <DocumentIcon className="w-12 h-12 mb-3 opacity-50 text-red-400" />
            <p className="text-sm mb-2 text-red-400/80">{error}</p>
        </div>
    );
  }

  return (
    <div className="relative w-full h-full flex items-center justify-center">
        {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
                <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            </div>
        )}
        <canvas 
            ref={canvasRef} 
            className={`max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded transition-opacity duration-500 ${loading ? 'opacity-0' : 'opacity-100'}`}
        />
    </div>
  );
};

// Bug: đôi khi Groq/Gemini trả về HTML thiếu <style>/color-scheme (chữ đen
// trên nền tối do trình duyệt tự force-dark), hoặc trả về text thô (không
// phải HTML hợp lệ) khiến trình duyệt render ở quirks-mode mặc định — cả
// hai trường hợp đều có thể ra chữ cùng màu với nền (vô hình). Hàm này chèn
// một baseline màu sắc an toàn (color-scheme: light + nền trắng/chữ đen)
// trước khi đưa vào iframe, để nếu HTML sinh ra tự set màu riêng thì màu đó
// vẫn được ưu tiên (baseline chỉ là fallback), còn nếu không có gì thì luôn
// đọc được thay vì vô hình.
function buildSafeSrcDoc(html: string): string {
  const baseStyle = '<style>html,body{background:#ffffff;color:#111111;color-scheme:light;}</style>';

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${baseStyle}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${baseStyle}</head>`);
  }
  // Không phải một document HTML đầy đủ (ví dụ model trả về text thuần/markdown
  // thay vì HTML) — bọc lại thành document hợp lệ để luôn có nền/chữ tương phản rõ.
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyle}<style>body{margin:0;padding:24px;font-family:ui-monospace,monospace;white-space:pre-wrap;line-height:1.6;}</style></head><body>${html}</body></html>`;
}

export const LivePreview: React.FC<LivePreviewProps> = ({ creation, isLoading, isFocused, onReset, onUploadMissingSource, onDeleteUploadedSource, onRegenerateFromUploadedSource }) => {
    const [loadingStep, setLoadingStep] = useState(0);
    const [showSplitView, setShowSplitView] = useState(false);
    const [isUploadingSource, setIsUploadingSource] = useState(false);
    const [isDeletingSource, setIsDeletingSource] = useState(false);
    const missingSourceInputRef = useRef<HTMLInputElement>(null);

    // Handle loading animation steps
    useEffect(() => {
        if (isLoading) {
            setLoadingStep(0);
            const interval = setInterval(() => {
                setLoadingStep(prev => (prev < 3 ? prev + 1 : prev));
            }, 2000); 
            return () => clearInterval(interval);
        } else {
            setLoadingStep(0);
        }
    }, [isLoading]);

    // Default to Split View when a new creation with an image or video source is loaded
    useEffect(() => {
        // Luôn mở khung Original Input khi artifact có source, hoặc khi artifact cũ
        // bị thiếu source nhưng có thể bổ sung file gốc lên R2 ngay trong khung đó.
        if (creation && (creation.originalImage || creation.videoUrl || onUploadMissingSource)) {
            setShowSplitView(true);
        } else {
            setShowSplitView(false);
        }
    }, [creation, onUploadMissingSource]);


    const handleMissingSourceChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !creation || !onUploadMissingSource) return;
        setIsUploadingSource(true);
        try {
            await onUploadMissingSource(creation, file);
            setShowSplitView(true);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            alert(`Không upload được file gốc lên R2:

${message}`);
        } finally {
            setIsUploadingSource(false);
            event.target.value = '';
        }
    };


    const hasUploadedSource = Boolean(creation?.originalImage) && !creation?.videoUrl;

    const handleDeleteUploadedSource = async () => {
        if (!creation || !onDeleteUploadedSource) return;
        const ok = window.confirm('Xóa video/hình/PDF gốc khỏi khung Original Input cho creation này? Kết quả app hiện tại vẫn được giữ lại.');
        if (!ok) return;
        setIsDeletingSource(true);
        try {
            await onDeleteUploadedSource(creation);
            setShowSplitView(false);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            alert(`Không xóa được file gốc:

${message}`);
        } finally {
            setIsDeletingSource(false);
        }
    };

    const handleRegenerateFromUploadedSource = async () => {
        if (!creation || !onRegenerateFromUploadedSource) return;
        await onRegenerateFromUploadedSource(creation);
    };

    const originalMimeType = creation?.mimeType || (creation?.originalImage?.startsWith('data:') ? creation.originalImage.slice(5, creation.originalImage.indexOf(';')) : '');
    const isOriginalVideo = Boolean(creation?.originalImage) && (/^video\//i.test(originalMimeType) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(creation?.originalImage || ''));
    const isOriginalPdf = Boolean(creation?.originalImage) && (originalMimeType === 'application/pdf' || /\.pdf(\?|$)/i.test(creation?.originalImage || ''));
    const hasOriginalSource = Boolean(creation?.originalImage || creation?.videoUrl);
    const canUploadMissingSource = Boolean(creation && !hasOriginalSource && onUploadMissingSource);
    const shouldShowOriginalPanel = showSplitView && Boolean(hasOriginalSource || canUploadMissingSource);

    const handleExport = () => {
        if (!creation) return;
        const dataStr = JSON.stringify(creation, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${creation.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_artifact.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

  return (
    <div
      className={`
        fixed z-40 flex flex-col
        rounded-lg overflow-hidden border border-zinc-800 bg-[#0E0E10] shadow-2xl
        transition-all duration-700 cubic-bezier(0.2, 0.8, 0.2, 1)
        ${isFocused
          ? 'inset-2 md:inset-4 opacity-100 scale-100'
          : 'top-1/2 left-1/2 w-[90%] h-[60%] -translate-x-1/2 -translate-y-1/2 opacity-0 scale-95 pointer-events-none'
        }
      `}
    >
      {/* Minimal Technical Header */}
      <div className="bg-[#121214] px-4 py-3 flex items-center justify-between border-b border-zinc-800 shrink-0">
        {/* Left: Controls */}
        <div className="flex items-center space-x-3 w-32">
           <div className="flex space-x-2 group/controls">
                <button 
                  onClick={onReset}
                  className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-red-500 hover:!bg-red-600 transition-colors flex items-center justify-center focus:outline-none"
                  title="Close Preview"
                >
                  <XMarkIcon className="w-2 h-2 text-black opacity-0 group-hover/controls:opacity-100" />
                </button>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-yellow-500 transition-colors"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-700 group-hover/controls:bg-green-500 transition-colors"></div>
           </div>
        </div>
        
        {/* Center: Title */}
        <div className="flex items-center space-x-2 text-zinc-500">
            <CodeBracketIcon className="w-3 h-3" />
            <span className="text-[11px] font-mono uppercase tracking-wider">
                {isLoading ? 'System Processing...' : creation ? creation.name : 'Preview Mode'}
            </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center justify-end space-x-1 w-48">
            {!isLoading && creation && (
                <>
                    {(hasOriginalSource || canUploadMissingSource) && (
                         <button 
                            onClick={() => setShowSplitView(!showSplitView)}
                            title={showSplitView ? "Show App Only" : "Compare with Original"}
                            className={`p-1.5 rounded-md transition-all ${showSplitView ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <ViewColumnsIcon className="w-4 h-4" />
                        </button>
                    )}

                    {onUploadMissingSource && (!creation.originalImage || creation.videoUrl) && (
                        <button
                            onClick={() => missingSourceInputRef.current?.click()}
                            disabled={isUploadingSource}
                            title={creation.videoUrl ? "Upload file from computer/phone to replace the link in Original Input" : "Upload missing original file to R2"}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-50"
                        >
                            <ArrowUpTrayIcon className="w-4 h-4" />
                        </button>
                    )}

                    {hasUploadedSource && onRegenerateFromUploadedSource && (
                        <button
                            onClick={handleRegenerateFromUploadedSource}
                            title="Run again from uploaded file to create a new result"
                            className="text-zinc-500 hover:text-emerald-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                        >
                            <ArrowPathIcon className="w-4 h-4" />
                        </button>
                    )}

                    {hasUploadedSource && onDeleteUploadedSource && (
                        <button
                            onClick={handleDeleteUploadedSource}
                            disabled={isDeletingSource}
                            title="Delete uploaded video/image/PDF from Original Input"
                            className="text-zinc-500 hover:text-red-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-50"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    )}

                    <button 
                        onClick={handleExport}
                        title="Export Artifact (JSON)"
                        className="text-zinc-500 hover:text-zinc-300 transition-colors p-1.5 rounded-md hover:bg-zinc-800"
                    >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                    </button>

                    <button 
                        onClick={onReset}
                        title="New Upload"
                        className="ml-2 flex items-center space-x-1 text-xs font-bold bg-white text-black hover:bg-zinc-200 px-3 py-1.5 rounded-md transition-colors"
                    >
                        <PlusIcon className="w-3 h-3" />
                        <span className="hidden sm:inline">New</span>
                    </button>
                </>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative w-full flex-1 bg-[#09090b] flex overflow-hidden">
        {isLoading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 w-full">
             {/* Technical Loading State */}
             <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 mb-6 text-blue-500 animate-spin-slow">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                           <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-zinc-100 font-mono text-lg tracking-tight">Constructing Environment</h3>
                    <p className="text-zinc-500 text-sm mt-2">Interpreting visual data...</p>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 animate-[loading_3s_ease-in-out_infinite] w-1/3"></div>
                </div>

                 {/* Terminal Steps */}
                 <div className="border border-zinc-800 bg-black/50 rounded-lg p-4 space-y-3 font-mono text-sm">
                     <LoadingStep text="Analyzing visual inputs" active={loadingStep === 0} completed={loadingStep > 0} />
                     <LoadingStep text="Identifying UI patterns" active={loadingStep === 1} completed={loadingStep > 1} />
                     <LoadingStep text="Generating functional logic" active={loadingStep === 2} completed={loadingStep > 2} />
                     <LoadingStep text="Compiling preview" active={loadingStep === 3} completed={loadingStep > 3} />
                 </div>
             </div>
          </div>
        ) : creation?.html ? (
          <>
            {/* Split View: Left Panel (Original Image / Video) */}
            {shouldShowOriginalPanel && (
                <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-zinc-800 bg-[#0c0c0e] relative flex flex-col shrink-0">
                    <div className="absolute top-4 left-4 z-10 bg-black/80 backdrop-blur text-zinc-400 text-[10px] font-mono uppercase px-2 py-1 rounded border border-zinc-800">
                        Original Input
                    </div>
                    <div className="absolute top-4 right-4 z-10 flex flex-wrap justify-end gap-2">
                        {onUploadMissingSource && (
                            <button
                                type="button"
                                onClick={() => missingSourceInputRef.current?.click()}
                                disabled={isUploadingSource}
                                className="rounded-full border border-blue-400/40 bg-blue-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-200 backdrop-blur transition-colors hover:bg-blue-500/25 disabled:opacity-50"
                            >
                                Upload R2
                            </button>
                        )}
                        {hasUploadedSource && onRegenerateFromUploadedSource && (
                            <button
                                type="button"
                                onClick={handleRegenerateFromUploadedSource}
                                className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-200 backdrop-blur transition-colors hover:bg-emerald-500/25"
                            >
                                Chạy lại
                            </button>
                        )}
                        {hasUploadedSource && onDeleteUploadedSource && (
                            <button
                                type="button"
                                onClick={handleDeleteUploadedSource}
                                disabled={isDeletingSource}
                                className="rounded-full border border-red-400/40 bg-red-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-200 backdrop-blur transition-colors hover:bg-red-500/25 disabled:opacity-50"
                            >
                                Xóa file
                            </button>
                        )}
                    </div>
                    <div className="w-full h-full p-6 flex items-center justify-center overflow-hidden">
                        {creation.videoUrl ? (
                            (() => {
                                const classified = classifyVideoUrl(creation.videoUrl);
                                return classified ? (
                                    <iframe
                                        title="Original video source"
                                        src={getVideoEmbedUrl(classified)}
                                        className="w-full h-full rounded shadow-xl border border-zinc-800/50"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                ) : (
                                    <a href={creation.videoUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm underline break-all px-4 text-center">
                                        {creation.videoUrl}
                                    </a>
                                );
                            })()
                        ) : isOriginalPdf && creation.originalImage?.startsWith('data:') ? (
                            <PdfRenderer dataUrl={creation.originalImage} />
                        ) : isOriginalVideo ? (
                            <video
                                src={creation.originalImage}
                                controls
                                className="max-w-full max-h-full rounded shadow-xl border border-zinc-800/50"
                            />
                        ) : creation.originalImage ? (
                            <img 
                                src={creation.originalImage} 
                                alt="Original Input" 
                                className="max-w-full max-h-full object-contain shadow-xl border border-zinc-800/50 rounded"
                            />
                        ) : (
                            <div className="flex max-w-sm flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/60 p-6 text-center shadow-xl">
                                <ArrowUpTrayIcon className="mb-3 h-10 w-10 text-zinc-500" />
                                <h3 className="text-sm font-semibold text-zinc-200">Thiếu file Original Input</h3>
                                <p className="mt-2 text-xs leading-5 text-zinc-500">
                                    Artifact cũ chưa có ảnh/video/PDF gốc. Chọn file từ máy tính hoặc điện thoại để upload lên R2 và gắn lại vào khung này.
                                </p>
                                {onUploadMissingSource && (
                                    <button
                                        type="button"
                                        onClick={() => missingSourceInputRef.current?.click()}
                                        disabled={isUploadingSource}
                                        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/15 px-4 py-2 text-xs font-bold uppercase tracking-wider text-blue-200 transition-colors hover:border-blue-400 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        <ArrowUpTrayIcon className="h-4 w-4" />
                                        {isUploadingSource ? 'Uploading to R2...' : 'Upload file lên R2'}
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* App Preview Panel */}
            <div className={`relative h-full bg-white transition-all duration-500 ${shouldShowOriginalPanel ? 'w-full md:w-1/2 h-1/2 md:h-full' : 'w-full'}`}>
                 <iframe
                    title="Gemini Live Preview"
                    srcDoc={buildSafeSrcDoc(creation.html)}
                    className="w-full h-full"
                    sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                />
            </div>
          </>
        ) : null}
        <input
            ref={missingSourceInputRef}
            type="file"
            accept="image/*,application/pdf,video/*"
            className="hidden"
            onChange={handleMissingSourceChange}
        />
      </div>
    </div>
  );
};
