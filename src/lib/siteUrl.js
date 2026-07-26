// src/lib/siteUrl.js
//
// NGUỒN DUY NHẤT cho domain production của app (thay vì rải hard-code domain
// ở nhiều file). Khi đổi domain (ví dụ: hienmaunhanvan.vercel.app ->
// hienmaunhanvan.com), CHỈ CẦN đổi 1 chỗ: biến môi trường
// VITE_PUBLIC_SITE_URL (trong .env lúc dev, hoặc Project Settings > Environment
// Variables trên Vercel lúc deploy production) — không phải sửa code.
//
// Ưu tiên theo thứ tự:
// 1) VITE_PUBLIC_SITE_URL (nếu đã set) — dùng cho các trường hợp BẮT BUỘC
//    phải là domain public thật (vd: URL webhook đăng ký với Alchemy/Moralis,
//    vì các dịch vụ đó gọi vào từ server ngoài nên không thể dùng
//    window.location.origin của trình duyệt admin).
// 2) window.location.origin — domain đang thực sự chạy (localhost lúc dev,
//    đúng domain preview/production lúc deploy). Dùng cho link chia sẻ
//    (referral link) vì luôn đúng với môi trường người dùng đang đứng, không
//    cần cấu hình gì thêm.
// 3) Fallback cứng cuối cùng nếu không có window (chạy trong Node/script).
const FALLBACK_SITE_URL = 'https://hienmaunhanvan.com'

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, '')
}

// Domain "chính thức" cấu hình qua env — dùng khi cần 1 URL public cố định
// bất kể admin đang mở panel từ localhost/preview hay production.
export const CONFIGURED_SITE_URL = stripTrailingSlash(
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SITE_URL) || FALLBACK_SITE_URL
)

// Domain đang thực sự chạy trong trình duyệt hiện tại — dùng cho referral
// link, OG link, share link... để tự khớp theo môi trường (localhost / preview
// / production) mà không cần sửa code khi đổi domain.
export function getRuntimeSiteUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return stripTrailingSlash(window.location.origin)
  }
  return CONFIGURED_SITE_URL
}
