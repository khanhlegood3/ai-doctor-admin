import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

export default function Sidebar({ active, onNavigate, openSignal = 0 }) {
  const { user } = useAuth()
  const { t, theme } = useApp()
  const isDark = theme === 'dark'
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const bg       = isDark ? 'rgba(4,6,15,0.97)'      : 'rgba(255,255,255,0.97)'
  const text     = isDark ? '#e8f0f8'                 : '#1a2035'
  const text2    = isDark ? 'rgba(232,240,248,0.55)'  : '#666'
  const text3    = isDark ? 'rgba(232,240,248,0.28)'  : '#aaa'
  const surface  = isDark ? 'rgba(255,255,255,0.03)'  : 'rgba(0,0,0,0.03)'

  const ADMIN_STEPS = user?.isAdmin ? [
    { id: 'myImageToVideo', label: 'My Image to Video', step: 'LAST', icon: '🎞️' },
    { id: 'make3DModel', label: 'Make 3D Model', step: 'CULTS', icon: '🧙‍♀️' },
    { id: 'my3dAsset', label: 'My 3D Asset', step: 'GLB', icon: '🧊' },
    { id: 'twoDTo3DAsset', label: '2D to 3D Asset', step: '05b', icon: '🖼️' },
    { id: 'xyzCameraAngle', label: 'Góc chụp toạ độ XYZ', step: '05b2', icon: '📐' },
    { id: 'aiHealthcareVisionControl', label: t('aiHealthcareVisionControl'), step: '24b' },
    { id: 'admin', label: t('adminPanel'), step: '★', icon: '🛡️' },
    { id: 'affiliateAdmin', label: 'Quản Trị Affiliate', step: 'AFF', icon: '🤝' },
    { id: 'moralisPlaygroundAdmin', label: 'Moralis Playground Admin', step: 'MORALIS', icon: '🧪' },
    { id: 'affiliateWebhookAdmin', label: 'Affiliate Webhook Admin', step: 'WEBHOOK', icon: '🔗' },
    { id: 'create3DVideoFrom2D', label: 'Create 3D Video From 2D', step: '3D2D', icon: '🎥' },
    { id: 'adminConcept', label: 'AI Doctor Admin Panel', step: '00', icon: '🧭' },
  ] : []

  // Nhóm menu MÔ PHỎNG/NỘI BỘ — tách riêng khỏi nhóm Admin thật ở trên. Đây là
  // các màn demo/sandbox dùng dữ liệu giả (không liên kết UUID/user_profiles
  // thật), chỉ dành cho Admin xem/test, KHÔNG phải dữ liệu affiliate thật của
  // người dùng (xem chú thích trong App.jsx — ADMIN_ONLY_PANELS).
  const SIMULATION_STEPS = user?.isAdmin ? [
    { id: 'affiliateControl', label: 'Affiliate Control Panel (Mô phỏng)', step: 'SIM', icon: '🧪' },
  ] : []

  useEffect(() => {
    if (openSignal > 0) setOpen(true)
  }, [openSignal])

  const handleNavigate = (id) => {
    onNavigate(id)
    if (isMobile) setOpen(false)
  }

  const sidebarContent = (
    <>
      {ADMIN_STEPS.length > 0 && (
        <>
          <SectionLabel color={text3} style={{ marginTop: 0 }}>Admin</SectionLabel>
          {ADMIN_STEPS.map(s => (
            <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text="#ff5252" text2={text2} isDark={isDark} isAdmin>
              <span style={{ fontSize: 12 }}>{s.icon || '🛡️'}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#ff5252' }}>{s.step}</span>
            </NavItem>
          ))}
        </>
      )}

      {SIMULATION_STEPS.length > 0 && (
        <>
          <SectionLabel color={text3} style={{ marginTop: 16 }}>Mô Phỏng (Nội Bộ)</SectionLabel>
          {SIMULATION_STEPS.map(s => (
            <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text="#ff5252" text2={text2} isDark={isDark} isAdmin>
              <span style={{ fontSize: 12 }}>{s.icon || '🧪'}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#ff5252' }}>{s.step}</span>
            </NavItem>
          ))}
        </>
      )}

      {!user?.isAdmin && (
        <div style={{ padding: '12px 10px', borderRadius: 10, background: surface, border: `1px solid ${border}`, color: text2, fontSize: 12, lineHeight: 1.5 }}>
          Menu hiện chỉ giữ 2 nhóm Admin và Mô Phỏng (Nội Bộ).
        </div>
      )}

    </>
  )

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            position: 'fixed', top: 12, left: 12, zIndex: 300,
            width: 40, height: 40, borderRadius: 10,
            background: isDark ? 'rgba(4,6,15,0.92)' : 'rgba(255,255,255,0.92)',
            border: `1px solid ${border}`,
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 5,
            padding: 0,
          }}
          aria-label="Toggle menu"
        >
          <span style={{ display: 'block', width: 18, height: 2, borderRadius: 2, background: open ? '#00e5ff' : text, transition: 'all 0.2s', transform: open ? 'translateY(7px) rotate(45deg)' : 'none' }} />
          <span style={{ display: 'block', width: 18, height: 2, borderRadius: 2, background: open ? '#00e5ff' : text, transition: 'all 0.2s', opacity: open ? 0 : 1 }} />
          <span style={{ display: 'block', width: 18, height: 2, borderRadius: 2, background: open ? '#00e5ff' : text, transition: 'all 0.2s', transform: open ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
        </button>
        {open && (
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
        )}
        <aside style={{
          position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 250,
          width: 260, background: bg, backdropFilter: 'blur(12px)',
          borderRight: `1px solid ${border}`,
          display: 'flex', flexDirection: 'column',
          padding: '64px 12px 20px', gap: 4, overflowY: 'auto',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {sidebarContent}
        </aside>
      </>
    )
  }

  return (
    <aside style={{
      width: 228, borderRight: `1px solid ${border}`,
      background: bg, backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column', padding: '20px 12px', gap: 4,
      flexShrink: 0, overflowY: 'auto',
    }}>
      {sidebarContent}
    </aside>
  )
}

function SectionLabel({ children, color, style }) {
  return (
    <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color, fontFamily: 'monospace', marginBottom: 8, ...style }}>
      {children}
    </div>
  )
}

function NavItem({ active, onClick, children, text, text2, isDark, isAdmin }) {
  const activeColor = isAdmin ? '#ff5252' : '#00e5ff'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
      cursor: 'pointer',
      background: active ? `${isAdmin ? 'rgba(255,82,82,0.07)' : 'rgba(0,229,255,0.07)'}` : 'transparent',
      border: `1px solid ${active ? (isAdmin ? 'rgba(255,82,82,0.3)' : 'rgba(0,229,255,0.25)') : 'transparent'}`,
      color: active ? activeColor : text2,
      fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
      textAlign: 'left', width: '100%', transition: 'all 0.18s',
    }}>{children}</button>
  )
}