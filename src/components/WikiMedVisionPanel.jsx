import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext.jsx'
import {
  todayKey,
  getMessagesForDay,
  saveMessagesForDay,
} from '../lib/wikiMedVisionChatStorage'

// ─── Wikipedia preview modal context ─────────────────────────────────────────
// Lets any tile (in SearchTab or AgentTab) open the same in-page iframe popup
// instead of window.open(_blank), without threading callbacks through props.
const WikiPreviewContext = createContext(() => {})
function useWikiPreview() {
  return useContext(WikiPreviewContext)
}

// ─── PixelRAG API ────────────────────────────────────────────────────────────
const PIXELRAG_BASE  = 'https://api.pixelrag.ai'  // search endpoint
const PIXELRAG_TILES = 'https://pixelrag.ai/api'   // tile image endpoint

// ─── Groq config ─────────────────────────────────────────────────────────────
const GROQ_MODEL = 'llama-3.3-70b-versatile'

// ─── Groq Whisper STT hook ────────────────────────────────────────────────────
// Records audio via MediaRecorder, sends to /api/groq-whisper, returns transcript.
// lang: 'vi' | 'en' — passed to Whisper for better accuracy.
function useVoiceInput(onTranscript, lang = 'en') {
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const start = useCallback(async () => {
    if (recording || transcribing) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4'
      const recorder = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setTranscribing(true)
        try {
          const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
          const formData = new FormData()
          formData.append('file', blob, `voice.${ext}`)
          formData.append('language', lang === 'vi' ? 'vi' : 'en')
          const res = await fetch('/api/groq-whisper', { method: 'POST', body: formData })
          const data = await res.json()
          if (data?.text?.trim()) onTranscript(data.text.trim())
        } catch (err) {
          console.error('[Whisper STT] error:', err)
        } finally {
          setTranscribing(false)
        }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      console.error('[Whisper STT] mic error:', err)
    }
  }, [recording, transcribing, lang, onTranscript])

  const stop = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
  }, [])

  const toggle = useCallback(() => {
    if (recording) stop(); else start()
  }, [recording, start, stop])

  return { recording, transcribing, toggle }
}

// ─── Micro button component ───────────────────────────────────────────────────
function MicButton({ onTranscript, lang, isDark }) {
  const { recording, transcribing, toggle } = useVoiceInput(onTranscript, lang)
  const isActive = recording || transcribing

  return (
    <button
      onClick={toggle}
      title={recording ? (lang === 'vi' ? 'Dừng ghi âm' : 'Stop recording') : (lang === 'vi' ? 'Nói để tìm kiếm' : 'Speak to search')}
      style={{
        padding: '14px 15px', borderRadius: 12, border: `1px solid ${isActive ? 'rgba(239,68,68,0.6)' : 'rgba(99,102,241,0.35)'}`,
        background: recording
          ? 'linear-gradient(135deg,#ef4444,#dc2626)'
          : transcribing
            ? 'rgba(239,68,68,0.15)'
            : isDark ? 'rgba(99,102,241,0.1)' : 'rgba(99,102,241,0.08)',
        color: recording ? '#fff' : transcribing ? '#ef4444' : isDark ? '#a5b4fc' : '#6366f1',
        fontSize: 17, cursor: transcribing ? 'wait' : 'pointer',
        transition: 'all 0.18s', lineHeight: 1,
        boxShadow: recording ? '0 0 0 3px rgba(239,68,68,0.25)' : 'none',
        animation: recording ? 'micPulse 1.2s ease-in-out infinite' : 'none',
      }}
    >
      {transcribing ? '⏳' : recording ? '⏹️' : '🎙️'}
    </button>
  )
}

// ─── TTS (Text-to-Speech) ────────────────────────────────────────────────────
// Tiếng Việt: dùng Google Translate TTS (giọng VI chuẩn, không cần key)
// Tiếng Anh : dùng Web Speech API (sẵn có trên mọi browser)

function stripMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{2,}/g, '. ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Chia text thành các đoạn ≤ 200 ký tự, cắt tại ranh giới câu/từ
function splitChunks(text, maxLen = 180) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) || [text]
  const chunks = []
  let cur = ''
  for (const s of sentences) {
    if ((cur + s).length > maxLen && cur) { chunks.push(cur.trim()); cur = s }
    else cur += s
  }
  if (cur.trim()) chunks.push(cur.trim())
  return chunks.filter(Boolean)
}

