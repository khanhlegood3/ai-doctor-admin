/**
 * Replaces the original chatterbots LiveAPIContext.tsx (Gemini Live API,
 * paid/quota-limited, API key nhúng client) with a free version backed by
 * the browser's Web Speech APIs + a server-side Gemini proxy (see
 * hooks/useVoiceCompanion.js and lib/geminiTextClient.js). No API key ever
 * reaches the browser.
 */
import React, { createContext, useContext } from 'react'
import { useVoiceCompanion } from '../hooks/useVoiceCompanion'

const VoiceCompanionContext = createContext(undefined)

export const LiveAPIProvider = ({ children }) => {
  const voiceCompanion = useVoiceCompanion()

  return (
    <VoiceCompanionContext.Provider value={voiceCompanion}>
      {children}
    </VoiceCompanionContext.Provider>
  )
}

export const useLiveAPIContext = () => {
  const context = useContext(VoiceCompanionContext)
  if (!context) {
    throw new Error('useLiveAPIContext must be used wihin a LiveAPIProvider')
  }
  return context
}
