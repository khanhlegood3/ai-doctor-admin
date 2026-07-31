import { FinishReason, GoogleGenAI } from '@google/genai';

// Dùng chung biến môi trường VITE_GEMINI_API_KEY như các panel khác của dự án
// (xem AffiliateSystemControlPanel.jsx) thay vì process.env.GEMINI_API_KEY
// của bản AI Studio gốc — vì đây là app Vite chạy trong trình duyệt.
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

interface GenerateTextOptions {
  modelName: string;
  prompt: string;
  videoUrl?: string;
  temperature?: number;
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  const { modelName, prompt, videoUrl, temperature = 0.75 } = options;

  if (!GEMINI_API_KEY) {
    throw new Error('Thiếu VITE_GEMINI_API_KEY. Vui lòng cấu hình trong file .env.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const parts: any[] = [{ text: prompt }];

  if (videoUrl) {
    parts.push({
      fileData: {
        mimeType: 'video/mp4',
        fileUri: videoUrl,
      },
    });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents: [{ role: 'user', parts }],
    config: { temperature },
  });

  if (response.promptFeedback?.blockReason) {
    throw new Error(`Nội dung bị chặn (lý do: ${response.promptFeedback.blockReason})`);
  }

  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('Không có kết quả trả về từ mô hình.');
  }

  const firstCandidate = response.candidates[0];
  if (firstCandidate.finishReason && firstCandidate.finishReason !== FinishReason.STOP) {
    if (firstCandidate.finishReason === FinishReason.SAFETY) {
      throw new Error('Nội dung bị chặn do cài đặt an toàn.');
    }
    throw new Error(`Dừng vì lý do: ${firstCandidate.finishReason}.`);
  }

  return response.text ?? '';
}
