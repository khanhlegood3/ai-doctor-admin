import React from 'react'
import { useApp } from '../context/AppContext'
import ChatterbotsApp from './aiChatbotControl/ChatterbotsApp'
import './aiChatbotControl/aiChatbotControl.css'

/**
 * "AI chatbot control" panel — hosts the ported chatterbots voice companion
 * app inside the admin sidebar, right below Profile.
 *
 * FREE architecture: instead of the paid/quota-limited Gemini Live API the
 * original chatterbots demo used, this panel drives voice in/out with the
 * browser's free SpeechRecognition + SpeechSynthesis APIs, and gets replies
 * from the same free `generateContent` Gemini endpoint already used
 * elsewhere in this project (see AffiliateSystemControlPanel.jsx). It reuses
 * the same `VITE_GEMINI_API_KEY` env var already configured for that panel —
 * no new key or extra billing needed. If the key isn't set, a setup notice
 * is shown instead of crashing the app.
 *
 * Note: SpeechRecognition is best supported in Google Chrome / Chromium
 * based browsers today.
 */
export default function AIChatbotControlPanel() {
  const { t, theme } = useApp()
  const isDark = theme === 'dark'
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ''

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
        {apiKey ? (
          <ChatterbotsApp apiKey={apiKey} />
        ) : (
          <div className="aiChatbotControlSetupNotice">
            <div style={{ fontSize: 40 }}>🔑</div>
            <p>{t('aiChatbotControlMissingKey')}</p>
            <p>
              <code>VITE_GEMINI_API_KEY</code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
