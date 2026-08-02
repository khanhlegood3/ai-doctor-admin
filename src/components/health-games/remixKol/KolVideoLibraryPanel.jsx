// src/components/health-games/remixKol/KolVideoLibraryPanel.jsx
// "Upload Record" — thư viện video KOL của user: dán link YouTube (server
// tải) HOẶC chọn file video từ máy (100% client-side, luôn hoạt động) — ưu
// tiên cái nào xử lý được thì dùng (đúng yêu cầu). Mỗi video (thô hoặc đã
// pose) có 2 nút:
//   • "🕺 Make Pose" — luôn bật, mang video qua màn hình xử lý AI Pose thật
//     (KolPoseMakerPanel).
//   • "🎬 Remix" — chỉ bật khi video (hoặc bản thô của nó) đã có ít nhất 1
//     bản pose; nếu chưa có thì disable kèm chú thích lý do.
import React, { useCallback, useEffect, useState } from 'react'
import { useApp } from '../../../context/AppContext'
import { useAuth } from '../../../context/AuthContext'
import { formatBytes } from '../../../lib/medicalStorage.js'
import {
  listKolVideos,
  saveKolRawVideo,
  deleteKolVideo,
  findLatestPosedFor,
  base64ToVideoDataUrl,
  KOL_VIDEO_KIND,
} from './kolVideoStorage.js'
import { fetchYoutubeClipViaServer } from './kolYoutubeFetchClient.js'

const fmtDate = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

