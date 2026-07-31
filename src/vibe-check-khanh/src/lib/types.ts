/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import modes from './modes'
import models from './models'

export type Id = `${string}-${string}-${string}-${string}-${string}`

export type Preset = {
  label: string
  prompt: string
}

export type Mode = {
  name: string
  emoji: string
  syntax: 'javascript' | 'xml' | 'html' | 'image' | 'shader'
  // default system instructions
  systemInstruction: string
  getTitle: (prompt: string) => string
  presets: Preset[]
  imageOutput: boolean
}

export type Modes = {
  [key: string]: Mode
}

export type ModeKey = keyof typeof modes

export type Model = {
  name: string
  version: string
  modelString: string
  shortName: string
  thinkingCapable: boolean
  thinking: boolean
  imageOutput: boolean
  order: number
}

export type Models = {
  [key: string]: Model
}

export type ModelKey = keyof typeof models

export type OutputState = 'loading' | 'success' | 'error'

export type Output = {
  id: Id
  model: ModelKey
  mode: ModeKey
  srcCode: string
  state: OutputState
  startTime: number
  totalTime: number
}

export type Round = {
  id: Id
  prompt: string
  inputImage: string | null
  systemInstructions: string
  outputs: {
    [key: Id]: Output
  }
  mode: ModeKey
  createdBy: string
  createdAt: number
  isDeleted?: boolean
  favoritedOutputIds?: Id[]
  hasFavorites?: boolean
  // optional show only favorites flag for UI purposes
  favoritesOnly?: boolean
}

export type AppState = {
  didInit: boolean
  feed: Round[]
  userRounds: Round[]
  outputMode: ModeKey
  batchMode: boolean
  batchSize: number
  batchModel: ModelKey
  versusModels: {
    [key in ModelKey]: boolean
  }
  activeCollectionId: string | null
  activeResultId: string | null
  fullscreenActiveId: Id | null
  fullscreenAnimate: boolean
  fullscreenShowCode: boolean
  fullScreenSound: boolean
  screensaverMode: boolean
  screensaverSound: boolean
  headerHeight: number
  specialAllCollectionScreensaverMode: boolean
}

export type ExportFormat = {
  id: string
  batchId: string
  type: string
  inputImage: string | null
  createdAt: number
  prompt: string
  systemInstructions: string
  code: string
  model: string
  createdBy: string
  generateionTime: number
}
