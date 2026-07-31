/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useState} from 'react'
import shuffle from 'lodash/shuffle'
import type {ModeKey, Preset} from '../lib/types'
import modes, {frontpageOrder} from '../lib/modes'
import {addRound, setOutputMode, setBatchModel} from '../lib/actions'
import models from '../lib/models'
import {use} from '../lib/store'
import {entries, keys, fromEntries} from '../lib/utils'
import {FeaturedCollections} from './HighlightCarousel'

export default function Intro() {
  const batchModel = use.batchModel()
  const [presets] = useState<Record<ModeKey, Preset[]>>(() =>
    fromEntries(
      entries(modes).map(([key, mode]) => [
        key,
        shuffle(mode.presets.slice(0, 50))
      ])
    )
  )

  return (
    <section className="intro text-primary">
      <div className="flex flex-col gap-1">
        <div>
          Welcome to <strong>VibeCheck</strong>, a playground for testing visual
          coding prompts.
        </div>
        <div>Explore these results and start prompting.</div>
      </div>

      <FeaturedCollections />

      <div className="flex flex-col gap-4">
        <div className="uppercase font-bold tracking-wider">
          💡 Starter Prompts
        </div>

        {frontpageOrder.map(key => {
          const mode = modes[key]
          return mode.imageOutput ? null : (
            <div key={key} className="max-w-2xl">
              <div className="selector presetList">
                <ul className="presets wrapped flex flex-wrap items-center">
                  {mode.name}:
                  {shuffle(presets[key])
                    .slice(0, 3)
                    .map(({label, prompt}) => (
                      <li key={label}>
                        <button
                          onClick={() => {
                            setOutputMode(key)
                            if (models[batchModel]?.imageOutput) {
                              setBatchModel(keys(models)[0]!)
                            }
                            addRound(prompt, null)
                          }}
                          className="chip"
                          style={{
                            padding: '1px 8px'
                          }}
                        >
                          {label}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
      <div>
        Got a fun result? 💬 Share it with us:{' '}
        <a className='underline' target="_blank" href="https://x.com/dcmotz">
          @dcmotz
        </a>{' '}
        +{' '}
        <a className='underline' target="_blank" href="https://x.com/alexanderchen">
          @alexanderchen
        </a>
      </div>
    </section>
  )
}