// Phát âm tiếng Việt qua Google Translate TTS (tuần tự từng chunk)
async function speakVietnamese(text, onStart, onEnd) {
  const chunks = splitChunks(text, 180)
  onStart()
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=vi&client=tw-ob&q=${encodeURIComponent(chunk)}`
    const audio = new Audio(url)
    audio.volume = 1
    await new Promise((res) => {
      audio.onended = res
      audio.onerror = res
      audio.play().catch(res)
    })
  }
  onEnd()
}

function useTTS(lang = 'en') {
  const [speaking, setSpeaking] = useState(false)
  const stopRef = useRef(false)
  const audioRef = useRef(null)

  const stop = useCallback(() => {
    stopRef.current = true
    setSpeaking(false)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (window.speechSynthesis) window.speechSynthesis.cancel()
  }, [])

  const speak = useCallback(async (text) => {
    if (speaking) { stop(); return }
    const clean = stripMarkdown(text)
    if (!clean) return
    stopRef.current = false

    if (lang === 'vi') {
      // ── Google Translate TTS qua proxy (tránh CORS) ──
      const chunks = splitChunks(clean, 180)
      setSpeaking(true)
      for (const chunk of chunks) {
        if (stopRef.current) break
        const url = `/api/google-tts?tl=vi&q=${encodeURIComponent(chunk)}`
        const audio = new Audio(url)
        audioRef.current = audio
        await new Promise((res) => {
          audio.onended = res
          audio.onerror = res
          audio.play().catch(res)
        })
        audioRef.current = null
      }
      if (!stopRef.current) setSpeaking(false)
    } else {
      // ── Web Speech API cho tiếng Anh ──
      if (!window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(clean)
      utter.lang = 'en-US'
      utter.rate = 0.95
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => v.lang.startsWith('en') && v.localService)
        || voices.find(v => v.lang.startsWith('en'))
      if (preferred) utter.voice = preferred
      utter.onstart = () => setSpeaking(true)
      utter.onend   = () => setSpeaking(false)
      utter.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utter)
    }
  }, [speaking, lang, stop])

  useEffect(() => () => stop(), [stop])

  return { speaking, speak }
}

function SpeakButton({ text, lang, size = 'normal' }) {
  const { speaking, speak } = useTTS(lang)
  const isSmall = size === 'small'
  return (
    <button
      onClick={() => speak(text)}
      title={speaking ? (lang === 'vi' ? 'Dừng đọc' : 'Stop') : (lang === 'vi' ? 'Đọc to' : 'Read aloud')}
      style={{
        padding: isSmall ? '4px 8px' : '6px 10px',
        borderRadius: 8,
        border: `1px solid ${speaking ? 'rgba(139,92,246,0.6)' : 'rgba(99,102,241,0.25)'}`,
        background: speaking ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : 'rgba(99,102,241,0.08)',
        color: speaking ? '#fff' : 'rgba(139,92,246,0.85)',
        fontSize: isSmall ? 13 : 15,
        cursor: 'pointer',
        transition: 'all 0.18s',
        lineHeight: 1,
        animation: speaking ? 'micPulse 1.4s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }}
    >
      {speaking ? '⏸' : '🔊'}
    </button>
  )
}
const WIKI_LANG_CONFIG = {
  vi: {
    wikiBase: 'https://vi.wikipedia.org',
    searchPlaceholder: 'Tìm Wikipedia theo hình ảnh… vd: giải phẫu tim, nhân đôi ADN',
    quickQueries: ['giải phẫu tim', 'nhân đôi ADN', 'não người', 'phân bào nguyên phân', 'tuần hoàn máu', 'thiếu vitamin'],
    quickPrompts: ['Tim hoạt động như thế nào?', 'Giải thích nguyên phân', 'Nguyên nhân thiếu máu?', 'ADN và ARN', 'Giải thích nhóm máu'],
    agentGreeting: 'Xin chào! Tôi là **Wiki Med Vision Agent** — kết hợp AI + hình ảnh trực quan.\n\nTôi có thể tìm kiếm bài viết Wikipedia với tile ảnh và trả lời câu hỏi y tế với bằng chứng trực quan.\n\nHãy thử hỏi: *"Tim bơm máu như thế nào?"* hoặc *"ADN nhân đôi là gì?"*',
    agentInputPlaceholder: 'Hỏi Wiki Med Vision Agent… (Enter để gửi)',
    searchingText: '🔍 Đang tìm kiếm Wikipedia bằng hình ảnh…',
    translatingText: '🔍 Đang dùng tiếng Việt để tìm kiếm…',
    generatingText: '🧠 Đang tạo câu trả lời…',
    resultsLabel: (n) => `✨ ${n} kết quả trực quan từ Wikipedia`,
    clickTip: 'Nhấn vào tile → mở Wikipedia',
    noResults: { title: 'Không tìm thấy kết quả.', sub: 'Hãy thử từ khóa khác hoặc thêm hình ảnh.' },
    imageActive: (name, hasText) => `🖼️ ${name} · đang tìm theo ảnh${hasText ? ' + văn bản' : ''}`,
    searchBtn: (loading) => loading ? '⏳ Đang tìm…' : '🚀 Tìm kiếm',
    tileUnavailable: 'Tile không khả dụng',
    openDirectly: 'mở trực tiếp ↗',
    openWiki: '↗ Wikipedia',
    systemPrompt: `Bạn là Wiki Med Vision Agent, trợ lý kiến thức y tế AI tích hợp hệ thống truy xuất hình ảnh từ bài viết Wikipedia với tile ảnh.

Nhiệm vụ: trả lời câu hỏi y tế và khoa học rõ ràng, chính xác, thân thiện BẰNG TIẾNG VIỆT. Khi nhận kết quả tile Wikipedia, hãy tham chiếu chúng tự nhiên như bằng chứng trực quan. Hãy súc tích nhưng đầy đủ. Dùng markdown để định dạng. Luôn khuyến khích người dùng tham khảo chuyên gia y tế cho quyết định sức khỏe cá nhân.`,
  },
  en: {
    wikiBase: 'https://en.wikipedia.org',
    searchPlaceholder: 'Search Wikipedia visually… e.g. cardiac anatomy, DNA replication',
    quickQueries: ['cardiac anatomy', 'DNA replication', 'human brain', 'cell mitosis', 'blood circulation', 'vitamin deficiency'],
    quickPrompts: ['How does the heart work?', 'Explain mitosis', 'What causes anemia?', 'DNA vs RNA', 'Blood types explained'],
    agentGreeting: "Hello! I'm **Wiki Med Vision Agent** — powered by AI + visual search.\n\nI can search Wikipedia articles across screenshot tiles and answer your medical questions with retrieved image evidence.\n\nTry asking: *\"Explain how the heart pumps blood\"* or *\"What is DNA replication?\"*",
    agentInputPlaceholder: 'Ask Wiki Med Vision Agent… (Enter to send)',
    searchingText: '🔍 Searching Wikipedia visually…',
    translatingText: '🔍 Searching Wikipedia visually…',
    generatingText: '🧠 Generating response…',
    resultsLabel: (n) => `✨ ${n} visual hits from Wikipedia articles`,
    clickTip: 'Click any tile → open Wikipedia',
    noResults: { title: 'No visual results found.', sub: 'Try a different query or add an image.' },
    imageActive: (name, hasText) => `🖼️ ${name} · image query active${hasText ? ' + text query' : ''}`,
    searchBtn: (loading) => loading ? '⏳ Searching…' : '🚀 Search',
    tileUnavailable: 'Tile unavailable',
    openDirectly: 'open tile directly ↗',
    openWiki: '↗ Wikipedia',
    systemPrompt: `You are Wiki Med Vision Agent, an AI medical knowledge assistant integrated with a visual retrieval system over Wikipedia articles and screenshot tiles.

Your job: answer medical and scientific questions clearly, accurately, and in a friendly tone. When you receive retrieved Wikipedia tile results, reference them naturally in your answer as visual evidence. Be concise but thorough. Use markdown for formatting. Always encourage the user to verify with a medical professional for personal health decisions.`,
  },
}

function getLangConfig(lang) {
  return WIKI_LANG_CONFIG[lang] || WIKI_LANG_CONFIG['en']
}

// ─── Translate non-English query to English via Groq proxy ──────────────────
// PixelRAG only indexes English Wikipedia, so non-English queries need translation.
// Uses the same /api/groq-proxy already used by AgentTab — no extra setup needed.
async function translateToEnglish(text) {
  try {
    const res = await fetch('/api/groq-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 60,
        temperature: 0,
        messages: [
          {
            role: 'system',
            content: 'You are a Vietnamese medical translator. The user will give you a Vietnamese medical or scientific search query. Translate it from Vietnamese to English. Reply with ONLY the English translation — no explanation, no extra text. Example: "não người" → "human brain", "tim mạch" → "cardiovascular", "ung thư" → "cancer".',
          },
          { role: 'user', content: text },
        ],
      }),
    })
    if (!res.ok) return text
    const data = await res.json()
    const translated = data?.choices?.[0]?.message?.content?.trim()
    console.log(`[translate] "${text}" → "${translated}"`)
    return translated || text
  } catch {
    return text
  }
}

// Detect if a string contains non-ASCII (non-Latin) characters → likely non-English
function isNonEnglish(text) {
  return /[^\x00-\x7F]/.test(text)
}

// ─── Raw PixelRAG call + basic normalization (no VI resolution) ─────────────
async function fetchPixelHits(searchQuery, imageBase64, n) {
  const queries = []
  if (searchQuery?.trim()) queries.push({ text: searchQuery.trim() })
  if (imageBase64) queries.push({ image: imageBase64 })
  if (!queries.length) throw new Error('Need text or image query')

  const res = await fetch(`${PIXELRAG_BASE}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ queries, n_docs: n }),
  })
  if (!res.ok) throw new Error(`PixelRAG search failed: ${res.status}`)
  const raw = await res.json()

  console.log('[PixelRAG] raw response:', JSON.stringify(raw, null, 2))

  let hits = []
  if (Array.isArray(raw)) {
    hits = raw
  } else if (Array.isArray(raw?.hits)) {
    hits = raw.hits
  } else if (Array.isArray(raw?.hits?.hits)) {
    hits = raw.hits.hits.map(h => h._source || h)
  } else if (Array.isArray(raw?.results)) {
    hits = raw.results.flatMap(r =>
      Array.isArray(r?.hits) ? r.hits : Array.isArray(r) ? r : []
    )
  } else if (Array.isArray(raw?.data?.hits)) {
    hits = raw.data.hits
  } else if (Array.isArray(raw?.data)) {
    hits = raw.data
  }

  hits = hits.map(h => ({
    article_id:  h.article_id  ?? h.articleId  ?? h.article  ?? h.id  ?? '',
    tile_index:  h.tile_index  ?? h.tileIndex  ?? h.tile      ?? 0,
    chunk_index: h.chunk_index ?? h.chunkIndex ?? h.chunk     ?? 0,
    score:       h.score       ?? h._score     ?? null,
    title:       h.title       ?? h.article_title ?? (h.url ? h.url.replace(/_/g, ' ') : ''),
    ...h,
  }))

  return { hits, raw }
}

