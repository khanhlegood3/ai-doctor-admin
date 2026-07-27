/**
 * gameAffiliateDB.js — IndexedDB storage for the Games Affiliate system
 *
 * Tách riêng khỏi anonDB.js (DB "cdoc_guest") vì đây là dữ liệu về QUAN HỆ
 * GIỚI THIỆU (referral) + TIẾN TRÌNH CHƠI GAME (public/games) + SỔ CÁI
 * THƯỞNG (reward ledger) — vòng đời khác hẳn hồ sơ sức khoẻ/journey.
 *
 * DB name : "cdoc_game_affiliate"
 * Version : 1
 * Stores  :
 *   "codes"     — keyPath: "uuid"                → mã giới thiệu (referral code) của mỗi user
 *   "referrals" — keyPath: "id", autoIncrement    → quan hệ referrer -> referee đã ghi nhận
 *                 index: by_referrer, by_referee
 *   "progress"  — keyPath: "id", autoIncrement    → mỗi lần 1 user chơi xong 1 game (PORTAL_GAME_RESULT)
 *                 index: by_uuid, by_game
 *   "rewards"   — keyPath: "id", autoIncrement    → sổ cái thưởng (xem QC / hoàn thành game / hoa hồng)
 *                 index: by_uuid, by_status
 *
 * Mọi ghi thưởng lên blockchain đi qua gameAffiliateChain.js — file này CHỈ
 * lưu trạng thái local (nguồn sự thật khi offline) + cờ chainStatus để biết
 * dòng nào đã đồng bộ on-chain, dòng nào còn phải gửi lại.
 */

const DB_NAME = 'cdoc_game_affiliate'
const DB_VERSION = 1

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = e.target.result

      if (!db.objectStoreNames.contains('codes')) {
        db.createObjectStore('codes', { keyPath: 'uuid' })
      }
      if (!db.objectStoreNames.contains('referrals')) {
        const s = db.createObjectStore('referrals', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by_referrer', 'referrerUuid')
        s.createIndex('by_referee', 'refereeUuid')
      }
      if (!db.objectStoreNames.contains('progress')) {
        const s = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by_uuid', 'uuid')
        s.createIndex('by_game', 'gameId')
      }
      if (!db.objectStoreNames.contains('rewards')) {
        const s = db.createObjectStore('rewards', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by_uuid', 'uuid')
        s.createIndex('by_status', 'chainStatus')
      }
    }

    req.onsuccess = (e) => { _db = e.target.result; resolve(_db) }
    req.onerror = (e) => reject(e.target.error)
  })
}

function tx(storeName, mode, fn) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode)
    const store = t.objectStore(storeName)
    const req = fn(store)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  }))
}

function getAllByIndex(storeName, indexName, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(storeName, 'readonly')
    const req = t.objectStore(storeName).index(indexName).getAll(value)
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  }))
}

function getAll(storeName) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  }))
}

// ─── Referral codes ───────────────────────────────────────────────────────
// Mỗi user (uuid) có đúng 1 mã giới thiệu, sinh 1 lần và giữ ổn định.
function makeCode(uuid) {
  const base = (uuid || '').replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase()
  return `GM-${base || 'ANON'}-${rand}`
}

export async function getOrCreateReferralCode(uuid) {
  if (!uuid) return null
  const existing = await tx('codes', 'readonly', s => s.get(uuid))
  if (existing) return existing.code
  const code = makeCode(uuid)
  await tx('codes', 'readwrite', s => s.put({ uuid, code, createdAt: new Date().toISOString() }))
  return code
}

export async function resolveReferrerByCode(code) {
  if (!code) return null
  const rows = await getAll('codes')
  return rows.find(r => r.code === code)?.uuid || null
}

// ─── Referral relationships ───────────────────────────────────────────────
// Ghi nhận đúng 1 lần: nếu refereeUuid đã có quan hệ rồi thì bỏ qua (không
// cho phép "đổi tuyến trên" giữa chừng).
export async function getReferralFor(refereeUuid) {
  const rows = await getAllByIndex('referrals', 'by_referee', refereeUuid)
  return rows[0] || null
}

export async function saveReferral({ referrerUuid, refereeUuid, code, source = 'games' }) {
  if (!referrerUuid || !refereeUuid || referrerUuid === refereeUuid) return null
  const already = await getReferralFor(refereeUuid)
  if (already) return already
  const id = await tx('referrals', 'readwrite', s => s.add({
    referrerUuid, refereeUuid, code, source,
    chainStatus: 'pending', txHash: null,
    createdAt: new Date().toISOString(),
  }))
  return { id, referrerUuid, refereeUuid, code, source }
}

export async function getReferralsByReferrer(referrerUuid) {
  return getAllByIndex('referrals', 'by_referrer', referrerUuid)
}

// Gỡ quan hệ upline SAI/rác khỏi IndexedDB local (đi kèm DELETE phía server
// trong AffiliateUUIDReferralPanel.jsx). Chỉ nên gọi khi chainStatus CHƯA
// 'synced' — xem lý do trong api/affiliate-referral.js.
export async function deleteReferralFor(refereeUuid) {
  const rows = await getAllByIndex('referrals', 'by_referee', refereeUuid)
  await Promise.all(rows.map((r) => tx('referrals', 'readwrite', s => s.delete(r.id))))
}

export async function markReferralSynced(id, txHash) {
  const row = await tx('referrals', 'readonly', s => s.get(id))
  if (!row) return
  await tx('referrals', 'readwrite', s => s.put({ ...row, chainStatus: 'synced', txHash }))
}

