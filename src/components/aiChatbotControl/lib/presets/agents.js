/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */

export const INTERLOCUTOR_VOICES = [
  'Aoede',
  'Charon',
  'Fenrir',
  'Kore',
  'Leda',
  'Orus',
  'Puck',
  'Zephyr',
]

export const AGENT_COLORS = [
  '#4285f4',
  '#ea4335',
  '#fbbc04',
  '#34a853',
  '#fa7b17',
  '#f538a0',
  '#a142f4',
  '#24c1e0',
]

// 7 phong cách hình nền cho khuôn mặt tròn AI (SharedFaceAvatar.jsx) —
// dùng chung ở: trang "🤖 AI chatbot control", nút mic 2 trang "Anh Hùng",
// và popup chatbot chung (GlobalAIChatbot.jsx).
export const FACE_STYLES = [
  { id: 'round', vi: 'Tròn ấm áp', en: 'Warm round' },
  { id: 'robot', vi: 'Vuông rô-bốt', en: 'Robot square' },
  { id: 'triangle', vi: 'Tam giác', en: 'Triangle' },
  { id: 'star', vi: 'Ngôi sao', en: 'Star' },
  { id: 'hexagon', vi: 'Lục giác', en: 'Hexagon' },
  { id: 'diamond', vi: 'Kim cương', en: 'Diamond' },
  { id: 'heart', vi: 'Trái tim', en: 'Heart' },
]

export const createNewAgent = (properties) => {
  return {
    id: Math.random().toString(36).substring(2, 15),
    name: '',
    personality: '',
    bodyColor: AGENT_COLORS[Math.floor(Math.random() * AGENT_COLORS.length)],
    voice: Math.random() > 0.5 ? 'Charon' : 'Aoede',
    ...properties,
  }
}

// ─── Chatbot AI DUY NHẤT cho toàn dự án ─────────────────────────────────────
// Trước đây có 4 "nhân vật" demo gốc (Chic Charlotte, Proper Paul, Chef Shane,
// Passport Penny — mỗi người 1 tính cách/nghề nghiệp khác nhau, không liên
// quan gì đến dự án). Theo yêu cầu: trang "chatterbots" (AI chatbot control)
// giờ CHỈ CÒN 1 chatbot duy nhất, dùng icon khuôn mặt cười 😊, đóng vai trò
// TRỢ LÝ AI CHUNG cho toàn bộ dự án — đồng bộ giọng điệu/vai trò với
// SYSTEM_PROMPT_VI/EN trong src/lib/useGlobalAIChatbotEngine.js (chatbot AI
// chung 🤗 dùng ở khắp nơi khác trong app), để cảm giác là CÙNG 1 trợ lý dù
// đang ở tab "Chat AI chung" hay tab "Trợ lý thoại companion".
export const ProjectAI = {
  id: 'project-ai',
  name: '😊 Trợ Lý AI Dự Án',
  personality: `\
You are the one and only AI assistant for this entire health platform (Hiến Máu Nhân Văn) — \
a friendly, warm, and helpful companion with a cheerful smiling personality (😊), not a themed \
character or a niche expert. You greet people warmly and help them with anything about the \
platform — donating blood, tracking their health journey, understanding their profile — as \
well as general, easy-to-understand health questions. \
All talking is kept to 30 words or less, warm and encouraging in tone. \
You never diagnose conditions or prescribe treatment — you always encourage people to consult \
a real doctor for personal health decisions, especially for anything serious. \
If someone describes an emergency (chest pain, trouble breathing, fainting, seizures, heavy \
bleeding), you tell them to seek emergency care immediately.`,
  bodyColor: '#14b8a6',
  faceStyle: 'round',
  voice: 'Aoede',
}
