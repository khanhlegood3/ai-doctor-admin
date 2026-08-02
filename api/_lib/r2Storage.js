// api/_lib/r2Storage.js
// ---------------------------------------------------------------------------
// Helper DÙNG CHUNG cho mọi tính năng cần lưu file lớn (video, ảnh gốc, ...)
// vào Cloudflare R2 thay vì nhồi base64 vào IndexedDB/Vercel — bắt đầu với
// tính năng Remix KOL (xem api/_lib/kolYoutubeDownload.js).
//
// TẠI SAO aws4fetch: R2 tương thích S3 API, aws4fetch chỉ ký request theo
// chuẩn SigV4 (không có dependency nào khác) — rất nhẹ, phù hợp Vercel
// Serverless Function (khác hẳn @aws-sdk/client-s3 vốn nặng và kéo theo
// nhiều package con).
//
// BIẾN MÔI TRƯỜNG CẦN CÓ (Vercel → Settings → Environment Variables, tạo
// trong Cloudflare Dashboard → R2 → Manage API Tokens):
//   R2_ACCESS_KEY_ID      - Access Key ID của R2 API token
//   R2_SECRET_ACCESS_KEY  - Secret Access Key tương ứng
//   R2_ENDPOINT           - endpoint S3 API, dạng
//                            https://<ACCOUNT_ID>.r2.cloudflarestorage.com
//   R2_BUCKET_NAME        - tên bucket
//   R2_ACCESS_URL         - base URL public để ĐỌC lại file (r2.dev bucket
//                            subdomain, hoặc custom domain đã gắn cho bucket)
//   R2_TOKEN_VALUE        - Cloudflare API Token gốc (không dùng cho luồng
//                            S3-compatible này — giữ lại phòng khi cần gọi
//                            thẳng Cloudflare API, vd tạo/xoá bucket)
//
// LƯU Ý QUAN TRỌNG VỀ CORS: bucket R2 phải bật CORS cho phép GET (và PUT nếu
// dùng presigned upload URL ở dưới) từ origin của web app — nếu không, video
// vẫn upload/lưu được nhưng trình duyệt sẽ KHÔNG đọc được pixel (thumbnail,
// AI Pose xử lý frame-by-frame) do canvas bị "tainted" bởi CORS. Cấu hình ở
// Cloudflare Dashboard → R2 → tên bucket → Settings → CORS Policy, ví dụ:
//   [{
//     "AllowedOrigins": ["https://<domain-thật-của-bạn>", "http://localhost:5173"],
//     "AllowedMethods": ["GET", "PUT"],
//     "AllowedHeaders": ["*"]
//   }]
//
// CHỈ DÙNG 1 BỘ CREDENTIAL DUY NHẤT (không áp dụng cơ chế pool/rotation của
// api/_lib/apiKeyPool.js) — khác với API key text (Groq/Gemini) vốn có thể
// dùng key thay thế bất kỳ, 1 bộ credential R2 gắn liền với 1 bucket cụ thể;
// muốn nhiều bucket/tài khoản thì tạo prefix biến môi trường khác (vd
// R2_2_ACCESS_KEY_ID...) và gọi hàm dưới với prefix đó, không phải rotate.

import { AwsClient } from 'aws4fetch'

export class R2StorageError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'R2StorageError'
    this.status = status
  }
}

function readEnv(envSource) {
  const accessKeyId = envSource.R2_ACCESS_KEY_ID
  const secretAccessKey = envSource.R2_SECRET_ACCESS_KEY
  const endpoint = envSource.R2_ENDPOINT
  const bucket = envSource.R2_BUCKET_NAME
  const publicBaseUrl = envSource.R2_ACCESS_URL

  if (!accessKeyId || !secretAccessKey || !endpoint || !bucket) {
    throw new R2StorageError(
      'Thiếu cấu hình R2 (R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_ENDPOINT / R2_BUCKET_NAME) trên server.',
      500,
    )
  }
  return {
    accessKeyId,
    secretAccessKey,
    endpoint: endpoint.replace(/\/+$/, ''),
    bucket,
    publicBaseUrl: (publicBaseUrl || '').replace(/\/+$/, ''),
  }
}

function getClient({ accessKeyId, secretAccessKey }) {
  return new AwsClient({
    accessKeyId,
    secretAccessKey,
    service: 's3',
    region: 'auto',
  })
}

