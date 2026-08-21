// api/_lib/youtubeTranscript.js
// Lấy transcript/phụ đề YouTube MIỄN PHÍ, không cần API key — thay cho việc
// gửi cả video cho Gemini "xem" (tốn phí). Cách làm: tải trang watch, trích
// JSON captionTracks nhúng sẵn trong HTML (cùng ý tưởng "lấy caption trước
// khi phải trích frame" của bradautomates/claude-video, áp dụng cho backend
// web thay vì CLI), rồi tải file transcript (định dạng json3) và ghép thành
// văn bản thuần.
//
// Giới hạn: chỉ hoạt động với video CÓ phụ đề (tự động hoặc thủ công) —
// hầu hết video giáo dục public đều có. Video tắt hẳn phụ đề sẽ báo lỗi rõ
// ràng thay vì âm thầm trả kết quả sai.

export class YoutubeTranscriptError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.name = 'YoutubeTranscriptError'
    this.status = status
  }
}

/**
 * Trích video ID từ các dạng link YouTube phổ biến: watch?v=, youtu.be/,
 * shorts/, embed/, live/, music.youtube.com. Dùng URL parsing (thay vì
 * regex mong manh) — giống hệt hàm đã dùng ổn định ở kolYoutubeDownload.js.
 *
 * BUG THỰC TẾ đã gặp (link Shorts, vd youtube.com/shorts/HRUpX7-srVE): regex
 * CŨ chỉ nhận diện watch?v=, youtu.be/, v/, u/\w/, embed/ — KHÔNG có
 * "shorts/", nên mọi link Shorts đều bị coi là "không hợp lệ", rơi thẳng
 * xuống nhánh Gemini xem-trực-tiếp-video (chậm hơn, tốn quota) thay vì dùng
 * được đường transcript miễn phí/nhanh như link watch?v= thường — ảnh hưởng
 * CẢ "Bring Any Idea to Life" LẪN "Video to Learning" (dùng chung hàm này),
 * dù "Video to Learning" vẫn "chạy được" nhờ nhánh dự phòng Gemini, khiến
 * bug bị che khuất (chậm hơn + tốn quota hơn cần thiết, không phải do dùng
 * đường transcript nhanh/free như link thường).
 * @param {string} rawUrl
 * @returns {string|null}
 */
export function extractYoutubeVideoId(rawUrl) {
  let u
  try {
    u = new URL(rawUrl)
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtu.be') {
    return u.pathname.split('/').filter(Boolean)[0] || null
  }
  if (host === 'youtube.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') {
      return u.searchParams.get('v')
    }
    const match = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
    if (match) return match[2]
  }
  return null
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

const MAX_TRANSCRIPT_CHARS = 24000 // tránh vượt context/token limit của Groq

export async function fetchYoutubeTranscript(videoUrl, preferredLangs = ['vi', 'en']) {
  const videoId = extractYoutubeVideoId(videoUrl || '')
  if (!videoId) {
    throw new YoutubeTranscriptError('Link YouTube không hợp lệ.', 400)
  }

  // QUAN TRỌNG: từ IP server (data center, hay bị nhận diện là EU), YouTube
  // đôi khi trả về trang "consent" (đồng ý cookie GDPR) thay vì trang video
  // thật — trang consent KHÔNG có captionTracks, khiến regex bên dưới không
  // match, transcript thất bại "âm thầm" (báo "video không có phụ đề" dù
  // video có phụ đề thật), buộc phải fallback sang Gemini xem cả video —
  // vốn CHẬM hơn nhiều và dễ vượt quá GEMINI_TIMEOUT_MS. Gửi sẵn cookie
  // CONSENT để bỏ qua màn hình này (cách làm quen thuộc của yt-dlp và các
  // scraper khác cho chính vấn đề này).
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'vi,en;q=0.9',
      Cookie: 'CONSENT=YES+1; SOCS=CAI',
    },
  })
  if (!pageRes.ok) {
    throw new YoutubeTranscriptError('Không tải được trang video YouTube.', 502)
  }
  const html = await pageRes.text()

  const match = html.match(/"captionTracks":(\[.*?\])/)
  if (!match) {
    // Nếu vẫn dính trang consent (hiếm khi xảy ra sau cookie ở trên) thì báo
    // lỗi rõ ràng hơn thay vì lẫn với trường hợp "video thật sự không có
    // phụ đề" — giúp debug nhanh hơn lần sau nếu lại gặp.
    const looksLikeConsentWall = /consent\.youtube\.com|Before you continue to YouTube/i.test(html)
    throw new YoutubeTranscriptError(
      looksLikeConsentWall
        ? 'YouTube trả về trang xác nhận cookie thay vì trang video (lỗi tạm thời từ phía YouTube). Vui lòng thử lại.'
        : 'Video này không có phụ đề (caption) nên không thể phân tích miễn phí bằng transcript. Hãy thử một video khác có bật phụ đề (tự động hoặc thủ công).',
      422,
    )
  }

  let tracks
  try {
    tracks = JSON.parse(match[1])
  } catch {
    throw new YoutubeTranscriptError('Không đọc được danh sách phụ đề của video.', 502)
  }
  if (!Array.isArray(tracks) || tracks.length === 0) {
    throw new YoutubeTranscriptError('Video này không có phụ đề.', 422)
  }

  let track = null
  for (const lang of preferredLangs) {
    track = tracks.find((t) => t.languageCode === lang)
    if (track) break
  }
  if (!track) track = tracks[0]

  const transcriptUrl = `${track.baseUrl}&fmt=json3`
  const transcriptRes = await fetch(transcriptUrl, { headers: { 'User-Agent': UA } })
  if (!transcriptRes.ok) {
    throw new YoutubeTranscriptError('Không tải được nội dung phụ đề.', 502)
  }
  const data = await transcriptRes.json()

  const lines = []
  for (const event of data.events || []) {
    if (!event.segs) continue
    const text = event.segs.map((s) => s.utf8 || '').join('')
    const clean = text.replace(/\n/g, ' ').trim()
    if (clean) lines.push(clean)
  }
  const transcript = lines.join(' ').replace(/\s+/g, ' ').trim()

  if (!transcript) {
    throw new YoutubeTranscriptError('Phụ đề video này trống, không thể phân tích.', 422)
  }

  const truncated =
    transcript.length > MAX_TRANSCRIPT_CHARS ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + ' […]' : transcript

  return {
    transcript: truncated,
    languageCode: track.languageCode,
    isAutoGenerated: track.kind === 'asr',
  }
}
