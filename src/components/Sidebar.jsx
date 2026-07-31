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

export default function Sidebar({ active, onNavigate, openSignal = 0, mobileOpen, onMobileOpenChange }) {
  const { user, logout } = useAuth()
  const { t, theme } = useApp()
  const isDark = theme === 'dark'
  const isMobile = useIsMobile()
  // Trạng thái mở/đóng trên mobile giờ được điều khiển từ App.jsx (qua nút
  // hamburger nằm trong Topbar, luôn nằm dưới chữ "ZoFo") — dùng
  // mobileOpen/onMobileOpenChange nếu được truyền vào, fallback về state nội
  // bộ để phòng trường hợp component được dùng mà không truyền 2 prop này.
  const [internalOpen, setInternalOpen] = useState(false)
  const open = mobileOpen !== undefined ? mobileOpen : internalOpen
  const setOpen = onMobileOpenChange || setInternalOpen

  const border   = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const bg       = isDark ? 'rgba(4,6,15,0.97)'      : 'rgba(255,255,255,0.97)'
  const text     = isDark ? '#e8f0f8'                 : '#1a2035'
  const text2    = isDark ? 'rgba(232,240,248,0.55)'  : '#666'
  const text3    = isDark ? 'rgba(232,240,248,0.28)'  : '#aaa'
  const surface  = isDark ? 'rgba(255,255,255,0.03)'  : 'rgba(0,0,0,0.03)'
  const surface2 = isDark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.06)'

  const STEPS = [
    { id: 'bodyProtectionJourney', label: t('nav_bodyProtectionJourney'), step: '01' },
    { id: 'affiliateGame', label: t('nav_affiliateGame'), step: '01f' },
    { id: 'hero3DMap', label: t('nav_hero3DMap'), step: '01a' },
    { id: 'myPainPathBody', label: t('nav_myPainPathBody'), step: '01b' },
    { id: 'myPainPathBodyPixel', label: t('nav_myPainPathBodyPixel'), step: '01c' },
    { id: 'myPainPathNoiTang', label: t('nav_myPainPathNoiTang'), step: '01d' },
    { id: 'myPainPathNoiTangPixel', label: t('nav_myPainPathNoiTangPixel'), step: '01e' },
    { id: 'healthJourneyGame', label: t('nav_healthJourneyGame'), step: '02' },
    { id: 'stressRelief', label: t('stressRelief'), step: '02b' },
    { id: 'waterDrinkChatBot', label: t('waterDrinkChatBot'), step: '02c' },
    { id: 'organConnection', label: t('nav_organConnection'), step: '02d' },
    { id: 'cookingGuide', label: t('nav_cookingGuide'), step: '02e' },
    { id: 'medicalAssetStore', label: t('nav_medicalAssetStore'), step: '03' },
    { id: 'medicalVisualPlayground', label: t('nav_medicalVisualPlayground'), step: '04' },
    { id: 'medicalVisualCameraAngle3D', label: t('nav_medicalVisualCameraAngle3D'), step: '04b' },
    { id: 'myRewardHealth', label: t('nav_myRewardHealth'), step: '05' },
    { id: 'affiliate', label: t('nav_affiliate'), step: '05b' },
    { id: 'rssPortal', label: t('nav_rssPortal'), step: '06' },
    { id: 'wikiMedVision', label: t('wikiMedVision'), step: '08' },
    { id: 'fullDocSummarization', label: t('nav_fullDocSummarization'), step: '09' },
    { id: 'documentOCR', label: t('nav_documentOCR'), step: '10' },
    { id: 'cameraAngle3DStudio', label: t('nav_cameraAngle3DStudio'), step: '11' },
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
    { id: 'varCheck', label: t('nav_varCheck'), step: '29' },
    { id: 'protein3d', label: t('protein3d'), step: '30' },
    { id: 'aiHealthcareVision', label: t('aiHealthcareVision'), step: '31' },
    { id: 'visionSync', label: t('visionSync'), step: '31b' },
    { id: 'videoToLearning', label: t('videoToLearning'), step: '31c' },
    { id: 'aiInbodyPortal', label: t('aiInbodyPortal'), step: '33' },
    { id: 'printPortal', label: t('nav_printPortal'), step: '34' },
    { id: 'patientReflect', label: t('nav_patientReflect'), step: '35' },
    { id: 'chatHistory', label: t('nav_chatHistory'), step: '36' },
  ]

  const VIP_PRO_EXCLUDED_STEP_IDS = new Set([
    'bodyProtectionJourney',
    'affiliateGame',
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
    'cookingGuide',
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
    'visionSync',
    'patientReflect',
    'stressRelief',
    'chatHistory',
  ])
  const PATIENT_JOURNEY_STEPS = STEPS.filter((step) => VIP_PRO_EXCLUDED_STEP_IDS.has(step.id))
  const VIP_PRO_STEPS = STEPS.filter((step) => !VIP_PRO_EXCLUDED_STEP_IDS.has(step.id))

  const ADMIN_STEPS = user?.isAdmin ? [
    { id: 'make3DModel', label: t('admin_make3DModel'), step: 'CULTS', icon: '🧙‍♀️' },
    { id: 'my3dAsset', label: t('admin_my3dAsset'), step: 'GLB', icon: '🧊' },
    { id: 'twoDTo3DAsset', label: t('admin_twoDTo3DAsset'), step: '05b', icon: '🖼️' },
    { id: 'xyzCameraAngle', label: t('xyzCameraAngle'), step: '05b2', icon: '📐' },
    { id: 'aiHealthcareVisionControl', label: t('aiHealthcareVisionControl'), step: '24b' },
    { id: 'admin', label: t('adminPanel'), step: '★', icon: '🛡️' },
    { id: 'affiliateAdmin', label: t('admin_affiliateAdmin'), step: 'AFF', icon: '🤝' },
    { id: 'roleMembershipAdmin', label: t('admin_roleMembershipAdmin'), step: 'ROLE', icon: '🛂' },
    { id: 'moralisPlaygroundAdmin', label: t('admin_moralisPlaygroundAdmin'), step: 'MORALIS', icon: '🧪' },
    { id: 'affiliateWebhookAdmin', label: t('admin_affiliateWebhookAdmin'), step: 'WEBHOOK', icon: '🔗' },
    { id: 'create3DVideoFrom2D', label: t('admin_create3DVideoFrom2D'), step: '3D2D', icon: '🎥' },
    { id: 'adminConcept', label: t('admin_adminConcept'), step: '00', icon: '🧭' },
  ] : []

  // Nhóm menu MÔ PHỎNG/NỘI BỘ — tách riêng khỏi nhóm Admin thật ở trên. Đây là
  // các màn demo/sandbox dùng dữ liệu giả (không liên kết UUID/user_profiles
  // thật), chỉ dành cho Admin xem/test, KHÔNG phải dữ liệu affiliate thật của
  // người dùng (xem chú thích trong App.jsx — ADMIN_ONLY_PANELS).
  const SIMULATION_STEPS = user?.isAdmin ? [
    { id: 'affiliateControl', label: t('sim_affiliateControl'), step: 'SIM', icon: '🧪' },
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
        <span style={{ flex: 1 }}>{t('nav_zeroToForever')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>ZOFO</span>
      </NavItem>
      <NavItem active={active === 'chooseUserRole'} onClick={() => handleNavigate('chooseUserRole')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🎭</span>
        <span style={{ flex: 1 }}>{t('nav_chooseUserRole')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>NEW</span>
      </NavItem>
      <NavItem active={active === 'donationHero'} onClick={() => handleNavigate('donationHero')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🦸</span>
        <span style={{ flex: 1 }}>{t('nav_donationHero')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>GAN</span>
      </NavItem>
      <NavItem active={active === 'affiliateUuidReferral'} onClick={() => handleNavigate('affiliateUuidReferral')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🔗</span>
        <span style={{ flex: 1 }}>{t('nav_affiliateUuidReferral')}</span>
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
        <span style={{ flex: 1 }}>{t('nav_avatarCreator')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>VRM</span>
      </NavItem>
      <NavItem active={active === 'comicHeroGame'} onClick={() => handleNavigate('comicHeroGame')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>📖</span>
        <span style={{ flex: 1 }}>{t('nav_comicHeroGame')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>NEW</span>
      </NavItem>
      <NavItem active={active === 'comicIssueLibrary'} onClick={() => handleNavigate('comicIssueLibrary')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>📚</span>
        <span style={{ flex: 1 }}>{t('nav_comicIssueLibrary')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>LIB</span>
      </NavItem>
      <NavItem active={active === 'petPassportAdventure'} onClick={() => handleNavigate('petPassportAdventure')} text={text} text2={text2} isDark={isDark}>
        <span style={{ fontSize: 13 }}>🐾</span>
        <span style={{ flex: 1 }}>{t('nav_petPassportAdventure')}</span>
        <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>NEW</span>
      </NavItem>
      <SectionLabel color={text3} style={{ marginTop: 16 }}>{t('section_patientsJourney')}</SectionLabel>
      {PATIENT_JOURNEY_STEPS.map(s => (
        <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text={text} text2={text2} isDark={isDark}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: active === s.id ? '#00e5ff' : text3, flexShrink: 0, transition: 'background 0.2s' }} />
          <span style={{ flex: 1 }}>{s.label}</span>
          <span style={{ fontSize: 10, fontFamily: 'monospace', color: text3 }}>{s.step}</span>
        </NavItem>
      ))}

      {VIP_PRO_STEPS.length > 0 && (
        <>
          <SectionLabel color={text3} style={{ marginTop: 16 }}>{t('section_vipProOnly')}</SectionLabel>
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
          <SectionLabel color={text3} style={{ marginTop: 16 }}>{t('section_admin')}</SectionLabel>
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
          <SectionLabel color={text3} style={{ marginTop: 16 }}>{t('section_simulationInternal')}</SectionLabel>
          {SIMULATION_STEPS.map(s => (
            <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text="#ff5252" text2={text2} isDark={isDark} isAdmin>
              <span style={{ fontSize: 12 }}>{s.icon || '🧪'}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#ff5252' }}>{s.step}</span>
            </NavItem>
          ))}
        </>
      )}

      <SectionLabel color={text3} style={{ marginTop: 16 }}>{t('section_aiAgents')}</SectionLabel>
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