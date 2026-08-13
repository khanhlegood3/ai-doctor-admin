/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Nén ảnh ở PHÍA CLIENT trước khi convert base64 gửi lên /api/groq-proxy.
//
// LÝ DO: Vercel Serverless Function (Node.js runtime) có giới hạn CỨNG
// ~4.5MB cho toàn bộ request body — đây là giới hạn hạ tầng của
// Vercel/AWS Lambda, KHÔNG thể tăng bằng config (vercel.json chỉ chỉnh
// được maxDuration, không chỉnh được body size limit của Node function).
// Ảnh chụp thẳng từ camera iPhone thường 2-8MB; base64-encode làm phình
// thêm ~33% nữa. Khi vượt ngưỡng, Safari/WebKit từ chối gửi request ở
// tầng network (không phải lỗi HTTP status từ server) và báo "Load
// failed" — đây chính là bug user gặp: popup hiện "Load failed" ngay cả
// sau khi đã sửa để hiện lỗi thật (server không kịp trả lỗi vì request
// chưa bao giờ tới được server).
//
// Giải pháp: luôn resize + re-encode ảnh về JPEG chất lượng vừa phải qua
// <canvas> trước khi base64-hoá, bất kể định dạng gốc (PNG, HEIC đã được
// Safari tự convert sang JPEG khi chọn từ Photo Library, v.v.) — vừa
// giảm size mạnh, vừa chuẩn hoá về 1 mimeType duy nhất dễ debug.

// LƯU Ý (sự cố thực tế 13/08/2026): dimension ảnh gửi lên ảnh hưởng trực
// tiếp tới số token vision model (Groq) phải "đọc" — free tier Groq giới
// hạn CỨNG 8000 token/request (input + output cộng lại, xem GROQ_MAX_TOKENS
// trong api/_lib/bringAnyIdeaToLifeProxy.js). Ảnh 1600px từng khiến 1 ảnh
// đơn giản đã tốn ~2400 token input, chỉ còn rất ít ngân sách cho phần HTML/
// CSS/JS sinh ra -> bị cắt cụt giữa chừng (trang trắng). Hạ xuống 1024px:
// vẫn đủ chi tiết để model đọc sketch/whiteboard/vật thể, nhưng giảm đáng kể
// token ảnh, chừa nhiều chỗ hơn cho output.
const MAX_DIMENSION = 1024; // đủ chi tiết cho model vision đọc ảnh, không cần full-res gốc
const JPEG_QUALITY = 0.8;

export interface CompressedImage {
  base64: string; // KHÔNG kèm prefix "data:...;base64,"
  mimeType: string; // luôn 'image/jpeg' sau khi nén
}

/**
 * Resize + nén 1 file ảnh về JPEG qua canvas. Trả về base64 (không prefix)
 * sẵn sàng gửi lên server. Nếu ảnh gốc đã nhỏ, vẫn re-encode để đảm bảo
 * mimeType/size ổn định (chi phí không đáng kể).
 */
export function compressImageFile(file: File): Promise<CompressedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const scale = MAX_DIMENSION / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không tạo được canvas context để nén ảnh'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
      const base64 = dataUrl.split(',')[1];
      if (!base64) {
        reject(new Error('Nén ảnh thất bại: canvas không xuất được dữ liệu'));
        return;
      }

      console.log(
        `[compressImageFile] ${file.name}: ${(file.size / 1024).toFixed(0)}KB gốc -> ` +
          `${((base64.length * 0.75) / 1024).toFixed(0)}KB sau nén (${width}x${height}, JPEG q=${JPEG_QUALITY})`
      );

      resolve({ base64, mimeType: 'image/jpeg' });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Không đọc được ảnh để nén (file có thể bị hỏng hoặc không phải ảnh hợp lệ)'));
    };

    img.src = objectUrl;
  });
}

// Ngưỡng an toàn cho các file KHÔNG nén được ở client (PDF, video) — dưới
// giới hạn 4.5MB của Vercel để chừa chỗ cho phần JSON bao quanh + base64
// overhead (~33%). Vượt ngưỡng này, báo lỗi rõ ràng NGAY LẬP TỨC thay vì
// để request âm thầm thất bại với "Load failed" khó hiểu.
export const MAX_UNCOMPRESSED_FILE_BYTES = 3 * 1024 * 1024; // 3MB
