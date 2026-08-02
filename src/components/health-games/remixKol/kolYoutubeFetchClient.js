// src/components/health-games/remixKol/kolYoutubeFetchClient.js
// Gọi server để tải 1 clip YouTube về (server upload thẳng lên R2, xem giới
// hạn ở api/_lib/kolYoutubeDownload.js). Nếu thất bại (rất có thể xảy ra —
// xem comment ở file đó), caller nên fallback sang cho user chọn file để
// upload thủ công qua uploadKolFileToR2() bên dưới (luôn hoạt động 100%,
// không phụ thuộc server tải hộ).

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
  // { url, mimeType, title, durationSeconds, size }
  return data
}

/**
 * Upload 1 File/Blob video THẲNG lên R2 từ trình duyệt (không đi qua Vercel
 * Function, không giới hạn 4.5MB) — dùng cho video user tự chọn file
 * (kind: 'raw') và video kết quả AI Pose ghép ra ở client (kind: 'posed').
 * @param {File|Blob} fileOrBlob
 * @param {'raw'|'posed'} kind
 * @returns {Promise<{ url: string, size: number }>}
 */
export async function uploadKolFileToR2(fileOrBlob, kind) {
  const contentType = fileOrBlob.type || 'video/mp4'

  const presignRes = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'kol-r2-upload-url', kind, contentType }),
  })
  const presign = await presignRes.json().catch(() => ({}))
  if (!presignRes.ok) {
    throw new Error(presign?.error || `HTTP ${presignRes.status}`)
  }

  const putRes = await fetch(presign.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: fileOrBlob,
  })
  if (!putRes.ok) {
    throw new Error(`Upload lên R2 thất bại (HTTP ${putRes.status}).`)
  }

  return { url: presign.publicUrl, size: fileOrBlob.size || 0 }
}
