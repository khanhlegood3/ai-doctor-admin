// src/components/comicHero/types.js
// Chuyển đổi từ infinite-heroes/types.ts — các hằng số & shape dữ liệu dùng
// chung cho tính năng "Tạo Game bằng Avatar của Tôi" (Comic Hero Game).

export const MAX_STORY_PAGES = 10
export const BACK_COVER_PAGE = 11
export const TOTAL_PAGES = 11
export const INITIAL_PAGES = 2
export const GATE_PAGE = 2
export const BATCH_SIZE = 6
export const DECISION_PAGES = [3]

export const GENRES = [
  'Classic Horror', 'Superhero Action', 'Dark Sci-Fi', 'High Fantasy',
  'Neon Noir Detective', 'Wasteland Apocalypse', 'Lighthearted Comedy',
  'Teen Drama / Slice of Life', 'Custom',
]

export const TONES = [
  'ACTION-HEAVY (Short, punchy dialogue. Focus on kinetics.)',
  'INNER-MONOLOGUE (Heavy captions revealing thoughts.)',
  'QUIPPY (Characters use humor as a defense mechanism.)',
  'OPERATIC (Grand, dramatic declarations and high stakes.)',
  'CASUAL (Natural dialogue, focus on relationships/gossip.)',
  'WHOLESOME (Warm, gentle, optimistic.)',
]

export const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'ar-EG', name: 'Arabic (Egypt)' },
  { code: 'de-DE', name: 'German (Germany)' },
  { code: 'es-MX', name: 'Spanish (Mexico)' },
  { code: 'fr-FR', name: 'French (France)' },
  { code: 'hi-IN', name: 'Hindi (India)' },
  { code: 'id-ID', name: 'Indonesian (Indonesia)' },
  { code: 'it-IT', name: 'Italian (Italy)' },
  { code: 'ja-JP', name: 'Japanese (Japan)' },
  { code: 'ko-KR', name: 'Korean (South Korea)' },
  { code: 'pt-BR', name: 'Portuguese (Brazil)' },
  { code: 'ru-RU', name: 'Russian (Russia)' },
  { code: 'ua-UA', name: 'Ukrainian (Ukraine)' },
  { code: 'vi-VN', name: 'Vietnamese (Vietnam)' },
  { code: 'zh-CN', name: 'Chinese (China)' },
]

// ComicFace: { id, type: 'cover'|'story'|'back_cover', imageUrl?, narrative?,
//              choices, resolvedChoice?, isLoading, pageIndex?, isDecisionPage? }
// Beat: { caption?, dialogue?, scene, choices, focus_char: 'hero'|'friend'|'other' }
// Persona: { base64, desc }
