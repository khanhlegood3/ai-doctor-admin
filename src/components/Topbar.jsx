import React, { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'
import { useNotifications } from '../lib/notifications.js'
import zofoLogo from '../assets/landing/ZeroToForever_Logo.png'

export default function Topbar({ activePanel, onNavigateProfile, onNavigateAdmin }) {
  const { user, logout } = useAuth()
  const { t, theme, toggleTheme, lang, setLang } = useApp()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const { notifications, unreadCount, markAllRead } = useNotifications(user)
  const isDark = theme === 'dark'

  // Topbar vốn không có breakpoint nào (flex row cố định, không wrap) nên
  // trên điện thoại: tagline dài "Zero to Forever Foundation · Become The
  // Hero Within" tự xuống dòng, và span "4 AGENT ĐANG HOẠT ĐỘNG" cũng xuống
  // dòng theo từng chữ — hai khối đè lên nhau ở góc trái. Dùng matchMedia để
  // rút gọn nội dung trên màn hình hẹp thay vì để trình duyệt tự wrap lung tung.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false
  )
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 640px)')
    const onChange = (e) => setIsMobile(e.matches)
    mq.addEventListener ? mq.addEventListener('change', onChange) : mq.addListener(onChange)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', onChange) : mq.removeListener(onChange)
    }
  }, [])

  const headerBg = isDark ? 'rgba(4,6,15,0.92)' : 'rgba(255,255,255,0.92)'
  const borderColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)'
  const textColor = isDark ? '#e8f0f8' : '#1a2035'
  const text2 = isDark ? 'rgba(232,240,248,0.55)' : '#666'
  const text3 = isDark ? 'rgba(232,240,248,0.35)' : '#aaa'
  const menuBg = isDark ? '#080c1a' : '#fff'

  // Provider badge colours
  const providerLabel = { google: 'Google', apple: 'Apple', email: 'Email' }
  const providerColor = { google: '#4285F4', apple: '#555', email: '#6b3fd4' }

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', rowGap: 8, columnGap: 8,
      padding: isMobile ? '8px 12px' : '10px 24px', borderBottom: `1px solid ${borderColor}`,
      background: headerBg, backdropFilter: 'blur(12px)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, minWidth: 0 }}>
        <img src={zofoLogo} alt="ZoFo — Zero to Forever Foundation" style={{ height: isMobile ? 28 : 42, width: 'auto', objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 13, letterSpacing: '0.08em', color: '#00e5ff', whiteSpace: 'nowrap' }}>
            ZoFo
          </div>
          {/* Tagline dài — ẩn hẳn trên mobile thay vì để nó tự xuống dòng đè lên khối bên phải */}
          {!isMobile && (
            <div style={{ fontSize: 10, color: text3, letterSpacing: '0.12em', fontFamily: 'monospace', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Zero to Forever Foundation · Become The Hero Within
            </div>
          )}
        </div>
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 14, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* Live agents indicator — trên mobile chỉ còn chấm xanh + số, bỏ nhãn chữ dài để không bị wrap từng chữ */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e676', boxShadow: '0 0 8px #00e676', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: '#00e676', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
            {isMobile ? '4' : `4 ${t('agentsActive')}`}
          </span>
        </div>
        {/* Guest badge */}
        {user?.isAnonymous && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8,
            background: 'rgba(45,138,94,0.15)', border: '1px solid rgba(45,138,94,0.35)', color: '#5ef5a0',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            🌿 {isMobile ? 'Guest' : (lang === 'vi' ? 'Đang duyệt với tư cách Guest' : 'Browsing as Guest')}
          </div>
        )}

        {/* Lang toggle */}
        <button onClick={() => setLang(l => l === 'vi' ? 'en' : 'vi')} style={{
          padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600,
          border: `1px solid ${borderColor}`, background: 'none', color: textColor, flexShrink: 0, whiteSpace: 'nowrap',
        }}>
          {lang === 'vi' ? '🇻🇳 VI' : '🇬🇧 EN'}
        </button>


        {/* Notification center */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setShowNotifications(v => !v); if (!showNotifications) markAllRead() }}
              title={lang === 'vi' ? 'Thông báo' : 'Notifications'}
              style={{
                width: 38, height: 38, borderRadius: 19, cursor: 'pointer', position: 'relative',
                border: `1px solid ${borderColor}`,
                background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(246,247,249,0.95)',
                color: textColor, boxShadow: isDark ? 'inset 0 1px rgba(255,255,255,0.08)' : '0 2px 10px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }}
              aria-label={lang === 'vi' ? `Thông báo, ${unreadCount} chưa đọc` : `Notifications, ${unreadCount} unread`}
            >
              🔔
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 999,
                  background: '#ff3b30', color: '#fff', border: `2px solid ${headerBg}`,
                  fontSize: 10, fontWeight: 800, lineHeight: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div
                onMouseLeave={() => setShowNotifications(false)}
                style={{
                  position: 'absolute', top: 46, right: 0, width: 340, maxWidth: 'calc(100vw - 24px)',
                  background: menuBg, border: `1px solid ${borderColor}`, borderRadius: 18, padding: 10,
                  boxShadow: isDark ? '0 18px 54px rgba(0,0,0,0.55)' : '0 16px 48px rgba(0,0,0,0.16)', zIndex: 220,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px 10px' }}>
                  <div>
                    <div style={{ color: textColor, fontSize: 14, fontWeight: 900 }}>{lang === 'vi' ? 'Thông báo' : 'Notifications'}</div>
                    <div style={{ color: text3, fontSize: 10 }}>{lang === 'vi' ? 'Trung tâm theo dõi hệ thống' : 'System tracking center'}</div>
                  </div>
                  {user.isAdmin && (
                    <button type="button" onClick={() => { onNavigateAdmin?.(); setShowNotifications(false) }} style={{ border: 'none', background: 'rgba(0,184,204,0.12)', color: '#00b8cc', borderRadius: 999, padding: '6px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                      Dashboard
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: text3, fontSize: 12 }}>
                    {lang === 'vi' ? 'Chưa có thông báo mới.' : 'No notifications yet.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto' }}>
                    {notifications.slice(0, 8).map(item => (
                      <div key={item.id} style={{
                        padding: 12, borderRadius: 14, border: `1px solid ${borderColor}`,
                        background: item.type === 'system-error' ? 'rgba(255,183,77,0.10)' : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)'),
                      }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                          <span style={{ fontSize: 17 }}>{item.type === 'system-error' ? '🚨' : '🔔'}</span>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ color: textColor, fontSize: 12, fontWeight: 800, lineHeight: 1.35 }}>{item.title || (lang === 'vi' ? 'Thông báo hệ thống' : 'System notification')}</div>
                            <div style={{ color: text2, fontSize: 11, lineHeight: 1.45, marginTop: 3 }}>{item.message}</div>
                            <div style={{ color: text3, fontSize: 10, marginTop: 6, fontFamily: 'monospace' }}>
                              {new Date(item.createdAt).toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Theme toggle */}
        <button onClick={toggleTheme} style={{
          width: 34, height: 34, borderRadius: 8, cursor: 'pointer', fontSize: 16,
          border: `1px solid ${borderColor}`, background: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isDark ? '☀️' : '🌙'}
        </button>

        {/* User avatar + dropdown */}
        {user && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu(m => !m)}
              title={user.name}
              style={{
                width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', padding: 0,
                border: `2px solid ${user.isAdmin ? '#ff5252' : '#00b8cc'}`,
                background: 'none', overflow: 'hidden', flexShrink: 0,
              }}
            >
              {user.avatar
                ? <img src={user.avatar} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg,#00b8cc,#6b3fd4)', color: '#fff', fontWeight: 700, fontSize: 13,
                  }}>
                    {(user.name || 'U').slice(0, 1)}
                  </div>
              }
            </button>

            {showMenu && (
              <div style={{
                position: 'absolute', top: 44, right: 0, width: 220,
                background: menuBg, border: `1px solid ${borderColor}`,
                borderRadius: 14, padding: 8,
                boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.15)',
                zIndex: 200,
              }}
                onMouseLeave={() => setShowMenu(false)}
              >
                {/* User info block */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px 12px', borderBottom: `1px solid ${borderColor}`, marginBottom: 6,
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `1.5px solid ${borderColor}` }}>
                    {user.avatar
                      ? <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#00b8cc,#6b3fd4)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                          {(user.name || 'U').slice(0,1)}
                        </div>
                    }
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.name}
                    </div>
                    <div style={{ fontSize: 10, color: text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: user.isAnonymous ? 'monospace' : 'inherit' }}>
                      {user.isAnonymous ? (user.uuid || 'Anonymous') : user.email}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      {/* Provider badge */}
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 600,
                        background: user.isAnonymous ? 'rgba(45,138,94,0.15)' : `${providerColor[user.provider] || '#555'}18`,
                        color: user.isAnonymous ? '#2d8a5e' : (providerColor[user.provider] || '#555'),
                        border: `1px solid ${user.isAnonymous ? 'rgba(45,138,94,0.35)' : (providerColor[user.provider] || '#555') + '33'}`,
                      }}>
                        {user.isAnonymous ? '🌿 Guest' : (providerLabel[user.provider] || 'Email')}
                      </span>
                      {user.isAdmin && (
                        <span style={{
                          fontSize: 9, padding: '1px 6px', borderRadius: 4, fontWeight: 700,
                          background: 'rgba(255,82,82,0.12)', color: '#ff5252', border: '1px solid rgba(255,82,82,0.25)',
                        }}>ADMIN</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Specialty if set */}
                {user.specialty && (
                  <div style={{ padding: '4px 12px 8px', fontSize: 11, color: text2, borderBottom: `1px solid ${borderColor}`, marginBottom: 6 }}>
                    🩺 {user.specialty}
                  </div>
                )}

                {/* Google/Apple photo note */}
                {user.googleAvatar && (user.provider === 'google' || user.provider === 'apple') && (
                  <div style={{ padding: '4px 12px 8px', fontSize: 10, color: text3, borderBottom: `1px solid ${borderColor}`, marginBottom: 6 }}>
                    📷 {lang === 'vi' ? `Ảnh từ ${providerLabel[user.provider]} Account` : `Photo from ${providerLabel[user.provider]} Account`}
                  </div>
                )}

                <button onClick={() => { onNavigateProfile?.(); setShowMenu(false) }} style={{
                  width: '100%', padding: '9px 12px', textAlign: 'left', cursor: 'pointer',
                  border: 'none', background: 'none', color: textColor, fontSize: 13,
                  borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                }}>
                  👤 {t('profile')}
                </button>

                <button onClick={() => { logout(); setShowMenu(false) }} style={{
                  width: '100%', padding: '9px 12px', textAlign: 'left', cursor: 'pointer',
                  border: 'none', background: 'none', color: '#ff5252', fontSize: 13,
                  borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  🚪 {t('logout')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
