import React, { useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import EmbeddedGlobalAIChat from './aiChatbotControl/EmbeddedGlobalAIChat'
import { useUser } from './aiChatbotControl/lib/state'
import './aiChatbotControl/aiChatbotControl.css'

/**
 * "AI chatbot control" panel — hosts the ported chatterbots voice companion
 * app inside the admin sidebar, right below Profile.
 *
 * FREE + SAFE architecture: voice in/out runs entirely in the browser via
 * the free SpeechRecognition + SpeechSynthesis APIs, and replies come from a
 * server-side proxy (/api/groq-proxy, provider: 'ai-chatbot-control') that
 * calls Gemini using GEMINI_API_KEY — a server-only env var (no VITE_
 * prefix) never bundled into client JS. There's no client-side key to
 * check, so this panel always renders the full app; if GEMINI_API_KEY isn't
 * configured on the server, a clear error surfaces the first time the user
 * presses "Connect", via ChatterbotsApp's own ErrorScreen.
 *
 * The original chatterbots demo asked for "Your name / Your info" through a
 * one-off popup. That's redundant here — this project already has a real
 * user Profile (Hồ sơ cá nhân), so instead this panel syncs the companion's
 * `name`/`info` straight from AuthContext's `user` (name + specialty) on
 * mount and whenever the profile changes. No popup, no duplicate data entry;
 * to change how the companion addresses you, edit your Profile instead.
 *
 * Note: SpeechRecognition is best supported in Google Chrome / Chromium
 * based browsers today.
 */
export default function AIChatbotControlPanel() {
  const { t, theme } = useApp()
  const { user } = useAuth()
  const { setName, setInfo } = useUser()
  const isDark = theme === 'dark'

  useEffect(() => {
    setName(user?.name || '')
    setInfo(user?.specialty ? `Chuyên khoa / vai trò: ${user.specialty}` : '')
  }, [user?.name, user?.specialty, setName, setInfo])

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

      {/* Không còn tab: khuôn mặt tròn AI (từ Trợ lý thoại companion) +
          chat văn bản/giọng nói song ngữ được gộp chung 1 khối duy nhất,
          toàn bộ lịch sử chat đọc/ghi từ CÙNG một kho IndexedDB dùng
          chung với popup góc màn hình, trang Lịch sử Chat, và mic 2 trang
          Anh Hùng — xem EmbeddedGlobalAIChat.jsx. */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden' }}>
        <EmbeddedGlobalAIChat activePanelLabel={t('nav_aiChatbotControl')} />
      </div>
    </div>
  )
}
