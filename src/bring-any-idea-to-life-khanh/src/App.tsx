/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useRef } from 'react';
import { Hero } from './components/Hero';
import { InputArea } from './components/InputArea';
import { LivePreview } from './components/LivePreview';
import { CreationHistory, Creation, getCreationSourceKey } from './components/CreationHistory';
import { DemoTemplates } from './components/DemoTemplates';
import { OneShotArcadeCard } from './components/OneShotArcadeCard';
import { ONE_SHOT_ARCADE_HTML } from './lib/oneShotArcade';
import { bringToLife, uploadVideoFileToGemini, searchVideoLinks, recordArenaVote, getSessionUserApiKey, setSessionUserApiKey, ARENA_PROVIDER_INFO, ARENA_ENGINES } from './lib/api';
import type { ArenaEngine } from './lib/api';
import { ArenaDuel } from './components/ArenaDuel';
import type { ArenaSideState, ArenaVoteChoice } from './components/ArenaDuel';
import { classifyVideoUrl } from './lib/videoLink';
import { compressImageFile, MAX_UNCOMPRESSED_FILE_BYTES } from './lib/imageCompress';
import { extractVideoFrames } from './lib/videoFrames';
import { getAllCreations, putCreation, patchCreation, migrateFromLocalStorageOnce } from './lib/historyStorage';
import { saveCreationToR2, loadAllCreationsFromR2, loadCreationFromR2, uploadSourceFileToR2 } from './lib/historyR2Client';
import { shareGonCreation } from './lib/shareLink';
import { DemoTemplate } from './lib/demoTemplates';
import { ArrowUpTrayIcon } from '@heroicons/react/24/solid';

