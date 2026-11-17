import { ARENA_PROVIDER_INFO, type ArenaEngine } from './api';
import type { ArenaSideState, ArenaVoteChoice } from '../components/ArenaDuel';

export interface ArenaComparison {
  schemaVersion: 1;
  id: string;
  revision: number;
  description: string;
  videoUrls: string[];
  modelA: ArenaEngine;
  modelB: ArenaEngine;
  results: Record<'a' | 'b', {
    id: string; modelLabel: string; status: 'done' | 'error'; html: string | null;
    error: string | null; completedAt: string;
  }>;
  vote: ArenaVoteChoice | null;
  winner: ArenaEngine | null;
  comparable: boolean;
  createdAt: string;
  votedAt: string | null;
}
export interface ComparisonReceipt { id: string; revision: number; jsonUrl: string; saved: true }
interface ComparisonRow { id: string; comparison: ArenaComparison; pending: boolean; jsonUrl?: string; error?: string }

// Build from explicit fields only: API keys in sessionStorage or retry forms
// must never be included in JSON, IndexedDB or the database request.
export function buildArenaComparison(arena: {
  id: string; revision: number; description: string; videoUrls: string[];
  mapping: Record<'a' | 'b', ArenaEngine>; sides: Record<'a' | 'b', ArenaSideState>;
  vote: ArenaVoteChoice | null; createdAt: string; votedAt: string | null;
}): ArenaComparison {
  const results = {} as ArenaComparison['results'];
  for (const side of ['a', 'b'] as const) {
    const result = arena.sides[side];
    if (result.status === 'loading' || !result.id || !result.completedAt) throw new Error('Cả hai model chưa hoàn tất.');
    results[side] = {
      id: result.id, modelLabel: ARENA_PROVIDER_INFO[arena.mapping[side]].modelLabel, status: result.status,
      html: result.status === 'done' ? result.html || '' : null,
      error: result.status === 'error' ? result.error || 'Model gặp lỗi' : null,
      completedAt: result.completedAt,
    };
  }
  return {
    schemaVersion: 1, id: arena.id, revision: arena.revision,
    description: arena.description, videoUrls: [...arena.videoUrls],
    modelA: arena.mapping.a, modelB: arena.mapping.b, results,
    vote: arena.vote, winner: arena.vote === 'a' ? arena.mapping.a : arena.vote === 'b' ? arena.mapping.b : null,
    comparable: arena.mapping.a !== arena.mapping.b,
    createdAt: arena.createdAt, votedAt: arena.votedAt,
  };
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('gon-arena-history-db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('comparisons', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function updateRow(id: string, fn: (row?: ComparisonRow) => ComparisonRow | undefined): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('comparisons', 'readwrite');
      const store = tx.objectStore('comparisons');
      const req = store.get(id);
      req.onsuccess = () => { const next = fn(req.result); if (next) store.put(next); };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function getArenaComparisons(): Promise<ComparisonRow[]> {
  const db = await openDB();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction('comparisons').objectStore('comparisons').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

export async function sendArenaComparison(comparison: ArenaComparison): Promise<ComparisonReceipt> {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'bring-any-idea-to-life-arena-vote', action: 'save-comparison', comparison }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.saved !== true || data.id !== comparison.id || data.revision < comparison.revision || !data.jsonUrl) {
    throw new Error(data.error || `Chưa lưu đủ JSON và database (HTTP ${res.status}).`);
  }
  return data;
}

// Keep saves ordered for each duel and coalesce StrictMode/double-click retries.
// A stale response may never mark a newer local revision as synchronized.
const queues = new Map<string, Promise<unknown>>();
const inFlight = new Map<string, Promise<ComparisonReceipt>>();
export function persistArenaComparison(comparison: ArenaComparison, send = sendArenaComparison): Promise<ComparisonReceipt> {
  const key = `${comparison.id}:${comparison.revision}`;
  const active = inFlight.get(key);
  if (active) return active;
  const staged = updateRow(comparison.id, row => row && row.comparison.revision > comparison.revision ? undefined : {
    id: comparison.id, comparison, pending: true,
  });
  // Attach a rejection handler immediately; the ordered task awaits it later.
  staged.catch(() => {});
  const task = (queues.get(comparison.id) || Promise.resolve()).catch(() => {}).then(async () => {
    await staged;
    try {
      const receipt = await send(comparison);
      await updateRow(comparison.id, row => row?.comparison.revision === comparison.revision ? {
        ...row, pending: false, jsonUrl: receipt.jsonUrl, error: undefined,
      } : undefined);
      return receipt;
    } catch (error) {
      await updateRow(comparison.id, row => row?.comparison.revision === comparison.revision ? {
        ...row, pending: true, error: error instanceof Error ? error.message : 'Không lưu được kết quả.',
      } : undefined);
      throw error;
    }
  });
  queues.set(comparison.id, task);
  inFlight.set(key, task);
  // Both handlers consume the cleanup promise, avoiding unhandled rejections.
  const cleanup = () => {
    inFlight.delete(key);
    if (queues.get(comparison.id) === task) queues.delete(comparison.id);
  };
  task.then(cleanup, cleanup);
  return task;
}
export async function retryPendingArenaComparisons() {
  const rows = await getArenaComparisons();
  return Promise.allSettled(rows.filter(row => row.pending).map(row => persistArenaComparison(row.comparison)));
}

export function downloadArenaComparison(comparison: ArenaComparison) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(comparison, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = `gon-arena-${comparison.id}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
