// Trước đây gọi thẳng @google/genai từ trình duyệt bằng VITE_GEMINI_API_KEY
// — KHÔNG an toàn vì biến VITE_ bị Vite nhúng thẳng vào file JS công khai,
// ai mở DevTools cũng lấy được key. Giờ gọi qua proxy server-side dùng
// chung endpoint /api/groq-proxy (field `provider: 'video-to-learning'`,
// xem api/_lib/videoToLearningProxy.js) — key GEMINI_API_KEY chỉ tồn tại
// trên server, client không bao giờ thấy.

interface GenerateTextOptions {
  modelName: string;
  prompt: string;
  videoUrl?: string;
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  const { modelName, prompt, videoUrl } = options;

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'video-to-learning',
      modelName,
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
