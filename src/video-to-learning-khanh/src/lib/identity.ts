// src/video-to-learning-khanh/src/lib/identity.ts
// video-to-learning-khanh là 1 Vite sub-app riêng được nhúng qua <iframe>
// CÙNG-ORIGIN trong VideoToLearningPanel.jsx — vì cùng origin nên đọc thẳng
// được localStorage của app cha (AuthContext.jsx) để lấy đúng uuid ẩn danh
// hiện tại, KHÔNG cần postMessage hay props riêng.
//
// Cấu trúc localStorage (xem src/context/AuthContext.jsx):
//   cdoc_session = { email }                         (ai đang đăng nhập)
//   cdoc_users   = { [email]: { uuid, userId, name, ... } }  (hồ sơ từng user)
//
// Vì app này KHÔNG có server-session thật (toàn bộ auth client-side), đây
// CHỈ là định danh ẩn danh để nhóm lịch sử theo người dùng — không phải xác
// thực bảo mật.

export interface Identity {
  uuid: string | null;
  userId: string | null;
  name: string | null;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getIdentity(): Identity {
  try {
    const session = safeParse<{ email?: string }>(localStorage.getItem('cdoc_session'));
    const users = safeParse<Record<string, { uuid?: string; userId?: string; name?: string }>>(
      localStorage.getItem('cdoc_users'),
    );
    const email = session?.email;
    const user = email && users ? users[email] : null;
    return {
      uuid: user?.uuid || null,
      userId: user?.userId || null,
      name: user?.name || null,
    };
  } catch {
    return { uuid: null, userId: null, name: null };
  }
}
