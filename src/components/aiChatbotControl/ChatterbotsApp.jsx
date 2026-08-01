/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo) into
 * ai-doctor-admin-main as the "AI chatbot control" panel.
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 *
 * Differences from the original App.tsx:
 * - Uses the FREE architecture: browser SpeechRecognition (STT) +
 *   browser SpeechSynthesis (TTS) + the project's existing free
 *   VITE_GEMINI_API_KEY `generateContent` endpoint (see
 *   lib/geminiTextClient.js and hooks/useVoiceCompanion.js), instead of the
 *   paid/quota-limited Gemini Live API used by the original demo.
 * - apiKey is passed in as a prop (resolved by AIChatbotControlPanel.jsx from
 *   import.meta.env.VITE_GEMINI_API_KEY) instead of reading process.env and
 *   throwing at module scope.
 * - Rendered inside a bounded container (see AIChatbotControlPanel.jsx) rather
 *   than taking over the full viewport, so it behaves as one panel among the
 *   many others in the admin sidebar.
 */
import React from 'react'
import AgentEdit from './components/AgentEdit'
import ControlTray from './components/console/control-tray/ControlTray'
import ErrorScreen from './components/demo/ErrorScreen'
import KeynoteCompanion from './components/demo/keynote-companion/KeynoteCompanion'
import Header from './components/Header'
import UserSettings from './components/UserSettings'
import { LiveAPIProvider } from './contexts/VoiceCompanionContext'
import { useUI } from './lib/state'

/**
 * Main application component that provides a streaming interface for Live API.
 * Manages video streaming state and provides controls for webcam/screen capture.
 */
function ChatterbotsApp({ apiKey }) {
  const { showUserConfig, showAgentEdit } = useUI()
  return (
    <div className="App">
      <LiveAPIProvider apiKey={apiKey}>
        <ErrorScreen />
        <Header />

        {showUserConfig && <UserSettings />}
        {showAgentEdit && <AgentEdit />}
        <div className="streaming-console">
          <main>
            <div className="main-app-area">
              <KeynoteCompanion />
            </div>

            <ControlTray></ControlTray>
          </main>
        </div>
      </LiveAPIProvider>
    </div>
  )
}

export default ChatterbotsApp
