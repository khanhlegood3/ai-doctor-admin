// superheroCursor.js — con trỏ chuột hình "siêu nhân bay", tự vẽ bằng SVG
// (silhouette chung chung: người + áo choàng + nắm đấm đưa ra trước, KHÔNG
// dựa theo bất kỳ nhân vật có bản quyền nào) — dùng cho trang
// "🤖 AI chatbot control" theo yêu cầu.
//
// Người dùng chọn "hướng bay" + màu ở FaceAvatarPicker-style picker
// (SuperheroCursorPicker.jsx); lựa chọn lưu localStorage riêng cho trang
// này (cosmetic cá nhân, không cần đồng bộ IndexedDB).
import { useState } from 'react'

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

export function buildHeroCursorSvg(options) {
  return heroSvgMarkup(options)
}

// CSS `cursor` giá trị đầy đủ (data URI SVG + hotspot + fallback auto).
export function buildHeroCursorCss({ color, poseId }) {
  const pose = CURSOR_POSES.find(p => p.id === poseId) || CURSOR_POSES[0]
  const svg = heroSvgMarkup({ color, rotate: pose.rotate, flip: pose.flip })
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") 16 16, auto`
}

// Data URI dùng để hiển thị icon xem trước (ảnh <img>, không phải cursor).
export function buildHeroCursorPreviewSrc({ color, poseId }) {
  const pose = CURSOR_POSES.find(p => p.id === poseId) || CURSOR_POSES[0]
  const svg = heroSvgMarkup({ color, rotate: pose.rotate, flip: pose.flip })
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

const CURSOR_COLOR_KEY = 'aiChatbotControl:cursorColor'
const CURSOR_POSE_KEY = 'aiChatbotControl:cursorPose'
export const DEFAULT_CURSOR_COLOR = '#ea4335'

export function useSuperheroCursor() {
  const [color, setColorState] = useState(() => {
    try { return localStorage.getItem(CURSOR_COLOR_KEY) || DEFAULT_CURSOR_COLOR } catch { return DEFAULT_CURSOR_COLOR }
  })
  const [poseId, setPoseIdState] = useState(() => {
    try { return localStorage.getItem(CURSOR_POSE_KEY) || CURSOR_POSES[0].id } catch { return CURSOR_POSES[0].id }
  })

  const setColor = (next) => { setColorState(next); try { localStorage.setItem(CURSOR_COLOR_KEY, next) } catch {} }
  const setPoseId = (next) => { setPoseIdState(next); try { localStorage.setItem(CURSOR_POSE_KEY, next) } catch {} }

  const cursorCss = buildHeroCursorCss({ color, poseId })
  return { color, setColor, poseId, setPoseId, cursorCss }
}
