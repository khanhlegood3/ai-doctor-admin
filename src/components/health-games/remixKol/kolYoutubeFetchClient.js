// src/components/health-games/remixKol/kolYoutubeFetchClient.js
// Gọi server để tải 1 clip YouTube NGẮN về (xem giới hạn ở
// api/_lib/kolYoutubeDownload.js). Nếu thất bại (rất có thể xảy ra — xem
// comment ở file đó), caller nên fallback sang cho user chọn file để upload
// thủ công (luôn hoạt động 100%, không phụ thuộc server).

export async function fetchYoutubeClipViaServer(youtubeUrl) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'kol-youtube-fetch', youtubeUrl }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  // { base64, mimeType, title, durationSeconds }
  return data
}
