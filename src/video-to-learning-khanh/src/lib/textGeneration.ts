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
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  const { prompt, videoUrl } = options;

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'video-to-learning',
      prompt,
      videoUrl,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  }

  return data.text ?? '';
}
