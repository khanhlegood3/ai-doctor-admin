import React from 'react'
import { useApp } from '../context/AppContext'
import ChatterbotsApp from './aiChatbotControl/ChatterbotsApp'
import './aiChatbotControl/aiChatbotControl.css'

/**
 * "AI chatbot control" panel — hosts the ported chatterbots (Gemini Live API
 * voice companion) app inside the admin sidebar, right below Profile.
 *
 * The original chatterbots project read `process.env.GEMINI_API_KEY` and
 * threw at import time if it was missing. Here we read the Vite-style
 * `VITE_GEMINI_API_KEY` (same convention already used by AffiliateSystemControlPanel.jsx
 * and VideoToLearningPanel.jsx in this project) and show a setup notice
 * instead of crashing the whole app when it isn't configured yet.
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
