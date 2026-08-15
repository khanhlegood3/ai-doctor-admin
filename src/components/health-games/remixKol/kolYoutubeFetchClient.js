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

// Song song fetchYoutubeClipViaServer() ở trên, cho nguồn Facebook — xem
// giới hạn ở api/_lib/facebookDownload.js (chỉ hoạt động với video công
// khai). Cùng cách fallback: nếu thất bại, cho user chọn file upload thủ
// công qua uploadKolFileToR2() bên dưới.
export async function fetchFacebookClipViaServer(facebookUrl) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'kol-facebook-fetch', facebookUrl }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`)
  }
  // { url, mimeType, title, durationSeconds, size }
  return data
}

// Ngưỡng an toàn cho fallback base64-qua-server: Vercel serverless function
// giới hạn CỨNG ~4.5MB cho request body (không cấu hình được), base64 lại
// phình thêm ~33% — nên KHÔNG thử fallback này cho file lớn hơn ngưỡng dưới
// đây, để tránh gửi 1 request chắc chắn sẽ bị chặn (HTTP 413) thay vì báo
// lỗi rõ ràng ngay từ đầu. Cùng ngưỡng với Bring Any Idea to Life (xem
// src/bring-any-idea-to-life-khanh/src/lib/imageCompress.ts).
const MAX_BASE64_FALLBACK_BYTES = 3 * 1024 * 1024 // 3MB

async function presignKolUpload(kind, contentType, bucketSlot) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'kol-r2-upload-url', kind, contentType, bucketSlot }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(data?.error || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('Không đọc được dữ liệu video.'))
    reader.readAsDataURL(blob)
  })
}

async function uploadKolFileToR2ViaServer(fileOrBlob, kind, contentType) {
  const dataUrl = await blobToDataUrl(fileOrBlob)
  const base64Data = dataUrl.split(',')[1] || ''
  const uploadRes = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: 'kol-r2-upload-base64', kind, contentType, base64Data }),
  })
  const uploaded = await uploadRes.json().catch(() => ({}))
  if (!uploadRes.ok) {
    throw new Error(uploaded?.error || `HTTP ${uploadRes.status}`)
  }
  return { url: uploaded.url, size: uploaded.size || fileOrBlob.size || 0 }
}

/**
 * Upload 1 File/Blob video THẲNG lên R2 từ trình duyệt qua presigned PUT
 * URL — không đi qua Vercel Function nên không dính giới hạn ~4.5MB.
 *
 * Trước đây: chỉ thử ĐÚNG 1 bucket (chính); PUT thất bại vì BẤT KỲ lý do gì
 * (thường là CORS chưa cấu hình đúng ở bucket đó — đã từng gặp thực tế) đều
 * rơi thẳng vào fallback base64-qua-server (uploadKolFileToR2ViaServer) —
 * fallback này đi qua Vercel Function nên với file video (luôn > vài MB)
 * CHẮC CHẮN dính giới hạn 4.5MB, trả về đúng lỗi Khánh gặp: HTTP 413.
 *
 * Giờ: thử bucket chính (slot 0) trước; nếu lỗi, thử lại bucket dự phòng
 * (slot 1, nếu server có cấu hình — giống hệt pattern đã dùng ở Bring Any
 * Idea to Life, xem historyR2Client.ts::uploadSourceFileToR2). CHỈ khi CẢ
 * HAI bucket đều thất bại mới cân nhắc fallback base64-qua-server, và CHỈ
 * khi file đủ nhỏ (<= MAX_BASE64_FALLBACK_BYTES) — file lớn hơn sẽ báo lỗi
 * rõ ràng ngay (khả năng cao là do CORS bucket R2 chưa cấu hình đúng) thay
 * vì âm thầm gửi 1 request chắc chắn 413.
 *
 * @param {File|Blob} fileOrBlob
 * @param {'raw'|'posed'} kind
 * @returns {Promise<{ url: string, size: number }>}
 */
export async function uploadKolFileToR2(fileOrBlob, kind) {
  const contentType = fileOrBlob.type || 'video/mp4'
  const size = fileOrBlob.size || 0

  const tryDirectPut = async (bucketSlot) => {
    const presign = await presignKolUpload(kind, contentType, bucketSlot)
    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: fileOrBlob,
    })
    if (!putRes.ok) {
      throw new Error(`Upload lên R2 thất bại (HTTP ${putRes.status}).`)
    }
    return { url: presign.publicUrl, size }
  }

  try {
    return await tryDirectPut(0)
  } catch (mainErr) {
    console.warn('[kol-r2] Upload bucket chính thất bại, thử bucket dự phòng:', mainErr)
    try {
      return await tryDirectPut(1)
    } catch (fallbackErr) {
      console.warn('[kol-r2] Upload bucket dự phòng cũng thất bại:', fallbackErr)

      if (size > MAX_BASE64_FALLBACK_BYTES) {
        throw new Error(
          `Không upload được video "${fileOrBlob.name || kind}" (${(size / 1024 / 1024).toFixed(1)}MB) lên R2 ` +
            `qua cả bucket chính lẫn bucket dự phòng. Nhiều khả năng do CORS của bucket R2 chưa cho phép PUT từ ` +
            `domain trang web (kiểm tra ở Cloudflare Dashboard → R2 → bucket → Settings → CORS Policy — cần có ` +
            `PUT trong AllowedMethods và đúng domain trong AllowedOrigins cho CẢ 2 bucket). Video quá lớn ` +
            `(> ${(MAX_BASE64_FALLBACK_BYTES / 1024 / 1024).toFixed(0)}MB) để dùng phương án dự phòng qua server. ` +
            `Chi tiết lỗi: ${fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)}`
        )
      }

      // File đủ nhỏ — thử fallback base64 qua server (chấp nhận được vì
      // dưới giới hạn 4.5MB của Vercel kể cả sau khi base64 phình thêm ~33%).
      return uploadKolFileToR2ViaServer(fileOrBlob, kind, contentType)
    }
  }
}
