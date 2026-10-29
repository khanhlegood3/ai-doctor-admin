// api/_lib/arenaUserKeyEngines.js
// GON ARENA — hỗ trợ "API key của chính user" cho MỌI nhà cung cấp AI phổ
// biến (không chỉ Groq/Gemini nội bộ). Khi engine mặc định (key pool server)
// lỗi, user dán key của mình vào ô retry trên ArenaDuel.tsx; client ĐOÁN
// nhà cung cấp từ prefix key (gsk_ → Groq, AIza → Gemini, sk-or- →
// OpenRouter, sk-ant- → Anthropic, xai- → xAI, pplx- → Perplexity,
// github_pat_/ghp_ → GitHub Models, hf_ → Hugging Face, csk- → Cerebras,
// fw_ → Fireworks, sk- → OpenAI...) hoặc chọn thủ công khi key không có
// prefix riêng (Mistral/DeepSeek/Together dùng chuỗi ngẫu nhiên/sk- trùng
// OpenAI). detectEngineFromApiKey trong src/bring-any-idea-to-life-khanh/
// src/lib/api.ts giữ CÙNG bảng prefix này — hai phía luôn phải khớp nhau.
//
// Chỉ tính: key của user chỉ sống trong request này (không log, không lưu).
// Engine mới chỉ hỗ trợ codegen 1 bước từ TEXT (+ transcript nếu có link
// video) — chưa hỗ trợ ảnh trực tiếp (arena không gửi ảnh), nhưng đủ để
// so sánh khả năng sinh game/app giữa các nhà cung cấp.
//
// Model mặc định của từng nhà cung cấp có thể override bằng env
// ARENA_MODEL_<ENGINE> (vd ARENA_MODEL_OPENAI=gpt-4.1) nếu cần đổi mà không
// sửa code — nếu nhà cung cấp khai tử model mặc định, chỉ cần set env hoặc
// sửa hằng số trong bảng dưới (giống pattern GROQ_VISION_MODEL).

export class ArenaUserKeyEngineError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'ArenaUserKeyEngineError'
    this.status = status
  }
}

