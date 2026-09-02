// api/_lib/groqModels.js
// Nguồn sự thật DUY NHẤT cho tên model Groq dùng ở phía server (api/_lib/*.js).
// Groq thông báo ngừng hỗ trợ 'llama-3.3-70b-versatile' và
// 'meta-llama/llama-4-scout-17b-16e-instruct' ngày 17/6/2026, chính thức
// decommission ngày 16/8/2026 (xem https://console.groq.com/docs/deprecations).
// Khi Groq lại deprecate model tiếp theo, chỉ cần sửa đúng 2 dòng dưới đây
// thay vì lục từng file api/_lib/*.js.
export const GROQ_TEXT_MODEL = 'openai/gpt-oss-120b'
export const GROQ_VISION_MODEL = 'qwen/qwen3.6-27b'
