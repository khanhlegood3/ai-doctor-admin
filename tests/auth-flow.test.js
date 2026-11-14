import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'
import 'fake-indexeddb/auto'

const storage = new Map()
globalThis.localStorage = {
  getItem: k => storage.get(k) || null,
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: k => storage.delete(k),
}
globalThis.window = new EventTarget()
window.crypto = globalThis.crypto
window.location = { reload() {} }
window.alert = () => {}
let googleEmail, failGoogle, failRegistration, renderer, auth, server, AuthProvider, useAuth
const googleAccounts = new Map()
window.google = { accounts: { oauth2: {
  initTokenClient: ({ callback }) => ({ requestAccessToken: () => callback({ access_token: 'test-transient-token' }) }),
} } }
globalThis.fetch = async (url, options) => {
  if (String(url).includes('googleapis.com')) return { ok: true, json: async () => ({ email: googleEmail, name: googleEmail, picture: 'photo', email_verified: true }) }
  const body = options?.body ? JSON.parse(options.body) : {}
  if (body.action === 'loginWithGoogle') {
    if (failGoogle) return { ok: false, json: async () => ({ error: 'Google server unavailable' }) }
    if (!googleAccounts.has(googleEmail)) googleAccounts.set(googleEmail, body.uuid)
    return { ok: true, json: async () => ({ uuid: googleAccounts.get(googleEmail) }) }
  }
  if (body.password && failRegistration) return { ok: false, status: 409, json: async () => ({ error: 'Email taken' }) }
  return { ok: true, json: async () => ({}) }
}
function Probe() { auth = useAuth(); return null }
async function mount() {
  await act(async () => {
    renderer = create(React.createElement(AuthProvider, null, React.createElement(Probe)))
    await new Promise(resolve => setTimeout(resolve, 30))
  })
  assert.equal(auth.loading, false)
}
before(async () => {
  process.env.VITE_GOOGLE_CLIENT_ID = 'test-client'
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  ;({ AuthProvider, useAuth } = await server.ssrLoadModule('/src/context/AuthContext.jsx'))
})
after(async () => { await act(async () => renderer?.unmount()); await server.close() })
beforeEach(async () => {
  await act(async () => renderer?.unmount())
  storage.clear(); googleAccounts.clear(); failGoogle = false; failRegistration = false
  const module = await server.ssrLoadModule('/public/device-identity.js')
  const db = await module.openIdentityDB()
  await new Promise((resolve, reject) => {
    const t = db.transaction([...db.objectStoreNames], 'readwrite')
    for (const name of db.objectStoreNames) t.objectStore(name).clear()
    t.oncomplete = resolve; t.onerror = () => reject(t.error)
  })
})

test('real AuthProvider: visit → Google1 → guest2 → Google1 → Google2 → guest3', async () => {
  await mount()
  const uid1 = auth.user.uuid
  assert.equal(auth.user.isAnonymous, true)
  await act(async () => { await auth.updateProfile({ level: 8, journeyProgress: 42, uuid: 'must-not-change' }) })
  assert.equal(auth.user.uuid, uid1)
  googleEmail = 'one@example.com'
  await act(async () => { await auth.loginWithGoogle() })
  assert.equal(auth.user.uuid, uid1)
  assert.equal(auth.user.isAnonymous, false)
  assert.equal(auth.user.level, 8)
  assert.equal(auth.user.journeyProgress, 42)
  assert.ok(!localStorage.getItem('cdoc_users').includes('test-transient-token'))
  await act(async () => { await auth.logout() })
  const uid2 = auth.user.uuid
  assert.notEqual(uid2, uid1)
  assert.equal(localStorage.getItem('cdoc_session'), null)
  await act(async () => { await auth.loginWithGoogle() })
  assert.equal(auth.user.uuid, uid1)
  await act(async () => { await auth.logout() })
  assert.equal(auth.user.uuid, uid2)
  googleEmail = 'two@example.com'
  await act(async () => { await auth.loginWithGoogle() })
  assert.equal(auth.user.uuid, uid2)
  await act(async () => { await auth.logout() })
  const uid3 = auth.user.uuid
  assert.notEqual(uid3, uid1); assert.notEqual(uid3, uid2)
  await act(async () => { renderer.unmount() })
  await mount()
  assert.equal(auth.user.uuid, uid3)
})

test('Google API failure keeps original guest and its profile', async () => {
  await mount()
  const uuid = auth.user.uuid
  failGoogle = true; googleEmail = 'one@example.com'
  await act(async () => { await assert.rejects(auth.loginWithGoogle(), /unavailable/) })
  assert.equal(auth.user.uuid, uuid)
  assert.equal(auth.user.isAnonymous, true)
  await act(async () => { await auth.loginAnonymous() })
  assert.equal(auth.user.uuid, uuid)
})

test('referral does not change UID and failed email registration does not consume guest', async () => {
  await mount()
  const uuid = auth.user.uuid
  globalThis.sessionStorage = { getItem: () => JSON.stringify({ uuid }) }
  failRegistration = true
  await act(async () => {
    await assert.rejects(auth.loginWithEmail('taken@example.com', 'password123', 'Person'), /taken/)
  })
  assert.equal(auth.user.uuid, uuid)
  failRegistration = false
  googleEmail = 'one@example.com'
  await act(async () => { await auth.loginWithGoogle() })
  assert.equal(auth.user.uuid, uuid)
})
