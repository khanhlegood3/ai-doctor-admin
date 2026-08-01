/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { audioContext } from './utils'
import AudioRecordingWorklet from './worklets/audio-processing'
import VolMeterWorket from './worklets/vol-meter'

import { createWorketFromSrc } from './audioworklet-registry'
import EventEmitter from 'eventemitter3'

function arrayBufferToBase64(buffer) {
  var binary = ''
  var bytes = new Uint8Array(buffer)
  var len = bytes.byteLength
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return window.btoa(binary)
}

export class AudioRecorder extends EventEmitter {
  stream
  audioContext
  source
  recording = false
  recordingWorklet
  vuWorklet

  starting = null

  constructor(sampleRate = 16000) {
    super()
    this.sampleRate = sampleRate
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Could not request user media')
    }

    this.starting = new Promise(async (resolve, reject) => {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.audioContext = await audioContext({ sampleRate: this.sampleRate })
      this.source = this.audioContext.createMediaStreamSource(this.stream)

      const workletName = 'audio-recorder-worklet'
      const src = createWorketFromSrc(workletName, AudioRecordingWorklet)

      await this.audioContext.audioWorklet.addModule(src)
      this.recordingWorklet = new AudioWorkletNode(
        this.audioContext,
        workletName
      )

      this.recordingWorklet.port.onmessage = async (ev) => {
        // Worklet processes recording floats and messages converted buffer
        const arrayBuffer = ev.data.data.int16arrayBuffer

        if (arrayBuffer) {
          const arrayBufferString = arrayBufferToBase64(arrayBuffer)
          this.emit('data', arrayBufferString)
        }
      }
      this.source.connect(this.recordingWorklet)

      // vu meter worklet
      const vuWorkletName = 'vu-meter'
      await this.audioContext.audioWorklet.addModule(
        createWorketFromSrc(vuWorkletName, VolMeterWorket)
      )
      this.vuWorklet = new AudioWorkletNode(this.audioContext, vuWorkletName)
      this.vuWorklet.port.onmessage = (ev) => {
        this.emit('volume', ev.data.volume)
      }

      this.source.connect(this.vuWorklet)
      this.recording = true
      resolve()
      this.starting = null
    })
  }

  stop() {
    // It is plausible that stop would be called before start completes,
    // such as if the Websocket immediately hangs up
    const handleStop = () => {
      this.source?.disconnect()
      this.stream?.getTracks().forEach(track => track.stop())
      this.stream = undefined
      this.recordingWorklet = undefined
      this.vuWorklet = undefined
    }
    if (this.starting) {
      this.starting.then(handleStop)
      return
    }
    handleStop()
  }
}
