/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import Intro from './Intro'
import {Header} from './Header'
import {Collection} from './Collection'
import {use} from '../lib/store'
import FeedItem from './FeedItem'
import {FullscreenOverlay} from './FullscreenOverlay'
import {Screensaver} from './Screensaver'
import {initializeAudio} from '../lib/useTonePalette'
import {setActiveCollectionId, setActiveResultId, setScreensaverMode} from '../lib/actions'
import {useEffect} from 'react'
import {Result} from './Result'

export function App() {
  const fullscreenActiveId = use.fullscreenActiveId()
  const screensaverMode = use.screensaverMode()
  const feed = use.feed()
  const activeCollectionId = use.activeCollectionId()
  const activeResultId = use.activeResultId()

  const headerHeight = use.headerHeight()

  useEffect(() => {
    function processHash() {
      const hash = window.location.hash
      if (!hash) return null

      let somethingMatched = false
      const collectionMatch = hash.match(/vibecheckcollection([^&]+)/)
      if (collectionMatch) {
        somethingMatched = true
        setActiveCollectionId(collectionMatch[1]!)
      }
      const resultMatch = hash.match(/vibecheck_([^&]+)/)
      if (resultMatch) {
        somethingMatched = true
        const stripFileExtension = (id: string) => {
          return id.replace(/\.[^/.]+$/, '')
        }
        setActiveResultId(stripFileExtension(resultMatch[0]!))
      }

      if (somethingMatched === false) {
        setActiveCollectionId(null)
        setActiveResultId(null)
      }
    }
    processHash()
  }, [])

  return (
    <>
      <Header activeCollectionId={activeCollectionId} />
      {activeCollectionId ? (
        <Collection id={activeCollectionId} />
      ) : activeResultId ? (
        <Result id={activeResultId} />
      ) : feed.length === 0 ? (
        <Intro />
      ) : (
        <div>
          <div
            className="flex sticky w-full items-center z-100 bg-primary py-2 justify-between text-primary px-3 border-b border-secondary h-auto"
            style={{top: `${headerHeight}px`}}
          >
            <div>Your Generations</div>
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
          <main>
            <ul className="feed">
              {feed.map(round => (
                <FeedItem key={round.id} round={round} />
              ))}
            </ul>
          </main>
        </div>
      )}
      {fullscreenActiveId && <FullscreenOverlay />}
      {screensaverMode && <Screensaver />}
    </>
  )
}

export default App
