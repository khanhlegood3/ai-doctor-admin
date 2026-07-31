/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type {AppState} from './types'
import 'immer'
import {create, type UseBoundStore, type StoreApi} from 'zustand'
import {immer} from 'zustand/middleware/immer'
import {frontpageOrder} from './modes'
import models from './models'
import {keys} from './utils'
import {persist} from 'zustand/middleware'

type WithSelectors<S> = S extends {getState: () => infer T}
  ? S & {use: {[K in keyof T]: () => T[K]}}
  : never

const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  const store = _store as WithSelectors<typeof _store>
  store.use = {}
  for (const k of Object.keys(store.getState())) {
    ;(store.use as Record<string, () => unknown>)[k] = () =>
      store(s => s[k as keyof typeof s])
  }

  return store
}

const initialState: AppState = {
  didInit: false,
  feed: [],
  userRounds: [],
  outputMode: frontpageOrder[0],
  batchMode: false,
  batchSize: 3,
  batchModel: 'flashThinking3',
  versusModels: {
    flashThinking3: true,
    threePro: true
  },
  fullscreenAnimate: true,
  activeCollectionId: null,
  activeResultId: null,
  fullscreenShowCode: false,
  fullScreenSound: true,
  screensaverSound: true,
  fullscreenActiveId: null,
  screensaverMode: false,
  headerHeight: 0,
  specialAllCollectionScreensaverMode: false
}

const store = createSelectors(
  create<AppState>()(
    persist(
      immer(() => initialState),
      {
        name: 'vibecheck',
        partialize: state => ({
          userRounds: state.userRounds,
          outputMode: state.outputMode,
          batchMode: state.batchMode,
          batchSize: state.batchSize,
          batchModel: state.batchModel,
          versusModels: state.versusModels
        })
      }
    )
  )
)

export const get = store.getState
export const set = store.setState
export const use = store.use