// Bảng nhà cung cấp. prefix: danh sách prefix đặc trưng (rỗng = không nhận
// diện tự động được, chỉ chọn thủ công). api: 'openai-compatible' (POST
// {baseUrl}/chat/completions, Authorization Bearer) hoặc 'anthropic'
// (Messages API riêng).
export const ARENA_USER_KEY_ENGINE_TABLE = {
  openai: {
    label: 'OpenAI',
    model: 'gpt-4.1-mini',
    api: 'openai-compatible',
    baseUrl: 'https://api.openai.com/v1',
    prefixes: ['sk-proj-', 'sk-svcacct-', 'sk-'],
    // sk- trùng với DeepSeek/OpenRouter — openrouter có prefix riêng
    // (sk-or-) được check trước; DeepSeek (sk-) sẽ bị đoán thành openai, user
    // chọn thủ công nếu là DeepSeek.
    prefixExclusions: ['sk-or-'],
    keyPageUrl: 'https://platform.openai.com/api-keys',
  },
  openrouter: {
    label: 'OpenRouter',
    model: 'openai/gpt-4o-mini',
    api: 'openai-compatible',
    baseUrl: 'https://openrouter.ai/api/v1',
    prefixes: ['sk-or-'],
    keyPageUrl: 'https://openrouter.ai/keys',
  },
  anthropic: {
    label: 'Anthropic (Claude)',
    model: 'claude-sonnet-4-5',
    api: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    prefixes: ['sk-ant-'],
    keyPageUrl: 'https://console.anthropic.com/settings/keys',
  },
  xai: {
    label: 'xAI (Grok)',
    model: 'grok-3-mini',
    api: 'openai-compatible',
    baseUrl: 'https://api.x.ai/v1',
    prefixes: ['xai-'],
    keyPageUrl: 'https://console.x.ai/',
  },
  deepseek: {
    label: 'DeepSeek',
    model: 'deepseek-chat',
    api: 'openai-compatible',
    baseUrl: 'https://api.deepseek.com',
    prefixes: [], // key DeepSeek cũng dạng sk-... (trùng OpenAI) — chỉ chọn thủ công
    keyPageUrl: 'https://platform.deepseek.com/api_keys',
  },
  perplexity: {
    label: 'Perplexity',
    model: 'sonar',
    api: 'openai-compatible',
    baseUrl: 'https://api.perplexity.ai',
    prefixes: ['pplx-'],
    keyPageUrl: 'https://www.perplexity.ai/settings/api',
  },
  fireworks: {
    label: 'Fireworks AI',
    model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
    api: 'openai-compatible',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    prefixes: ['fw_'],
    keyPageUrl: 'https://fireworks.ai/account/api-keys',
  },
  mistral: {
    label: 'Mistral AI',
    model: 'mistral-small-latest',
    api: 'openai-compatible',
    baseUrl: 'https://api.mistral.ai/v1',
    prefixes: [], // key Mistral là chuỗi ngẫu nhiên 32 ký tự — chỉ chọn thủ công
    keyPageUrl: 'https://console.mistral.ai/api-keys',
  },
  cerebras: {
    label: 'Cerebras',
    model: 'llama-3.3-70b',
    api: 'openai-compatible',
    baseUrl: 'https://api.cerebras.ai/v1',
    prefixes: ['csk-'],
    keyPageUrl: 'https://cloud.cerebras.ai/',
  },
  githubmodels: {
    label: 'GitHub Models',
    model: 'gpt-4o-mini',
    api: 'openai-compatible',
    baseUrl: 'https://models.inference.ai.azure.com',
    prefixes: ['github_pat_', 'ghp_'], // fine-grained PAT / classic PAT (dùng free qua GitHub Models)
    keyPageUrl: 'https://github.com/settings/tokens',
  },
  huggingface: {
    label: 'Hugging Face',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    api: 'openai-compatible',
    baseUrl: 'https://router.huggingface.co/v1',
    prefixes: ['hf_'],
    keyPageUrl: 'https://huggingface.co/settings/tokens',
  },
  together: {
    label: 'Together AI',
    model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    api: 'openai-compatible',
    baseUrl: 'https://api.together.xyz/v1',
    prefixes: [], // key Together là hex ngẫu nhiên — chỉ chọn thủ công
    keyPageUrl: 'https://api.together.xyz/settings/api-keys',
  },
}

/** Tên TẤT CẢ engine arena hợp lệ (cả 2 engine nội bộ chạy bằng key server). */
export const ARENA_ENGINE_NAMES = ['groq', 'gemini', ...Object.keys(ARENA_USER_KEY_ENGINE_TABLE)]

export function isArenaEngineName(value) {
  return typeof value === 'string' && ARENA_ENGINE_NAMES.includes(value)
}

/** Engine chạy bằng key của user (không có key pool phía server). */
export function isArenaUserKeyEngine(value) {
  return Object.prototype.hasOwnProperty.call(ARENA_USER_KEY_ENGINE_TABLE, value)
}

/**
 * Validate prefix key của user cho engine tương ứng — client cũng check bằng
 * đúng bảng này (detectEngineFromApiKey, lib/api.ts); engine KHÔNG có prefix
 * riêng (Mistral/DeepSeek/Together) bỏ qua validate, chấp nhận mọi chuỗi.
 */
export function assertArenaUserKeyMatchesEngine(engine, apiKey) {
  const info = ARENA_USER_KEY_ENGINE_TABLE[engine]
  if (!info) return // groq/gemini được validate riêng trong bringAnyIdeaToLifeProxy.js
  if (!info.prefixes.length) return // chỉ chọn thủ công — không có format đặc trưng để check
  const key = String(apiKey || '').trim()
  const matches = info.prefixes.some((prefix) => key.startsWith(prefix))
    && !(info.prefixExclusions || []).some((excluded) => key.startsWith(excluded))
  if (!matches) {
    throw new ArenaUserKeyEngineError(
      `API key không đúng định dạng của ${info.label} (thường bắt đầu bằng "${info.prefixes[0]}..."). Nếu key thuộc nhà cung cấp khác, hãy chọn lại nhà cung cấp cho đúng.`,
      400,
    )
  }
}

const REQUEST_TIMEOUT_MS = 100_000 // dưới maxDuration 120s của api/groq-proxy.js

