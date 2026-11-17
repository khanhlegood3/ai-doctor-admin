import test, { before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'vite'
import 'fake-indexeddb/auto'

let server, storage
before(async () => {
  server = await createServer({ configFile: false, server: { middlewareMode: true }, appType: 'custom' })
  storage = await server.ssrLoadModule('/src/bring-any-idea-to-life-khanh/src/lib/arenaComparisonStorage.ts')
})
after(async () => server.close())
beforeEach(async () => {
  await new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase('gon-arena-history-db')
    req.onsuccess = resolve; req.onerror = () => reject(req.error)
  })
})
function arena() {
  return {
    id: randomUUID(), revision: 2, description: 'Game giáo dục', videoUrls: ['https://youtu.be/example'],
    mapping: { a: 'groq', b: 'gemini' }, vote: null, votedAt: null, createdAt: '2026-11-14T01:00:00Z',
    sides: {
      a: { id: randomUUID(), status: 'done', html: '<html>Game A</html>', completedAt: '2026-11-14T01:01:00Z' },
      b: { id: randomUUID(), status: 'error', error: 'Video không có phụ đề', completedAt: '2026-11-14T01:02:00Z' },
    },
  }
}
const receipt = payload => ({ id: payload.id, revision: payload.revision, jsonUrl: 'https://files.example/match.json', saved: true })
const deferred = () => {
  let resolve
  const promise = new Promise(r => { resolve = r })
  return { promise, resolve }
}

test('snapshot stores full HTML + failure + exact vote mapping, never key form fields', () => {
  const a = arena()
  a.vote = 'b'; a.votedAt = '2026-11-14T01:03:00Z'; a.userApiKey = 'secret-not-allowed'
  a.sides.a.apiKey = 'secret-not-allowed'
  const payload = storage.buildArenaComparison(a)
  assert.equal(payload.winner, 'gemini')
  assert.equal(payload.results.a.html, '<html>Game A</html>')
  assert.equal(payload.results.b.error, 'Video không có phụ đề')
  assert.ok(!JSON.stringify(payload).includes('secret-not-allowed'))
})

test('does not snapshot an unfinished side', () => {
  const a = arena(); a.sides.b = { status: 'loading' }
  assert.throws(() => storage.buildArenaComparison(a), /chưa hoàn tất/)
})

test('persists both results and vote in IndexedDB before sending', async () => {
  const payload = storage.buildArenaComparison(arena())
  await storage.persistArenaComparison(payload, async p => {
    const [row] = await storage.getArenaComparisons()
    assert.deepEqual(row.comparison, payload); assert.equal(row.pending, true)
    return receipt(p)
  })
  const [row] = await storage.getArenaComparisons()
  assert.equal(row.pending, false); assert.equal(row.jsonUrl, 'https://files.example/match.json')
})

test('network/DB failure preserves local outbox and can be retried without duplication', async () => {
  const payload = storage.buildArenaComparison(arena())
  await assert.rejects(storage.persistArenaComparison(payload, async () => { throw new Error('Mongo unavailable') }), /Mongo/)
  let [row] = await storage.getArenaComparisons()
  assert.equal(row.pending, true); assert.equal(row.comparison.results.a.html, payload.results.a.html)
  await storage.persistArenaComparison(payload, async p => receipt(p))
  const rows = await storage.getArenaComparisons()
  assert.equal(rows.length, 1); assert.equal(rows[0].pending, false)
})

test('vote is durable immediately even while earlier network save is still running; stale ACK cannot clear it', async () => {
  const payload = storage.buildArenaComparison(arena())
  const started1 = deferred(), complete1 = deferred(), started2 = deferred(), complete2 = deferred()
  const first = storage.persistArenaComparison(payload, async p => { started1.resolve(); await complete1.promise; return receipt(p) })
  await started1.promise
  const voted = { ...payload, revision: 3, vote: 'a', winner: 'groq', votedAt: '2026-11-14T01:03:00Z' }
  const second = storage.persistArenaComparison(voted, async p => { started2.resolve(); await complete2.promise; return receipt(p) })
  let [row] = await storage.getArenaComparisons()
  assert.equal(row.comparison.vote, 'a'); assert.equal(row.pending, true)
  complete1.resolve(); await first; await started2.promise
  ;[row] = await storage.getArenaComparisons()
  assert.equal(row.comparison.revision, 3); assert.equal(row.pending, true)
  complete2.resolve(); await second
  ;[row] = await storage.getArenaComparisons()
  assert.equal(row.pending, false); assert.equal(row.comparison.vote, 'a')
})

test('simultaneous identical saves are coalesced', async () => {
  const payload = storage.buildArenaComparison(arena()), wait = deferred()
  let calls = 0
  const send = async p => { calls++; await wait.promise; return receipt(p) }
  const first = storage.persistArenaComparison(payload, send)
  const second = storage.persistArenaComparison(payload, send)
  assert.equal(first, second)
  wait.resolve(); await Promise.all([first, second])
  assert.equal(calls, 1)
})

test('persisted pending results are retried after reopening/online without generating again', async () => {
  const payload = storage.buildArenaComparison(arena())
  await assert.rejects(storage.persistArenaComparison(payload, async () => { throw new Error('Offline') }))
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body)
    assert.equal(body.action, 'save-comparison')
    assert.deepEqual(body.comparison, payload)
    return { ok: true, json: async () => receipt(body.comparison) }
  }
  const results = await storage.retryPendingArenaComparisons()
  assert.equal(results[0].status, 'fulfilled')
  assert.equal((await storage.getArenaComparisons())[0].pending, false)
})

test('transport refuses HTTP failure or partial/unconfirmed storage responses', async () => {
  const payload = storage.buildArenaComparison(arena())
  for (const response of [
    { ok: false, status: 503, json: async () => ({ error: 'R2 failed' }) },
    { ok: true, status: 200, json: async () => ({ ok: true }) },
    { ok: true, status: 200, json: async () => ({ ...receipt(payload), revision: 1 }) },
  ]) {
    globalThis.fetch = async () => response
    await assert.rejects(storage.sendArenaComparison(payload))
  }
})