// Resolve VI title/url/caption for a batch of hits in parallel, attach
// displayTitle/displayUrl/viCaption/isViResolved to each.
async function attachViData(hits) {
  // Step 1: langlinks gives us a candidate VI title for each EN slug
  // (already filtered for obvious non-article namespace prefixes).
  const candidates = await Promise.all(hits.map(h => resolveViWiki(h.url)))
  // Step 2: validate each candidate against the REST summary endpoint —
  // this catches bad Wikidata sitelinks that silently resolve to a Talk
  // page, a redirect loop, or a disambiguation page even when the title
  // itself looked like a normal article name. Its `content_urls` is also
  // the canonical, MediaWiki-resolved URL, safer than hand-building one.
  const articles = await Promise.all(
    candidates.map(c => c?.title ? resolveViArticle(c.title) : Promise.resolve(null))
  )
  return hits.map((h, i) => ({
    ...h,
    displayTitle: articles[i]?.title || h.title,
    displayUrl:   articles[i]?.url
      || (h.url ? `https://en.wikipedia.org/wiki/${h.url}` : `https://en.wikipedia.org/?curid=${h.article_id}`),
    isViResolved: Boolean(articles[i]?.url),
    viCaption: articles[i]?.caption || null,
  }))
}

async function pixelSearch(query, imageBase64 = null, nDocs = 6, lang = 'en') {
  // PixelRAG only has English Wikipedia — translate non-English queries
  let searchQuery = query
  if (query?.trim() && lang !== 'en' && isNonEnglish(query)) {
    searchQuery = await translateToEnglish(query.trim())
  }

  if (lang !== 'vi') {
    const { hits, raw } = await fetchPixelHits(searchQuery, imageBase64, nDocs)
    const final = hits.map(h => ({
      ...h,
      displayTitle: h.title,
      displayUrl: h.url ? `https://en.wikipedia.org/wiki/${h.url}` : `https://en.wikipedia.org/?curid=${h.article_id}`,
      isViResolved: false,
      viCaption: null,
    }))
    console.log('[PixelRAG] normalized hits:', final.length, final[0] ?? '(none)')
    return { hits: final, _raw: raw }
  }

  // ── VI mode: many EN articles (disambiguation pages, very narrow topics,
  // etc.) have no Vietnamese counterpart. Rather than showing a mix of VI
  // and EN tiles, over-fetch from PixelRAG, resolve VI for every candidate,
  // drop any hit with no Vietnamese article, and keep asking for more
  // (deduped by article_id) until we have `nDocs` VI-resolved hits or give
  // up after a few rounds. Order is preserved by PixelRAG's own score.
  const seenArticleIds = new Set()
  const viHits = []
  let raw = null
  let fetchCount = nDocs * 2 // first round: ask for double, most queries resolve fine
  const MAX_ROUNDS = 4
  const HARD_CAP = nDocs * 8 // don't let one query blow the API budget

  for (let round = 0; round < MAX_ROUNDS && viHits.length < nDocs; round++) {
    const n = Math.min(fetchCount, HARD_CAP)
    const { hits, raw: roundRaw } = await fetchPixelHits(searchQuery, imageBase64, n)
    if (round === 0) raw = roundRaw

    const newHits = hits.filter(h => !seenArticleIds.has(h.article_id))
    newHits.forEach(h => seenArticleIds.add(h.article_id))
    if (!newHits.length) break // PixelRAG has nothing new to give

    const withVi = await attachViData(newHits)
    for (const h of withVi) {
      if (h.isViResolved) viHits.push(h)
      if (viHits.length >= nDocs) break
    }

    if (n >= HARD_CAP) break // already asked for the max we're willing to
    fetchCount = n * 2
  }

  const final = viHits.slice(0, nDocs)
  console.log('[PixelRAG] VI-resolved hits:', final.length, '/ requested', nDocs, final[0] ?? '(none)')
  return { hits: final, _raw: raw }
}

