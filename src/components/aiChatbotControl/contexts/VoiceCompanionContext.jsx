/**
 * Replaces the original chatterbots LiveAPIContext.tsx (Gemini Live API,
 * paid/quota-limited) with a free version backed by the browser's Web
 * Speech APIs + the project's existing free Gemini generateContent key.
 * See hooks/useVoiceCompanion.js.
 */
import React, { createContext, useContext } from 'react'
import { useVoiceCompanion } from '../hooks/useVoiceCompanion'

const VoiceCompanionContext = createContext(undefined)

export const LiveAPIProvider = ({ apiKey, children }) => {
  const voiceCompanion = useVoiceCompanion({ apiKey })

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
