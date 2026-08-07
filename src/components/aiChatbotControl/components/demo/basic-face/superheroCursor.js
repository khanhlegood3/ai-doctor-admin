// superheroCursor.js — con trỏ chuột tuỳ chỉnh cho trang "🤖 AI chatbot
// control": "Không dùng icon" (con trỏ mặc định), "🦸 Siêu nhân bay", hoặc
// "🐱 Con mèo" — tất cả SVG tự vẽ, silhouette chung chung, KHÔNG dựa theo
// bất kỳ nhân vật/hình ảnh có bản quyền nào.
//
// Người dùng chọn Kiểu + màu (+ hướng, nếu là kiểu Siêu nhân) ở
// SuperheroCursorPicker.jsx; lựa chọn lưu localStorage riêng cho trang này
// (cosmetic cá nhân, không cần đồng bộ IndexedDB).
import { useState } from 'react'

export const CURSOR_TYPES = [
  { id: 'none', vi: 'Không dùng icon', en: 'No icon' },
  { id: 'hero', vi: '🦸 Siêu nhân bay', en: '🦸 Flying hero' },
  { id: 'cat', vi: '🐱 Con mèo', en: '🐱 Cat' },
]

export const CURSOR_POSES = [
  { id: 'right', vi: 'Bay thẳng', en: 'Flying straight', rotate: 0, flip: false },
  { id: 'up', vi: 'Bay vút lên', en: 'Soaring up', rotate: -35, flip: false },
  { id: 'down', vi: 'Lao xuống', en: 'Diving down', rotate: 35, flip: false },
  { id: 'left', vi: 'Bay ngược', en: 'Flying back', rotate: 0, flip: true },
]

function heroSvgMarkup({ color = '#ea4335', rotate = 0, flip = false }) {
  const transform = `rotate(${rotate} 16 16)${flip ? ' scale(-1,1) translate(-32,0)' : ''}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<g transform="${transform}">` +
    `<path d="M2 24 L9 18 L6 15 Z" fill="${color}" opacity="0.4"/>` +
    `<path d="M0 28 L8 22 L6 19 Z" fill="${color}" opacity="0.25"/>` +
    `<path d="M12 24 C9 20 9 13 14 9 C16.5 7 20.5 6.5 25 8 L20 12.5 C18 12.3 16 13.3 15 15.3 C14 17.3 15 20.3 17.5 22.3 Z" fill="${color}"/>` +
    `<ellipse cx="19" cy="16.5" rx="6.2" ry="3.6" transform="rotate(-35 19 16.5)" fill="${color}"/>` +
    `<circle cx="24.5" cy="9.3" r="3.3" fill="${color}"/>` +
    `<path d="M24.5 15.3 L30 12 L28.7 15.3 L24.5 17.3 Z" fill="${color}"/>` +
    `<circle cx="24.5" cy="9.3" r="1.1" fill="#ffffff" opacity="0.7"/>` +
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
export const DEFAULT_CURSOR_COLOR = '#ea4335'

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

  const setType = (next) => { setTypeState(next); try { localStorage.setItem(CURSOR_TYPE_KEY, next) } catch {} }
  const setColor = (next) => { setColorState(next); try { localStorage.setItem(CURSOR_COLOR_KEY, next) } catch {} }
  const setPoseId = (next) => { setPoseIdState(next); try { localStorage.setItem(CURSOR_POSE_KEY, next) } catch {} }

  const cursorCss = buildCursorCss({ type, color, poseId })
  return { type, setType, color, setColor, poseId, setPoseId, cursorCss }
}
