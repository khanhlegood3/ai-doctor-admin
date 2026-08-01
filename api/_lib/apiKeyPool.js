// api/_lib/apiKeyPool.js
// ---------------------------------------------------------------------------
// CƠ CHẾ DÙNG CHUNG CHO TOÀN BỘ DỰ ÁN: "API Key Pool + Auto-Rotation".
//
// VẤN ĐỀ: mỗi loại API (Groq, Gemini, Anthropic, ...) hiện chỉ cấu hình 1 biến
// môi trường duy nhất (vd GROQ_API_KEY). Khi key đó hết hạn mức miễn phí /
// hết billing / bị revoke, MỌI request production sẽ lỗi ngay lập tức
// (401/402/429) cho tới khi có người nạp thêm tiền hoặc đổi key thủ công —
// không có "tấm đệm" nào ở giữa.
//
// GIẢI PHÁP: cho phép khai báo NHIỀU key cho cùng 1 loại API, dùng chung một
// quy ước đặt tên biến môi trường:
//   <PREFIX>          (key #0, vd GROQ_API_KEY)
//   <PREFIX>1         (key #1, vd GROQ_API_KEY1)
//   <PREFIX>2         (key #2, vd GROQ_API_KEY2)
//   ...
//   <PREFIX>20        (key #20, vd GROQ_API_KEY20)
//
// Áp dụng được cho BẤT KỲ loại API nào chỉ bằng cách đổi PREFIX — vd:
//   GROQ_API_KEY, GROQ_API_KEY1 ... GROQ_API_KEY20
//   GEMINI_API_KEY, GEMINI_API_KEY1 ... GEMINI_API_KEY22
//   ANTHROPIC_API_KEY, ANTHROPIC_API_KEY1 ... ANTHROPIC_API_KEY10
// (số lượng key không cần khai báo liên tục hết mức tối đa — chỉ cần khai
// báo bao nhiêu key thì dùng bấy nhiêu, các số bị thiếu sẽ tự bị bỏ qua).
//
// Khi gọi upstream mà 1 key trả về lỗi kiểu "hết billing/hết quota/bị chặn"
// (401/402/403/429, hoặc message chứa "quota"/"insufficient"/"billing"/...),
// module này TỰ ĐỘNG chuyển sang key kế tiếp trong pool và thử lại — client
// (trình duyệt) hoàn toàn không biết chuyện rotate đang diễn ra, chỉ nhận
// kết quả thành công (hoặc lỗi thật, khi TẤT CẢ key trong pool đều hết hạn
// mức). Nhờ vậy production không bị "quăng lỗi real-time" ngay khi 1 key hết
// tiền — có thời gian nạp thêm Token cho key đó mà service vẫn chạy bằng các
// key còn lại.
//
// CÁCH DÙNG (xem thêm ví dụ thực tế trong các file api/_lib/*.js khác):
//
//   import { withApiKeyRotation } from './apiKeyPool.js'
//
//   const data = await withApiKeyRotation('GROQ_API_KEY', async (apiKey) => {
//     const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
//       body: JSON.stringify(payload),
//     })
//     if (!res.ok) throw await toRotatableHttpError(res, 'Groq')
//     return res.json()
//   })
//
// Với các SDK (vd @google/genai, @anthropic-ai/sdk) chỉ cần khởi tạo client
// BÊN TRONG callback (dùng `apiKey` được truyền vào) rồi gọi SDK như bình
// thường — lỗi SDK ném ra (401/429/"RESOURCE_EXHAUSTED"/"insufficient
// credit"...) sẽ tự được nhận diện và rotate, không cần code thêm gì khác.
// ---------------------------------------------------------------------------

// Số thứ tự tối đa dò tìm cho mỗi prefix (vd GROQ_API_KEY1 .. GROQ_API_KEY30).
// Đặt dư ra so với nhu cầu hiện tại (20 cho Groq, 22 cho Gemini) để không
// phải sửa code này khi cần thêm key trong tương lai.
const DEFAULT_MAX_KEYS_PER_PREFIX = 30

// Nhớ "key đang chạy tốt" của mỗi prefix theo bộ nhớ của tiến trình (mỗi
// Serverless Function instance còn "ấm"/warm sẽ dùng lại đúng key vừa thành
// công lần trước, thay vì luôn bắt đầu lại từ key #0 — key #0 có thể vừa bị
// đánh dấu hết hạn mức ở request trước đó). Đây chỉ là tối ưu, KHÔNG phải
// yêu cầu bắt buộc: mỗi cold start vẫn sẽ bắt đầu lại từ key #0, và pool vẫn
// tự rotate đúng trong mọi trường hợp dù bộ nhớ này có bị mất.
const stickyKeyIndexByPrefix = new Map()

