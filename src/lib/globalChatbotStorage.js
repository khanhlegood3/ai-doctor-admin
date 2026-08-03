// src/lib/globalChatbotStorage.js
// GlobalAIChatbot — lưu trữ lịch sử chat vào IndexedDB, khoá theo uuid của user
// (field nhận diện thống nhất cho mọi loại user — guest hay đã đăng nhập).
// Cùng pattern raw IndexedDB như src/lib/wikiMedVisionChatStorage.js, nhưng
// đơn giản hơn: 1 record = 1 user (không tách theo ngày, không streak).

const DB_NAME    = 'global-ai-chatbot-db'
const DB_VERSION = 1
const STORE      = 'chat-sessions' // 1 record = 1 ownerKey → { messages: [...] }
export const GLOBAL_CHATBOT_SYNC_EVENT = 'global-ai-chatbot-sync'

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) { reject(new Error('IndexedDB unavailable')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'ownerKey' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function idbPut(record) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(record)
    tx.oncomplete = () => res()
    tx.onerror    = () => rej(tx.error)
  })
}

async function idbGet(ownerKey) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(ownerKey)
    req.onsuccess = () => res(req.result || null)
    req.onerror   = () => rej(req.error)
  })
}

async function idbDelete(ownerKey) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(ownerKey)
    tx.oncomplete = () => res()
    tx.onerror    = () => rej(tx.error)
  })
}

// uuid là field nhận diện thống nhất cho mọi loại user (guest hay đã đăng nhập).
// Khách chưa có session vẫn dùng được — nhóm chung vào 'guest' thay vì mất dữ liệu.
export function ownerKeyOf(uuid) {
  return uuid ? String(uuid).toLowerCase() : 'guest'
}

// ─── Public API ───────────────────────────────────────────────────────────────

// Lấy toàn bộ lịch sử chat đã lưu của user (theo uuid).
export async function getGlobalChatHistory(uuid) {
  try {
    const rec = await idbGet(ownerKeyOf(uuid))
    return rec?.messages || []
  } catch {
    return []
  }
}

// Ghi đè toàn bộ lịch sử chat của user (gọi sau mỗi lần messages đổi).
export async function saveGlobalChatHistory(uuid, messages) {
  const ownerKey = ownerKeyOf(uuid)
  try {
    const existing = await idbGet(ownerKey)
    await idbPut({
      ownerKey,
      messages,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('[globalChatbotStorage] save error:', e)
  }
}

// Xoá toàn bộ lịch sử chat của user (dùng cho nút "xoá lịch sử" nếu cần).
export async function clearGlobalChatHistory(uuid) {
  try {
    await idbDelete(ownerKeyOf(uuid))
  } catch (e) {
    console.error('[globalChatbotStorage] clear error:', e)
  }
}

// ─── Helpers cho trang "Lịch sử Chat với AI" (nhóm tin nhắn theo ngày) ─────────
// Cùng định dạng YYYY-MM-DD (giờ local) như src/lib/beMeoChatStorage.js, để hiển thị
// lịch sử theo ngày/tháng/năm nhất quán với trang Bé Mèo Nước.

// YYYY-MM-DD theo giờ local của máy (không dùng UTC để tránh lệch ngày qua nửa đêm).
export function dateKey(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Số ngày thực tế của một tháng dương lịch — tự đúng cho năm nhuận (28/29/30/31).
export function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

// Lấy ngày của 1 tin nhắn — ưu tiên createdAt (ISO string); tin nhắn cũ chưa có
// createdAt (trước khi field này được thêm) sẽ rơi vào fallback 'unknown'.
function messageDateKey(message) {
  if (!message?.createdAt) return null
  const d = new Date(message.createdAt)
  if (Number.isNaN(d.getTime())) return null
  return dateKey(d)
}

// Gom toàn bộ messages thành map { 'YYYY-MM-DD': [messages...] }, sắp xếp tin nhắn
// trong từng ngày theo đúng thứ tự thời gian gửi. Tin nhắn không xác định được ngày
// (dữ liệu cũ) được gom vào nhóm 'unknown' để không bị mất dữ liệu.
export function groupMessagesByDate(messages) {
  const map = {}
  for (const message of messages || []) {
    const key = messageDateKey(message) || 'unknown'
    if (!map[key]) map[key] = []
    map[key].push(message)
  }
  return map
}
