/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useCallback, useState, useEffect } from 'react';
import { ArrowUpTrayIcon, SparklesIcon, CpuChipIcon, LinkIcon } from '@heroicons/react/24/outline';
import { classifyVideoUrl } from '../lib/videoLink';

interface InputAreaProps {
  // `videoUrl` được truyền khi người dùng dán link YouTube/Facebook thay vì upload file
  // (tính năng mang từ "Video to Learning" sang, xem VideoToLearningPanel/App.tsx).
  onGenerate: (prompt: string, file?: File, videoUrl?: string) => void;
  isGenerating: boolean;
  disabled?: boolean;
}

const CyclingText = () => {
    const words = [
        "a napkin sketch",
        "a chaotic whiteboard",
        "a game level design",
        "a sci-fi interface",
        "a diagram of a machine",
        "an ancient scroll"
    ];
    const [index, setIndex] = useState(0);
    const [fade, setFade] = useState(true);

    useEffect(() => {
        const interval = setInterval(() => {
            setFade(false); // fade out
            setTimeout(() => {
                setIndex(prev => (prev + 1) % words.length);
                setFade(true); // fade in
            }, 500); // Wait for fade out
        }, 3000); // Slower cycle to read longer text
        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <span className={`inline-block whitespace-nowrap transition-all duration-500 transform ${fade ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-2 blur-sm'} text-white font-medium pb-1 border-b-2 border-blue-500/50`}>
            {words[index]}
        </span>
    );
};

export const InputArea: React.FC<InputAreaProps> = ({ onGenerate, isGenerating, disabled = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [videoLinkValue, setVideoLinkValue] = useState('');
  const [videoLinkError, setVideoLinkError] = useState<string | null>(null);

  const handleFile = (file: File) => {
    if (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('video/')) {
      onGenerate("", file);
    } else {
      alert("Please upload an image, PDF, or video.");
    }
  };

  const handleVideoLinkSubmit = () => {
    if (disabled || isGenerating) return;
    const raw = videoLinkValue.trim();
    if (!raw) return;

    const classified = classifyVideoUrl(raw);
    if (!classified) {
      setVideoLinkError('Vui lòng dán một link video YouTube hoặc video/reel Facebook hợp lệ.');
      return;
    }
    setVideoLinkError(null);
    onGenerate("", undefined, classified.url);
  };

  const handleVideoLinkKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleVideoLinkSubmit();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isGenerating) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [disabled, isGenerating]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (!disabled && !isGenerating) {
        setIsDragging(true);
    }
  }, [disabled, isGenerating]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto perspective-1000">
      <div 
        className={`relative group transition-all duration-300 ${isDragging ? 'scale-[1.01]' : ''}`}
      >
        <label
          className={`
            relative flex flex-col items-center justify-center
            h-56 sm:h-64 md:h-[22rem]
            bg-zinc-900/30 
            backdrop-blur-sm
            rounded-xl border border-dashed
            cursor-pointer overflow-hidden
            transition-all duration-300
            ${isDragging 
              ? 'border-blue-500 bg-zinc-900/50 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' 
              : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/40'
            }
            ${isGenerating ? 'pointer-events-none' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
            {/* Technical Grid Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                 style={{backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '32px 32px'}}>
            </div>
            
            {/* Corner Brackets for technical feel */}
            <div className={`absolute top-4 left-4 w-4 h-4 border-l-2 border-t-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>
            <div className={`absolute top-4 right-4 w-4 h-4 border-r-2 border-t-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>
            <div className={`absolute bottom-4 left-4 w-4 h-4 border-l-2 border-b-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>
            <div className={`absolute bottom-4 right-4 w-4 h-4 border-r-2 border-b-2 transition-colors duration-300 ${isDragging ? 'border-blue-500' : 'border-zinc-600'}`}></div>

            <div className="relative z-10 flex flex-col items-center text-center space-y-6 md:space-y-8 p-6 md:p-8 w-full">
                <div className={`relative w-16 h-16 md:w-20 md:h-20 rounded-2xl flex items-center justify-center transition-transform duration-500 ${isDragging ? 'scale-110' : 'group-hover:-translate-y-1'}`}>
                    <div className={`absolute inset-0 rounded-2xl bg-zinc-800 border border-zinc-700 shadow-xl flex items-center justify-center ${isGenerating ? 'animate-pulse' : ''}`}>
                        {isGenerating ? (
                            <CpuChipIcon className="w-8 h-8 md:w-10 md:h-10 text-blue-400 animate-spin-slow" />
                        ) : (
                            <ArrowUpTrayIcon className={`w-8 h-8 md:w-10 md:h-10 text-zinc-300 transition-all duration-300 ${isDragging ? '-translate-y-1 text-blue-400' : ''}`} />
                        )}
                    </div>
                </div>

                <div className="space-y-2 md:space-y-4 w-full max-w-3xl">
                    <h3 className="flex flex-col items-center justify-center text-xl sm:text-2xl md:text-4xl text-zinc-100 leading-none font-bold tracking-tighter gap-3">
                        <span>Bring</span>
                        {/* Fixed height container to prevent layout shifts */}
                        <div className="h-8 sm:h-10 md:h-14 flex items-center justify-center w-full">
                           <CyclingText />
                        </div>
                        <span>to life</span>
                    </h3>
                    <p className="text-zinc-500 text-xs sm:text-base md:text-lg font-light tracking-wide">
                        <span className="hidden md:inline">Drag & Drop</span>
                        <span className="md:hidden">Tap</span> to upload an image, PDF, or video
                    </p>
                </div>
            </div>

            <input
                type="file"
                accept="image/*,application/pdf,video/*"
                className="hidden"
                onChange={handleFileChange}
                disabled={isGenerating || disabled}
            />
        </label>
      </div>

      {/* Video link input — mang từ "Video to Learning" sang: người dùng có thể dán
          link YouTube/Facebook thay vì upload file, Gemini sẽ "xem" trực tiếp video. */}
      <div className="mt-4 flex items-center gap-3 text-zinc-600">
        <div className="h-px flex-1 bg-zinc-800" />
        <span className="text-xs font-mono uppercase tracking-wider">or paste a video link</span>
        <div className="h-px flex-1 bg-zinc-800" />
      </div>

      <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2">
        <div className="relative flex-1">
          <LinkIcon className="w-4 h-4 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={videoLinkValue}
            onChange={(e) => {
              setVideoLinkValue(e.target.value);
              if (videoLinkError) setVideoLinkError(null);
            }}
            onKeyDown={handleVideoLinkKeyDown}
            disabled={isGenerating || disabled}
            placeholder="https://www.youtube.com/watch?v=... or a Facebook video/reel link"
            className={`w-full rounded-lg bg-zinc-900/50 border px-3 py-2.5 pl-9 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors disabled:opacity-50 ${
              videoLinkError ? 'border-red-500/60 focus:border-red-500' : 'border-zinc-700 focus:border-blue-500'
            }`}
          />
        </div>
        <button
          type="button"
          onClick={handleVideoLinkSubmit}
          disabled={isGenerating || disabled || !videoLinkValue.trim()}
          className="shrink-0 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors"
        >
          Bring to life
        </button>
      </div>
      {videoLinkError && <p className="mt-2 text-xs text-red-400">{videoLinkError}</p>}
    </div>
  );
};
