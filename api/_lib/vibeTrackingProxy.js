// api/_lib/vibeTrackingProxy.js
// Backend cho tính năng "Vibe Tracking" (chuyển đổi từ vibeviz.zip, app AI
// Studio gốc gọi thẳng @google/genai + API key nhúng client bằng
// `process.env.GEMINI_API_KEY` — KHÔNG an toàn để deploy thật, vì bất kỳ ai
// mở DevTools cũng lấy được key). DÙNG CHUNG endpoint /api/groq-proxy (xem
// api/groq-proxy.js, field `provider: 'vibe-tracking'`) — không tạo
// Serverless Function mới vì Vercel giới hạn 12 functions (đã dùng hết, xem
// api/groq-proxy.js và api/_lib/visionSyncProxy.js — cùng lý do).
//
// Hai nhánh (đúng 2 tab của app gốc):
//   1. `emotion` — tab "Emotion Mesh": phân tích blendshape khuôn mặt trung
//      bình (MediaPipe Face Landmarker) + cảm xúc/vibe score, trả về
//      { summary, details }. Bản gốc gọi model 'gemini-3-flash-preview'.
//   2. `sign`    — tab "Sign Language": phân tích chuỗi toạ độ tay/mặt
//      (MediaPipe Hand + Face Landmarker) để dịch sang câu tiếng Anh, trả
//      về { summary (bản dịch), details (giải thích) }.
// Cả hai đổi sang GROQ (đã có GROQ_API_KEY, miễn phí — dùng chế độ JSON
// response_format tương thích OpenAI) thay vì Gemini thật, giữ đúng tinh
// thần "$0, không cần key Gemini trả phí" như Vision Sync/Comic Hero đã áp
// dụng trước đó.

export class VibeTrackingProxyError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'VibeTrackingProxyError'
    this.status = status
  }
}

async function callGroqJSON({ groqApiKey, systemInstruction, prompt }) {
  if (!groqApiKey) {
    throw new VibeTrackingProxyError(
      'GROQ_API_KEY not configured. Get a free key at https://console.groq.com and add it in Vercel → Settings → Environment Variables.',
      500,
    )
  }

  const messages = []
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction })
  messages.push({ role: 'user', content: prompt })

  const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 1024,
    }),
  })

  const data = await upstream.json().catch(() => ({}))
  if (!upstream.ok) {
    throw new VibeTrackingProxyError(data?.error?.message || `Groq error (${upstream.status})`, upstream.status)
  }

  const text = data?.choices?.[0]?.message?.content?.trim() || '{}'
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

// Tab "Emotion Mesh" (VibeVizTab gốc) — phân tích blendshape trung bình.
export async function runVibeTrackingEmotionAnalysis({ groqApiKey, avgBlendshapes, dominantEmotion, vibeValue, numFaces }) {
  const prompt = `You are an AI assistant helping to analyze a audience's engagement and emotional state during the current session.
Here are the average facial blendshape scores (from 0.0 to 1.0) of the student(s) over the recorded time interval. If there are multiple people, this represents the average group emotion:
${JSON.stringify(avgBlendshapes || {}, null, 2)}

Current dominant emotion detected by heuristic model: ${dominantEmotion || 'Neutral'}
Current Vibe Check (0 = negative, 1 = positive): ${typeof vibeValue === 'number' ? vibeValue.toFixed(2) : '0.50'}
Number of people detected: ${numFaces || 0}

Based on these facial muscle activations and the heuristic data, provide a short, insightful summary (1-2 sentences) of how the student(s) are feeling. Then, provide a detailed step-by-step analysis and evidence based on the facial blendshapes to support your summary.

Respond ONLY with a JSON object of this exact shape: { "summary": string, "details": string }. No markdown, no extra text.`

  const result = await callGroqJSON({ groqApiKey, prompt })
  return {
    summary: result?.summary || 'No summary generated.',
    details: result?.details || '',
  }
}

// Tab "Sign Language" (CustomAnalyticsTab gốc) — dịch chuỗi toạ độ tay/mặt.
export async function runVibeTrackingSignAnalysis({ groqApiKey, compactData }) {
  const systemInstruction = `## Role
You are a High-Speed Sign Language Interpreter (ASL/CSL specialist). You translate sequences of normalized landmark coordinates and facial blendshapes into natural English.

## Spatial Zone Map (Relative to Nose/Neck)
- ZONE_FACE (y > 0.1): Origin for signs like "THINK", "KNOW", "THANK YOU".
- ZONE_CHEST (y approx 0): Origin for signs like "ME", "MINE", "FINISH", "PLEASE".
- ZONE_NEUTRAL: Space in front of the torso.

## Data Interpretation Logic
- **Anchor Priority:** The STARTING ZONE of a movement is the strongest classifier.
- **Movement Physics:** - "THANK YOU" MUST start in ZONE_FACE (near lips) and move outward (+Z).
    - "FINISH" MUST start in ZONE_CHEST and move downward/outward with a hand-flip.
- **Priority:** Hand trajectories > Spatial Anchor > Finger states > Facial Blendshapes.

## Output Constraints
- Only output the requested JSON schema.
- If a movement is ambiguous, use the Facial Blendshape (e.g., Smile vs. Pucker) as the tie-breaker.`

  const dataString = JSON.stringify(compactData || [])
  const prompt = `Context: Daily Conversation
FPS: 15
Window: ${Array.isArray(compactData) ? compactData.length : 0} Frames

## Reference Examples for Calibration:
1. CORRECT (Thank You): Start: ZONE_FACE (near mouth) -> End: ZONE_NEUTRAL. Result: "Thank you"
2. CORRECT (Finish): Start: ZONE_CHEST -> End: ZONE_NEUTRAL (sweeping down). Result: "Finished"
3. INCORRECT (Mixed): If movement starts at Chest, it CANNOT be "Thank You".

## Current Input Sequence:
${dataString}

## Task:
Analyze the STARTING position of the hand relative to the face landmarks. Translate the sequence into natural English.

Respond ONLY with a JSON object of this exact shape: { "translation": string, "reasoning": string }. No markdown, no extra text.`

  const result = await callGroqJSON({ groqApiKey, systemInstruction, prompt })
  return {
    summary: result?.translation || 'No translation generated.',
    details: result?.reasoning || '',
  }
}
