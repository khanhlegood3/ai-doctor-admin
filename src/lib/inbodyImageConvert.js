// src/lib/inbodyImageConvert.js
// ─── Shared InBody Image → CSV conversion logic ───────────────────────────────
//
// Dùng chung cho:
//   - src/inbody-khanh/components/InBodyDashboard.jsx  (AI inbody Portal tab)
//   - src/components/upload/MedicalUploader.jsx         (Upload / Medical Records tab)
//
// Luồng (theo FullDocumentSummarizationPanel):
//   Step 1 — Groq Vision (JSON): phân tích toàn bộ metrics InBody → JSON
//   Step 2 — Groq Vision (free-text): nếu ngày bị rỗng/thiếu, chạy thêm một
//            lượt hỏi riêng "Ngày/Giờ kiểm tra là bao nhiêu?" → parse text → digits
//   Step 3 — buildImageConvertedInBodyRecord → recordsToInBodyCsv → CSV string

import { buildImageConvertedInBodyRecord, parseInBodyCsv, recordsToInBodyCsv } from './inbodyCsv.js'
import { loadPdfJs } from './pdfjsLoader.js'

// ── System prompt for full metrics extraction (JSON) ──────────────────────────
export const INBODY_OCR_SYSTEM_PROMPT = `Bạn là chuyên gia phân tích kết quả InBody (máy đo thành phần cơ thể).
Khi nhận ảnh/PDF kết quả InBody, hãy:
1. Đọc thật kỹ và trích xuất CHÍNH XÁC các chỉ số có trên phiếu in: Ngày đo (định dạng YYYY-MM-DD HH:mm), Cân nặng, Cơ bắp (SMM/Khối lượng cơ xương), Khối lượng mỡ trong cơ thể, Tỷ lệ mỡ cơ thể (%), BMI, Tỷ lệ trao đổi chất cơ bản (BMR), Điểm InBody, Lượng nước trong cơ thể (%), Mỡ nội tạng (Level), Protein, Khoáng chất — nếu ảnh không hiển thị chỉ số nào thì BỎ QUA chỉ số đó trong "metrics", KHÔNG tự đoán hay bịa số.
2. ĐẶC BIỆT QUAN TRỌNG về ngày và giờ đo: Đọc trường "Ngày/Giờ kiểm tra" TRỰC TIẾP trên phiếu in. KHÔNG dùng ngày hôm nay hay tự bịa. Đọc CẢ GIỜ VÀ PHÚT nếu có — ví dụ phiếu ghi "08.05.2026 10:58" thì ghi "2026-05-08 10:58". Nếu chỉ thấy ngày không có giờ, ghi "2026-05-08 00:00". Nếu KHÔNG thể đọc được ngày, hãy ĐỂ TRỐNG trường "Ngày đo" (đừng điền gì vào đó). Lưu cả giờ:phút vì người dùng có thể đo nhiều lần trong cùng một ngày.
3. Đưa ra nhận xét ngắn gọn (2-3 câu) về tình trạng sức khỏe dựa trên số liệu đọc được.
4. Gợi ý cải thiện cụ thể (tập luyện, dinh dưỡng).
5. Tính XP gamification dựa trên thay đổi so với lần đo trước (nếu có dữ liệu trước đó được cung cấp).

CHỈ trả lời bằng JSON hợp lệ (không kèm lời dẫn, không kèm markdown \`\`\`), đúng cấu trúc:
{
  "summary": "Nhận xét tổng quan 2-3 câu",
  "metrics": {
    "Cân nặng": "68.4",
    "Cơ bắp": "29.8",
    "Khối lượng mỡ": "21.0",
    "Mỡ (%)": "22.1",
    "Nước (%)": "54.3",
    "BMI": "23.1",
    "BMR": "1500",
    "Điểm InBody": "72",
    "Mỡ nội tạng": "9",
    "Protein": "10.2",
    "Khoáng chất": "3.6",
    "Ngày đo": "2026-05-08 10:58"
  },
  "tags": [
    { "label": "Cơ bắp tốt ▲", "type": "ok" },
    { "label": "Mỡ cần cải thiện", "type": "warn" },
    { "label": "BMI bình thường", "type": "info" }
  ],
  "recommendations": ["Tập resistance training 3x/tuần", "Giảm carb buổi tối"],
  "xp_earned": 80,
  "inbody_score": 72
}`

// ── Free-text prompt for date-only extraction (Step 2 fallback) ───────────────
// Giống luồng FullDocumentSummarizationPanel: hỏi tự do → parse text → digits
const DATE_EXTRACT_PROMPT = `Bạn đang nhìn vào ảnh phiếu kết quả InBody.
Hãy tìm và đọc CHÍNH XÁC trường "Ngày/Giờ kiểm tra" (hoặc "Date/Time") trên phiếu.
Chỉ trả lời ngày và giờ đó theo định dạng: DD.MM.YYYY HH:mm
Ví dụ: 08.05.2026 10:58
Nếu không thấy ngày, trả lời: UNKNOWN
Không giải thích thêm gì khác.`

