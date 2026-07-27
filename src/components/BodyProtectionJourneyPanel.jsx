import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ShieldCheck, Maximize2, Minimize2, Hand } from 'lucide-react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import TouchlessHandCam from './webcam/TouchlessHandCam.jsx'
import { classifyGestureKey, expandUser1GestureKeys, GESTURE_KEY_LABELS } from './webcam/gestureToKey.js'
import GameAffiliateRewardWidget from './GameAffiliateRewardWidget.jsx'
import { getReferralFor, resolveReferrerByCode, saveReferral, recordGameProgress } from '../lib/gameAffiliateDB'
import { registerReferralOnChain } from '../lib/gameAffiliateChain'

// ============================================================================
// DANH SÁCH GAME & CẤU HÌNH CAMERA
// Best Practice: Phân loại game tự quản lý camera và game cần Portal hỗ trợ AI.
// ============================================================================
// Đã bỏ menu chọn game (Portal Game AI Camera / Portal Game Không Camera /
// Angry Bird NFT) — trang này giờ chỉ load CỐ ĐỊNH đúng 1 game duy nhất:
// public/games/portal-index.html (Portal bên ngoài tự bật camera AI và
// postMessage vào, giống hành vi của "Portal Game (Không Camera)" trước đây).
const GAME = {
  title: "Portal Game",
  url: "/games/portal-index.html",
  hasLocalCamera: false,
  external: false
};

const HOLD_FRAMES_TO_ACTIVATE = 3
const HOLD_FRAMES_TO_RELEASE = 5

