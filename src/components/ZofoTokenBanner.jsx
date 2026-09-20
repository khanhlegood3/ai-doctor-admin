// src/components/ZofoTokenBanner.jsx
// Khối giới thiệu token meme ZoFo (pump.fun) trên landing page.
// Nội dung song ngữ lấy từ `t.aikol` (src/i18n/zofoLandingI18n.js).
import React, { useState } from 'react'
import { Coins, Copy, Check, ExternalLink, AlertTriangle, Gamepad2 } from 'lucide-react'

export const ZOFO_TOKEN_ADDRESS = 'HMhtez17ir1AT5q75AqePqCE6uhNqpiJncugUDgPpump'
export const ZOFO_PUMPFUN_URL = `https://pump.fun/coin/${ZOFO_TOKEN_ADDRESS}`

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // rơi xuống fallback bên dưới
  }
  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}

export default function ZofoTokenBanner({ t }) {
  const [copied, setCopied] = useState(false)
  const a = t.aikol

  const handleCopy = async () => {
    const ok = await copyText(ZOFO_TOKEN_ADDRESS)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  return (
    <section id="zofo-token" className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
      <div className="rounded-3xl shadow-xl relative overflow-hidden bg-[#0B132B] border border-white/10">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(120deg, rgba(250,204,21,0.10) 0%, rgba(139,77,255,0.18) 50%, rgba(0,194,255,0.10) 100%)' }}
        />
        <div className="relative z-10 p-8 lg:p-12 grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
          <div className="lg:col-span-3">
            <div className="inline-flex items-center gap-2 border border-yellow-300/60 text-yellow-300 font-semibold text-xs rounded-full px-4 py-1 tracking-wide mb-4">
              <Coins className="w-4 h-4" /> {a.eyebrow}
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-white leading-tight mb-3">{a.title}</h2>
            <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">{a.desc}</p>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-200 bg-white/5 border border-white/10 rounded-full px-3 py-1">
              <Gamepad2 className="w-4 h-4" /> {a.status}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-3">
            <div className="text-xs uppercase tracking-wide text-gray-400">{a.addressLabel}</div>
            <div className="flex items-stretch gap-2">
              <code className="flex-1 min-w-0 break-all text-[11px] sm:text-xs leading-snug font-mono text-white bg-black/30 border border-white/10 rounded-xl px-3 py-3 select-all">
                {ZOFO_TOKEN_ADDRESS}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label={copied ? a.copied : a.copy}
                title={copied ? a.copied : a.copy}
                className="shrink-0 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10 transition flex items-center gap-1 text-xs font-semibold"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copied ? a.copied : a.copy}</span>
              </button>
            </div>
            <a
              href={ZOFO_PUMPFUN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white text-[#0B132B] px-6 py-3 rounded-full font-bold shadow-lg hover:shadow-[0_0_20px_rgba(250,204,21,0.4)] transition inline-flex items-center justify-center gap-2"
            >
              {a.viewOnPumpFun} <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="relative z-10 border-t border-white/10 px-8 lg:px-12 py-4 flex items-start gap-2 text-[11px] sm:text-xs text-gray-400 leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0 mt-0.5" />
          <p>{a.disclaimer}</p>
        </div>
      </div>
    </section>
  )
}
