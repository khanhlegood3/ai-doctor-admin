/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import {useEffect, useMemo, useRef, useState} from 'react'
import {use} from '../lib/store'
import {flatten} from 'lodash'
import Renderer from './Renderer'
import {setFeed, setScreensaverMode, setScreensaverSound} from '../lib/actions'
import {initializeAudio, playSound} from '../lib/useTonePalette'
import type {Output, Round} from '../lib/types'
import models from '../lib/models'
import {scrollToPosition} from '../lib/utils'

type Layout = {
  cols: number
  rows: number
}

export function Screensaver() {
  const feed = use.feed()
  const specialAllCollectionScreensaverMode = use.specialAllCollectionScreensaverMode()
  const [layout, setLayout] = useState<Layout>({cols: 2, rows: 2})
  const [items, setItems] = useState<(string | undefined)[]>([])
  const [windowSize, setWindowSize] = useState<{width: number; height: number}>(
    {
      width: 0,
      height: 0
    }
  )
  const controlsRef = useRef<HTMLDivElement>(null)
  const [isIdle, setIsIdle] = useState(false)
  const screensaverSound = use.screensaverSound()

  function closeScreensaver() {
    if (specialAllCollectionScreensaverMode) {
      setFeed([])
    }
    setScreensaverMode(false)
  }

  const idleTimeoutRef = useRef<number>(0)
  const idleSuspendedRef = useRef(false)
  useEffect(() => {
    function resetIdleTimer() {
      setIsIdle(false)
      if (idleSuspendedRef.current) return
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
      }
      idleTimeoutRef.current = window.setTimeout(() => {
        setIsIdle(true)
      }, 2000) // 3 seconds of inactivity
    }
    resetIdleTimer()

    function suspendIdleTimer() {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current)
      }
      idleSuspendedRef.current = true
      setIsIdle(false)
    }
    function resumeIdleTimer() {
      idleSuspendedRef.current = false
      resetIdleTimer()
    }

    controlsRef.current?.addEventListener('mouseenter', suspendIdleTimer)
    controlsRef.current?.addEventListener('mouseleave', resumeIdleTimer)

    window.addEventListener('mousemove', resetIdleTimer)
    window.addEventListener('mousedown', resetIdleTimer)
    window.addEventListener('touchstart', resetIdleTimer)
    window.addEventListener('scroll', resetIdleTimer)
  }, [])

  const flattenedFeed = useMemo(() => {
    if (!feed) return []
    return flatten(feed.map(round => Object.values(round.outputs)))
  }, [feed])

  const allLayouts = [
    {cols: 1, rows: 1},
    {cols: 1, rows: 2},
    {cols: 2, rows: 1},
    {cols: 2, rows: 2},
    {cols: 3, rows: 2}
  ]
  const layoutsRef = useRef(allLayouts)

  useEffect(() => {
    function handleResize() {
      setWindowSize({width: window.innerWidth, height: window.innerHeight})
    }
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    function filterLayouts() {
      const minColWidth = 400
      const minRowHeight = 400
      layoutsRef.current = allLayouts.filter(layout => {
        return (
          layout.cols * minColWidth <= windowSize.width &&
          layout.rows * minRowHeight <= windowSize.height
        )
      })
    }
    filterLayouts()
  }, [windowSize])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [])

  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const windowSizeRef = useRef(windowSize)
  useEffect(() => {
    windowSizeRef.current = windowSize
  }, [windowSize])

  const startVideoDelay = 200 // milliseconds
  const betweenVideosDelay = 0 // milliseconds
  const betweenLayoutsDelay = 2000 // milliseconds
  const timeoutRef = useRef<number | null>(null)
  const animationPromisesRef = useRef<
    Map<string, {resolve: () => void; promise: Promise<void>}>
  >(new Map())

  async function runLayout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    const possibleLayouts = layoutsRef.current.filter(layout => {
      if (layout.cols * layout.rows > flattenedFeed.length) return false
      return true
    })
    if (possibleLayouts.length === 0) {
      // No valid layout, try again later
      timeoutRef.current = window.setTimeout(() => {
        runLayout()
      }, 200)
      return
    }
    const randomLayout = possibleLayouts[
      Math.floor(Math.random() * layoutsRef.current.length)
    ] as Layout
    setLayout(randomLayout)
    const itemsNumber = randomLayout.cols * randomLayout.rows
    const _items = Array.from({length: itemsNumber}).map(_ => undefined)
    itemsRef.current = _items
    setItems(_items)
    animationPromisesRef.current.clear()

    async function fillSlot() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      const emptyIndexes = itemsRef.current
        .map((item, index) => (item === undefined ? index : -1))
        .filter(index => index !== -1)
      if (emptyIndexes.length === 0) {
        // All slots filled, wait for all animations to complete
        const allPromises = Array.from(
          animationPromisesRef.current.values()
        ).map(p => p.promise)
        await Promise.all(allPromises)

        // Wait betweenLayoutsDelay before starting new layout
        await new Promise(resolve => {
          timeoutRef.current = window.setTimeout(resolve, betweenLayoutsDelay)
        })

        document.querySelectorAll('.screensaver-item').forEach(el => {
          el.querySelectorAll('iframe').forEach(iframe => {
            ;(iframe as HTMLIFrameElement).style.display = 'none'
          })
        })
        runLayout()
        return
      }
      const randomIndex =
        emptyIndexes[Math.floor(Math.random() * emptyIndexes.length)]
      const newItems = [...itemsRef.current]
      const possibleItems = flattenedFeed.filter(
        output => !newItems.includes(output.id)
      )
      const selectedItemId =
        possibleItems[Math.floor(Math.random() * possibleItems.length)]!.id
      newItems[randomIndex!] = selectedItemId

      // Create a promise for this animation
      let resolveAnimation: () => void
      const animationPromise = new Promise<void>(resolve => {
        resolveAnimation = resolve
      })
      animationPromisesRef.current.set(selectedItemId, {
        resolve: resolveAnimation!,
        promise: animationPromise
      })

      setItems(newItems)

      // Wait for this animation to complete before filling next slot
      await animationPromise

      // Wait betweenVideosDelay before filling next slot
      await new Promise(resolve => {
        timeoutRef.current = window.setTimeout(resolve, betweenVideosDelay)
      })

      fillSlot()
    }

    setTimeout(() => fillSlot(), startVideoDelay)
  }

  const runOnceRef = useRef(false)
  useEffect(() => {
    if (runOnceRef.current) return
    runLayout()
  }, [])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeScreensaver()
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [])

  return (
    <div
      className="fixed text-white fullscreen inset-0 bg-black z-300 grid"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${layout.rows}, 1fr)`
      }}
    >
      {items.map((item, index) => {
        if (item) {
          const activeOutput = flattenedFeed.find(output => output.id === item)!
          const activeRound = feed!.find(round =>
            Object.values(round.outputs).some(output => output.id === item)
          )!
          return (
            <div
              key={index}
              className="screensaver-item pointer-events-none bg-black w-full h-full relative overflow-hidden"
            >
              <AnimateTile
                activeOutput={activeOutput}
                activeRound={activeRound}
                onAnimationComplete={() => {
                  const promiseEntry = animationPromisesRef.current.get(item)
                  if (promiseEntry) {
                    promiseEntry.resolve()
                  }
                }}
              />
            </div>
          )
        } else {
          return <div key={index} className="w-full h-full bg-black"></div>
        }
      })}
      {/* controls */}
      <div
        ref={controlsRef}
        className="absolute left-1/2 -translate-x-1/2 bottom-8 z-300 transition-opacity duration-300"
        style={{
          opacity: isIdle ? 0 : 1,
          pointerEvents: isIdle ? 'none' : 'auto'
        }}
      >
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 rounded-lg p-2">
          <button
            className="flex items-center gap-2 px-3 py-1.5 rounded-full"
            onClick={() => {
              initializeAudio()
              setScreensaverSound(!screensaverSound)
            }}
          >
            <span className="icon text-base text-white">
              {screensaverSound ? 'check_box' : 'check_box_outline_blank'}
            </span>
            <span className="text-sm select-none text-white">Sound</span>
          </button>
          <button
            className="iconButton"
            onClick={() => {
              closeScreensaver()
            }}
          >
            <span className="icon">close</span>
            <span className="tooltip">Close screensaver</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export function AnimateTile({
  activeOutput,
  activeRound,
  onAnimationComplete
}: {
  activeOutput: Output
  activeRound: Round
  onAnimationComplete?: () => void
}) {
  const fullscreenSound = true
  const [showRender, setShowRender] = useState(false)
  const [showTypeLabel, setShowTypeLabel] = useState(false)
  const screensaverSound = use.screensaverSound()

  const fullScreenSoundRef = useRef(fullscreenSound)
  useEffect(() => {
    fullScreenSoundRef.current = fullscreenSound
  }, [fullscreenSound])

  const screensaverSoundRef = useRef(true)
  useEffect(() => {
    screensaverSoundRef.current = screensaverSound
  }, [screensaverSound])

  const promptElRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<number>(0)
  const intervalRef = useRef<number>(0)
  function doAnimatePrompt(round: Round): Promise<void> {
    return new Promise(resolve => {
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = window.setTimeout(() => {
          if (!promptElRef.current) {
            resolve()
            return
          }
          promptElRef.current.innerText = '▮'
          setShowTypeLabel(true)
          let index = 0
          intervalRef.current = window.setInterval(() => {
            if (!promptElRef.current) return
            if (screensaverSoundRef.current) {
              playSound('TYPING')
            }
            promptElRef.current.innerText = round.prompt.slice(0, index) + '​▮'
            index++
            if (index > round.prompt.length) {
              promptElRef.current.innerText = round.prompt
              timeoutRef.current = window.setTimeout(() => {
                setShowTypeLabel(false)
                promptElRef.current!.innerText = ''
                setShowRender(true)
                if (screensaverSoundRef.current) {
                  playSound('SUCCESS')
                }
                resolve()
              }, 600)
              clearInterval(intervalRef.current)
            }
          }, 50)
        }, 200)
      }, 200)
    })
  }

  const codeTimeoutRef = useRef<number>(0)
  const codeIntervalRef = useRef<number>(0)

  const codeRef = useRef<HTMLDivElement>(null)

  async function doAnimateCode(): Promise<void> {
    return new Promise(resolve => {
      if (!codeRef.current) {
        resolve()
        return
      }
      clearTimeout(codeTimeoutRef.current)
      clearInterval(codeIntervalRef.current)
      codeRef.current!.style.display = 'block'
      codeRef.current.innerText = activeOutput.srcCode || ''
      codeTimeoutRef.current = window.setTimeout(async () => {
        await scrollToPosition(
          codeRef.current!,
          codeRef.current!.scrollHeight,
          2000
        )
        codeTimeoutRef.current = window.setTimeout(() => {
          codeRef.current!.style.display = 'none'
          codeRef.current!.innerHTML = ''
          resolve()
        }, 200)
      }, 200)
    })
  }

  const runOnceRef = useRef(false)
  useEffect(() => {
    if (!promptElRef.current) return
    if (!runOnceRef.current) {
      runOnceRef.current = true
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
      promptElRef.current.innerHTML = ''
      async function runAnimationSequence() {
        await doAnimatePrompt(activeRound)
        await doAnimateCode()
        onAnimationComplete?.()
      }
      runAnimationSequence()
    }
  }, [])

  useEffect(() => {
    return () => {
      // clearTimeout(timeoutRef.current)
      clearInterval(intervalRef.current)
      clearTimeout(codeTimeoutRef.current)
      clearInterval(codeIntervalRef.current)
    }
  }, [])

  return (
    <div className="absoute overflow-hidden inset-0 bg-black flex flex-col">
      <div className="absolute inset-0 overflow-hidden">
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
          className="absolute overflow-hidden pointer-events-none z-10 py-1 px-3 inset-0 whitespace-pre-wrap"
          style={{
            fontSize: 12,
            lineHeight: 1.4
          }}
        ></div>
      </div>
      {showTypeLabel && <Info activeOutput={activeOutput} />}
      <div className="relative w-full shrink-0 px-[28px]">
        <div className="w-full flex items-center justify-start overflow-hidden relative">
          <div
            ref={promptElRef}
            className={`text-[42px] line-clamp-6`}
            style={{
              lineHeight: '1.1em'
            }}
          ></div>
        </div>
      </div>
    </div>
  )
}

function Info({activeOutput}: {activeOutput: Output}) {
  const typeMap = {
    p5: 'P5.JS',
    three: 'THREE.JS',
    glsl: 'SHADER',
    svg: 'SVG',
    html: 'HTML'
  }

  return (
    <div
      className={`w-full relative pt-8 px-6 pb-2 flex items-center gap-3 text-white`}
    >
      <div className="flex">
        <div className="border border-neutral-400 rounded-full px-4 py-1 text-sm select-none pointer-events-none uppercase">
          {typeMap[activeOutput.mode as keyof typeof typeMap] ||
            activeOutput.mode}
        </div>
      </div>
      <div className="text-[14px] flex gap-4">
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
