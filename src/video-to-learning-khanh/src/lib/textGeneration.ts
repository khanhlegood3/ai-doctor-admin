// Trước đây gọi thẳng @google/genai từ trình duyệt bằng VITE_GEMINI_API_KEY
// — KHÔNG an toàn vì biến VITE_ bị Vite nhúng thẳng vào file JS công khai,
// ai mở DevTools cũng lấy được key. Giờ gọi qua proxy server-side dùng
// chung endpoint /api/groq-proxy (field `provider: 'video-to-learning'`,
// xem api/_lib/videoToLearningProxy.js) — key chỉ tồn tại trên server.
//
// CẬP NHẬT: server giờ dùng transcript YouTube (miễn phí) + Groq (miễn
// phí) thay vì Gemini (trả phí), nên không còn cần chọn modelName nữa.

interface GenerateTextOptions {
  prompt: string;
  videoUrl?: string;
  // Link trang web (không phải YouTube) — thay cho videoUrl, xem
  // runPageToLearningGenerate() trong api/_lib/videoToLearningProxy.js.
  // Chỉ truyền MỘT trong hai (videoUrl HOẶC pageUrl), không truyền cả 2.
  pageUrl?: string;
}

interface GenerateTextResult {
  text: string;
  // 'groq-transcript' | 'groq-page' | 'gemini-fallback' | undefined (bước sinh code, không gắn nguồn)
  source?: string;
  pageTitle?: string;
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  return (await generateTextWithMeta(options)).text;
}

// Bản đầy đủ trả thêm `source`/`pageTitle` — dùng khi cần lưu lịch sử (biết
// AI nào đã trả lời) thay vì chỉ cần text như generateText() cũ.
export async function generateTextWithMeta(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const { prompt, videoUrl, pageUrl } = options;

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'video-to-learning',
      prompt,
      videoUrl,
      pageUrl,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  }

  return { text: data.text ?? '', source: data.source, pageTitle: data.pageTitle };
}
