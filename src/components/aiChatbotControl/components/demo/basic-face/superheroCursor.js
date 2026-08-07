// superheroCursor.js — con trỏ chuột tuỳ chỉnh + các tuỳ chọn hiệu ứng liên
// quan, dùng chung cho trang "🤖 AI chatbot control" VÀ 2 trang "Anh Hùng"
// (ChooseUserRolePanel / DonationHeroPanel):
//
//   - Kiểu con trỏ: "Không dùng icon" (mặc định trình duyệt), "🧙‍♀️ Phù
//     thuỷ cưỡi chổi bay", hoặc ĐỦ 12 CON GIÁP (Tý → Hợi, xem
//     zodiacAnimals.js) — tất cả SVG tự vẽ, silhouette chung chung, KHÔNG
//     dựa theo bất kỳ nhân vật/hình ảnh có bản quyền nào, cùng 1 phong
//     cách vẽ với con mèo gốc.
//   - flyEffectEnabled: bật/tắt hiệu ứng click chuột "🧙‍♀️ phù thuỷ cưỡi
//     chổi bay tới / 🕸️ người nhện đu dây tới" (ClickHeroSpiderEffects.jsx).
//     Tắt = click chuột hoạt động bình thường, chuột phải trả lại menu
//     ngữ cảnh mặc định của trình duyệt.
//   - gazeTrackEnabled: bật/tắt hiệu ứng mắt + mũi khuôn mặt AI tròn
//     "nhìn"/hướng theo vị trí con trỏ chuột (SharedFaceAvatar trackCursor).
//
// Người dùng chọn Kiểu + màu (+ hướng, nếu là kiểu Siêu nhân) + 2 tuỳ chọn
// bật/tắt hiệu ứng ở SuperheroCursorPicker.jsx (chỉ hiển thị UI ở trang
// "🤖 AI chatbot control"); lựa chọn lưu localStorage DÙNG CHUNG cho cả 3
// trang (cosmetic cá nhân, không cần đồng bộ IndexedDB) — 2 trang Anh Hùng
// chỉ ĐỌC lại các giá trị này (không có UI đổi) để áp dụng y hệt.
//
// Đồng bộ NGAY LẬP TỨC trong cùng 1 tab (kể cả giữa các component đang
// mount cùng lúc trên cùng 1 trang, ví dụ khối chat nhúng bên trong trang
// "🤖 AI chatbot control") bằng 1 CustomEvent nội bộ —
// `window.addEventListener('storage', ...)` chỉ bắn giữa CÁC TAB khác
// nhau, không đủ cho trường hợp này.
import { useEffect, useState } from 'react'
import { ZODIAC_ANIMALS, ZODIAC_SVG_BUILDERS } from './zodiacAnimals'

const PREFS_CHANGE_EVENT = 'aiChatbotControl:cursorEffectsChange'
function notifyPrefsChanged() {
  try { window.dispatchEvent(new Event(PREFS_CHANGE_EVENT)) } catch {}
}

export const CURSOR_TYPES = [
  { id: 'none', vi: 'Không dùng icon', en: 'No icon' },
  { id: 'hero', vi: '🧙‍♀️ Phù thuỷ cưỡi chổi bay', en: '🧙‍♀️ Witch on a flying broom' },
  // Đủ bộ 12 con giáp (Mão = Mèo, đã có sẵn ở đây từ trước) — mỗi con là
  // 1 icon SVG tự vẽ riêng, xem zodiacAnimals.js.
  ...ZODIAC_ANIMALS.filter(a => a.id !== 'cat').map(a => ({ id: a.id, vi: `🐾 ${a.vi}`, en: `🐾 ${a.en}` })),
  { id: 'cat', vi: '🐱 Mão · Mèo', en: '🐱 Cat' },
]

export const CURSOR_POSES = [
  { id: 'right', vi: 'Bay thẳng', en: 'Flying straight', rotate: 0, flip: false },
  { id: 'up', vi: 'Bay vút lên', en: 'Soaring up', rotate: -35, flip: false },
  { id: 'down', vi: 'Lao xuống', en: 'Diving down', rotate: 35, flip: false },
  { id: 'left', vi: 'Bay ngược', en: 'Flying back', rotate: 0, flip: true },
]

