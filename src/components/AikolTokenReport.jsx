// src/components/AikolTokenReport.jsx
// Nhúng báo cáo tương tác AIKOL Network (public/aikol-token/aikol-network-report.html)
// vào trang "AIKOL token". File HTML tự báo chiều cao qua postMessage nên iframe
// co giãn theo từng tab, không bị thanh cuộn kép.
import React, { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'

export const AIKOL_REPORT_URL = '/aikol-token/aikol-network-report.html'

export default function AikolTokenReport({ t }) {
  const frameRef = useRef(null)
  const [height, setHeight] = useState(1100)
  const p = t.aikol.page

  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== window.location.origin) return
      if (e.source !== frameRef.current?.contentWindow) return
      const d = e.data
      if (d && d.type === 'aikol-report-height' && Number.isFinite(d.height)) {
        setHeight(Math.min(Math.max(Math.ceil(d.height), 600), 20000))
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#4B6BFF] mb-1">{p.reportEyebrow}</div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-50">{p.reportTitle}</h2>
          {p.reportNote && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{p.reportNote}</p>}
        </div>
        <a
          href={AIKOL_REPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#4B6BFF] hover:underline"
        >
          {p.openFull} <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="rounded-3xl overflow-hidden border border-gray-200 dark:border-white/10 zofo-shadow-soft bg-[#fbfbf9]">
        <iframe
          ref={frameRef}
          src={AIKOL_REPORT_URL}
          title={p.reportTitle}
          loading="lazy"
          className="block w-full"
          style={{ border: 'none', height }}
        />
      </div>
    </section>
  )
}
