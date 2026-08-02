// src/components/health-games/remixKol/kolVideoStorage.js
// Lưu video KOL (bản THÔ do user dán link YouTube hoặc upload file, và bản
// ĐÃ GHÉP POSE do AI xử lý thật bằng MediaPipe) vào IndexedDB — dùng CHUNG
// kho lưu trữ với trang Record/Upload (src/lib/medicalStorage.js), đúng
// pattern đã có ở comicIssueStorage.js: mở lại/Make Pose/Remix bất cứ lúc
// nào qua 1 "thư viện" (xem KolVideoLibraryPanel.jsx).
//
// CẬP NHẬT (chuyển sang R2): bản thân file video KHÔNG còn lưu base64 trong
// IndexedDB nữa (dễ vỡ quota trình duyệt với video dài) — chỉ lưu lại 1 URL
// R2 (`r2Url`) trỏ tới file thật, IndexedDB giờ chỉ giữ metadata + thumbnail
// nhỏ. Record cũ (nếu còn trong IndexedDB từ trước khi refactor) vẫn có
// field `dataUrl`/`base64Data` — các hàm dưới đây ưu tiên `r2Url`, fallback
// về `dataUrl` để không phá vỡ dữ liệu cũ của user.
//
// 1 video "thô" có thể có NHIỀU video "đã pose" liên kết tới nó (mỗi lần
// bấm "Make Pose" tạo 1 bản ghép mới) — liên kết qua field `linkedRawId`.
import { saveRecord, getAllRecords, getRecord, deleteRecord } from '../../../lib/medicalStorage.js'
import { notifyUpload } from '../../../hooks/useMedicalData.js'
import { uploadKolFileToR2 } from './kolYoutubeFetchClient.js'

export const KOL_VIDEO_SOURCE_MODULE = 'remix-suc-khoe-kol'

// kind: 'raw' (video gốc chưa xử lý) | 'posed' (đã chạy AI Pose thật, có khung xương ghép sẵn)
export const KOL_VIDEO_KIND = { RAW: 'raw', POSED: 'posed' }

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Tạo ảnh thumbnail (JPEG dataURL) từ giây đầu của 1 video, dùng cho danh
 * sách thư viện. Trả về '' nếu trình duyệt không tạo được (không chặn luồng
 * lưu video chính vì lỗi thumbnail).
 */
export function captureVideoThumbnail(videoUrl) {
  return new Promise((resolvePromise) => {
    try {
      const video = document.createElement('video')
      video.muted = true
      video.playsInline = true
      video.preload = 'metadata'
      // URL R2 là cross-origin (khác domain web app) — PHẢI có crossOrigin +
      // bucket bật CORS cho phép GET (xem hướng dẫn ở đầu r2Storage.js),
      // nếu không canvas.toDataURL() bên dưới sẽ ném SecurityError (tainted
      // canvas) và promise sẽ resolve('') qua nhánh onError/catch.
      if (/^https?:\/\//i.test(videoUrl)) video.crossOrigin = 'anonymous'
      video.src = videoUrl

      const cleanup = () => {
        video.src = ''
        video.load()
      }

      const onError = () => { cleanup(); resolvePromise('') }
      video.addEventListener('error', onError, { once: true })

      video.addEventListener('loadeddata', () => {
        try {
          // Nhảy tới 0.3s thay vì frame đầu tiên — nhiều video có 1-2 frame
          // đen/mờ lúc mở đầu, 0.3s cho ảnh đại diện đẹp hơn.
          video.currentTime = Math.min(0.3, (video.duration || 1) / 2)
        } catch {
          resolvePromise('')
          cleanup()
        }
      }, { once: true })

      video.addEventListener('seeked', () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth || 320
          canvas.height = video.videoHeight || 240
          const ctx = canvas.getContext('2d')
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          resolvePromise(canvas.toDataURL('image/jpeg', 0.75))
        } catch {
          resolvePromise('')
        } finally {
          cleanup()
        }
      }, { once: true })
    } catch {
      resolvePromise('')
    }
  })
}

/** Chuyển 1 base64 (không kèm prefix data:) thành dataURL video hoàn chỉnh. */
export function base64ToVideoDataUrl(base64, mimeType = 'video/mp4') {
  return `data:${mimeType};base64,${base64}`
}

/**
 * Chuyển dataURL (base64) thành Blob URL để phát video mượt hơn — dataURL
 * dài vài MB gán thẳng vào <video src> vẫn chạy được ở hầu hết trình duyệt,
 * nhưng Blob URL nhẹ hơn cho DOM/React. Nhớ gọi URL.revokeObjectURL() khi
 * unmount component dùng URL này.
 */
export async function dataUrlToObjectUrl(dataUrl) {
  const res = await fetch(dataUrl)
  const blob = await res.blob()
  return URL.createObjectURL(blob)
}

/**
 * URL để PHÁT video của 1 record — ưu tiên `r2Url` (record mới), fallback
 * `dataUrl` (record cũ còn sót lại từ trước khi refactor sang R2).
 */
export function resolveKolVideoUrl(record) {
  return record?.r2Url || record?.dataUrl || ''
}

