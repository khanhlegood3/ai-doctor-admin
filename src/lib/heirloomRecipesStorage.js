// src/lib/heirloomRecipesStorage.js
// "Bữa ăn heirloom recipes" — chuyển thể từ app demo "heirloom-recipes"
// (Google AI Studio: React 19 + Firebase Auth/Firestore + @google/genai
// gọi thẳng Gemini từ trình duyệt, có khái niệm "household" nhiều thành
// viên dùng chung công thức).
//
// Dự án này KHÔNG có Firebase project riêng cho tính năng này và cũng
// không có Gemini API key production, nên phần lưu trữ được viết lại theo
// ĐÚNG pattern raw IndexedDB đã dùng cho "Wiki Med Vision" (xem
// src/lib/wikiMedVisionChatStorage.js) — không thêm dependency mới, không
// cần Firestore, dữ liệu nằm cục bộ trên máy người dùng và khoá theo
// user.uuid (giống mọi tính năng khác trong app dùng useAuth()). Phần AI
// (nhập món từ URL/văn bản + AI tự sinh công thức) được viết lại để gọi
// qua /api/groq-proxy sẵn có — xem ./heirloomRecipesClient.js trong cùng
// thư mục component.

const DB_NAME    = 'heirloom-recipes-db'
const DB_VERSION = 1
const STORE      = 'recipes' // 1 record = 1 công thức, keyPath 'id'

export const CATEGORIES = ['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Drink', 'Other']

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) { reject(new Error('IndexedDB unavailable')); return }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        const s = db.createObjectStore(STORE, { keyPath: 'id' })
        s.createIndex('ownerKey', 'ownerKey', { unique: false })
        s.createIndex('category', 'category', { unique: false })
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

async function idbDelete(id) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).delete(id)
    tx.oncomplete = () => res()
    tx.onerror    = () => rej(tx.error)
  })
}

async function idbGetAllByOwner(ownerKey) {
  const db = await openDB()
  return new Promise((res, rej) => {
    const tx  = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).index('ownerKey').getAll(ownerKey)
    req.onsuccess = () => res(req.result || [])
    req.onerror   = () => rej(req.error)
  })
}

// uuid là field nhận diện thống nhất cho mọi loại user trong app này
// (xem AuthContext). Khách chưa có session vẫn dùng được — nhóm chung
// vào 'guest' thay vì mất dữ liệu, giống wikiMedVisionChatStorage.
function ownerKeyOf(uuid) {
  return uuid ? String(uuid).toLowerCase() : 'guest'
}

let uidCounter = 0
function nextId() {
  uidCounter += 1
  return `recipe-${Date.now()}-${uidCounter}`
}

export async function listRecipes(uuid) {
  const ownerKey = ownerKeyOf(uuid)
  const rows = await idbGetAllByOwner(ownerKey)
  return rows
    .map((r) => r.recipe)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
}

export async function saveRecipe(uuid, recipeData) {
  const ownerKey = ownerKeyOf(uuid)
  const id = recipeData.id || nextId()
  const recipe = {
    id,
    title: String(recipeData.title || '').trim() || 'Món chưa đặt tên',
    ingredients: Array.isArray(recipeData.ingredients) ? recipeData.ingredients.filter(Boolean) : [],
    instructions: Array.isArray(recipeData.instructions) ? recipeData.instructions.filter(Boolean) : [],
    category: CATEGORIES.includes(recipeData.category) ? recipeData.category : 'Other',
    rating: Number.isFinite(recipeData.rating) ? Math.max(0, Math.min(5, recipeData.rating)) : 0,
    estimatedTime: Number.isFinite(recipeData.estimatedTime) ? recipeData.estimatedTime : null,
    sourceUrl: recipeData.sourceUrl || '',
    imageUrl: recipeData.imageUrl || '',
    createdAt: recipeData.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  await idbPut({ id, ownerKey, recipe })
  return recipe
}

export async function deleteRecipe(uuid, id) {
  void ownerKeyOf(uuid) // giữ chữ ký hàm nhất quán với các hàm khác dù không cần lọc khi xoá theo id
  await idbDelete(id)
}
