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
  imageUrl?: string
): Promise<string> {
  const isVideoFile = Boolean(mimeType?.toLowerCase().startsWith('video/'));

  // Strong directive for file/video/image-link-only inputs with emphasis on NO external images
  const finalPrompt = videoUrl || isVideoFile
    ? 'Watch this video. Identify the key subject, action, process, or steps shown across it (not just one frame). If it is a tutorial/demo, turn it into an interactive step-by-step walkthrough or simulator of that process. If it is a real-world scene or activity, gamify it (e.g., a themed mini-game) or build a utility inspired by it. Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate any visuals using CSS, SVGs, or Emojis.'
    : fileBase64 || imageUrl
      ? 'Analyze this image/document. Detect what functionality is implied. If it is a real-world object (like a desk), gamify it (e.g., a cleanup game). Build a fully interactive web app. IMPORTANT: Do NOT use external image URLs. Recreate the visuals using CSS, SVGs, or Emojis.'
      : prompt || 'Create a demo app that shows off your capabilities.';

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'bring-any-idea-to-life',
      prompt: finalPrompt,
      fileBase64,
      mimeType,
      videoUrl,
      imageUrl,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Bring Any Idea to Life proxy error (${res.status})`);
  }
  if (typeof data?.html !== 'string') {
    throw new Error('No html returned from Bring Any Idea to Life proxy');
  }

  return data.html;
}
