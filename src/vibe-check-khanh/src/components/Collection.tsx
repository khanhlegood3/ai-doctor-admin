/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useState, useEffect} from 'react'
import {
  setActiveCollectionId,
  setFeed,
  setScreensaverMode
} from '../lib/actions'
import FeedItem from './FeedItem'
import type {Round} from '../lib/types'
import {initializeAudio} from '../lib/useTonePalette'
import {use} from '../lib/store'

interface Collection {
  id: string
  name: string
  slug: string
  shareIds: string
  isActive: boolean
  isDeleted: boolean
  sortOrder: number
}
type CloudCollectionData = {
  collection: Collection
  rounds: Round[]
}

export function Collection({id}: {id: string}) {
  const [rounds, setRounds] = useState<Round[]>([])
  const [collectionData, setCollectionData] = useState<Collection | null>(null)
  const headerHeight = use.headerHeight()
  const [collections, setCollections] = useState<Collection[]>([])
  const [shareCopied, setShareCopied] = useState(false)

  // Main fetch
  useEffect(() => {
    async function loadCollection() {
      const colRes = await fetch(
        `https://storage.googleapis.com/experiments-uploads/vibecheck/${id}.json`
      )
      const colData = (await colRes.json()) as CloudCollectionData
      setRounds(colData.rounds)
      setCollectionData(colData.collection)
    }
    loadCollection()
  }, [id])

  // All collections - hopefully cached
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
        collectionsData.push(colData.collection)
      }
      setCollections(collectionsData)
    }
    fetchData()
  }, [])

  // Update feed for screensaver and fullscreen
  useEffect(() => {
    setFeed(rounds)
  }, [rounds])

  if (!collectionData) {
    return null
  }

  return (
    <div>
      <div
        className="flex sticky w-full z-100 bg-primary py-2 justify-between text-primary px-3 border-b border-secondary h-auto"
        style={{top: `${headerHeight}px`}}
      >
        <div className="flex gap-2 items-center">
          <span className="text-tertiary">Collection:</span>
          <div className="selectorWrapper shorter">
            <select
              value={collectionData.id}
              onChange={e => {
                // setParam('collection', e.target.value)
                setActiveCollectionId(e.target.value)
              }}
              className="border-primary rounded"
              style={{
                borderStyle: 'solid',
                borderWidth: '1px',
                padding: '4px 24px 6px 12px'
              }}
            >
              {collections
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(col => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <button
            className="iconButton"
            onClick={() => {
              setShareCopied(true)
              const newUrl = `https://aistudio.google.com/apps/bundled/vibecheck?showPreview=true&appParams=vibecheckcollection${collectionData.id}`
              navigator.clipboard.writeText(newUrl)
              setTimeout(() => setShareCopied(false), 1000)
            }}
          >
            <span className="icon">share</span>
            <span className="tooltip">
              {shareCopied ? 'Copied!' : 'Copy share link'}
            </span>
          </button>

          <button
            className="chip"
            onClick={() => {
              initializeAudio()
              setScreensaverMode(true)
            }}
          >
            <span className="icon">🖥️</span>
            Screensaver Mode
          </button>
        </div>
      </div>

      <div>
        <main>
          <ul className="feed">
            {rounds.map(round => (
              <FeedItem
                key={round.id}
                round={round}
                showOnlyFavorited={round.favoritesOnly}
              />
            ))}
          </ul>
        </main>
      </div>
    </div>
  )
}
