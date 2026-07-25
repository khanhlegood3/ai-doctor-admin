import React, { useRef } from 'react';

// ============================================================================
// PdfPreviewModal — modal xem trước & tải PDF dùng CHUNG cho toàn dự án.
//
// Được convert từ `src/components/Hero3DMap/pdf_preview.ts` (Web Component
// viết bằng Lit) sang React thuần (JSX) để khớp với ngôn ngữ/kiến trúc chung
// đang chạy trong dự án (mọi panel khác đều là .jsx). Component gốc chỉ phục
// vụ riêng cho "Body Pixel" (Hero3DMapPanel); bản này được tổng quát hoá để
// bất kỳ panel nào cũng có thể tái sử dụng cho nhu cầu "xem trước rồi tải
// PDF" của mình, không chỉ giới hạn ở dữ liệu triệu chứng cơ thể.
//
// Cách dùng:
//   <PdfPreviewModal
//     title="Symptom Summary"
//     subtitle="Body area examined: Head · Generated for informational use only."
//     lists={[
//       { heading: 'Selected sections', items: ['Nose', 'Jaw & Chin'] },
//       { heading: 'Responses', items: ['Pain type: Sharp', 'Duration: A few days'] },
//     ]}
//     table={{
//       heading: 'Possible specialists (ranked)',
//       headers: ['#', 'Specialist', 'Confidence'],
//       rows: [['1', 'Orthopedist', '50%'], ['2', 'General practitioner', '25%']],
//     }}
//     disclaimer="DISCLAIMER: ..."
//     filename="SymptomSummary.pdf"
//     downloadLabel="Download PDF"
//     closeLabel="Cancel"
//     onClose={() => setShowPreview(false)}
//   />
// ============================================================================

export default function PdfPreviewModal({
  title = '',
  subtitle = '',
  lists = [],
  table = null,
  disclaimer = '',
  filename = 'Document.pdf',
  downloadLabel = 'Download PDF',
  closeLabel = 'Close',
  onClose,
}) {
  const printRef = useRef(null);

  const handleDownload = () => {
    const source = printRef.current;
    if (!source) return;

    // QUAN TRỌNG: không chụp trực tiếp `source` vì nó đang nằm bên trong
    // overlay `position: fixed`. html2canvas có giới hạn đã biết khi chụp
    // phần tử `fixed`/lồng trong stacking context phức tạp — nó thường chụp
    // sai tỉ lệ rồi phóng lại, khiến chữ bị "loãng"/nhạt màu. Giải pháp: clone
    // nội dung ra một container ẩn, nằm NGOÀI luồng fixed, có nền trắng
    // tường minh, rồi mới chạy html2pdf trên bản clone đó.
    const clone = source.cloneNode(true);
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.top = '0';
    wrapper.style.left = '-99999px';
    wrapper.style.width = `${source.offsetWidth || 800}px`;
    wrapper.style.background = '#ffffff';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const cleanup = () => {
      if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
    };

    // @vite-ignore — tải động, chỉ dùng khi người dùng thực sự bấm nút.
    import('html2pdf.js')
      .then((html2pdf) =>
        html2pdf
          .default()
          .set({
            html2canvas: { backgroundColor: '#ffffff', scale: 2, useCORS: true },
            jsPDF: { unit: 'pt', format: 'a4' },
          })
          .from(clone)
          .save(filename)
      )
      .then(cleanup)
      .catch((err) => {
        cleanup();
        // eslint-disable-next-line no-console
        console.error('PdfPreviewModal: failed to generate PDF', err);
      });
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div ref={printRef} style={styles.printContent}>
          {title ? <h1 style={styles.h1}>{title}</h1> : null}
          {subtitle ? <p style={styles.subtitle}>{subtitle}</p> : null}

          {lists.map((list, i) => (
            <div key={i}>
              {list.heading ? <h3 style={styles.h3}>{list.heading}</h3> : null}
              <ul style={styles.ul}>
                {list.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}

          {table ? (
            <>
              {table.heading ? <h3 style={styles.h3}>{table.heading}</h3> : null}
              <table style={styles.table}>
                <thead>
                  <tr>
                    {table.headers.map((h, i) => (
                      <th key={i} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={styles.td}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {disclaimer ? <p style={styles.disclaimer}>{disclaimer}</p> : null}
        </div>

        <div style={styles.actions}>
          <button type="button" style={styles.btnPrimary} onClick={handleDownload}>
            {downloadLabel}
          </button>
          <button type="button" style={styles.btnSecondary} onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    padding: 20,
    borderRadius: 8,
    maxWidth: '80%',
    maxHeight: '80%',
    overflowY: 'auto',
    color: '#333',
  },
  printContent: {
    padding: 20,
    fontFamily: 'sans-serif',
    background: '#ffffff',
    color: '#222222',
  },
  h1: { margin: '0 0 8px', color: '#111111' },
  h3: { margin: '18px 0 8px', color: '#111111' },
  subtitle: { margin: 0, color: '#333333' },
  ul: { paddingLeft: 20, margin: 0, color: '#222222' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { border: '1px solid #ccc', padding: 8, textAlign: 'left', color: '#111111' },
  td: { border: '1px solid #ccc', padding: 8, textAlign: 'left', color: '#222222' },
  disclaimer: {
    fontSize: 12,
    marginTop: 20,
    color: '#666',
    border: '1px solid #ccc',
    padding: 10,
  },
  actions: { marginTop: 20, display: 'flex', gap: 10 },
  btnPrimary: {
    border: 0,
    borderRadius: 6,
    background: '#c85d3a',
    color: '#fff',
    padding: '10px 16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  btnSecondary: {
    border: '1px solid #ccc',
    borderRadius: 6,
    background: '#fff',
    color: '#333',
    padding: '10px 16px',
    cursor: 'pointer',
  },
};
