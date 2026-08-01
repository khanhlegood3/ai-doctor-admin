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
