// src/video-to-learning-khanh/src/lib/imageToCode.ts
// Client cho tính năng "Ảnh → Sketch tương tác" (chuyển thể từ
// image-to-code.zip, gắn vào làm 1 loại item mới ('image') trong hàng đợi
// của Video to Learning — xem App.tsx). Gọi qua endpoint dùng chung
// /api/groq-proxy (field provider: 'image-to-code', xem
// api/_lib/imageToCodeProxy.js) — KHÔNG gọi thẳng @google/genai với key
// nhúng client như bản gốc AI Studio (process.env.GEMINI_API_KEY).

export interface GenerateImageToCodeOptions {
  imageBase64: string; // base64 THUẦN, không kèm tiền tố "data:...;base64,"
  mimeType: string;
  userInput?: string;
}

export interface GenerateImageToCodeResult {
  spec: string; // ghi chú suy luận (hành vi, thuật toán, bố cục) — hiện ở tab "Spec"
  code: string; // 1 trang HTML tự chứa (nhúng p5.js qua CDN) — hiện ở tab "Xem trước"/"Mã HTML"
  source?: string; // 'groq' | 'gemini-fallback'
}

export async function generateImageToCode(options: GenerateImageToCodeOptions): Promise<GenerateImageToCodeResult> {
  const { imageBase64, mimeType, userInput } = options;

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'image-to-code',
      imageBase64,
      mimeType,
      userInput,
    }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  }

  return { spec: data.spec ?? '', code: data.code ?? '', source: data.source };
}

/** Đọc 1 File ảnh thành base64 thuần (không tiền tố data URL) + mimeType. */
export function readImageFileAsBase64(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve({ base64, mimeType: file.type || 'image/jpeg', dataUrl });
    };
    reader.onerror = () => reject(reader.error || new Error('Không đọc được file ảnh.'));
    reader.readAsDataURL(file);
  });
}
