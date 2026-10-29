// api/_lib/gonArenaVotesR2.js
// Ghi 1 vote của chế độ GON Arena (so sánh ẨN DANH 2 model AI bất kỳ — mặc
// định Groq vs Gemini, có thể đổi bằng key-user, xem arenaUserKeyEngines.js —
// kiểu arena.ai / LMArena) lên Cloudflare R2.
//
// R2 là object storage — không append vào 1 file được — nên MỖI vote là 1
// object JSON riêng dưới prefix `gon-arena/votes/`:
//   gon-arena/votes/<iso-timestamp>-<random>.json
// Sau này tổng hợp bảng xếp hạng bằng listR2Keys({ prefix: 'gon-arena/votes/' })
// rồi đọc từng object (khối lượng nhỏ, đủ cho thống kê cộng đồng).
//
// Vote là ẨN DANH: không lưu user id, IP, cookie... chỉ lưu lựa chọn, mapping
// model (đã lộ sau khi vote ở client), và tóm tắt input để phân tích sau.

import { uploadBufferToR2, getR2PublicUrl } from './r2Storage.js'
import { ARENA_ENGINE_NAMES } from './arenaUserKeyEngines.js'

export class GonArenaVoteError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'GonArenaVoteError'
    this.status = status
  }
}

const VALID_VOTES = new Set(['a', 'b', 'tie'])
// 14 engine arena (xem arenaUserKeyEngines.js): 'groq'/'gemini' chạy bằng key
// pool server + 12 engine chạy bằng key của user (openai, anthropic, xai,
// deepseek, perplexity, fireworks, mistral, cerebras, githubmodels,
// huggingface, together, openrouter) — vote vẫn được ghi khi 1 bên chạy lại
// bằng key-user và 2 bên là 2 engine KHÁC NHAU.
const VALID_ENGINES = new Set(ARENA_ENGINE_NAMES)

/**
 * @param {object} params
 * @param {'a'|'b'|'tie'} params.vote - bên được chọn (a/b) hoặc hoà (tie)
 * @param {string} params.modelA - engine thật đứng sau "Model A" (ARENA_ENGINE_NAMES)
 * @param {string} params.modelB - engine thật đứng sau "Model B" (ARENA_ENGINE_NAMES)
 * @param {string} [params.description] - mô tả/text người dùng nhập (cắt tối đa 500 ký tự)
 * @param {string[]} [params.videoUrls] - tối đa 2 link video đã dùng cho trận đấu
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ url: string }>} URL public của object JSON vote trên R2
 */
export async function recordGonArenaVote({ vote, modelA, modelB, description, videoUrls, envSource = process.env }) {
  if (!VALID_VOTES.has(vote)) {
    throw new GonArenaVoteError('Vote không hợp lệ — chỉ nhận "a", "b" hoặc "tie".', 400)
  }
  if (!VALID_ENGINES.has(modelA) || !VALID_ENGINES.has(modelB) || modelA === modelB) {
    throw new GonArenaVoteError(`modelA/modelB không hợp lệ — phải là 2 engine arena khác nhau trong: ${ARENA_ENGINE_NAMES.join(', ')}.`, 400)
  }

  const now = new Date()
  const stamp = now.toISOString().replace(/[:.]/g, '-')
  const rand = Math.random().toString(36).slice(2, 10)
  const key = `gon-arena/votes/${stamp}-${rand}.json`

  const doc = {
    vote,
    modelA,
    modelB,
    // Quy về TÊN ENGINE để thống kê nhanh (wins per model) mà không phải suy
    // ngược từ mapping a/b mỗi lần tổng hợp.
    winner: vote === 'tie' ? null : vote === 'a' ? modelA : modelB,
    description: String(description || '').slice(0, 500),
    videoUrls: Array.isArray(videoUrls) ? videoUrls.slice(0, 2).map((u) => String(u).slice(0, 500)) : [],
    createdAt: now.toISOString(),
  }

  await uploadBufferToR2({
    buffer: Buffer.from(JSON.stringify(doc, null, 2)),
    key,
    contentType: 'application/json',
    envSource,
  })

  return { url: getR2PublicUrl(key, { envSource }) }
}