export class ApiKeyPoolError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ApiKeyPoolError'
    this.status = status
  }
}

/**
 * Đọc toàn bộ key hợp lệ của 1 prefix từ biến môi trường, theo thứ tự
 * <PREFIX>, <PREFIX>1, <PREFIX>2, ... Bỏ qua các số không có giá trị (không
 * yêu cầu khai báo liên tục).
 *
 * @param {string} prefix - vd 'GROQ_API_KEY', 'GEMINI_API_KEY'
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.envSource] - mặc định process.env;
 *   truyền `env` từ `loadEnv()` của Vite khi gọi từ middleware dev-server
 *   (vite.config.js) để dùng đúng nguồn biến môi trường của Vite thay vì
 *   process.env.
 * @param {number} [opts.max] - số thứ tự tối đa dò tìm (mặc định 30).
 * @returns {Array<{ label: string, key: string }>}
 */
export function loadApiKeyPool(prefix, { envSource = process.env, max = DEFAULT_MAX_KEYS_PER_PREFIX } = {}) {
  const pool = []
  const baseValue = envSource[prefix]
  if (typeof baseValue === 'string' && baseValue.trim()) {
    pool.push({ label: prefix, key: baseValue.trim() })
  }
  for (let i = 1; i <= max; i++) {
    const label = `${prefix}${i}`
    const value = envSource[label]
    if (typeof value === 'string' && value.trim()) {
      pool.push({ label, key: value.trim() })
    }
  }
  return pool
}

// Che bớt key trong log — chỉ giữ vài ký tự đầu/cuối để nhận diện, không lộ
// toàn bộ giá trị key ra console (Vercel logs có thể bị nhiều người xem).
function maskKey(key) {
  if (!key || key.length <= 8) return '****'
  return `${key.slice(0, 4)}...${key.slice(-4)}`
}

/**
 * Heuristic nhận diện lỗi "nên rotate sang key khác" — tức lỗi do BẢN THÂN
 * KEY (hết billing, hết quota, bị revoke, sai key, bị chặn quyền) chứ không
 * phải lỗi do request sai (400 bad request) hay lỗi tạm thời phía upstream
 * (500/502/503 — rotate cũng không giúp ích gì vì key nào gọi cũng lỗi như
 * nhau, thử lại key khác chỉ tốn thời gian).
 *
 * Nhận cả 2 dạng lỗi:
 *   - lỗi HTTP thuần (status number + message string) — tạo bằng
 *     `toRotatableHttpError()` bên dưới cho các call `fetch()` trực tiếp.
 *   - lỗi ném ra từ SDK (Anthropic SDK, @google/genai SDK) — thường có
 *     `.status`/`.statusCode`, hoặc nhét mã lỗi thật vào trong `.message`
 *     dạng chuỗi JSON (đặc biệt @google/genai hay làm vậy).
 */
export function isRotatableApiError(err) {
  if (!err) return false

  const status = Number(err.status ?? err.statusCode ?? err?.response?.status ?? NaN)

  let messageText = String(err.message || err.error?.message || err.error || '')
  // @google/genai thường nhét nguyên JSON lỗi gốc của Google vào bên trong
  // message dạng chuỗi, vd: 'got status: 429 ... {"error":{"code":429,
  // "message":"...","status":"RESOURCE_EXHAUSTED"}}' — trích thêm code/status
  // thật bên trong để so khớp cho chắc, không chỉ dựa vào status ở ngoài.
  const embeddedJsonMatch = messageText.match(/\{[\s\S]*\}/)
  if (embeddedJsonMatch) {
    try {
      const parsed = JSON.parse(embeddedJsonMatch[0])
      const inner = parsed?.error || parsed
      messageText += ` ${inner?.code || ''} ${inner?.status || ''} ${inner?.message || ''}`
    } catch {
      // không phải JSON hợp lệ — bỏ qua, vẫn dùng messageText gốc
    }
  }

  const ROTATABLE_HTTP_STATUS = new Set([401, 402, 403, 429])
  if (ROTATABLE_HTTP_STATUS.has(status)) return true

  return /quota|insufficient|billing|credit|rate.?limit|resource_exhausted|permission_denied|api[_ ]?key[_ ]?invalid|invalid[_ ]?api[_ ]?key|unauthorized|payment required|exceeded|expired|revoked/i.test(
    messageText,
  )
}