export default function KolVideoLibraryPanel({ onMakePose, onRemix }) {
  const { lang } = useApp()
  const { user } = useAuth()
  const t = (vi, en) => (lang === 'vi' ? vi : en)

  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [fetchingYoutube, setFetchingYoutube] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listKolVideos({ user })
      setVideos(list)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    load()
    const onChanged = () => load()
    window.addEventListener('cdoc_medical_records_changed', onChanged)
    return () => window.removeEventListener('cdoc_medical_records_changed', onChanged)
  }, [load])

  const handleFetchYoutube = useCallback(async () => {
    const url = youtubeUrl.trim()
    if (!url) return
    setUploadError('')
    setFetchingYoutube(true)
    try {
      const { base64, mimeType, title, durationSeconds } = await fetchYoutubeClipViaServer(url)
      await saveKolRawVideo({
        dataUrl: base64ToVideoDataUrl(base64, mimeType),
        mimeType,
        title,
        sourceType: 'youtube',
        youtubeUrl: url,
        durationSeconds,
      }, { user })
      setYoutubeUrl('')
      await load()
    } catch (err) {
      setUploadError(
        `${err?.message || String(err)}\n\n` +
        t(
          '→ Bạn vẫn có thể tải video này về máy rồi dùng ô "Chọn file để tải lên" bên dưới.',
          '→ You can still download this video to your device and use "Choose file to upload" below.'
        )
      )
    } finally {
      setFetchingYoutube(false)
    }
  }, [youtubeUrl, user, load, lang])

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // cho phép chọn lại cùng 1 file lần sau
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setUploadError(t('File chọn không phải video.', 'Selected file is not a video.'))
      return
    }
    setUploadError('')
    setUploadingFile(true)
    try {
      await saveKolRawVideo({ file, title: file.name.replace(/\.[^.]+$/, ''), sourceType: 'upload' }, { user })
      await load()
    } catch (err) {
      setUploadError(err?.message || String(err))
    } finally {
      setUploadingFile(false)
    }
  }, [user, load, lang])

  const handleDelete = useCallback(async (e, id) => {
    e.stopPropagation()
    if (!window.confirm(t('Xoá video này khỏi thư viện? Hành động không thể hoàn tác.', 'Delete this video from the library? This cannot be undone.'))) return
    setDeletingId(id)
    try {
      await deleteKolVideo(id, { user })
      await load()
    } finally {
      setDeletingId(null)
    }
  }, [user, load, lang])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 0' }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
          📼 {t('Video KOL của tôi', 'My KOL Videos')}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)' }}>
          {t(
            'Dán link YouTube (server tải) hoặc chọn file video từ máy — sau đó bấm "Make Pose" để AI ghép khung xương thật, hoặc "Remix" để tập cùng video đã có pose.',
            'Paste a YouTube link (server download) or choose a video file — then tap "Make Pose" for real AI skeleton overlay, or "Remix" to train alongside an already-posed video.'
          )}
        </p>
      </div>

      {/* ── Khu vực upload ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 10, padding: 14,
        border: '1.5px dashed var(--border, rgba(255,255,255,0.15))', borderRadius: 14,
        background: 'var(--surface, rgba(255,255,255,0.03))',
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder={t('Dán link YouTube (video ngắn, dưới ~90 giây)…', 'Paste a YouTube link (short video, under ~90s)…')}
            style={{
              flex: '1 1 260px', padding: '10px 12px', borderRadius: 8, fontSize: 13,
              background: 'var(--surface2, rgba(255,255,255,0.05))', border: '1px solid var(--border, rgba(255,255,255,0.15))', color: 'var(--text)',
            }}
          />
          <button
            type="button"
            onClick={handleFetchYoutube}
            disabled={fetchingYoutube || !youtubeUrl.trim()}
            style={{
              padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: fetchingYoutube ? 'default' : 'pointer',
              background: 'var(--cyan)', color: '#00151a', border: 'none', opacity: fetchingYoutube || !youtubeUrl.trim() ? 0.6 : 1,
            }}
          >
            {fetchingYoutube ? t('Đang tải…', 'Downloading…') : t('⬇ Tải qua server', '⬇ Fetch via server')}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{t('hoặc', 'or')}</span>
          <label style={{
            padding: '9px 14px', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            background: 'transparent', border: '1.5px solid var(--cyan)', color: 'var(--cyan)',
          }}>
            {uploadingFile ? t('Đang lưu…', 'Saving…') : t('📁 Chọn file để tải lên', '📁 Choose file to upload')}
            <input type="file" accept="video/*" onChange={handleFileChange} disabled={uploadingFile} style={{ display: 'none' }} />
          </label>
        </div>

        {uploadError && (
          <div style={{ fontSize: 12, color: 'var(--red)', background: 'rgba(255,82,82,0.08)', border: '1px solid rgba(255,82,82,0.3)', borderRadius: 8, padding: 10, whiteSpace: 'pre-line' }}>
            {uploadError}
          </div>
        )}
      </div>

      {/* ── Danh sách video ─────────────────────────────────────────────── */}
      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          {t('Đang tải thư viện…', 'Loading library…')}
        </div>
      )}

      {!loading && videos.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text3)', border: '1.5px dashed var(--border, rgba(255,255,255,0.12))',
          borderRadius: 14, fontSize: 13,
        }}>
          {t('Chưa có video nào. Dán link YouTube hoặc chọn file ở trên để bắt đầu.', 'No videos yet. Paste a YouTube link or choose a file above to get started.')}
        </div>
      )}

      {!loading && videos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {videos.map((v) => {
            const isPosed = v.kind === KOL_VIDEO_KIND.POSED
            // Với video "raw": Remix bật khi đã có bản pose liên kết.
            // Với video "posed" chính nó: Remix luôn bật (nó CHÍNH LÀ bản đã pose).
            const linkedPosed = isPosed ? v : findLatestPosedFor(v.id, videos)
            const canRemix = isPosed || Boolean(linkedPosed)

            return (
              <div key={v.id} style={{
                display: 'flex', flexDirection: 'column', borderRadius: 12, overflow: 'hidden',
                border: `1.5px solid ${isPosed ? 'rgba(217,70,239,0.35)' : 'var(--border, rgba(255,255,255,0.1))'}`,
                background: 'var(--surface, rgba(255,255,255,0.03))',
              }}>
                <div style={{ position: 'relative', width: '100%', paddingTop: '56%', background: '#0a0a0a' }}>
                  {v.thumbnail ? (
                    <img src={v.thumbnail} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>🎥</div>
                  )}
                  <span style={{
                    position: 'absolute', top: 6, left: 6, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6,
                    background: isPosed ? 'rgba(217,70,239,0.85)' : 'rgba(0,0,0,0.6)', color: '#fff',
                  }}>
                    {isPosed ? t('✨ ĐÃ POSE', '✨ POSED') : t('🎞 THÔ', '🎞 RAW')}
                  </span>
                  {v.sourceType === 'youtube' && (
                    <span style={{ position: 'absolute', top: 6, right: 6, fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,0,0,0.85)', color: '#fff' }}>
                      YouTube
                    </span>
                  )}
                </div>

                <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: 'var(--text)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {v.title || v.filename}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>
                    {fmtDate(v.uploadedAt)} · {formatBytes(v.size || 0)}
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isPosed) { onMakePose?.(v); return }
                        // Video này CHÍNH LÀ bản đã pose — muốn "Make Pose" lại thì
                        // cần xử lý lại từ bản THÔ gốc (linkedRawId), không phải xử
                        // lý chồng pose lên chính video đã có khung xương.
                        const rawSource = videos.find((x) => x.id === v.linkedRawId)
                        if (rawSource) onMakePose?.(rawSource)
                        else window.alert(t('Không tìm thấy video thô gốc (có thể đã bị xoá).', 'Original raw video not found (it may have been deleted).'))
                      }}
                      title={isPosed ? t('Ghép pose lại từ video thô gốc (tạo bản mới)', 'Re-run pose from the original raw video (new version)') : t('Ghép khung xương AI thật cho video này', 'Apply real AI skeleton to this video')}
                      style={{
                        flex: '1 1 auto', padding: '7px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                        background: 'var(--cyan)', color: '#00151a', border: 'none',
                      }}
                    >
                      🕺 {t('Make Pose', 'Make Pose')}
                    </button>
                    <button
                      type="button"
                      onClick={() => canRemix && onRemix?.(linkedPosed)}
                      disabled={!canRemix}
                      title={canRemix ? t('Mở màn hình Remix', 'Open Remix screen') : t('Cần ghép Pose trước khi Remix', 'Needs Pose applied before Remix')}
                      style={{
                        flex: '1 1 auto', padding: '7px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700,
                        cursor: canRemix ? 'pointer' : 'not-allowed',
                        background: canRemix ? '#d946ef' : 'rgba(255,255,255,0.06)',
                        color: canRemix ? '#fff' : 'var(--text3)',
                        border: canRemix ? 'none' : '1px solid var(--border, rgba(255,255,255,0.1))',
                      }}
                    >
                      🎬 {t('Remix', 'Remix')}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, v.id)}
                    disabled={deletingId === v.id}
                    style={{
                      alignSelf: 'flex-start', marginTop: 2, fontSize: 10.5,
                      color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                      opacity: deletingId === v.id ? 0.5 : 1,
                    }}
                  >
                    {deletingId === v.id ? t('Đang xoá…', 'Deleting…') : t('Xoá', 'Delete')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
