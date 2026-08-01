/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { GoogleGenAI } from '@google/genai'
import EventEmitter from 'eventemitter3'
import { DEFAULT_LIVE_API_MODEL } from './constants'
import { difference } from 'lodash'
import { base64ToArrayBuffer } from './utils'

export class GenAILiveClient extends EventEmitter {
  model = DEFAULT_LIVE_API_MODEL

  client
  session

  _status = 'disconnected'
  get status() {
    return this._status
  }

  /**
   * Creates a new GenAILiveClient instance.
   * @param apiKey - API key for authentication with Google GenAI
   * @param model - Optional model name to override the default model
   */
  constructor(apiKey, model) {
    super()
    if (model) this.model = model

    this.client = new GoogleGenAI({
      apiKey: apiKey,
    })
  }

  async connect(config) {
    if (this._status === 'connected' || this._status === 'connecting') {
      return false
    }

    this._status = 'connecting'
    const callbacks = {
      onopen: this.onOpen.bind(this),
      onmessage: this.onMessage.bind(this),
      onerror: this.onError.bind(this),
      onclose: this.onClose.bind(this),
    }

    try {
      this.session = await this.client.live.connect({
        model: this.model,
        config: {
          ...config,
        },
        callbacks,
      })
    } catch (e) {
      console.error('Error connecting to GenAI Live:', e)
      this._status = 'disconnected'
      this.session = undefined
      return false
    }

    this._status = 'connected'
    return true
  }

  disconnect() {
    this.session?.close()
    this.session = undefined
    this._status = 'disconnected'

    this.log('client.close', `Disconnected`)
    return true
  }

  send(parts, turnComplete = true) {
    if (this._status !== 'connected' || !this.session) {
      this.emit('error', new ErrorEvent('Client is not connected'))
      return
    }
    this.session.sendClientContent({ turns: parts, turnComplete })
    this.log(`client.send`, parts)
  }

  sendRealtimeInput(chunks) {
    if (this._status !== 'connected' || !this.session) {
      this.emit('error', new ErrorEvent('Client is not connected'))
      return
    }
    chunks.forEach(chunk => {
      this.session.sendRealtimeInput({ media: chunk })
    })

    let hasAudio = false
    let hasVideo = false
    for (let i = 0; i < chunks.length; i++) {
      const ch = chunks[i]
      if (ch.mimeType.includes('audio')) hasAudio = true
      if (ch.mimeType.includes('image')) hasVideo = true
      if (hasAudio && hasVideo) break
    }

    let message = 'unknown'
    if (hasAudio && hasVideo) message = 'audio + video'
    else if (hasAudio) message = 'audio'
    else if (hasVideo) message = 'video'
    this.log(`client.realtimeInput`, message)
  }

  sendToolResponse(toolResponse) {
    if (this._status !== 'connected' || !this.session) {
      this.emit('error', new ErrorEvent('Client is not connected'))
      return
    }
    if (
      toolResponse.functionResponses &&
      toolResponse.functionResponses.length
    ) {
      this.session.sendToolResponse({
        functionResponses: toolResponse.functionResponses,
      })
    }

    this.log(`client.toolResponse`, { toolResponse })
  }

  onMessage(message) {
    if (message.setupComplete) {
      this.emit('setupcomplete')
      return
    }
    if (message.toolCall) {
      this.log('server.toolCall', message)
      this.emit('toolcall', message.toolCall)
      return
    }
    if (message.toolCallCancellation) {
      this.log('receive.toolCallCancellation', message)
      this.emit('toolcallcancellation', message.toolCallCancellation)
      return
    }

    if (message.serverContent) {
      const { serverContent } = message
      if ('interrupted' in serverContent) {
        this.log('receive.serverContent', 'interrupted')
        this.emit('interrupted')
        return
      }
      if ('turnComplete' in serverContent) {
        this.log('server.send', 'turnComplete')
        this.emit('turncomplete')
      }

      if (serverContent.modelTurn) {
        let parts = serverContent.modelTurn.parts || []

        const audioParts = parts.filter(p =>
          p.inlineData?.mimeType?.startsWith('audio/pcm')
        )
        const base64s = audioParts.map(p => p.inlineData?.data)
        const otherParts = difference(parts, audioParts)

        base64s.forEach(b64 => {
          if (b64) {
            const data = base64ToArrayBuffer(b64)
            this.emit('audio', data)
            this.log(`server.audio`, `buffer (${data.byteLength})`)
          }
        })
        if (!otherParts.length) {
          return
        }

        parts = otherParts

        const content = { modelTurn: { parts } }
        this.emit('content', content)
        this.log(`server.content`, message)
      } else {
        console.log('received unmatched message', message)
      }
    }
  }

  onError(e) {
    this._status = 'disconnected'
    console.error('error:', e)

    const message = `Could not connect to GenAI Live: ${e.message}`
    this.log(`server.${e.type}`, message)
    this.emit('error', e)
  }

  onOpen() {
    this._status = 'connected'
    this.emit('open')
  }

  onClose(e) {
    this._status = 'disconnected'
    let reason = e.reason || ''
    if (reason.toLowerCase().includes('error')) {
      const prelude = 'ERROR]'
      const preludeIndex = reason.indexOf(prelude)
      if (preludeIndex > 0) {
        reason = reason.slice(preludeIndex + prelude.length + 1, Infinity)
      }
    }

    this.log(
      `server.${e.type}`,
      `disconnected ${reason ? `with reason: ${reason}` : ``}`
    )
    this.emit('close', e)
  }

  /**
   * Internal method to emit a log event.
   * @param type - Log type
   * @param message - Log message
   */
  log(type, message) {
    this.emit('log', {
      type,
      message,
      date: new Date(),
    })
  }
}
