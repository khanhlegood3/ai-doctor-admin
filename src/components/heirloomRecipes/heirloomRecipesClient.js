// src/components/heirloomRecipes/heirloomRecipesClient.js
// Client AI cho "Bữa ăn heirloom recipes".
//
// Bản gốc "heirloom-recipes" (Google AI Studio) gọi thẳng Gemini
// (@google/genai) từ trình duyệt bằng API key nhúng trong bundle, để:
//   1) "Nhập món từ URL" — Gemini có URL-context tool, tự đọc trang web.
//   2) "AI tự sinh công thức" — cho danh mục + mô tả, trả về công thức đầy đủ.
// Dự án này không có Gemini API key production và giới hạn 12 Serverless
// Functions trên Vercel, nên viết lại để gọi qua /api/groq-proxy sẵn có
// (nhánh Groq mặc định, JSON mode) — CÙNG PATTERN với
// src/components/cookingGuide/kitchenClient.js. Vì Groq không có khả năng
// tự đọc URL, tính năng "nhập món" ở đây nhận URL/văn bản công thức do
// người dùng dán vào và nhờ AI trích xuất/tái cấu trúc thành JSON, thay vì
// tự tải trang — hạn chế này được nêu rõ trong UI (xem HeirloomRecipesPanel).
//
// Ảnh minh hoạ món ăn TÁI SỬ DỤNG đúng hạ tầng sinh ảnh của "Tạo Game bằng
// Avatar của Tôi" (generateComicImage — nhánh ảnh gọi Pollinations.AI ẩn
// danh, miễn phí), giống hệt cách kitchenClient.js đã làm cho "mâm cơm".

import { generateComicImage } from '../comicHero/geminiComicClient.js'
import { CATEGORIES } from '../../lib/heirloomRecipesStorage.js'

const MODEL = 'llama-3.3-70b-versatile'

async function callGroqJSON(messages, { temperature = 0.6, maxTokens = 700 } = {}) {
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
    const match = content.match(/\{[\s\S]*\}/)
    if (match) {
      try { return JSON.parse(match[0]) } catch { /* rơi xuống dưới */ }
    }
    throw new Error('Không đọc được JSON phản hồi từ AI.')
  }
}

function normalizeRecipeJSON(parsed) {
  const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'Other'
  return {
    title: String(parsed.title || 'Món chưa đặt tên').slice(0, 120),
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.map(String).slice(0, 40) : [],
    instructions: Array.isArray(parsed.instructions) ? parsed.instructions.map(String).slice(0, 30) : [],
    category,
    estimatedTime: Number.isFinite(Number(parsed.estimatedTime)) ? Number(parsed.estimatedTime) : null,
  }
}

const RECIPE_JSON_SHAPE = `Trả lời CHỈ bằng một đối tượng JSON hợp lệ, không thêm chữ nào khác, gồm đúng 5 trường:
- "title": tên món ăn, ngắn gọn
- "ingredients": mảng chuỗi, mỗi phần tử là 1 nguyên liệu kèm số lượng (vd "200g thịt ba chỉ")
- "instructions": mảng chuỗi, mỗi phần tử là 1 bước nấu theo thứ tự
- "category": một trong các giá trị sau: ${CATEGORIES.join(', ')}
- "estimatedTime": số phút ước tính để nấu xong (số nguyên, hoặc null nếu không rõ)`

/**
 * Agent 1 — AI tự sinh công thức mới, dựa trên danh mục món + mô tả/yêu
 * cầu tự do của người dùng (thay cho form "Generate Recipe" của bản gốc).
 */
export async function generateRecipeIdea({ category, details }) {
  const system = `Bạn là đầu bếp AI, chuyên tạo công thức nấu ăn gia đình rõ ràng, dễ làm theo.
${RECIPE_JSON_SHAPE}`
  const user = `Danh mục món: ${category}.\nYêu cầu/mô tả thêm từ người dùng: ${details || '(không có, tự sáng tạo một món hợp lý)'}.`
  const parsed = await callGroqJSON(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.8, maxTokens: 700 }
  )
  return normalizeRecipeJSON(parsed)
}

/**
 * Agent 2 — "Nhập món" từ URL hoặc văn bản công thức do người dùng dán
 * vào, nhờ AI trích xuất/tái cấu trúc thành JSON chuẩn. Khác bản gốc
 * (Gemini tự tải nội dung trang qua URL-context tool), ở đây Groq không
 * đọc được URL trực tiếp nên nếu người dùng chỉ dán link, AI sẽ dựa vào
 * chính đường link + kiến thức sẵn có để suy đoán công thức hợp lý — UI
 * khuyến khích dán kèm nội dung công thức (tiêu đề, nguyên liệu, các
 * bước) để có kết quả chính xác hơn.
 */
export async function importRecipeFromText(rawInput) {
  const system = `Bạn là trợ lý trích xuất công thức nấu ăn. Người dùng sẽ đưa cho bạn một đường link và/hoặc
đoạn văn bản có thể chứa một công thức nấu ăn. Hãy đọc kỹ và trích xuất thành công thức có cấu trúc.
Nếu văn bản không đủ chi tiết (vd chỉ có link, không có nội dung), hãy suy đoán một công thức hợp lý
dựa trên tên món/ngữ cảnh trong link, và vẫn trả về đầy đủ JSON theo đúng định dạng.
${RECIPE_JSON_SHAPE}`
  const user = `Nội dung người dùng cung cấp:\n${rawInput}`
  const parsed = await callGroqJSON(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { temperature: 0.4, maxTokens: 700 }
  )
  const normalized = normalizeRecipeJSON(parsed)
  const looksLikeUrl = /^https?:\/\//i.test(String(rawInput).trim())
  return { ...normalized, sourceUrl: looksLikeUrl ? String(rawInput).trim() : '' }
}

// ---------------------------------------------------------------------------
// Agent 3 — Vẽ ảnh minh hoạ món ăn khi lưu công thức (tuỳ chọn, người dùng
// bấm nút riêng). TÁI SỬ DỤNG generateComicImage (POST /api/groq-proxy với
// provider: 'gemini-comic') — engine phía server tự định tuyến sang nhánh
// ảnh (Pollinations.AI, model "flux", gọi ẩn danh) — giống hệt cơ chế
// generateMealTrayImage trong kitchenClient.js.
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const IMAGE_RATE_LIMIT_RETRY_DELAY_MS = 16000
const IMAGE_RATE_LIMIT_MAX_RETRIES = 2

export async function generateRecipeImage({ title, ingredients = [] }, onRetryWait) {
  const ingredientNote = ingredients.length > 0 ? ` Made with: ${ingredients.slice(0, 6).join(', ')}.` : ''
  const promptText = `STYLE: Professional home-cooking food photography, natural window light, appetizing, 3/4 top-down angle, shallow depth of field. No text, no watermark, no people, no hands, no cartoon/anime style — realistic photo only.
SCENE: A beautifully plated home-cooked dish: "${title}".${ingredientNote} Served on a simple ceramic plate on a rustic wooden table, styled like a cherished family heirloom recipe photo.`

  let attempt = 0
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await generateComicImage({
        contents: { text: promptText },
        config: { imageConfig: { aspectRatio: '4:3' } },
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
