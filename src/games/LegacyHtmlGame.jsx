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

  const existing = document.querySelector(`script[src="${src}"]`)
  if (existing) {
    const promise = existing.dataset.loaded === 'true'
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          existing.addEventListener('load', resolve, { once: true })
          existing.addEventListener('error', reject, { once: true })
        })
    scriptCache.set(src, promise)
    return promise
  }

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