export default function BodyProtectionJourneyPanel({ onNext, nextLabel, onPrev, prevLabel, onFullscreenChange }) {
  const { theme } = useApp()
  const { user } = useAuth()
  const isDark = theme === 'dark'
  
  // State quản lý Game đang được chọn
  const activeGame = GAME
  const [fullscreen, setFullscreen] = useState(false)
  const [gestureOn, setGestureOn] = useState(false)
  const [activeGestureKey, setActiveGestureKey] = useState(null)
  const [lastGameResult, setLastGameResult] = useState(null)
  // true khi user đang mở 1 trong các game "camera" bên trong portal-index.html
  // (game đó đã tự chạy MediaPipe Camera riêng) — dùng để ẩn/khoá nút
  // "Bật Camera AI (Portal)" của chính React app, tránh 2 luồng getUserMedia()
  // chạy song song gây xung đột camera / double input lên cùng 1 game.
  const [subGameHasLocalCamera, setSubGameHasLocalCamera] = useState(false)

  const iframeRef = useRef(null)
  const touchlessCameraRef = useRef(null)
  const activeKeyRef = useRef(null)
  const pendingRef = useRef({ key: null, count: 0 })
  const handMappingRef = useRef({ mirrored: true, facingMode: 'user' })

  const cardBg = isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white border-gray-200'
  const pageBg = isDark ? 'bg-[#05070f]' : 'bg-[#f4f7fb]'
  const textMain = isDark ? 'text-gray-100' : 'text-gray-900'
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500'

  // ============================================================================
  // XỬ LÝ GỬI LỆNH PHÍM XUỐNG IFRAME
  // ============================================================================
  const sendKeyToGame = useCallback((key, isDown) => {
    if (!key) return
    try {
      expandUser1GestureKeys(key).forEach((mappedKey) => {
        if (activeGame.external) {
          // Xử lý Cross-Origin (Ví dụ: Game nhúng từ Vercel)
          iframeRef.current?.contentWindow?.postMessage({
            type: 'PORTAL_VKEY',
            key: mappedKey,
            isDown: isDown
          }, '*')
        } else {
          // Xử lý Same-Origin (File tĩnh trong project)
          if (iframeRef.current?.contentWindow?.setKey) {
            iframeRef.current.contentWindow.setKey(mappedKey, isDown)
          } else {
            // Fallback gửi postMessage nếu iFrame đã được code để lắng nghe
            iframeRef.current?.contentWindow?.postMessage({
              type: 'PORTAL_VKEY',
              key: mappedKey,
              isDown: isDown
            }, '*')
          }
        }
      })
    } catch (err) {
      console.warn('[BodyProtectionJourneyPanel] Lỗi gửi lệnh điều khiển:', err)
    }
  }, [activeGame])

  const releaseActiveKey = useCallback(() => {
    if (activeKeyRef.current) sendKeyToGame(activeKeyRef.current, false)
    activeKeyRef.current = null
    pendingRef.current = { key: null, count: 0 }
    setActiveGestureKey(null)
  }, [sendKeyToGame])

  // ============================================================================
  // ĐỒNG BỘ TÊN + UUID TỪ PROFILE VÀO Ô "👤 NGƯỜI CHƠI" CỦA PORTAL
  // ============================================================================
  // portal-index.html là file tĩnh (không phải React), tự quản lý tên người
  // chơi bằng localStorage riêng — trước đây phải tự gõ tay, không liên quan
  // gì đến Profile đã đăng nhập. Vì cùng origin nên gọi thẳng hàm
  // window.setPlayerIdentity mà portal-index.html expose ra (giống cách
  // sendKeyToGame gọi contentWindow.setKey ở trên); postMessage chỉ là
  // fallback nếu vì lý do gì đó không gọi thẳng được.
  const syncPlayerIdentityToGame = useCallback(() => {
    try {
      const name = user?.name || ''
      const uuid = user?.uuid || ''
      if (typeof iframeRef.current?.contentWindow?.setPlayerIdentity === 'function') {
        iframeRef.current.contentWindow.setPlayerIdentity(name, uuid)
      } else {
        iframeRef.current?.contentWindow?.postMessage({
          type: 'PORTAL_PLAYER_IDENTITY',
          name,
          uuid
        }, '*')
      }
    } catch (err) {
      console.warn('[BodyProtectionJourneyPanel] Lỗi đồng bộ tên/UUID người chơi:', err)
    }
  }, [user?.name, user?.uuid])

  // Nếu Profile đổi tên/UUID (VD: nâng cấp tài khoản) SAU KHI iframe đã load
  // xong, đẩy lại đồng bộ ngay, không cần người dùng tải lại game.
  useEffect(() => {
    syncPlayerIdentityToGame()
  }, [syncPlayerIdentityToGame])

  const handleHandMappingChange = useCallback((nextMapping) => {
    handMappingRef.current = nextMapping
  }, [])

  const handleHandTrack = useCallback((landmarksArr) => {
    const hand = landmarksArr?.[0]
    const candidate = classifyGestureKey(hand, { mirrored: handMappingRef.current.mirrored })
    const pending = pendingRef.current

    if (candidate === pending.key) {
      pending.count += 1
    } else {
      pending.key = candidate
      pending.count = 1
    }

    const threshold = candidate ? HOLD_FRAMES_TO_ACTIVATE : HOLD_FRAMES_TO_RELEASE
    if (pending.count < threshold) return
    if (candidate === activeKeyRef.current) return

    if (activeKeyRef.current) sendKeyToGame(activeKeyRef.current, false)
    if (candidate) sendKeyToGame(candidate, true)
    activeKeyRef.current = candidate
    setActiveGestureKey(candidate)
  }, [sendKeyToGame])

  const handleHandLost = useCallback(() => {
    releaseActiveKey()
  }, [releaseActiveKey])

  const toggleFullscreen = useCallback(() => {
    setFullscreen((v) => {
      const next = !v
      onFullscreenChange?.(next)
      return next
    })
  }, [onFullscreenChange])

  // ============================================================================
  // QUẢN LÝ LUỒNG CAMERA
  // Tự động tắt luồng Camera ở Portal bên ngoài nếu Game tự có Camera
  // ============================================================================
  useEffect(() => {
    if (activeGame?.hasLocalCamera) {
      setGestureOn(false) // Buộc tắt camera của cha để tránh giành giật phần cứng
    }
  }, [activeGame])

  useEffect(() => () => onFullscreenChange?.(false), [onFullscreenChange])

  useEffect(() => {
    if (!gestureOn) releaseActiveKey()
  }, [gestureOn, releaseActiveKey])

  useEffect(() => () => releaseActiveKey(), [releaseActiveKey])

  // ============================================================================
  // AFFILIATE: bắt mã giới thiệu ?ref=CODE trên URL (đúng 1 lần / thiết bị)
  // ============================================================================
  useEffect(() => {
    if (!user?.uuid) return
    const params = new URLSearchParams(window.location.search)
    const refCode = params.get('ref')
    if (!refCode) return
    ;(async () => {
      const already = await getReferralFor(user.uuid)
      if (already) return
      const referrerUuid = await resolveReferrerByCode(refCode)
      if (!referrerUuid || referrerUuid === user.uuid) return
      const saved = await saveReferral({ referrerUuid, refereeUuid: user.uuid, code: refCode, source: 'games' })
      if (saved?.id) {
        registerReferralOnChain({ id: saved.id, referrerUuid, refereeUuid: user.uuid }).catch((err) =>
          console.warn('[BodyProtectionJourneyPanel] Không thể ghi referral lên chain ngay, sẽ thử lại sau:', err)
        )
      }
    })()
  }, [user?.uuid])

  // ============================================================================
  // AFFILIATE: nhận kết quả chơi game (PORTAL_GAME_RESULT) từ iframe cùng gốc
  // và forward từ portal-index.html (game không camera, nhúng game ngoài)
  // ============================================================================
  useEffect(() => {
    const handleGameMessage = (event) => {
      const data = event.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'PORTAL_ACTIVE_GAME') {
        setSubGameHasLocalCamera(!!data.hasLocalCamera)
        return
      }

      if (data.type !== 'PORTAL_GAME_RESULT') return
      if (user?.uuid) {
        recordGameProgress({
          uuid: user.uuid,
          gameId: data.gameId,
          gameTitle: data.gameTitle,
          status: data.status,
          score: data.score,
          timeSec: data.timeSec,
          meta: data.meta,
        }).catch(() => {})
      }
      setLastGameResult({ ...data, receivedAt: Date.now() })
    }
    window.addEventListener('message', handleGameMessage)
    return () => window.removeEventListener('message', handleGameMessage)
  }, [user?.uuid])

  // Game bên trong portal vừa bật camera riêng của nó → tự tắt ngay camera
  // của Portal (TouchlessHandCam) nếu đang mở, tránh 2 camera cùng chạy.
  useEffect(() => {
    if (subGameHasLocalCamera && gestureOn) setGestureOn(false)
  }, [subGameHasLocalCamera, gestureOn])

  // Chỉ cho phép bật nút "Camera AI (Portal)" khi KHÔNG có camera nào khác
  // (của chính game cố định GAME.hasLocalCamera, hoặc của sub-game user vừa
  // chọn bên trong portal) đang tự quản lý camera rồi.
  const cameraToggleAllowed = !activeGame.hasLocalCamera && !subGameHasLocalCamera

  return (
    <div className={`animate-fade min-h-full w-full ${fullscreen ? 'px-0 py-0' : 'px-4 py-6 sm:px-8'} ${pageBg}`}>
      <div className={`${fullscreen ? 'h-[calc(100dvh-58px)] max-w-none gap-0' : 'mx-auto h-[calc(100svh-112px)] min-h-[720px] max-w-6xl gap-5 max-lg:h-[calc(100svh-96px)] max-lg:min-h-[640px] max-sm:h-[calc(100svh-80px)] max-sm:min-h-[560px]'} flex flex-col`}>
        
        {!fullscreen && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 text-white shadow-lg shadow-cyan-500/20">
                <ShieldCheck size={22} />
              </span>
              <div>
                <h1 className={`text-xl font-black leading-tight sm:text-2xl ${textMain}`}>
                  🛡️ Hành Trình Bảo Vệ Cơ Thể
                </h1>
                <p className={`text-xs sm:text-sm ${textSub}`}>
                  Mini-game PvP/PvE/Co-op: Chọn hệ cơ quan, chiến đấu với BOSS UNG THƯ.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* CHỈ hiển thị nút bật Camera Portal nếu KHÔNG game nào (cố định
                  hoặc sub-game vừa chọn trong portal) đang tự quản lý camera */}
              {cameraToggleAllowed && (
                <button
                  type="button"
                  onClick={() => setGestureOn((v) => !v)}
                  className={`inline-flex w-fit items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    gestureOn
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                      : isDark
                        ? 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                  }`}
                  title="Điều khiển User 1 bằng cử chỉ tay qua camera"
                >
                  <Hand size={16} />
                  {gestureOn ? '🔴 Tắt Camera Cử Chỉ' : '🖐️ Bật Camera AI (Portal)'}
                </button>
              )}
              {!cameraToggleAllowed && subGameHasLocalCamera && (
                <span className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium ${isDark ? 'border-white/10 text-gray-400' : 'border-gray-200 text-gray-500'}`}>
                  <Hand size={14} /> Game đang tự dùng camera riêng
                </span>
              )}

              <button
                type="button"
                onClick={toggleFullscreen}
                className={`inline-flex w-fit items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  isDark
                    ? 'border-white/15 bg-white/5 text-gray-200 hover:bg-white/10'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                }`}
              >
                {fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {fullscreen ? 'Thu nhỏ' : 'Toàn màn hình'}
              </button>
            </div>
          </div>
        )}

        <div
          className={`relative min-h-0 flex-1 overflow-hidden border shadow-2xl ${fullscreen ? 'rounded-none' : 'rounded-3xl'} ${cardBg}`}
          style={{ height: 'auto' }}
        >
          <iframe
            ref={iframeRef}
            title={activeGame.title}
            src={activeGame.url}
            className="h-full min-h-full w-full bg-black"
            style={{ border: 'none', display: 'block' }}
            // BẮT BUỘC: Thêm "camera" để iFrame được phép chiếm quyền
            allow="camera; microphone; xr-spatial-tracking; autoplay; fullscreen; display-capture"
            onLoad={syncPlayerIdentityToGame}
          />

          {fullscreen && cameraToggleAllowed && (
            <div className="absolute right-2 top-2 z-40 flex flex-wrap items-center justify-end gap-2 sm:right-3 sm:top-3">
              <button
                type="button"
                onClick={() => setGestureOn((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 ${
                  gestureOn
                    ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/20 bg-black/60 text-gray-100 hover:bg-black/80'
                }`}
              >
                <Hand size={14} />
                <span className="hidden sm:inline">{gestureOn ? '🔴 Tắt Camera Cử Chỉ' : '🖐️ Bật Camera Cử Chỉ'}</span>
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-semibold text-gray-100 shadow-lg backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-black/80"
              >
                <Minimize2 size={14} />
                <span className="hidden sm:inline">Thu nhỏ</span>
              </button>
            </div>
          )}

          {/* CHỈ render Camera Portal nếu game yêu cầu điều khiển từ bên ngoài */}
          {gestureOn && cameraToggleAllowed && (
            <div className="fixed bottom-6 left-6 z-50 w-56 overflow-hidden rounded-xl border border-white/20 bg-black shadow-2xl sm:w-64">
              <div className="aspect-video">
                <TouchlessHandCam
                  ref={touchlessCameraRef}
                  onHandTrack={handleHandTrack}
                  onHandLost={handleHandLost}
                  onMappingChange={handleHandMappingChange}
                  onClose={() => setGestureOn(false)}
                />
              </div>
              <div className="flex items-center justify-between gap-2 bg-black/80 px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                  User 1 · Gesture Control
                </div>
                <button
                  type="button"
                  onClick={() => setGestureOn(false)}
                  className="rounded-md px-1.5 py-0.5 text-[10px] font-bold text-red-300 hover:bg-red-500/20"
                  title="Tắt camera cử chỉ"
                >
                  ✕
                </button>
              </div>
              {activeGestureKey && (
                <div className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-bold text-emerald-300">
                  {GESTURE_KEY_LABELS[activeGestureKey]?.icon} {GESTURE_KEY_LABELS[activeGestureKey]?.action}
                </div>
              )}
            </div>
          )}
        </div>

        {!fullscreen && (
          <NavButtons
            onNext={onNext}
            nextLabel={nextLabel || 'Health Journey Game'}
            onPrev={onPrev}
            prevLabel={prevLabel}
          />
        )}
      </div>

      <GameAffiliateRewardWidget uuid={user?.uuid} lastGameResult={lastGameResult} playerName={user?.name} cameraOpen={gestureOn} />
    </div>
  )
}