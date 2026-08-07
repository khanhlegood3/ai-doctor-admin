// ClickHeroSpiderEffects.jsx — hiệu ứng click chuột trên trang
// "🤖 AI chatbot control":
//   - Click chuột TRÁI  → 🦸 siêu nhân bay tới đúng vị trí click
//   - Click chuột PHẢI  → 🕸️ người nhện đu dây tới đúng vị trí click
//     (chặn menu chuột phải mặc định của trình duyệt)
//
// Cả 2 hình đều tự vẽ bằng SVG (silhouette chung chung, không mặc trang
// phục/hoạ tiết của bất kỳ nhân vật có bản quyền nào — không phải Spider-
// Man/Marvel, chỉ là "người nhện" theo nghĩa chung: có mạng nhện + tư thế
// đu dây).
//
// Dùng qua hook `useClickHeroSpiderEffects()`:
//   const { layer, handleClick, handleContextMenu } = useClickHeroSpiderEffects(color)
//   <div onClick={handleClick} onContextMenu={handleContextMenu}>...{layer}</div>
import React, { useCallback, useRef, useState } from 'react'

const EFFECT_DURATION_MS = 1050

// Bỏ qua khi click/right-click đang nhắm vào ô nhập liệu, nút bấm... để
// không phá trải nghiệm gõ chữ / menu ngữ cảnh copy-paste bình thường.
function isInteractiveTextTarget(target) {
  return !!target.closest?.('input, textarea, [contenteditable="true"]')
}

function heroFigureSvg(color) {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%">
      <path d="M2 24 L9 18 L6 15 Z" fill={color} opacity="0.4" />
      <path d="M0 28 L8 22 L6 19 Z" fill={color} opacity="0.25" />
      <path d="M12 24 C9 20 9 13 14 9 C16.5 7 20.5 6.5 25 8 L20 12.5 C18 12.3 16 13.3 15 15.3 C14 17.3 15 20.3 17.5 22.3 Z" fill={color} />
      <ellipse cx="19" cy="16.5" rx="6.2" ry="3.6" transform="rotate(-35 19 16.5)" fill={color} />
      <circle cx="24.5" cy="9.3" r="3.3" fill={color} />
      <path d="M24.5 15.3 L30 12 L28.7 15.3 L24.5 17.3 Z" fill={color} />
      <circle cx="24.5" cy="9.3" r="1.1" fill="#ffffff" opacity="0.7" />
    </svg>
  )
}

function spiderFigureSvg(color) {
  return (
    <svg viewBox="0 0 32 32" width="100%" height="100%">
      {/* thân người co gối, 1 tay nắm dây phía trên đầu */}
      <path d="M16 4 L16 9" stroke="#94a3b8" strokeWidth="1" />
      <circle cx="16" cy="12" r="3.4" fill={color} />
      <path d="M16 15 C13 17 12 21 13.5 25 C14.5 24 15.5 22.5 16 21 C16.5 22.5 17.5 24 18.5 25 C20 21 19 17 16 15 Z" fill={color} />
      <path d="M12.5 15.5 L7 12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M19.5 15.5 L16 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <path d="M14 24 C12.5 26 11 27.5 9.5 28.5" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M18 24 C19.5 26 21 27.5 22.5 28.5" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      {/* mạng nhện nhỏ trang trí ở vai */}
      <path d="M7 12 L4 9 M7 12 L4 12 M7 12 L4 15" stroke="#cbd5e1" strokeWidth="0.6" opacity="0.8" />
    </svg>
  )
}

