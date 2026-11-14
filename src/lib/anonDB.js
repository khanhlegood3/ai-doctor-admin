/**
 * anonDB.js — IndexedDB storage for anonymous (guest) users
 *
 * Why IndexedDB instead of localStorage?
 *   • localStorage: ~5 MB quota, synchronous, blocks main thread
 *   • IndexedDB:   ~50-500 MB+ quota (origin-based), async, non-blocking
 *
 * Database layout:
 *   DB name : "cdoc_guest"
 *   Version : 1
 *   Stores  :
 *     "session"   — keyPath: "id" (always one row, id="anon")  → guest profile
 *     "journey"   — keyPath: "id", autoIncrement               → health journey entries
 *     "inventory" — keyPath: "id"                              → inventory items
 *     "records"   — keyPath: "id", autoIncrement               → medical records / uploads
 *     "settings"  — keyPath: "key"                             → arbitrary key/value config
 *
 * ── Vì sao "journey" / "inventory" / "records" cần trường ownerUuid ─────────
 * Cả DB "cdoc_guest" này nằm CHUNG 1 chỗ trên trình duyệt (không có nhiều DB
 * theo từng uuid) — trước đây các dòng trong 3 store này KHÔNG có trường nào
 * đánh dấu chúng thuộc về ai, nên chúng thực chất chỉ là "1 bucket chung cho
 * vị khách hiện tại trên thiết bị", không tự "đi theo" khi khách đó bấm "Tạo
 * tài khoản" để hoàn tất đăng ký thật (vì không có gì để đối chiếu là dữ liệu
 * này thuộc uuid nào).
 *
 * Cách khắc phục: mỗi dòng lưu thêm `ownerUuid`.
 *   - `ownerUuid = null`  → dữ liệu của phiên khách CHƯA từng có uuid nào
 *     (rất hiếm vì loginAnonymous() luôn sinh uuid trước khi tạo dữ liệu,
 *     giữ lại chỉ để tương thích ngược với dữ liệu cũ trước bản vá này).
 *   - `ownerUuid = <uuid>` → dữ liệu đã được "khoá" vào đúng 1 danh tính
 *     (khách hoặc tài khoản thật) — dùng để lọc lại đúng dữ liệu của người
 *     đó, không lẫn sang khách khác dùng chung thiết bị sau này.
 *
 * Khi khách nâng cấp lên tài khoản thật (đăng ký email / lần đầu login
 * Google-Apple) MÀ vẫn giữ nguyên uuid cũ (xem resolveUUIDForNewAccount()
 * trong AuthContext.jsx), gọi migrateGuestDataToUuid(uuid) NGAY TRƯỚC khi
 * xoá phiên anonymous — hàm này "khoá" toàn bộ dòng đang thuộc uuid đó
 * (hoặc chưa gắn ownerUuid) lại đúng vào uuid vừa nâng cấp, để dữ liệu
 * journey/inventory/records không bị bỏ lại trong bucket khách chung nữa.
 */

import { openIdentityDB as openDB } from '../../public/device-identity.js'

// ─── Generic helpers ──────────────────────────────────────────────────────────
function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  }))
}

function getAll(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const req = transaction.objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  }))
}

function clearStore(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const req = transaction.objectStore(storeName).clear()
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  }))
}

// Lọc getAll(storeName) theo ownerUuid (nếu có truyền vào). Dòng nào chưa
// từng gắn ownerUuid (dữ liệu cũ trước bản vá, hoặc chưa uuid nào tồn tại)
// vẫn được coi là "của khách hiện tại" nên luôn hiện ra bất kể ownerUuid nào
// đang được lọc — chỉ khi 1 dòng đã bị "khoá" (ownerUuid khác với uuid đang
// lọc) mới bị ẩn đi, để tránh 2 danh tính dùng chung thiết bị nhìn thấy dữ
// liệu của nhau sau khi 1 trong 2 đã nâng cấp lên tài khoản thật.
function getAllScoped(storeName, ownerUuid) {
  return getAll(storeName).then(rows => {
    if (!ownerUuid) return rows
    return rows.filter(row => !row.ownerUuid || row.ownerUuid === ownerUuid)
  })
}

// ─── Session (guest profile) ─────────────────────────────────────────────────
export async function getAnonSession() {
  try {
    return await tx('session', 'readonly', s => s.get('anon'))
  } catch {
    return null
  }
}

export async function saveAnonSession(data) {
  if (!data) return clearStore('session')
  return tx('session', 'readwrite', s => s.put({ ...data, id: 'anon' }))
}