function tileUrl(articleId, tileIndex, chunkIndex) {
  return `${PIXELRAG_TILES}/tile/${articleId}/${tileIndex}/${chunkIndex}`
}

// ─── Resolve the REAL Vietnamese Wikipedia title+URL for an English article ──
// PixelRAG only indexes en.wikipedia.org, so hit.url is always an English slug
// (e.g. "Mitosis"). Guessing vi.wikipedia.org/wiki/<the user's original query>
// is wrong whenever the query isn't the exact article title (e.g. "phân bào
// nguyên phân" → no such VI article exists, even though "Mitosis" does and its
// real VI counterpart is "Nguyên_phân"). Instead, ask the English Wikipedia API
// for the interlanguage link to Vietnamese — this is the same mechanism the
// language switcher in the screenshot uses, and it's authoritative. Called once
// per hit right after search, so the UI can preview the VI title immediately
// and the click handler just opens the already-resolved URL.
const _viWikiCache = new Map()

// Namespace prefixes (Vietnamese + English forms) that indicate the
// langlinks/Wikidata sitelink points at something other than a real
// article — e.g. a Talk page, template, or category. A bad Wikidata
// sitelink can point here even though the API call itself succeeds, so we
// treat any of these as "no Vietnamese article" rather than open it.
const NON_ARTICLE_NS = [
  'Thảo luận', 'Talk', 'Bản mẫu', 'Template', 'Thể loại', 'Category',
  'Wikipedia', 'Trợ giúp', 'Help', 'Tập tin', 'File', 'Image',
  'MediaWiki', 'Cổng thông tin', 'Portal', 'Module', 'Đặc biệt', 'Special',
  'Thành viên', 'User', 'Wikipedia talk', 'Thảo luận Thành viên', 'User talk',
]

function isRealArticleTitle(title) {
  if (!title) return false
  const prefix = title.split(':')[0]?.trim()
  if (!prefix || prefix === title.trim()) return true // no ":" → plain article title
  return !NON_ARTICLE_NS.some(ns => ns.toLowerCase() === prefix.toLowerCase())
}

async function resolveViWiki(enSlug) {
  if (!enSlug) return null
  if (_viWikiCache.has(enSlug)) return _viWikiCache.get(enSlug)
  try {
    const api = `https://en.wikipedia.org/w/api.php?action=query&prop=langlinks&lllang=vi&titles=${encodeURIComponent(enSlug)}&format=json&origin=*`
    const res = await fetch(api)
    if (!res.ok) throw new Error(`langlinks failed: ${res.status}`)
    const data = await res.json()
    const pages = data?.query?.pages || {}
    const page = Object.values(pages)[0]
    const viTitle = page?.langlinks?.[0]?.['*']
    const result = (viTitle && isRealArticleTitle(viTitle))
      ? { title: viTitle, url: `https://vi.wikipedia.org/wiki/${encodeURIComponent(viTitle.replace(/ /g, '_'))}` }
      : null
    _viWikiCache.set(enSlug, result)
    return result
  } catch {
    _viWikiCache.set(enSlug, null)
    return null
  }
}

// ─── Real VI article data (title + canonical URL + caption) ────────────────
// Tiles themselves are pre-rendered PNG screenshots of the English Wikipedia
// page — there's no way to translate pixels. Instead of guessing what's in
// the image, we pull the actual Vietnamese article's lead extract (via
// Wikipedia's REST summary endpoint) and show 1 short sentence as a caption
// under the tile. This is real article content, not an AI guess about the
// image.
//
// We also use this same endpoint as the source of truth for the URL itself,
// rather than hand-building "vi.wikipedia.org/wiki/" + title: a langlinks
// result can technically point to a non-article page (Talk, a redirect that
// resolves oddly, etc.) if the underlying Wikidata sitelink is wrong. The
// REST summary endpoint resolves redirects server-side and reports `type`,
// so we only accept "standard" articles and use its own `content_urls`
// rather than constructing a URL by hand.
const _viSummaryCache = new Map()

async function resolveViArticle(viTitle) {
  if (!viTitle) return null
  if (_viSummaryCache.has(viTitle)) return _viSummaryCache.get(viTitle)
  try {
    const api = `https://vi.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(viTitle.replace(/ /g, '_'))}`
    const res = await fetch(api)
    if (!res.ok) throw new Error(`summary failed: ${res.status}`)
    const data = await res.json()

    // Reject anything that isn't a normal readable article — disambiguation
    // pages, missing pages, or other types aren't a useful VI preview either.
    if (data?.type && data.type !== 'standard') {
      _viSummaryCache.set(viTitle, null)
      return null
    }

    const canonicalUrl = data?.content_urls?.desktop?.page || null
    if (!canonicalUrl) {
      _viSummaryCache.set(viTitle, null)
      return null
    }

    const extract = data?.extract?.trim() || null
    const firstSentence = extract ? extract.split(/(?<=[.!?])\s/)[0] : null
    const caption = firstSentence
      ? (firstSentence.length > 160 ? firstSentence.slice(0, 157) + '…' : firstSentence)
      : null

    const result = {
      title: data?.title || viTitle,
      url: canonicalUrl,
      caption,
    }
    _viSummaryCache.set(viTitle, result)
    return result
  } catch {
    _viSummaryCache.set(viTitle, null)
    return null
  }
}

