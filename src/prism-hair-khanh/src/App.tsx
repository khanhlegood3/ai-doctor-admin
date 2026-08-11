/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Prism Hair — chuyển thể từ prism-hair.zip (app AI Studio độc lập).
// Đổi màu tóc real-time bằng MediaPipe Image Segmenter (multi-class selfie
// segmentation, chạy client-side qua CDN jsdelivr/storage.googleapis.com),
// KHÔNG gọi Gemini/AI API nào (dependency @google/genai trong app gốc không
// được dùng tới trong App.tsx nên không mang theo). Nhúng vào ai-doctor-admin
// theo đúng mô hình các app con Vite multi-page khác (dino-jump-khanh,
// vision-sync-khanh, ...) — xem PrismHairPanel.jsx (iframe cùng-origin tới
// /src/prism-hair-khanh/index.html) và vite.config.js (build entry).
import React, { useEffect, useRef, useState } from 'react';
import { ImageSegmenter, FilesetResolver } from '@mediapipe/tasks-vision';
import { Camera, RefreshCw, Palette, AlertCircle } from 'lucide-react';

const COLORS = [
  { name: 'None', value: 'transparent' },
  { name: 'Neon Blue', value: '#00FFFF' },
  { name: 'Hot Pink', value: '#FF69B4' },
  { name: 'Emerald', value: '#50C878' },
  { name: 'Purple', value: '#800080' },
];

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageSegmenter, setImageSegmenter] = useState<ImageSegmenter | null>(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[1].value);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWebcamStarted, setIsWebcamStarted] = useState(false);
  
  const requestRef = useRef<number>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevMaskRef = useRef<Float32Array | null>(null);

  useEffect(() => {
    async function initMediaPipe() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        // Load Multi-class Selfie Segmenter
        // Categories: 0-bg, 1-hair, 2-body, 3-face, 4-clothes, 5-others
        const segmenter = await ImageSegmenter.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          outputCategoryMask: false,
          outputConfidenceMasks: true
        });
        
        setImageSegmenter(segmenter);
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to initialize MediaPipe:", err);
        setError("Failed to load AI models. Please check your connection.");
        setIsLoading(false);
      }
    }

    initMediaPipe();

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      imageSegmenter?.close();
    };
  }, []);

  const startWebcam = async () => {
    if (!videoRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'user' } 
      });
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        setIsWebcamStarted(true);
      };
    } catch (err) {
      console.error("Error accessing webcam:", err);
      setError("Webcam access denied. Please enable camera permissions.");
    }
  };

  useEffect(() => {
    if (isWebcamStarted && imageSegmenter) {
      renderLoop();
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isWebcamStarted, imageSegmenter, selectedColor]);

  const renderLoop = () => {
    if (!videoRef.current || !canvasRef.current || !imageSegmenter) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx || video.paused || video.ended) {
      requestRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    // Ensure canvas matches video dimensions
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      if (video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        if (!maskCanvasRef.current) {
          maskCanvasRef.current = document.createElement('canvas');
        }
        maskCanvasRef.current.width = video.videoWidth;
        maskCanvasRef.current.height = video.videoHeight;
        prevMaskRef.current = null;
      }
    }

    if (canvas.width === 0) {
      requestRef.current = requestAnimationFrame(renderLoop);
      return;
    }

    const startTimeMs = performance.now();
    
    // 1. Run Multi-class Segmentation
    imageSegmenter.segmentForVideo(video, startTimeMs, (result) => {
      const confidenceMasks = result.confidenceMasks;
      if (!confidenceMasks || confidenceMasks.length < 2) return;

      // Index 1 is hair in the multiclass model
      const hairMask = confidenceMasks[1];

      // 2. Clear main canvas and draw video
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (selectedColor !== 'transparent') {
        const maskCanvas = maskCanvasRef.current!;
        const maskCtx = maskCanvas.getContext('2d')!;
        
        const hairData = hairMask.getAsFloat32Array();
        
        // Adjusted smoothing factor to 0.4 for a balance between responsiveness and stability
        if (!prevMaskRef.current || prevMaskRef.current.length !== hairData.length) {
          prevMaskRef.current = new Float32Array(hairData);
        } else {
          const smoothingFactor = 0.4;
          for (let i = 0; i < hairData.length; i++) {
            prevMaskRef.current[i] = (hairData[i] * smoothingFactor) + (prevMaskRef.current[i] * (1 - smoothingFactor));
          }
        }

        const smoothedMask = prevMaskRef.current;
        const imageData = maskCtx.createImageData(canvas.width, canvas.height);
        
        for (let i = 0; i < smoothedMask.length; i++) {
          const confidence = smoothedMask[i];
          const pixelIndex = i * 4;
          
          // Soft Alpha Ramping: Start at 30% confidence to catch fine flyaways
          // We use a wider ramp (0.3 to 0.7) for a smoother transition
          let alpha = 0;
          if (confidence > 0.3) {
            alpha = Math.min(255, ((confidence - 0.3) / 0.4) * 255);
          }
          
          imageData.data[pixelIndex] = 255;
          imageData.data[pixelIndex + 1] = 255;
          imageData.data[pixelIndex + 2] = 255;
          imageData.data[pixelIndex + 3] = alpha;
        }
        
        maskCtx.putImageData(imageData, 0, 0);

        // 4. Color the mask
        maskCtx.globalCompositeOperation = 'source-in';
        maskCtx.fillStyle = selectedColor;
        maskCtx.fillRect(0, 0, canvas.width, canvas.height);
        maskCtx.globalCompositeOperation = 'source-over';

        // 5. Blend colored mask onto main canvas
        // We use a slightly stronger blur (2px) to "dilate" the mask and catch flyaways
        ctx.save();
        ctx.globalCompositeOperation = 'soft-light';
        ctx.filter = 'blur(2px)'; 
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    });

    requestRef.current = requestAnimationFrame(renderLoop);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Top Bar */}
      <div className="w-full max-w-4xl mb-6 flex flex-col md:flex-row items-center md:items-end justify-between gap-6 md:gap-0 px-6 py-4 bg-zinc-900/40 backdrop-blur-md rounded-2xl border border-white/5 shadow-xl">
        <div className="flex flex-col items-center md:items-start text-center md:text-left">
          <h1 className="text-3xl font-black tracking-tighter uppercase italic text-white/90 flex items-center gap-3">
            <Palette className="w-7 h-7 text-emerald-400" />
            Prism Hair
          </h1>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/40 mt-1">
            Real-time Neural Segmentation Engine
          </p>
        </div>
        
        <div className="flex gap-3 mb-1">
          <div className="px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full font-mono text-[9px] uppercase tracking-wider flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isWebcamStarted ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className={isWebcamStarted ? 'text-emerald-400' : 'text-red-400'}>Live Feed</span>
          </div>
          <div className="px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-full font-mono text-[9px] uppercase tracking-wider text-white/60">
            GPU Accelerated
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative w-full max-w-4xl aspect-video bg-[#151619] rounded-2xl border border-white/5 shadow-2xl overflow-hidden group">
        <video 
          ref={videoRef} 
          className="hidden" 
          autoPlay 
          playsInline 
          muted 
        />
        
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* System State Overlay */}
        {(!isWebcamStarted && !error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm z-20 gap-12">
            {!isLoading && (
              <button 
                onClick={startWebcam}
                className="group relative px-10 py-4 bg-white text-black rounded-full font-black uppercase italic tracking-tighter text-lg hover:scale-105 transition-transform flex items-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.2)]"
              >
                <Camera className="w-6 h-6" />
                Initialize Camera
              </button>
            )}
            
            <div className="flex flex-col items-center">
              <RefreshCw className={`w-12 h-12 text-emerald-400 mb-4 ${isLoading ? 'animate-spin' : 'opacity-20'}`} />
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-400/60">
                {isLoading ? 'Initializing AI Models...' : 'Awaiting Camera Feed...'}
              </p>
            </div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/90 backdrop-blur-md z-30 p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2 uppercase tracking-tight">System Error</h2>
            <p className="text-red-200/70 max-w-md text-sm mb-6">{error}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-red-500 hover:bg-red-400 text-white rounded-full font-bold text-xs uppercase tracking-widest transition-colors"
            >
              Restart Engine
            </button>
          </div>
        )}

      </div>

      {/* Control Panel */}
      <div className="mt-8 w-full max-w-md bg-[#151619] border border-white/10 rounded-3xl p-6 shadow-2xl relative">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-emerald-500 text-black font-mono text-[10px] font-bold uppercase tracking-widest rounded-full">
          Color Palette
        </div>
        
        <div className="flex justify-between items-center gap-4">
          {COLORS.map((color) => (
            <button
              key={color.name}
              onClick={() => setSelectedColor(color.value)}
              className={`group relative flex flex-col items-center gap-2 transition-all ${
                selectedColor === color.value ? 'scale-110' : 'opacity-60 hover:opacity-100'
              }`}
            >
              <div 
                className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all ${
                  selectedColor === color.value ? 'border-white shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-white/10'
                }`}
                style={{ backgroundColor: color.value === 'transparent' ? '#222' : color.value }}
              >
                {color.value === 'transparent' && (
                  <div className="w-8 h-0.5 bg-red-500/50 rotate-45" />
                )}
              </div>
              <span className="text-[9px] font-mono uppercase tracking-tighter text-white/40 group-hover:text-white/80">
                {color.name}
              </span>
              {selectedColor === color.value && (
                <div className="absolute -bottom-1 w-1 h-1 bg-white rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 flex gap-8 text-[10px] font-mono uppercase tracking-[0.2em] text-white/20">
        <div className="flex items-center gap-2">
          <span className="text-white/40">Model:</span> Hair Segmenter v1.0
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/40">Engine:</span> MediaPipe Vision
        </div>
      </div>
    </div>
  );
}