// ── Parse raw JSON from Groq (strip markdown fences if any) ───────────────────
export function parseGroqInBodyJson(text) {
  try {
    const cleaned = text.replace(/```json\n?|```\n?/g, '').trim()
    const parsed  = JSON.parse(cleaned)
    return { ...parsed, metrics: parsed.metrics || {} }
  } catch {
    return {
      summary: text || 'Groq đã đọc ảnh nhưng không trả về JSON hợp lệ. Vui lòng nhập tay các chỉ số.',
      metrics: {},
      tags: [{ label: 'Cần nhập tay', type: 'warn' }],
      recommendations: [],
      xp_earned: 0,
    }
  }
}

// ── Extract PDF text via pdf.js (self-hosted, dùng chung qua pdfjsLoader) ─────
export async function extractPdfTextForInBody(file) {
  try {
    const pdfjs = await loadPdfJs()
    const ab  = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: ab }).promise
    const texts = []
    for (let p = 1; p <= Math.min(pdf.numPages, 10); p++) {
      const page = await pdf.getPage(p)
      const tc   = await page.getTextContent()
      texts.push(tc.items.map(i => i.str).join(' '))
    }
    const out = texts.join('\n\n').trim()
    return out.length > 80 ? out.slice(0, 10000) : null
  } catch { return null }
}

// ── Render PDF page to canvas → base64 JPEG ───────────────────────────────────
export async function pdfPageToImageForInBody(file, pageNum = 1) {
  try {
    const pdfjs = await loadPdfJs()
    const ab     = await file.arrayBuffer()
    const pdf    = await pdfjs.getDocument({ data: ab }).promise
    const page   = await pdf.getPage(Math.min(pageNum, pdf.numPages))
    const vp     = page.getViewport({ scale: 1.5 })
    const canvas = document.createElement('canvas')
    canvas.width  = vp.width
    canvas.height = vp.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
    return canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
  } catch { return null }
}

// ── Step 2: Dedicated date extraction via free-text Groq Vision ───────────────
// Mirrors FullDocumentSummarizationPanel: ask for plain text → parse ourselves.
// Returns compact digits string "YYYYMMDDHHmm" or "" if not found.
export async function extractDateFromInBodyImage(base64Image, mediaType) {
  try {
    const safeMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)
      ? mediaType : 'image/jpeg'
    const res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        max_tokens: 64,
        messages: [
          { role: 'system', content: DATE_EXTRACT_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${safeMime};base64,${base64Image}` } },
              { type: 'text', text: 'Đọc trường "Ngày/Giờ kiểm tra" trên phiếu InBody này.' },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const text = (data?.choices?.[0]?.message?.content || '').trim()
    if (!text || text.toUpperCase() === 'UNKNOWN') return ''

    // Parse "DD.MM.YYYY HH:mm" or "DD/MM/YYYY HH:mm" or "YYYY-MM-DD HH:mm"
    const m =
      text.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})\s+(\d{1,2}):(\d{2})/) ||
      text.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})/)
    if (!m) return ''

    let year, month, day, hour, minute
    if (String(m[3]).length === 4) {
      // DD.MM.YYYY HH:mm
      ;[, day, month, year, hour, minute] = m
    } else {
      // YYYY-MM-DD HH:mm
      ;[, year, month, day, hour, minute] = m
    }
    const yy = String(year).padStart(4, '0')
    const mm = String(month).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const hh = String(hour).padStart(2, '0')
    const mi = String(minute).padStart(2, '0')

    const y = parseInt(yy, 10), mo = parseInt(mm, 10), d = parseInt(dd, 10)
    if (y < 2000 || y > 2035 || mo < 1 || mo > 12 || d < 1 || d > 31) return ''
    return `${yy}${mm}${dd}${hh}${mi}`
  } catch { return '' }
}

// ── Step 1: Full InBody metrics analysis via Groq Vision (JSON) ───────────────
export async function analyzeInBodyWithAI(base64Image, mediaType, file = null, previousRecord = null) {
  const instructionText = previousRecord
    ? `Đây là kết quả InBody mới nhất. Kết quả lần trước: ${JSON.stringify(previousRecord)}. Hãy phân tích và so sánh.`
    : 'Đây là ảnh phiếu kết quả InBody. Hãy đọc và trích xuất chính xác các chỉ số có trên ảnh.'

  // PDF: try text extract first, fall back to vision render
  if (file && file.type === 'application/pdf') {
    const pdfText = await extractPdfTextForInBody(file)
    if (pdfText) {
      const res = await fetch('/api/groq-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages: [
            { role: 'system', content: INBODY_OCR_SYSTEM_PROMPT },
            { role: 'user',   content: `${instructionText}\n\nNội dung PDF:\n${pdfText}` },
          ],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(`Groq ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
      return parseGroqInBodyJson(data?.choices?.[0]?.message?.content || '')
    }
    const imgB64 = await pdfPageToImageForInBody(file, 1)
    if (imgB64) { base64Image = imgB64; mediaType = 'image/jpeg' }
  }

  // Image (JPG/PNG/etc) or scanned PDF → llama-4-scout vision
  const safeMime = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mediaType)
    ? mediaType : 'image/jpeg'

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: INBODY_OCR_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${safeMime};base64,${base64Image}` } },
            { type: 'text',      text: instructionText },
          ],
        },
      ],
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Groq Vision ${res.status}: ${data?.error?.message || JSON.stringify(data)}`)
  return parseGroqInBodyJson(data?.choices?.[0]?.message?.content || '')
}

