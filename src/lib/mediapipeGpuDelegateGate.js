/**
 * mediapipeGpuDelegateGate.js
 * -----------------------------------------------------------------------
 * BỐI CẢNH: mỗi widget dùng MediaPipe tasks-vision trong repo này (Vision
 * Sync, Vibe Tracking, Dino Jump, mediapipe-khanh, webcam controls,...) đều
 * tự cài GPU trước, có timeout 15s, fail thì mới thử lại CPU (xem
 * INIT_TIMEOUT_MS / withTimeout ở từng file). Trên rất nhiều máy/trình
 * duyệt (theo log người dùng gửi — 100% các lần đều fail GPU), bước GPU
 * KHÔNG BAO GIỜ THÀNH CÔNG — chỉ tốn đúng 15 giây chờ vô ích trước khi rơi
 * xuống CPU. Vì các widget này chạy trong <iframe> CÙNG-ORIGIN với trang
 * cha (share chung 1 main thread), 15s đó thực sự đơ luôn cả tab ngoài
 * (mất menu, không bấm được gì) — nhân với 2-3 model mỗi widget thì thành
 * ~30-50 giây, đúng như log "Trang không phản hồi" đã gặp nhiều lần.
 *
 * Fix: nhớ lại (localStorage, theo từng loại landmarker) ngay khi GPU
 * delegate fail/timeout lần đầu trên trình duyệt này — các lần khởi tạo
 * sau (kể cả widget khác, kể cả lần load trang sau) sẽ bỏ qua thẳng bước
 * GPU, đi CPU ngay, không phải chờ 15s vô ích nữa. Nếu 1 ngày nào đó GPU
 * delegate work trở lại bình thường (đổi máy, đổi driver...), người dùng
 * chỉ cần xoá localStorage hoặc dùng máy khác — không có cơ chế "tự thử
 * lại GPU" định kỳ vì lợi ích không đáng so với rủi ro treo lại 15s.
 */

const STORAGE_KEY = 'zofo:mediapipe-gpu-delegate-failed-v1'

function readFailedSet() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function writeFailedSet(set) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // localStorage có thể bị chặn (chế độ ẩn danh nghiêm ngặt, quota đầy...)
    // — bỏ qua, chỉ mất tác dụng "nhớ", không ảnh hưởng chức năng chính.
  }
}

/**
 * true nếu landmarker `key` (vd 'face', 'pose', 'hand') đã từng fail/timeout
 * GPU delegate trên trình duyệt này rồi — nên bỏ qua bước GPU, đi CPU luôn.
 */
export function hasGpuDelegateFailedBefore(key) {
  if (typeof window === 'undefined') return false
  return readFailedSet().has(key)
}

/** Ghi nhớ landmarker `key` vừa fail/timeout GPU delegate. */
export function markGpuDelegateFailed(key) {
  if (typeof window === 'undefined') return
  const set = readFailedSet()
  if (set.has(key)) return
  set.add(key)
  writeFailedSet(set)
}
