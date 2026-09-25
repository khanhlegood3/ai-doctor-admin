import React, { useEffect, useMemo, useRef } from 'react'

const scriptCache = new Map()

function getSection(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1] || ''
}

function getExternalScripts(html) {
  return [...html.matchAll(/<script([^>]*)><\/script>/gi)]
    .map((match) => {
      const src = match[1].match(/\bsrc=["']([^"']+)["']/i)?.[1]
      const crossOrigin = match[1].match(/\bcrossorigin(?:=["']([^"']*)["'])?/i)?.[1]
      return src ? { src, crossOrigin: crossOrigin || undefined } : null
    })
    .filter(Boolean)
}

function getInlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1])
}

function stripScripts(markup) {
  return markup.replace(/<script[\s\S]*?<\/script>/gi, '')
}

function loadScript({ src, crossOrigin }) {
  if (scriptCache.has(src)) return scriptCache.get(src)

  // CHÚ Ý: KHÔNG được tái sử dụng một thẻ <script src="..."> đã có sẵn
  // trong trang (ví dụ script tải Tailwind trong <head> của
  // body-protection-html.html) bằng cách gắn thêm addEventListener('load'/
  // 'error', ...) vào nó — nếu thẻ đó đã tải xong (hoặc lỗi) TRƯỚC khi đoạn
  // code này chạy, sự kiện 'load'/'error' đã bắn xong và sẽ KHÔNG bắn lại,
  // khiến promise treo vĩnh viễn. Hệ quả thực tế: `Promise.all(...).then()`
  // phía dưới (nơi các <script> nội tuyến của game — chứa các hàm như
  // `setKey` — được chèn vào trang) không bao giờ chạy, người chơi bấm nút
  // điều khiển thì gặp lỗi `setKey is not defined` dù khung game (canvas,
  // nút bấm) vẫn hiển thị bình thường vì đó là markup tĩnh được chèn trước.
  // Đây là lỗi có tính chất đua tài nguyên (race condition) — không phải
  // lúc nào cũng xảy ra, tuỳ tốc độ tải bundle React so với script có sẵn.
  // Cách sửa: luôn tự tạo một thẻ <script> mới do chính hàm này quản lý
  // trọn vòng đời (gắn onload/onerror TRƯỚC khi chèn vào DOM), chấp nhận
  // khả năng gọi lại network 1 lần nữa cho cùng URL (trình duyệt tự phục vụ
  // từ cache nên chi phí không đáng kể) để đổi lấy việc luôn resolve đúng.
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    if (crossOrigin) script.crossOrigin = crossOrigin
    script.onload = () => {
      script.dataset.loaded = 'true'
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
  scriptCache.set(src, promise)
  return promise
}

export default function LegacyHtmlGame({ html, title, className = 'legacy-html-game-root' }) {
  const rootRef = useRef(null)
  const style = useMemo(() => getSection(html, 'style'), [html])
  const bodyMarkup = useMemo(() => stripScripts(getSection(html, 'body')), [html])
  const externalScripts = useMemo(() => getExternalScripts(html), [html])
  const inlineScripts = useMemo(() => getInlineScripts(html), [html])

  useEffect(() => {
    document.documentElement.lang = 'vi'
    if (title) document.title = title
  }, [title])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    root.innerHTML = bodyMarkup
    let cancelled = false
    const mountedScripts = []

    Promise.all(externalScripts.map(loadScript))
      .then(() => {
        if (cancelled) return
        inlineScripts.forEach((source) => {
          const script = document.createElement('script')
          script.textContent = source
          document.body.appendChild(script)
          mountedScripts.push(script)
        })
      })
      .catch((error) => {
        console.error('[LegacyHtmlGame] Không tải/chạy được game HTML:', error)
      })

    return () => {
      cancelled = true
      try { window.stopCamera?.() } catch {}
      mountedScripts.forEach((script) => script.remove())
      root.innerHTML = ''
    }
  }, [bodyMarkup, externalScripts, inlineScripts])

  return (
    <>
      <style>{style}</style>
      <div ref={rootRef} className={className} />
    </>
  )
}
