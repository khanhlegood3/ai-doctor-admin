import React, { useState, useEffect, useMemo } from 'react'
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
    { id: 'patientReflect', label: 'Patient Reflection', step: '35' },
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
  // Nhóm "AI Agents" — các màn hội đồng AI đa tác nhân (swarm/consensus/VAR),
  // tách riêng khỏi nhóm "VIP PRO Accounts Only" dù cả hai đều bị khoá theo
  // cùng cơ chế VipProGate ở App.jsx (xem VIP_PRO_PANEL_IDS).
  const AI_AGENT_STEP_IDS = new Set(['swarm', 'consensus', 'varCheck'])

  const PATIENT_JOURNEY_STEPS = STEPS.filter((step) => VIP_PRO_EXCLUDED_STEP_IDS.has(step.id))
  const AI_AGENT_STEPS = STEPS.filter((step) => AI_AGENT_STEP_IDS.has(step.id))
  const VIP_PRO_STEPS = STEPS.filter((step) => !VIP_PRO_EXCLUDED_STEP_IDS.has(step.id) && !AI_AGENT_STEP_IDS.has(step.id))

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

  // Nhóm "Profile" — luôn hiện, không bị khoá VIP PRO.
  const PROFILE_STEPS = [
    { id: 'profile', label: t('profile') || 'Hồ Sơ Cá Nhân', step: '👤' },
  ]

  // Cấu hình đầy đủ các group menu (khôi phục lại toàn bộ, không còn giới
  // hạn chỉ 2 group Admin/Mô Phỏng như commit cũ). "vip" = các mục bị khoá
  // bởi VipProGate ở App.jsx (VIP_PRO_PANEL_IDS) trừ khi user là Admin hoặc
  // tài khoản VIP PRO thật — user thường vẫn bấm được, chỉ là màn sẽ hiện
  // popup khoá + làm mờ/disable layout phía sau (xem App.jsx).
  const GROUPS = [
    { key: 'profile', label: 'Profile', items: PROFILE_STEPS, variant: 'default', defaultOpen: true, collapsible: false },
    { key: 'patientJourney', label: 'Patient Journey', items: PATIENT_JOURNEY_STEPS, variant: 'default', defaultOpen: true },
    { key: 'vipPro', label: 'VIP PRO Accounts Only', items: VIP_PRO_STEPS, variant: 'vip', defaultOpen: false },
    { key: 'aiAgents', label: 'AI Agents', items: AI_AGENT_STEPS, variant: 'vip', defaultOpen: false },
    { key: 'admin', label: 'Admin', items: ADMIN_STEPS, variant: 'admin', defaultOpen: false },
    { key: 'simulation', label: 'Mô Phỏng (Nội Bộ)', items: SIMULATION_STEPS, variant: 'admin', defaultOpen: false },
  ].filter(g => g.items.length > 0)

  const [openGroups, setOpenGroups] = useState(() => {
    const initial = {}
    GROUPS.forEach(g => { initial[g.key] = !!g.defaultOpen })
    return initial
  })

  // Tự động mở nhóm đang chứa mục active (vd: bấm từ nơi khác điều hướng
  // thẳng vào 1 màn VIP PRO/AI Agents thì nhóm tương ứng phải bung ra).
  useEffect(() => {
    const owningGroup = GROUPS.find(g => g.items.some(s => s.id === active))
    if (owningGroup && !openGroups[owningGroup.key]) {
      setOpenGroups(prev => ({ ...prev, [owningGroup.key]: true }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const toggleGroup = (key) => {
    setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (openSignal > 0) setOpen(true)
  }, [openSignal])

  const handleNavigate = (id) => {
    onNavigate(id)
    if (isMobile) setOpen(false)
  }

  const handleLogout = () => {
    logout()
    if (isMobile) setOpen(false)
  }

  const VARIANT_COLORS = {
    default: '#00e5ff',
    vip: '#f59e0b',
    admin: '#ff5252',
  }

  const sidebarContent = (
    <>
      {GROUPS.map((group, idx) => {
        const accent = VARIANT_COLORS[group.variant] || '#00e5ff'
        const collapsible = group.collapsible !== false
        const isOpen = !collapsible || !!openGroups[group.key]
        return (
          <div key={group.key} style={{ marginTop: idx === 0 ? 0 : 16 }}>
            {collapsible ? (
              <button
                onClick={() => toggleGroup(group.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  padding: '0 2px 8px', fontFamily: 'monospace',
                }}
              >
                <span style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: group.variant === 'default' ? text3 : accent, fontWeight: group.variant === 'default' ? 400 : 700 }}>
                  {group.label}
                </span>
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: 9, color: text3, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>▶</span>
              </button>
            ) : (
              <SectionLabel color={text3} style={{ marginTop: 0 }}>{group.label}</SectionLabel>
            )}
            {isOpen && group.items.map(s => (
              <NavItem key={s.id} active={active === s.id} onClick={() => handleNavigate(s.id)} text={accent} text2={text2} isDark={isDark} variant={group.variant}>
                {s.icon && <span style={{ fontSize: 12 }}>{s.icon}</span>}
                <span style={{ flex: 1 }}>{s.label}</span>
                <span style={{ fontSize: 10, fontFamily: 'monospace', color: accent }}>{s.step}</span>
              </NavItem>
            ))}
          </div>
        )
      })}

      <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${border}` }}>
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
            cursor: 'pointer', width: '100%', textAlign: 'left',
            background: 'transparent', border: `1px solid ${border}`,
            color: '#ff5252', fontSize: 13, fontFamily: 'inherit', fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 14 }}>🚪</span>
          <span style={{ flex: 1 }}>{t('logout') || 'Đăng Xuất'}</span>
        </button>
      </div>
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

function NavItem({ active, onClick, children, text, text2, isDark, variant = 'default' }) {
  const activeColor = text || (variant === 'admin' ? '#ff5252' : variant === 'vip' ? '#f59e0b' : '#00e5ff')
  const activeBg = variant === 'admin' ? 'rgba(255,82,82,0.07)' : variant === 'vip' ? 'rgba(245,158,11,0.08)' : 'rgba(0,229,255,0.07)'
  const activeBorder = variant === 'admin' ? 'rgba(255,82,82,0.3)' : variant === 'vip' ? 'rgba(245,158,11,0.35)' : 'rgba(0,229,255,0.25)'
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8,
      cursor: 'pointer',
      background: active ? activeBg : 'transparent',
      border: `1px solid ${active ? activeBorder : 'transparent'}`,
      color: active ? activeColor : text2,
      fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
      textAlign: 'left', width: '100%', transition: 'all 0.18s',
    }}>{children}</button>
  )
}