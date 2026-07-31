/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useEffect, useState} from 'react'
import type {Round} from '../lib/types'
import FeedItem from './FeedItem'
import {setFeed} from '../lib/actions'

type ResultProps = {
  id: string
}

export function Result({id}: ResultProps) {
  const [round, setRound] = useState<Round | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Main fetch
  useEffect(() => {
    async function loadResult() {
      try {
        const res = await fetch(
          `https://storage.googleapis.com/experiments-uploads/vibecheck/${id}.json`
        )
        const data = await res.json()
        setLoading(false)
        setRound(data as Round)
      } catch (err) {
        console.error('Error loading round:', err)
        setError('Failed to load round')
        setLoading(false)
      }
    }
    loadResult()
  }, [id])

  useEffect(() => {
    if (round) {
      setFeed([round])
    }
  }, [round])

  if (loading) {
    return <div>Loading...</div>
  }

  if (error) {
    return <div>Error: {error}</div>
  }

  if (!round) {
    return <div>No round found</div>
  }

  return (
    <div>
      <main>
        <ul className="feed">
          <FeedItem key={round.id} round={round} />
        </ul>
      </main>
    </div>
  )
}