function objectUrl({ endpoint, bucket }, key) {
  return `${endpoint}/${bucket}/${key.replace(/^\/+/, '')}`
}

/** URL public để phát lại/tải file đã upload (dùng lưu trong DB/IndexedDB). */
export function getR2PublicUrl(key, { envSource = process.env } = {}) {
  const cfg = readEnv(envSource)
  if (!cfg.publicBaseUrl) {
    throw new R2StorageError('Thiếu R2_ACCESS_URL (base URL public để đọc lại file) trên server.', 500)
  }
  return `${cfg.publicBaseUrl}/${key.replace(/^\/+/, '')}`
}

/**
 * Upload thẳng 1 buffer lên R2 (dùng khi SERVER đã có sẵn dữ liệu trong tay,
 * vd sau khi tải xong 1 clip YouTube — xem kolYoutubeDownload.js).
 * @param {object} params
 * @param {Buffer|Uint8Array} params.buffer
 * @param {string} params.key - object key, vd 'kol-videos/youtube/2026/08/abc123.mp4'
 * @param {string} [params.contentType]
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ key: string, url: string, size: number }>}
 */
export async function uploadBufferToR2({ buffer, key, contentType, envSource = process.env }) {
  const cfg = readEnv(envSource)
  const client = getClient(cfg)
  const url = objectUrl(cfg, key)

  let res
  try {
    res = await client.fetch(url, {
      method: 'PUT',
      body: buffer,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    })
  } catch (err) {
    console.error('[r2Storage] upload network error:', err?.message || err)
    throw new R2StorageError('Không kết nối được tới R2 để upload file.', 502)
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error('[r2Storage] upload failed:', res.status, text.slice(0, 500))
    throw new R2StorageError(`Upload lên R2 thất bại (HTTP ${res.status}).`, 502)
  }

  return { key, url: getR2PublicUrl(key, { envSource }), size: buffer.length ?? buffer.byteLength ?? 0 }
}

/**
 * Tạo 1 presigned PUT URL để CLIENT (trình duyệt) upload trực tiếp lên R2,
 * không đi qua Vercel Serverless Function (bỏ hẳn giới hạn ~4.5MB
 * request/response và giới hạn thời gian chạy function) — dùng cho video
 * user tự chọn file, hoặc video kết quả AI Pose ghép ra ở client.
 * @param {object} params
 * @param {string} params.key
 * @param {string} [params.contentType]
 * @param {number} [params.expiresInSeconds] - mặc định 10 phút
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ uploadUrl: string, publicUrl: string, key: string }>}
 */
export async function createR2PresignedUploadUrl({ key, contentType, expiresInSeconds = 600, envSource = process.env }) {
  const cfg = readEnv(envSource)
  const client = getClient(cfg)
  const url = new URL(objectUrl(cfg, key))
  if (contentType) url.searchParams.set('Content-Type', contentType)

  let signed
  try {
    signed = await client.sign(url.toString(), {
      method: 'PUT',
      headers: contentType ? { 'Content-Type': contentType } : {},
      aws: { signQuery: true, expiresIn: expiresInSeconds },
    })
  } catch (err) {
    console.error('[r2Storage] presign error:', err?.message || err)
    throw new R2StorageError('Không tạo được URL upload R2.', 500)
  }

  return { uploadUrl: signed.url, publicUrl: getR2PublicUrl(key, { envSource }), key }
}

/** Xoá 1 object khỏi R2 (vd khi user xoá video khỏi thư viện). Best-effort. */
export async function deleteFromR2(key, { envSource = process.env } = {}) {
  const cfg = readEnv(envSource)
  const client = getClient(cfg)
  const url = objectUrl(cfg, key)
  try {
    const res = await client.fetch(url, { method: 'DELETE' })
    if (!res.ok && res.status !== 404) {
      console.error('[r2Storage] delete failed:', res.status)
    }
  } catch (err) {
    console.error('[r2Storage] delete network error:', err?.message || err)
  }
}

/** Sinh 1 object key gọn, có timestamp + id ngẫu nhiên, tránh đụng tên. */
export function genR2Key(prefix, extension) {
  const now = new Date()
  const yyyy = now.getUTCFullYear()
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 10)
  const ext = extension ? `.${extension.replace(/^\./, '')}` : ''
  return `${prefix}/${yyyy}/${mm}/${Date.now()}-${rand}${ext}`
}
