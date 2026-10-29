/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// ĐÃ ĐỔI: bản gốc (services/gemini.ts trong bring-any-idea-to-life.zip) gọi
// thẳng @google/genai với API key nhúng client (process.env.API_KEY) —
// không an toàn để deploy thật. Ở đây gọi qua Serverless Function
// /api/groq-proxy (provider: 'bring-any-idea-to-life') — server dùng
// GEMINI_API_KEY thật (biến môi trường, không lộ ra client) để gọi Gemini 3
// Pro thật, vì tính năng cốt lõi (đọc ảnh/PDF rồi sinh 1 trang HTML/JS hoàn
// chỉnh, tương tác được) cần một model đủ mạnh cho coding phức tạp — xem
// api/_lib/bringAnyIdeaToLifeProxy.js. System instruction + logic chọn
// prompt giữ nguyên từ bản gốc, chỉ chuyển sang chạy phía server.

export type UploadedGeminiVideoFile = {
  uri: string;
  mimeType: string;
  // Nhãn biến môi trường của key ĐÃ upload file này lên Gemini Files API
  // (vd 'GEMINI_API_KEY2') — file chỉ tồn tại trong tài khoản của đúng key
  // này, nên các bước sau (poll trạng thái, rồi generate) phải gọi lại
  // CHÍNH XÁC key này thay vì để server tự dò/đua key khác (sẽ báo lỗi
  // "not found" giả). Xem api/_lib/bringAnyIdeaToLifeProxy.js.
  geminiKeyLabel?: string;
};

// Video LỚN (upload trực tiếp, không phải link YouTube/Facebook): thay vì
// nhồi base64 vào JSON body của /api/groq-proxy (giới hạn cứng ~4.5MB body
// của Vercel Serverless Function, buộc client trước đây phải chặn video ở
// mức 3MB — xem MAX_UNCOMPRESSED_FILE_BYTES trong lib/imageCompress.ts),
// upload thẳng lên R2 rồi để SERVER đẩy tiếp sang Gemini Files API — giống
// hệt luồng đã dùng ở video-analyzer-khanh/src/lib/api.ts. Video sau khi
// upload xong sẽ không còn bị giới hạn 3MB, chỉ còn giới hạn thực tế của R2
// + Gemini Files API (hàng trăm MB), và không còn cần gọi hàm này cho ảnh/
// PDF nhỏ — chỉ áp dụng cho file video.
export async function uploadVideoFileToGemini(file: File): Promise<UploadedGeminiVideoFile> {
  const mimeType = file.type || 'video/mp4';

  const initRes = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'bring-any-idea-to-life-video-upload', action: 'init', mimeType }),
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    throw new Error(initData?.error || `Không tạo được URL upload video (${initRes.status})`);
  }
  const { uploadUrl, publicUrl } = initData;

  const r2Res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType },
    body: file,
  });
  if (!r2Res.ok) {
    throw new Error(`Upload video lên R2 thất bại (${r2Res.status})`);
  }

  const uploadRes = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'bring-any-idea-to-life-video-upload',
      action: 'uploadToGemini',
      publicUrl,
      mimeType,
      displayName: file.name,
    }),
  });
  let fileResource = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    throw new Error(fileResource?.error || `Gemini không nhận được video (${uploadRes.status})`);
  }

  while (fileResource.state === 'PROCESSING') {
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const checkRes = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: 'bring-any-idea-to-life-video-upload',
        action: 'checkFile',
        fileName: fileResource.name,
        // Gọi lại ĐÚNG key đã upload file này (xem ghi chú UploadedGeminiVideoFile
        // ở trên) — nếu thiếu (client/response cũ chưa có), server sẽ tự dò
        // tuần tự như trước, vẫn hoạt động nhưng chậm hơn 1 chút.
        geminiKeyLabel: fileResource.geminiKeyLabel,
      }),
    });
    fileResource = await checkRes.json().catch(() => ({}));
    if (!checkRes.ok) {
      throw new Error(fileResource?.error || `Không kiểm tra được trạng thái video (${checkRes.status})`);
    }
  }
  if (fileResource.state === 'FAILED') {
    throw new Error('Gemini xử lý video thất bại. Hãy thử video khác.');
  }

  return { uri: fileResource.uri, mimeType: fileResource.mimeType || mimeType, geminiKeyLabel: fileResource.geminiKeyLabel };
}

