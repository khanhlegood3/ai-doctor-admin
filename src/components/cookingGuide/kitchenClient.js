// src/components/cookingGuide/kitchenClient.js
// Client AI cho tính năng "Hướng Dẫn Nấu Ăn Ngon Và Khỏe Mạnh".
//
// Bản gốc "Function Call Kitchen" (Google AI Studio) gọi thẳng Gemini
// (@google/genai) từ trình duyệt bằng function-calling (tools) nhiều lượt.
// Dự án này KHÔNG có Gemini API key production và bị giới hạn 12 Serverless
// Functions trên Vercel (xem api/groq-proxy.js), nên phần "bộ não AI" của
// trò chơi được viết lại để gọi qua endpoint /api/groq-proxy sẵn có (nhánh
// Groq mặc định, tương thích OpenAI Chat Completions + JSON mode), KHÔNG
// cần thêm route mới. Giữ nguyên tinh thần 2 "agent" của bản gốc:
//   1) Combination agent: (hành động + nguyên liệu) → món/nguyên liệu mới
//   2) Verification agent: (tên đơn hàng + món đã phục vụ) → có khớp không
// và bổ sung thêm 1 "agent" lập kế hoạch để có tính năng "Nhờ AI tự nấu",
// cùng 1 "agent" vẽ ảnh minh hoạ "mâm cơm" khi phục vụ đơn hàng thành công
// — TÁI SỬ DỤNG đúng hạ tầng sinh ảnh của tính năng "Tạo Game bằng Avatar
// của Tôi" (xem src/components/comicHero/geminiComicClient.js +
// api/_lib/geminiComic.js — nhánh ảnh gọi Pollinations.AI ẩn danh, miễn
// phí), thay vì viết lại một đường gọi ảnh riêng.

import { generateComicImage } from '../comicHero/geminiComicClient.js'

const MODEL = 'llama-3.3-70b-versatile'

async function callGroqJSON(messages, { temperature = 0.7, maxTokens = 300 } = {}) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' },
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || `Lỗi máy chủ AI (${res.status})`
    throw new Error(msg)
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('AI không trả về nội dung hợp lệ.')
  try {
    return JSON.parse(content)
  } catch {
    // Cố gắng bóc tách JSON nếu model lỡ thêm chữ thừa quanh khối JSON
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* rơi xuống dưới */ }
    }
    throw new Error('Không đọc được JSON phản hồi từ AI.')
  }
}

/**
 * Agent 1 — Kết hợp nguyên liệu: cho một thao tác nấu + danh sách nguyên
 * liệu, hỏi AI xem ra món/nguyên liệu gì tiếp theo.
 */
export async function generateCombination(action, ingredientLabels) {
  const system = `Bạn là bộ máy sinh kết quả nấu ăn cho một trò chơi ẩm thực Việt Nam lành mạnh.
Cho một THAO TÁC NẤU và danh sách NGUYÊN LIỆU, hãy xác định món ăn hoặc thành phần chế biến ra được.
Trả lời CHỈ bằng một đối tượng JSON hợp lệ, không thêm chữ nào khác, gồm đúng 2 trường:
- "result_name": tên món/kết quả bằng tiếng Việt, ngắn gọn (1-5 từ)
- "emoji": một emoji duy nhất đại diện cho kết quả
Hãy sáng tạo nhưng vẫn hợp lý về ẩm thực, ưu tiên phong cách món Việt lành mạnh, ít dầu mỡ khi hợp lý.`
  const user = `Thao tác: ${action.label} (${action.name}). Nguyên liệu đang dùng: ${ingredientLabels.join(', ')}.`
  const parsed = await callGroqJSON(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.85, maxTokens: 150 }
  )
  return {
    name: String(parsed.result_name || 'Món ăn lạ'),
    emoji: String(parsed.emoji || '🍽️').slice(0, 4),
  }
}

/**
 * Agent 2 — Xác minh: kiểm tra món đã phục vụ có khớp với đơn hàng không
 * (khớp theo nghĩa, không cần đúng chữ tuyệt đối).
 */
export async function verifyServedDish(orderName, servedDishName) {
  const system = `Bạn là trợ lý thẩm định món ăn. Cho tên MỘT ĐƠN HÀNG và tên MỘT MÓN ĐÃ PHỤC VỤ,
hãy xác định 2 tên đó có cùng chỉ một món ăn hay không (chấp nhận cách gọi khác nhau, viết hoa/thường,
có dấu/không dấu, tên tiếng Việt hoặc tiếng Anh của cùng món).
Trả lời CHỈ bằng JSON hợp lệ, đúng 3 trường:
- "matches": true hoặc false
- "confidence": số từ 0 đến 1
- "explanation": giải thích ngắn gọn bằng tiếng Việt (1 câu)`
  const user = `Đơn hàng: "${orderName}". Món đã phục vụ: "${servedDishName}".`
  const parsed = await callGroqJSON(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.2, maxTokens: 200 }
  )
  return {
    matches: Boolean(parsed.matches),
    confidence: Number(parsed.confidence) || 0,
    explanation: String(parsed.explanation || ''),
  }
}

