/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useEffect, useRef, useState} from 'react'
import Renderer from './Renderer'
import type {Output, Round} from '../lib/types'
import {
  setActiveCollectionId,
  setFeed,
  setScreensaverMode,
  setSpecialAllCollectionScreensaverMode
} from '../lib/actions'
import {initializeAudio} from '../lib/useTonePalette'

export type Collection = {
  id: string
  name: string
  slug: string
  shareIds: string
  isActive: boolean
  sortOrder: number
  rounds: Round[]
}
type CloudCollectionData = {
  collection: Collection
  rounds: Round[]
}

export function FeaturedCollections() {
  const [collections, setCollections] = useState<Collection[]>([])
  const [previewItems, setPreviewItems] = useState<Record<string, Output>>({})

  const runOnceRef = useRef(false)
  useEffect(() => {
    async function fetchData() {
      const res = await fetch(
        'https://storage.googleapis.com/experiments-uploads/vibecheck/active.json'
      )
      const collectionIds = await res.json()

      // fetch each collection from google storage
      const collectionsData: Collection[] = []
      for (const collectionId of collectionIds) {
        const colRes = await fetch(
          `https://storage.googleapis.com/experiments-uploads/vibecheck/${collectionId}.json`
        )
        const colData = (await colRes.json()) as CloudCollectionData
        colData.collection.rounds = colData.rounds
        collectionsData.push(colData.collection)
        const roundData: Round = colData.rounds[0]!
        const firstOutputKey = Object.keys(roundData.outputs || {})[0]
        setPreviewItems(prev => ({
          ...prev,
          // @ts-expect-error
          [colData.collection.slug]: colData.rounds[0].outputs[firstOutputKey]
        }))
      }
      setCollections(collectionsData)
    }
    if (runOnceRef.current) return
    runOnceRef.current = true
    fetchData()
  }, [])

  async function showScreensaverOfAllCollections() {
    let allRounds: Round[] = []
    collections.forEach(col => {
      allRounds = allRounds.concat(col.rounds)
    })

    setSpecialAllCollectionScreensaverMode(true)
    setFeed(allRounds)
    initializeAudio()
    setScreensaverMode(true)
  }

  return (
    <div className="w-full">
      <div className="flex w-full gap-3 items-center mb-4">
        <div className="uppercase font-bold tracking-wider">⭐ Collections</div>
        <button
          className=""
          onClick={showScreensaverOfAllCollections}
          style={{gap: 0}}
        >
          (<span className="underline">Screensaver</span>)
        </button>
      </div>
      <div className="grid cols-2 grid-cols-2 md:grid-cols-4 gap-6">
        {collections.map(collection => {
          const output = previewItems[collection.slug]
          return (
            <div key={collection.id} className="relative">
              <div className="relative border border-primary overflow-hidden mb-4 w-full aspect-square">
                {output ? (
                  <Renderer
                    mode={output.mode}
                    code={output.srcCode}
                    isFullscreen={true}
                  />
                ) : null}
              </div>
              <div className="font-bold">{collection.name}</div>
              <button
                className="absolute inset-0 cursor-pointer"
                onClick={() => {
                  setActiveCollectionId(collection.id)
                }}
              ></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
