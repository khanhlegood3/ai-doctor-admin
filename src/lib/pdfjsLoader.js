// Trước đây: 4 file (inbodyImageConvert.js, FullDocumentSummarizationPanel.jsx,
// MedicalUploader.jsx, DocumentOCRPanel.jsx) mỗi file tự `import()` pdf.js
// TRỰC TIẾP từ cdnjs.cloudflare.com — 8 lần gọi mạng ngoài rải rác, không
// cache dùng chung, không fallback nếu cdnjs chậm/chặn từ mạng Việt Nam.
//
// pdfjs-dist đã có sẵn trong package.json (cùng version 4.4.168 với CDN cũ),
// nên dùng thẳng từ node_modules — Vite sẽ tự bundle cả worker (`?url`) vào
// output, không cần CDN, không cần script copy riêng như model MediaPipe.
import * as pdfjsLib from 'pdfjs-dist/build/pdf.min.mjs'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

let configured = false

/** Lazy-load + cấu hình pdf.js một lần duy nhất (dùng chung, không phụ thuộc CDN). */
export async function loadPdfJs() {
  if (!configured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    configured = true
  }
  return pdfjsLib
}
