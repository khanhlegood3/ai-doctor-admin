/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type {Round, Output, ModelKey, ModeKey, Id} from './types'
import {get, set} from './store'
import modes from './modes'
import llmGen from './llm'
import models from './models'
import {keys, entries, values, fromEntries} from './utils'

export const init = () => {
  if (get().didInit) {
    return
  }

  set(state => {
    state.didInit = true

    if (state?.userRounds?.length) {
      state.userRounds = state.userRounds.flatMap(round => {
        const prunedOutputs = Object.entries(round.outputs).filter(
          ([, output]) => output.state === 'success'
        )

        return prunedOutputs.length
          ? {
              ...round,
              outputs: Object.fromEntries(prunedOutputs)
            }
          : []
      })
    }
  })
}

const newOutput = (model: ModelKey, mode: ModeKey): Output => ({
  model,
  mode,
  id: crypto.randomUUID(),
  srcCode: '',
  state: 'loading',
  startTime: Date.now(),
  totalTime: 0
})

export const addRound = async (
  prompt: string,
  inputImage: string | null,
  options?: {
    outputMode?: ModeKey
    batchMode?: boolean
    batchSize?: number
    batchModel?: ModelKey
    versusModels?: {[key in ModelKey]?: boolean}
  }
) => {
  const state = get()

  // Use provided options or fall back to current state
  const outputMode = options?.outputMode ?? state.outputMode
  const batchMode = options?.batchMode ?? state.batchMode
  const batchSize = options?.batchSize ?? state.batchSize
  const batchModel = options?.batchModel ?? state.batchModel
  const versusModels = options?.versusModels ?? state.versusModels

  scrollTo({top: 0, left: 0, behavior: 'smooth'})

  if (!batchMode && values(versusModels).every(active => !active)) {
    return
  }

  const newRound: Round = {
    prompt,
    inputImage,
    id: crypto.randomUUID(),
    mode: outputMode,
    systemInstructions: modes[outputMode].systemInstruction,
    createdAt: Date.now(),
    createdBy: 'anonymous',
    outputs: fromEntries(
      batchMode
        ? Array(batchSize)
            .fill(null)
            .map(() => {
              const output = newOutput(batchModel, outputMode)
              return [output.id, output]
            })
        : entries(versusModels)
            .filter(([, active]) => active)
            .map(([model]) => {
              const output = newOutput(model, outputMode)
              return [output.id, output]
            })
    )
  }

  values(newRound.outputs).forEach(async output => {
    let res

    if (models[output.model] === undefined) {
      console.error(`Model ${output.model} not found`)
      set(state => {
        const round = state.feed.find(round => round.id === newRound.id)
        if (!round) {
          return
        }
        const o = round.outputs[output.id]
        if (o) {
          o.state = 'error'
        }
      })
      return
    }

    try {
      res = await llmGen({
        model: models[output.model]!.modelString,
        systemInstruction: modes[newRound.mode].systemInstruction,
        prompt: newRound.prompt,
        promptImage: newRound.inputImage,
        imageOutput: modes[newRound.mode].imageOutput,
        thinking: models[output.model]!.thinking,
        thinkingCapable: models[output.model]!.thinkingCapable
      })
    } catch (e) {
      console.error(e)
      set(state => {
        const round = state.feed.find(round => round.id === newRound.id)
        if (!round) {
          return
        }
        const o = round.outputs[output.id]
        if (o) {
          o.state = 'error'
        }
      })
      return
    } finally {
      set(state => {
        const o = state.feed.find(round => round.id === newRound.id)?.outputs[
          output.id
        ]

        if (o) {
          o.totalTime = Date.now() - o.startTime
        }
      })
    }

    if (res) {
      set(state => {
        const round = state.feed.find(round => round.id === newRound.id)

        if (!round) {
          return
        }

        const o = round.outputs[output.id]

        if (o) {
          o.srcCode = res
            .replace(/```\w+/gm, '')
            .replace(/```\n?$/gm, '')
            .trim()
          o.state = 'success'

          const userRound = state.userRounds.find(
            round => round.id === newRound.id
          )

          if (userRound) {
            userRound.outputs[output.id] = o
          }
        }
      })
    }
  })

  set(state => {
    state.userRounds.unshift(newRound)
    state.feed = state.userRounds
  })
}

export const removeRound = (id: string) =>
  set(state => {
    state.feed = state.feed.filter(round => round.id !== id)
    state.userRounds = state.userRounds.filter(round => round.id !== id)
  })

export const setOutputMode = (mode: ModeKey) =>
  set(state => {
    state.outputMode = mode
  })

export const setBatchModel = (model: ModelKey) =>
  set(state => {
    state.batchModel = model
  })

export const setBatchMode = (active: boolean) =>
  set(state => {
    state.batchMode = active

    if (!active && state.outputMode === 'image') {
      state.outputMode = keys(modes)[0]!
    }
  })

export const setBatchSize = (size: number) =>
  set(state => {
    state.batchSize = size
  })

export const setVersusModel = (model: ModelKey, active: boolean) =>
  set(state => {
    state.versusModels[model] = active
  })

export const reset = () =>
  set(state => {
    state.feed = []
  })

export const setFullscreenActiveId = (id: Id | null) =>
  set(state => {
    state.fullscreenActiveId = id
  })

export const setFullscreenAnimate = (active: boolean) =>
  set(state => {
    state.fullscreenAnimate = active
  })

export const setFullscreenShowCode = (active: boolean) =>
  set(state => {
    state.fullscreenShowCode = active
  })

export const setFullscreenSound = (active: boolean) =>
  set(state => {
    state.fullScreenSound = active
  })

export const setScreensaverSound = (active: boolean) =>
  set(state => {
    state.screensaverSound = active
  })

export const setFeed = (feed: Round[]) =>
  set(state => {
    state.feed = feed
  })

export const setScreensaverMode = (active: boolean) =>
  set(state => {
    state.screensaverMode = active
  })

export const setActiveCollectionId = (id: string | null) =>
  set(state => {
    state.activeCollectionId = id
  })

export const setHeaderHeight = (height: number) =>
  set(state => {
    state.headerHeight = height
  })

export const setActiveResultId = (id: string | null) =>
  set(state => {
    state.activeResultId = id
  })

export const setSpecialAllCollectionScreensaverMode = (active: boolean) =>
  set(state => {
    state.specialAllCollectionScreensaverMode = active
  })


init()
