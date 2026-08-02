import React, { useEffect, useMemo, useRef } from 'react'
import humanTankHtml from '../../../public/games/human-tank-camera-key.html?raw'
import classicTankHtml from '../../../public/games/co-the-tank-camera-key.html?raw'

const MEDIAPIPE_SCRIPTS = [
  'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
]

const scriptCache = new Map()

function loadScript(src) {
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
    script.crossOrigin = 'anonymous'
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

function getSection(html, tagName) {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1] || ''
}

function stripScripts(markup) {
  return markup.replace(/<script[\s\S]*?<\/script>/gi, '')
}

function getInlineScripts(html) {
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1])
}

export default function TankDefenseGame({ variant = 'human' }) {
  const rootRef = useRef(null)
  const html = variant === 'classic' ? classicTankHtml : humanTankHtml
  const style = useMemo(() => getSection(html, 'style'), [html])
  const bodyMarkup = useMemo(() => stripScripts(getSection(html, 'body')), [html])
  const inlineScripts = useMemo(() => getInlineScripts(html), [html])

  useEffect(() => {
    document.documentElement.lang = 'vi'
    document.title = variant === 'classic'
      ? 'Bảo Vệ Cơ Thể - Tank Defense (React)'
      : 'Medical AI PvP/PvE/Co-op - Tank Defense (React)'
  }, [variant])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined

    root.innerHTML = bodyMarkup
    let cleanup = () => {}
    let cancelled = false

    Promise.all(MEDIAPIPE_SCRIPTS.map(loadScript))
      .then(() => {
        if (cancelled) return
        const script = inlineScripts.join('\n;\n')
        const executeLegacyGame = new Function(script)
        executeLegacyGame()
        cleanup = () => {
          try { window.stopCamera?.() } catch {}
        }
      })
      .catch((error) => {
        console.error('[TankDefenseGame] Không tải được thư viện MediaPipe:', error)
        const loading = root.querySelector('#cam-loading')
        if (loading) loading.textContent = 'Không tải được MediaPipe Camera.'
      })

    return () => {
      cancelled = true
      cleanup()
      root.innerHTML = ''
    }
  }, [bodyMarkup, inlineScripts])

  return (
    <>
      <style>{style}</style>
      <div ref={rootRef} className="tank-defense-react-root" />
    </>
  )
}
