/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type {Output, Round} from '../lib/types'
import {useState, memo, useEffect} from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import * as styles from 'react-syntax-highlighter/dist/esm/styles/hljs'
import {initializeAudio} from '../lib/useTonePalette'
import c from 'clsx'
import modes from '../lib/modes'
import models from '../lib/models'
import Renderer from './Renderer'
import {setFullscreenActiveId} from '../lib/actions'

function ModelOutput({output, round}: {output: Output; round: Round}) {
  const [time, setTime] = useState(0)
  const [showSource, setShowSource] = useState(false)
  const isBusy = output.state === 'loading'
  const gotError = output.state === 'error'
  const isImage = output.mode === 'image'

  const downloadOutputJSON = () => {
    const downloadJSON = Object.assign({}, round)
    downloadJSON.createdBy = 'exported'
    downloadJSON.outputs = {[output.id]: output}
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(JSON.stringify(downloadJSON, null, 2))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute('href', dataStr)
    downloadAnchorNode.setAttribute(
      'download',
      `vibecheck_${round.id}_${output.id}.json`
    )
    document.body.appendChild(downloadAnchorNode)
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
  }

  useEffect(() => {
    if (isBusy) {
      const interval = setInterval(
        () => setTime(Date.now() - output.startTime),
        10
      )
      return () => clearInterval(interval)
    }
  }, [output.startTime, isBusy])

  return (
    <div className="modelOutput">
      <div className={c('outputRendering', {flipped: showSource})}>
        {!isImage && (
          <div className="back">
            {showSource ? (
              <SyntaxHighlighter
                language={modes[output.mode]?.syntax}
                style={styles.atomOneDark}
              >
                {output.srcCode}
              </SyntaxHighlighter>
            ) : null}
          </div>
        )}

        <div className="front">
          {gotError && (
            <div className="error">
              <p>
                <span className="icon">error</span>
              </p>
              <p>Response error</p>
            </div>
          )}

          {isBusy && (
            <div className="loader">
              <span className="icon">hourglass</span>
            </div>
          )}

          {output.srcCode && (
            <Renderer mode={output.mode} code={output.srcCode} />
          )}
        </div>
      </div>

      <div className="modelInfo">
        <div className="modelName">
          <div>
            {models[output.model]?.version} {models[output.model]?.name}
          </div>
          {(time || output.totalTime) && (
            <div className="timer">
              {((isBusy ? time : output.totalTime) / 1000).toFixed(2)}s
            </div>
          )}
        </div>

        <div
          className={c('outputActions', {active: output.state === 'success'})}
        >
          {!isImage && (
            <button
              className="iconButton"
              onClick={() => setShowSource(!showSource)}
            >
              <span className="icon">{showSource ? 'visibility' : 'code'}</span>
              <span className="tooltip">
                View {showSource ? 'rendering' : 'source'}
              </span>
            </button>
          )}

          <button className="iconButton" onClick={downloadOutputJSON}>
            <span className="icon">download</span>
            <span className="tooltip">Download JSON</span>
          </button>

          <button
            className="iconButton"
            onClick={async () => {
              await initializeAudio()
              setFullscreenActiveId(output.id)
            }}
          >
            <span className="icon">fullscreen</span>
            <span className="tooltip">Fullscreen</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default memo(ModelOutput)
