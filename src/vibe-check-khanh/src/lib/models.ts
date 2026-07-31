/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type {Models, Model} from './types'

const models = {
  lite: {
    name: 'Flash-Lite',
    version: '2.5',
    modelString: 'gemini-2.5-flash-lite',
    shortName: 'Lite',
    thinkingCapable: false,
    thinking: false,
    imageOutput: false,
    order: 1
  },
  flash: {
    name: 'Flash (thinking off)',
    version: '2.5',
    modelString: 'gemini-2.5-flash',
    shortName: 'Flash',
    thinkingCapable: true,
    thinking: false,
    imageOutput: false,
    order: 2
  },
  flash3: {
    name: 'Flash (thinking off)',
    version: '3',
    modelString: 'gemini-3-flash-preview',
    shortName: 'Flash',
    thinkingCapable: true,
    thinking: false,
    imageOutput: false,
    order: 3
  },
  flashThinking: {
    name: 'Flash',
    version: '2.5',
    modelString: 'gemini-2.5-flash',
    shortName: 'Flash',
    thinkingCapable: true,
    thinking: true,
    imageOutput: false,
    order: 4
  },
  flashThinking3: {
    name: 'Flash',
    version: '3',
    modelString: 'gemini-3-flash-preview',
    shortName: 'Flash',
    thinkingCapable: true,
    thinking: true,
    imageOutput: false,
    order: 5
  },
  pro: {
    name: 'Pro',
    version: '2.5',
    modelString: 'gemini-2.5-pro',
    shortName: 'Pro',
    thinkingCapable: true,
    thinking: true,
    imageOutput: false,
    order: 6
  },
  threePro: {
    name: 'Pro',
    version: '3',
    modelString: 'gemini-3-pro-preview',
    shortName: 'Pro',
    thinkingCapable: true,
    thinking: true,
    imageOutput: false,
    order: 7
  }
} as const

export const activeModelKeys = [
  'lite',
  'flash',
  'flash3',
  'flashThinking',
  'flashThinking3',
  'pro',
  'threePro'
] as const

export type ActiveModelKey = (typeof activeModelKeys)[number]

const _activeModels = {} as Record<ActiveModelKey, Model>
activeModelKeys.forEach(key => {
  _activeModels[key] = models[key]
})
export const activeModels = _activeModels as {
  [K in ActiveModelKey]: (typeof models)[K]
}

export default models as Models