/**
 * Chuyển 1 Response không-ok của `fetch()` thành Error có `.status` để
 * `isRotatableApiError()`/`withApiKeyRotation()` xét đúng. Dùng cho các nhánh
 * gọi upstream bằng fetch thuần (Groq, Anthropic REST, ...).
 *
 * @param {Response} res - response KHÔNG ok từ fetch()
 * @param {string} [providerLabel] - vd 'Groq', 'Anthropic' — chỉ để log/message rõ ràng hơn
 */
export async function toRotatableHttpError(res, providerLabel = 'Upstream') {
  const text = await res.text().catch(() => '')
  let message = text
  try {
    const json = JSON.parse(text)
    message = json?.error?.message || json?.error || text
  } catch {
    // giữ nguyên text nếu không phải JSON
  }
  message = String(message || `${providerLabel} API error (${res.status})`)
  const err = new Error(`${providerLabel}: ${message}`)
  err.status = res.status
  err.rawBody = text
  return err
}

/**
 * Chạy `attempt(apiKey, label)` lần lượt với từng key trong pool của
 * `prefix`, cho tới khi có 1 key thành công. Nếu key hiện tại lỗi nhưng KHÔNG
 * phải lỗi "nên rotate" (vd lỗi request sai 400, hoặc bug logic), ném lỗi đó
 * ra NGAY LẬP TỨC — không thử các key khác (đổi key không giải quyết được
 * lỗi loại này).
 *
 * @template T
 * @param {string} prefix - vd 'GROQ_API_KEY'
 * @param {(apiKey: string, label: string) => Promise<T>} attempt
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.envSource]
 * @param {number} [opts.max]
 * @param {boolean} [opts.required] - nếu true (mặc định) và pool rỗng, ném
 *   ApiKeyPoolError ngay. Đặt false cho các nhánh mà thiếu key chỉ nghĩa là
 *   "bỏ qua nhánh này, thử provider khác" thay vì báo lỗi cứng.
 * @returns {Promise<T>}
 */
export async function withApiKeyRotation(prefix, attempt, { envSource = process.env, max = DEFAULT_MAX_KEYS_PER_PREFIX, required = true } = {}) {
  const pool = loadApiKeyPool(prefix, { envSource, max })

  if (pool.length === 0) {
    if (!required) return undefined
    throw new ApiKeyPoolError(
      `Chưa cấu hình biến môi trường ${prefix} (hoặc ${prefix}1, ${prefix}2, ...). Thêm ít nhất 1 biến trong Vercel → Settings → Environment Variables rồi redeploy.`,
      501,
    )
  }

  const startIndex = stickyKeyIndexByPrefix.get(prefix) ?? 0
  let lastError

  for (let i = 0; i < pool.length; i++) {
    const index = (startIndex + i) % pool.length
    const { key, label } = pool[index]
    try {
      const result = await attempt(key, label)
      // Nhớ lại key vừa thành công để lần gọi kế tiếp (trên cùng instance
      // "ấm") thử key này trước — tránh việc luôn phải "quét lại từ đầu"
      // qua các key đã biết là hết hạn mức trong cùng 1 lượt cold-start.
      stickyKeyIndexByPrefix.set(prefix, index)
      return result
    } catch (err) {
      lastError = err
      if (!isRotatableApiError(err)) throw err
      const remaining = pool.length - i - 1
      console.warn(
        `[apiKeyPool] ${label} (${maskKey(key)}) lỗi hết hạn mức/billing (${err?.status || ''} ${err?.message || ''}).` +
          (remaining > 0 ? ` Đang chuyển sang key kế tiếp (còn ${remaining} key dự phòng)...` : ' Đã hết key dự phòng.'),
      )
      continue
    }
  }

  throw new ApiKeyPoolError(
    `Tất cả ${pool.length} key ${prefix}* đều đã hết hạn mức/billing hoặc bị lỗi. Vui lòng nạp thêm Token/quota cho ít nhất 1 key rồi thử lại. Lỗi cuối cùng: ${lastError?.message || lastError}`,
    lastError?.status && Number.isInteger(lastError.status) ? lastError.status : 429,
  )
}

/**
 * Đếm nhanh số key khả dụng của 1 prefix — hữu ích để log chẩn đoán khi khởi
 * động 1 nhánh xử lý (vd "[groq-proxy] GROQ_API_KEY pool: 5 key").
 */
export function countApiKeyPool(prefix, opts) {
  return loadApiKeyPool(prefix, opts).length
}
