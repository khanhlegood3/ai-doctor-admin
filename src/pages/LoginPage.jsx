import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import anonymousProfileImg from './AnonymousProfileUUID-Avatar-1080x720.png'
import BackButton from '../components/common/BackButton.jsx'
import UserUuid3DAvatar from '../components/UserUuid3DAvatar.jsx'

const SHOW_APPLE_LOGIN_BUTTON = false

export default function LoginPage({ onSuccess, onBack }) {
  const { loginWithGoogle, loginWithApple, loginWithEmail, loginAnonymous } = useAuth()
  const { t, theme, toggleTheme, lang, setLang } = useApp()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // ─── UUID / tên người giới thiệu (Referrer) — trang này là nơi HỨNG link
  // giới thiệu (?ref=<uuid>&refName=<tên>, xem App.jsx) trước khi tài khoản
  // mới thực sự tồn tại. UUID lấy từ sessionStorage nếu có sẵn (đến từ link)
  // hoặc người dùng tự dán tay bằng nút "Paste UUID". Tên KHÔNG cho gõ tay —
  // luôn tự tra lại qua /api/user-profile mỗi khi UUID đổi, để tránh trường
  // hợp gõ nhầm/gõ bừa tên khác với UUID thật.
  const [referrerUuid, setReferrerUuid] = useState('')
  const [referrerName, setReferrerName] = useState('')
  const [resolvingReferrerName, setResolvingReferrerName] = useState(false)
  const referrerNameCacheRef = useRef({}) // { [uuid]: name|null } — tránh tra lại uuid vừa mới tra xong

  useEffect(() => {
    try {
      const pending = JSON.parse(sessionStorage.getItem('cdoc_pending_referral') || 'null')
      if (pending?.uuid) {
        setReferrerUuid(pending.uuid)
        if (pending.name) setReferrerName(pending.name) // hiện tạm ngay (optimistic) trong lúc chờ tra lại từ server
      }
    } catch { /* ignore */ }
  }, [])

  // Ghi lại sessionStorage mỗi khi UUID đổi, để App.jsx (tự điều hướng sau
  // khi có tài khoản) và AffiliateUUIDReferralPanel.jsx (điền sẵn ô UUID)
  // luôn thấy đúng giá trị mới nhất — kể cả khi người dùng tự dán 1 UUID
  // khác với UUID có sẵn từ link.
  useEffect(() => {
    try {
      if (referrerUuid.trim()) {
        sessionStorage.setItem('cdoc_pending_referral', JSON.stringify({ uuid: referrerUuid.trim(), name: referrerName }))
      } else {
        sessionStorage.removeItem('cdoc_pending_referral')
      }
    } catch { /* ignore */ }
  }, [referrerUuid, referrerName])

  // Tự tra tên theo UUID mỗi khi UUID đổi (debounce 400ms để không gọi API
  // liên tục lúc đang gõ/dán).
  useEffect(() => {
    const uuid = referrerUuid.trim()
    if (!uuid) { setReferrerName(''); setResolvingReferrerName(false); return }
    if (uuid in referrerNameCacheRef.current) {
      setReferrerName(referrerNameCacheRef.current[uuid] || '')
      return
    }
    setResolvingReferrerName(true)
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/user-profile?uuid=${encodeURIComponent(uuid)}`)
        const data = await res.json().catch(() => ({}))
        const resolved = res.ok ? (data?.name || '') : ''
        referrerNameCacheRef.current[uuid] = resolved
        setReferrerName(resolved)
      } catch {
        // Giữ nguyên tên optimistic (nếu có từ link) khi không tra được do lỗi mạng
      } finally {
        setResolvingReferrerName(false)
      }
    }, 400)
    return () => window.clearTimeout(timer)
  }, [referrerUuid])

  const handlePasteReferrerUuid = async () => {
    try {
      const text = (await navigator.clipboard.readText())?.trim()
      if (text) setReferrerUuid(text)
    } catch {
      setError(lang === 'vi' ? 'Không đọc được clipboard — hãy dán tay (Cmd/Ctrl+V) vào ô UUID.' : 'Could not read clipboard — please paste manually (Cmd/Ctrl+V).')
    }
  }

  const isDark = theme === 'dark'

  const handle = async (fn) => {
    setError('')
    setLoading(true)
    try { await fn(); onSuccess?.() }
    catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  const s = {
    page: {
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isDark
        ? 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,180,200,0.08) 0%, transparent 60%), #04060f'
        : 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,180,200,0.06) 0%, transparent 60%), #f0f4f8',
      padding: 'clamp(14px, 4vw, 24px)',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
      position: 'relative',
    },
    card: {
      width: '100%', maxWidth: 420,
      background: isDark ? 'rgba(8,12,26,0.95)' : 'rgba(255,255,255,0.98)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 20, padding: 'clamp(22px, 6vw, 36px) clamp(18px, 6vw, 32px)',
      boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.6)' : '0 24px 80px rgba(0,0,0,0.12)',
    },
    logo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, justifyContent: 'center' },
    logoIcon: {
      width: 44, height: 44, borderRadius: 12,
      background: 'linear-gradient(135deg, #00b8cc, #6b3fd4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', fontSize: 14, fontWeight: 800, color: '#fff',
    },
    title: { fontSize: 22, fontWeight: 800, color: isDark ? '#e8f0f8' : '#1a2035', textAlign: 'center', marginBottom: 4 },
    sub: { fontSize: 12, color: isDark ? 'rgba(232,240,248,0.4)' : '#888', textAlign: 'center', marginBottom: 28 },
    socialBtn: () => ({
      width: '100%', padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
      background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
      color: isDark ? '#e8f0f8' : '#1a2035',
      fontSize: 14, fontWeight: 600, marginBottom: 10,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
      transition: 'all 0.18s',
    }),
    divider: {
      display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0',
      color: isDark ? 'rgba(232,240,248,0.28)' : '#bbb', fontSize: 12,
    },
    line: { flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)' },
    input: {
      width: '100%', padding: '12px 14px', borderRadius: 10, marginBottom: 12,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)'}`,
      background: isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc',
      color: isDark ? '#e8f0f8' : '#1a2035', fontSize: 14, outline: 'none',
      boxSizing: 'border-box',
    },
    primaryBtn: {
      width: '100%', padding: '13px', borderRadius: 12, cursor: 'pointer', border: 'none',
      background: 'linear-gradient(135deg, #00b8cc, #6b3fd4)',
      color: '#fff', fontSize: 14, fontWeight: 700, marginTop: 4,
      opacity: loading ? 0.7 : 1,
    },
    error: { color: '#ff5252', fontSize: 12, marginBottom: 10, textAlign: 'center' },
    switch: { textAlign: 'center', marginTop: 20, fontSize: 13, color: isDark ? 'rgba(232,240,248,0.5)' : '#888' },
    switchBtn: { color: '#00b8cc', cursor: 'pointer', fontWeight: 600, background: 'none', border: 'none', fontSize: 13 },
    themeBtn: {
      background: 'none', cursor: 'pointer', fontSize: 16, fontWeight: 600,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
      borderRadius: 8, padding: '6px 12px',
      color: isDark ? '#e8f0f8' : '#1a2035',
    },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: isDark ? 'rgba(232,240,248,0.6)' : '#555', marginBottom: 6 },
  }

  return (
    <div style={s.page}>
      <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button style={s.themeBtn} onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')}>
          {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
        </button>
        <button style={s.themeBtn} onClick={toggleTheme} title="Toggle theme">
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={s.card}>
        <div style={s.logo}>
          <div style={s.logoIcon}>Rx</div>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 800, color: '#00e5ff', letterSpacing: '0.08em' }}>CONSENSUS DOCTOR</div>
            <div style={{ fontSize: 10, color: isDark ? 'rgba(232,240,248,0.35)' : '#aaa', letterSpacing: '0.1em' }}>AI MEDICAL PLATFORM</div>
          </div>
        </div>

        <div style={s.title}>{mode === 'login' ? t('login') : t('register')}</div>
        <div style={s.sub}>{t('tagline')}</div>

        {/* ── Start Now (Anonymous) ── */}
        <button
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 14, cursor: 'pointer', border: 'none',
            background: 'linear-gradient(135deg, #1a6640, #2d8a5e, #00b8cc)',
            color: '#fff', fontSize: 15, fontWeight: 800, marginBottom: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: '0 4px 20px rgba(0,184,204,0.3)',
            opacity: loading ? 0.7 : 1,
          }}
          onClick={() => handle(loginAnonymous)}
          disabled={loading}
        >
          🌿 {lang === 'vi' ? 'Bắt đầu với ẩn danh' : 'Start anonymously'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: isDark ? 'rgba(232,240,248,0.4)' : '#999' }}>
            {lang === 'vi' ? 'Không cần tài khoản · Tiến trình lưu trên thiết bị này' : 'No account required · Progress saved on this device'}
          </span>
          <button
            onClick={() => setShowHelp(true)}
            title={lang === 'vi' ? 'Mở hướng dẫn Avatar 3D' : 'Open 3D Avatar guide'}
            style={{
              flexShrink: 0,
              border: `1px solid ${isDark ? 'rgba(0,229,255,0.45)' : 'rgba(0,184,204,0.5)'}`,
              background: isDark ? 'rgba(0,229,255,0.10)' : 'rgba(0,184,204,0.08)',
              color: isDark ? '#00e5ff' : '#00b8cc',
              borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              lineHeight: 1, transition: 'all 0.18s',
            }}
          >
            🧊 Avatar 3D
          </button>
          <button
            onClick={() => setShowHelp(true)}
            title={lang === 'vi' ? 'Trợ giúp về hồ sơ ẩn danh' : 'Help: Anonymous Profile'}
            style={{
              flexShrink: 0,
              width: 26, height: 26, borderRadius: '50%',
              border: `1px solid ${isDark ? 'rgba(0,229,255,0.45)' : 'rgba(0,184,204,0.5)'}`,
              background: isDark ? 'rgba(0,229,255,0.10)' : 'rgba(0,184,204,0.08)',
              color: isDark ? '#00e5ff' : '#00b8cc',
              fontSize: 13, fontWeight: 900, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0,
              transition: 'all 0.18s',
            }}
          >
            ?
          </button>
        </div>

        {/* ── Help Popup Modal ── */}
        {showHelp && (
          <div
            onClick={() => setShowHelp(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.72)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20, backdropFilter: 'blur(6px)',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 640,
                background: isDark ? '#0b1120' : '#fff',
                borderRadius: 20,
                border: `1px solid ${isDark ? 'rgba(0,229,255,0.2)' : 'rgba(0,184,204,0.2)'}`,
                boxShadow: '0 32px 100px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Modal header */}
              <div style={{
                padding: '18px 22px',
                background: 'linear-gradient(135deg, #1a6640, #2d8a5e, #00b8cc)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>
                    🌿 {lang === 'vi' ? 'Hồ sơ ẩn danh (UUID) là gì?' : 'What is an Anonymous Profile (UUID)?'}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
                    {lang === 'vi' ? 'Bắt đầu ngay — không cần đăng ký tài khoản' : 'Start instantly — no account registration needed'}
                  </div>
                </div>
                <button
                  onClick={() => setShowHelp(false)}
                  style={{
                    background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8,
                    width: 32, height: 32, cursor: 'pointer', color: '#fff',
                    fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>

              {/* Scrollable body */}
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Banner image */}
                <img
                  src={anonymousProfileImg}
                  alt="Anonymous Profile UUID"
                  style={{ display: 'block', width: '100%', height: 'auto' }}
                />

                {/* Video section */}
                <div style={{ padding: '20px 22px 24px' }}>
                  <div style={{
                    fontSize: 13, fontWeight: 800,
                    color: isDark ? '#00e5ff' : '#2d8a5e',
                    marginBottom: 12, letterSpacing: '.05em', textTransform: 'uppercase',
                  }}>
                    🎬 {lang === 'vi' ? 'Video hướng dẫn' : 'Tutorial Video'}
                  </div>
                  <div className="login-help-video-avatar-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.85fr) minmax(180px, 1fr)', gap: 14, alignItems: 'stretch' }}>
                    <div style={{
                      borderRadius: 14, overflow: 'hidden',
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                      background: '#000', aspectRatio: '9/16', maxHeight: 500,
                    }}>
                      <iframe
                        src="https://www.youtube.com/embed/dw_8mIuH9DY?autoplay=0&rel=0&modestbranding=1"
                        title="Anonymous Profile UUID"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 12, minHeight: 320 }}>
                      <UserUuid3DAvatar uuid="anonymous-profile-demo-uuid" isDark={isDark} vi={lang === 'vi'} accent="#2d8a5e" label={lang === 'vi' ? 'Guest UUID' : 'Guest UUID'} height="100%" minWidth={160} />
                      <UserUuid3DAvatar uuid="real-account-profile-demo-uuid" isDark={isDark} vi={lang === 'vi'} accent="#00b8cc" label={lang === 'vi' ? 'User UUID' : 'User UUID'} height="100%" minWidth={160} />
                    </div>
                  </div>

                  <style>{`@media (max-width: 720px) { .login-help-video-avatar-grid { grid-template-columns: 1fr !important; } }`}</style>

                  {/* Short description */}
                  <div style={{
                    marginTop: 16, padding: '14px 16px', borderRadius: 12,
                    background: isDark ? 'rgba(45,138,94,0.1)' : 'rgba(45,138,94,0.06)',
                    border: `1px solid ${isDark ? 'rgba(45,138,94,0.3)' : 'rgba(45,138,94,0.2)'}`,
                    fontSize: 13, color: isDark ? 'rgba(232,240,248,0.8)' : '#334', lineHeight: 1.7,
                  }}>
                    {lang === 'vi'
                      ? '🔑 Mỗi thiết bị được cấp một UUID duy nhất. Hồ sơ, cấp độ và tiến trình của bạn được lưu ngay trên thiết bị — không cần email hay mật khẩu. Bạn có thể nâng cấp lên tài khoản thật bất cứ lúc nào để đồng bộ đa thiết bị.'
                      : '🔑 Each device receives a unique UUID. Your profile, level, and progress are saved directly on this device — no email or password needed. You can upgrade to a real account at any time to sync across devices.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={s.divider}><div style={s.line}/>{lang === 'vi' ? 'HOẶC' : 'OR'}<div style={s.line}/></div>

        {/* Google — profile auto-filled from OAuth */}
        <button style={s.socialBtn()} onClick={() => handle(() => loginWithGoogle())}>
          <GoogleIcon />
          {t('continueGoogle')}
          <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.5 }}>
            {t('autoAvatar')}
          </span>
        </button>

        {/* Tạm ẩn Apple login, giữ nguyên code để bật lại sau. */}
        {SHOW_APPLE_LOGIN_BUTTON && (
          <button style={s.socialBtn()} onClick={() => handle(loginWithApple)}>
            <AppleIcon isDark={isDark} />
            {t('continueApple')}
          </button>
        )}

        <div style={s.divider}><div style={s.line}/>{t('orEmail')}<div style={s.line}/></div>

        {mode === 'register' && (
          <>
            <label style={s.label}>{t('name')}</label>
            <input style={s.input} placeholder="Nguyễn Văn A" value={name} onChange={e => setName(e.target.value)} />

            <label style={s.label}>{lang === 'vi' ? 'UUID người giới thiệu (nếu có)' : 'Referrer UUID (optional)'}</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                style={{ ...s.input, marginBottom: 0, fontFamily: 'monospace', fontSize: 12 }}
                placeholder={lang === 'vi' ? 'Dán UUID người mời bạn...' : 'Paste inviter UUID...'}
                value={referrerUuid}
                onChange={e => setReferrerUuid(e.target.value)}
              />
              <button
                type="button"
                onClick={handlePasteReferrerUuid}
                title={lang === 'vi' ? 'Dán UUID từ clipboard' : 'Paste UUID from clipboard'}
                style={{
                  flexShrink: 0, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1px solid ${isDark ? 'rgba(0,229,255,0.4)' : 'rgba(0,184,204,0.4)'}`,
                  background: isDark ? 'rgba(0,229,255,0.10)' : 'rgba(0,184,204,0.08)',
                  color: isDark ? '#00e5ff' : '#00b8cc', fontSize: 12, fontWeight: 700,
                }}
              >
                📋 Paste UUID
              </button>
            </div>

            {referrerUuid.trim() && (
              <>
                <label style={s.label}>{lang === 'vi' ? 'Tên người giới thiệu' : 'Referrer name'}</label>
                <input
                  style={{ ...s.input, opacity: 0.85, cursor: 'not-allowed' }}
                  readOnly
                  value={resolvingReferrerName ? (lang === 'vi' ? 'Đang tra cứu…' : 'Looking up…') : (referrerName || (lang === 'vi' ? 'Không tìm thấy tên — kiểm tra lại UUID' : 'Name not found — double-check the UUID'))}
                />
              </>
            )}
          </>
        )}
        <label style={s.label}>{t('email')}</label>
        <input style={s.input} type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} />
        <label style={s.label}>{t('password')}</label>
        <input
          style={s.input} type="password" placeholder="••••••••"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handle(() => loginWithEmail(email, password, mode === 'register' ? name : null))}
        />

        {error && <div style={s.error}>{error}</div>}

        <button style={s.primaryBtn} onClick={() => handle(() => loginWithEmail(email, password, mode === 'register' ? name : null))}>
          {loading ? '...' : (mode === 'login' ? t('login') : t('register'))}
        </button>

        {/* Admin shortcut — uses Google OAuth profile for khanhlegood1@gmail.com */}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            style={{ ...s.switchBtn, fontSize: 11, color: '#9c6fff' }}
            onClick={() => handle(() => loginWithGoogle('khanhlegood1@gmail.com'))}
          >
            🔑 {t('adminLoginGoogle')}
          </button>
        </div>

        <div style={s.switch}>
          {mode === 'login' ? t('noAccount') : t('hasAccount')}{' '}
          <button style={s.switchBtn} onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}>
            {mode === 'login' ? t('register') : t('login')}
          </button>
        </div>

        {/* Quay lại — đồng bộ vị trí/hình dạng với các nút điều hướng khác
        trong toàn dự án, luôn đặt ở dưới cùng màn hình. */}
        {onBack && (
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
            <BackButton isDark={isDark} label={lang === 'vi' ? 'Quay lại' : 'Back'} onClick={onBack} />
          </div>
        )}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
      <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
      <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18z"/>
      <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z"/>
    </svg>
  )
}

function AppleIcon({ isDark }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill={isDark ? '#fff' : '#000'}>
      <path d="M12.52 9.12a3.8 3.8 0 011.82-3.2 3.9 3.9 0 00-3.08-1.66c-1.3-.14-2.56.77-3.22.77-.67 0-1.69-.75-2.78-.73A4.1 4.1 0 001.8 6.56c-1.5 2.6-.38 6.43 1.06 8.53.72 1.03 1.56 2.18 2.66 2.14 1.08-.04 1.49-.69 2.79-.69 1.3 0 1.67.69 2.8.67 1.15-.02 1.88-1.03 2.58-2.07a8.56 8.56 0 001.17-2.4 3.68 3.68 0 01-2.34-3.62zM10.48 3.12A3.75 3.75 0 0011.42.5a3.8 3.8 0 00-2.46 1.27 3.56 3.56 0 00-.88 2.57 3.14 3.14 0 002.4-1.22z"/>
    </svg>
  )
}
