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

export async function bringToLife(
  prompt: string,
  fileBase64?: string,
  mimeType?: string,
  videoUrl?: string,
  imageUrl?: string,
  webUrl?: string
): Promise<string> {
  const isVideoFile = Boolean(mimeType?.toLowerCase().startsWith('video/'));

  // Strong directive for file/video/image-link-only inputs with emphasis on NO external images
  const finalPrompt = videoUrl || isVideoFile
    ? 'Watch this video. Identify the key subject, action, process, or steps shown across it (not just one frame). If it is a tutorial/demo, turn it into an interactive step-by-step walkthrough or simulator of that process. If it is a real-world scene or activity, gamify it (e.g., a themed mini-game) or build a utility inspired by it. Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate any visuals using CSS, SVGs, or Emojis.'
    : fileBase64 || imageUrl
      ? 'Analyze this image/document. Detect what functionality is implied. If it is a real-world object (like a desk), gamify it (e.g., a cleanup game). Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate the visuals using CSS, SVGs, or Emojis.'
      : webUrl
        ? 'Analyze the linked webpage/channel/homepage content and turn its main idea, brand, sections, or workflow into a fully interactive web app. If the page is sparse, infer a useful app from the URL and available text. IMPORTANT: Do NOT use external image URLs. Recreate visuals using CSS, SVGs, or Emojis.'
        : prompt || 'Create a demo app that shows off your capabilities.';

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
