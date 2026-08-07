// api/_lib/dinoPalProxy.js
// Logic sinh TÍNH CÁCH cho thú ảo "Dino pal" (chuyển thể từ dino-pal.zip).
// Bản gốc gọi Gemini (@google/genai, model "gemini-3-flash-preview") với
// `responseSchema` để ép JSON đúng khuôn — Groq (api.groq.com) không hỗ trợ
// responseSchema kiểu Gemini, nên ở đây dùng `response_format: json_object`
// + mô tả rõ khuôn JSON cần trả về ngay trong prompt, giống cách
// api/_lib/geminiComic.js đang làm cho nhánh sinh kịch bản Comic Hero.
//
// TÁI SỬ DỤNG GROQ_API_KEY đã có sẵn trong dự án (chatbot chính +
// api/groq-whisper.js + Comic Hero) — miễn phí thật, không cần API key
// riêng cho Dino pal. Có key pool/auto-rotation qua withApiKeyRotation
// (xem api/_lib/apiKeyPool.js).
//
// Được import bởi:
//   - api/groq-proxy.js → Vercel Serverless Function (production), nhánh
//     provider: 'dino-pal' (dùng chung endpoint, không tạo function mới vì
//     Vercel giới hạn 12 Serverless Functions).
//   - vite.config.js    → middleware dev-server, để `npm run dev` cũng
//     gọi Groq thật, không cần deploy lên Vercel mới test được.

import { withApiKeyRotation, toRotatableHttpError } from './apiKeyPool.js'

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1'
const TEXT_MODEL = 'llama-3.3-70b-versatile'

export class DinoPalProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.status = status
  }
}

// Khuôn JSON mong muốn, mô tả trực tiếp trong prompt (thay cho
// responseSchema của Gemini) — Groq với response_format: json_object chỉ
// đảm bảo output là JSON hợp lệ, không đảm bảo đúng field, nên prompt liệt
// kê rõ từng field bắt buộc.
function buildPrompt(name) {
  return `You are generating a virtual pet profile for a Google Chrome Dino (T-Rex) named "${name}". The dino is the classic pixelated character from the "No Internet" page. Give it a unique personality (e.g., hyperactive runner, cactus-avoider, sleepy crawler).

Requirements for each response array (write 2-4 short, playful lines per array):
1. feed: Thank for a specific favorite treat (favoriteFood).
2. play: Mention jumping over things or running fast.
3. injured: Explain how they tripped over a cactus.
4. nightmare: Describe a world with too many high-speed cacti or a "Connection Restored" screen.
5. dream: MUST be in parentheses like "(dreaming about infinite deserts...)".
6. facts: Dino facts or trivia about the 2014 Chrome Dino game.
7. angry: Grumpy about lagging or being stuck.
8. stateIdle, stateHungry, stateTired, stateHappy, stateSick, stateScared: short 8-bit style reactions.
9. finalLegacy: ONE heartwarming ending sentence (string, not array) about the long run they've had together.

Respond with ONLY a single JSON object (no markdown, no code fences), matching EXACTLY this shape:
{
  "name": string,
  "species": string,
  "traits": string[3],
  "adultTraits": string[3],
  "likes": string[2],
  "dislikes": string[2],
  "favoriteFood": string,
  "favoriteActivity": string,
  "nightmareDescription": string,
  "responses": {
    "feed": string[],
    "play": string[],
    "injured": string[],
    "nightmare": string[],
    "dream": string[],
    "facts": string[],
    "angry": string[],
    "stateIdle": string[],
    "stateHungry": string[],
    "stateTired": string[],
    "stateHappy": string[],
    "stateSick": string[],
    "stateScared": string[],
    "finalLegacy": string
  }
}`
}

// Fallback an toàn cho từng field bắt buộc, phòng khi Groq trả thiếu field
// nào đó (response_format: json_object không đảm bảo đủ field như
// responseSchema của Gemini) — tránh crash UI của Dino pal ở phía client.
const FALLBACK_RESPONSES = {
  feed: ['Nom nom nom!'],
  play: ['Zooming past the cacti!'],
  injured: ['Ouch, tripped on a cactus!'],
  nightmare: ['No signal... buffering...'],
  dream: ['(dreaming about infinite deserts...)'],
  facts: ['Did you know I first appeared on the "No Internet" page in 2014?'],
  angry: ['Connection reset!'],
  stateIdle: ['Searching for network...'],
  stateHungry: ['Getting hungry...'],
  stateTired: ['Feeling sleepy...'],
  stateHappy: ['Feeling great!'],
  stateSick: ['Not feeling well...'],
  stateScared: ['Something scared me!'],
  finalLegacy: 'The server uptime was legendary.',
}

function withFallbackResponses(responses) {
  const safe = { ...FALLBACK_RESPONSES, ...(responses || {}) }
  for (const key of Object.keys(FALLBACK_RESPONSES)) {
    if (key === 'finalLegacy') {
      if (typeof safe.finalLegacy !== 'string' || !safe.finalLegacy.trim()) {
        safe.finalLegacy = FALLBACK_RESPONSES.finalLegacy
      }
      continue
    }
    if (!Array.isArray(safe[key]) || safe[key].length === 0) {
      safe[key] = FALLBACK_RESPONSES[key]
    }
  }
  return safe
}

export async function runDinoPalGenerate({ name, envSource } = {}) {
  const cleanName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 20) : 'Rex'

  const body = {
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: buildPrompt(cleanName) }],
    response_format: { type: 'json_object' },
    temperature: 0.9,
  }

  const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
    const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
    return res.json()
  }, { envSource })

  const raw = data?.choices?.[0]?.message?.content || '{}'
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new DinoPalProxyError('Dino pal: AI trả về JSON không hợp lệ, thử lại nhé.', 502)
  }

  const traits = Array.isArray(parsed.traits) && parsed.traits.length ? parsed.traits : ['Pixelated', 'Curious', 'Glitchy']
  const adultTraits = Array.isArray(parsed.adultTraits) && parsed.adultTraits.length ? parsed.adultTraits : ['Cybernetic', 'High-Bandwidth', 'Legendary']

  return {
    personality: {
      name: cleanName,
      species: parsed.species || 'T-Rex',
      traits,
      adultTraits,
      likes: Array.isArray(parsed.likes) && parsed.likes.length ? parsed.likes : ['Wifi', 'Chrome'],
      dislikes: Array.isArray(parsed.dislikes) && parsed.dislikes.length ? parsed.dislikes : ['Offline Mode', 'Lag'],
      favoriteFood: parsed.favoriteFood || 'Cookies',
      favoriteActivity: parsed.favoriteActivity || 'Running',
      nightmareDescription: parsed.nightmareDescription || 'The connection timed out...',
      responses: withFallbackResponses(parsed.responses),
    },
  }
}
