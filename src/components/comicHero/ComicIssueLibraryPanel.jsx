// src/components/comicHero/ComicIssueLibraryPanel.jsx
// "Thư viện truyện của tôi" — thay vì tải file .pdf về máy, mỗi issue truyện
// tranh được lưu vào IndexedDB (xem comicIssueStorage.js) và liệt kê lại ở
// đây thành 1 danh sách kiểu playlist YouTube / trang RSS: cột trái là danh
// sách các số truyện đã lưu (thumbnail + tiêu đề + ngày + số trang), cột
// phải là khung đọc lại truyện đã chọn.
import React, { useEffect, useState, useCallback } from 'react'
import { useAuth } from '../../context/AuthContext'
import { listComicIssues, deleteComicIssue } from './comicIssueStorage'
import { formatBytes } from '../../lib/medicalStorage.js'

const fmtDate = (iso) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }
  catch { return iso }
}

export default function ComicIssueLibraryPanel({ onCreateNew }) {
  const { user } = useAuth()
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listComicIssues({ user })
      setIssues(list)
      setSelectedId((prev) => (prev && list.some((i) => i.id === prev)) ? prev : (list[0]?.id || null))
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

  const selected = issues.find((i) => i.id === selectedId) || null

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Xoá truyện này khỏi thư viện? Hành động không thể hoàn tác.')) return
    setDeletingId(id)
    try {
      await deleteComicIssue(id, { user })
      await load()
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>📚 Thư viện truyện của tôi</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
            Các issue đã lưu (không tải về máy) — đọc lại bất cứ lúc nào. File cũng xuất hiện trong trang Record.
          </p>
        </div>
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="comic-btn"
            style={{
              background: 'var(--cyan)', color: '#00151a', border: 'none', borderRadius: 10,
              padding: '10px 18px', fontWeight: 800, fontSize: 13, cursor: 'pointer',
              fontFamily: 'var(--font-mono)', letterSpacing: '.03em',
            }}
          >
            + Tạo truyện mới
          </button>
        )}
      </div>

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
          Đang tải thư viện…
        </div>
      )}

      {!loading && issues.length === 0 && (
        <div style={{
          padding: 40, textAlign: 'center', color: 'var(--text3)', border: '1.5px dashed var(--border, rgba(255,255,255,0.12))',
          borderRadius: 14, fontFamily: 'var(--font-mono)', fontSize: 13,
        }}>
          Chưa có truyện nào được lưu. Tạo 1 issue mới rồi bấm "SAVE TO LIBRARY" ở trang cuối cuốn truyện để lưu vào đây.
        </div>
      )}

      {!loading && issues.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 16, alignItems: 'start' }}>
          {/* Danh sách kiểu playlist YouTube / RSS */}
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 8,
              maxHeight: '78vh', overflowY: 'auto', paddingRight: 4,
            }}
          >
            {issues.map((issue) => {
              const isActive = issue.id === selectedId
              return (
                <div
                  key={issue.id}
                  onClick={() => setSelectedId(issue.id)}
                  style={{
                    display: 'flex', gap: 10, padding: 8, borderRadius: 12, cursor: 'pointer',
                    background: isActive ? 'rgba(0,229,255,0.10)' : 'var(--surface, rgba(255,255,255,0.03))',
                    border: `1.5px solid ${isActive ? 'var(--cyan)' : 'transparent'}`,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <div style={{
                    width: 84, height: 118, flexShrink: 0, borderRadius: 8, overflow: 'hidden',
                    background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {issue.coverImage
                      ? <img src={issue.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontSize: 24 }}>📖</span>}
                  </div>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 700, color: 'var(--text)',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}>
                      {issue.title || issue.filename}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {fmtDate(issue.uploadedAt)}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {issue.pageCount ? `${issue.pageCount} trang · ` : ''}{formatBytes(issue.size || 0)}
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, issue.id)}
                      disabled={deletingId === issue.id}
                      style={{
                        alignSelf: 'flex-start', marginTop: 2, fontSize: 10.5, fontFamily: 'var(--font-mono)',
                        color: 'var(--red)', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0,
                        opacity: deletingId === issue.id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === issue.id ? 'Đang xoá…' : 'Xoá'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Khung đọc lại truyện đã chọn */}
          <div style={{
            border: '1.5px solid var(--border, rgba(255,255,255,0.12))', borderRadius: 14, overflow: 'hidden',
            minHeight: 420, display: 'flex', flexDirection: 'column', background: 'var(--surface, rgba(255,255,255,0.03))',
          }}>
            {selected ? (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 16px',
                  borderBottom: '1px solid var(--border, rgba(255,255,255,0.1))', flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{selected.title || selected.filename}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {selected.genre ? `${selected.genre} · ` : ''}{fmtDate(selected.uploadedAt)}
                    </div>
                  </div>
                  <span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>
                    📖 Đọc trực tiếp — đã lưu sẵn, không cần tải lại
                  </span>
                </div>
                <iframe
                  title={selected.title || selected.filename}
                  src={selected.dataUrl}
                  style={{ flex: 1, minHeight: 640, border: 'none', background: '#0a0a0a' }}
                />
              </>
            ) : (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Chọn 1 truyện để đọc lại.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
