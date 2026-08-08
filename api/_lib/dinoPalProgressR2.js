// api/_lib/dinoPalProgressR2.js
// Sao lưu/khôi phục tiến trình nuôi Dino Pal (màu sắc, level/XP, giai đoạn
// lớn lên, tiền, đồ đã mua...) lên Cloudflare R2 — dùng SONG SONG với
// IndexedDB cục bộ (xem src/dino-pal-khanh/src/lib/dinoSharedProgress.ts):
//   - IndexedDB: đọc lại NGAY LẬP TỨC, không cần mạng, và là nguồn đồng bộ
//     realtime với Dino Jump (cùng origin, xem file trên).
//   - R2: bản sao lưu bền, không mất khi user xoá site data/IndexedDB.
//
// Tính năng này KHÔNG có đăng nhập, nên scope theo 1 deviceId ẩn danh do
// client sinh (localStorage, xem dinoProgressR2Client.ts) — cùng mô hình với
// bring-any-idea-to-life (scope theo id do client sinh, không theo
// ownerUuid).
//
// Object layout trong bucket (dùng chung bucket R2 hiện có, xem r2Storage.js):
//   dino-pal/progress/<deviceId>.json - { ...progress, deviceId, savedAt }

import { uploadBufferToR2, getR2PublicUrl } from './r2Storage.js'

export class DinoPalProgressR2Error extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'DinoPalProgressR2Error'
    this.status = status
  }
}

function keyFor(deviceId) {
  return `dino-pal/progress/${deviceId}.json`
}

/**
 * @param {object} params
 * @param {string} params.deviceId
 * @param {object} params.progress - snapshot tiến trình (xem DinoSharedProgress ở client)
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ url: string }>}
 */
export async function saveDinoPalProgressToR2({ deviceId, progress, envSource = process.env }) {
  if (!deviceId) throw new DinoPalProgressR2Error('Thiếu deviceId.', 400)
  if (!progress || typeof progress !== 'object') throw new DinoPalProgressR2Error('Thiếu progress.', 400)

  const record = { ...progress, deviceId, savedAt: new Date().toISOString() }
  const buffer = Buffer.from(JSON.stringify(record), 'utf-8')
  const key = keyFor(deviceId)
  await uploadBufferToR2({ buffer, key, contentType: 'application/json', envSource })

  return { url: getR2PublicUrl(key, { envSource }) }
}

/**
 * @param {object} params
 * @param {string} params.deviceId
 * @param {Record<string,string>} [params.envSource]
 * @returns {Promise<{ progress: object|null }>}
 */
export async function loadDinoPalProgressFromR2({ deviceId, envSource = process.env }) {
  if (!deviceId) throw new DinoPalProgressR2Error('Thiếu deviceId.', 400)

  const key = keyFor(deviceId)
  const url = getR2PublicUrl(key, { envSource })

  let res
  try {
    res = await fetch(url)
  } catch (err) {
    console.error('[dinoPalProgressR2] load network error:', err?.message || err)
    throw new DinoPalProgressR2Error('Không kết nối được tới R2 để đọc tiến trình.', 502)
  }

  if (res.status === 404) return { progress: null }
  if (!res.ok) {
    console.error('[dinoPalProgressR2] load failed:', res.status)
    throw new DinoPalProgressR2Error(`R2 trả lỗi khi đọc tiến trình (HTTP ${res.status}).`, 502)
  }

  try {
    const progress = await res.json()
    return { progress }
  } catch (err) {
    console.error('[dinoPalProgressR2] parse error:', err?.message || err)
    throw new DinoPalProgressR2Error('Dữ liệu tiến trình trên R2 không hợp lệ.', 502)
  }
}
