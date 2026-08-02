/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo) into
 * ai-doctor-admin-main as the "AI chatbot control" panel.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */

/**
 * Default text-generation model to use when this panel needs to display a
 * model label. Actual generation runs server-side in
 * api/_lib/aiChatbotControlProxy.js with the same stable Gemini model, unlike
 * the paid/quota-limited Gemini Live API (native-audio-dialog) that the
 * original chatterbots demo used.
 */
export const DEFAULT_TEXT_MODEL = 'gemini-3.1-flash-lite'
