/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo) into
 * ai-doctor-admin-main as the "AI chatbot control" panel.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */

/**
 * Default text-generation model to use. This is the same free-tier
 * `generateContent` model already used elsewhere in this project (see
 * AffiliateSystemControlPanel.jsx), unlike the paid/quota-limited Gemini
 * Live API (native-audio-dialog) that the original chatterbots demo used.
 */
export const DEFAULT_TEXT_MODEL = 'gemini-2.5-flash-preview-09-2025'