export function useClickHeroSpiderEffects(color = '#ea4335') {
  const [effects, setEffects] = useState([])
  const seqRef = useRef(0)

  const spawn = useCallback((type, clientX, clientY) => {
    const id = `${Date.now()}-${seqRef.current++}`
    let dx, dy

    if (type === 'spider') {
      // Dây đu dài ~1/2 chiều cao màn hình, neo lệch trái/phải một chút
      // cho có cú "đu" chứ không rơi thẳng đứng.
      const ropeLength = window.innerHeight * (0.46 + Math.random() * 0.12)
      const sideOffset = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 90)
      dx = sideOffset
      dy = -Math.sqrt(Math.max(0, ropeLength * ropeLength - sideOffset * sideOffset))
    } else {
      // Điểm xuất phát ngẫu nhiên (góc trên) để mỗi lần bay có hướng hơi
      // khác nhau, tự nhiên hơn.
      const fromAngle = -60 - Math.random() * 60 // -60°..-120° (từ phía trên)
      const fromDist = 320 + Math.random() * 180
      const rad = (fromAngle * Math.PI) / 180
      dx = Math.cos(rad) * fromDist
      dy = Math.sin(rad) * fromDist
    }

    setEffects(prev => [...prev, { id, type, x: clientX, y: clientY, dx, dy }])
    window.setTimeout(() => {
      setEffects(prev => prev.filter(e => e.id !== id))
    }, EFFECT_DURATION_MS + 50)
  }, [])

  const handleClick = useCallback((e) => {
    if (isInteractiveTextTarget(e.target)) return
    spawn('hero', e.clientX, e.clientY)
  }, [spawn])

  const handleContextMenu = useCallback((e) => {
    if (isInteractiveTextTarget(e.target)) return
    e.preventDefault()
    spawn('spider', e.clientX, e.clientY)
  }, [spawn])

  const layer = (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
      <style>{`
        @keyframes clickHeroFlyIn {
          0%   { transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.35) rotate(-22deg); opacity: 0; }
          55%  { opacity: 1; }
          82%  { transform: translate(-50%, -50%) scale(1.18) rotate(6deg); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.92) rotate(0deg); opacity: 0; }
        }
        @keyframes clickHeroTrail {
          0%   { opacity: 0.75; transform: translate(-50%, -50%) scaleX(1); }
          60%  { opacity: 0.25; }
          100% { opacity: 0; transform: translate(-50%, -50%) scaleX(0.4); }
        }
        @keyframes clickHeroBurst {
          0%   { transform: translate(-50%, -50%) scale(0.2); opacity: 0.55; }
          100% { transform: translate(-50%, -50%) scale(2.1); opacity: 0; }
        }
        @keyframes clickSpiderSwing {
          0%   { transform: translate(-50%, -50%) rotate(calc(var(--theta) - 46deg)) scaleY(0.4); opacity: 0; }
          45%  { opacity: 1; }
          62%  { transform: translate(-50%, -50%) rotate(calc(var(--theta) + 10deg)) scaleY(1); }
          80%  { transform: translate(-50%, -50%) rotate(calc(var(--theta) - 5deg)) scaleY(1); }
          100% { transform: translate(-50%, -50%) rotate(var(--theta)) scaleY(1); opacity: 0; }
        }
      `}</style>
      {effects.map(effect => effect.type === 'hero' ? (
        <React.Fragment key={effect.id}>
          <div
            style={{
              position: 'absolute', left: effect.x, top: effect.y,
              width: Math.max(60, Math.hypot(effect.dx, effect.dy) * 0.6), height: 14,
              background: `linear-gradient(90deg, transparent, ${color})`,
              borderRadius: 8,
              transformOrigin: '100% 50%',
              transform: `translate(-100%, -50%) rotate(${(Math.atan2(effect.dy, effect.dx) * 180) / Math.PI}deg)`,
              animation: `clickHeroTrail ${EFFECT_DURATION_MS * 0.55}ms ease-out forwards`,
            }}
          />
          <div
            style={{
              position: 'absolute', left: effect.x, top: effect.y, width: 108, height: 108,
              '--dx': `${effect.dx}px`, '--dy': `${effect.dy}px`,
              animation: `clickHeroFlyIn ${EFFECT_DURATION_MS}ms ease-out forwards`,
              filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.4))',
            }}
          >
            {heroFigureSvg(color)}
          </div>
          <div
            style={{
              position: 'absolute', left: effect.x, top: effect.y, width: 130, height: 130,
              borderRadius: '50%', border: `4px solid ${color}`,
              animation: `clickHeroBurst ${EFFECT_DURATION_MS * 0.7}ms ease-out ${EFFECT_DURATION_MS * 0.55}ms forwards`,
            }}
          />
        </React.Fragment>
      ) : (
        <SpiderSwingEffect key={effect.id} effect={effect} color={color} />
      ))}
    </div>
  )

  return { layer, handleClick, handleContextMenu }
}

function SpiderSwingEffect({ effect, color }) {
  // Neo dây nhện ở phía trên-lệch của điểm click (theo dx/dy đã random),
  // độ dài dây = khoảng cách anchor→click, xoay quanh anchor để "đu" tới.
  const anchorX = effect.x + effect.dx
  const anchorY = effect.y + effect.dy
  const dist = Math.max(40, Math.hypot(effect.dx, effect.dy))
  const angleDeg = (Math.atan2(-effect.dy, -effect.dx) * 180) / Math.PI // hướng từ anchor -> click
  const theta = angleDeg - 90 // vì thanh dây vẽ mặc định chĩa thẳng xuống (0deg = xuống)

  return (
    <div
      style={{
        position: 'absolute', left: anchorX, top: anchorY, width: 2, height: dist,
        transformOrigin: 'top center',
        '--theta': `${theta}deg`,
        animation: `clickSpiderSwing ${EFFECT_DURATION_MS}ms cubic-bezier(0.3,0.6,0.3,1) forwards`,
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: '100%', background: 'rgba(203,213,225,0.85)', transform: 'translateX(-50%)' }} />
      <div style={{ position: 'absolute', left: '50%', bottom: 0, width: 48, height: 48, transform: 'translate(-50%, 50%)', filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.35))' }}>
        {spiderFigureSvg(color)}
      </div>
    </div>
  )
}
