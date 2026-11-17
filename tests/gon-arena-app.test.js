import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { create, act } from 'react-test-renderer'
import { createServer } from 'vite'
import 'fake-indexeddb/auto'

const prefix = '/src/bring-any-idea-to-life-khanh/src/'
let server, App, renderer, failSave = false
const requests = []
globalThis.window = new EventTarget()
window.indexedDB = indexedDB
window.location = { search: '', origin: 'https://test.example' }
window.localStorage = globalThis.localStorage = { getItem: () => null, removeItem() {} }
globalThis.fetch = async (_url, options) => {
  const body = JSON.parse(options.body)
  assert.equal(body.action, 'save-comparison')
  requests.push(body.comparison)
  return failSave
    ? { ok: false, status: 503, json: async () => ({ error: 'Mongo unavailable' }) }
    : { ok: true, status: 200, json: async () => ({ saved: true, id: body.comparison.id, revision: body.comparison.revision, jsonUrl: 'https://files.example/comparison.json' }) }
}
// Only presentation and generation/network boundaries are mocked. App's
// state/effects and the actual IndexedDB outbox run unchanged.
before(async () => {
  server = await createServer({
    configFile: false, server: { middlewareMode: true }, appType: 'custom',
    plugins: [{ name: 'gon-app-boundaries', enforce: 'pre', load(id) {
      if (!id.includes(prefix)) return
      if (id.endsWith('/lib/api.ts')) return `
        export const ARENA_ENGINES = ['groq', 'gemini'];
        export const ARENA_PROVIDER_INFO = { groq: { label: 'Groq', modelLabel: 'Qwen' }, gemini: { label: 'Gemini', modelLabel: 'Flash' } };
        export const getSessionUserApiKey = () => undefined;
        export const setSessionUserApiKey = () => {};
        export const searchVideoLinks = async () => [];
        export const uploadVideoFileToGemini = async () => {};
        export async function bringToLife(...args) { return globalThis.__gonGenerate(args[10]); }
      `
      if (id.endsWith('/lib/historyR2Client.ts')) return `
        export const loadAllCreationsFromR2 = async () => [];
        export const loadCreationFromR2 = async () => {};
        export const saveCreationToR2 = async () => ({});
        export const uploadSourceFileToR2 = async () => ({});
      `
      const component = id.match(/\/components\/(Hero|InputArea|LivePreview|CreationHistory|DemoTemplates|OneShotArcadeCard|ArenaDuel)\.tsx$/)?.[1]
      if (component) return `
        export function ${component}(props) { globalThis.__gon${component} = props; return null; }
        export const getCreationSourceKey = item => item.videoUrl || item.id;
      `
    } }],
  })
  App = (await server.ssrLoadModule(`${prefix}App.tsx`)).default
})
after(async () => { await act(async () => renderer?.unmount()); await server.close() })
async function flush(waitForSave = false) {
  const deadline = Date.now() + 3000
  do {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 15)) })
    if (!waitForSave || ['saved', 'error'].includes(globalThis.__gonArenaDuel?.saveStatus)) return
  } while (Date.now() < deadline)
  assert.fail('Timed out waiting for IndexedDB/network save to settle')
}

test('App auto-saves both results, records vote, reports failure honestly, retries, and reuses archived result', async () => {
  globalThis.__gonGenerate = async engine => `<html>${engine} educational game</html>`
  await act(async () => { renderer = create(React.createElement(App)) })
  await flush()
  await act(async () => { await globalThis.__gonInputArea.onBattle('Làm game giáo dục', ['https://youtu.be/example']) })
  await act(async () => { globalThis.__gonArenaDuel.onConfirmBattle() })
  await flush(true)
  let duel = globalThis.__gonArenaDuel
  assert.equal(duel.sides.a.status, 'done'); assert.equal(duel.sides.b.status, 'done')
  assert.equal(duel.vote, null); assert.equal(duel.revealedLabels, null)
  assert.equal(duel.saveStatus, 'saved')
  assert.equal(requests.length, 1)
  assert.ok(requests[0].results.a.html.includes('educational game'))
  assert.ok(requests[0].results.b.html.includes('educational game'))
  assert.equal(globalThis.__gonCreationHistory.history.length, 2)

  failSave = true
  await act(async () => { duel.onVote('b') })
  await flush(true)
  duel = globalThis.__gonArenaDuel
  assert.equal(duel.vote, 'b'); assert.equal(duel.saveStatus, 'error')
  assert.match(duel.saveError, /Mongo unavailable/)
  assert.equal(requests[1].vote, 'b')
  assert.equal(requests[1].id, requests[0].id)
  assert.equal(requests[1].winner, requests[1].modelB)

  failSave = false
  await act(async () => { duel.onRetrySave() })
  await flush(true)
  duel = globalThis.__gonArenaDuel
  assert.equal(duel.saveStatus, 'saved')
  assert.equal(requests[2].revision, requests[1].revision)
  await act(async () => { duel.onUseVersion('a') })
  assert.equal(globalThis.__gonLivePreview.creation.id, requests[0].results.a.id)
  assert.equal(globalThis.__gonCreationHistory.history.length, 2)
})

test('App preserves an errored model alongside the successful model and judges the correct engine', async () => {
  await act(async () => renderer.unmount())
  requests.length = 0
  globalThis.__gonGenerate = async engine => {
    if (engine === 'groq') throw new Error('Video không có phụ đề')
    return '<html>Successful Gemini game</html>'
  }
  await act(async () => { renderer = create(React.createElement(App)) })
  await flush()
  await act(async () => { await globalThis.__gonInputArea.onBattle('Screenshot regression', ['https://youtu.be/example']) })
  await act(async () => { globalThis.__gonArenaDuel.onConfirmBattle() })
  await flush(true)
  const result = requests[0]
  const errorSide = result.modelA === 'groq' ? 'a' : 'b'
  const winnerSide = errorSide === 'a' ? 'b' : 'a'
  assert.equal(result.results[errorSide].status, 'error')
  assert.equal(result.results[errorSide].error, 'Video không có phụ đề')
  assert.equal(result.results[winnerSide].html, '<html>Successful Gemini game</html>')
  await act(async () => { globalThis.__gonArenaDuel.onVote(winnerSide) })
  await flush(true)
  assert.equal(requests[1].winner, 'gemini')
  assert.equal(globalThis.__gonArenaDuel.saveStatus, 'saved')
})
