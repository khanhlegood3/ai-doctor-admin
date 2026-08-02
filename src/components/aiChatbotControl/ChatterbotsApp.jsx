/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo) into
 * ai-doctor-admin-main as the "AI chatbot control" panel.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 *
 * Differences from the original App.tsx:
 * - Uses the FREE + SAFE architecture: browser SpeechRecognition (STT) +
 *   browser SpeechSynthesis (TTS) + a server-side proxy at /api/groq-proxy
 *   (provider: 'ai-chatbot-control') that calls Gemini with GEMINI_API_KEY
 *   — a server-only env var with no VITE_ prefix, so it never ships in the
 *   browser bundle (see lib/geminiTextClient.js, hooks/useVoiceCompanion.js,
 *   api/_lib/aiChatbotControlProxy.js). No API key is read on the client at
 *   all.
 * - No "Your name / Your info" popup: that info is synced automatically
 *   from the user's real Profile (AuthContext) by AIChatbotControlPanel.jsx,
 *   so the original UserSettings modal was removed entirely.
 * - Rendered inside a bounded container (see AIChatbotControlPanel.jsx) rather
 *   than taking over the full viewport, so it behaves as one panel among the
 *   many others in the admin sidebar.
 */
import React from 'react'
import AgentEdit from './components/AgentEdit'
import ErrorScreen from './components/demo/ErrorScreen'
import KeynoteCompanion from './components/demo/keynote-companion/KeynoteCompanion'
import Header from './components/Header'
import TranscriptPanel from './components/TranscriptPanel'
import { LiveAPIProvider } from './contexts/VoiceCompanionContext'
import { useUI } from './lib/state'

/**
 * Main application component for the AI chatbot control panel.
 */
function ChatterbotsApp() {
  const { showAgentEdit } = useUI()
  return (
    <div className="App">
      <LiveAPIProvider>
        <ErrorScreen />
        <Header />

        {showAgentEdit && <AgentEdit />}
        <div className="streaming-console">
          <main>
            <div className="main-app-area">
              <KeynoteCompanion />
            </div>

            <TranscriptPanel />
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  )
}

export default ChatterbotsApp
