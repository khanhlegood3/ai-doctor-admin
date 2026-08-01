import React from 'react'
import { useApp } from '../context/AppContext'
import ChatterbotsApp from './aiChatbotControl/ChatterbotsApp'
import './aiChatbotControl/aiChatbotControl.css'

/**
 * "AI chatbot control" panel — hosts the ported chatterbots voice companion
 * app inside the admin sidebar, right below Profile.
 *
 * FREE + SAFE architecture: instead of the paid/quota-limited Gemini Live
 * API the original chatterbots demo used (and instead of an earlier
 * iteration of this panel that called Gemini directly from the browser with
 * a VITE_-prefixed key), voice in/out runs entirely in the browser via the
 * free SpeechRecognition + SpeechSynthesis APIs, and replies come from a
 * server-side proxy (/api/groq-proxy, provider: 'ai-chatbot-control') that
 * calls Gemini using GEMINI_API_KEY — a server-only env var (no VITE_
 * prefix) that is never bundled into client JS. This key is shared with the
 * Vibe Check / Vision Sync Live Music features already in this project, so
 * no new Vercel configuration is needed if that's already set up.
 *
 * There's no client-side key to check anymore, so this panel always renders
 * the full app; if GEMINI_API_KEY isn't configured on the server, the proxy
 * returns a clear error the first time the user presses "Connect", which
 * surfaces through ChatterbotsApp's own ErrorScreen.
 *
 * Note: SpeechRecognition is best supported in Google Chrome / Chromium
 * based browsers today.
 */
export default function AIChatbotControlPanel() {
  const { t, theme } = useApp()
  const isDark = theme === 'dark'

  return (
    <div
      style={{
        padding: 16,
        height: 'calc(100vh - 32px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: 20, color: isDark ? '#e8f0f8' : '#1a2035' }}>
          🤖 {t('nav_aiChatbotControl')}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? 'rgba(232,240,248,0.55)' : '#666' }}>
          {t('aiChatbotControlSubtitle')}
        </p>
      </div>

      <div
        className="ai-chatbot-control-root"
        style={{ flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden' }}
      >
        <ChatterbotsApp />
      </div>
    </div>
  )
}