// Patch only the given fields onto the existing guest session (e.g. profile edits)
export async function updateAnonSession(updates, expectedUuid = null) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction('session', 'readwrite')
    const store = t.objectStore('session')
    let merged = null
    const req = store.get('anon')
    req.onsuccess = () => {
      const existing = req.result
      const uuid = existing?.uuid || existing?.anonUUID
      if (!uuid || (expectedUuid && expectedUuid !== uuid)) return
      // The UID is immutable; a late response must not recreate a consumed
      // session or modify the next guest after switching Google accounts.
      const { uuid: ignored, anonUUID: ignoredLegacy, ...safe } = updates
      merged = { ...existing, ...safe, uuid, id: 'anon' }
      store.put(merged)
    }
    t.oncomplete = () => resolve(merged)
    t.onerror = t.onabort = () => reject(t.error)
  })
}

export async function deleteAnonSession() {
  return tx('session', 'readwrite', s => s.delete('anon'))
}

// ─── Journey entries ──────────────────────────────────────────────────────────
// `ownerUuid` (tuỳ chọn): truyền vào để chỉ lấy/gắn đúng dữ liệu của 1 danh
// tính cụ thể; bỏ trống sẽ lấy/gắn theo "bucket khách hiện tại" như trước.
export async function getJourneyEntries(ownerUuid = null) {
  return getAllScoped('journey', ownerUuid)
}

export async function addJourneyEntry(entry, ownerUuid = null) {
  return tx('journey', 'readwrite', s => s.add({ ...entry, ownerUuid: entry.ownerUuid ?? ownerUuid, createdAt: new Date().toISOString() }))
}

export async function putJourneyEntry(entry, ownerUuid = null) {
  return tx('journey', 'readwrite', s => s.put({ ...entry, ownerUuid: entry.ownerUuid ?? ownerUuid }))
}

export async function deleteJourneyEntry(id) {
  return tx('journey', 'readwrite', s => s.delete(id))
}

// ─── Inventory ────────────────────────────────────────────────────────────────
export async function getInventory(ownerUuid = null) {
  return getAllScoped('inventory', ownerUuid)
}

export async function putInventoryItem(item, ownerUuid = null) {
  return tx('inventory', 'readwrite', s => s.put({ ...item, ownerUuid: item.ownerUuid ?? ownerUuid }))
}

export async function deleteInventoryItem(id) {
  return tx('inventory', 'readwrite', s => s.delete(id))
}

// ─── Medical records / file uploads ──────────────────────────────────────────
export async function getRecords(ownerUuid = null) {
  return getAllScoped('records', ownerUuid)
}

export async function addRecord(record, ownerUuid = null) {
  // `record.file` can be an ArrayBuffer or Blob — IndexedDB handles binary natively
  return tx('records', 'readwrite', s => s.add({ ...record, ownerUuid: record.ownerUuid ?? ownerUuid, createdAt: new Date().toISOString() }))
}

export async function deleteRecord(id) {
  return tx('records', 'readwrite', s => s.delete(id))
}

// ─── Settings (arbitrary key/value) ──────────────────────────────────────────
export async function getSetting(key) {
  try {
    const row = await tx('settings', 'readonly', s => s.get(key))
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function setSetting(key, value) {
  return tx('settings', 'readwrite', s => s.put({ key, value }))
}

// ─── Khoá dữ liệu khách (journey/inventory/records) vào 1 uuid cụ thể ────────
// Gọi hàm này NGAY khi 1 phiên khách được "nâng cấp" thành tài khoản thật mà
// vẫn giữ nguyên uuid cũ (xem resolveUUIDForNewAccount() trong
// AuthContext.jsx). Mọi dòng trong 3 store journey/inventory/records CHƯA
// từng gắn ownerUuid (tức đang thuộc "bucket khách hiện tại" chung của thiết
// bị) sẽ được gắn ownerUuid = uuid vừa nâng cấp — từ đây các hàm đọc
// (getJourneyEntries/getInventory/getRecords) khi được gọi kèm uuid sẽ luôn
// trả lại đúng dữ liệu này, và 1 vị khách KHÁC dùng chung thiết bị sau khi
// đăng xuất sẽ không vô tình nhìn thấy hoặc ghi đè lên dữ liệu đã có chủ.
// Không xoá gì cả — chỉ "dán nhãn" lại, nên an toàn để gọi nhiều lần.
export async function migrateGuestDataToUuid(uuid) {
  if (!uuid) return
  const stores = ['journey', 'inventory', 'records']
  await Promise.all(stores.map(async (storeName) => {
    const rows = await getAll(storeName)
    const unclaimed = rows.filter(row => !row.ownerUuid)
    if (unclaimed.length === 0) return
    await Promise.all(unclaimed.map(row => tx(storeName, 'readwrite', s => s.put({ ...row, ownerUuid: uuid }))))
  }))
}

// ─── Explicit full reset only — NEVER use for logout / account upgrade ───────────────────────────
export async function clearAllGuestData() {
  await Promise.all(['session', 'journey', 'inventory', 'records', 'settings'].map(clearStore))
}

// ─── Export size estimate (for display in UI) ─────────────────────────────────
export async function estimateGuestStorageBytes() {
  if (navigator.storage?.estimate) {
    const { usage } = await navigator.storage.estimate()
    return usage ?? 0
  }
  return 0
}