export async function bringToLife(
  prompt: string,
  fileBase64?: string,
  mimeType?: string,
  videoUrl?: string,
  imageUrl?: string,
  webUrl?: string,
  geminiFileUri?: string,
  geminiFileMimeType?: string,
  geminiKeyLabel?: string,
  // Vài khung hình JPEG nhỏ đã trích SẴN ở client (xem lib/videoFrames.ts) từ
  // video upload trực tiếp — cho phép server thử Groq (miễn phí) TRƯỚC cho cả
  // video, chỉ dùng Gemini khi Groq lỗi hoàn toàn (App.tsx tự fallback bằng
  // cách gọi lại bringToLife với geminiFileUri sau khi bắt được lỗi này).
  frameImages?: string[],
  // Chế độ GON ARENA (xem components/ArenaDuel.tsx): ép server chạy ĐÚNG 1
  // engine ('groq' | 'gemini') thay vì chuỗi fallback tự động — để 2 request
  // song song từ cùng 1 input luôn là 2 model khác nhau thật sự.
  engine?: ArenaEngine,
  // Arena: API key CỦA CHÍNH USER khi engine mặc định lỗi (xem
  // detectEngineFromApiKey/sessionStorage helpers ở cuối file) — server dùng
  // cho đúng request này rồi quên, KHÔNG lưu/log.
  userApiKey?: string
): Promise<string> {
  const isVideoFile = Boolean(mimeType?.toLowerCase().startsWith('video/'));

  // Strong directive for file/video/image-link-only inputs with emphasis on NO external images.
  // Khi người dùng NHẬP KÈM mô tả (chế độ Arena: "mô tả + link video"), ghép
  // mô tả đó vào SAU directive thay vì bỏ rơi — trước đây prompt text bị thay
  // thế hoàn toàn bởi directive mỗi khi có videoUrl/file/URL, khiến mô tả của
  // người dùng không bao giờ tới được model. Với các luồng cũ (prompt = "")
  // kết quả vẫn y hệt như trước.
  const baseDirective = videoUrl || isVideoFile
    ? 'Watch this video. Identify the key subject, action, process, or steps shown across it (not just one frame). If it is a tutorial/demo, turn it into an interactive step-by-step walkthrough or simulator of that process. If it is a real-world scene or activity, gamify it (e.g., a themed mini-game) or build a utility inspired by it. Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate any visuals using CSS, SVGs, or Emojis.'
    : fileBase64 || imageUrl
      ? 'Analyze this image/document. Detect what functionality is implied. If it is a real-world object (like a desk), gamify it (e.g., a cleanup game). Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate the visuals using CSS, SVGs, or Emojis.'
      : webUrl
        ? 'Analyze the linked webpage/channel/homepage content and turn its main idea, brand, sections, or workflow into a fully interactive web app. If the page is sparse, infer a useful app from the URL and available text. IMPORTANT: Do NOT use external image URLs. Recreate visuals using CSS, SVGs, or Emojis.'
        : '';
  const userNote = prompt?.trim();
  const finalPrompt = baseDirective
    ? userNote
      ? `${baseDirective}\n\nADDITIONAL USER REQUIREMENTS/DESCRIPTION (prioritize these when shaping the app):\n${userNote}`
      : baseDirective
    : userNote || 'Create a demo app that shows off your capabilities.';

  const ENDPOINT = '/api/groq-proxy';
  const PROVIDER = 'bring-any-idea-to-life';

  // Log rõ đang gọi API nào TRƯỚC khi gửi request, để dễ debug khi trang bị
  // treo/chậm (server thật sự chạy Groq qwen/qwen3.6-27b trước, fallback
  // Gemini gemini-3.6-flash nếu Groq lỗi — xem api/_lib/bringAnyIdeaToLifeProxy.js).
  console.log(`[bringToLife] Calling ${ENDPOINT} (provider: "${PROVIDER}")`, {
    hasFile: Boolean(fileBase64),
    mimeType,
    hasVideoUrl: Boolean(videoUrl),
    hasImageUrl: Boolean(imageUrl),
    hasWebUrl: Boolean(webUrl),
    frameImagesCount: frameImages?.length || 0,
    forcedEngine: engine || undefined, // chỉ có ở chế độ GON Arena
    hasUserApiKey: Boolean(userApiKey), // KHÔNG bao giờ log giá trị key
  });

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: PROVIDER,
        prompt: finalPrompt,
        fileBase64,
        mimeType,
        videoUrl,
        imageUrl,
        webUrl,
        geminiFileUri,
        geminiFileMimeType,
        geminiKeyLabel,
        frameImages,
        engine,
        userApiKey,
      }),
    });
  } catch (networkErr) {
    // fetch() ném lỗi khi mất mạng / CORS / server không phản hồi được request
    // (khác với lỗi HTTP status, được bắt ở nhánh !res.ok bên dưới).
    console.error(`[bringToLife] Network error calling ${ENDPOINT} (provider: "${PROVIDER}"):`, networkErr);
    throw new Error(`Không kết nối được tới ${ENDPOINT} (provider: "${PROVIDER}"): ${(networkErr as Error)?.message || 'network error'}`);
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    let realError = data?.error;
    if (!realError) {
      if (res.status === 504 || res.status === 502 || res.status === 503) {
        // Không phải lỗi có JSON body từ code của mình — đây là Vercel Gateway
        // TỰ CẮT NGANG function trước khi nó kịp trả response (function chạy
        // quá thời gian nền tảng cho phép), nên data.error rỗng. KHÔNG liên
        // quan gì tới việc upload R2 (R2 chỉ chạy nền, sau khi tạo app thành
        // công — xem persistCreation() trong App.tsx).
        realError =
          `Server xử lý quá lâu và bị nền tảng Vercel cắt ngang (Gateway Timeout ${res.status}). ` +
          `Thường do model AI (Groq/Gemini) phản hồi chậm, hoặc file/video đầu vào quá lớn/dài. ` +
          `Hãy thử lại, dùng ảnh/video ngắn gọn hơn, hoặc đợi ít phút rồi thử lại.`;
      } else {
        realError = `HTTP ${res.status} ${res.statusText}`;
      }
    }
    console.error(`[bringToLife] ${ENDPOINT} (provider: "${PROVIDER}") returned error [status ${res.status}]:`, realError);
    throw new Error(`[${PROVIDER}] ${realError}`);
  }
  if (typeof data?.html !== 'string') {
    console.error(`[bringToLife] ${ENDPOINT} (provider: "${PROVIDER}") returned no html. Full response:`, data);
    throw new Error(`[${PROVIDER}] No html returned from proxy (response had no "html" field)`);
  }

  console.log(`[bringToLife] Success via ${ENDPOINT} (provider: "${PROVIDER}", source: "${data?.source || 'unknown'}")`);

  return data.html;
}

