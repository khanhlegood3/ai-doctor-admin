/**
 * pointsTokenConversion.js — Quy đổi ĐIỂM THƯỞNG NỘI BỘ (reward ledger
 * trong gameAffiliateDB.js, currency mặc định "VIET") ra USD, rồi ra số
 * lượng của TẤT CẢ token/coin mà dự án đang hỗ trợ (VIET, PI, BTC, ETH,
 * BNB, USDT — cùng danh sách currency đã dùng trong AffiliateSystemPanel.jsx
 * / AffiliateSystemControlPanel.jsx), để user biết ngay "điểm của mình đang
 * đáng bao nhiêu tiền, đổi ra coin là bao nhiêu".
 *
 * QUY ƯỚC QUY ĐỔI (đã xác nhận với người dùng):
 *   1 điểm nội bộ = 0.01 USD (cố định, không phụ thuộc giá thị trường)
 *   Token/coin dự án hỗ trợ  → quy đổi theo giá THỊ TRƯỜNG hiện tại (USD)
 *     lấy từ CoinGecko (API công khai, không cần API key).
 *   Riêng VIET là token nội bộ của dự án (chưa niêm yết) → quy ước cố định
 *     1 VIET = 1 điểm = 0.01 USD (tỉ giá neo, không qua CoinGecko).
 *
 * Nếu không gọi được CoinGecko (mất mạng / rate-limit), dùng giá dự phòng
 * (FALLBACK_PRICES) đã cache lần gần nhất trong localStorage, để UI không
 * bao giờ hiển thị trống hay lỗi.
 */

export const POINT_TO_USD = 0.01

// Mỗi entry: { symbol hiển thị, id CoinGecko để lấy giá, giá dự phòng USD }
export const SUPPORTED_TOKENS = [
  { symbol: 'VIET', coingeckoId: null, fallbackUsd: 0.01, note: 'Token nội bộ dự án — neo cố định 1 VIET = 0.01 USD' },
  { symbol: 'PI', coingeckoId: 'pi-network', fallbackUsd: 0.4 },
  { symbol: 'USDT', coingeckoId: 'tether', fallbackUsd: 1 },
  { symbol: 'BNB', coingeckoId: 'binancecoin', fallbackUsd: 600 },
  { symbol: 'ETH', coingeckoId: 'ethereum', fallbackUsd: 3500 },
  { symbol: 'BTC', coingeckoId: 'bitcoin', fallbackUsd: 65000 },
]

const CACHE_KEY = 'cdoc_game_token_prices_cache_v1'
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 phút — đủ mới cho hiển thị, tránh gọi CoinGecko liên tục

function readCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
    if (!raw || typeof raw !== 'object') return null
    return raw
  } catch { return null }
}

function writeCache(prices) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ prices, fetchedAt: Date.now() }))
  } catch { /* ignore quota/private-mode errors */ }
}

// Trả về { VIET: usdPrice, PI: usdPrice, ... } — luôn có đủ mọi symbol
// trong SUPPORTED_TOKENS, dùng fallback cho những symbol không lấy được giá.
export async function fetchTokenUsdPrices({ forceRefresh = false } = {}) {
  const cached = readCache()
  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.prices
  }

  const fallback = Object.fromEntries(SUPPORTED_TOKENS.map((t) => [t.symbol, t.fallbackUsd]))
  const ids = SUPPORTED_TOKENS.filter((t) => t.coingeckoId).map((t) => t.coingeckoId).join(',')
  if (!ids) return fallback

  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    const data = await res.json()

    const prices = { ...fallback }
    for (const token of SUPPORTED_TOKENS) {
      if (!token.coingeckoId) continue // VIET neo cố định, bỏ qua
      const usd = data?.[token.coingeckoId]?.usd
      if (typeof usd === 'number' && usd > 0) prices[token.symbol] = usd
    }
    writeCache(prices)
    return prices
  } catch (err) {
    console.warn('[pointsTokenConversion] Không lấy được giá CoinGecko, dùng giá dự phòng:', err)
    // Nếu từng cache được (dù đã hết hạn TTL) thì ưu tiên dùng số cũ đó
    // thay vì fallback tĩnh — vẫn sát thực tế hơn.
    return cached?.prices || fallback
  }
}

// Quy đổi 1 số điểm nội bộ ra { usd, tokens: { VIET: qty, PI: qty, ... } }
export function convertPointsToValues(points, usdPrices) {
  const usd = (Number(points) || 0) * POINT_TO_USD
  const tokens = {}
  for (const token of SUPPORTED_TOKENS) {
    const price = usdPrices?.[token.symbol] || token.fallbackUsd
    tokens[token.symbol] = price > 0 ? usd / price : 0
  }
  return { usd, tokens }
}

// Định dạng số lượng token cho dễ đọc: coin đắt tiền (BTC/ETH) cần nhiều số
// thập phân hơn, coin/điểm rẻ tiền (VIET/PI) thì làm tròn ít số thập phân.
export function formatTokenAmount(symbol, amount) {
  const decimals = symbol === 'BTC' || symbol === 'ETH' ? 6 : symbol === 'BNB' ? 4 : 2
  return Number(amount || 0).toLocaleString('en-US', { maximumFractionDigits: decimals, minimumFractionDigits: 0 })
}