async function callAI(messages, systemPrompt) {
  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: String(m.content) })),
  ]

  const payload = {
    model: GROQ_MODEL,
    messages: groqMessages,
    max_tokens: 1024,
    temperature: 0.7,
  }

  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || JSON.stringify(data)
    throw new Error(`Groq API error: ${res.status} — ${msg}`)
  }

  return data.choices?.[0]?.message?.content || ''
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result.split(',')[1])
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// In-page popup that embeds a Wikipedia article via <iframe> instead of
// opening a new browser tab. Wikipedia only sends X-Frame-Options/CSP
// frame-ancestors restrictions on "sensitive" pages (edit forms, special
// pages) — plain article views are framable — but we still detect a failed
// load (blocked frame, network error, slow connection) and offer "open in
// new tab" as a fallback so the user is never stuck looking at a blank box.
function WikiPreviewModal({ url, title, onClose, isDark }) {
  const [loadState, setLoadState] = useState('loading') // 'loading' | 'loaded' | 'failed'
  const timeoutRef = useRef(null)

  useEffect(() => {
    setLoadState('loading')
    timeoutRef.current = setTimeout(() => {
      setLoadState(prev => (prev === 'loading' ? 'failed' : prev))
    }, 6000)
    return () => clearTimeout(timeoutRef.current)
  }, [url])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!url) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,3,20,0.72)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'clamp(12px, 3vw, 40px)',
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', height: '100%', maxWidth: 1100, maxHeight: 880,
          borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          background: isDark ? '#0c0a1e' : '#fff',
          border: '1px solid rgba(99,102,241,0.3)',
          boxShadow: '0 30px 90px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 16px',
          background: isDark ? 'rgba(99,102,241,0.12)' : 'rgba(99,102,241,0.08)',
          borderBottom: '1px solid rgba(99,102,241,0.2)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 16 }}>📖</span>
            <span style={{
              fontWeight: 800, fontSize: 14, color: isDark ? '#e0e7ff' : '#1e1b4b',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{title || 'Wikipedia'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 900, fontSize: 15,
              }}
            >✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ position: 'relative', flex: 1, background: isDark ? '#0c0a1e' : '#fff' }}>
          {loadState !== 'failed' && (
            <iframe
              key={url}
              src={url}
              title={title || 'Wikipedia preview'}
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setLoadState('loaded')}
              style={{
                width: '100%', height: '100%', border: 'none',
                display: loadState === 'loaded' ? 'block' : 'block',
              }}
            />
          )}

          {loadState === 'loading' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 10,
              background: isDark ? '#0c0a1e' : '#fff', pointerEvents: 'none',
            }}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b' }}>Đang tải Wikipedia…</span>
            </div>
          )}

          {loadState === 'failed' && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32 }}>🔒</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#e2e8f0' : '#1e1b4b' }}>
                Không thể hiển thị trang trong popup
              </div>
              <div style={{ fontSize: 12, color: isDark ? '#94a3b8' : '#64748b', maxWidth: 360 }}>
                Trang này có thể đã chặn việc nhúng iframe. Hãy mở trực tiếp trong tab mới.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TileCard({ hit, idx, tileUnavailable, openDirectly, openWiki, lang, originalQuery }) {
  const [loaded, setLoaded] = useState(false)
  const [err, setErr] = useState(false)
  const url = tileUrl(hit.article_id, hit.tile_index, hit.chunk_index)
  // displayUrl/displayTitle are already resolved during search (VI → real
  // vi.wikipedia.org article via langlinks, EN → straight en.wikipedia.org
  // slug). No resolving happens on click — it's already known.
  const wikiUrl = hit.displayUrl
    || (hit.url ? `https://en.wikipedia.org/wiki/${hit.url}` : `https://en.wikipedia.org/?curid=${hit.article_id}`)
  const displayTitle = hit.displayTitle || hit.title

  const openPreview = useWikiPreview()

  React.useEffect(() => {
    console.log(`[TileCard #${idx + 1}] fetching:`, url, 'hit:', hit)
  }, [url])

  return (
    <div style={{
      position: 'relative',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(99,102,241,0.2)',
      background: 'rgba(15,10,40,0.6)',
      transition: 'transform 0.18s ease, box-shadow 0.18s ease',
      cursor: 'pointer',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(99,102,241,0.3)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
      onClick={() => openPreview(wikiUrl, displayTitle)}
    >
      <div style={{
        position: 'absolute', top: 10, left: 10, zIndex: 2,
        background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
        color: '#fff', borderRadius: 999, padding: '3px 10px',
        fontSize: 11, fontWeight: 800, letterSpacing: 0.5,
      }}>#{idx + 1}</div>

      <div style={{
        position: 'absolute', top: 10, right: 10, zIndex: 2,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        color: 'rgba(255,255,255,0.7)', borderRadius: 8,
        padding: '3px 8px', fontSize: 10, fontWeight: 700,
      }}>ID {hit.article_id}</div>

      <div style={{ width: '100%', height: 220, background: 'rgba(10,5,30,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!err ? (
          <img
            src={url}
            alt={`Wikipedia tile ${hit.article_id}`}
            crossOrigin="anonymous"
            referrerPolicy="no-referrer"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: loaded ? 'block' : 'none' }}
            onLoad={() => { console.log(`[TileCard #${idx + 1}] loaded ✓`, url); setLoaded(true) }}
            onError={(e) => { console.warn(`[TileCard #${idx + 1}] img error ✗`, url, e.type); setErr(true) }}
          />
        ) : null}
        {!loaded && !err && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, border: '3px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Loading tile…</span>
          </div>
        )}
        {err && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 12, padding: 12 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🖼️</div>
            <div style={{ marginBottom: 4 }}>{tileUnavailable}</div>

          </div>
        )}
      </div>

      <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {displayTitle && (
            <span style={{ fontSize: 10, color: 'rgba(148,163,184,0.6)', fontWeight: 600, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayTitle}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: 'rgba(99,102,241,0.8)', fontWeight: 700 }}>{openWiki}</span>
      </div>

      {/* VI caption — real lead sentence from the Vietnamese article (not a
          translation of the screenshot, which stays in English since it's a
          static image). Gives VI readers context without touching the tile. */}
      {hit.viCaption && (
        <div
          style={{
            padding: '0 14px 12px', fontSize: 12, lineHeight: 1.5,
            color: 'rgba(203,213,225,0.85)', borderTop: '1px solid rgba(99,102,241,0.12)',
            paddingTop: 10,
          }}
        >
          {hit.viCaption}
        </div>
      )}
    </div>
  )
}


