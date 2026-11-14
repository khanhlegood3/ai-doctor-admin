// src/lib/khanhIdentity.js
//
// Đọc danh tính ẩn danh (uuid/userId/name) của user đang đăng nhập ở app
// CHA, dùng bởi MỌI sub-app "-khanh" được nhúng qua <iframe> CÙNG-ORIGIN
// (video-to-learning-khanh, vision-sync-khanh, vibe-tracking-khanh, ...).
// Cùng origin nên đọc cache danh tính đã được AuthProvider / initializeIdentity
// khởi tạo từ IndexedDB. Tài khoản có tên lấy từ cdoc_session + cdoc_users;
// guest lấy từ cdoc_active_identity (cache, không phải nguồn UID chính).
// Không sinh UID riêng cho từng iframe.
//
// Các sub-app "-khanh" KHÔNG có server-session thật (toàn bộ auth
// client-side), nên đây CHỈ là định danh ẩn danh để nhóm dữ liệu/lịch sử
// theo người dùng — không phải xác thực bảo mật.
//
// LỊCH SỬ: hàm này trước đây sống ở
// src/video-to-learning-khanh/src/lib/identity.ts (chỉ được
// video-to-learning-khanh dùng). Không có gì trong logic phụ thuộc vào
// video-to-learning cả, nên được nâng cấp lên đây (src/lib/, dùng chung cho
// toàn bộ app) để sub-app "-khanh" TIẾP THEO không phải copy-paste lại y
// hệt file này — chỉ cần `import { getIdentity } from '<path>/lib/khanhIdentity.js'`.
// video-to-learning-khanh/src/lib/identity.ts giờ chỉ còn là 1 lớp mỏng
// re-export lại từ đây (giữ nguyên type Identity cho code TypeScript hiện có),
// xem file đó để biết cách 1 sub-app TS import từ src/lib (JS) của app cha.

/**
 * @typedef {{ uuid: string|null, userId: string|null, name: string|null }} Identity
 */

import { readActiveIdentity } from '../../public/device-identity.js'

/** @returns {Identity} */
export function getIdentity() {
  const user = readActiveIdentity()
  return { uuid: user?.uuid || null, userId: user?.userId || null, name: user?.name || null }
}
