/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { createContext, useContext } from 'react'
import { useLiveApi } from '../hooks/media/use-live-api'

const LiveAPIContext = createContext(undefined)

export const LiveAPIProvider = ({ apiKey, children }) => {
  const liveAPI = useLiveApi({ apiKey })

  return (
    <LiveAPIContext.Provider value={liveAPI}>
      {children}
    </LiveAPIContext.Provider>
  )
}

export const useLiveAPIContext = () => {
  const context = useContext(LiveAPIContext)
  if (!context) {
    throw new Error('useLiveAPIContext must be used wihin a LiveAPIProvider')
  }
  return context
}