// ---------------------------------------------------------------------------
// GON ARENA — so sánh ẩn danh 2 model AI (Groq vs Gemini) kiểu arena.ai
// ---------------------------------------------------------------------------

// Engine bị ép phía server cho TỪNG request arena (xem comment tham số
// `engine` của bringToLife ở trên, và forcedEngine trong
// api/_lib/bringAnyIdeaToLifeProxy.js).
export type ArenaEngine = 'groq' | 'gemini';

export type FoundVideoLink = { url: string; title: string };

// Tìm tối đa `limit` link video YouTube phù hợp với text mô tả (server scrape
// trang kết quả YouTube — không cần YOUTUBE_API_KEY, xem
// api/_lib/youtubeSearchScrape.js). Arena giới hạn TỐI ĐA 2 link/lần.
export async function searchVideoLinks(query: string, limit = 2): Promise<FoundVideoLink[]> {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'bring-any-idea-to-life-video-search', query, limit }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(data?.error || `Không tìm được video (HTTP ${res.status})`);
  }
  const videos: FoundVideoLink[] = (Array.isArray(data?.videos) ? data.videos : [])
    .map((v: any) => ({ url: String(v?.url || ''), title: String(v?.title || 'Video') }))
    .filter((v: FoundVideoLink) => v.url)
    .slice(0, limit);
  if (videos.length === 0) {
    throw new Error('Không tìm thấy video nào phù hợp với mô tả.');
  }
  return videos;
}

// Ghi vote ẩn danh của 1 trận đấu lên R2 (xem api/_lib/gonArenaVotesR2.js).
// Phía caller dùng kiểu fire-and-forget — lỗi lưu vote KHÔNG ảnh hưởng việc
// hiển thị kết quả đấu.
export async function recordArenaVote(payload: {
  vote: 'a' | 'b' | 'tie';
  modelA: ArenaEngine;
  modelB: ArenaEngine;
  description?: string;
  videoUrls?: string[];
}): Promise<void> {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'bring-any-idea-to-life-arena-vote', action: 'record', ...payload }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({} as any));
    throw new Error(data?.error || `Không ghi được vote (HTTP ${res.status})`);
  }
}

// --- Arena + API key của chính user (khi engine server-side lỗi) -----------

// Đoán model AI từ FORMAT TIỀN TỐ của API key user dán vào:
//   - Groq (console.groq.com): key bắt đầu bằng "gsk_"
//   - Gemini (Google AI Studio / GCP): key bắt đầu bằng "AIza"
// Server (bringAnyIdeaToLifeProxy.js) cũng tự validate lại prefix này trước
// khi dùng, nên 2 phía luôn khớp nhau.
export function detectEngineFromApiKey(key: string): ArenaEngine | null {
  const trimmed = key.trim();
  if (trimmed.startsWith('gsk_')) return 'groq';
  if (trimmed.startsWith('AIza')) return 'gemini';
  return null;
}

// Giữ key của user ĐỂ DÙNG TIẾP trong phiên — sessionStorage (tự xoá khi đóng
// tab), TUYỆT ĐỐI KHÔNG localStorage (sống sót sau đóng trình duyệt) và cũng
// không gửi lên R2/history/vote (không lưu Database/Cloud — yêu cầu owner).
const USER_KEY_SESSION_PREFIX = 'gon-arena-user-api-key:';

export function getSessionUserApiKey(engine: ArenaEngine): string | undefined {
  try {
    const value = window.sessionStorage.getItem(USER_KEY_SESSION_PREFIX + engine);
    return value || undefined;
  } catch {
    return undefined;
  }
}

export function setSessionUserApiKey(engine: ArenaEngine, key: string): void {
  try {
    window.sessionStorage.setItem(USER_KEY_SESSION_PREFIX + engine, key.trim());
  } catch {
    // sessionStorage bị chặn (private mode...) — key chỉ dùng cho lần retry đó
  }
}