// Phù thuỷ cưỡi chổi bay: cán chổi chéo + tua chổi ở đuôi + dáng người
// khoác áo choàng, đội mũ chóp — silhouette tự vẽ hoàn toàn, chung chung,
// không dựa theo bất kỳ nhân vật có bản quyền nào.
function heroSvgMarkup({ color = '#7c3aed', rotate = 0, flip = false }) {
  const transform = `rotate(${rotate} 16 16)${flip ? ' scale(-1,1) translate(-32,0)' : ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<g transform="${transform}">` +
    // cán chổi (chéo từ đuôi dưới-trái lên đầu trên-phải)
    `<path d="M3 28 L26 7" stroke="#8b5e34" stroke-width="2" stroke-linecap="round"/>` +
    // tua chổi ở đuôi
    `<path d="M2 26.5 L0 30 M3.3 28 L1.5 31.8 M5 29 L3.8 33" stroke="#c2882f" stroke-width="1.1" stroke-linecap="round" opacity="0.9"/>` +
    // áo choàng bay phía sau
    `<path d="M12 21 C7.5 18.5 7 13 12 10.5 C15 9 19 9.3 21.5 11.3 L17.3 14.5 C15.3 13.8 13.2 14.8 12.6 17 C12.1 18.8 13 20.3 15 21.3 Z" fill="${color}"/>` +
    // chân buông thõng
    `<path d="M15.5 19 L17 23.5 M15 19.5 L12.7 23.3" stroke="${color}" stroke-width="1.3" stroke-linecap="round" opacity="0.9"/>` +
    // đầu
    `<circle cx="23" cy="9.3" r="3" fill="#fcd9b5"/>` +
    // mũ chóp phù thuỷ
    `<ellipse cx="23" cy="8.4" rx="4.1" ry="1.1" fill="${color}"/>` +
    `<path d="M20.6 8 L23.4 1 L26.3 8 Z" fill="${color}"/>` +
    // mắt
    `<circle cx="24.1" cy="9.1" r="0.6" fill="#0f172a"/>` +
    `</g></svg>`
}

