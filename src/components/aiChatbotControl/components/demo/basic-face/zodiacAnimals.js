// zodiacAnimals.js — 11 con giáp còn lại (Mèo đã có sẵn trong
// superheroCursor.js) cho bộ icon con trỏ chuột ở trang
// "🤖 AI chatbot control". Mỗi con là 1 silhouette đơn giản tự vẽ, cùng hệ
// toạ độ 32x32 và phong cách (đầu tròn + mắt chấm đen) với con mèo, để cả
// bộ nhìn đồng nhất.
export const ZODIAC_ANIMALS = [
  { id: 'rat', vi: 'Tý · Chuột', en: 'Rat' },
  { id: 'ox', vi: 'Sửu · Trâu', en: 'Ox' },
  { id: 'tiger', vi: 'Dần · Hổ', en: 'Tiger' },
  { id: 'cat', vi: 'Mão · Mèo', en: 'Cat' },
  { id: 'dragon', vi: 'Thìn · Rồng', en: 'Dragon' },
  { id: 'snake', vi: 'Tỵ · Rắn', en: 'Snake' },
  { id: 'horse', vi: 'Ngọ · Ngựa', en: 'Horse' },
  { id: 'goat', vi: 'Mùi · Dê', en: 'Goat' },
  { id: 'monkey', vi: 'Thân · Khỉ', en: 'Monkey' },
  { id: 'rooster', vi: 'Dậu · Gà', en: 'Rooster' },
  { id: 'dog', vi: 'Tuất · Chó', en: 'Dog' },
  { id: 'pig', vi: 'Hợi · Heo', en: 'Pig' },
]

const EYES = (color = '#0f172a') =>
  `<circle cx="12.3" cy="10.6" r="1" fill="${color}"/><circle cx="17.7" cy="10.6" r="1" fill="${color}"/>`

const sittingBody = (color) => `<path d="M9 28 C7 21 9 15 15 15 C21 15 23 21 21 28 Z" fill="${color}"/>`
const headCircle = (color) => `<circle cx="15" cy="11" r="6.4" fill="${color}"/>`

