/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GenAILiveClient } from '../../lib/genai-live-client'
import { AudioStreamer } from '../../lib/audio-streamer'
import { audioContext } from '../../lib/utils'
import VolMeterWorket from '../../lib/worklets/vol-meter'
import { DEFAULT_LIVE_API_MODEL } from '../../lib/constants'

export function useLiveApi({ apiKey, model = DEFAULT_LIVE_API_MODEL }) {
  const client = useMemo(() => new GenAILiveClient(apiKey, model), [apiKey])

  const audioStreamerRef = useRef(null)

  const [volume, setVolume] = useState(0)
  const [connected, setConnected] = useState(false)
  const [config, setConfig] = useState({})

  // register audio for streaming server -> speakers
  useEffect(() => {
    if (!audioStreamerRef.current) {
      audioContext({ id: 'audio-out' }).then((audioCtx) => {
        audioStreamerRef.current = new AudioStreamer(audioCtx)
        audioStreamerRef.current
          .addWorklet('vumeter-out', VolMeterWorket, (ev) => {
            setVolume(ev.data.volume)
          })
          .then(() => {
            // Successfully added worklet
          })
          .catch(err => {
            console.error('Error adding worklet:', err)
          })
      })
    }
  }, [audioStreamerRef])

  useEffect(() => {
    const onOpen = () => {
      setConnected(true)
    }

    const onClose = () => {
      setConnected(false)
    }

    const stopAudioStreamer = () => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.stop()
      }
    }

    const onAudio = (data) => {
      if (audioStreamerRef.current) {
        audioStreamerRef.current.addPCM16(new Uint8Array(data))
      }
    }

    // Bind event listeners
    client.on('open', onOpen)
    client.on('close', onClose)
    client.on('interrupted', stopAudioStreamer)
    client.on('audio', onAudio)

    return () => {
      // Clean up event listeners
      client.off('open', onOpen)
      client.off('close', onClose)
      client.off('interrupted', stopAudioStreamer)
      client.off('audio', onAudio)
    }
  }, [client])

  const connect = useCallback(async () => {
    if (!config) {
      throw new Error('config has not been set')
    }
    client.disconnect()
    await client.connect(config)
  }, [client, setConnected, config])

  const disconnect = useCallback(async () => {
    client.disconnect()
    setConnected(false)
  }, [setConnected, client])

  return {
    client,
    config,
    setConfig,
    connect,
    connected,
    disconnect,
    volume,
  }
}