/**
 * Lưu 1 video KOL "thô" (chưa xử lý pose) vào thư viện.
 * @param {object} params
 * @param {File} [params.file] - nếu user chọn file trực tiếp; sẽ được upload
 *   THẲNG lên R2 từ trình duyệt (presigned URL), không đi qua base64/IndexedDB
 * @param {string} [params.r2Url] - nếu video đã có sẵn URL R2 (nhánh YouTube,
 *   server đã tải + upload hộ — xem kolYoutubeFetchClient.js)
 * @param {string} [params.mimeType]
 * @param {string} [params.title]
 * @param {'upload'|'youtube'} params.sourceType
 * @param {string} [params.youtubeUrl]
 * @param {number} [params.durationSeconds]
 * @param {number} [params.size]
 * @param {object} ctx - { user }
 */
export async function saveKolRawVideo(params, ctx = {}) {
  const { file, mimeType, title, sourceType, youtubeUrl, durationSeconds } = params
  const { user } = ctx

  let r2Url = params.r2Url || ''
  let size = params.size || 0

  if (!r2Url && file) {
    const uploaded = await uploadKolFileToR2(file, 'raw')
    r2Url = uploaded.url
    size = uploaded.size
  }
  if (!r2Url) throw new Error('Thiếu dữ liệu video để lưu.')

  const thumbnail = await captureVideoThumbnail(r2Url)

  const record = {
    id: genId('kol_raw'),
    filename: file?.name || `${title || 'kol-video'}.mp4`,
    name: file?.name || `${title || 'kol-video'}.mp4`,
    fileType: 'video',
    type: 'video',
    mimeType: mimeType || file?.type || 'video/mp4',
    size,
    r2Url,
    thumbnail,
    title: title || file?.name || 'Video KOL',
    kind: KOL_VIDEO_KIND.RAW,
    sourceType: sourceType || 'upload',
    youtubeUrl: youtubeUrl || '',
    durationSeconds: durationSeconds || 0,
    linkedRawId: null,
    sourceModule: KOL_VIDEO_SOURCE_MODULE,
    ownerUuid: user?.uuid || null,
    ownerEmail: user?.email || '',
    ownerName: user?.name || '',
    ownerAvatar: user?.avatar || '',
    ownerProvider: user?.provider || '',
  }

  await saveRecord(record, { ownerUuid: user?.uuid })
  notifyUpload()
  return record
}

/**
 * Lưu 1 video KOL "đã ghép pose" (kết quả xử lý AI thật ở KolPoseMakerPanel)
 * vào thư viện, liên kết tới video thô gốc.
 * @param {object} params
 * @param {Blob} params.blob - video output từ MediaRecorder
 * @param {string} params.mimeType
 * @param {string} params.title
 * @param {string} params.linkedRawId - id của record 'raw' đã dùng để tạo bản này
 * @param {number} [params.durationSeconds]
 * @param {object} ctx - { user }
 */
export async function saveKolPosedVideo(params, ctx = {}) {
  const { blob, mimeType, title, linkedRawId, durationSeconds } = params
  const { user } = ctx
  if (!blob) throw new Error('Thiếu dữ liệu video pose để lưu.')

  const uploaded = await uploadKolFileToR2(blob, 'posed')
  const r2Url = uploaded.url
  const size = uploaded.size
  const thumbnail = await captureVideoThumbnail(r2Url)

  const record = {
    id: genId('kol_posed'),
    filename: `${title || 'kol-video-pose'}.webm`,
    name: `${title || 'kol-video-pose'}.webm`,
    fileType: 'video',
    type: 'video',
    mimeType: mimeType || blob.type || 'video/webm',
    size,
    r2Url,
    thumbnail,
    title: title || 'Video KOL (đã ghép Pose AI)',
    kind: KOL_VIDEO_KIND.POSED,
    sourceType: 'pose-maker',
    youtubeUrl: '',
    durationSeconds: durationSeconds || 0,
    linkedRawId: linkedRawId || null,
    sourceModule: KOL_VIDEO_SOURCE_MODULE,
    ownerUuid: user?.uuid || null,
    ownerEmail: user?.email || '',
    ownerName: user?.name || '',
    ownerAvatar: user?.avatar || '',
    ownerProvider: user?.provider || '',
  }

  await saveRecord(record, { ownerUuid: user?.uuid })
  notifyUpload()
  return record
}

/** Lấy toàn bộ video KOL (thô + đã pose) của user hiện tại, mới nhất trước. */
export async function listKolVideos({ user, includeAll = false } = {}) {
  const all = await getAllRecords({ ownerUuid: user?.uuid || null, includeUnowned: !user?.uuid, includeAll })
  return all
    .filter((r) => r.sourceModule === KOL_VIDEO_SOURCE_MODULE)
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')))
}

export async function getKolVideo(id, { user } = {}) {
  return getRecord(id, { ownerUuid: user?.uuid || null, includeUnowned: !user?.uuid })
}

/** Video "raw" này đã có ít nhất 1 bản pose chưa? Trả về bản pose mới nhất (hoặc null). */
export function findLatestPosedFor(rawId, allVideos) {
  const posed = allVideos.filter((v) => v.kind === KOL_VIDEO_KIND.POSED && v.linkedRawId === rawId)
  if (!posed.length) return null
  return posed.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')))[0]
}

export async function deleteKolVideo(id, { user } = {}) {
  await deleteRecord(id, { ownerUuid: user?.uuid || null })
  notifyUpload()
}
