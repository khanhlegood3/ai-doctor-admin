/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useEffect, useMemo, useRef, useState} from 'react'
import {use} from '../lib/store'
import Renderer from './Renderer'
import {
  setFullscreenActiveId,
  setFullscreenAnimate,
  setFullscreenShowCode,
  setFullscreenSound
} from '../lib/actions'
import {flatten} from 'lodash'
import models from '../lib/models'
import type {Output, Round} from '../lib/types'
import {initializeAudio, playSound} from '../lib/useTonePalette'

export function FullscreenOverlay() {
  const feed = use.feed()
  const fullscreenAnimate = use.fullscreenAnimate()
  const fullscreenActiveId = use.fullscreenActiveId()
  const fullscreenShowCode = use.fullscreenShowCode()
  const fullscreenSound = use.fullScreenSound()
  const controlsRef = useRef<HTMLDivElement>(null)
  const [aspectRatio, setAspectRatio] = useState(1)
  const [showRender, setShowRender] = useState(false)
  const [showTypeLabel, setShowTypeLabel] = useState(false)
  const [showControls, setShowControls] = useState(true)

  useEffect(() => {
    function updateAspectRatio() {
      setAspectRatio(window.innerWidth / window.innerHeight)
    }
    updateAspectRatio()
    window.addEventListener('resize', updateAspectRatio)
    return () => {
      window.removeEventListener('resize', updateAspectRatio)
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = fullscreenActiveId ? 'hidden' : 'auto'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [fullscreenActiveId])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setFullscreenActiveId(null)
      } else if (e.key === 'ArrowRight') {
        const next = nextOutput()
        if (next) {
          setFullscreenActiveId(next.id)
        }
      } else if (e.key === 'ArrowLeft') {
        const prev = prevOutput()
        if (prev) {
          setFullscreenActiveId(prev.id)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [feed, fullscreenActiveId])

  if (!fullscreenActiveId) return null
  const [activeOutput, activeRound] = useMemo(() => {
    let _activeRound = null
    let _activeOutput = null
    for (const round of feed) {
      for (const outputId of Object.keys(round.outputs)) {
        if (outputId === fullscreenActiveId) {
          _activeRound = round
          _activeOutput = round.outputs[outputId]
          break
        }
      }
      if (_activeOutput) break
    }
    return [_activeOutput, _activeRound]
  }, [feed, fullscreenActiveId])

  if (!activeOutput || !activeRound) return null

  const flattenedOutputs = flatten(
    feed.map(round => Object.values(round.outputs))
  )

  function nextOutput() {
    const currentIndex = flattenedOutputs.findIndex(
      o => o.id === activeOutput!.id
    )
    if (currentIndex === -1) return null
    const nextIndex = (currentIndex + 1) % flattenedOutputs.length
    return flattenedOutputs[nextIndex]
  }

  function prevOutput() {
    const currentIndex = flattenedOutputs.findIndex(
      o => o.id === activeOutput!.id
    )
    if (currentIndex === -1) return null
    const prevIndex =
      (currentIndex - 1 + flattenedOutputs.length) % flattenedOutputs.length
    return flattenedOutputs[prevIndex]
  }

  const fullScreenSoundRef = useRef(fullscreenSound)
  useEffect(() => {
    fullScreenSoundRef.current = fullscreenSound
  }, [fullscreenSound])

  const promptElRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number>(0)
  const intervalRef = useRef<number>(0)
  function doAnimatePrompt(round: Round) {
    timeoutRef.current = window.setTimeout(() => {
      if (!promptElRef.current) return
      promptElRef.current.innerText = '▮'
      let index = 0
      intervalRef.current = window.setInterval(() => {
        if (!promptElRef.current) return
        if (fullScreenSoundRef.current) {
          playSound('TYPING')
        }
        promptElRef.current.innerText = round.prompt.slice(0, index) + '​▮'
        index++
        if (index > round.prompt.length) {
          promptElRef.current.innerText = round.prompt
          setTimeout(() => {
            setShowTypeLabel(true)
          }, 100)
          timeoutRef.current = window.setTimeout(() => {
            setShowRender(true)
            if (fullScreenSoundRef.current) {
              playSound('SUCCESS')
            }
            if (fullscreenShowCode) {
              codeTimeoutRef.current = window.setTimeout(() => {
                doAnimateCode()
              }, 0)
            }
          }, 250)
          clearInterval(intervalRef.current)
        }
      }, 50)
    }, 200)
  }

  const codeTimeoutRef = useRef<number>(0)
  const codeIntervalRef = useRef<number>(0)

  const codeRef = useRef<HTMLDivElement>(null)

  // New transition animate code
  async function doAnimateCode() {
    if (!codeRef.current) return
    clearTimeout(codeTimeoutRef.current)
    clearInterval(codeIntervalRef.current)
    codeRef.current!.style.display = 'block'
    codeRef.current.innerHTML = ''
    let index = 0
    const lines = codeTranscript.split('\n')
    codeTimeoutRef.current = window.setTimeout(() => {
      codeIntervalRef.current = window.setInterval(async () => {
        if (!codeRef.current) return
        codeRef.current.innerHTML = lines.slice(0, index).join('\n')
        index++
        if (index > lines.length) {
          clearInterval(codeIntervalRef.current)
          codeRef.current.innerHTML = lines.join('\n')
        }
      }, 5)
      codeTimeoutRef.current = window.setTimeout(() => {
        codeRef.current!.style.display = 'none'
        codeRef.current!.innerHTML = ''
      }, 2000)
    }, 0)
  }

  const fullscreenActiveIdRef = useRef('a-b-c-d')
  useEffect(() => {
    if (!promptElRef.current) return
    if (fullscreenActiveIdRef.current !== fullscreenActiveId) {
      // handle exit
      promptElRef.current.innerHTML = ''
      clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
      setShowRender(false)
      setShowTypeLabel(false)
      codeRef.current!.style.display = 'none'
      codeRef.current!.innerHTML = ''
      clearTimeout(codeTimeoutRef.current)
      clearInterval(codeIntervalRef.current)

      // handle entrance
      if (fullscreenAnimate) {
        promptElRef.current.innerHTML = ''
        doAnimatePrompt(activeRound)
      } else {
        if (fullScreenSoundRef.current) {
          playSound('SUCCESS')
        }
        promptElRef.current.innerHTML = activeRound?.prompt || ''
        setShowRender(true)
        setShowTypeLabel(true)
        if (fullscreenShowCode) {
          codeRef.current!.style.display = 'block'
          codeRef.current!.innerHTML = codeTranscript
        }
      }
      fullscreenActiveIdRef.current = fullscreenActiveId
    }
  }, [fullscreenActiveId, fullscreenAnimate, fullscreenShowCode])

  useEffect(() => {
    return () => {
      // clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
      clearTimeout(codeTimeoutRef.current)
      clearInterval(codeIntervalRef.current)
    }
  }, [])

  const fullscreenShowCodeRef = useRef(fullscreenShowCode)
  useEffect(() => {
    if (fullscreenShowCodeRef.current !== fullscreenShowCode) {
      // only handle when toggled
      fullscreenShowCodeRef.current = fullscreenShowCode
      if (fullscreenShowCode) {
        if (fullscreenAnimate) {
          doAnimateCode()
        } else {
          codeRef.current!.style.display = 'block'
          codeRef.current!.innerHTML = codeTranscript
        }
      } else {
        codeRef.current!.style.display = 'none'
        codeRef.current!.innerHTML = ''
        clearTimeout(codeTimeoutRef.current)
        clearInterval(codeIntervalRef.current)
      }
    }
  }, [fullscreenShowCode, fullscreenAnimate])

  const isNarrow = aspectRatio < 1.25
  const rendererStyles = isNarrow
    ? 'relative w-full grow'
    : 'absolute left-3/8 w-5/8 h-full'

  const codeTranscript = `
<strong>System Instructions:</strong>

${activeRound?.systemInstructions}


<strong>User:</strong>

${activeRound?.prompt}


<strong>Model:</strong>

${activeOutput?.srcCode.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}`

  // scale fontSize based on prompt length
  const fontMin = 28
  const fontMax = 48
  const promptLength = activeRound?.prompt.length || 0
  const smallBreakpoint = 16
  const largeBreakpoint = 48
  const fontSize =
    promptLength < smallBreakpoint
      ? fontMax
      : promptLength > largeBreakpoint
        ? fontMin
        : fontMax -
          ((promptLength - smallBreakpoint) /
            (largeBreakpoint - smallBreakpoint)) *
            (fontMax - fontMin)
  const fontFinal = Math.max(fontMin, Math.min(fontMax, fontSize))

  // scale lineHeight based on prompt length
  const minLineHeight = 1.1
  const maxLineHeight = 1.3
  const lineHeight =
    promptLength < smallBreakpoint
      ? minLineHeight
      : promptLength > largeBreakpoint
        ? maxLineHeight
        : minLineHeight +
          ((promptLength - smallBreakpoint) /
            (largeBreakpoint - smallBreakpoint)) *
            (maxLineHeight - minLineHeight)

  return (
    <>
      <div className="text-white fullscreen fixed overflow-hidden inset-0 bg-black z-300 flex flex-col">
        <div
          className="w-full shrink-0 px-[36px]"
          style={{
            width: isNarrow ? '100%' : '37.5%'
          }}
        >
          <div
            className="w-full py-[20px] flex items-center justify-start overflow-hidden relative"
            style={{
              height: isNarrow ? 52 * 2 + 40 : 52 * 6 + 40
            }}
          >
            <div
              ref={promptElRef}
              className={`${isNarrow ? 'line-clamp-2' : 'line-clamp-6'}`}
              style={{
                fontSize: fontFinal,
                lineHeight
              }}
            ></div>
          </div>
        </div>
        <div className={`${rendererStyles}`}>
          <div
            className="w-full h-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center overflow-hidden"
            style={{
              aspectRatio: isNarrow ? '4/3' : undefined,
              height: isNarrow ? 'auto' : '100%',
              maxHeight: '100%'
            }}
          >
            <div className="absolute inset-0">
              {showRender && (
                <div className="absolute -inset-0.5">
                  <Renderer
                    mode={activeOutput.mode}
                    code={activeOutput.srcCode}
                    isFullscreen={true}
                  />
                </div>
              )}
              <div
                ref={codeRef}
                className="absolute pointer-events-auto z-10 overflow-auto py-1 px-3 inset-0 whitespace-pre-wrap"
                style={{
                  fontSize: 12,
                  lineHeight: 1.4
                }}
              >
                <div dangerouslySetInnerHTML={{__html: codeTranscript}}></div>
              </div>
            </div>
          </div>
        </div>
        {showTypeLabel && (
          <Info activeOutput={activeOutput} isNarrow={isNarrow} />
        )}
        {!showControls ? (
          <div
            className="absolute bottom-[14px] left-1/2 -translate-1/2 border border-neutral-400 rounded-full w-8 h-8 text-sm select-none  uppercase flex items-center justify-center cursor-pointer"
            onClick={() => setShowControls(!showControls)}
            style={{fontSize: 16}}
          >
            <span className="icon">keyboard_arrow_up</span>
          </div>
        ) : null}
        {/* controls */}
        <div
          ref={controlsRef}
          className="fullscreen-controls absolute left-1/2 -translate-x-1/2 bottom-8 z-300 transition-opacity duration-300 flex items-center gap-4"
          style={{
            opacity: showControls ? 1 : 0,
            pointerEvents: showControls ? 'auto' : 'none'
          }}
        >
          <button
            className="iconButton"
            onClick={() => {
              const prev = prevOutput()
              if (prev) {
                setFullscreenActiveId(prev.id)
              }
            }}
          >
            <span className="icon">arrow_back</span>
            <span className="tooltip">Previous</span>
          </button>
          <div className="flex flex-col items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg p-2">
            <div className="flex items-center gap-2">
              <button
                className="iconButton"
                onClick={() => {
                  setShowControls(false)
                }}
              >
                <span className="icon">keyboard_arrow_down</span>
                <span className="tooltip">Hide controls</span>
              </button>
              <button
                className="iconButton"
                onClick={() => {
                  setFullscreenActiveId(null)
                }}
              >
                <span className="icon">close</span>
                <span className="tooltip">Close fullscreen</span>
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                onClick={() => {
                  setFullscreenAnimate(!fullscreenAnimate)
                }}
              >
                <span className="icon text-base">
                  {fullscreenAnimate ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span className="text-sm select-none">Animate</span>
              </button>
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                onClick={() => {
                  setFullscreenShowCode(!fullscreenShowCode)
                }}
              >
                <span className="icon text-base">
                  {fullscreenShowCode ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span className="text-sm select-none">Code</span>
              </button>
              <button
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                onClick={() => {
                  initializeAudio()
                  setFullscreenSound(!fullscreenSound)
                }}
              >
                <span className="icon text-base">
                  {fullscreenSound ? 'check_box' : 'check_box_outline_blank'}
                </span>
                <span className="text-sm select-none text-white">Sound</span>
              </button>
            </div>
          </div>
          <button
            className="iconButton"
            onClick={() => {
              const next = nextOutput()
              if (next) {
                setFullscreenActiveId(next.id)
              }
            }}
          >
            <span className="icon">arrow_forward</span>
            <span className="tooltip">Next</span>
          </button>
        </div>
      </div>
    </>
  )
}

function Info({
  activeOutput,
  isNarrow
}: {
  activeOutput: Output
  isNarrow: boolean
}) {
  const typeMap = {
    p5: 'P5.JS',
    three: 'THREE.JS',
    glsl: 'SHADER',
    svg: 'SVG',
    html: 'HTML'
  }

  const aspectStyles = isNarrow
    ? 'justify-between relative'
    : 'flex-col gap-4 items-start absolute bottom-0 w-3/8'

  return (
    <div
      className={`pb-[34px] pt-[20px] shrink-0 left-0 w-full px-8 flex items-center ${aspectStyles}`}
    >
      <div className="flex">
        <div className="border border-neutral-400 rounded-full px-4 py-1 text-sm select-none pointer-events-none uppercase">
          {typeMap[activeOutput.mode as keyof typeof typeMap] ||
            activeOutput.mode}
        </div>
      </div>
      <div className="text-[14px] flex gap-4 items-center">
        <div>
          Gemini {models[activeOutput.model]?.version}{' '}
          {models[activeOutput.model]?.name}
        </div>
        {activeOutput.totalTime ? (
          <div className="">
            {((activeOutput.totalTime || 0) / 1000).toFixed(1)}s
          </div>
        ) : null}
      </div>
    </div>
  )
}