/**
 * Agent 3 — Lập kế hoạch tự nấu: thay cho vòng lặp function-calling nhiều
 * lượt của bản gốc (Gemini tools), ở đây xin AI trả về một kế hoạch các
 * bước (thao tác + nguyên liệu) trong MỘT lượt gọi duy nhất, sau đó ứng
 * dụng thực thi tuần tự từng bước qua generateCombination() ở trên.
 */
export async function planAutoCook({ orderName, inventoryLabels, actionOptions }) {
  const system = `Bạn là đầu bếp AI trong một trò chơi nấu ăn. Bạn sẽ lập kế hoạch từng bước để
nấu ra món khách yêu cầu, chỉ dùng nguyên liệu đang có và các thao tác nấu được liệt kê.
Trả lời CHỈ bằng JSON hợp lệ, đúng 2 trường:
- "steps": mảng tối đa 5 bước, mỗi bước là { "action": "<tên thao tác đúng như liệt kê>", "ingredients": ["<tên nguyên liệu đang có>", ...] }
- "final_dish": tên món cuối cùng nên dùng khi phục vụ (tiếng Việt)
Chỉ dùng action.name và ingredient đúng như trong danh sách được cho, không bịa thêm.`
  const user = `Đơn hàng cần nấu: "${orderName}".
Nguyên liệu hiện có: ${inventoryLabels.join(', ')}.
Các thao tác nấu khả dụng: ${actionOptions.join(', ')}.`
  const parsed = await callGroqJSON(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.6, maxTokens: 500 }
  )
  const steps = Array.isArray(parsed.steps) ? parsed.steps.slice(0, 5) : []
  return {
    steps: steps
      .filter(s => s && typeof s.action === 'string')
      .map(s => ({ action: s.action, ingredients: Array.isArray(s.ingredients) ? s.ingredients : [] })),
    finalDish: String(parsed.final_dish || orderName),
  }
}

// ---------------------------------------------------------------------------
// Agent 4 — Vẽ ảnh "mâm cơm": gọi 1 LẦN khi phục vụ đơn hàng THÀNH CÔNG, để
// minh hoạ trực quan món ăn vừa "nấu" xong dưới dạng mâm cơm Việt truyền
// thống. Dùng chung `generateComicImage` từ comicHero (POST /api/groq-proxy
// với provider: 'gemini-comic') — engine phía server tự định tuyến sang
// nhánh ảnh (Pollinations.AI, model "flux", gọi ẩn danh) vì request có
// `config.imageConfig`, không cần sửa gì ở backend.
//
// Auto-retry cho lỗi 429 (giới hạn ~1 ảnh/15 giây/IP của tier ẩn danh —
// xem api/_lib/geminiComic.js) — giống hệt cơ chế trong ComicHeroGamePanel.
// jsx, vì đây cũng là request gọi tới cùng 1 endpoint ảnh đó.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const IMAGE_RATE_LIMIT_RETRY_DELAY_MS = 16000 // hơi hơn 15s cho chắc ăn
const IMAGE_RATE_LIMIT_MAX_RETRIES = 2 // chỉ 1 ảnh/đơn hàng nên không cần thử nhiều như comicHero

/**
 * @param {{ dishName: string, ingredientLabels?: string[] }} params
 * @param {(attempt: number, maxRetries: number) => void} [onRetryWait] gọi mỗi lần chuẩn bị chờ để thử lại (để UI hiển thị tiến độ)
 * @returns {Promise<string>} data URL (base64) của ảnh mâm cơm
 */
export async function generateMealTrayImage({ dishName, ingredientLabels = [] }, onRetryWait) {
  const ingredientNote = ingredientLabels.length > 0
    ? ` Made with: ${ingredientLabels.join(', ')}.`
    : ''
  const promptText = `STYLE: Professional Vietnamese home-cooking food photography, natural window light, appetizing, 3/4 top-down angle, shallow depth of field. No text, no watermark, no people, no hands, no cartoon/anime style — realistic photo only.
SCENE: A traditional Vietnamese "mâm cơm" (round family meal tray) beautifully plated with the dish "${dishName}".${ingredientNote} Served alongside a bowl of steamed white rice and a small dish of nước chấm (dipping sauce), arranged neatly on rustic ceramic plates over a round bamboo tray or wooden table.`

  let attempt = 0
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await generateComicImage({
        contents: { text: promptText },
        config: { imageConfig: { aspectRatio: '3:2' } },
      })
      const part = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
      if (!part?.inlineData?.data) throw new Error('Không nhận được ảnh từ máy chủ.')
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
    } catch (e) {
      if (e?.status === 429 && attempt < IMAGE_RATE_LIMIT_MAX_RETRIES) {
        attempt += 1
        onRetryWait?.(attempt, IMAGE_RATE_LIMIT_MAX_RETRIES)
        // eslint-disable-next-line no-await-in-loop
        await sleep(IMAGE_RATE_LIMIT_RETRY_DELAY_MS)
        continue
      }
      throw e
    }
  }
}