// Output tối đa của 1 app HTML/JS hoàn chỉnh — 8192 tokens là mức AN TOÀN cho
// mọi nhà cung cấp (DeepSeek giới hạn 8192, các bên khác chấp nhận cao hơn);
// cũng ngang mức codegen của nhánh Groq nội bộ nên phép so sánh tương đối đều.
const DEFAULT_MAX_TOKENS = 8192

async function requestOpenAICompatible({ baseUrl, apiKey, model, systemInstruction, userContent, maxTokens = DEFAULT_MAX_TOKENS }) {
  let res
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent },
        ],
        max_tokens: maxTokens,
        temperature: 0.4,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    throw new ArenaUserKeyEngineError(isTimeout ? 'Nhà cung cấp này phản hồi quá lâu (timeout) — thử lại sau.' : `Không kết nối được nhà cung cấp: ${err?.message || err}`, 502)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const upstreamMessage = data?.error?.message || data?.error || res.statusText
    throw new ArenaUserKeyEngineError(`Nhà cung cấp từ chối key/request (HTTP ${res.status}): ${String(upstreamMessage).slice(0, 300)}`, res.status === 401 || res.status === 403 ? 401 : 502)
  }
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new ArenaUserKeyEngineError('Model không trả về nội dung — thử lại hoặc đổi model.', 502)
  }
  return content
}

async function requestAnthropic({ apiKey, model, systemInstruction, userContent, maxTokens = DEFAULT_MAX_TOKENS }) {
  let res
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: systemInstruction,
        messages: [{ role: 'user', content: userContent }],
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (err) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError'
    throw new ArenaUserKeyEngineError(isTimeout ? 'Anthropic phản hồi quá lâu (timeout) — thử lại sau.' : `Không kết nối được Anthropic: ${err?.message || err}`, 502)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const upstreamMessage = data?.error?.message || res.statusText
    throw new ArenaUserKeyEngineError(`Anthropic từ chối key/request (HTTP ${res.status}): ${String(upstreamMessage).slice(0, 300)}`, res.status === 401 || res.status === 403 ? 401 : 502)
  }
  const text = (data?.content || []).filter((block) => block?.type === 'text').map((block) => block.text).join('\n')
  if (!text.trim()) {
    throw new ArenaUserKeyEngineError('Anthropic không trả về nội dung — thử lại hoặc đổi model.', 502)
  }
  return text
}

/**
 * Sinh 1 app HTML hoàn chỉnh bằng key của CHÍNH user cho engine bất kỳ.
 * @param {object} params
 * @param {string} params.engine - tên engine trong ARENA_USER_KEY_ENGINE_TABLE
 * @param {string} params.apiKey - key của user (chỉ sống trong request này)
 * @param {string} params.prompt - prompt đầy đủ (đã gồm mô tả + directive)
 * @param {string} [params.transcript] - transcript video nếu input là link video
 * @param {string} params.systemInstruction - SYSTEM_INSTRUCTION chính của app (truyền từ proxy để dùng chung 1 chuẩn)
 * @param {Record<string,string>} [params.envSource] - cho phép override model bằng env ARENA_MODEL_<ENGINE>
 * @returns {Promise<string>} HTML thô (caller tự cleanHtml)
 */
export async function runArenaUserKeyGenerate({ engine, apiKey, prompt, transcript, systemInstruction, envSource }) {
  const info = ARENA_USER_KEY_ENGINE_TABLE[engine]
  if (!info) {
    throw new ArenaUserKeyEngineError(`Engine "${engine}" không hỗ trợ key người dùng.`, 400)
  }
  assertArenaUserKeyMatchesEngine(engine, apiKey)

  const envModel = envSource?.[`ARENA_MODEL_${engine.toUpperCase()}`]
  const model = envModel || info.model

  const userContent = transcript
    ? `${prompt}\n\nVIDEO TRANSCRIPT (spoken captions of the source video):\n${transcript}`
    : prompt

  const rawText = info.api === 'anthropic'
    ? await requestAnthropic({ apiKey, model, systemInstruction, userContent })
    : await requestOpenAICompatible({ baseUrl: info.baseUrl, apiKey, model, systemInstruction, userContent })

  return { html: rawText, modelUsed: model, provider: info.label }
}
