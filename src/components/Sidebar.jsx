import React, { useState, useEffect } from 'react'
import { AGENTS } from '../data/mockData.js'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

const COLOR_MAP = {
  cyan:   { bg: 'rgba(0,229,255,0.12)',   color: '#00e5ff' },
  violet: { bg: 'rgba(156,111,255,0.12)', color: '#9c6fff' },
  pink:   { bg: 'rgba(244,143,177,0.12)', color: '#f48fb1' },
  green:  { bg: 'rgba(0,230,118,0.12)',   color: '#00e676' },
}

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
  const { user, logout } = useAuth()
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
  const surface2 = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.06)'

  const STEPS = [
    { id: 'bodyProtectionJourney', label: 'Hành Trình Bảo Vệ Cơ Thể', step: '01' },
    { id: 'hero3DMap', label: '3D Map for Hero', step: '01a' },
    { id: 'myPainPathBody', label: 'My Pain Path Body', step: '01b' },
    { id: 'myPainPathBodyPixel', label: 'My Pain Path Body Pixel', step: '01c' },
    { id: 'myPainPathNoiTang', label: 'My Pain Path Nội Tạng', step: '01d' },
    { id: 'myPainPathNoiTangPixel', label: 'My Pain Path Nội Tạng Pixel', step: '01e' },
    { id: 'healthJourneyGame', label: 'Health Journey Game', step: '02' },
    { id: 'medicalAssetStore', label: 'Chợ Tài nguyên 3D', step: '03' },
    { id: 'medicalVisualPlayground', label: 'Medical 3D Lab (Touchless)', step: '04' },
    { id: 'medicalVisualCameraAngle3D', label: 'Medical Camera Angle 3D', step: '04b' },
    { id: 'myRewardHealth', label: 'My Reward Health', step: '05' },
    { id: 'affiliate', label: 'Affiliate & Earn Đa Tầng', step: '05b' },
    { id: 'rssPortal', label: 'Healthy RSS Portal', step: '06' },
    { id: 'waterDrinkChatBot', label: t('waterDrinkChatBot'), step: '07' },
    { id: 'wikiMedVision', label: t('wikiMedVision'), step: '08' },
    { id: 'fullDocSummarization', label: 'Full-Document Summarization', step: '09' },
    { id: 'documentOCR', label: 'Document OCR', step: '10' },
    { id: 'cameraAngle3DStudio', label: '3D Camera Angle (Qwen)', step: '11' },
    { id: 'organConnection', label: 'Ăn gì tốt hôm nay', step: '12' },
    { id: 'healthJourney', label: t('healthJourney'), step: '13' },
    { id: 'lunchJourney', label: t('lunchJourney'), step: '14' },
    { id: 'dinnerJourney', label: t('dinnerJourney'), step: '15' },
    { id: 'upload', label: t('uploadRecords'), step: '16' },
    { id: 'imaging', label: t('imaging'), step: '17' },
    { id: 'checkin', label: t('checkin'), step: '18' },
    { id: 'family', label: t('familyTree'), step: '19' },
    { id: 'record', label: t('patientRecord'), step: '20' },
    { id: 'familyRelationship', label: t('familyRelationship'), step: '21' },
    { id: 'matrix3dBody', label: t('matrix3dBody'), step: '22' },
    { id: 'omnidirectional3dBody', label: t('omnidirectional3dBody'), step: '23' },
    { id: 'twin', label: t('twin'), step: '24' },
    { id: 'telemedicine', label: t('telemedicine'), step: '25' },
    { id: 'statAnalysis', label: t('statAnalysis'), step: '26' },
    { id: 'swarm', label: t('swarmCouncil'), step: '27' },
    { id: 'consensus', label: t('consensus'), step: '28' },
    { id: 'varCheck', label: 'VAR Y TẾ', step: '29' },
    { id: 'protein3d', label: t('protein3d'), step: '30' },
    { id: 'aiHealthcareVision', label: t('aiHealthcareVision'), step: '31' },
    { id: 'stressRelief', label: t('stressRelief'), step: '32' },
    { id: 'aiInbodyPortal', label: t('aiInbodyPortal'), step: '33' },
    { id: 'printPortal', label: 'Print Portal', step: '34' },
    { id: 'patientReflect', label: 'Hero Reflection / Phản chiếu Siêu Anh Hùng', step: '35' },
    { id: 'chatHistory', label: 'Lịch sử Chat với AI', step: '36' },
  ]

  const VIP_PRO_EXCLUDED_STEP_IDS = new Set([
    'bodyProtectionJourney',
    'hero3DMap',
    'healthJourneyGame',
    'medicalAssetStore',
    'medicalVisualCameraAngle3D',
    'waterDrinkChatBot',
    'wikiMedVision',
    'fullDocSummarization',
    'documentOCR',
    'cameraAngle3DStudio',
    'organConnection',
    'healthJourney',
    'lunchJourney',
    'dinnerJourney',
    'upload',
    'imaging',
    'family',
    'record',
    'familyRelationship',
    'omnidirectional3dBody',
    'aiHealthcareVision',
    'patientReflect',
    'stressRelief',
    'chatHistory',
  ])
  const PATIENT_JOURNEY_STEPS = STEPS.filter((step) => VIP_PRO_EXCLUDED_STEP_IDS.has(step.id))
  const VIP_PRO_STEPS = STEPS.filter((step) => !VIP_PRO_EXCLUDED_STEP_IDS.has(step.id))

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
      {/* User card */}
      {user && (
        <button
          type="button"
          onClick={() => handleNavigate('profile')}
          aria-label={t('profile')}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px',
            background: active === 'profile' ? 'rgba(0,229,255,0.12)' : surface, border: `1px solid ${active === 'profile' ? '#00e5ff' : border}`, borderRadius: 10, marginBottom: 12,
            cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
          }}
        >
          <img src={user.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${user.isAdmin ? '#ff5252' : '#00b8cc'}` }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
            <div style={{ fontSize: 9, color: user.isAdmin ? '#ff5252' : '#00b8cc', fontWeight: 600 }}>{user.isAdmin ? '★ ADMIN' : '● USER'}</div>
          </div>
        </button>
      )}

      <NavItem active={active === 'landingZeroToForever'} onClick={() => handleNavigate('landingZeroToForever')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>♾️</span>
        <span style={{ flex: 1 }}>Zero to Forever - Trang chủ</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>ZOFO</span>
      </NavItem>
      <NavItem active={active === 'chooseUserRole'} onClick={() => handleNavigate('chooseUserRole')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🎭</span>
        <span style={{ flex: 1 }}>Chọn Vai Trò Anh Hùng</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>NEW</span>
      </NavItem>
      <NavItem active={active === 'donationHero'} onClick={() => handleNavigate('donationHero')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🦸</span>
        <span style={{ flex: 1 }}>Anh Hùng Hiến Tặng</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>GAN</span>
      </NavItem>
      <NavItem active={active === 'affiliateUuidReferral'} onClick={() => handleNavigate('affiliateUuidReferral')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🔗</span>
        <span style={{ flex: 1 }}>Đăng Ký Affiliate Marketing</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>UUID</span>
      </NavItem>
      <SectionLabel color={text3}>{t('profile')}</SectionLabel>
      <NavItem active={active === 'profile'} onClick={() => handleNavigate('profile')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>👤</span>
        <span style={{ flex: 1 }}>{t('profile')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>ID</span>
      </NavItem>
      <NavItem active={active === 'avatarCreator'} onClick={() => handleNavigate('avatarCreator')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🧑‍🚀</span>
        <span style={{ flex: 1 }}>Tạo Avatar</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>VRM</span>
      </NavItem>
      <SectionLabel color={text3} style={{ marginTop: 16 }}>{t('patients')} Journey</SectionLabel>
      {PATIENT_JOURNEY_STEPS.map(s => (
        <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text={text} text2={text2} isDark={isDark}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: active === s.id ? '#00e5ff' : text3, flexShrink: 0, transition: 'background 0.2s' }} />
          <span style={{ flex: 1 }}>{s.label}</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>{s.step}</span>
        </NavItem>
      ))}

      {VIP_PRO_STEPS.length > 0 && (
        <>
          <SectionLabel color={text3} style={{ marginTop: 16 }}>VIP PRO Accounts Only</SectionLabel>
          {VIP_PRO_STEPS.map(s => (
            <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text={text} text2={text2} isDark={isDark}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: active === s.id ? '#00e5ff' : text3, flexShrink: 0, transition: 'background 0.2s' }} />
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>{s.step}</span>
            </NavItem>
          ))}
        </>
      )}

      {ADMIN_STEPS.length > 0 && (
        <>
          <SectionLabel color={text3} style={{ marginTop: 16 }}>Admin</SectionLabel>
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

      <SectionLabel color={text3} style={{ marginTop: 16 }}>AI Agents</SectionLabel>
      {AGENTS.map(agent => {
        const c = COLOR_MAP[agent.color]
        return (
          <div key={agent.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '9px 10px', borderRadius: 8,
            background: surface, border: `1px solid ${border}`, marginBottom: 4,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              background: c.bg, color: c.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, fontFamily: 'monospace', fontWeight: 700, flexShrink: 0,
            }}>{agent.abbr}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agent.name}</div>
              <div style={{ marginTop: 4, height: 3, background: surface2, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${agent.confidence}%`, borderRadius: 2, background: c.color, animation: 'grow-bar 1s ease both' }} />
              </div>
            </div>
            <span style={{ fontSize: 10, fontFamily: 'monospace', color: c.color, flexShrink: 0 }}>{agent.confidence}%</span>
          </div>
        )
      })}

      {/* Logout */}
      {user && (
        <button
          onClick={() => { logout(); setOpen(false) }}
          style={{
            marginTop: 16, width: '100%', padding: '10px 12px',
            display: 'flex', alignItems: 'center', gap: 10,
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: '1px solid rgba(255,82,82,0.25)',
            background: 'rgba(255,82,82,0.06)',
            color: '#ff5252', fontFamily: 'inherit', textAlign: 'left',
            transition: 'all 0.18s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,82,82,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,82,82,0.06)'}
        >
          <span style={{ fontSize: 15 }}>🚪</span>
          <span>{t('logout')}</span>
        </button>
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