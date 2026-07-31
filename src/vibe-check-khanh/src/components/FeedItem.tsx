/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type {Round} from '../lib/types'
import {useState} from 'react'
import c from 'clsx'
import {addRound, removeRound} from '../lib/actions'
import modes from '../lib/modes'
import {values} from '../lib/utils'
import ModelOutput from './ModelOutput'
import models from '../lib/models'

type FeedItemProps = {
  round: Round
  showOnlyFavorited?: boolean
}

export default function FeedItem({round, showOnlyFavorited}: FeedItemProps) {
  const [showSystemInstruction, setShowSystemInstruction] = useState(false)

  // Filter outputs based on showOnlyFavorited prop
  const filteredOutputs = showOnlyFavorited
    ? values(round.outputs).filter(
        output => round.favoritedOutputIds?.includes(output.id)
      )
    : values(round.outputs)

  // Don't render if showing favorites but none exist
  if (showOnlyFavorited && filteredOutputs.length === 0) {
    return null
  }

  const sortedOutputs = filteredOutputs.sort(
    (a, b) => models[a.model]!.order - models[b.model]!.order
  )
  const numOutputs = sortedOutputs.length

  // Infer the original configuration from the round's outputs
  const inferRoundConfig = () => {
    const outputs = values(round.outputs)
    if (outputs.length === 0) return {}

    // Check if all outputs use the same model (batch mode)
    const firstModel = outputs[0]!.model
    const isBatchMode = outputs.every(output => output.model === firstModel)

    if (isBatchMode) {
      return {
        outputMode: round.mode,
        batchMode: true,
        batchSize: outputs.length,
        batchModel: firstModel
      }
    } else {
      // Versus mode - reconstruct which models were active
      const activeModels: {[key: string]: boolean} = {}
      outputs.forEach(output => {
        activeModels[output.model] = true
      })
      return {
        outputMode: round.mode,
        batchMode: false,
        versusModels: activeModels
      }
    }
  }

  return (
    <li
      key={round.id}
      style={{maxWidth: 20 * 2 + numOutputs * 700 + (numOutputs - 1) * 20}}
    >
      <div className={c('header', {anchorTop: showSystemInstruction})}>
        <h3 className={c({anchorTop: showSystemInstruction})}>
          <div className="chip">
            {modes[round.mode]?.emoji} {modes[round.mode]?.name}
          </div>
          <div className="prompt">
            {showSystemInstruction && (
              <p className="systemInstruction">
                {modes[round.mode]?.systemInstruction}
              </p>
            )}
            <p>{round.prompt}</p>
          </div>
        </h3>
        <div className="actions">
          <button
            className="iconButton"
            onClick={() => setShowSystemInstruction(!showSystemInstruction)}
          >
            <span className="icon">subject</span>
            <span className="tooltip">
              {showSystemInstruction ? 'Hide' : 'Show'} system instruction
            </span>
          </button>

          <button
            className="iconButton"
            onClick={() =>
              addRound(round.prompt, round.inputImage, inferRoundConfig())
            }
          >
            <span className="icon">refresh</span>
            <span className="tooltip">Re-run prompt</span>
          </button>

          {round.createdBy === 'anonymous' && (
            <button
              className="iconButton"
              onClick={() => removeRound(round.id)}
            >
              <span className="icon">delete</span>
              <span className="tooltip">Remove</span>
            </button>
          )}
        </div>
      </div>

      <ul className="outputs">
        {sortedOutputs.map(output => (
          <li key={output.id}>
            <ModelOutput output={output} round={round} />
          </li>
        ))}
      </ul>
    </li>
  )
}
