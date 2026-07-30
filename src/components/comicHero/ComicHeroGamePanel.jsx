// src/components/comicHero/ComicHeroGamePanel.jsx
// Chuyển đổi từ infinite-heroes/App.tsx — tính năng "Tạo Game bằng Avatar
// của Tôi": tạo 1 cuốn truyện tranh (comic) tương tác, cá nhân hoá bằng
// avatar/ảnh của người dùng, dùng Gemini (qua proxy server, xem
// geminiComicClient.js + api/groq-proxy.js, nhánh provider: 'gemini-comic').
import React, { useState, useRef, useEffect } from 'react'
import jsPDF from 'jspdf'
import { useAuth } from '../../context/AuthContext'
import {
  MAX_STORY_PAGES, BACK_COVER_PAGE, TOTAL_PAGES, INITIAL_PAGES, BATCH_SIZE,
  DECISION_PAGES, GENRES, TONES, LANGUAGES,
} from './types'
import { Setup } from './Setup'
import { Book } from './Book'
import {
  MODEL_IMAGE_GEN_NAME, MODEL_TEXT_NAME,
  generateComicText, generateComicImage, fileToBase64, imageUrlToBase64,
} from './geminiComicClient'
import './comicHero.css'

export default function ComicHeroGamePanel() {
  const { user } = useAuth()

  const [hero, setHeroState] = useState(null)
  const [friend, setFriendState] = useState(null)
  const [selectedGenre, setSelectedGenre] = useState(GENRES[0])
  const [selectedLanguage, setSelectedLanguage] = useState(LANGUAGES[0].code)
  const [customPremise, setCustomPremise] = useState('')
  const [storyTone, setStoryTone] = useState(TONES[0])
  const [richMode, setRichMode] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isLoadingProfileAvatar, setIsLoadingProfileAvatar] = useState(false)

  const heroRef = useRef(null)
  const friendRef = useRef(null)
  const setHero = (p) => { setHeroState(p); heroRef.current = p }
  const setFriend = (p) => { setFriendState(p); friendRef.current = p }

  const [comicFaces, setComicFaces] = useState([])
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0)
  const [isStarted, setIsStarted] = useState(false)

  const [showSetup, setShowSetup] = useState(true)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const generatingPages = useRef(new Set())
  const historyRef = useRef([])

  const hasProfileAvatar = Boolean(user?.avatar)

  const handleAPIError = (e) => {
    const msg = String(e?.message || e)
    console.error('[comicHero] API Error:', msg)
    setErrorMessage(
      e?.status === 401
        ? 'Không thể xác thực với Pollinations.AI. Vui lòng liên hệ quản trị viên để kiểm tra cấu hình POLLINATIONS_API_KEY.'
        : 'Có lỗi khi tạo nội dung. Vui lòng thử lại.'
    )
  }

  const generateBeat = async (history, pageNum, isDecisionPage) => {
    if (!heroRef.current) throw new Error('No Hero')

    const isFinalPage = pageNum === MAX_STORY_PAGES
    const langName = LANGUAGES.find((l) => l.code === selectedLanguage)?.name || 'English'

    const relevantHistory = history
      .filter((p) => p.type === 'story' && p.narrative && (p.pageIndex || 0) < pageNum)
      .sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0))

    const lastBeat = relevantHistory[relevantHistory.length - 1]?.narrative
    const lastFocus = lastBeat?.focus_char || 'none'

    const historyText = relevantHistory
      .map((p) => `[Page ${p.pageIndex}] [Focus: ${p.narrative?.focus_char}] (Caption: "${p.narrative?.caption || ''}") (Dialogue: "${p.narrative?.dialogue || ''}") (Scene: ${p.narrative?.scene}) ${p.resolvedChoice ? `-> USER CHOICE: "${p.resolvedChoice}"` : ''}`)
      .join('\n')

    let friendInstruction = 'Not yet introduced.'
    if (friendRef.current) {
      friendInstruction = 'ACTIVE and PRESENT (User Provided).'
      if (lastFocus !== 'friend' && Math.random() > 0.4) {
        friendInstruction += ' MANDATORY: FOCUS ON THE CO-STAR FOR THIS PANEL.'
      } else {
        friendInstruction += ' Ensure they are woven into the scene even if not the main focus.'
      }
    }

    let coreDriver = `GENRE: ${selectedGenre}. TONE: ${storyTone}.`
    if (selectedGenre === 'Custom') {
      coreDriver = `STORY PREMISE: ${customPremise || 'A totally unique, unpredictable adventure'}. (Follow this premise strictly over standard genre tropes).`
    }

    const guardrails = `
    NEGATIVE CONSTRAINTS:
    1. UNLESS GENRE IS "Dark Sci-Fi" OR "Superhero Action" OR "Custom": DO NOT use technical jargon like "Quantum", "Timeline", "Portal", "Multiverse", or "Singularity".
    2. IF GENRE IS "Teen Drama" OR "Lighthearted Comedy": The "stakes" must be SOCIAL, EMOTIONAL, or PERSONAL (e.g., a rumor, a competition, a broken promise, being late, embarrassing oneself). Do NOT make it life-or-death. Keep it grounded.
    3. Avoid "The artifact" or "The device" unless established earlier.
    `

    let instruction = `Continue the story. ALL OUTPUT TEXT (Captions, Dialogue, Choices) MUST BE IN ${langName.toUpperCase()}. ${coreDriver} ${guardrails}`
    if (richMode) {
      instruction += ' RICH/NOVEL MODE ENABLED. Prioritize deeper character thoughts, descriptive captions, and meaningful dialogue exchanges over short punchlines.'
    }

    if (isFinalPage) {
      instruction += " FINAL PAGE. KARMIC CLIFFHANGER REQUIRED. You MUST explicitly reference the User's choice from PAGE 3 in the narrative and show how that specific philosophy led to this conclusion. Text must end with 'TO BE CONTINUED...' (or localized equivalent)."
    } else if (isDecisionPage) {
      instruction += ' End with a PSYCHOLOGICAL choice about VALUES, RELATIONSHIPS, or RISK. (e.g., Truth vs. Safety, Forgive vs. Avenge). The options must NOT be simple physical actions like \'Go Left\'.'
    } else if (pageNum === 1) {
      instruction += ' INCITING INCIDENT. An event disrupts the status quo. Establish the genre\'s intended mood. (If Slice of Life: A social snag/surprise. If Adventure: A call to action).'
    } else if (pageNum <= 4) {
      instruction += ' RISING ACTION. The heroes engage with the new situation. Focus on dialogue, character dynamics, and initial challenges.'
    } else if (pageNum <= 8) {
      instruction += ' COMPLICATION. A twist occurs! A secret is revealed, a misunderstanding deepens, or the path is blocked. (Keep intensity appropriate to Genre - e.g. Social awkwardness for Comedy, Danger for Horror).'
    } else {
      instruction += ' CLIMAX. The confrontation with the main conflict. The truth comes out, the contest ends, or the battle is fought.'
    }

    const capLimit = richMode ? 'max 35 words. Detailed narration or internal monologue' : 'max 15 words'
    const diaLimit = richMode ? 'max 30 words. Rich, character-driven speech' : 'max 12 words'

    const prompt = `
You are writing a comic book script. PAGE ${pageNum} of ${MAX_STORY_PAGES}.
TARGET LANGUAGE FOR TEXT: ${langName} (CRITICAL: CAPTIONS, DIALOGUE, CHOICES MUST BE IN THIS LANGUAGE).
${coreDriver}

CHARACTERS:
- HERO: Active.
- CO-STAR: ${friendInstruction}

PREVIOUS PANELS (READ CAREFULLY):
${historyText.length > 0 ? historyText : 'Start the adventure.'}

RULES:
1. NO REPETITION. Do not use the same captions or dialogue from previous pages.
2. IF CO-STAR IS ACTIVE, THEY MUST APPEAR FREQUENTLY.
3. VARIETY. If page ${pageNum - 1} was an action shot, make this one a reaction or wide shot.
4. LANGUAGE: All user-facing text MUST be in ${langName}.
5. Avoid saying "CO-star" and "hero" in the text captions. Use names if established, or generic descriptors.

INSTRUCTION: ${instruction}

OUTPUT STRICT JSON ONLY (No markdown formatting):
{
  "caption": "Unique narrator text in ${langName}. (${capLimit}).",
  "dialogue": "Unique speech in ${langName}. (${diaLimit}). Optional.",
  "scene": "Vivid visual description (ALWAYS IN ENGLISH for the artist model). MUST mention 'HERO' or 'CO-STAR' if they are present.",
  "focus_char": "hero" OR "friend" OR "other",
  "choices": ["Option A in ${langName}", "Option B in ${langName}"] (Only if decision page)
}
`
    try {
      const res = await generateComicText({ model: MODEL_TEXT_NAME, contents: prompt, config: { responseMimeType: 'application/json' } })
      let rawText = res.text || '{}'
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim()

      const parsed = JSON.parse(rawText)

      if (parsed.dialogue) parsed.dialogue = parsed.dialogue.replace(/^[\w\s-]+:\s*/i, '').replace(/["']/g, '').trim()
      if (parsed.caption) parsed.caption = parsed.caption.replace(/^[\w\s-]+:\s*/i, '').trim()
      if (!isDecisionPage) parsed.choices = []
      if (isDecisionPage && !isFinalPage && (!parsed.choices || parsed.choices.length < 2)) parsed.choices = ['Option A', 'Option B']
      if (!['hero', 'friend', 'other'].includes(parsed.focus_char)) parsed.focus_char = 'hero'

      return parsed
    } catch (e) {
      console.error('Beat generation failed', e)
      handleAPIError(e)
      return {
        caption: pageNum === 1 ? 'It began...' : '...',
        scene: `Generic scene for page ${pageNum}.`,
        focus_char: 'hero',
        choices: [],
      }
    }
  }

  const generatePersona = async (desc) => {
    const style = selectedGenre === 'Custom' ? 'Modern American comic book art' : `${selectedGenre} comic`
    try {
      const res = await generateComicImage({
        model: MODEL_IMAGE_GEN_NAME,
        contents: { text: `STYLE: Masterpiece ${style} character sheet, detailed ink, neutral background. FULL BODY. Character: ${desc}` },
        config: { imageConfig: { aspectRatio: '1:1' } },
      })
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
      if (part?.inlineData?.data) return { base64: part.inlineData.data, desc }
      throw new Error('Failed')
    } catch (e) {
      handleAPIError(e)
      throw e
    }
  }

  const generateImage = async (beat, type) => {
    const contents = []
    if (heroRef.current?.base64) {
      contents.push({ text: 'REFERENCE 1 [HERO]:' })
      contents.push({ inlineData: { mimeType: 'image/jpeg', data: heroRef.current.base64 } })
    }
    if (friendRef.current?.base64) {
      contents.push({ text: 'REFERENCE 2 [CO-STAR]:' })
      contents.push({ inlineData: { mimeType: 'image/jpeg', data: friendRef.current.base64 } })
    }

    const styleEra = selectedGenre === 'Custom' ? 'Modern American' : selectedGenre
    let promptText = `STYLE: ${styleEra} comic book art, detailed ink, vibrant colors. `

    if (type === 'cover') {
      const langName = LANGUAGES.find((l) => l.code === selectedLanguage)?.name || 'English'
      promptText += `TYPE: Comic Book Cover. TITLE: "INFINITE HEROES" (OR LOCALIZED TRANSLATION IN ${langName.toUpperCase()}). Main visual: Dynamic action shot of [HERO] (Use REFERENCE 1).`
    } else if (type === 'back_cover') {
      promptText += 'TYPE: Comic Back Cover. FULL PAGE VERTICAL ART. Dramatic teaser. Text: "NEXT ISSUE SOON".'
    } else {
      promptText += `TYPE: Vertical comic panel. SCENE: ${beat.scene}. `
      promptText += "INSTRUCTIONS: Maintain strict character likeness. If scene mentions 'HERO', you MUST use REFERENCE 1. If scene mentions 'CO-STAR' or 'SIDEKICK', you MUST use REFERENCE 2."
      if (beat.caption) promptText += ` INCLUDE CAPTION BOX: "${beat.caption}"`
      if (beat.dialogue) promptText += ` INCLUDE SPEECH BUBBLE: "${beat.dialogue}"`
    }

    contents.push({ text: promptText })

    try {
      const res = await generateComicImage({
        model: MODEL_IMAGE_GEN_NAME,
        contents,
        config: { imageConfig: { aspectRatio: '2:3' } },
      })
      const part = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
      return part?.inlineData?.data ? `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` : ''
    } catch (e) {
      handleAPIError(e)
      return ''
    }
  }

  const updateFaceState = (id, updates) => {
    setComicFaces((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)))
    const idx = historyRef.current.findIndex((f) => f.id === id)
    if (idx !== -1) historyRef.current[idx] = { ...historyRef.current[idx], ...updates }
  }

  const generateSinglePage = async (faceId, pageNum, type) => {
    const isDecision = DECISION_PAGES.includes(pageNum)
    let beat = { scene: '', choices: [], focus_char: 'other' }

    if (type === 'cover') {
      // Bìa xử lý trực tiếp trong generateImage
    } else if (type === 'back_cover') {
      beat = { scene: 'Thematic teaser image', choices: [], focus_char: 'other' }
    } else {
      beat = await generateBeat(historyRef.current, pageNum, isDecision)
    }

    if (beat.focus_char === 'friend' && !friendRef.current && type === 'story') {
      try {
        const newSidekick = await generatePersona(selectedGenre === 'Custom' ? 'A fitting sidekick for this story' : `Sidekick for ${selectedGenre} story.`)
        setFriend(newSidekick)
      } catch (e) { beat.focus_char = 'other' }
    }

    updateFaceState(faceId, { narrative: beat, choices: beat.choices, isDecisionPage: isDecision })
    const url = await generateImage(beat, type)
    updateFaceState(faceId, { imageUrl: url, isLoading: false })
  }

  const generateBatch = async (startPage, count) => {
    const pagesToGen = []
    for (let i = 0; i < count; i++) {
      const p = startPage + i
      if (p <= TOTAL_PAGES && !generatingPages.current.has(p)) pagesToGen.push(p)
    }
    if (pagesToGen.length === 0) return
    pagesToGen.forEach((p) => generatingPages.current.add(p))

    const newFaces = []
    pagesToGen.forEach((pageNum) => {
      const type = pageNum === BACK_COVER_PAGE ? 'back_cover' : 'story'
      newFaces.push({ id: `page-${pageNum}`, type, choices: [], isLoading: true, pageIndex: pageNum })
    })

    setComicFaces((prev) => {
      const existing = new Set(prev.map((f) => f.id))
      return [...prev, ...newFaces.filter((f) => !existing.has(f.id))]
    })
    newFaces.forEach((f) => { if (!historyRef.current.find((h) => h.id === f.id)) historyRef.current.push(f) })

    try {
      for (const pageNum of pagesToGen) {
        await generateSinglePage(`page-${pageNum}`, pageNum, pageNum === BACK_COVER_PAGE ? 'back_cover' : 'story')
        generatingPages.current.delete(pageNum)
      }
    } catch (e) {
      console.error('Batch generation error', e)
    } finally {
      pagesToGen.forEach((p) => generatingPages.current.delete(p))
    }
  }

  const launchStory = async () => {
    if (!heroRef.current) return
    if (selectedGenre === 'Custom' && !customPremise.trim()) {
      setErrorMessage('Vui lòng nhập cốt truyện của bạn.')
      return
    }
    setErrorMessage('')
    setIsTransitioning(true)

    let availableTones = TONES
    if (selectedGenre === 'Teen Drama / Slice of Life' || selectedGenre === 'Lighthearted Comedy') {
      availableTones = TONES.filter((t) => t.includes('CASUAL') || t.includes('WHOLESOME') || t.includes('QUIPPY'))
    } else if (selectedGenre === 'Classic Horror') {
      availableTones = TONES.filter((t) => t.includes('INNER-MONOLOGUE') || t.includes('OPERATIC'))
    }
    setStoryTone(availableTones[Math.floor(Math.random() * availableTones.length)])

    const coverFace = { id: 'cover', type: 'cover', choices: [], isLoading: true, pageIndex: 0 }
    setComicFaces([coverFace])
    historyRef.current = [coverFace]
    generatingPages.current.add(0)

    generateSinglePage('cover', 0, 'cover').finally(() => generatingPages.current.delete(0))

    setTimeout(async () => {
      setIsStarted(true)
      setShowSetup(false)
      setIsTransitioning(false)
      await generateBatch(1, INITIAL_PAGES)
      generateBatch(3, 3)
    }, 1100)
  }

  const handleChoice = async (pageIndex, choice) => {
    updateFaceState(`page-${pageIndex}`, { resolvedChoice: choice })
    const maxPage = Math.max(...historyRef.current.map((f) => f.pageIndex || 0))
    if (maxPage + 1 <= TOTAL_PAGES) generateBatch(maxPage + 1, BATCH_SIZE)
  }

  const resetApp = () => {
    setIsStarted(false)
    setShowSetup(true)
    setComicFaces([])
    setCurrentSheetIndex(0)
    historyRef.current = []
    generatingPages.current.clear()
    setHero(null)
    setFriend(null)
    setErrorMessage('')
  }

  const downloadPDF = () => {
    const PAGE_WIDTH = 480
    const PAGE_HEIGHT = 720
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_WIDTH, PAGE_HEIGHT] })
    const pagesToPrint = comicFaces.filter((face) => face.imageUrl && !face.isLoading).sort((a, b) => (a.pageIndex || 0) - (b.pageIndex || 0))

    pagesToPrint.forEach((face, index) => {
      if (index > 0) doc.addPage([PAGE_WIDTH, PAGE_HEIGHT], 'portrait')
      if (face.imageUrl) doc.addImage(face.imageUrl, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT)
    })
    doc.save('Infinite-Heroes-Issue.pdf')
  }

  const handleHeroUpload = async (file) => {
    try {
      const base64 = await fileToBase64(file)
      setHero({ base64, desc: 'The Main Hero' })
      setErrorMessage('')
    } catch (e) { setErrorMessage('Tải ảnh nhân vật chính thất bại.') }
  }
  const handleFriendUpload = async (file) => {
    try {
      const base64 = await fileToBase64(file)
      setFriend({ base64, desc: 'The Sidekick/Rival' })
    } catch (e) { setErrorMessage('Tải ảnh nhân vật phụ thất bại.') }
  }

  const handleUseMyAvatar = async () => {
    if (!user?.avatar) return
    setIsLoadingProfileAvatar(true)
    setErrorMessage('')
    try {
      const base64 = await imageUrlToBase64(user.avatar)
      if (base64) {
        setHero({ base64, desc: 'The Main Hero (based on my profile avatar)' })
      } else {
        setErrorMessage('Không thể dùng avatar hiện có (do giới hạn truy cập ảnh) — vui lòng tải ảnh lên thủ công.')
      }
    } finally {
      setIsLoadingProfileAvatar(false)
    }
  }

  const handleSheetClick = (index) => {
    if (!isStarted) return
    if (index === 0 && currentSheetIndex === 0) return
    if (index < currentSheetIndex) setCurrentSheetIndex(index)
    else if (index === currentSheetIndex && comicFaces.find((f) => f.pageIndex === index)?.imageUrl) setCurrentSheetIndex((prev) => prev + 1)
  }

  return (
    <div className="comic-hero-root">
      <div className="comic-scene">
        <Setup
          show={showSetup}
          isTransitioning={isTransitioning}
          hero={hero}
          friend={friend}
          selectedGenre={selectedGenre}
          selectedLanguage={selectedLanguage}
          customPremise={customPremise}
          richMode={richMode}
          errorMessage={errorMessage}
          hasProfileAvatar={hasProfileAvatar}
          isLoadingProfileAvatar={isLoadingProfileAvatar}
          onUseMyAvatar={handleUseMyAvatar}
          onHeroUpload={handleHeroUpload}
          onFriendUpload={handleFriendUpload}
          onGenreChange={setSelectedGenre}
          onLanguageChange={setSelectedLanguage}
          onPremiseChange={setCustomPremise}
          onRichModeChange={setRichMode}
          onLaunch={launchStory}
        />

        <Book
          comicFaces={comicFaces}
          currentSheetIndex={currentSheetIndex}
          isStarted={isStarted}
          isSetupVisible={showSetup && !isTransitioning}
          onSheetClick={handleSheetClick}
          onChoice={handleChoice}
          onOpenBook={() => setCurrentSheetIndex(1)}
          onDownload={downloadPDF}
          onReset={resetApp}
        />
      </div>
    </div>
  )
}
