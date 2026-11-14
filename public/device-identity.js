/** Shared by React and standalone same-origin games. IndexedDB is authoritative.
 * A device here means one browser profile + origin, not a hardware fingerprint.
 * Never derive ownership (or deletion candidates) from user-agent/screen/IP.
 */
export const ACTIVE_IDENTITY_KEY = 'cdoc_active_identity'
let dbPromise
export function openIdentityDB() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('cdoc_guest', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('session')) db.createObjectStore('session', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('journey')) {
        const s = db.createObjectStore('journey', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by_date', 'date')
      }
      if (!db.objectStoreNames.contains('inventory')) db.createObjectStore('inventory', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('records')) {
        const s = db.createObjectStore('records', { keyPath: 'id', autoIncrement: true })
        s.createIndex('by_type', 'type')
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' })
    }
    req.onsuccess = () => {
      const db = req.result
      db.onversionchange = () => { db.close(); dbPromise = null }
      resolve(db)
    }
    req.onerror = () => { dbPromise = null; reject(req.error) }
  })
  return dbPromise
}

function parse(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback } catch { return fallback }
}
export function readNamedIdentity() {
  const email = parse('cdoc_session')?.email
  return email ? parse('cdoc_users', {})[email] || null : null
}
export function publishIdentity(user) {
  // Cache only; no secrets/tokens. Allows synchronous consumers in sub-apps.
  const identity = user?.uuid ? { uuid: user.uuid, userId: user.userId || null, name: user.name || null } : null
  try {
    if (identity) localStorage.setItem(ACTIVE_IDENTITY_KEY, JSON.stringify(identity))
    else localStorage.removeItem(ACTIVE_IDENTITY_KEY)
    globalThis.dispatchEvent?.(new Event('cdoc-identity-changed'))
  } catch { /* IndexedDB remains the source of truth. */ }
  return identity
}
export function readActiveIdentity() {
  return readNamedIdentity() || parse(ACTIVE_IDENTITY_KEY)
}

export function createGuestProfile() {
  return {
    uuid: `HEALTH-${crypto.randomUUID()}`,
    name: 'Guest Explorer', given_name: 'Guest', family_name: 'Explorer',
    email: null, provider: 'anonymous', isAnonymous: true, isAdmin: false,
    avatar: null, avatarCustomized: false, specialty: '', phone: '',
    profileComplete: false, level: 1, journeyProgress: 0, achievements: 0,
    createdAt: new Date().toISOString(),
  }
}

function claimUnownedRows(t, uuid) {
  for (const name of ['journey', 'inventory', 'records']) {
    const cursor = t.objectStore(name).openCursor()
    cursor.onsuccess = () => {
      const c = cursor.result
      if (!c) return
      if (!c.value.ownerUuid) c.update({ ...c.value, ownerUuid: uuid })
      c.continue()
    }
  }
}

/** Read + create in ONE transaction, including across tabs/StrictMode mounts.
 * No fallback UID if IDB is blocked: fail rather than silently fork an identity.
 * Named UUIDs can never be restored as anonymous, including legacy stale rows.
 */
export async function getOrCreateAnonymous() {
  const db = await openIdentityDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['session', 'journey', 'inventory', 'records'], 'readwrite')
    const store = t.objectStore('session')
    let user
    const req = store.get('anon')
    req.onsuccess = () => {
      const row = req.result
      const uuid = row?.uuid || row?.anonUUID
      const claimed = Object.values(parse('cdoc_users', {})).some(u => u?.uuid === uuid)
      if (uuid && claimed) claimUnownedRows(t, uuid) // recover interrupted upgrade
      user = uuid && !claimed ? {
        given_name: '', family_name: '', specialty: '', phone: '',
        avatarCustomized: false, profileComplete: false,
        level: 1, journeyProgress: 0, achievements: 0,
        ...row, uuid,
      } : createGuestProfile()
      delete user.anonUUID
      user = { ...user, id: 'anon', email: null, provider: 'anonymous', isAnonymous: true, isAdmin: false }
      store.put(user)
    }
    t.oncomplete = () => resolve(user)
    t.onerror = t.onabort = () => reject(t.error || new Error('Không lưu được UID vào IndexedDB.'))
  })
}

/** Commit upgrade only AFTER the account was saved successfully.
 * Claim unowned legacy data + remove the guest pointer atomically; do not
 * delete any progress and never consume a different/newer guest's session.
 */
export async function consumeAnonymous(uuid) {
  const db = await openIdentityDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(['session', 'journey', 'inventory', 'records'], 'readwrite')
    const store = t.objectStore('session')
    const req = store.get('anon')
    req.onsuccess = () => {
      if ((req.result?.uuid || req.result?.anonUUID) !== uuid) return
      claimUnownedRows(t, uuid)
      store.delete('anon')
    }
    t.oncomplete = () => resolve()
    t.onerror = t.onabort = () => reject(t.error)
  })
}

export async function initializeIdentity() {
  const named = readNamedIdentity()
  if (named?.uuid) { publishIdentity(named); return named }
  const guest = await getOrCreateAnonymous()
  publishIdentity(guest)
  return guest
}

// Serialize complete sign-in/sign-out operations across tabs where supported.
// IDB transactions still serialize guest creation on browsers without Web Locks.
let queue = Promise.resolve()
export function withIdentityLock(fn) {
  if (globalThis.navigator?.locks) return navigator.locks.request('cdoc-identity', fn)
  const result = queue.then(fn, fn)
  queue = result.catch(() => {})
  return result
}
