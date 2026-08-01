// api/_lib/inbodyOcr.js
// Logic OCR thật dùng chung cho luồng "Convert InBody Image → .CSV".
// Được import bởi:
//   - api/inbody-analyze.js  → Vercel Serverless Function (production)
//   - vite.config.js         → middleware dev-server, để `npm run dev` cũng
//     gọi Claude Vision thật, không cần deploy lên Vercel mới test được.
//
// Tách logic ra đây để 2 nơi trên không bị lệch nhau (cùng 1 system prompt,
// cùng 1 cách build request, cùng 1 cách parse JSON trả về).

import Anthropic from '@anthropic-ai/sdk';
import { withApiKeyRotation } from './apiKeyPool.js';

export const INBODY_OCR_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích kết quả InBody (máy đo thành phần cơ thể).
Khi nhận ảnh/PDF kết quả InBody, hãy:
1. Đọc thật kỹ và trích xuất CHÍNH XÁC các chỉ số có trên phiếu in: Cân nặng, Cơ bắp (SMM/Khối lượng cơ xương), Khối lượng mỡ trong cơ thể, Tỷ lệ mỡ cơ thể (%), BMI, Tỷ lệ trao đổi chất cơ bản (BMR), Điểm InBody, Lượng nước trong cơ thể (%), Mỡ nội tạng (Level), Protein, Khoáng chất — nếu ảnh không hiển thị chỉ số nào thì BỎ QUA chỉ số đó trong "metrics", KHÔNG tự đoán hay bịa số.
2. Đưa ra nhận xét ngắn gọn (2-3 câu) về tình trạng sức khỏe dựa trên số liệu đọc được.
3. Gợi ý cải thiện cụ thể (tập luyện, dinh dưỡng).
4. Tính XP gamification dựa trên thay đổi so với lần đo trước (nếu có dữ liệu trước đó được cung cấp).

CHỈ trả lời bằng JSON hợp lệ (không kèm lời dẫn, không kèm markdown \`\`\`), đúng cấu trúc:
{
  "summary": "Nhận xét tổng quan 2-3 câu",
  "metrics": {
    "Cân nặng": "68.4",
    "Cơ bắp": "29.8",
    "Khối lượng mỡ": "21.0",
    "Mỡ (%)": "22.1",
    "Nước (%)": "54.3",
    "BMI": "23.1",
    "BMR": "1500",
    "Điểm InBody": "72",
    "Mỡ nội tạng": "9",
    "Protein": "10.2",
    "Khoáng chất": "3.6"
  },
  "tags": [
    { "label": "Cơ bắp tốt ▲", "type": "ok" },
    { "label": "Mỡ cần cải thiện", "type": "warn" },
    { "label": "BMI bình thường", "type": "info" }
  ],
  "recommendations": ["Tập resistance training 3x/tuần", "Giảm carb buổi tối"],
  "xp_earned": 80,
  "inbody_score": 72
}`;

/**
 * Gọi Claude Vision để OCR thật một ảnh kết quả InBody.
 *
 * KEY POOL / AUTO-ROTATION: nếu ANTHROPIC_API_KEY đang dùng hết hạn mức/
 * billing (401/402/429), tự động thử ANTHROPIC_API_KEY1, ANTHROPIC_API_KEY2,
 * ... (xem api/_lib/apiKeyPool.js) thay vì báo lỗi ngay cho người dùng.
 *
 * @param {object} params
 * @param {string} params.image - ảnh dạng base64 (không kèm prefix data:...)
 * @param {string} [params.mediaType] - ví dụ 'image/jpeg', 'image/png'
 * @param {object} [params.previousRecord] - lần đo trước, để Claude so sánh
 * @param {Record<string,string>} [params.envSource] - nguồn biến môi trường
 *   (mặc định process.env; truyền `env` từ loadEnv() khi gọi từ dev-server)
 * @returns {Promise<object>} analysis JSON: { summary, metrics, tags, recommendations, xp_earned, inbody_score }
 */
export async function runInbodyOcr({ image, mediaType, previousRecord, envSource }) {
  if (!image) {
    const err = new Error('Thiếu dữ liệu ảnh để OCR.');
    err.code = 'NO_IMAGE';
    throw err;
  }

  const userContent = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType || 'image/jpeg',
        data: image,
      },
    },
    {
      type: 'text',
      text: previousRecord
        ? `Đây là kết quả InBody mới nhất. Kết quả lần trước: ${JSON.stringify(previousRecord)}. Hãy phân tích và so sánh.`
        : 'Đây là ảnh phiếu kết quả InBody. Hãy đọc và trích xuất chính xác các chỉ số có trên ảnh.',
    },
  ];

  let response;
  try {
    response = await withApiKeyRotation('ANTHROPIC_API_KEY', async (apiKey) => {
      const client = new Anthropic({ apiKey });
      return client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: INBODY_OCR_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });
    }, { envSource });
  } catch (err) {
    if (err?.status === 501) {
      const wrapped = new Error('Server chưa cấu hình ANTHROPIC_API_KEY — không thể chạy OCR thật.');
      wrapped.code = 'NO_API_KEY';
      throw wrapped;
    }
    throw err;
  }

  const rawText = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');

  try {
    const cleaned = rawText.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return { ...parsed, metrics: parsed.metrics || {} };
  } catch {
    // Claude không trả JSON hợp lệ — vẫn trả về summary thật (text gốc) để
    // người dùng thấy, nhưng không có metrics để tự điền vào ô input.
    return {
      summary: rawText || 'Claude đã đọc ảnh nhưng không trả về JSON hợp lệ. Vui lòng nhập tay các chỉ số bên dưới.',
      metrics: {},
      tags: [{ label: 'Cần nhập tay', type: 'warn' }],
      recommendations: [],
      xp_earned: 0,
    };
  }
}