function ratSvg({ color = '#94a3b8' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    // đuôi dài mảnh
    `<path d="M20 26 C26 27 30 23 29 17 C28.5 21 25 24 20 23" stroke="${color}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` +
    sittingBody(color) +
    headCircle(color) +
    // 2 tai tròn
    `<circle cx="10" cy="6.5" r="2.6" fill="${color}"/><circle cx="20" cy="6.5" r="2.6" fill="${color}"/>` +
    EYES() +
    // mũi nhọn
    `<path d="M13.6 13 L16.4 13 L15 14.6 Z" fill="#0f172a"/>` +
    // ria
    `<path d="M5 10.5 L11 11.5 M5 13.5 L11.2 12.8 M19 11.5 L25 10.5 M18.8 12.8 L25 13.5" stroke="${color}" stroke-width="0.7" opacity="0.85" stroke-linecap="round"/>` +
    `</svg>`
}

function oxSvg({ color = '#78716c' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    headCircle(color) +
    // sừng cong
    `<path d="M9 6 C6 4 5 1 6.5 0.5 C8 2 8.5 4.5 10.5 6.5" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M21 6 C24 4 25 1 23.5 0.5 C22 2 21.5 4.5 19.5 6.5" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    // tai nhỏ
    `<ellipse cx="8.6" cy="9.5" rx="1.6" ry="1" fill="${color}"/><ellipse cx="21.4" cy="9.5" rx="1.6" ry="1" fill="${color}"/>` +
    EYES() +
    // mõm
    `<ellipse cx="15" cy="14.6" rx="3.6" ry="2.2" fill="#e7e5e4"/>` +
    `<circle cx="13.6" cy="14.6" r="0.5" fill="#0f172a"/><circle cx="16.4" cy="14.6" r="0.5" fill="#0f172a"/>` +
    `</svg>`
}

function tigerSvg({ color = '#f97316' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    headCircle(color) +
    `<path d="M9.5 8 L7 2 L12.5 6.5 Z" fill="${color}"/>` +
    `<path d="M20.5 8 L23 2 L17.5 6.5 Z" fill="${color}"/>` +
    EYES() +
    `<path d="M14.3 13 L15.7 13 L15 14 Z" fill="#0f172a"/>` +
    `<path d="M15 14.1 C14.4 15 13.4 15 13 14.4 M15 14.1 C15.6 15 16.6 15 17 14.4" stroke="#0f172a" stroke-width="0.6" fill="none" stroke-linecap="round"/>` +
    // vằn vện
    `<path d="M8.5 5.5 L10 8.5 M21.5 5.5 L20 8.5 M9.5 24 L11 21 M20.5 24 L19 21" stroke="#0f172a" stroke-width="1" opacity="0.5" stroke-linecap="round"/>` +
    `<path d="M4 10 L10.5 11.2 M4 13 L10.7 12.6 M20.3 11.2 L26 10 M20.3 12.6 L26 13" stroke="${color}" stroke-width="0.7" opacity="0.85" stroke-linecap="round"/>` +
    `</svg>`
}

function dragonSvg({ color = '#16a34a' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    // thân uốn lượn
    `<path d="M6 29 C4 24 8 22 10 24 C13 27 10 20 14 19 C18 18 15 12 20 12" stroke="${color}" stroke-width="4.4" fill="none" stroke-linecap="round"/>` +
    // đầu
    `<circle cx="23" cy="10" r="4.8" fill="${color}"/>` +
    // 2 sừng
    `<path d="M21 5.5 L20 1 L23 4.5 Z" fill="${color}"/>` +
    `<path d="M25.5 5.5 L27.5 1.5 L26 5.8 Z" fill="${color}"/>` +
    // mắt
    `<circle cx="21.3" cy="9.6" r="0.9" fill="#0f172a"/>` +
    // râu/tua
    `<path d="M18.5 12.5 C16.5 13.5 15 13 14 14.5 M18.5 11 C16 10.5 15 9 13.5 9.5" stroke="${color}" stroke-width="0.9" fill="none" stroke-linecap="round" opacity="0.85"/>` +
    // mõm nhỏ
    `<path d="M26.6 11.5 L29 12.3 L26.8 13.4 Z" fill="${color}"/>` +
    `</svg>`
}

function snakeSvg({ color = '#65a30d' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    `<path d="M9 30 C3 26 9 22 13 24 C18 27 12 18 8 16 C3 13 8 5 15 6" stroke="${color}" stroke-width="4.2" fill="none" stroke-linecap="round"/>` +
    // đầu
    `<circle cx="19" cy="6" r="3.6" fill="${color}"/>` +
    `<circle cx="20.2" cy="5" r="0.7" fill="#0f172a"/>` +
    // lưỡi chẻ
    `<path d="M22 6.5 L26 6 M26 6 L28 4.5 M26 6 L28 7.5" stroke="#ef4444" stroke-width="0.8" fill="none" stroke-linecap="round"/>` +
    `</svg>`
}

function horseSvg({ color = '#a16207' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    // đầu dài
    `<path d="M11 14 C10 9 12 5 16 5 C19.5 5 21 8 20.5 12 C20.2 14.5 18.5 16.5 16 16.5 C13.5 16.5 11.4 15.8 11 14 Z" fill="${color}"/>` +
    // tai nhọn
    `<path d="M12.5 5.5 L11 1 L15 4.5 Z" fill="${color}"/>` +
    `<path d="M19.5 5.5 L21 1 L17 4.5 Z" fill="${color}"/>` +
    // bờm
    `<path d="M11.5 6 L9 7 M11.2 8.5 L8.7 9.3 M11.5 11 L9.2 12" stroke="${color}" stroke-width="1.3" stroke-linecap="round"/>` +
    `<circle cx="14" cy="10" r="0.9" fill="#0f172a"/>` +
    // mõm
    `<ellipse cx="18.3" cy="13.5" rx="2.6" ry="1.8" fill="#78350f"/>` +
    `</svg>`
}

function goatSvg({ color = '#eab308' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    headCircle(color) +
    // sừng cong ngược ra sau
    `<path d="M10 6.5 C7 5.5 5.5 2.5 6.5 0.5 C8 3 9.5 4.5 11.3 6" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    `<path d="M20 6.5 C23 5.5 24.5 2.5 23.5 0.5 C22 3 20.5 4.5 18.7 6" stroke="${color}" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    EYES() +
    `<path d="M14.3 13 L15.7 13 L15 14 Z" fill="#0f172a"/>` +
    // râu cằm
    `<path d="M15 15 L15 18" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>` +
    `</svg>`
}

function monkeySvg({ color = '#92400e' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    // 2 tai to tròn
    `<circle cx="8" cy="10" r="3.4" fill="${color}"/><circle cx="22" cy="10" r="3.4" fill="${color}"/>` +
    `<circle cx="8" cy="10" r="1.8" fill="#fed7aa"/><circle cx="22" cy="10" r="1.8" fill="#fed7aa"/>` +
    headCircle(color) +
    // mặt sáng màu
    `<ellipse cx="15" cy="12.5" rx="4.4" ry="3.6" fill="#fed7aa"/>` +
    `<circle cx="12.8" cy="11.3" r="0.9" fill="#0f172a"/><circle cx="17.2" cy="11.3" r="0.9" fill="#0f172a"/>` +
    `<path d="M13 14.2 C14 15.2 16 15.2 17 14.2" stroke="#0f172a" stroke-width="0.7" fill="none" stroke-linecap="round"/>` +
    `</svg>`
}

function roosterSvg({ color = '#dc2626' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    // đuôi xoè
    `<path d="M8 22 C2 19 2 12 6 9 C6 14 8 18 12 20 Z" fill="${color}" opacity="0.85"/>` +
    `<path d="M9 25 C4 24 3 18 6.5 14.5 C7 19 9 22 13 23.5 Z" fill="${color}"/>` +
    // thân
    `<ellipse cx="16" cy="21" rx="7.5" ry="7" fill="${color}"/>` +
    // đầu
    `<circle cx="22" cy="11" r="4.2" fill="${color}"/>` +
    // mào
    `<path d="M20 7.5 L20.6 5 L22 7 L22.8 4.5 L24 7.2" stroke="#b91c1c" stroke-width="1.6" fill="none" stroke-linecap="round"/>` +
    // mỏ
    `<path d="M25.8 11.5 L29 11 L25.8 13.3 Z" fill="#f59e0b"/>` +
    // mắt
    `<circle cx="23" cy="10.3" r="0.8" fill="#0f172a"/>` +
    // chân
    `<path d="M13 27.5 L11.5 31 M13 27.5 L14.3 31" stroke="#f59e0b" stroke-width="1.3" stroke-linecap="round"/>` +
    `</svg>`
}

function dogSvg({ color = '#a8734a' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    headCircle(color) +
    // tai cụp
    `<path d="M9 8 C6 9 5 13.5 7.5 16 C8 12.5 8.5 10 11 8.5 Z" fill="${color}"/>` +
    `<path d="M21 8 C24 9 25 13.5 22.5 16 C22 12.5 21.5 10 19 8.5 Z" fill="${color}"/>` +
    EYES() +
    `<path d="M14.3 13 L15.7 13 L15 14 Z" fill="#0f172a"/>` +
    // lưỡi
    `<path d="M14.3 14.4 C14.3 16.5 15.7 16.5 15.7 14.4" fill="#f472b6"/>` +
    `</svg>`
}

function pigSvg({ color = '#f9a8d4' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">` +
    sittingBody(color) +
    headCircle(color) +
    // tai nhỏ tam giác
    `<path d="M10 8 L8.5 3.5 L13 6.5 Z" fill="${color}"/>` +
    `<path d="M20 8 L21.5 3.5 L17 6.5 Z" fill="${color}"/>` +
    EYES() +
    // mõm heo
    `<ellipse cx="15" cy="14.4" rx="3.4" ry="2.4" fill="#f472b6"/>` +
    `<ellipse cx="13.8" cy="14.4" rx="0.6" ry="0.9" fill="#831843"/>` +
    `<ellipse cx="16.2" cy="14.4" rx="0.6" ry="0.9" fill="#831843"/>` +
    `</svg>`
}

export const ZODIAC_SVG_BUILDERS = {
  rat: ratSvg,
  ox: oxSvg,
  tiger: tigerSvg,
  dragon: dragonSvg,
  snake: snakeSvg,
  horse: horseSvg,
  goat: goatSvg,
  monkey: monkeySvg,
  rooster: roosterSvg,
  dog: dogSvg,
  pig: pigSvg,
}
