import React, { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import EmbeddedGlobalAIChat from './aiChatbotControl/EmbeddedGlobalAIChat'
import { useUser } from './aiChatbotControl/lib/state'
import SuperheroCursorPicker from './aiChatbotControl/components/demo/basic-face/SuperheroCursorPicker.jsx'
import { useSuperheroCursor, useFlyEffectEnabled, useGazeTrackEnabled } from './aiChatbotControl/components/demo/basic-face/superheroCursor.js'
import { useClickHeroSpiderEffects } from './aiChatbotControl/components/effects/ClickHeroSpiderEffects.jsx'
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
  const { t, theme, lang } = useApp()
  const { user } = useAuth()
  const { setName, setInfo } = useUser()
  const isDark = theme === 'dark'
  const isVi = lang !== 'en'

  const { type: cursorType, setType: setCursorType, color: cursorColor, setColor: setCursorColor, poseId: cursorPoseId, setPoseId: setCursorPoseId, cursorCss } = useSuperheroCursor()
  const [flyEffectEnabled, setFlyEffectEnabled] = useFlyEffectEnabled()
  const [gazeTrackEnabled, setGazeTrackEnabled] = useGazeTrackEnabled()
  const { layer: clickEffectsLayer, handleClick: handleHeroSpiderClick, handleContextMenu: handleHeroSpiderRightClick } = useClickHeroSpiderEffects(cursorColor, flyEffectEnabled)
  const [showCursorSettings, setShowCursorSettings] = useState(false)
  const border = isDark ? 'rgba(148, 163, 184, 0.24)' : 'rgba(15, 76, 129, 0.16)'
  const text = isDark ? '#e8f0f8' : '#102033'
  const muted = isDark ? 'rgba(226, 232, 240, 0.64)' : '#64748b'

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
        cursor: cursorCss,
      }}
      onClick={handleHeroSpiderClick}
      onContextMenu={handleHeroSpiderRightClick}
    >
      {clickEffectsLayer}
      <div>
        <h2 style={{ margin: 0, fontSize: 20, color: isDark ? '#e8f0f8' : '#1a2035' }}>
          🤖 {t('nav_aiChatbotControl')}
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: isDark ? 'rgba(232,240,248,0.55)' : '#666' }}>
          {t('aiChatbotControlSubtitle')}
        </p>
      </div>

      {/* Con trỏ chuột hình "siêu nhân bay" (tự vẽ, riêng cho trang này) +
          bảng chọn màu/hướng bay. Khuôn mặt AI ở khối chat bên dưới cũng
          "nhìn" theo hướng con trỏ này (xem trackCursor trong
          EmbeddedGlobalAIChat.jsx). */}
      <div style={{ flex: '0 0 auto' }}>
        <button
          type="button"
          onClick={() => setShowCursorSettings(v => !v)}
          style={{ border: `1px solid ${border}`, borderRadius: 999, padding: '6px 12px', background: isDark ? 'rgba(15,23,42,0.74)' : '#fff', color: text, fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
        >
          🦸 {isVi ? 'Đổi con trỏ chuột siêu nhân' : 'Change superhero cursor'}
        </button>
        <span style={{ marginLeft: 10, fontSize: 11, color: muted, fontStyle: 'italic' }}>
          {isVi ? 'Click trái: siêu nhân bay tới · Click phải: người nhện đu dây tới' : 'Left-click: hero flies in · Right-click: spider swings in'}
        </span>
        {showCursorSettings && (
          <div style={{ marginTop: 8, padding: 10, borderRadius: 12, border: `1px solid ${border}`, background: isDark ? 'rgba(7,12,27,0.5)' : 'rgba(255,255,255,0.6)' }}>
            <SuperheroCursorPicker
              isDark={isDark} isVi={isVi} border={border} text={text} muted={muted}
              type={cursorType} setType={setCursorType}
              color={cursorColor} setColor={setCursorColor}
              poseId={cursorPoseId} setPoseId={setCursorPoseId}
              flyEffectEnabled={flyEffectEnabled} setFlyEffectEnabled={setFlyEffectEnabled}
              gazeTrackEnabled={gazeTrackEnabled} setGazeTrackEnabled={setGazeTrackEnabled}
            />
          </div>
        )}
      </div>

      {/* Không còn tab: khuôn mặt tròn AI (từ Trợ lý thoại companion) +
          chat văn bản/giọng nói song ngữ được gộp chung 1 khối duy nhất,
          toàn bộ lịch sử chat đọc/ghi từ CÙNG một kho IndexedDB dùng
          chung với popup góc màn hình, trang Lịch sử Chat, và mic 2 trang
          Anh Hùng — xem EmbeddedGlobalAIChat.jsx. */}
      <div style={{ flex: 1, minHeight: 0, borderRadius: 16, overflow: 'hidden' }}>
        <EmbeddedGlobalAIChat activePanelLabel={t('nav_aiChatbotControl')} trackCursor={gazeTrackEnabled} />
      </div>
    </div>
  )
}
