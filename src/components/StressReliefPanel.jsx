import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Hand } from 'lucide-react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext.jsx'
import TouchlessHandCam from './webcam/TouchlessHandCam.jsx'
import { classifyGestureKey, expandUser1GestureKeys, GESTURE_KEY_LABELS } from './webcam/gestureToKey.js'

const STRESS_RELIEF_URL = 'https://castle.xyz/d/t8p9l7o0N'
const CUSTOM_GAMES_KEY = 'stress_relief_custom_games'
const HOLD_FRAMES_TO_ACTIVATE = 3
const HOLD_FRAMES_TO_RELEASE = 5

const DEFAULT_GAMES = [
  {
    id: 'patienthelperz01',
    caption: 'patienthelperz01',
    captionEn: 'Siêu Anh Hùng đau chỗ nào gửi kết quả Online trước',
    src: 'https://patienthelperz01.framer.website/',
  },
  {
    id: 'patienthelperxrcc',
    caption: 'https://portal.xrcc.events/hackathon/XRCC_26/project/ac7f951f-d453-4e77-b413-634e8254b3b4',
    captionEn: '3D Siêu Anh Hùng đau chỗ nào gửi kết quả Online trước',
    src: 'https://pain-path.vercel.app/',
  },
  {
    id: 'medconnect',
    caption: 'medconnect',
    captionEn: '3D xr hướng dẫn sử dụng thuốc',
    src: 'https://medconnect-xr.netlify.app/',
  },
  {
    id: 'knight',
    caption: 'Game Knight Platformer với Khánh',
    captionEn: 'Knight Platformer Game',
    src: 'https://game-ticker-knight-khanh.vercel.app',
  },
  {
    id: 'captain',
    caption: 'Khánh đa vũ trụ Game',
    captionEn: 'Captain Khanh Game',
    src: 'https://captain-khanh-game.vercel.app/',
  },
  {
    id: 'angrybird',
    caption: 'Angry Bird Game',
    captionEn: 'Angry Bird Khanh Game',
    src: 'https://angry-bird-nft-khanh.vercel.app/',
  },
  {
    id: 'ASCII',
    caption: 'ASCII Media',
    captionEn: 'ASCII Khanh Media',
    src: 'https://glyphstream.framer.website/',
  },
  {
    id: 'ASCII2',
    caption: 'ASCII2 Media',
    captionEn: 'ASCII2 Khanh Media',
    src: 'https://simplest-pepper-794964.framer.app/studio',
  },
  {
    id: 'soundofyourname',
    caption: 'soundofyourname Media',
    captionEn: 'soundofyourname Khanh Media',
    src: 'https://soundofyourname.framer.website/',
  },
  {
    id: 'CHOICE',
    caption: 'CHOICE Funny AI report',
    captionEn: 'Khám phá tính cách cá nhân của bạn',
    src: 'https://professional-report-707776.framer.app/',
  },
  {
    id: 'Rubik',
    caption: 'neon Rubik cube',
    captionEn: 'Cách giải lật Rubik CUBE 3D',
    src: 'https://lovable-track-707836.framer.app/',
  },
  {
    id: 'star',
    caption: 'my star',
    captionEn: 'Cách tạo bầu trời riêng của bạn',
    src: 'https://caelara.framer.website/',
  },
  {
    id: 'type',
    caption: 'speed type LEADERBOARD',
    captionEn: 'Đánh máy chữ siêu tốc độ',
    src: 'https://type-invaders-by-eric-kimani.framer.website/',
  },
  {
    id: 'strange',
    caption: 'star strange',
    captionEn: 'Khám phá các hành tinh',
    src: 'https://strange-tenure-258776.framer.app/',
  },
  {
    id: 'shipitnow',
    caption: 'shipitnow',
    captionEn: 'Khám phá các hành tinh framer',
    src: 'https://shipitnow.framer.website/',
  },
  {
    id: 'spendmoney',
    caption: 'spendilonsmoney',
    captionEn: 'Khám phá cách xài tiền',
    src: 'https://spendilonsmoney.framer.website/',
  },
  {
    id: 'nekopedia',
    caption: 'nekopedia',
    captionEn: 'Khám phá thế giới mèo',
    src: 'https://nekopedia.framer.ai/',
  },
  {
    id: 'mixer',
    caption: 'key-role',
    captionEn: 'Khám phá thế giới hỗn tạp âm thanh',
    src: 'https://key-role-470759.framer.app/',
  },
  {
    id: 'distinct',
    caption: 'mic-role',
    captionEn: 'Khám phá thế giới 3D âm thanh',
    src: 'https://distinct-article-782574.framer.app/',
  },
  {
    id: 'text',
    caption: 'text-shader',
    captionEn: 'Khám phá thế giới 3D chữ viết',
    src: 'https://text-shader.framer.ai/',
  },
  {
    id: 'framemon',
    caption: 'framemon',
    captionEn: 'Khám phá thế giới 3D framemon',
    src: 'https://framemon.framer.website/',
  },
  {
    id: 'LightLife',
    caption: 'Light to Life',
    captionEn: 'Khám phá thế giới điện Light to Life',
    src: 'https://spiky-line-352679.framer.app/',
  },
  {
    id: 'horse',
    caption: 'a fully playable horse with 1-3 AI players',
    captionEn: 'Cờ cá ngựa với AI',
    src: 'https://delicate-behaviors-350621.framer.app/',
  },
  {
    id: 'simulator',
    caption: 'simulator 3D by hand',
    captionEn: 'Làm đồ gốm sứ bằng camera',
    src: 'https://pottery-simulator.framer.website/',
  },
  {
    id: 'football',
    caption: 'a fully playable football penalty with an intelligent AI goalkeeper.',
    captionEn: 'Đá phạt đền với AI',
    src: 'https://shy-color-507920.framer.app/',
  },
  {
    id: 'castle',
    caption: 'Không gian thở chậm – Vui vẻ',
    captionEn: 'Focus Breathing Space – Funny',
    src: STRESS_RELIEF_URL,
    hasMask: true,
  },
]

