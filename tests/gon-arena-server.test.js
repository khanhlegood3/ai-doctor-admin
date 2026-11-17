import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { normalizeArenaComparison, saveGonArenaComparison } from '../api/_lib/gonArenaComparisons.js'

function fixture(overrides = {}) {
  return {
    id: randomUUID(), revision: 2, description: 'Làm game giáo dục',
    videoUrls: ['https://www.youtube.com/watch?v=EQuwZIwrmSw'], modelA: 'groq', modelB: 'gemini',
    results: {
      a: { id: randomUUID(), status: 'done', html: '<html>Game A</html>', completedAt: '2026-11-14T01:01:00Z' },
      b: { id: randomUUID(), status: 'done', html: '<html>Game B</html>', completedAt: '2026-11-14T01:02:00Z' },
    },
    vote: null, createdAt: '2026-11-14T01:00:00Z', votedAt: null, ...overrides,
  }
}
function store() {
  const objects = new Map()
  const docs = new Map()
  let mongoFails = false, r2Fails = false
  const col = {
    findOne: async ({ _id }) => docs.get(_id) || null,
    updateOne: async (filter, update) => {
      if (mongoFails) throw new Error('Mongo unavailable')
      const old = docs.get(filter._id)
      if (old && (old.revision >= filter.revision.$lt || old.vote)) {
        throw Object.assign(new Error('duplicate key'), { code: 11000 })
      }
      docs.set(filter._id, { _id: filter._id, ...structuredClone(update.$set) })
    },
  }
  const deps = {
    getCollection: async () => col,
    upload: async ({ key, buffer }) => {
      if (r2Fails) throw new Error('R2 unavailable')
      objects.set(key, JSON.parse(buffer.toString()))
    },
    publicUrl: key => `https://files.example/${key}`,
  }
  return { objects, docs, deps, failMongo: value => { mongoFails = value }, failR2: value => { r2Fails = value } }
}

test('archives full HTML of BOTH sides as JSON and in Mongo; both enter existing creation archive', async () => {
  const input = fixture(), s = store()
  const receipt = await saveGonArenaComparison(input, s.deps)
  assert.equal(receipt.saved, true)
  assert.equal(s.objects.size, 3)
  const key = receipt.jsonUrl.replace('https://files.example/', '')
  assert.equal(s.objects.get(key).results.a.html, input.results.a.html)
  assert.equal(s.objects.get(key).results.b.html, input.results.b.html)
  assert.equal(s.docs.get(input.id).results.b.html, input.results.b.html)
  assert.equal(s.objects.get(`bring-any-idea-to-life/creations/${input.results.a.id}.json`).html, input.results.a.html)
})

test('voting updates the same comparison with the correct winner and both model mappings', async () => {
  const input = fixture(), s = store()
  await saveGonArenaComparison(input, s.deps)
  const voted = { ...input, revision: 3, vote: 'b', votedAt: '2026-11-14T01:03:00Z' }
  const receipt = await saveGonArenaComparison(voted, s.deps)
  const doc = s.docs.get(input.id)
  assert.equal(s.docs.size, 1)
  assert.equal(doc.vote, 'b'); assert.equal(doc.winner, 'gemini')
  assert.equal(doc.results.a.engine, 'groq'); assert.equal(doc.results.b.engine, 'gemini')
  assert.equal(doc.jsonUrl, receipt.jsonUrl)
  assert.equal(s.objects.get(receipt.jsonUrl.replace('https://files.example/', '')).vote, 'b')
})

test('one model failing, including transcript errors in screenshot, is retained alongside winner HTML', async () => {
  const input = fixture(), s = store()
  input.results.a = { ...input.results.a, status: 'error', error: 'Video không có phụ đề', html: undefined }
  input.vote = 'b'; input.votedAt = '2026-11-14T01:03:00Z'
  await saveGonArenaComparison(input, s.deps)
  const doc = s.docs.get(input.id)
  assert.equal(doc.results.a.status, 'error')
  assert.equal(doc.results.a.error, 'Video không có phụ đề')
  assert.equal(doc.results.a.html, null)
  assert.equal(doc.results.b.html, '<html>Game B</html>')
  assert.equal(s.objects.size, 2) // failed result has no fake creation HTML
})

test('ties and same-engine retries are archived without attributing a model win', async () => {
  const input = fixture({ vote: 'tie', votedAt: '2026-11-14T01:03:00Z', modelA: 'gemini' })
  const doc = normalizeArenaComparison(input)
  assert.equal(doc.winner, null); assert.equal(doc.comparable, false)
})

