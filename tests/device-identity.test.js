import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {
  getOrCreateAnonymous, consumeAnonymous, initializeIdentity, openIdentityDB,
  readActiveIdentity, publishIdentity,
} from '../public/device-identity.js'
import { updateAnonSession } from '../src/lib/anonDB.js'

const values = new Map()
globalThis.localStorage = {
  getItem: k => values.get(k) || null,
  setItem: (k, v) => values.set(k, String(v)),
  removeItem: k => values.delete(k),
}
async function transaction(stores, fn) {
  const db = await openIdentityDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(stores, 'readwrite')
    fn(t)
    t.oncomplete = resolve
    t.onerror = t.onabort = () => reject(t.error)
  })
}
async function rows(store) {
  const db = await openIdentityDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).getAll()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
beforeEach(async () => {
  values.clear()
  await transaction(['session', 'journey', 'inventory', 'records', 'settings'], t => {
    for (const store of t.objectStoreNames) t.objectStore(store).clear()
  })
})

test('first visit creates and persists a UID before exposing it to sub-apps', async () => {
  const first = await initializeIdentity()
  assert.ok(first.uuid.startsWith('HEALTH-'))
  assert.equal((await rows('session')).length, 1)
  assert.equal(readActiveIdentity().uuid, first.uuid)
  assert.equal((await initializeIdentity()).uuid, first.uuid)
})

test('parallel calls/tabs/StrictMode produce exactly one UID', async () => {
  const users = await Promise.all(Array.from({ length: 30 }, () => getOrCreateAnonymous()))
  assert.equal(new Set(users.map(u => u.uuid)).size, 1)
  assert.equal((await rows('session')).length, 1)
})

test('legacy anonUUID is restored unchanged', async () => {
  await transaction('session', t => t.objectStore('session').put({ id: 'anon', anonUUID: 'legacy-uid', level: 7 }))
  const u = await getOrCreateAnonymous()
  assert.equal(u.uuid, 'legacy-uid')
  assert.equal(u.level, 7)
  assert.equal(u.anonUUID, undefined)
})

test('UID1→Google1, UID2→Google2, UID3 sequence preserves all owned data', async () => {
  const u1 = await initializeIdentity()
  await transaction(['journey', 'inventory', 'records'], t => {
    t.objectStore('journey').add({ ownerUuid: u1.uuid, xp: 30 })
    t.objectStore('inventory').put({ id: 'item-1', ownerUuid: null, price: 70 })
    t.objectStore('records').add({ ownerUuid: 'other-named', data: 'never delete' })
  })
  const google1 = { ...u1, email: 'one@example.com', isAnonymous: false }
  localStorage.setItem('cdoc_users', JSON.stringify({ [google1.email]: google1 }))
  await consumeAnonymous(u1.uuid)
  localStorage.setItem('cdoc_session', JSON.stringify({ email: google1.email }))
  assert.equal((await initializeIdentity()).uuid, u1.uuid)
  assert.equal((await rows('session')).length, 0) // no eager second guest
  localStorage.removeItem('cdoc_session')
  const u2 = await initializeIdentity()
  assert.notEqual(u2.uuid, u1.uuid)
  // Re-enter Google1 while UID2 is pending: do not consume UID2.
  localStorage.setItem('cdoc_session', JSON.stringify({ email: google1.email }))
  assert.equal((await initializeIdentity()).uuid, u1.uuid)
  localStorage.removeItem('cdoc_session')
  assert.equal((await initializeIdentity()).uuid, u2.uuid)
  const google2 = { ...u2, email: 'two@example.com', isAnonymous: false }
  localStorage.setItem('cdoc_users', JSON.stringify({ [google1.email]: google1, [google2.email]: google2 }))
  await consumeAnonymous(u2.uuid)
  const u3 = await initializeIdentity()
  assert.notEqual(u3.uuid, u1.uuid)
  assert.notEqual(u3.uuid, u2.uuid)
  assert.equal((await rows('session')).length, 1)
  assert.equal((await rows('inventory'))[0].ownerUuid, u1.uuid)
  assert.equal((await rows('journey'))[0].xp, 30)
  assert.equal((await rows('records'))[0].ownerUuid, 'other-named')
})

test('failed registration / cancelled popup does not consume or change the guest', async () => {
  const u = await initializeIdentity()
  // Resolving a candidate is read-only w.r.t. account upgrade.
  assert.equal((await getOrCreateAnonymous()).uuid, u.uuid)
  assert.equal((await initializeIdentity()).uuid, u.uuid)
})

test('an interrupted upgrade never recycles a Google-owned UID as anonymous', async () => {
  const u = await initializeIdentity()
  await transaction('inventory', t => t.objectStore('inventory').put({ id: 'old-unowned' }))
  localStorage.setItem('cdoc_users', JSON.stringify({ google: { uuid: u.uuid } }))
  const next = await getOrCreateAnonymous()
  assert.notEqual(next.uuid, u.uuid)
  assert.equal((await rows('inventory'))[0].ownerUuid, u.uuid)
})

test('consume is conditional and idempotent; it never deletes a newer guest', async () => {
  const u = await initializeIdentity()
  await consumeAnonymous('not-this-uid')
  assert.equal((await getOrCreateAnonymous()).uuid, u.uuid)
  await consumeAnonymous(u.uuid)
  await consumeAnonymous(u.uuid)
  const next = await getOrCreateAnonymous()
  await consumeAnonymous(u.uuid)
  assert.equal((await getOrCreateAnonymous()).uuid, next.uuid)
})

test('profile patch cannot mutate UID or recreate a consumed session', async () => {
  const u = await initializeIdentity()
  await updateAnonSession({ uuid: 'replace-uid', name: 'New name' }, u.uuid)
  assert.equal((await rows('session'))[0].uuid, u.uuid)
  await consumeAnonymous(u.uuid)
  assert.equal(await updateAnonSession({ name: 'late' }, u.uuid), null)
  const next = await getOrCreateAnonymous()
  assert.equal(await updateAnonSession({ name: 'late' }, u.uuid), null)
  assert.equal((await rows('session'))[0].uuid, next.uuid)
})

test('named identity takes priority over the anonymous cache', async () => {
  publishIdentity({ uuid: 'pending-guest' })
  localStorage.setItem('cdoc_users', JSON.stringify({ 'one@example.com': { uuid: 'google-uid' } }))
  localStorage.setItem('cdoc_session', JSON.stringify({ email: 'one@example.com' }))
  assert.equal(readActiveIdentity().uuid, 'google-uid')
})
