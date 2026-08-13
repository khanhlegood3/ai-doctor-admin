/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation } from './components/CreationHistory';
import { DemoTemplates } from './components/DemoTemplates';
import { OneShotArcadeCard } from './components/OneShotArcadeCard';
import { ONE_SHOT_ARCADE_HTML } from './lib/oneShotArcade';
import { bringToLife, uploadVideoFileToGemini } from './lib/api';
import { compressImageFile, MAX_UNCOMPRESSED_FILE_BYTES } from './lib/imageCompress';
import { getAllCreations, putCreation, patchCreation, migrateFromLocalStorageOnce } from './lib/historyStorage';
import { saveCreationToR2, loadAllCreationsFromR2, uploadSourceFileToR2 } from './lib/historyR2Client';
import { DemoTemplate } from './lib/demoTemplates';
import { ArrowUpTrayIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<Creation[]>([]);
  const [isLoadingR2History, setIsLoadingR2History] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const importR2Creations = async () => {
    const rows = await loadAllCreationsFromR2();
    const loaded = rows.map((row) => ({
      id: row.id,
      name: row.name || 'New Creation',
      html: row.html,
      originalImage: row.imageUrl || undefined,
      mimeType: row.mimeType || null,
      videoUrl: row.videoUrl || undefined,
      timestamp: new Date(row.timestamp || Date.now()),
    }));

    for (const item of loaded) {
      await putCreation({
        id: item.id,
        name: item.name,
        html: item.html,
        originalImage: item.originalImage,
        mimeType: item.mimeType || null,
        videoUrl: item.videoUrl,
        timestamp: item.timestamp.toISOString(),
      });
    }

    setHistory((prev) => {
      const byId = new Map<string, Creation>();
      [...loaded, ...prev].forEach((item) => byId.set(item.id, item));
      return Array.from(byId.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
  };

  // Load history from IndexedDB on mount, then automatically hydrate any old
  // creation JSONs that were already backed up in R2 so the landing-page embed
  // shows previous work without requiring a manual click.
  useEffect(() => {
    const initHistory = async () => {
      try {
        await migrateFromLocalStorageOnce();
        const rows = await getAllCreations();
        if (rows.length > 0) {
          setHistory(rows.map((r) => ({ ...r, timestamp: new Date(r.timestamp) })));
        }
      } catch (e) {
        console.error('Failed to load history from IndexedDB', e);
      }

      setIsLoadingR2History(true);
      try {
        await importR2Creations();
      } catch (e) {
        console.warn('Failed to auto-load history from R2', e);
      } finally {
        setIsLoadingR2History(false);
      }
    };

    initHistory();
  }, []);

  // Upload file gốc (ảnh/PDF/video) người dùng chọn lên R2 CHẠY NỀN, SAU KHI
  // app đã tạo xong — KHÔNG await trước bringToLife() và KHÔNG throw khi lỗi.
  //
  // Trước đây (do 1 PR khác merge vào) bước này chạy ĐỒNG BỘ + CHẶN ngay đầu
  // handleGenerate, TRƯỚC bringToLife(): nếu upload R2 lỗi (sai cấu hình R2/
  // CORS, mất mạng, "Load failed"...) thì toàn bộ quá trình tạo app bị huỷ
  // ngang với lỗi "Không upload được file gốc lên R2 nên chưa tạo app" — dù
  // AI chưa hề được gọi. Sửa lại: R2 chỉ là bản sao lưu bền, không phải điều
  // kiện để tạo app — giống hệt persistCreation() bên dưới, vốn đã đúng kiểu
  // fire-and-forget từ đầu.
  const uploadSourceInBackground = (creationId: string, file: File) => {
    uploadSourceFileToR2(creationId, file)
      .then((uploaded) => {
        // Ảnh/PDF/video gốc đã có sẵn cục bộ (data URL) để hiển thị ngay từ
        // lúc tạo app — khi R2 upload xong, thay bằng URL R2 (nhẹ hơn nhiều
        // cho IndexedDB) nhưng không chặn hay ảnh hưởng gì tới creation đã hiển thị.
        patchCreation(creationId, { originalImage: uploaded.publicUrl }).catch((e) =>
          console.warn('[bring-any-idea-to-life] Failed to patch IndexedDB with R2 source url', e)
        );
        setHistory((prev) => prev.map((c) => (c.id === creationId ? { ...c, originalImage: uploaded.publicUrl } : c)));
        setActiveCreation((prev) => (prev && prev.id === creationId ? { ...prev, originalImage: uploaded.publicUrl } : prev));
      })
      .catch((uploadErr) => {
        // Chỉ log — app đã tạo xong và hiển thị rồi, mất bản sao lưu R2 của
        // file gốc không ảnh hưởng UX chính (ảnh/PDF/video gốc vẫn còn ở
        // dạng data URL cục bộ trong IndexedDB).
        console.warn('[bring-any-idea-to-life] Source file R2 upload failed (non-blocking):', uploadErr);
      });
  };

  // Lưu 1 creation vào CẢ HAI nơi: IndexedDB (đọc lại tức thì, không cần
  // mạng) và R2 (sao lưu bền, không phụ thuộc trình duyệt/thiết bị) — R2
  // chạy fire-and-forget, lỗi không chặn UX chính vì IndexedDB đã lưu xong.
  const persistCreation = async (creation: Creation, imageBase64?: string, mimeType?: string, sourceUrl?: string) => {
    const timestampIso = creation.timestamp.toISOString();
    try {
      await putCreation({
        id: creation.id,
        name: creation.name,
        html: creation.html,
        originalImage: creation.originalImage,
        videoUrl: creation.videoUrl,
        mimeType: creation.mimeType || mimeType || null,
        timestamp: timestampIso,
      });
    } catch (e) {
      console.error('Failed to save creation to IndexedDB', e);
    }

    saveCreationToR2({
      id: creation.id,
      name: creation.name,
      html: creation.html,
      imageBase64,
      sourceUrl,
      mimeType: creation.mimeType || mimeType,
      videoUrl: creation.videoUrl,
      timestamp: timestampIso,
    }).then((result) => {
      if (result) {
        patchCreation(creation.id, { r2JsonUrl: result.jsonUrl, r2ImageUrl: result.imageUrl, originalImage: result.imageUrl || creation.originalImage, mimeType: creation.mimeType || mimeType || null }).catch((e) =>
          console.warn('Failed to patch IndexedDB with R2 urls', e)
        );
      }
    });
  };

  // Helper to convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // `videoUrl` được truyền khi người dùng dán link YouTube/Facebook thay vì upload
  // file (xem InputArea.tsx) — Gemini "xem" trực tiếp video qua link, không cần
  // tải base64 lên (tính năng mang từ "Video to Learning" sang).
  // `imageUrl` dành cho ảnh trực tiếp; `webUrl` dành cho trang chủ, kênh,
  // bài viết hoặc bất kỳ link web http/https nào để server trích nội dung.
  const handleGenerate = async (promptText: string, file?: File, videoUrl?: string, imageUrl?: string, webUrl?: string) => {
    setIsGenerating(true);
    // Clear active creation to show loading state
    setActiveCreation(null);

    try {
      let imageBase64: string | undefined;
      let mimeType: string | undefined;
      let geminiFileUri: string | undefined;
      let geminiFileMimeType: string | undefined;
      let geminiKeyLabel: string | undefined;
      const creationId = crypto.randomUUID();

      if (file) {
        const rawMimeType = (file.type || 'application/octet-stream').toLowerCase();

        if (rawMimeType.startsWith('image/')) {
          // Luôn nén ảnh qua canvas trước khi gửi — ảnh chụp thẳng từ camera
          // (2-8MB) + base64 overhead ~33% dễ vượt giới hạn cứng 4.5MB của
          // Vercel serverless function, khiến request bị chặn ở tầng network
          // và Safari báo "Load failed" (không phải lỗi từ server) — xem
          // lib/imageCompress.ts.
          const compressed = await compressImageFile(file);
          imageBase64 = compressed.base64;
          mimeType = compressed.mimeType;
        } else if (rawMimeType.startsWith('video/')) {
          // Video: KHÔNG còn giới hạn 3MB nữa — upload thẳng lên R2 rồi để
          // server đẩy sang Gemini Files API (xem uploadVideoFileToGemini
          // trong lib/api.ts), giống hệt luồng video-analyzer-khanh. Chỉ
          // gửi geminiFileUri sang bringToLife(), KHÔNG gửi base64.
          mimeType = rawMimeType;
          setLoadingLabel('Đang tải video lên...');
          try {
            const uploaded = await uploadVideoFileToGemini(file);
            geminiFileUri = uploaded.uri;
            geminiFileMimeType = uploaded.mimeType;
            geminiKeyLabel = uploaded.geminiKeyLabel;
          } finally {
            setLoadingLabel('Đang phân tích và tạo app...');
          }
        } else {
          // PDF / các loại file khác: không nén được dễ dàng ở client. Chặn
          // sớm với thông báo rõ ràng thay vì để request âm thầm thất bại
          // với "Load failed" khi vượt giới hạn 4.5MB của Vercel — video đã
          // tách sang nhánh R2/Gemini Files API ở trên nên không còn bị chặn
          // ở đây nữa.
          if (file.size > MAX_UNCOMPRESSED_FILE_BYTES) {
            throw new Error(
              `File "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) vượt quá giới hạn ` +
                `${(MAX_UNCOMPRESSED_FILE_BYTES / 1024 / 1024).toFixed(1)}MB cho PDF (giới hạn request ` +
                `body của Vercel serverless function). Hãy dùng file nhỏ hơn để AI xử lý trước, ` +
                `sau đó hệ thống mới upload file gốc lên R2.`
            );
          }
          imageBase64 = await fileToBase64(file);
          mimeType = rawMimeType;
        }
      }

      const html = await bringToLife(promptText, imageBase64, mimeType, videoUrl, imageUrl, webUrl, geminiFileUri, geminiFileMimeType, geminiKeyLabel);

      if (html) {
        const newCreation: Creation = {
          id: creationId,
          name: file ? file.name : videoUrl ? videoUrl : imageUrl ? imageUrl : webUrl ? webUrl : 'New Creation',
          html: html,
          // Dùng data URL cục bộ để hiện ngay lập tức — R2 upload (nếu có
          // file) chạy NỀN SAU KHI app đã tạo xong, xem uploadSourceInBackground().
          originalImage: imageBase64 && mimeType ? `data:${mimeType};base64,${imageBase64}` : imageUrl,
          mimeType: mimeType || null,
          videoUrl,
          timestamp: new Date(),
        };
        setActiveCreation(newCreation);
        setHistory(prev => [newCreation, ...prev]);
        persistCreation(newCreation, imageBase64, mimeType);

        // App đã tạo xong và hiển thị rồi — GIỜ MỚI upload file gốc lên R2,
        // chạy nền, không chặn và không throw khi lỗi.
        if (file) {
          uploadSourceInBackground(creationId, file);
        }
      }

    } catch (error) {
      // Hiện lỗi THẬT (đã bao gồm tên provider + status code, xem lib/api.ts)
      // thay vì thông báo chung chung — trước đây popup luôn hiện
      // "Something went wrong... Please try again." bất kể lỗi thật là gì
      // (hết quota Groq/Gemini, sai key, timeout, mất mạng...), khiến không
      // debug được lý do trang bị treo/chậm.
      const message = error instanceof Error ? error.message : String(error);
      console.error('[handleGenerate] Failed to generate:', error);
      alert(`Lỗi khi tạo app:\n\n${message}`);
    } finally {
      setIsGenerating(false);
    }
  };


  const handleCreateFromLink = async (link: string) => {
    const trimmed = link.trim();
    if (!trimmed) return;
    // Reuse the same classifier path as the landing input so image URLs,
    // YouTube links, Facebook video links, and generic webpages create a fresh
    // version instead of mutating the existing app result.
    const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const lower = normalized.toLowerCase();
    const isVideoLink = lower.includes('youtube.com/') || lower.includes('youtu.be/') || lower.includes('facebook.com/') || lower.includes('fb.watch/');
    await handleGenerate('', undefined, isVideoLink ? normalized : undefined, isVideoLink ? undefined : normalized);
  };

  const handleReset = () => {
    setActiveCreation(null);
    setIsGenerating(false);
  };

  const handleSelectCreation = (creation: Creation) => {
    setActiveCreation(creation);
  };

  // Suy ra mimeType từ đuôi file của URL thumbnail (tất cả thumbnail demo
  // hiện tại đều là .png/.jpg/.jpeg, xem lib/demoTemplates/index.ts) — để
  // LivePreview nhận diện đúng đây là ảnh (isOriginalVideo/isOriginalPdf =
  // false) và render bằng <img>, không rơi vào nhánh "Thiếu file".
  const guessImageMimeType = (url: string): string => {
    const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
    if (ext === 'webp') return 'image/webp';
    if (ext === 'gif') return 'image/gif';
    return 'image/png';
  };

  // Bấm 1 mẫu trong "bộ mẫu demo" (DemoTemplates) -> xem ngay trong
  // LivePreview, giống hệt loadMockExample() của Video to Learning: KHÔNG
  // gọi AI, và KHÔNG ghi vào lịch sử thật (IndexedDB/R2) vì đây chỉ là mẫu
  // có sẵn để tham khảo, không phải sáng tạo của người dùng.
  //
  // FIX: gắn sẵn originalImage = template.thumbnail (ảnh gốc demo đã có sẵn
  // URL thật, xem lib/demoTemplates/index.ts) thay vì để trống — trước đây
  // để trống khiến khung "Original Input" hiểu nhầm là "artifact cũ thiếu
  // file gốc" và bắt người dùng tự upload lại, dù thumbnail đã tồn tại sẵn.
  // Panel vẫn hiển thị nút "Upload R2" (xem LivePreview.tsx, nút này không
  // điều kiện theo originalImage) để người dùng tự thay bằng file khác nếu
  // muốn — đúng thứ tự "load ảnh cũ trước, cho đè lên sau nếu muốn".
  const handleSelectDemo = (template: DemoTemplate) => {
    setActiveCreation({
      id: 'demo-' + template.id,
      name: template.name,
      html: template.html,
      originalImage: template.thumbnail,
      mimeType: guessImageMimeType(template.thumbnail),
      timestamp: new Date(),
    });
  };

  // "One Shot Arcade" — KHÁC handleSelectDemo ở trên: đây KHÔNG phải mẫu
  // tĩnh, mà là 1 mini-game tự chứa GỌI AI THẬT lúc chơi (Groq Vision +
  // Pollinations, xem src/lib/oneShotArcade.ts). Vẫn dùng chung LivePreview
  // để tận dụng UI có sẵn (fullscreen, tải HTML về, nút back...), nhưng cố
  // tình KHÔNG lưu vào lịch sử thật (IndexedDB/R2) vì "creation" ở đây là 1
  // trò chơi, không phải nội dung người dùng tạo ra để lưu lại xem sau.
  const handleOpenOneShotArcade = () => {
    setActiveCreation({
      id: 'one-shot-arcade',
      name: 'One Shot Arcade',
      html: ONE_SHOT_ARCADE_HTML,
      timestamp: new Date(),
    });
  };


  const handleLoadR2History = async () => {
    setIsLoadingR2History(true);
    try {
      await importR2Creations();
    } catch (err) {
      console.error('Failed to load history from R2', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Không tải được history từ R2:\n\n${message}`);
    } finally {
      setIsLoadingR2History(false);
    }
  };


  const handleUploadMissingSource = async (creation: Creation, file: File) => {
    const uploaded = await uploadSourceFileToR2(creation.id, file);
    const updated: Creation = {
      ...creation,
      originalImage: uploaded.publicUrl,
      videoUrl: undefined,
      mimeType: file.type || 'application/octet-stream',
    };
    setActiveCreation(updated);
    setHistory((prev) => prev.map((item) => (item.id === creation.id ? updated : item)));
    await putCreation({
      id: updated.id,
      name: updated.name,
      html: updated.html,
      originalImage: updated.originalImage,
      mimeType: updated.mimeType,
      videoUrl: updated.videoUrl,
      timestamp: updated.timestamp.toISOString(),
      r2ImageUrl: uploaded.publicUrl,
    });
    await saveCreationToR2({
      id: updated.id,
      name: updated.name,
      html: updated.html,
      sourceUrl: uploaded.publicUrl,
      mimeType: updated.mimeType || undefined,
      videoUrl: updated.videoUrl,
      timestamp: updated.timestamp.toISOString(),
    });
  };



  const handleDeleteUploadedSource = async (creation: Creation) => {
    const updated: Creation = {
      ...creation,
      originalImage: undefined,
      mimeType: null,
    };
    setActiveCreation(updated);
    setHistory((prev) => prev.map((item) => (item.id === creation.id ? updated : item)));
    await putCreation({
      id: updated.id,
      name: updated.name,
      html: updated.html,
      originalImage: undefined,
      mimeType: null,
      videoUrl: updated.videoUrl,
      timestamp: updated.timestamp.toISOString(),
      r2ImageUrl: null,
    });
    await saveCreationToR2({
      id: updated.id,
      name: updated.name,
      html: updated.html,
      mimeType: undefined,
      videoUrl: updated.videoUrl,
      timestamp: updated.timestamp.toISOString(),
    });
  };

  const handleRegenerateFromUploadedSource = async (creation: Creation) => {
    if (!creation.originalImage) return;
    const mimeType = creation.mimeType || '';
    const isVideoSource = /^video\//i.test(mimeType) || /\.(mp4|mov|webm|m4v)(\?|$)/i.test(creation.originalImage);
    if (creation.originalImage.startsWith('data:')) {
      const match = creation.originalImage.match(/^data:([^;]+);base64,(.*)$/);
      if (!match) throw new Error('File gốc dạng data URL không hợp lệ.');
      await handleGenerate('', new File([Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))], creation.name, { type: match[1] }));
      return;
    }

    setIsGenerating(true);
    setActiveCreation(null);
    try {
      const html = await bringToLife('', undefined, undefined, isVideoSource ? creation.originalImage : undefined, isVideoSource ? undefined : creation.originalImage);
      const newCreation: Creation = {
        id: crypto.randomUUID(),
        name: `${creation.name} (rerun)`,
        html,
        originalImage: creation.originalImage,
        mimeType: creation.mimeType || null,
        timestamp: new Date(),
      };
      setActiveCreation(newCreation);
      setHistory((prev) => [newCreation, ...prev]);
      persistCreation(newCreation, undefined, newCreation.mimeType || undefined, creation.originalImage);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[handleRegenerateFromUploadedSource] Failed to regenerate:', error);
      alert(`Lỗi khi chạy lại từ file đã upload:

${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const json = event.target?.result as string;
            const parsed = JSON.parse(json);
            
            // Basic validation
            if (parsed.html && parsed.name) {
                const importedCreation: Creation = {
                    ...parsed,
                    timestamp: new Date(parsed.timestamp || Date.now()),
                    id: parsed.id || crypto.randomUUID()
                };
                
                // Add to history if not already there (by ID check)
                setHistory(prev => {
                    const exists = prev.some(c => c.id === importedCreation.id);
                    return exists ? prev : [importedCreation, ...prev];
                });

                // Set as active immediately
                setActiveCreation(importedCreation);

                // originalImage (nếu có) là data URL đầy đủ (data:<mime>;base64,<data>) —
                // tách ra để truyền cho persistCreation giống hệt luồng handleGenerate.
                let importedImageBase64: string | undefined;
                let importedMimeType: string | undefined;
                if (importedCreation.originalImage?.startsWith('data:')) {
                  const match = importedCreation.originalImage.match(/^data:([^;]+);base64,(.*)$/);
                  if (match) {
                    importedMimeType = match[1];
                    importedImageBase64 = match[2];
                  }
                }
                persistCreation(importedCreation, importedImageBase64, importedMimeType);
            } else {
                alert("Invalid creation file format.");
            }
        } catch (err) {
            console.error("Import error", err);
            alert("Failed to import creation.");
        }
        // Reset input
        if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const isFocused = !!activeCreation || isGenerating;

  return (
    <div className="h-[100dvh] bg-zinc-950 bg-dot-grid text-zinc-50 selection:bg-blue-500/30 overflow-y-auto overflow-x-hidden relative flex flex-col">
      
      {/* Centered Content Container */}
      <div 
        className={`
          min-h-full flex flex-col w-full max-w-[96rem] mx-auto px-4 sm:px-6 relative z-10 
          transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
          ${isFocused 
            ? 'opacity-0 scale-95 blur-sm pointer-events-none h-[100dvh] overflow-hidden' 
            : 'opacity-100 scale-100 blur-0'
          }
        `}
      >
        {/* Main Vertical Centering Wrapper */}
        <div className="flex-1 flex flex-col justify-center items-center w-full py-12 md:py-20">
          
          {/* 1. Hero Section */}
          <div className="w-full mb-8 md:mb-16">
              <Hero />
          </div>

          {/* 2. Input Section */}
          <div className="w-full flex justify-center mb-8">
              <InputArea onGenerate={handleGenerate} isGenerating={isGenerating} disabled={isFocused} />
          </div>

          {/* 2b. Demo template gallery — xem ngay các mẫu có sẵn, không cần AI */}
          <DemoTemplates onSelect={handleSelectDemo} disabled={isFocused} />

          {/* 2c. One Shot Arcade — mini-game AI thật, tách riêng khỏi gallery ở trên */}
          <OneShotArcadeCard onSelect={handleOpenOneShotArcade} disabled={isFocused} />

        </div>
        
        {/* 3. History Section & Footer - Stays at bottom */}
        <div className="flex-shrink-0 pb-6 w-full mt-auto flex flex-col items-center gap-6">
            <div className="w-full px-2 md:px-0">
                <CreationHistory history={history} onSelect={handleSelectCreation} onLoadR2={handleLoadR2History} isLoadingR2={isLoadingR2History} />
            </div>
            
            <a 
              href="https://x.com/ammaar" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors pb-2"
            >
              Created by @ammaar
            </a>
        </div>
      </div>

      {/* Live Preview - Always mounted for smooth transition */}
      <LivePreview
        creation={activeCreation}
        isLoading={isGenerating}
        loadingLabel={loadingLabel}
        isFocused={isFocused}
        onReset={handleReset}
        onUploadMissingSource={handleUploadMissingSource}
        onDeleteUploadedSource={handleDeleteUploadedSource}
        onRegenerateFromUploadedSource={handleRegenerateFromUploadedSource}
        onCreateFromLink={handleCreateFromLink}
      />

      {/* Subtle Import Button (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-50">
        <button 
            onClick={handleImportClick}
            className="flex items-center space-x-2 p-2 text-zinc-500 hover:text-zinc-300 transition-colors opacity-60 hover:opacity-100"
            title="Import Artifact"
        >
            <span className="text-xs font-medium uppercase tracking-wider hidden sm:inline">Upload previous artifact</span>
            <ArrowUpTrayIcon className="w-5 h-5" />
        </button>
        <input 
            type="file" 
            ref={importInputRef} 
            onChange={handleImportFile} 
            accept=".json" 
            className="hidden" 
        />
      </div>
    </div>
  );
};

export default App;