test('both failures are still a valid completed comparison', async () => {
  const input = fixture(), s = store()
  for (const side of ['a', 'b']) input.results[side] = { ...input.results[side], status: 'error', error: 'Timeout' }
  await saveGonArenaComparison(input, s.deps)
  assert.equal(s.objects.size, 1)
  assert.equal(s.docs.get(input.id).results.b.status, 'error')
})

test('duplicate retries do not create duplicate rows or snapshots', async () => {
  const input = fixture(), s = store()
  const first = await saveGonArenaComparison(input, s.deps)
  const second = await saveGonArenaComparison(input, s.deps)
  assert.deepEqual(first, second); assert.equal(s.docs.size, 1); assert.equal(s.objects.size, 3)
})

test('older requests cannot overwrite a newer vote or its JSON', async () => {
  const input = fixture(), s = store()
  const voted = { ...input, revision: 3, vote: 'a', votedAt: '2026-11-14T01:03:00Z' }
  const latest = await saveGonArenaComparison(voted, s.deps)
  assert.deepEqual(await saveGonArenaComparison(input, s.deps), latest)
  assert.equal(s.docs.get(input.id).vote, 'a')
})

test('same revision with altered content or changes after final vote are rejected', async () => {
  const input = fixture({ vote: 'a', votedAt: '2026-11-14T01:03:00Z' }), s = store()
  await saveGonArenaComparison(input, s.deps)
  await assert.rejects(saveGonArenaComparison({ ...input, vote: 'b' }, s.deps), e => e.status === 409)
  await assert.rejects(saveGonArenaComparison({ ...input, revision: 4, vote: 'b' }, s.deps), e => e.status === 409)
})

test('R2 failure never acknowledges success or commits Mongo; retry succeeds', async () => {
  const input = fixture(), s = store()
  s.failR2(true)
  await assert.rejects(saveGonArenaComparison(input, s.deps), /R2/)
  assert.equal(s.docs.size, 0)
  s.failR2(false)
  assert.equal((await saveGonArenaComparison(input, s.deps)).saved, true)
})

test('Mongo failure leaves retryable deterministic JSON, never false success', async () => {
  const input = fixture(), s = store()
  s.failMongo(true)
  await assert.rejects(saveGonArenaComparison(input, s.deps), /Mongo/)
  assert.equal(s.docs.size, 0); assert.equal(s.objects.size, 3)
  s.failMongo(false)
  await saveGonArenaComparison(input, s.deps)
  assert.equal(s.docs.size, 1); assert.equal(s.objects.size, 3)
})

test('only explicit comparison fields survive; keys, user ID and client winner are not trusted', () => {
  const input = fixture({ apiKey: 'NEVER-SAVE', uuid: 'NEVER-SAVE', winner: 'fake', vote: 'a', votedAt: '2026-11-14T01:03:00Z' })
  input.results.a.apiKey = 'NEVER-SAVE'
  const doc = normalizeArenaComparison(input)
  assert.ok(!JSON.stringify(doc).includes('NEVER-SAVE'))
  assert.equal(doc.winner, 'groq')
})

test('rejects partial runs, bad IDs/engines/votes/URLs, missing HTML and oversized output without writing', async () => {
  for (const change of [
    { id: '../../invalid' }, { modelA: 'fake' }, { vote: 'bad' }, { revision: 0 },
    { videoUrls: ['javascript:alert(1)'] }, { createdAt: 'not-a-date' },
    { results: { ...fixture().results, a: { status: 'loading' } } },
    { results: { ...fixture().results, a: { ...fixture().results.a, html: '' } } },
    { results: { ...fixture().results, a: { ...fixture().results.a, html: 'x'.repeat(1000001) } } },
  ]) {
    const s = store()
    await assert.rejects(saveGonArenaComparison(fixture(change), s.deps))
    assert.equal(s.objects.size, 0); assert.equal(s.docs.size, 0)
  }
})

test('a request already uploading when a newer vote wins cannot replace that vote', async () => {
  const input = fixture(), s = store()
  let startUpload, continueUpload
  const started = new Promise(resolve => { startUpload = resolve })
  const blocked = new Promise(resolve => { continueUpload = resolve })
  const oldUpload = s.deps.upload
  let first = true
  const oldRequest = saveGonArenaComparison(input, { ...s.deps, upload: async args => {
    if (first) { first = false; startUpload(); await blocked }
    return oldUpload(args)
  } })
  await started
  const newest = await saveGonArenaComparison({ ...input, revision: 3, vote: 'b', votedAt: '2026-11-14T01:03:00Z' }, s.deps)
  continueUpload()
  assert.deepEqual(await oldRequest, newest)
  assert.equal(s.docs.get(input.id).vote, 'b')
  assert.equal(s.docs.get(input.id).jsonUrl, newest.jsonUrl)
})