export async function markReferralFailed(id, errorMessage) {
  const row = await tx('referrals', 'readonly', s => s.get(id))
  if (!row) return
  await tx('referrals', 'readwrite', s => s.put({ ...row, chainStatus: 'failed', error: errorMessage }))
}

// ─── Game progress (from PORTAL_GAME_RESULT postMessage) ─────────────────
export async function recordGameProgress({ uuid, gameId, gameTitle, status, score, timeSec, meta }) {
  if (!uuid) return null
  return tx('progress', 'readwrite', s => s.add({
    uuid, gameId, gameTitle, status, score: Number(score) || 0,
    timeSec: Number(timeSec) || 0, meta: meta || null,
    createdAt: new Date().toISOString(),
  }))
}

export async function getGameProgress(uuid) {
  return getAllByIndex('progress', 'by_uuid', uuid)
}

// ─── Reward ledger ─────────────────────────────────────────────────────────
// kind: 'ad_watch' | 'game_complete' | 'referral_commission'
export async function addReward({ uuid, kind, amount, currency = 'VIET', gameId = null, refereeUuid = null, level = null, note = null }) {
  if (!uuid) return null
  const id = await tx('rewards', 'readwrite', s => s.add({
    uuid, kind, amount, currency, gameId, refereeUuid, level, note,
    chainStatus: 'pending', txHash: null,
    createdAt: new Date().toISOString(),
  }))
  return id
}

export async function getRewards(uuid) {
  const rows = await getAllByIndex('rewards', 'by_uuid', uuid)
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export async function getPendingRewards() {
  return getAllByIndex('rewards', 'by_status', 'pending')
}

export async function markRewardSynced(id, txHash) {
  const row = await tx('rewards', 'readonly', s => s.get(id))
  if (!row) return
  await tx('rewards', 'readwrite', s => s.put({ ...row, chainStatus: 'synced', txHash }))
}

export async function markRewardFailed(id, errorMessage) {
  const row = await tx('rewards', 'readonly', s => s.get(id))
  if (!row) return
  await tx('rewards', 'readwrite', s => s.put({ ...row, chainStatus: 'failed', error: errorMessage }))
}

// Ghi thưởng cho người chơi (uuid) và, nếu người này có tuyến trên (đã vào
// game qua link giới thiệu), tự động cộng thêm hoa hồng cho NGƯỜI GIỚI
// THIỆU TRỰC TIẾP (F1) và, nếu có, NGƯỜI GIỚI THIỆU CỦA NGƯỜI ĐÓ (F2) — đây
// chính là phần "nhận thưởng" của Affiliate: người giới thiệu được ăn hoa
// hồng cả từ F1 lẫn F2 chơi game, không chỉ F1.
//
// commissionRates: mảng tỉ lệ theo cấp — mặc định [10%, 5%] khớp với
// levelRates trên smart-contract HienMauAffiliate.sol (level 1 = 10%,
// level 2 = 5%; level 3 = 2% đã có sẵn on-chain nhưng chưa cần hiển thị ở
// đây theo yêu cầu hiện tại — chỉ F1/F2).
//
// LƯU Ý ON-CHAIN: contract HienMauAffiliate.rewardTask() đã tự động chia
// hoa hồng lên toàn bộ tuyến trên (F1, F2, F3...) NGAY TRONG CÙNG 1 giao
// dịch của người chơi (uuid) — các dòng "commission" trả về bên dưới CHỈ để
// hiển thị local, KHÔNG được gửi thành giao dịch on-chain riêng. Sau khi
// giao dịch rewardTask() của `primaryId` thành công, gọi
// markRewardSynced(commissionId, cùng txHash đó) cho MỌI commissionId trong
// mảng `commissions` — xem gameAffiliateChain.js.
export async function addRewardWithReferralCommission({ uuid, kind, amount, currency = 'VIET', gameId = null, note = null, commissionRates = [0.1, 0.05] }) {
  const primaryId = await addReward({ uuid, kind, amount, currency, gameId, note })
  const commissions = []

  let currentUuid = uuid
  for (let level = 1; level <= commissionRates.length; level += 1) {
    // eslint-disable-next-line no-await-in-loop
    const referral = await getReferralFor(currentUuid)
    if (!referral) break // hết tuyến trên (VD: F1 không có ai giới thiệu nữa thì không có F2)

    const rate = commissionRates[level - 1]
    const commissionAmount = Math.round(amount * rate)
    if (commissionAmount > 0) {
      // eslint-disable-next-line no-await-in-loop
      const commissionId = await addReward({
        uuid: referral.referrerUuid,
        kind: 'referral_commission',
        amount: commissionAmount,
        currency,
        gameId,
        refereeUuid: currentUuid,
        level,
        note: `Hoa hồng F${level} chơi game (${note || kind})`,
      })
      commissions.push({ commissionId, level, referrerUuid: referral.referrerUuid, amount: commissionAmount })
    }
    currentUuid = referral.referrerUuid
  }

  return {
    primaryId,
    primaryUuid: uuid,
    commissions,
    // Giữ lại 2 field cũ để tương thích ngược với code gọi trước đây chỉ
    // đọc commissionId/commissionReferrerUuid (tương ứng hoa hồng F1).
    commissionId: commissions[0]?.commissionId || null,
    commissionReferrerUuid: commissions[0]?.referrerUuid || null,
  }
}