// Mèo con ngồi, đuôi cong, chung chung dễ thương — không mô phỏng nhân vật
// hoạt hình cụ thể nào (không tai/mắt kiểu Hello Kitty, không logo, v.v).
function catSvgMarkup({ color = '#ea4335' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    // đuôi cong
    `<path d="M23 26 C29 24 29 15 24 13 C27 16 26 22 21 24 Z" fill="${color}"/>` +
    // thân ngồi
    `<path d="M9 28 C7 21 9 15 15 15 C21 15 23 21 21 28 Z" fill="${color}"/>` +
    // đầu
    `<circle cx="15" cy="11" r="6.4" fill="${color}"/>` +
    // 2 tai tam giác
    `<path d="M9.5 8 L7 2 L12.5 6.5 Z" fill="${color}"/>` +
    `<path d="M20.5 8 L23 2 L17.5 6.5 Z" fill="${color}"/>` +
    // mắt
    `<circle cx="12.3" cy="10.6" r="1" fill="#0f172a"/>` +
    `<circle cx="17.7" cy="10.6" r="1" fill="#0f172a"/>` +
    // mũi + miệng
    `<path d="M14.3 13 L15.7 13 L15 14 Z" fill="#0f172a"/>` +
    `<path d="M15 14.1 C14.4 15 13.4 15 13 14.4 M15 14.1 C15.6 15 16.6 15 17 14.4" stroke="#0f172a" stroke-width="0.6" fill="none" stroke-linecap="round"/>` +
    // ria mép
    `<path d="M4 10 L10.5 11.2 M4 13 L10.7 12.6 M20.3 11.2 L26 10 M20.3 12.6 L26 13" stroke="${color}" stroke-width="0.7" opacity="0.85" stroke-linecap="round"/>` +
    `</svg>`
}

function svgForType({ type, color, poseId }) {
  if (type === 'cat') return catSvgMarkup({ color })
  if (ZODIAC_SVG_BUILDERS[type]) return ZODIAC_SVG_BUILDERS[type]({ color })
  const pose = CURSOR_POSES.find(p => p.id === poseId) || CURSOR_POSES[0]
  return heroSvgMarkup({ color, rotate: pose.rotate, flip: pose.flip })
}

// CSS `cursor` giá trị đầy đủ (data URI SVG + hotspot + fallback auto), hoặc
// 'auto' đơn giản khi type === 'none'.
export function buildCursorCss({ type, color, poseId }) {
  if (type === 'none' || !type) return 'auto'
  const svg = svgForType({ type, color, poseId })
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, auto`
}

// Data URI dùng để hiển thị icon xem trước (ảnh <img>, không phải cursor).
export function buildCursorPreviewSrc({ type, color, poseId }) {
  if (type === 'none' || !type) return null
  const svg = svgForType({ type, color, poseId })
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const CURSOR_TYPE_KEY = 'aiChatbotControl:cursorType'
const CURSOR_COLOR_KEY = 'aiChatbotControl:cursorColor'
const CURSOR_POSE_KEY = 'aiChatbotControl:cursorPose'
const FLY_EFFECT_KEY = 'aiChatbotControl:flyEffectEnabled'
const GAZE_TRACK_KEY = 'aiChatbotControl:gazeTrackEnabled'
export const DEFAULT_CURSOR_COLOR = '#ea4335'

function readBoolPref(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === '1') return true
    if (raw === '0') return false
  } catch {}
  return defaultValue
}

export function useSuperheroCursor() {
  const [type, setTypeState] = useState(() => {
    try { return localStorage.getItem(CURSOR_TYPE_KEY) || 'hero' } catch { return 'hero' }
  })
  const [color, setColorState] = useState(() => {
    try { return localStorage.getItem(CURSOR_COLOR_KEY) || DEFAULT_CURSOR_COLOR } catch { return DEFAULT_CURSOR_COLOR }
  })
  const [poseId, setPoseIdState] = useState(() => {
    try { return localStorage.getItem(CURSOR_POSE_KEY) || CURSOR_POSES[0].id } catch { return CURSOR_POSES[0].id }
  })

  // Đồng bộ ngay lập tức trong cùng 1 tab (ví dụ: bảng chọn ở
  // AIChatbotControlPanel và khuôn mặt AI trong EmbeddedGlobalAIChat cùng
  // mount 1 lúc trên cùng trang) + giữa các tab khác nhau (storage event).
  useEffect(() => {
    const onChange = () => {
      try {
        setTypeState(localStorage.getItem(CURSOR_TYPE_KEY) || 'hero')
        setColorState(localStorage.getItem(CURSOR_COLOR_KEY) || DEFAULT_CURSOR_COLOR)
        setPoseIdState(localStorage.getItem(CURSOR_POSE_KEY) || CURSOR_POSES[0].id)
      } catch {}
    }
    window.addEventListener(PREFS_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setType = (next) => { setTypeState(next); try { localStorage.setItem(CURSOR_TYPE_KEY, next) } catch {}; notifyPrefsChanged() }
  const setColor = (next) => { setColorState(next); try { localStorage.setItem(CURSOR_COLOR_KEY, next) } catch {}; notifyPrefsChanged() }
  const setPoseId = (next) => { setPoseIdState(next); try { localStorage.setItem(CURSOR_POSE_KEY, next) } catch {}; notifyPrefsChanged() }

  const cursorCss = buildCursorCss({ type, color, poseId })
  return { type, setType, color, setColor, poseId, setPoseId, cursorCss }
}

// Bật/tắt hiệu ứng click chuột "siêu nhân bay tới / người nhện đu dây tới"
// (mặc định BẬT, giữ đúng hành vi trước đây). Dùng chung cho trang
// "🤖 AI chatbot control" (có UI đổi) và 2 trang Anh Hùng (chỉ đọc lại).
export function useFlyEffectEnabled() {
  const [enabled, setEnabledState] = useState(() => readBoolPref(FLY_EFFECT_KEY, true))

  useEffect(() => {
    const onChange = () => setEnabledState(readBoolPref(FLY_EFFECT_KEY, true))
    window.addEventListener(PREFS_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setEnabled = (next) => {
    setEnabledState(next)
    try { localStorage.setItem(FLY_EFFECT_KEY, next ? '1' : '0') } catch {}
    notifyPrefsChanged()
  }
  return [enabled, setEnabled]
}

// Bật/tắt hiệu ứng mắt + mũi khuôn mặt AI tròn "nhìn theo" hướng con trỏ
// chuột (mặc định BẬT, giữ đúng hành vi trước đây ở trang
// "🤖 AI chatbot control"). Dùng chung cho cả 3 nơi hiển thị khuôn mặt AI
// (khối chat nhúng trong trang chatbot control + nút mic 2 trang Anh Hùng).
export function useGazeTrackEnabled() {
  const [enabled, setEnabledState] = useState(() => readBoolPref(GAZE_TRACK_KEY, true))

  useEffect(() => {
    const onChange = () => setEnabledState(readBoolPref(GAZE_TRACK_KEY, true))
    window.addEventListener(PREFS_CHANGE_EVENT, onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener(PREFS_CHANGE_EVENT, onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const setEnabled = (next) => {
    setEnabledState(next)
    try { localStorage.setItem(GAZE_TRACK_KEY, next ? '1' : '0') } catch {}
    notifyPrefsChanged()
  }
  return [enabled, setEnabled]
}