const App: React.FC = () => {
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<Creation[]>([]);
  const [isLoadingR2History, setIsLoadingR2History] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── GON ARENA: so sánh ẨN DANH 2 model AI (Groq vs Gemini) kiểu arena.ai ──
  // Cùng 1 input (mô tả + tối đa 2 link video, hoặc chỉ text để GON tự tìm
  // video) -> GỌI SONG SONG 2 request: 1 ép engine Groq, 1 ép engine Gemini
  // (server KHÔNG fallback chéo khi engine bị ép — xem forcedEngine trong
  // api/_lib/bringAnyIdeaToLifeProxy.js — nên 2 bên luôn là 2 model khác nhau
  // thật sự). Vị trí Model A/B được random để không ai biết trước bên nào là
  // model nào; danh tính chỉ lộ SAU KHI người dùng vote.
  interface ArenaState {
    description: string;
    videoUrls: string[];
    videoTitles: string[];
    // searching: đang tìm video từ text | confirming: user XEM TRƯỚC + xác
    // nhận video (bắt buộc trước khi đấu — yêu cầu owner) | battling: 2 model
    // đang/đã tạo game song song.
    phase: 'searching' | 'confirming' | 'battling';
    searchError?: string | null;
    sides: { a: ArenaSideState; b: ArenaSideState };
    mapping: { a: ArenaEngine; b: ArenaEngine };
    vote: ArenaVoteChoice | null;
    voteSaved: boolean;
  }
  const [arena, setArena] = useState<ArenaState | null>(null);

  const importR2Creations = async () => {
    const rows = await loadAllCreationsFromR2();
    const loaded = rows.map((row) => ({
      id: row.id,
      name: row.name || 'New Creation',
      html: row.html,
      originalImage: row.imageUrl || undefined,
      mimeType: row.mimeType || null,
      videoUrl: row.videoUrl || undefined,
      transcodedVideoUrl: row.transcodedVideoUrl || undefined,
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
        transcodedVideoUrl: item.transcodedVideoUrl || null,
        timestamp: item.timestamp.toISOString(),
      });
    }

    setHistory((prev) => {
      const byId = new Map<string, Creation>();
      [...loaded, ...prev].forEach((item) => byId.set(item.id, item));
      return Array.from(byId.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    });
  };

  // Creation cũ (từ trước khi luồng upload video chuyển hẳn sang R2-first, xem
  // uploadSourceInBackground bên dưới) có thể vẫn còn kẹt originalImage ở dạng
  // data: URL base64 khổng lồ trong IndexedDB — ví dụ do lúc đó R2 upload nền
  // bị lỗi/mất mạng nên bản patch sang R2 URL không bao giờ chạy xong. Video
  // base64 quá lớn gán thẳng vào <video src> dễ khiến Safari mobile hết bộ nhớ
  // và tự reload trang (xem useVideoPlaybackSrc trong LivePreview.tsx cho fix
  // hiển thị tức thời). Ở đây dọn dẹp tận gốc: âm thầm upload các video "mồ
  // côi" này lên R2 rồi thay originalImage bằng URL nhẹ, để lần mở sau không
  // còn phải tải/giữ base64 khổng lồ trong bộ nhớ nữa.
  const LOCAL_VIDEO_MIGRATION_THRESHOLD_BYTES = 4 * 1024 * 1024;

  const migrateOrphanedLocalVideos = async (creations: Creation[]) => {
    const candidates = creations.filter(
      (c) => c.originalImage && c.originalImage.startsWith('data:video') && c.originalImage.length >= LOCAL_VIDEO_MIGRATION_THRESHOLD_BYTES
    );
    for (const c of candidates) {
      try {
        const res = await fetch(c.originalImage as string);
        const blob = await res.blob();
        const mimeMatch = (c.originalImage as string).match(/^data:([^;]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : c.mimeType || 'video/mp4';
        const file = new File([blob], c.name || 'video', { type: mimeType });
        const uploaded = await uploadSourceFileToR2(c.id, file);
        await patchCreation(c.id, { originalImage: uploaded.publicUrl, r2ImageUrl: uploaded.publicUrl });
        setHistory((prev) => prev.map((item) => (item.id === c.id ? { ...item, originalImage: uploaded.publicUrl } : item)));
        setActiveCreation((prev) => (prev && prev.id === c.id ? { ...prev, originalImage: uploaded.publicUrl } : prev));
      } catch (e) {
        // Không chặn UI — video vẫn xem được cục bộ nhờ Blob URL fallback ở
        // LivePreview, chỉ là lần sau sẽ thử migrate lại.
        console.warn('[bring-any-idea-to-life] Failed to migrate orphaned local video to R2 for creation', c.id, e);
      }
    }
  };

  // Load history from IndexedDB on mount, then automatically hydrate any old
  // creation JSONs that were already backed up in R2 so the landing-page embed
  // shows previous work without requiring a manual click.
  useEffect(() => {
    const linkId = new URLSearchParams(window.location.search).get('linkid')?.trim();
    const initHistory = async () => {
      if (linkId) {
        setIsGenerating(true);
        setLoadingLabel('Đang mở nội dung GON được chia sẻ...');
      }

      try {
        await migrateFromLocalStorageOnce();
        const rows = await getAllCreations();
        if (rows.length > 0) {
          const mapped = rows.map((r) => ({ ...r, timestamp: new Date(r.timestamp) }));
          setHistory(mapped);
          // Chạy nền, không chặn UI — chỉ dọn rác IndexedDB dần dần.
          migrateOrphanedLocalVideos(mapped).catch((e) =>
            console.warn('[bring-any-idea-to-life] Orphaned local video migration pass failed', e)
          );
        }
      } catch (e) {
        console.error('Failed to load history from IndexedDB', e);
      }

      if (linkId) {
        try {
          const row = await loadCreationFromR2(linkId);
          const sharedCreation: Creation = {
            id: row.id,
            name: row.name || 'GON',
            html: row.html,
            originalImage: row.imageUrl || undefined,
            mimeType: row.mimeType || null,
            videoUrl: row.videoUrl || undefined,
            transcodedVideoUrl: row.transcodedVideoUrl || undefined,
            timestamp: new Date(row.timestamp || Date.now()),
          };
          setHistory((prev) => [sharedCreation, ...prev.filter((item) => item.id !== sharedCreation.id)]);
          setActiveCreation(sharedCreation);
          await putCreation({
            id: sharedCreation.id,
            name: sharedCreation.name,
            html: sharedCreation.html,
            originalImage: sharedCreation.originalImage,
            mimeType: sharedCreation.mimeType,
            videoUrl: sharedCreation.videoUrl,
            transcodedVideoUrl: sharedCreation.transcodedVideoUrl,
            timestamp: sharedCreation.timestamp.toISOString(),
          }).catch((error) => console.warn('[GON] Could not cache shared content locally:', error));
        } catch (error) {
          console.error('[GON] Could not open shared content:', error);
          const message = error instanceof Error ? error.message : String(error);
          window.alert(message);
        } finally {
          setIsGenerating(false);
          setLoadingLabel(undefined);
        }
        // Link chia sẻ (?linkid=...): item được yêu cầu đã hiển thị xong ở
        // trên — giờ nạp nốt TOÀN BỘ archive từ R2 CHẠY NỀN (không spinner,
        // không chặn UI) để khung chi tiết liệt kê/so sánh được các PHIÊN BẢN
        // khác cùng nguồn (v1..vn, xem thanh version trong LivePreview.tsx).
        // Trước đây nhánh này return luôn nên người nhận link chỉ thấy đúng 1
        // phiên bản, không so sánh được với các version còn lại.
        importR2Creations().catch((e) => console.warn('[GON] Background archive import failed (share link view):', e));
        return; // Direct share links show the requested item first; the archive hydrates silently in the background.
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
  const uploadSourceInBackground = (creation: Creation, file: File) => {
    uploadSourceFileToR2(creation.id, file)
      .then((uploaded) => {
        // Ảnh/PDF/video gốc đã có sẵn cục bộ (data URL) để hiển thị ngay từ
        // lúc tạo app — khi R2 upload xong, thay bằng URL R2 (nhẹ hơn nhiều
        // cho IndexedDB) nhưng không chặn hay ảnh hưởng gì tới creation đã hiển thị.
        patchCreation(creation.id, { originalImage: uploaded.publicUrl, r2ImageUrl: uploaded.publicUrl }).catch((e) =>
          console.warn('[bring-any-idea-to-life] Failed to patch IndexedDB with R2 source url', e)
        );
        setHistory((prev) => prev.map((c) => (c.id === creation.id ? { ...c, originalImage: uploaded.publicUrl } : c)));
        setActiveCreation((prev) => (prev && prev.id === creation.id ? { ...prev, originalImage: uploaded.publicUrl } : prev));
        // Update the shared JSON after upload so recipients get both the
        // original video/image and its generated app from one link.
        saveCreationToR2({
          id: creation.id,
          name: creation.name,
          html: creation.html,
          sourceUrl: uploaded.publicUrl,
          mimeType: creation.mimeType || file.type,
          videoUrl: creation.videoUrl,
          transcodedVideoUrl: creation.transcodedVideoUrl,
          timestamp: creation.timestamp.toISOString(),
        }).catch((error) => console.warn('[GON] Could not refresh shared source data:', error));
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

  const handleShareCreation = async (creation: Creation) => {
    let sourceUrl: string | undefined;
    let mimeType = creation.mimeType || undefined;
    const originalImage = creation.originalImage || '';
    const dataUrlMatch = originalImage.match(/^data:([^;]+);base64,/);
    if (dataUrlMatch) {
      mimeType = mimeType || dataUrlMatch[1];
      // Upload the original directly from the browser so large videos/PDFs do
      // not have to pass through the serverless JSON body size limit.
      const sourceBlob = await (await fetch(originalImage)).blob();
      const uploaded = await uploadSourceFileToR2(creation.id, sourceBlob);
      sourceUrl = uploaded.publicUrl;
    } else if (originalImage) {
      sourceUrl = originalImage;
    }

    const saved = await saveCreationToR2({
      id: creation.id,
      name: creation.name,
      html: creation.html,
      sourceUrl,
      mimeType,
      videoUrl: creation.videoUrl,
      transcodedVideoUrl: creation.transcodedVideoUrl,
      timestamp: creation.timestamp.toISOString(),
    });
    if (!saved?.jsonUrl) {
      throw new Error('Không lưu được nội dung GON lên đám mây nên chưa thể tạo link chia sẻ.');
    }
    await shareGonCreation(creation.id, creation.name);
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
      let frameImages: string[] | undefined;
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
          // Video: ƯU TIÊN thử Groq (miễn phí) TRƯỚC bằng cách trích vài khung
          // hình JPEG nhỏ ngay trên trình duyệt (canvas, không cần upload gì
          // cả — xem lib/videoFrames.ts). Chỉ khi việc trích khung hình thất
          // bại (codec lạ, video hỏng...) mới upload thẳng lên R2/Gemini Files
          // API như luồng cũ. Nếu Groq (dùng khung hình) sau đó lỗi hoàn toàn
          // ở bước gọi bringToLife(), catch bên dưới sẽ tự fallback sang
          // Gemini bằng chính uploadVideoFileToGemini() này.
          mimeType = rawMimeType;
          setLoadingLabel('Đang trích khung hình từ video...');
          try {
            const frames = await extractVideoFrames(file);
            frameImages = frames.map((f) => f.base64);
          } catch (frameErr) {
            console.warn('[bring-any-idea-to-life] Trích khung hình thất bại, dùng thẳng Gemini (upload video đầy đủ):', frameErr);
            setLoadingLabel('Đang tải video lên...');
            try {
              const uploaded = await uploadVideoFileToGemini(file);
              geminiFileUri = uploaded.uri;
              geminiFileMimeType = uploaded.mimeType;
              geminiKeyLabel = uploaded.geminiKeyLabel;
            } finally {
              setLoadingLabel('Đang phân tích và tạo app...');
            }
          }
          setLoadingLabel('Đang phân tích và tạo app...');
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

      let html: string;
      try {
        html = await bringToLife(promptText, imageBase64, mimeType, videoUrl, imageUrl, webUrl, geminiFileUri, geminiFileMimeType, geminiKeyLabel, frameImages);
      } catch (bringErr) {
        // Chỉ fallback tự động khi vừa thử bằng khung hình (Groq) cho video —
        // trường hợp này server KHÔNG có video gốc nên không tự chuyển sang
        // Gemini được (xem ghi chú trong bringAnyIdeaToLifeProxy.js). Ở đây
        // client tự upload nguyên video lên Gemini Files API rồi gọi lại.
        if (file && frameImages && frameImages.length > 0 && !geminiFileUri) {
          console.warn('[bring-any-idea-to-life] Groq (khung hình video) lỗi hoàn toàn, tự động chuyển sang Gemini (tải nguyên video):', bringErr);
          setLoadingLabel('Groq gặp sự cố, đang chuyển sang Gemini (tải video)...');
          const uploaded = await uploadVideoFileToGemini(file);
          geminiFileUri = uploaded.uri;
          geminiFileMimeType = uploaded.mimeType;
          geminiKeyLabel = uploaded.geminiKeyLabel;
          frameImages = undefined;
          setLoadingLabel('Đang phân tích và tạo app...');
          html = await bringToLife(promptText, imageBase64, mimeType, videoUrl, imageUrl, webUrl, geminiFileUri, geminiFileMimeType, geminiKeyLabel, undefined);
        } else {
          throw bringErr;
        }
      }

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
          uploadSourceInBackground(newCreation, file);
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

  // Nhãn hiển thị khi LỘ DANH TÍNH model sau vote (trước đó mọi thứ chỉ là
  // "Model A"/"Model B"). Tên lấy từ bảng ARENA_PROVIDER_INFO (lib/api.ts) —
  // nguồn chân lý DUY NHẤT của mọi engine arena, đổi ở đó thì ở đây tự khớp.
  const ARENA_ENGINE_LABELS = Object.fromEntries(
    ARENA_ENGINES.map((engine) => [engine, `${ARENA_PROVIDER_INFO[engine].label} (${ARENA_PROVIDER_INFO[engine].modelLabel})`]),
  ) as Record<ArenaEngine, string>;

  const newArenaState = (description: string, phase: ArenaState['phase'], videoUrls: string[], videoTitles: string[]): ArenaState => ({
    description,
    videoUrls,
    videoTitles,
    phase,
    searchError: null,
    sides: { a: { status: 'loading' }, b: { status: 'loading' } },
    mapping: { a: 'groq', b: 'gemini' }, // placeholder — random hoá lại lúc xác nhận đấu thật
    vote: null,
    voteSaved: false,
  });

  // Link thứ 2 (nếu có): server proxy chỉ "xem" trực tiếp 1 video URL, nên
  // link còn lại được ghép vào prompt text để CẢ 2 model cùng tham khảo —
  // giữ input giống hệt nhau giữa 2 bên cho phép so sánh công bằng.
  const buildArenaPrompt = (description: string, urls: string[]): string => {
    const extraLinks = urls.slice(1);
    return extraLinks.length
      ? `${description || ''}${description ? '\n\n' : ''}Additional reference video link(s) on the same topic (use as extra inspiration/context): ${extraLinks.join(', ')}`
      : description;
  };

  // Tìm video bằng text mô tả -> XONG chuyển sang phase CONFIRMING để user
  // xem trước + xác nhận, KHÔNG đấu ngay. Lỗi tìm kiếm -> quay lại confirming
  // kèm lỗi, GIỮ nguyên video cũ (nếu có) thay vì đóng mất arena.
  const startArenaSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    setArena((prev) => ({
      ...(prev ?? newArenaState(trimmed, 'searching', [], [])),
      description: trimmed,
      phase: 'searching' as const,
      searchError: null,
    }));
    try {
      const found = await searchVideoLinks(trimmed, 2);
      setArena((prev) =>
        prev
          ? {
              ...prev,
              phase: 'confirming' as const,
              videoUrls: found.map((video) => video.url),
              videoTitles: found.map((video) => video.title),
              searchError: null,
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setArena((prev) => (prev ? { ...prev, phase: 'confirming' as const, searchError: message } : prev));
    }
  };

  // Bắt đầu flow arena từ InputArea. DÙ user đã dán sẵn link hay chỉ nhập
  // text, cũng phải qua bước XEM TRƯỚC + XÁC NHẬN video (phase 'confirming')
  // trước khi 2 model thật sự chạy — yêu cầu owner: tránh đấu trên video sai.
  const handleArenaBattle = async (description: string, videoUrls: string[]) => {
    if (arena || isGenerating) return;
    setActiveCreation(null);
    if (videoUrls.length > 0) {
      setArena(newArenaState(description, 'confirming', videoUrls, []));
      return;
    }
    await startArenaSearch(description);
  };

  // Phase confirming, ô "Tìm lại / đổi video": TOÀN BỘ dòng đều là link video
  // hợp lệ thì dùng thẳng các link đó (xác nhận lại lần nữa); ngược lại coi
  // là mô tả mới và tìm bằng text.
  const handleArenaResearch = async (input: string) => {
    const lines = input.split('\n').map((line) => line.trim()).filter(Boolean);
    if (lines.length > 0 && lines.every((line) => Boolean(classifyVideoUrl(line)))) {
      if (lines.length > 2) {
        setArena((prev) => (prev ? { ...prev, searchError: 'Tối đa 2 link video mỗi lần đấu — hãy xoá bớt bớt rồi thử lại.' } : prev));
        return;
      }
      const urls = lines.map((line) => classifyVideoUrl(line)!.url);
      setArena((prev) => (prev ? { ...prev, phase: 'confirming' as const, videoUrls: urls, videoTitles: [], searchError: null } : prev));
      return;
    }
    await startArenaSearch(input);
  };

  // Chạy 1 bên của trận đấu. Dùng key của user (nếu vừa dán HOẶC đã giữ trong
  // sessionStorage từ lần retry trước) thay cho key pool server — xem
  // userApiKey trong lib/api.ts + bringAnyIdeaToLifeProxy.js.
  const runArenaSide = async (side: 'a' | 'b', engine: ArenaEngine, basePrompt: string, urls: string[], explicitUserApiKey?: string) => {
    try {
      const userApiKey = explicitUserApiKey || getSessionUserApiKey(engine);
      const html = await bringToLife(basePrompt, undefined, undefined, urls[0], undefined, undefined, undefined, undefined, undefined, undefined, engine, userApiKey);
      setArena((prev) => (prev ? { ...prev, sides: { ...prev.sides, [side]: { status: 'done', html } } } : prev));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[GON Arena] Engine "${engine}" (Model ${side.toUpperCase()}) failed:`, message);
      setArena((prev) => (prev ? { ...prev, sides: { ...prev.sides, [side]: { status: 'error', error: message } } } : prev));
    }
  };

  // User XÁC NHẬN video đúng -> bắt đầu đấu thật: random hoá vị trí A/B để
  // giữ so sánh MÙ, rồi bắn 2 request song song (mỗi bên ép đúng 1 engine).
  const handleArenaConfirmBattle = () => {
    if (!arena || arena.phase !== 'confirming' || arena.videoUrls.length === 0) return;
    const { description, videoUrls: urls } = arena;
    const aEngine: ArenaEngine = Math.random() < 0.5 ? 'groq' : 'gemini';
    const bEngine: ArenaEngine = aEngine === 'groq' ? 'gemini' : 'groq';
    const mapping: { a: ArenaEngine; b: ArenaEngine } = { a: aEngine, b: bEngine };

    setArena((prev) =>
      prev
        ? {
            ...prev,
            phase: 'battling' as const,
            mapping,
            sides: { a: { status: 'loading' }, b: { status: 'loading' } },
            vote: null,
            voteSaved: false,
            searchError: null,
          }
        : prev,
    );

    const basePrompt = buildArenaPrompt(description, urls);
    // Song song hoá thật sự — 2 request độc lập, bên nào xong trước hiện trước.
    runArenaSide('a', aEngine, basePrompt, urls);
    runArenaSide('b', bEngine, basePrompt, urls);
  };

  // Bên lỗi: user dán API key CỦA CHÍNH MÌNH để chạy lại. Engine (`engine`)
  // đã được ArenaDuel xác định sẵn: tự đoán từ prefix VỚI MỌI provider phổ
  // biến (xem detectEngineFromApiKey — gsk_=Groq, AIza=Gemini, sk-ant-=Claude,
  // sk-or-=OpenRouter, xai-=Grok, pplx-=Perplexity, hf_=HF...), hoặc user chọn
  // TAY ở dropdown khi key không có prefix riêng (DeepSeek sk-thuần, Mistral,
  // Together). Nếu engine KHÁC bên đang lỗi, bên đó đổi hẳn sang engine đó và
  // mapping cập nhật tương ứng — để lúc lộ danh tính vẫn trung thực.
  // Server (arenaUserKeyEngines.js) tự validate lại prefix/kiểm tra lần nữa.
  const handleArenaRetryWithKey = (side: 'a' | 'b', apiKey: string, engine: ArenaEngine) => {
    if (!arena || arena.phase !== 'battling') return;
    setSessionUserApiKey(engine, apiKey);
    setArena((prev) =>
      prev
        ? {
            ...prev,
            mapping: { ...prev.mapping, [side]: engine },
            sides: { ...prev.sides, [side]: { status: 'loading' } },
          }
        : prev,
    );
    runArenaSide(side, engine, buildArenaPrompt(arena.description, arena.videoUrls), arena.videoUrls, apiKey);
  };

  const handleArenaVote = (choice: ArenaVoteChoice) => {
    if (!arena || arena.vote) return; // chỉ vote 1 lần/trận
    const { mapping, description, videoUrls } = arena;
    setArena((prev) => (prev ? { ...prev, vote: choice } : prev));
    // Lưu vote ẩn danh lên R2 — fire-and-forget: lỗi lưu KHÔNG ảnh hưởng việc
    // lộ kết quả. Trận 2 bên TRÙNG ENGINE (mapping.a === mapping.b — xảy ra
    // khi user retry 1 bên bằng key cùng provider với bên kia, vd cả hai đều
    // chạy OpenAI) thì KHÔNG phải so sánh giữa 2 model khác nhau → bỏ ghi để
    // không làm bẩn thống kê.
    if (mapping.a === mapping.b) {
      setArena((prev) => (prev ? { ...prev, voteSaved: true } : prev));
      return;
    }
    recordArenaVote({
      vote: choice,
      modelA: mapping.a,
      modelB: mapping.b,
      description: description.slice(0, 500),
      videoUrls,
    })
      .then(() => setArena((prev) => (prev ? { ...prev, voteSaved: true } : prev)))
      .catch((err) => {
        console.warn('[GON Arena] Không lưu được vote lên R2 (kết quả hiển thị không bị ảnh hưởng):', err?.message || err);
        setArena((prev) => (prev ? { ...prev, voteSaved: true } : prev));
      });
  };

  // "Dùng phiên bản này": chuyển phiên bản được chọn thành 1 creation bình
  // thường trong lịch sử GON (IndexedDB + R2) rồi mở ở LivePreview đầy đủ.
  const handleArenaUseVersion = (side: 'a' | 'b') => {
    if (!arena) return;
    const sideState = arena.sides[side];
    if (sideState.status !== 'done' || !sideState.html) return;
    const engine = arena.mapping[side];
    const baseName = (arena.description || arena.videoUrls[0] || 'GON Arena').slice(0, 120) || 'GON Arena';
    const newCreation: Creation = {
      id: crypto.randomUUID(),
      name: `${baseName} • ${ARENA_ENGINE_LABELS[engine].split(' ')[0]}`,
      html: sideState.html,
      mimeType: null,
      videoUrl: arena.videoUrls[0],
      timestamp: new Date(),
    };
    setActiveCreation(newCreation);
    setHistory((prev) => [newCreation, ...prev]);
    persistCreation(newCreation, undefined, undefined, undefined);
    setArena(null);
  };

  const handleArenaClose = () => setArena(null);

  // Nhãn lộ danh tính model — CHỈ tính sau khi đã vote (giữ so sánh mù).
  const arenaRevealedLabels = arena && arena.vote
    ? { a: ARENA_ENGINE_LABELS[arena.mapping.a], b: ARENA_ENGINE_LABELS[arena.mapping.b] }
    : null;

  // Các phiên bản CÙNG NGUỒN với creation đang mở — dùng ĐÚNG hàm gom nhóm
  // của Archive (getCreationSourceKey trong CreationHistory.tsx) nên thứ tự
  // và cách đánh số v1..vn khớp 100% với thẻ trong Archive (mới nhất đứng
  // đầu, đánh số vn). LivePreview dùng danh sách này cho thanh chuyển
  // version + chế độ so sánh 2 phiên bản song song.
  const activeVersions: Creation[] = (() => {
    if (!activeCreation) return [];
    const key = getCreationSourceKey(activeCreation);
    const siblings = history.filter((item) => getCreationSourceKey(item) === key);
    // Creation vừa tạo xong (chưa kịp ghi IndexedDB/persist có thể trễ 1
    // nhịp) đôi khi chưa có trong history — bảo đảm bản thân nó luôn có mặt.
    if (!siblings.some((item) => item.id === activeCreation.id)) siblings.push(activeCreation);
    return siblings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  })();

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

  // Gọi từ LivePreview.tsx SAU KHI đã chuyển mã (ffmpeg.wasm, client-side)
  // VÀ upload xong bản MP4 lên R2 — chỉ cần lưu lại thêm 1 field
  // transcodedVideoUrl, KHÔNG đụng tới originalImage/html/... nên dùng
  // patchCreation (partial update) thay vì putCreation (ghi đè toàn bộ) để
  // không lỡ tay xoá mất field khác đã lưu trước đó (vd r2ImageUrl/r2JsonUrl).
  const handleTranscodedVideoUploaded = async (creation: Creation, publicUrl: string) => {
    setActiveCreation((prev) => (prev && prev.id === creation.id ? { ...prev, transcodedVideoUrl: publicUrl } : prev));
    setHistory((prev) => prev.map((item) => (item.id === creation.id ? { ...item, transcodedVideoUrl: publicUrl } : item)));
    await patchCreation(creation.id, { transcodedVideoUrl: publicUrl });
    await saveCreationToR2({
      id: creation.id,
      name: creation.name,
      html: creation.html,
      sourceUrl: creation.originalImage && !creation.originalImage.startsWith('data:') ? creation.originalImage : undefined,
      mimeType: creation.mimeType || undefined,
      videoUrl: creation.videoUrl,
      transcodedVideoUrl: publicUrl,
      timestamp: creation.timestamp.toISOString(),
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
  // Arena là overlay riêng (ArenaDuel) nên KHÔNG tính vào isFocused (vốn điều
  // khiển LivePreview) — chỉ dùng để làm mờ/khoá nội dung phía sau.
  const isDimmed = isFocused || Boolean(arena);

  return (
    <div className="h-[100dvh] bg-zinc-950 bg-dot-grid text-zinc-50 selection:bg-blue-500/30 overflow-y-auto overflow-x-hidden relative flex flex-col">

      {/* Centered Content Container */}
      <div
        className={`
          min-h-full flex flex-col w-full max-w-[96rem] mx-auto px-4 sm:px-6 relative z-10
          transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1)
          ${isDimmed
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
              <InputArea onGenerate={handleGenerate} onBattle={handleArenaBattle} isGenerating={isGenerating} disabled={isDimmed} />
          </div>

          {/* 2b. Demo template gallery — xem ngay các mẫu có sẵn, không cần AI */}
          <DemoTemplates onSelect={handleSelectDemo} disabled={isDimmed} />

          {/* 2c. One Shot Arcade — mini-game AI thật, tách riêng khỏi gallery ở trên */}
          <OneShotArcadeCard onSelect={handleOpenOneShotArcade} disabled={isDimmed} />

        </div>
        
        {/* 3. History Section & Footer - Stays at bottom */}
        <div className="flex-shrink-0 pb-6 w-full mt-auto flex flex-col items-center gap-6">
            <div className="w-full px-2 md:px-0">
                <CreationHistory history={history} onSelect={handleSelectCreation} onLoadR2={handleLoadR2History} isLoadingR2={isLoadingR2History} onShare={handleShareCreation} />
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
        onTranscodedVideoUploaded={handleTranscodedVideoUploaded}
        onDeleteUploadedSource={handleDeleteUploadedSource}
        onRegenerateFromUploadedSource={handleRegenerateFromUploadedSource}
        onCreateFromLink={handleCreateFromLink}
        onShare={handleShareCreation}
        versions={activeVersions}
        onSelectVersion={handleSelectCreation}
      />

      {/* GON Arena — overlay đấu trường 2 model AI ẩn danh (song song với
          LivePreview, chỉ mount khi có trận). */}
      {arena && (
        <ArenaDuel
          description={arena.description}
          videoUrls={arena.videoUrls}
          videoTitles={arena.videoTitles}
          phase={arena.phase}
          searchError={arena.searchError}
          sides={arena.sides}
          vote={arena.vote}
          voteSaved={arena.voteSaved}
          revealedLabels={arenaRevealedLabels}
          onVote={handleArenaVote}
          onUseVersion={handleArenaUseVersion}
          onConfirmBattle={handleArenaConfirmBattle}
          onResearch={handleArenaResearch}
          onRetryWithKey={handleArenaRetryWithKey}
          onClose={handleArenaClose}
        />
      )}

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