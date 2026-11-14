import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { verifyGoogleAccessToken, linkGoogleIdentity } from '../api/_lib/googleIdentity.js'
const profile = { sub: 'google-sub-1', email: 'one@example.com', name: 'One', email_verified: true }
const secret = 'random-device-secret-at-least-16-chars'
const digest = createHash('sha256').update(secret).digest('hex')
const googleFetch = (token = {}, user = {}) => async url => ({
  ok: true, json: async () => url.includes('tokeninfo')
    ? { aud: 'client-id', sub: profile.sub, expires_in: 3600, ...token }
    : { ...profile, ...user },
})

test('Google verification checks audience, expiry, subject, verified email', async () => {
  assert.equal((await verifyGoogleAccessToken('token', googleFetch(), 'client-id')).sub, profile.sub)
  for (const [token, user] of [
    [{ aud: 'other-app' }, {}], [{ expires_in: 0 }, {}],
    [{ sub: 'other-sub' }, {}], [{}, { email_verified: false }],
  ]) {
    await assert.rejects(verifyGoogleAccessToken('token', googleFetch(token, user), 'client-id'), e => e.status === 401)
  }
})

test('Google verification rejects missing server config and upstream denial', async () => {
  await assert.rejects(verifyGoogleAccessToken('token', googleFetch(), ''), e => e.status === 503)
  await assert.rejects(verifyGoogleAccessToken('', googleFetch(), 'client-id'), e => e.status === 401)
  await assert.rejects(verifyGoogleAccessToken('bad', async () => ({ ok: false }), 'client-id'), e => e.status === 401)
})

function collection(find) {
  const writes = []
  const indexes = []
  return {
    writes, indexes,
    createIndex: async (key, options) => indexes.push({ key, options }),
    findOne: async query => find(query),
    updateOne: async (...args) => { writes.push(args); return { matchedCount: 1 } },
  }
}

test('new Google account takes exact anonymous UID; no token persisted', async () => {
  const col = collection(() => null)
  const result = await linkGoogleIdentity(col, { uuid: 'anon-1', secret, accessToken: 'never-save' }, profile)
  assert.equal(result.uuid, 'anon-1')
  assert.equal(col.indexes.length, 3)
  assert.ok(col.indexes.every(i => i.options.unique))
  const [filter, update] = col.writes[0]
  assert.equal(filter.uuid, 'anon-1')
  assert.equal(update.$setOnInsert.uuid, 'anon-1')
  assert.equal(update.$addToSet.googleDeviceSecretHashes, digest)
  assert.ok(!JSON.stringify(col.writes).includes('never-save'))
})

test('returning Google on another device keeps original UID, not pending guest UID', async () => {
  const col = collection(query => query.googleSub ? { uuid: 'original', googleSub: profile.sub, userId: 'One' } : null)
  const result = await linkGoogleIdentity(col, { uuid: 'pending-guest-2', secret }, profile)
  assert.equal(result.uuid, 'original')
  assert.equal(col.writes[0][0].uuid, 'original')
})

test('historical local/server UID conflict fails before writing', async () => {
  const col = collection(query => query.googleSub ? { uuid: 'server-old', googleSub: profile.sub } : null)
  await assert.rejects(linkGoogleIdentity(col, { uuid: 'local-old', secret, existingAccount: true }, profile), e => e.status === 409)
  assert.equal(col.writes.length, 0)
})

test('cannot link a second Google subject to an already consumed UID', async () => {
  const col = collection(query => query.uuid ? { uuid: 'anon-1', googleSub: 'different-google' } : null)
  await assert.rejects(linkGoogleIdentity(col, { uuid: 'anon-1', secret }, profile), e => e.status === 409)
  assert.equal(col.writes.length, 0)
})

test('anonymous owner secret must match before attaching Google', async () => {
  const col = collection(query => query.uuid ? { uuid: 'anon-1', secretHash: 'someone-elses-secret' } : null)
  await assert.rejects(linkGoogleIdentity(col, { uuid: 'anon-1', secret }, profile), e => e.status === 403)
  assert.equal(col.writes.length, 0)
})

test('index failure fails closed without updating identity', async () => {
  const col = collection(() => null)
  col.createIndex = async () => { throw new Error('legacy duplicate uuid') }
  await assert.rejects(linkGoogleIdentity(col, { uuid: 'anon-1', secret }, profile), /duplicate/)
  assert.equal(col.writes.length, 0)
})

test('concurrent first link recovers the winning subject mapping', async () => {
  let calls = 0
  const col = collection(query => query.googleSub && ++calls > 1 ? { uuid: 'winner', userId: 'One' } : null)
  col.updateOne = async (...args) => {
    col.writes.push(args)
    if (col.writes.length === 1) throw Object.assign(new Error('duplicate'), { code: 11000 })
  }
  assert.equal((await linkGoogleIdentity(col, { uuid: 'candidate', secret }, profile)).uuid, 'winner')
  assert.equal(col.writes[1][0].uuid, 'winner')
})