const ICONS = ['🚶', '🧠', '💊', '🕹️', '🚀', '🐦', 'ASCII', '🪈', '🥁', '🧠', 'Rubik🎲', '🌟', '🏆', 'moon', 'ship', '✈️', '🐈', 'mixer', '🎤', 'text', '🙌', '✨', '🎮', '🏞', '⚽', '🌿']

function loadCustomGames() {
  try {
    const raw = localStorage.getItem(CUSTOM_GAMES_KEY)
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(g => g?.caption && g?.src) : []
  } catch {
    return []
  }
}

function saveCustomGames(games) {
  localStorage.setItem(CUSTOM_GAMES_KEY, JSON.stringify(games))
}

export default function StressReliefPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()
  const [customGames, setCustomGames] = useState(loadCustomGames)
  const [selectedId, setSelectedId] = useState(DEFAULT_GAMES[0].id)
  const [draftCaption, setDraftCaption] = useState('')
  const [draftLink, setDraftLink] = useState('')
  const [saveStatus, setSaveStatus] = useState(null)
  const [gestureOn, setGestureOn] = useState(false)
  const [activeGestureKey, setActiveGestureKey] = useState(null)

  const iframeRef = useRef(null)
  const activeKeysRef = useRef([])
  const pendingRef = useRef({ key: null, count: 0 })
  const handMappingRef = useRef({ mirrored: true, facingMode: 'user' })

  const allGames = [...DEFAULT_GAMES, ...customGames]
  const selectedGame = allGames.find(g => g.id === selectedId) || allGames[0]
  const isDraftValid = draftCaption.trim().length > 0 && /^https?:\/\//i.test(draftLink.trim())



  const dispatchKeyboardEvent = useCallback((targetWindow, type, key) => {
    if (!targetWindow || !key) return
    const eventInit = {
      key,
      code: key === ' ' ? 'Space' : key,
      bubbles: true,
      cancelable: true,
    }
    try {
      targetWindow.dispatchEvent(new KeyboardEvent(type, eventInit))
      targetWindow.document?.dispatchEvent?.(new KeyboardEvent(type, eventInit))
    } catch (err) {
      // Cross-origin games may reject direct document access. The parent window
      // still receives the event, and same-origin games also receive setKey().
      if (type === 'keydown') console.debug('[StressReliefPanel] Không gửi được phím vào iframe cross-origin:', err)
    }
  }, [])

  const sendGestureKeys = useCallback((gestureKey, isDown) => {
    const keys = expandUser1GestureKeys(gestureKey)
    const eventType = isDown ? 'keydown' : 'keyup'
    keys.forEach((key) => {
      dispatchKeyboardEvent(window, eventType, key)
      const gameWindow = iframeRef.current?.contentWindow
      dispatchKeyboardEvent(gameWindow, eventType, key)
      try {
        gameWindow?.setKey?.(key, isDown)
      } catch {
        // Ignore cross-origin frames; keyboard events above are best-effort.
      }
    })
    activeKeysRef.current = isDown ? keys : []
  }, [dispatchKeyboardEvent])

  const releaseActiveGestureKeys = useCallback(() => {
    activeKeysRef.current.forEach((key) => {
      dispatchKeyboardEvent(window, 'keyup', key)
      dispatchKeyboardEvent(iframeRef.current?.contentWindow, 'keyup', key)
      try { iframeRef.current?.contentWindow?.setKey?.(key, false) } catch {}
    })
    activeKeysRef.current = []
    pendingRef.current = { key: null, count: 0 }
    setActiveGestureKey(null)
  }, [dispatchKeyboardEvent])

  const handleHandMappingChange = useCallback((nextMapping) => {
    handMappingRef.current = nextMapping
  }, [])

  const handleHandTrack = useCallback((landmarksArr) => {
    const hand = landmarksArr?.[0]
    const candidate = classifyGestureKey(hand, { mirrored: handMappingRef.current.mirrored })
    const pending = pendingRef.current

    if (candidate === pending.key) pending.count += 1
    else {
      pending.key = candidate
      pending.count = 1
    }

    const threshold = candidate ? HOLD_FRAMES_TO_ACTIVATE : HOLD_FRAMES_TO_RELEASE
    if (pending.count < threshold || candidate === activeGestureKey) return

    if (activeGestureKey) sendGestureKeys(activeGestureKey, false)
    if (candidate) sendGestureKeys(candidate, true)
    setActiveGestureKey(candidate)
  }, [activeGestureKey, sendGestureKeys])

  const handleHandLost = useCallback(() => {
    releaseActiveGestureKeys()
  }, [releaseActiveGestureKeys])

  useEffect(() => {
    if (!gestureOn) releaseActiveGestureKeys()
  }, [gestureOn, releaseActiveGestureKeys])

  useEffect(() => () => releaseActiveGestureKeys(), [releaseActiveGestureKeys])

  function handleAddGame() {
    const caption = draftCaption.trim()
    const src = draftLink.trim()
    if (!caption || !/^https?:\/\//i.test(src)) {
      setSaveStatus({ type: 'error', message: 'Vui lòng nhập Caption và Link hợp lệ (bắt đầu bằng http:// hoặc https://).' })
      return
    }
    const dup = customGames.find(g => g.src === src)
    if (dup) {
      setSaveStatus({ type: 'error', message: `Link này đã tồn tại: "${dup.caption}".` })
      return
    }
    const newGame = { id: `custom_${Date.now()}`, caption, captionEn: caption, src }
    const updated = [...customGames, newGame]
    setCustomGames(updated)
    saveCustomGames(updated)
    setDraftCaption('')
    setDraftLink('')
    setSelectedId(newGame.id)
    setSaveStatus({ type: 'success', message: `Đã lưu game "${caption}" vào danh sách!` })
    setTimeout(() => setSaveStatus(null), 3000)
  }

  function handleDeleteCustom(id) {
    const updated = customGames.filter(g => g.id !== id)
    setCustomGames(updated)
    saveCustomGames(updated)
    if (selectedId === id) setSelectedId(DEFAULT_GAMES[0].id)
    setSaveStatus({ type: 'success', message: 'Đã xoá game khỏi danh sách.' })
    setTimeout(() => setSaveStatus(null), 2500)
  }

  return (
    <div className="animate-fade stress-relief-page" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, minHeight: 'calc(100vh - 96px)' }}>
      <style>{`
        .stress-relief-frame-card {
          position: relative;
          flex: 1;
          min-height: clamp(560px, 74vh, 920px);
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: #05070d;
          box-shadow: 0 24px 80px rgba(0,0,0,0.24);
        }
        .stress-relief-frame {
          width: 100%;
          height: 100%;
          min-height: clamp(560px, 74vh, 920px);
          border: 0;
          display: block;
        }
        .stress-relief-mask {
          position: absolute;
          left: max(8px, env(safe-area-inset-left));
          right: max(8px, env(safe-area-inset-right));
          z-index: 2;
          pointer-events: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: rgba(255,255,255,0.92);
          border: 1px solid rgba(255,255,255,0.16);
          background: linear-gradient(135deg, rgba(4,9,19,0.96), rgba(0,88,188,0.86));
          box-shadow: 0 18px 46px rgba(0,0,0,0.34);
          backdrop-filter: blur(18px);
        }
        .stress-relief-mask::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 18% 45%, rgba(131,247,255,0.34), transparent 32%), radial-gradient(circle at 82% 52%, rgba(104,211,145,0.20), transparent 34%);
        }
        .stress-relief-mask span {
          position: relative;
          z-index: 1;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          border: 1px solid rgba(255,255,255,0.18);
          font-size: 12px;
          font-weight: 900;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .stress-relief-mask-top {
          top: 8px;
          height: clamp(54px, 7.5vw, 82px);
          border-radius: 16px 16px 28px 28px;
        }
        .stress-relief-mask-bottom {
          bottom: 8px;
          height: clamp(64px, 8.6vw, 102px);
          border-radius: 28px 28px 16px 16px;
        }
        .sr-game-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .sr-game-list-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface2);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          position: relative;
          user-select: none;
        }
        .sr-game-list-item:hover {
          border-color: rgba(0,229,255,0.35);
          background: rgba(0,229,255,0.05);
        }
        .sr-game-list-item.active {
          border-color: rgba(0,229,255,0.6);
          background: rgba(0,229,255,0.10);
          box-shadow: 0 0 0 2px rgba(0,229,255,0.18);
        }
        .sr-game-badge {
          width: 30px;
          height: 30px;
          min-width: 30px;
          border-radius: 8px;
          background: rgba(0,229,255,0.12);
          border: 1px solid rgba(0,229,255,0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 15px;
        }
        .sr-game-list-item.active .sr-game-badge {
          background: rgba(0,229,255,0.22);
          border-color: rgba(0,229,255,0.5);
        }
        .sr-game-caption {
          font-size: 12px;
          font-weight: 700;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
          min-width: 0;
        }
        .sr-game-list-item.active .sr-game-caption { color: var(--cyan); }
        .sr-game-url {
          font-size: 9px;
          color: var(--text3);
          margin-top: 2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sr-active-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--cyan);
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(0,229,255,0.7);
        }
        .sr-delete-btn {
          background: none;
          border: none;
          color: var(--text3);
          cursor: pointer;
          font-size: 14px;
          padding: 2px 5px;
          border-radius: 6px;
          transition: color 0.15s;
          flex-shrink: 0;
          z-index: 1;
        }
        .sr-delete-btn:hover { color: #ff6b6b; }
        .sr-add-input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--surface2);
          color: var(--text);
          padding: 11px 13px;
          font-family: inherit;
          font-size: 12px;
          box-sizing: border-box;
        }
        .sr-add-input:focus { outline: none; border-color: rgba(0,229,255,0.4); }
        .sr-add-btn {
          width: 100%;
          border-radius: 12px;
          padding: 11px 12px;
          font-family: inherit;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
          box-sizing: border-box;
        }
        .sr-now-playing {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 10px;
          background: rgba(0,229,255,0.07);
          border: 1px solid rgba(0,229,255,0.18);
          font-size: 11px;
          font-weight: 700;
          color: var(--cyan);
          margin-bottom: 4px;
        }
        @media (max-width: 760px) {
          .stress-relief-page { padding: 14px !important; }
          .stress-relief-frame-card, .stress-relief-frame { min-height: 70vh; }
          .stress-relief-mask { left: 6px; right: 6px; }
          .stress-relief-mask-top { top: 6px; height: 58px; border-radius: 14px 14px 22px 22px; }
          .stress-relief-mask-bottom { bottom: 6px; height: 76px; border-radius: 22px 22px 14px 14px; }
          .stress-relief-mask span { font-size: 10px; padding: 6px 10px; }
          .sr-game-list { grid-template-columns: 1fr; gap: 8px; }
          .sr-game-caption { font-size: 11px; }
          .sr-add-input { font-size: 11px; padding: 10px 11px; }
          .sr-add-btn { font-size: 11px; padding: 10px 12px; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0 }}>
            {lang === 'en' ? 'Stress Relief Corner' : 'Góc xả stress'}
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 6, lineHeight: 1.6 }}>
            {lang === 'en'
              ? 'Click a game to load it. A calming space for quick decompression and emotional reset.'
              : 'Nhấn vào game muốn chơi để load. Không gian xả stress nhanh và cân bằng cảm xúc.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setGestureOn((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: gestureOn ? 'rgba(16,185,129,0.16)' : 'rgba(0,229,255,0.10)', color: gestureOn ? '#6ee7b7' : 'var(--cyan)', border: `1px solid ${gestureOn ? 'rgba(16,185,129,0.35)' : 'rgba(0,229,255,0.20)'}`, fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap', cursor: 'pointer' }}
            title="Nhận dạng bàn tay User 1: 👈/👉/👇/👆/🖐️/✊ sang WASD + phím mũi tên + Space"
          >
            <Hand size={14} />
            {gestureOn ? '🔴 Tắt Camera Cử Chỉ' : '🖐️ Bật Camera Cử Chỉ (User 1)'}
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 999, background: 'rgba(0,229,255,0.10)', color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.20)', fontSize: 11, fontWeight: 900, whiteSpace: 'nowrap' }}>
            🌿 {lang === 'en' ? 'RELAX MODE' : 'CHẾ ĐỘ THƯ GIÃN'}
          </span>
        </div>
      </div>

      {/* Game Picker Card */}
      <div style={{ borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', padding: '18px 18px 14px' }}>
        <p style={{ fontSize: 13, fontWeight: 900, color: 'var(--text2)', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: 7 }}>
          🎮 {lang === 'en' ? 'Game List' : 'Danh sách Game'}
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text3)', marginLeft: 4 }}>
            ({allGames.length} games — {lang === 'en' ? 'tap to switch' : 'nhấn để chuyển'})
          </span>
        </p>

        <div className="sr-game-list">
          {allGames.map((game, idx) => {
            const isCustom = !DEFAULT_GAMES.find(d => d.id === game.id)
            const icon = isCustom ? '⭐' : (ICONS[idx] || '🎮')
            const isActive = game.id === selectedId
            return (
              <div
                className={`sr-game-list-item${isActive ? ' active' : ''}`}
                key={game.id}
                onClick={() => setSelectedId(game.id)}
              >
                <div className="sr-game-badge">{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sr-game-caption">{lang === 'en' ? game.captionEn : game.caption}</div>
                </div>
                {isActive && <div className="sr-active-dot" />}
                {isCustom && (
                  <button
                    className="sr-delete-btn"
                    title="Xoá game này"
                    onClick={e => { e.stopPropagation(); handleDeleteCustom(game.id) }}
                  >✕</button>
                )}
              </div>
            )
          })}
        </div>

        {/* Add Custom Game */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', margin: '0 0 8px 0' }}>
            {lang === 'en' ? '➕ Add your favourite game' : '➕ Thêm game yêu thích của bạn'}
          </p>
          <input
            className="sr-add-input"
            style={{ marginBottom: 8 }}
            value={draftCaption}
            onChange={e => { setDraftCaption(e.target.value); setSaveStatus(null) }}
            placeholder={lang === 'en' ? 'Game caption (e.g. My favourite game)' : 'Caption game (vd: Game yêu thích của tôi)'}
          />
          <input
            className="sr-add-input"
            style={{ marginBottom: 8 }}
            value={draftLink}
            onChange={e => { setDraftLink(e.target.value); setSaveStatus(null) }}
            placeholder={lang === 'en' ? 'Hidden game link (https://...)' : 'Link game ẩn (https://...)'}
          />
          <button
            type="button"
            className="sr-add-btn"
            onClick={handleAddGame}
            disabled={!isDraftValid}
            style={{
              border: `1px solid ${isDraftValid ? 'rgba(0,229,255,0.3)' : 'var(--border)'}`,
              background: isDraftValid ? 'rgba(0,229,255,0.08)' : 'var(--surface2)',
              color: isDraftValid ? 'var(--cyan)' : 'var(--text3)',
              opacity: isDraftValid ? 1 : 0.7,
              cursor: isDraftValid ? 'pointer' : 'not-allowed',
            }}
          >
{lang === 'en' ? '+ Save Game Caption' : '+ Lưu Caption Game'}
          </button>
          {saveStatus && (
            <div style={{ marginTop: 8, fontSize: 10, lineHeight: 1.5, color: saveStatus.type === 'success' ? 'var(--green)' : 'var(--amber)' }}>
              {saveStatus.message}
            </div>
          )}
          {!saveStatus && (draftCaption || draftLink) && (
            <div style={{ marginTop: 8, fontSize: 10, color: isDraftValid ? 'var(--text3)' : 'var(--amber)' }}>
              {isDraftValid
                ? (lang === 'en' ? 'Ready to save.' : 'Sẵn sàng lưu game.')
                : (lang === 'en' ? 'Please fill in Caption and a valid Link (http:// or https://).' : 'Vui lòng nhập Caption và Link hợp lệ (http:// hoặc https://).')}
            </div>
          )}
        </div>
      </div>

      {/* Single Active Game iFrame */}
      <div className="sr-now-playing">
        <span>▶</span>
        <span>{lang === 'en' ? 'Now playing:' : 'Đang chơi:'}</span>
        <span style={{ fontWeight: 400, color: '#fff' }}>{lang === 'en' ? selectedGame.captionEn : selectedGame.caption}</span>
      </div>

      <div className="stress-relief-frame-card">
        <iframe
          ref={iframeRef}
          key={selectedGame.id}
          title={lang === 'en' ? selectedGame.captionEn : selectedGame.caption}
          src={selectedGame.src}
          className="stress-relief-frame"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
        />
        {selectedGame.hasMask && (
          <>
            <div className="stress-relief-mask stress-relief-mask-top" aria-hidden="true">
              <span>🌿 {lang === 'en' ? 'Focus breathing space' : 'Không gian thở chậm'}</span>
            </div>
            <div className="stress-relief-mask stress-relief-mask-bottom" aria-hidden="true">
              <span>✨ {lang === 'en' ? 'Stay relaxed in app' : 'Thư giãn ngay trong trang'}</span>
            </div>
          </>
        )}
      </div>

      {gestureOn && (
        <div className="fixed bottom-6 left-6 z-50 w-56 overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl sm:w-64">
          <div className="aspect-video">
            <TouchlessHandCam
              onHandTrack={handleHandTrack}
              onHandLost={handleHandLost}
              onMappingChange={handleHandMappingChange}
              onClose={() => setGestureOn(false)}
            />
          </div>
          <div className="flex items-center justify-between gap-2 bg-black/80 px-2 py-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              User 1 · WASD + ←↑↓→ + Space
            </div>
            <button type="button" onClick={() => setGestureOn(false)} className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-red-300 hover:bg-red-500/20">✕</button>
          </div>
          {activeGestureKey && (
            <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-emerald-300">
              {GESTURE_KEY_LABELS[activeGestureKey]?.icon} {GESTURE_KEY_LABELS[activeGestureKey]?.action}
            </div>
          )}
        </div>
      )}

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} />
    </div>
  )
}
