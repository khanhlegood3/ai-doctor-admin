// src/components/comicHero/comicIssueStorage.js
// Lưu "Issue" truyện tranh (PDF ghép từ các trang comicFaces) vào IndexedDB
// dùng CHUNG kho lưu trữ với trang Record/Upload (src/lib/medicalStorage.js),
// thay vì tải file .pdf xuống máy người dùng. Nhờ vậy:
//   1. Truyện được liệt kê lại ở đây thành 1 "thư viện" kiểu playlist
//      YouTube / trang RSS (xem ComicIssueLibraryPanel.jsx) để đọc lại sau.
//   2. File .pdf này cũng tự động xuất hiện ở trang "Record" (Hồ sơ), mục
//      Labs/Documents — vì useMedicalData.js coi mọi record fileType 'pdf'
//      là 1 tài liệu của bệnh nhân (xem recordsToPatient()).
import { saveRecord, getAllRecords, deleteRecord } from '../../lib/medicalStorage.js'
import { notifyUpload } from '../../hooks/useMedicalData.js'

export const COMIC_ISSUE_SOURCE_MODULE = 'comic-hero-game'

function safeSegment(value) {
  return (value || 'guest')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'guest'
}

function nextIssueFilename(user) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `Infinite-Heroes-Issue_${stamp}.pdf`
}

/**
 * Lưu 1 issue truyện tranh (PDF datauri) vào kho lưu trữ chung.
 * @param {string} pdfDataUrl - kết quả doc.output('datauristring') từ jsPDF
 * @param {object} meta - { title, coverImage (dataURL trang bìa), pageCount, genre, language }
 * @param {object} ctx - { user, lang }
 */
export async function saveComicIssue(pdfDataUrl, meta = {}, ctx = {}) {
  const { user, lang = 'vi' } = ctx
  const uploadFolder = `upload/${safeSegment(user?.email || user?.name || 'guest')}/comic-hero-game`
  const filename = meta.title
    ? `${meta.title.replace(/[^a-zA-Z0-9\u00C0-\u1EF9 _-]+/g, '').trim().slice(0, 60) || 'Issue'}.pdf`
    : nextIssueFilename(user)
  const uploadPath = `${uploadFolder}/${filename}`
  const base64Data = String(pdfDataUrl || '').split(',')[1] || ''
  // Ước lượng dung lượng từ chuỗi base64 (3 bytes / 4 ký tự base64).
  const size = Math.round((base64Data.length * 3) / 4)

  const record = {
    id: `comic_issue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    filename,
    name: filename,
    fileType: 'pdf',
    type: 'pdf',
    mimeType: 'application/pdf',
    size,
    uploadedAt: new Date().toISOString(),
    dataUrl: pdfDataUrl,
    base64Data,
    coverImage: meta.coverImage || '',
    title: meta.title || (lang === 'vi' ? 'Truyện Siêu Anh Hùng' : 'Hero Comic Issue'),
    pageCount: meta.pageCount || 0,
    genre: meta.genre || '',
    language: meta.language || '',
    notes: lang === 'vi' ? `Truyện tranh tự tạo · lưu tại ${uploadPath}` : `Self-generated comic · saved at ${uploadPath}`,
    ownerUuid: user?.uuid || null,
    ownerEmail: user?.email || '',
    ownerName: user?.name || '',
    ownerAvatar: user?.avatar || '',
    ownerProvider: user?.provider || '',
    sourceModule: COMIC_ISSUE_SOURCE_MODULE,
    uploadFolder,
    uploadPath,
  }

  await saveRecord(record, {
    ownerUuid: user?.uuid,
    ownerEmail: user?.email,
    ownerName: user?.name,
    ownerAvatar: user?.avatar,
    ownerProvider: user?.provider,
  })
  notifyUpload()
  return record
}

/** Lấy danh sách các issue truyện tranh đã lưu (mới nhất trước), cho user hiện tại. */
export async function listComicIssues({ user, includeAll = false } = {}) {
  const all = await getAllRecords({ ownerUuid: user?.uuid || null, includeUnowned: !user?.uuid, includeAll })
  return all
    .filter((r) => r.sourceModule === COMIC_ISSUE_SOURCE_MODULE)
    .sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')))
}

/** Xoá 1 issue khỏi thư viện. */
export async function deleteComicIssue(id, { user } = {}) {
  await deleteRecord(id, { ownerUuid: user?.uuid || null })
  notifyUpload()
}