function SearchTab({ isDark, lc, lang }) {
  const [query, setQuery] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [error, setError] = useState(null)
  const [nDocs] = useState(12)
  const fileRef = useRef(null)

  const handleImageSelect = async (file) => {
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = e => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
  }

  const handleSearch = async () => {
    if (!query.trim() && !imageFile) return
    setLoading(true)
    setTranslating(lang !== 'en' && isNonEnglish(query))
    setError(null)
    setResults(null)
    try {
      const b64 = imageFile ? await fileToBase64(imageFile) : null
      const data = await pixelSearch(query, b64, nDocs, lang)
      setTranslating(false)
      setResults(data)
    } catch (e) {
      setTranslating(false)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const clearImage = () => { setImageFile(null); setImagePreview(null); if (fileRef.current) fileRef.current.value = '' }

  return (
    <div style={{ padding: '24px 28px' }}>
      {/* Search bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, opacity: 0.5 }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={lc.searchPlaceholder}
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '14px 16px 14px 42px', borderRadius: 14,
                border: '1px solid rgba(99,102,241,0.35)',
                background: 'rgba(99,102,241,0.08)',
                color: isDark ? '#e2e8f0' : '#1e1b4b',
                fontSize: 15, outline: 'none',
                transition: 'border-color 0.18s',
              }}
              onFocus={e => e.target.style.borderColor = '#6366f1'}
              onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.35)'}
            />
          </div>

          <button
            onClick={() => fileRef.current?.click()}
            title="Search by image"
            style={{
              padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(139,92,246,0.35)',
              background: imageFile ? 'linear-gradient(135deg,#7c3aed,#6366f1)' : 'rgba(139,92,246,0.1)',
              color: imageFile ? '#fff' : '#7c3aed',
              fontSize: 18, cursor: 'pointer', transition: 'all 0.18s',
            }}
          >🖼️</button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleImageSelect(e.target.files[0])} />

          <MicButton onTranscript={text => { setQuery(q => q ? q + ' ' + text : text) }} lang={lang} isDark={isDark} />

          <button
            onClick={handleSearch}
            disabled={loading || (!query.trim() && !imageFile)}
            style={{
              padding: '14px 24px', borderRadius: 12,
              background: loading || (!query.trim() && !imageFile) ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.18s', whiteSpace: 'nowrap',
            }}
          >
            {lc.searchBtn(loading)}
          </button>
        </div>

        {imagePreview && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 12, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <img src={imagePreview} alt="Query" style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: 8 }} />
            <span style={{ flex: 1, fontSize: 13, color: isDark ? '#c4b5fd' : '#5b21b6', fontWeight: 700 }}>
              {lc.imageActive(imageFile?.name, query.trim())}
            </span>
            <button onClick={clearImage} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 18, cursor: 'pointer' }}>✕</button>
          </div>
        )}

        {/* Quick queries */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {lc.quickQueries.map(q => (
            <button
              key={q}
              onClick={() => { setQuery(q); }}
              style={{
                padding: '6px 14px', borderRadius: 999,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                color: isDark ? '#a5b4fc' : '#4338ca',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.target.style.background = 'rgba(99,102,241,0.22)' }}
              onMouseLeave={e => { e.target.style.background = 'rgba(99,102,241,0.1)' }}
            >{q}</button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ padding: 16, borderRadius: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', marginBottom: 16, fontSize: 14 }}>
          ⚠️ {error}
        </div>
      )}

      {translating && (
        <div style={{ padding: '10px 16px', marginBottom: 12, borderRadius: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', fontSize: 13, color: '#a5b4fc', fontWeight: 700 }}>
          {lc.translatingText}
        </div>
      )}

      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {Array.from({ length: nDocs }).map((_, i) => (
            <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)', height: 260, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {results?.hits?.length > 0 && !loading && (
        <>
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#a5b4fc' : '#4338ca' }}>
              {lc.resultsLabel(results.hits.length)}
            </span>
            <SpeakButton
              text={results.hits.map((h, i) => `${i + 1}. ${h.displayTitle || h.title}`).join('. ')}
              lang={lang}
              size="small"
            />
            <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', marginLeft: 'auto' }}>{lc.clickTip}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {results.hits.map((hit, i) => (
              <TileCard
                key={`${hit.article_id}-${hit.tile_index}-${i}`}
                hit={hit} idx={i}
                tileUnavailable={lc.tileUnavailable}
                openDirectly={lc.openDirectly}
                openWiki={lc.openWiki}
                lang={lang}
                originalQuery={query}
              />
            ))}
          </div>
        </>
      )}

      {results?.hits?.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(148,163,184,0.6)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔬</div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{lc.noResults.title}</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>{lc.noResults.sub}</div>
        </div>
      )}

      {results && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ fontSize: 11, fontWeight: 800, color: 'rgba(99,102,241,0.6)', cursor: 'pointer', userSelect: 'none', padding: '6px 0' }}>
            🛠 Debug: raw API response ({results.hits?.length ?? 0} hits normalized)
          </summary>
          <pre style={{
            marginTop: 8, padding: 14, borderRadius: 10,
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(99,102,241,0.2)',
            color: 'rgba(165,180,252,0.8)', fontSize: 10, lineHeight: 1.5,
            overflowX: 'auto', maxHeight: 320, overflowY: 'auto',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {JSON.stringify(results._raw ?? results, null, 2)}
          </pre>
        </details>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
    </div>
  )
}




function AgentTab({ isDark, lc, lang }) {
  const { user } = useAuth()
  // uuid is the unified identifier field for every user type (guest or signed-in)
  const userKey = user?.uuid || null
  const today = todayKey()

  const openPreview = useWikiPreview()
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: lc.agentGreeting,
      tiles: null,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false) // tránh ghi đè IndexedDB trước khi load xong lần đầu
  const logRef = useRef(null)
  const suppressSaveRef = useRef(false) // chặn 1 lượt lưu effect ngay sau khi setMessages cùng lúc

  // Reset messages when language config changes (language switch)
  useEffect(() => {
    setMessages([{
      role: 'assistant',
      content: lc.agentGreeting,
      tiles: null,
    }])
  }, [lc])

  // Khi user (đăng nhập) sẵn sàng: nạp lịch sử chat hôm nay từ IndexedDB.
  useEffect(() => {
    let cancelled = false
    setHistoryLoaded(false)
    ;(async () => {
      const todayMsgs = await getMessagesForDay(userKey, today)
      if (cancelled) return
      if (todayMsgs.length > 0) setMessages(todayMsgs)
      setHistoryLoaded(true)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey])

  // Tự động lưu mỗi khi messages đổi — chỉ khi đã load xong lần đầu.
  useEffect(() => {
    if (suppressSaveRef.current) { suppressSaveRef.current = false; return }
    if (!historyLoaded) return
    saveMessagesForDay(userKey, messages, today)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, historyLoaded, userKey])


  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [messages, loading])

  const sendMessage = async () => {
    const trimmed = input.trim()
    if (!trimmed || loading) return
    const baseMessages = messages
    setInput('')
    const userMsg = { role: 'user', content: trimmed, tiles: null }
    setMessages([...baseMessages, userMsg])
    setLoading(true)
    setSearching(true)

    let tiles = null
    let contextText = ''

    try {
      const searchData = await pixelSearch(trimmed, null, 4, lang)
      tiles = searchData?.hits || []
      setSearching(false)
      if (tiles.length > 0) {
        contextText = `\n\n[Retrieved ${tiles.length} Wikipedia visual hits: article IDs ${tiles.map(h => h.article_id).join(', ')}. Use these as visual evidence in your response.]`
      }
    } catch {
      setSearching(false)
      contextText = '\n\n[Visual search unavailable for this query.]'
    }

    try {
      const history = baseMessages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(baseMessages[0]?.role === 'assistant' ? 1 : 0)
        .map(m => ({ role: m.role, content: String(m.content) }))

      history.push({ role: 'user', content: trimmed + contextText })

      while (history.length > 0 && history[0].role !== 'user') history.shift()

      console.log('[Claude] messages:', history.length, '| first:', history[0]?.role)

      const reply = await callAI(history, lc.systemPrompt)
      setMessages(prev => [...prev, { role: 'assistant', content: reply, tiles, userQuery: trimmed }])
    } catch (e) {
      console.error('[Claude] error:', e)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${e.message}`,
        tiles,
        userQuery: trimmed,
      }])
    }
    setLoading(false)
  }

  const renderMarkdown = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(99,102,241,0.15);padding:2px 6px;border-radius:4px;font-size:0.9em">$1</code>')
      .replace(/\n/g, '<br/>')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '72vh', minHeight: 520 }}>
      {/* Chat log */}
      <div ref={logRef} style={{
        flex: 1, overflowY: 'auto', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 18,
        scrollbarWidth: 'thin',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.5, color: msg.role === 'user' ? '#a5b4fc' : '#7c3aed', paddingLeft: 4 }}>
              {msg.role === 'user' ? '👤 YOU' : '🤖 WIKI MED VISION AGENT'}
            </div>

            <div style={{
              padding: '13px 17px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              background: msg.role === 'user'
                ? 'linear-gradient(135deg,#6366f1,#7c3aed)'
                : 'rgba(15,10,40,0.7)',
              border: msg.role === 'user' ? 'none' : '1px solid rgba(99,102,241,0.2)',
              color: msg.role === 'user' ? '#fff' : (isDark ? '#e2e8f0' : '#1e1b4b'),
              fontSize: 14, lineHeight: 1.65,
              backdropFilter: 'blur(8px)',
            }} dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />

            {msg.role === 'assistant' && msg.content && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 4 }}>
                <SpeakButton text={msg.content} lang={lang} size="small" />
              </div>
            )}

            {msg.tiles?.length > 0 && (
              <div style={{ width: '100%' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(139,92,246,0.7)', marginBottom: 8, paddingLeft: 4 }}>
                  📸 Visual evidence ({msg.tiles.length} Wikipedia tiles)
                </div>
                <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
                  {msg.tiles.map((hit, ti) => (
                    <div
                      key={ti}
                      onClick={() => {
                        const wikiUrl = hit.displayUrl
                          || (hit.url ? `https://en.wikipedia.org/wiki/${hit.url}` : `https://en.wikipedia.org/?curid=${hit.article_id}`)
                        openPreview(wikiUrl, hit.displayTitle || hit.title)
                      }}
                      style={{
                        minWidth: 200, maxWidth: 200, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                        border: '1px solid rgba(99,102,241,0.25)',
                        background: 'rgba(10,5,30,0.6)',
                        transition: 'transform 0.15s',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                      onMouseLeave={e => e.currentTarget.style.transform = ''}
                    >
                      <img
                        src={tileUrl(hit.article_id, hit.tile_index, hit.chunk_index)}
                        alt="Wikipedia tile"
                        style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                      />
                      <div style={{ display: 'none', height: 110, alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                        {lc.tileUnavailable}
                      </div>
                      <div style={{ padding: '6px 10px', fontSize: 10, color: 'rgba(165,180,252,0.7)', fontWeight: 700 }}>
                        {hit.displayTitle && (
                          <div style={{ color: 'rgba(226,232,255,0.85)', fontWeight: 800, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hit.displayTitle}
                          </div>
                        )}
                        {hit.viCaption && (
                          <div style={{
                            marginTop: 4, fontWeight: 500, color: 'rgba(203,213,225,0.8)',
                            fontSize: 10, lineHeight: 1.4, whiteSpace: 'normal',
                          }}>
                            {hit.viCaption}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignSelf: 'flex-start', maxWidth: '80%' }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#7c3aed', paddingLeft: 4 }}>🤖 WIKI MED VISION AGENT</div>
            <div style={{
              padding: '13px 17px', borderRadius: '18px 18px 18px 4px',
              background: 'rgba(15,10,40,0.7)', border: '1px solid rgba(99,102,241,0.2)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 1, 2].map(d => (
                  <div key={d} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#6366f1',
                    animation: `dotBounce 1.2s ease-in-out ${d * 0.2}s infinite`,
                  }} />
                ))}
              </div>
              <span style={{ fontSize: 13, color: 'rgba(165,180,252,0.7)' }}>
                {searching ? (lang !== 'en' && lc.translatingText ? lc.translatingText : lc.searchingText) : lc.generatingText}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(99,102,241,0.15)', background: 'rgba(5,3,15,0.4)', backdropFilter: 'blur(12px)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto' }}>
          {lc.quickPrompts.map(p => (
            <button key={p} onClick={() => setInput(p)} style={{
              padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap',
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              color: isDark ? '#a5b4fc' : '#4338ca', fontSize: 11, fontWeight: 700, cursor: 'pointer',
            }}>{p}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder={lc.agentInputPlaceholder}
            style={{
              flex: 1, padding: '13px 16px', borderRadius: 14,
              border: '1px solid rgba(99,102,241,0.3)',
              background: 'rgba(99,102,241,0.08)',
              color: isDark ? '#e2e8f0' : '#1e1b4b',
              fontSize: 14, outline: 'none',
            }}
            onFocus={e => e.target.style.borderColor = '#6366f1'}
            onBlur={e => e.target.style.borderColor = 'rgba(99,102,241,0.3)'}
          />
          <MicButton onTranscript={text => setInput(i => i ? i + ' ' + text : text)} lang={lang} isDark={isDark} />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            style={{
              padding: '13px 22px', borderRadius: 14,
              background: loading || !input.trim() ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >↑</button>
        </div>
      </div>

      <style>{`@keyframes dotBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} } @keyframes micPulse { 0%,100%{box-shadow:0 0 0 3px rgba(239,68,68,0.25)} 50%{box-shadow:0 0 0 7px rgba(239,68,68,0.1)} }`}</style>
    </div>
  )
}


// ─── Main Panel ───────────────────────────────────────────────────────────────
export default function WikiMedVisionPanel({ onNext, onPrev, prevLabel, nextLabel }) {
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const [tab, setTab] = useState('agent')
  const [preview, setPreview] = useState(null) // { url, title } | null

  const openPreview = useCallback((url, title) => setPreview({ url, title }), [])
  const closePreview = useCallback(() => setPreview(null), [])

  // Get language-specific config — defaults to English for unknown langs
  const lc = getLangConfig(lang)

  const bg = isDark
    ? 'linear-gradient(135deg, #050314 0%, #0c0a1e 50%, #080520 100%)'
    : 'linear-gradient(135deg, #eef2ff 0%, #f5f3ff 50%, #ede9fe 100%)'

  const cardBg = isDark ? 'rgba(10,6,30,0.75)' : 'rgba(255,255,255,0.82)'
  const cardBorder = isDark ? 'rgba(99,102,241,0.22)' : 'rgba(99,102,241,0.18)'

  return (
    <WikiPreviewContext.Provider value={openPreview}>
    <div style={{ minHeight: '100%', background: bg, padding: '22px clamp(14px, 3vw, 28px) 36px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Header ── */}
        <div style={{
          borderRadius: 24, padding: '24px 28px',
          background: cardBg, border: `1px solid ${cardBorder}`,
          boxShadow: isDark ? '0 24px 60px rgba(99,102,241,0.15)' : '0 24px 60px rgba(99,102,241,0.12)',
          backdropFilter: 'blur(18px)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '5px 14px', marginBottom: 10, background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span style={{ fontSize: 12 }}>🔮</span>
                <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1.2, color: isDark ? '#a5b4fc' : '#4338ca', textTransform: 'uppercase' }}>Visual · Wikipedia</span>
              </div>
              <h1 style={{ margin: '0 0 8px', fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-0.04em', color: isDark ? '#e0e7ff' : '#1e1b4b' }}>
                Wiki Med{' '}
                <span style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Vision</span>
              </h1>
              <p style={{ margin: 0, color: isDark ? '#94a3b8' : '#64748b', fontSize: 14, maxWidth: 560, lineHeight: 1.65 }}>
                {lang === 'vi'
                  ? 'Tìm kiếm Wikipedia bằng văn bản hoặc hình ảnh — truy xuất ảnh chụp màn hình tile trực quan. Hỏi Agent để tổng hợp câu trả lời với bằng chứng trực quan từ Wikipedia.'
                  : 'Search Wikipedia by text or image — retrieves visual tile screenshots. Ask the Agent to synthesize answers with visual evidence from real Wikipedia pages.'}
              </p>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {[
              ].map(([val, lbl]) => (
                <div key={lbl} style={{ borderRadius: 16, padding: '10px 14px', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, color: isDark ? '#a5b4fc' : '#4338ca' }}>{val}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#64748b' : '#94a3b8', marginTop: 2 }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Tab bar + Panel ── */}
        <div style={{
          borderRadius: 24, overflow: 'hidden',
          background: cardBg, border: `1px solid ${cardBorder}`,
          boxShadow: isDark ? '0 24px 60px rgba(99,102,241,0.12)' : '0 24px 60px rgba(99,102,241,0.08)',
          backdropFilter: 'blur(18px)',
        }}>
          {/* Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0, borderBottom: `1px solid ${cardBorder}` }}>
            {[
              { id: 'agent', icon: '🤖', label: 'Agent', sub: lang === 'vi' ? 'AI tổng hợp trực quan' : 'AI + visual synthesis' },
              { id: 'search', icon: '🔍', label: lang === 'vi' ? 'Tìm kiếm' : 'Search', sub: lang === 'vi' ? 'Truy xuất Wikipedia trực quan' : 'Visual Wikipedia retrieval' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '18px 20px', border: 'none', cursor: 'pointer',
                  background: tab === t.id
                    ? (isDark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)')
                    : 'transparent',
                  borderBottom: tab === t.id ? '2px solid #6366f1' : '2px solid transparent',
                  display: 'flex', alignItems: 'center', gap: 12, transition: 'all 0.18s',
                }}
              >
                <span style={{ fontSize: 22 }}>{t.icon}</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 900, fontSize: 15, color: tab === t.id ? (isDark ? '#a5b4fc' : '#4338ca') : (isDark ? '#64748b' : '#94a3b8') }}>{t.label}</div>
                  <div style={{ fontSize: 11, color: isDark ? '#475569' : '#cbd5e1', fontWeight: 700 }}>{t.sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* Panel content */}
          {tab === 'search' && <SearchTab isDark={isDark} lc={lc} lang={lang} />}
          {tab === 'agent' && <AgentTab isDark={isDark} lc={lc} lang={lang} />}
        </div>

        {/* ── Nav buttons ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingTop: 4 }}>
          {onPrev && (
            <button onClick={onPrev} style={{
              padding: '11px 22px', borderRadius: 12, border: `1px solid ${cardBorder}`,
              background: cardBg, color: isDark ? '#94a3b8' : '#64748b',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}>← {prevLabel || (lang === 'vi' ? 'Quay lại' : 'Back')}</button>
          )}
          {onNext && (
            <button onClick={onNext} style={{
              padding: '11px 22px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              marginLeft: 'auto',
            }}>{nextLabel || (lang === 'vi' ? 'Tiếp theo' : 'Next')} →</button>
          )}
        </div>

      </div>
    </div>

    <WikiPreviewModal
      url={preview?.url}
      title={preview?.title}
      onClose={closePreview}
      isDark={isDark}
    />
    </WikiPreviewContext.Provider>
  )
}