// ── Master function: Image → CSV string ───────────────────────────────────────
// Encapsulates all steps. Returns { csvText, analysisResult, record }.
//
// Luồng (học theo FullDocumentSummarizationPanel — 2 bước song song):
//
//   Step 1 (song song với Step 2):
//     Groq Vision ép JSON → trích xuất toàn bộ metrics InBody.
//     Nếu caller đã có cachedAnalysis (đã bấm "🧠 Phân tích AI" trước đó) thì bỏ qua.
//
//   Step 2 (luôn chạy song song với Step 1, KHÔNG phải fallback):
//     Groq Vision hỏi plain text "Ngày/Giờ kiểm tra là bao nhiêu?" → tự parse
//     → đây là nguồn ngày TIN CẬY NHẤT vì không bị lệch key JSON.
//     Ngay cả khi Step 1 đã trả ngày trong JSON, Step 2 vẫn chạy để override —
//     vì plain-text Vision ít sai key hơn JSON Vision.
//
//   Step 3: Merge kết quả → buildImageConvertedInBodyRecord → recordsToInBodyCsv
//
// Params:
//   base64Image    — base64 string (no data: prefix)
//   mediaType      — MIME type e.g. "image/jpeg"
//   file           — File object (for PDF text extraction, may be null)
//   fallbackRecord — last known parsed InBody record (for field defaults)
//   sourceName     — original filename (used in CSV metadata)
//   previousRecord — previous InBody result for comparison (optional)
//   cachedAnalysis — if caller already has an analysisResult, pass it to skip Step 1
//
export async function convertInBodyImageToCsv({
  base64Image,
  mediaType,
  file = null,
  fallbackRecord = null,
  sourceName = 'InBody_Image',
  previousRecord = null,
  cachedAnalysis = null,
} = {}) {
  // Step 1 + Step 2: chạy song song để tiết kiệm thời gian.
  // Step 2 luôn chạy (không conditional) — plain-text Vision đọc ngày chính xác hơn JSON.
  // Nếu cachedAnalysis đã có sẵn, Step 1 không tốn thêm API call.
  const [analysisResult, dateFromPlainText] = await Promise.all([
    cachedAnalysis
      ? Promise.resolve(cachedAnalysis)
      : analyzeInBodyWithAI(base64Image, mediaType, file, previousRecord),
    extractDateFromInBodyImage(base64Image, mediaType),
  ])

  // Step 3: Merge — plain-text date (Step 2) là nguồn ưu tiên cao nhất.
  // Nếu Step 2 không đọc được ngày (trả ''), giữ nguyên kết quả từ Step 1 JSON.
  const enrichedAnalysis = dateFromPlainText
    ? {
        ...analysisResult,
        metrics: {
          ...(analysisResult?.metrics || {}),
          // Ghi đè "Ngày đo" bằng compact digits từ plain-text Vision.
          // buildImageConvertedInBodyRecord sẽ strip non-digits nên format này là chuẩn nhất.
          'Ngày đo': dateFromPlainText,
        },
      }
    : analysisResult

  // Step 4: Build structured record → CSV
  const record  = buildImageConvertedInBodyRecord({ analysis: enrichedAnalysis, fallback: fallbackRecord, sourceName })
  const csvText = recordsToInBodyCsv([record])

  return { csvText, analysisResult: enrichedAnalysis, record }
}

// ── Helper: read a File object → base64 string ────────────────────────────────
export function fileToBase64Promise(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = () => reject(new Error('Không đọc được file'))
    reader.readAsDataURL(file)
  })
}
