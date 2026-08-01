/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { useLiveAPIContext } from '../../contexts/LiveAPIContext'
import React, { useEffect, useState } from 'react'

export default function ErrorScreen() {
  const { client } = useLiveAPIContext()
  const [error, setError] = useState(null)

  useEffect(() => {
    function onError(error) {
      console.error(error)
      setError(error)
    }

    client.on('error', onError)

    return () => {
      client.off('error', onError)
    }
  }, [client])

  const quotaErrorMessage =
    'Gemini Live API in AI Studio has a limited free quota each day. Come back tomorrow to continue.'

  let errorMessage = 'Something went wrong. Please try again.'
  let rawMessage = error?.message || null
  let tryAgainOption = true
  if (error?.message?.includes('RESOURCE_EXHAUSTED')) {
    errorMessage = quotaErrorMessage
    rawMessage = null
    tryAgainOption = false
  }

  if (!error) {
    return <div style={{ display: 'none' }} />
  }

  return (
    <div className="error-screen">
      <div
        style={{
          fontSize: 48,
        }}
      >
        💔
      </div>
      <div
        className="error-message-container"
        style={{
          fontSize: 22,
          lineHeight: 1.2,
          opacity: 0.5,
        }}
      >
        {errorMessage}
      </div>
      {tryAgainOption ? (
        <button
          className="close-button"
          onClick={() => {
            setError(null)
          }}
        >
          Close
        </button>
      ) : null}
      {rawMessage ? (
        <div
          className="error-raw-message-container"
          style={{
            fontSize: 15,
            lineHeight: 1.2,
            opacity: 0.4,
          }}
        >
          {rawMessage}
        </div>
      ) : null}
    </div>
  )
}
