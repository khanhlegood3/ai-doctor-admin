// src/video-to-learning-khanh/src/lib/identity.ts
// Lớp mỏng re-export lại từ src/lib/khanhIdentity.js (app cha) — logic thật
// đã được chuyển lên đó vì không có gì trong nó phụ thuộc riêng vào
// video-to-learning (xem chú thích đầy đủ trong file đó). Giữ file này lại
// (thay vì sửa trực tiếp import ở App.tsx/AdminHistoryPanel.tsx) để:
//   1. Không phải đổi đường dẫn import ở nơi đang dùng './lib/identity'.
//   2. Có 1 chỗ khai báo lại type Identity cho TypeScript (file gốc là .js
//      thuần, dùng JSDoc — sub-app TS này vẫn muốn type rõ ràng khi import).
export interface Identity {
  uuid: string | null;
  userId: string | null;
  name: string | null;
}

// @ts-ignore — src/lib/khanhIdentity.js là JS thuần (JSDoc, không phải .d.ts),
// TypeScript không tự suy được type khi import ngoài phạm vi sub-app này.
export { getIdentity } from '../../../lib/khanhIdentity.js';

const GUEST_UUID_STORAGE_KEY = 'video-to-learning:guest-uuid';

/**
 * identity.uuid (từ getIdentity()) chỉ có giá trị khi người dùng ĐÃ ĐĂNG
 * NHẬP (xem khanhIdentity.js). Khi duyệt dưới dạng Guest (rất phổ biến —
 * xem nút "Đang duyệt với tư cách Guest" ở header), uuid là null, khiến:
 *   1. Sản phẩm tạo ra KHÔNG BAO GIỜ được sao lưu lên R2 (bucket hệ thống
 *      luôn trống với Guest), và
 *   2. Lịch sử KHÔNG BAO GIỜ được tải từ R2 (bug "Chưa có lịch sử nào").
 * Hàm này cấp 1 uuid ẩn danh RIÊNG CHO TRÌNH DUYỆT NÀY (không liên quan hệ
 * thống đăng nhập thật), lưu trong localStorage, để Guest vẫn lưu/tải được
 * lịch sử lên R2 bình thường — giống cách "Bring Any Idea to Life" hoạt
 * động hoàn toàn ẩn danh, không cần đăng nhập.
 */
export function getOrCreateGuestUuid(): string {
  try {
    const existing = localStorage.getItem(GUEST_UUID_STORAGE_KEY);
    if (existing) return existing;
    const fresh = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(GUEST_UUID_STORAGE_KEY, fresh);
    return fresh;
  } catch {
    // localStorage không khả dụng (private mode nghiêm ngặt, v.v.) — dùng id
    // tạm cho phiên này, không lưu được nên lần sau sẽ sinh id khác.
    return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
