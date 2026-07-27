import React, { useEffect, useState } from 'react'
import {
  ArrowRight, ArrowUpRight, Play, CheckCircle2, Users, Users2, Heart, Droplet, HeartPulse,
  Brain, Trophy, Award, ShoppingBag, Gamepad2, Handshake, CalendarDays,
  Mountain, Sprout, Compass, ShieldCheck, Zap, Crown, Infinity as InfinityIcon,
  Quote, Fingerprint, QrCode, Smartphone, Menu, Home, User, X,
  Target, Eye, Sparkles, Rocket, Cpu, Database, Layers, MapPin, Building2,
  Star, MessageCircle, Mail, ChevronRight, Lock, Globe, Coins, Wallet,
  BadgeCheck, HeartHandshake, Clock, ScanFace, Boxes, Languages, Sun, Moon, Phone,
} from 'lucide-react'
import zofoLogo from '../assets/landing/ZeroToForever_Logo.png'
import zofoQRCode from '../assets/landing/KLX12-QR-Code.png'
import zofoLogoKit from '../assets/landing/ZeroToForever-Logo-Kit.png'
import anonymousProfileImg from './AnonymousProfileUUID-Avatar-1080x720.png'
import UserUuid3DAvatar from '../components/UserUuid3DAvatar.jsx'
import { getLandingT } from '../i18n/zofoLandingI18n.js'

/**
 * landingPageZeroToForever.jsx
 * -----------------------------------------------------------------------
 * LandingPage đa trang (single-file, điều hướng nội bộ bằng state `page`)
 * cho Zero to Forever — chuẩn cấu trúc landing page quốc tế (kiểu poap.xyz):
 * mỗi mục trên menu chính có một "trang con" riêng với Hero + nội dung +
 * số liệu + CTA, thay vì chỉ neo (anchor) trong 1 trang.
 *
 * Trang con:
 *  - home        Trang chủ (giữ nguyên toàn bộ nội dung landing gốc)
 *  - about       Về chúng tôi
 *  - journey     Hành trình (Zero to Hero)
 *  - community   Cộng đồng
 *  - technology  Công nghệ
 *  - partners    Đối tác
 *
 * - Logo dùng ảnh thật: ZeroToForever_Logo.png
 * - QR "Quét để tải app" dùng ảnh thật: KLX12-QR-Code.png
 * - Icon dùng lucide-react (đã có sẵn trong project)
 *
 * Bổ sung:
 *  - Toggle ngôn ngữ Tiếng Việt / English, đồng bộ với từ điển
 *    src/i18n/zofoLandingI18n.js (lưu lựa chọn vào localStorage).
 *  - Toggle giao diện Dark / Night, áp dụng class `dark` (Tailwind
 *    darkMode: 'class') chỉ trong phạm vi trang landing này.
 *  - Hotline hỗ trợ: mailto:admin@blooddonation.space
 *  - Liên hệ hợp tác (đối tác): mailto:partners@zerotoforever.com
 *
 * Props (đều optional — component vẫn render standalone bình thường):
 *  - onGetStarted()   : bấm "Bắt đầu hành trình" / "Tham gia ngay" (CTA chính)
 *  - onLogin()        : bấm "Đăng nhập"
 *  - onWatchVideo()   : bấm "Xem video giới thiệu"
 *  - onDownloadApp()  : bấm "Tải ứng dụng"
 */

const LANG_STORAGE_KEY = 'zofo_landing_lang'
const THEME_STORAGE_KEY = 'zofo_landing_theme'
const HOTLINE_EMAIL = 'admin@blooddonation.space'
const PARTNERSHIP_EMAIL = 'partner@blooddonation.space'

function getNavItems(t) {
  return [
    { key: 'home', label: t.nav.home },
    { key: 'about', label: t.nav.about },
    { key: 'journey', label: t.nav.journey },
    { key: 'community', label: t.nav.community },
    { key: 'technology', label: t.nav.technology },
    { key: 'partners', label: t.nav.partners },
  ]
}

/* ── Shared: nút bấm chuyển ngôn ngữ Tiếng Việt / English ── */
function LanguageToggle({ language, setLanguage, compact = false }) {
  return (
    <div className={`flex items-center rounded-full border border-white/30 bg-white/5 backdrop-blur-sm p-0.5 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <button
        type="button"
        onClick={() => setLanguage('vi')}
        aria-pressed={language === 'vi'}
        className={`flex items-center gap-1 px-3 py-1.5 rounded-full font-semibold transition ${
          language === 'vi' ? 'bg-white text-[#0B132B]' : 'text-white/80 hover:text-white'
        }`}
      >
        <Languages className="w-3.5 h-3.5" /> VI
      </button>
      <button
        type="button"
        onClick={() => setLanguage('en')}
        aria-pressed={language === 'en'}
        className={`px-3 py-1.5 rounded-full font-semibold transition ${
          language === 'en' ? 'bg-white text-[#0B132B]' : 'text-white/80 hover:text-white'
        }`}
      >
        EN
      </button>
    </div>
  )
}

/* ── Shared: nút bấm chuyển giao diện Dark / Night ── */
function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-pressed={isDark}
      title={isDark ? 'Light mode' : 'Dark / Night mode'}
      className="w-9 h-9 flex items-center justify-center rounded-full border border-white/30 bg-white/5 backdrop-blur-sm text-white hover:bg-white/15 transition"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  )
}

/* ── Shared: thanh điều hướng trên cùng, dùng chung cho mọi trang con ── */
function NavBar({ page, setPage, onLogin, onGetStarted, t, language, setLanguage, theme, setTheme }) {
  const NAV_ITEMS = getNavItems(t)
  return (
    <nav className="absolute w-full z-50 top-0 left-0 pt-6 px-6 lg:px-12 flex justify-between items-center text-white">
      <button onClick={() => setPage('home')} className="flex items-center gap-3">
        <img src={zofoLogo} alt="Zero to Forever" className="h-10 md:h-12 w-auto object-contain" />
      </button>
      <div className="hidden lg:flex space-x-8 text-sm font-medium">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            onClick={() => setPage(item.key)}
            className={
              page === item.key
                ? 'border-b-2 border-white pb-1'
                : 'text-gray-300 hover:text-white transition pb-1 border-b-2 border-transparent'
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="hidden lg:flex items-center space-x-3">
        <LanguageToggle language={language} setLanguage={setLanguage} />
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <button
          onClick={onLogin}
          className="text-sm font-medium hover:text-gray-300 transition px-4 py-2 border border-white/30 rounded-full"
        >
          {t.nav.login}
        </button>
        <button
          onClick={onGetStarted}
          className="text-sm font-semibold zofo-gradient-blue px-6 py-2 rounded-full zofo-shadow-neon-cyan hover:scale-105 transition transform flex items-center gap-1"
        >
          {t.nav.join} <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="lg:hidden flex items-center gap-2">
        <LanguageToggle language={language} setLanguage={setLanguage} compact />
        <ThemeToggle theme={theme} setTheme={setTheme} />
        <button className="text-2xl"><Menu /></button>
      </div>
    </nav>
  )
}

/* ── Shared: Hero nhỏ dùng ở đầu mỗi trang con (khác trang chủ) ── */
function PageHero({ eyebrow, title, subtitle, icon: Icon }) {
  return (
    <header className="zofo-hero-section min-h-[54vh] flex items-end pt-32 pb-16 px-6 lg:px-12 relative overflow-hidden">
      <div className="zofo-stars"></div>
      <div className="absolute inset-0 zofo-hero-glow"></div>
      <div className="container mx-auto max-w-4xl relative z-10 text-white">
        {Icon && (
          <div className="w-14 h-14 rounded-2xl zofo-gradient-brand flex items-center justify-center mb-6 zofo-shadow-neon-purple">
            <Icon className="w-7 h-7 text-white" />
          </div>
        )}
        <div className="inline-block border border-white/30 text-gray-200 font-semibold text-xs rounded-full px-4 py-1 tracking-wide mb-4 uppercase">
          {eyebrow}
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight tracking-tight mb-4">
          {title}
        </h1>
        <p className="text-gray-300 max-w-2xl text-base md:text-lg leading-relaxed">
          {subtitle}
        </p>
      </div>
    </header>
  )
}

/* ── Shared: dải số liệu tối, dùng lại ở nhiều trang ── */
function StatsBand({ stats }) {
  const icons = [HeartPulse, Users, Handshake, CalendarDays]
  const colors = ['text-[#FF543C]', 'text-[#00C2FF]', 'text-[#8B4DFF]', 'text-[#4B6BFF]']
  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-6">
      <div className="bg-[#0B132B] rounded-2xl shadow-xl p-6 lg:p-10 flex flex-wrap lg:flex-nowrap justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 zofo-hero-glow opacity-50"></div>
        {stats.map((s, i) => {
          const Icon = icons[i]
          return (
            <div key={i} className="w-1/2 lg:w-1/4 flex items-center gap-4 relative z-10">
              <Icon className={`w-9 h-9 ${colors[i]}`} />
              <div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white leading-tight">{s.value}</h3>
                <p className="text-gray-400 text-sm">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ── Shared: dải CTA gọn, dùng ở cuối các trang con ── */
function CTABand({ onGetStarted, onOpenQR, title, subtitle, t }) {
  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10 mb-20">
      <div className="rounded-3xl shadow-2xl relative overflow-hidden bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100 dark:from-[#241a3a] dark:via-[#1a2036] dark:to-[#132033] border border-white dark:border-white/10">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ background: 'linear-gradient(90deg, rgba(255,84,60,0.1) 0%, rgba(139,77,255,0.2) 50%, rgba(0,194,255,0.1) 100%)' }}
        ></div>
        <div className="relative z-10 p-10 lg:p-14 text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-gray-50 leading-tight max-w-2xl">
            {title}
          </h2>
          <p className="text-gray-700 dark:text-gray-300 font-medium max-w-xl">{subtitle}</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={onGetStarted}
              className="bg-[#0B132B] text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-[0_0_20px_rgba(0,194,255,0.4)] transition w-full sm:w-auto"
            >
              {t.common.joinNow}
            </button>
            <button
              onClick={onOpenQR}
              className="bg-white/50 dark:bg-white/10 backdrop-blur border-2 border-[#0B132B] dark:border-white/30 text-[#0B132B] dark:text-white px-8 py-4 rounded-full font-bold hover:bg-white dark:hover:bg-white/20 transition flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Smartphone className="w-4 h-4" /> {t.common.downloadApp}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Shared: eyebrow + heading dùng cho từng section trong trang con ── */
function SectionHeading({ eyebrow, title, subtitle, center = true }) {
  return (
    <div className={`mb-10 ${center ? 'text-center mx-auto' : ''} max-w-2xl`}>
      {eyebrow && (
        <div className="inline-block border border-[#8B4DFF] text-[#8B4DFF] font-semibold text-xs rounded-full px-4 py-1 tracking-wide mb-4">
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-gray-50 mb-3 leading-tight">{title}</h2>
      {subtitle && <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">{subtitle}</p>}
    </div>
  )
}

/* ── Shared: footer với hotline hỗ trợ & liên hệ hợp tác ── */
function LandingFooter({ t, setPage }) {
  const NAV_ITEMS = getNavItems(t)
  return (
    <footer className="bg-[#0B132B] text-gray-300 border-t border-white/10">
      <div className="container mx-auto max-w-7xl px-6 lg:px-12 py-14 grid grid-cols-1 md:grid-cols-3 gap-10">
        <div>
          <img src={zofoLogo} alt="Zero to Forever" className="h-10 w-auto object-contain mb-4" />
          <p className="text-sm text-gray-400 max-w-xs leading-relaxed">{t.footer.tagline}</p>
        </div>
        <div>
          <h5 className="text-white font-bold text-sm mb-4 uppercase tracking-wide">{t.footer.quickLinks}</h5>
          <ul className="space-y-2 text-sm">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <button onClick={() => setPage(item.key)} className="hover:text-white transition">{item.label}</button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h5 className="text-white font-bold text-sm mb-4 uppercase tracking-wide">{t.footer.contact}</h5>
          <ul className="space-y-3 text-sm">
            <li>
              <a href={`mailto:${HOTLINE_EMAIL}`} className="flex items-center gap-2 hover:text-white transition">
                <Phone className="w-4 h-4 text-[#00C2FF] flex-shrink-0" />
                <span>
                  <span className="block text-xs text-gray-400">{t.footer.hotlineLabel}</span>
                  {HOTLINE_EMAIL}
                </span>
              </a>
            </li>
            <li>
              <a href={`mailto:${PARTNERSHIP_EMAIL}`} className="flex items-center gap-2 hover:text-white transition">
                <Mail className="w-4 h-4 text-[#8B4DFF] flex-shrink-0" />
                <span>
                  <span className="block text-xs text-gray-400">{t.footer.partnershipLabel}</span>
                  {PARTNERSHIP_EMAIL}
                </span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-gray-500">
        {t.footer.rights}
      </div>
    </footer>
  )
}

export default function LandingPageZeroToForever({
  onGetStarted = () => {},
  onLogin = () => {},
  onWatchVideo = () => {},
  onDownloadApp = () => {},
}) {
  const [page, setPage] = useState('home')
  const [showVideoHelp, setShowVideoHelp] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)

  const [language, setLanguage] = useState(() => {
    if (typeof window === 'undefined') return 'vi'
    return window.localStorage.getItem(LANG_STORAGE_KEY) || 'vi'
  })
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'
    return window.localStorage.getItem(THEME_STORAGE_KEY) || 'light'
  })

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(LANG_STORAGE_KEY, language)
  }, [language])

  useEffect(() => {
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  const t = getLandingT(language)
  const isDark = theme === 'dark'

  const openVideoHelp = () => setShowVideoHelp(true)
  const openQRModal = () => setShowQRModal(true)

  return (
    <div className={`antialiased overflow-x-hidden font-sans ${isDark ? 'dark' : ''}`}>
      <div className="bg-[#F2F4F8] dark:bg-[#0a0e1a] text-[#333] dark:text-gray-200 transition-colors duration-300">
      <style>{`
        .zofo-hero-section {
          background-color: #0B132B;
          background-image:
            radial-gradient(circle at 80% 30%, #1a1543 0%, transparent 50%),
            radial-gradient(circle at 20% 80%, #0d1e3d 0%, transparent 50%);
          position: relative;
        }
        .zofo-stars {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image:
            radial-gradient(2px 2px at 20px 30px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 40px 70px, #ffffff, rgba(0,0,0,0)),
            radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
            radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0));
          background-repeat: repeat;
          background-size: 300px 300px;
          opacity: 0.3;
          z-index: 0;
          animation: zofo-twinkle 5s infinite alternate;
        }
        @keyframes zofo-twinkle { 0% { opacity: 0.2; } 100% { opacity: 0.5; } }
        .zofo-text-glow-cyan { text-shadow: 0 0 15px rgba(0, 194, 255, 0.5); }
        .zofo-animate-float { animation: zofo-float 6s ease-in-out infinite; }
        @keyframes zofo-float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
          100% { transform: translateY(0px); }
        }
        .zofo-infinity-svg {
          filter: drop-shadow(0 0 30px rgba(0, 194, 255, 0.6)) drop-shadow(0 0 60px rgba(139, 77, 255, 0.4));
        }
        .zofo-timeline-line { position: relative; }
        .zofo-timeline-line::before {
          content: '';
          position: absolute;
          top: 50%; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #e5e7eb 0%, #4B6BFF 50%, #8B4DFF 100%);
          transform: translateY(-50%);
          z-index: -1;
        }
        .dark .zofo-timeline-line::before {
          background: linear-gradient(90deg, #2a3350 0%, #4B6BFF 50%, #8B4DFF 100%);
        }
        .zofo-shadow-soft { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        .dark .zofo-shadow-soft { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.4); }
        .zofo-shadow-neon-cyan { box-shadow: 0 0 20px rgba(0, 194, 255, 0.4); }
        .zofo-shadow-neon-purple { box-shadow: 0 0 20px rgba(139, 77, 255, 0.4); }
        .zofo-gradient-brand { background: linear-gradient(135deg, #FF543C 0%, #8B4DFF 100%); }
        .zofo-gradient-blue { background: linear-gradient(135deg, #00C2FF 0%, #4B6BFF 100%); }
        .zofo-hero-glow { background: radial-gradient(circle at 50% 50%, rgba(139, 77, 255, 0.15) 0%, rgba(11, 19, 43, 0) 60%); }
      `}</style>

      <NavBar
        page={page}
        setPage={setPage}
        onLogin={onLogin}
        onGetStarted={onGetStarted}
        t={t}
        language={language}
        setLanguage={setLanguage}
        theme={theme}
        setTheme={setTheme}
      />

      {/* ══════════════════════════ TRANG CHỦ ══════════════════════════ */}
      {page === 'home' && (
        <>
          {/* Hero Section */}
          <header className="zofo-hero-section min-h-[90vh] flex items-center pt-24 pb-32 px-6 lg:px-12 relative overflow-hidden">
            <div className="zofo-stars"></div>
            <div className="absolute inset-0 zofo-hero-glow"></div>
            <div className="container mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 relative z-10 items-center">
              {/* Hero Left */}
              <div className="text-white space-y-6">
                <h1 className="text-6xl md:text-8xl font-black leading-tight tracking-tight">
                  Zero to <br />
                  <span className="text-[#00C2FF] zofo-text-glow-cyan">Forever</span>
                </h1>
                <h3 className="text-xl md:text-2xl font-semibold text-gray-200">
                  {t.home.heroSub} <br />
                  {t.home.heroLine1}
                </h3>
                <p className="text-gray-400 max-w-lg text-sm md:text-base leading-relaxed">
                  {t.home.heroDesc}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <button
                    onClick={onGetStarted}
                    className="zofo-gradient-brand text-white px-8 py-4 rounded-full font-semibold zofo-shadow-neon-purple hover:scale-105 transition transform flex items-center gap-2"
                  >
                    {t.common.getStarted} <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={openVideoHelp}
                    className="flex items-center gap-3 text-white hover:text-[#00C2FF] transition px-4 py-2"
                  >
                    <div className="w-12 h-12 rounded-full border border-gray-400 flex items-center justify-center bg-white/5 backdrop-blur-sm">
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                    <div className="text-sm text-left">
                      <div className="font-semibold">{t.common.watchIntro}</div>
                      <div className="text-gray-400">{t.home.videoDuration}</div>
                    </div>
                  </button>
                </div>
                <div className="flex flex-wrap gap-6 pt-8 text-sm font-medium text-gray-300">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00C2FF]" /> {t.home.badges[0]}</span>
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00C2FF]" /> {t.home.badges[1]}</span>
                  <span className="flex items-center gap-2"><Users className="w-4 h-4 text-[#00C2FF]" /> {t.home.badges[2]}</span>
                  <span className="flex items-center gap-2"><Heart className="w-4 h-4 text-[#00C2FF]" /> {t.home.badges[3]}</span>
                </div>
              </div>

              {/* Hero Right: Graphic */}
              <div className="hidden lg:block relative h-full min-h-[500px]">
                <div className="relative w-full h-full flex items-center justify-center zofo-animate-float">
                  <svg className="zofo-infinity-svg w-[120%] h-[120%] absolute -right-10 top-0" fill="none" viewBox="0 0 200 100">
                    <path d="M 50 50 C 10 10, 10 90, 50 50 C 90 10, 90 90, 130 50 C 170 10, 170 90, 130 50 C 90 10, 90 90, 50 50 Z" fill="none" opacity="0.8" stroke="url(#zofo-neon-grad)" strokeWidth="2" />
                    <path d="M 50 50 C 10 10, 10 90, 50 50 C 90 10, 90 90, 130 50 C 170 10, 170 90, 130 50 C 90 10, 90 90, 50 50 Z" fill="none" style={{ filter: 'blur(8px)' }} opacity="0.4" stroke="url(#zofo-neon-grad-2)" strokeWidth="6" />
                    <defs>
                      <linearGradient id="zofo-neon-grad" x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#FF543C" />
                        <stop offset="50%" stopColor="#8B4DFF" />
                        <stop offset="100%" stopColor="#00C2FF" />
                      </linearGradient>
                      <linearGradient id="zofo-neon-grad-2" x1="0%" x2="100%" y1="0%" y2="0%">
                        <stop offset="0%" stopColor="#FF543C" />
                        <stop offset="50%" stopColor="#8B4DFF" />
                        <stop offset="100%" stopColor="#00C2FF" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <img
                    alt="Astronaut looking at space"
                    className="absolute right-10 bottom-0 h-64 object-cover object-top opacity-80"
                    src="https://images.unsplash.com/photo-1614729939124-03290b5509ce?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
                    style={{
                      maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
                      WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)',
                    }}
                  />
                  <div className="absolute bottom-12 right-0 text-right z-20">
                    <h4 className="text-2xl font-bold text-white">Zero to Forever</h4>
                    <p className="text-[#00C2FF] font-medium">{t.home.heroGraphicTagline}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Feature Pillars (Overlapping Hero) */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 relative z-20 -mt-16">
            <div className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-6 lg:p-8 flex flex-wrap lg:flex-nowrap justify-between gap-6">
              {[
                { icon: Droplet, bg: 'bg-red-50 dark:bg-red-500/10', color: 'text-[#FF543C]' },
                { icon: HeartPulse, bg: 'bg-green-50 dark:bg-green-500/10', color: 'text-green-500' },
                { icon: Brain, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-[#4B6BFF]', hot: true },
                { icon: Trophy, bg: 'bg-orange-50 dark:bg-orange-500/10', color: 'text-yellow-500' },
                { icon: Award, bg: 'bg-purple-50 dark:bg-purple-500/10', color: 'text-[#8B4DFF]' },
                { icon: Users, bg: 'bg-blue-50 dark:bg-blue-500/10', color: 'text-[#4B6BFF]' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center w-1/2 lg:w-1/5 group relative">
                  {item.hot && (
                    <div className="absolute -top-4 text-xs font-bold bg-[#00C2FF] text-white px-3 py-1 rounded-full shadow-md">HOT</div>
                  )}
                  <div className={`w-16 h-16 rounded-full ${item.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition`}>
                    <item.icon className={`w-7 h-7 ${item.color}`} />
                  </div>
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 leading-tight">
                    {t.home.pillars[i].title}<br /><span className="text-gray-500 dark:text-gray-400 font-medium">{t.home.pillars[i].sub}</span>
                  </h4>
                </div>
              ))}
            </div>
          </section>

          {/* AI Coach + Journey + Phone Mockup */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: AI Coach Text */}
              <div className="lg:col-span-3 space-y-6 bg-white dark:bg-[#141b2e] p-8 rounded-3xl zofo-shadow-soft h-full flex flex-col justify-center">
                <div className="inline-block border border-[#8B4DFF] text-[#8B4DFF] font-semibold text-xs rounded-full px-4 py-1 tracking-wide w-max">
                  {t.home.aiCoach.eyebrow}
                </div>
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-50 leading-tight">
                  <span className="text-[#FF543C]">{t.home.aiCoach.titleA}</span> {t.home.aiCoach.titleB} <br />
                  {t.home.aiCoach.titleC} <span className="text-[#4B6BFF]">{t.home.aiCoach.titleD}</span>
                </h2>
                <ul className="space-y-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.home.aiCoach.items.map((text, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      {text}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setPage('technology')}
                  className="mt-4 border border-[#4B6BFF] text-[#4B6BFF] hover:bg-[#4B6BFF] hover:text-white font-medium px-6 py-3 rounded-full transition w-max flex items-center gap-2"
                >
                  {t.home.aiCoach.cta} <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Center: Phone Mockup */}
              <div className="lg:col-span-4 flex justify-center relative z-10 lg:scale-110">
                <div className="w-[280px] h-[580px] bg-white rounded-[2.5rem] border-[12px] border-gray-900 shadow-2xl relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-xl w-32 mx-auto z-20"></div>
                  <div className="flex-1 bg-gray-50 pt-10 px-5 flex flex-col gap-4 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-gray-900">{t.home.phone.greeting}</h4>
                        <p className="text-xs text-gray-500">{t.home.phone.ready}</p>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-100">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">{t.home.phone.healthScore}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900">86</span>
                          <span className="text-sm font-medium text-gray-400">/100</span>
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                        <HeartPulse className="w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <h5 className="font-bold text-sm">{t.home.phone.dailyQuest}</h5>
                        <span className="text-xs text-gray-400">{t.home.phone.completed}</span>
                      </div>
                      <div className="space-y-3">
                        {t.home.phone.quests.map((q, i) => {
                          const done = i !== 2
                          const red = i === 3
                          return (
                            <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${done ? 'bg-green-100 text-green-500' : 'bg-purple-100 text-[#8B4DFF]'}`}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </div>
                              <div className="flex-1">
                                <p className="text-xs font-bold text-gray-800">{q.title}</p>
                                <p className={`text-[10px] ${red ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{q.sub}</p>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="h-16 bg-white border-t border-gray-100 flex justify-around items-center px-4 text-xs font-medium text-gray-400">
                    <div className="flex flex-col items-center text-[#4B6BFF]"><Home className="w-4 h-4 mb-1" /> {t.home.phone.navHome}</div>
                    <div className="flex flex-col items-center"><Compass className="w-4 h-4 mb-1" /> {t.home.phone.navQuest}</div>
                    <div className="flex flex-col items-center"><Users className="w-4 h-4 mb-1" /> {t.home.phone.navCommunity}</div>
                    <div className="flex flex-col items-center"><User className="w-4 h-4 mb-1" /> {t.home.phone.navProfile}</div>
                  </div>
                </div>
              </div>

              {/* Right: Journey & Stats */}
              <div className="lg:col-span-5 bg-[#eef1fc] dark:bg-[#1a2036] p-8 rounded-3xl flex flex-col gap-8 h-full zofo-shadow-soft">
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-50">{t.home.journeyPanel.title}</h3>
                    <button onClick={() => setPage('journey')} className="text-xs font-semibold text-[#4B6BFF] hover:underline flex items-center gap-1">
                      {t.home.journeyPanel.viewDetail} <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="zofo-timeline-line flex justify-between px-2">
                    {[
                      { icon: Mountain, bg: 'bg-gray-300', text: 'text-gray-600' },
                      { icon: Sprout, bg: 'bg-green-400', text: 'text-white', labelColor: 'text-green-600' },
                      { icon: Compass, bg: 'bg-blue-400', text: 'text-white', labelColor: 'text-[#4B6BFF]' },
                      { icon: ShieldCheck, bg: 'bg-yellow-400', text: 'text-white', labelColor: 'text-yellow-600' },
                      { icon: Zap, bg: 'bg-[#FF543C]', text: 'text-white', labelColor: 'text-[#FF543C]', big: true, bold: true },
                      { icon: Crown, bg: 'bg-purple-500', text: 'text-white', labelColor: 'text-purple-600', dim: true },
                      { icon: InfinityIcon, bg: 'bg-teal-400', text: 'text-white', labelColor: 'text-teal-600', dim: true },
                    ].map((step, i) => (
                      <div key={i} className={`flex flex-col items-center gap-2 relative z-10 group ${step.dim ? 'opacity-50' : ''}`}>
                        <div className={`${step.big ? 'w-12 h-12 -translate-y-1' : 'w-10 h-10'} rounded-full ${step.bg} ${step.text} flex items-center justify-center shadow-md`}>
                          <step.icon className={step.big ? 'w-5 h-5' : 'w-4 h-4'} />
                        </div>
                        <span className={`text-xs ${step.bold ? 'font-bold' : 'font-semibold'} ${step.labelColor || 'text-gray-600'}`}>{t.home.journeyPanel.steps[i]}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-auto">
                  {[Users, Droplet, Award, Trophy].map((Icon, i) => (
                    <div key={i} className="bg-white dark:bg-[#141b2e] rounded-xl p-4 text-center shadow-sm">
                      <Icon className={`w-6 h-6 ${['text-[#4B6BFF]', 'text-[#FF543C]', 'text-yellow-500', 'text-[#8B4DFF]'][i]} mb-1 mx-auto`} />
                      <h4 className="font-bold text-gray-900 dark:text-gray-50">{t.home.journeyPanel.stats[i].value}</h4>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase">{t.home.journeyPanel.stats[i].label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50/50 dark:bg-blue-500/10 rounded-xl p-4 border border-blue-100 dark:border-blue-400/20 flex items-center gap-4 relative overflow-hidden">
                  <Quote className="w-8 h-8 text-[#4B6BFF] opacity-20 absolute top-2 left-2" />
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 italic relative z-10 w-2/3">
                    {t.home.journeyPanel.quote}
                  </p>
                  <div className="w-1/3 flex justify-end">
                    <img
                      alt="Space"
                      className="w-16 h-16 object-cover rounded-full mix-blend-multiply border-2 border-white shadow-md"
                      src="https://images.unsplash.com/photo-1541185933-ef5d8ed016c2?ixlib=rb-4.0.3&auto=format&fit=crop&w=200&q=80"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Feature Cards + Partners */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  {
                    img: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-purple-100',
                    icon: Award,
                    iconBg: 'bg-[#8B4DFF]',
                    overlay: true,
                    goto: 'technology',
                  },
                  {
                    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-blue-100',
                    goto: 'community',
                  },
                  {
                    img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-orange-100',
                    icon: ShoppingBag,
                    overlayCenter: true,
                    goto: 'partners',
                  },
                  {
                    img: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-gray-900',
                    darkOverlay: true,
                    goto: 'journey',
                  },
                ].map((card, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(card.goto)}
                    className="text-left bg-white dark:bg-[#141b2e] rounded-2xl overflow-hidden zofo-shadow-soft flex flex-col group cursor-pointer hover:-translate-y-1 transition duration-300"
                  >
                    <div className={`h-40 ${card.bg} relative overflow-hidden`}>
                      <img alt={t.home.featureCards[i].title} className={`w-full h-full object-cover ${card.darkOverlay ? 'opacity-60' : 'opacity-90'} group-hover:scale-105 transition duration-500`} src={card.img} />
                      {card.overlay && card.icon && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className={`w-16 h-16 rounded-full ${card.iconBg} text-white shadow-lg flex items-center justify-center border-4 border-white`}>
                            <card.icon className="w-6 h-6" />
                          </div>
                        </div>
                      )}
                      {card.overlayCenter && card.icon && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                          <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center">
                            <card.icon className="w-5 h-5 text-[#FF543C]" />
                          </div>
                        </div>
                      )}
                      {card.darkOverlay && (
                        <div className="absolute inset-0 bg-gradient-to-t from-[#8B4DFF]/40 to-transparent"></div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <h4 className="font-bold text-lg text-gray-900 dark:text-gray-50 mb-2">{t.home.featureCards[i].title}</h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 flex-1">{t.home.featureCards[i].desc}</p>
                      <span className="text-[#4B6BFF] text-sm font-semibold mt-4 group-hover:text-[#8B4DFF] transition">{t.common.learnMore}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Partners List */}
              <div className="lg:col-span-1 bg-white dark:bg-[#141b2e] rounded-2xl zofo-shadow-soft p-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-2 font-bold text-gray-700 dark:text-gray-200">
                    <Gamepad2 className="w-5 h-5 text-blue-900 dark:text-blue-300" /> STEAMLAND
                  </div>
                  <div className="flex items-center justify-center gap-2 font-bold text-gray-700 dark:text-gray-200">
                    <span className="text-[#FF543C] text-xl">▲</span> ACCESSTRADE
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-center gap-1 font-bold text-orange-500 text-sm">
                      <ShoppingBag className="w-4 h-4" /> Shopee
                    </div>
                    <div className="flex items-center justify-center gap-1 font-bold text-blue-800 dark:text-blue-300 text-sm">
                      <span className="text-pink-500 text-lg">♡</span> Lazada
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-center gap-1 font-bold text-black dark:text-gray-200 text-sm">TikTok Shop</div>
                    <div className="flex items-center justify-center font-bold text-blue-500 text-sm">Tiki</div>
                  </div>
                </div>
                <div className="text-center mt-6">
                  <button onClick={() => setPage('partners')} className="text-[#4B6BFF] text-sm font-semibold hover:underline">{t.common.viewAll}</button>
                </div>
              </div>
            </div>
          </section>

          <StatsBand stats={t.home.journeyPanel.stats} />

          {/* CTA Section */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10 mb-20">
            <div className="rounded-3xl shadow-2xl relative overflow-hidden bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100 dark:from-[#241a3a] dark:via-[#1a2036] dark:to-[#132033] border border-white dark:border-white/10">
              <div
                className="absolute top-0 left-0 w-full h-full"
                style={{ background: 'linear-gradient(90deg, rgba(255,84,60,0.1) 0%, rgba(139,77,255,0.2) 50%, rgba(0,194,255,0.1) 100%)' }}
              ></div>
              <div className="grid lg:grid-cols-12 gap-8 relative z-10 items-center p-8 lg:p-12">
                {/* Left: Illustration */}
                <div className="hidden lg:block lg:col-span-4 h-full">
                  <img
                    alt="Group of heroes"
                    className="w-full h-64 object-cover rounded-2xl shadow-lg brightness-105 contrast-125"
                    src="https://images.unsplash.com/photo-1529156069898-49953eb1b5ce?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80"
                    style={{
                      maskImage: 'radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                      WebkitMaskImage: 'radial-gradient(circle, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 100%)',
                    }}
                  />
                </div>
                {/* Center: Content */}
                <div className="col-span-12 lg:col-span-5 text-center flex flex-col justify-center">
                  <h2 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-gray-50 mb-4 leading-tight">
                    {t.home.ctaSection.titlePre}{' '}
                    <span
                      style={{
                        backgroundImage: 'linear-gradient(135deg, #FF543C 0%, #8B4DFF 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {t.home.ctaSection.titleHighlight}
                    </span>{' '}
                    {t.home.ctaSection.titlePost}
                  </h2>
                  <p className="text-gray-700 dark:text-gray-300 font-medium mb-8">
                    {t.home.ctaSection.subtitle}
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button
                      onClick={onGetStarted}
                      className="bg-[#0B132B] text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-[0_0_20px_rgba(0,194,255,0.4)] transition w-full sm:w-auto"
                    >
                      {t.common.joinNow}
                    </button>
                    <button
                      onClick={openQRModal}
                      className="bg-white/50 dark:bg-white/10 backdrop-blur border-2 border-[#0B132B] dark:border-white/30 text-[#0B132B] dark:text-white px-8 py-4 rounded-full font-bold hover:bg-white dark:hover:bg-white/20 transition flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Smartphone className="w-4 h-4" /> {t.common.downloadApp}
                    </button>
                  </div>
                </div>
                {/* Right: Phone & QR */}
                <div className="col-span-12 lg:col-span-3 flex justify-center items-center gap-4">
                  <div className="w-32 h-64 bg-gray-900 rounded-3xl border-[6px] border-gray-800 shadow-xl overflow-hidden relative zofo-shadow-neon-purple transform -rotate-[5deg]">
                    <div className="absolute inset-0 zofo-gradient-brand flex flex-col items-center justify-center p-2 text-center text-white">
                      <div className="text-xs font-black">ZERO TO</div>
                      <div className="text-xs font-black text-[#00C2FF] mb-2">FOREVER</div>
                      <Fingerprint className="w-8 h-8 opacity-50 mb-4" />
                      <div className="w-8 h-1 bg-white/30 rounded-full mb-1"></div>
                      <div className="w-12 h-1 bg-white/30 rounded-full"></div>
                    </div>
                  </div>
                  {/* QR Box - dùng ảnh QR thật KLX12-QR-Code.png */}
                  <div className="bg-white p-3 rounded-xl shadow-lg flex flex-col items-center">
                    <img alt="QR Code tải app Zero to Forever" className="w-20 h-20 mb-2 object-contain" src={zofoQRCode} />
                    <span className="text-[10px] text-gray-500 font-semibold flex items-center gap-1">
                      <QrCode className="w-3 h-3" /> {t.common.scanToDownload}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Brand Assets — bộ nhận diện thương hiệu Zero to Forever */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 pb-20">
            <div className="text-center mb-8">
              <div className="inline-block border border-[#8B4DFF] text-[#8B4DFF] font-semibold text-xs rounded-full px-4 py-1 tracking-wide mb-4">
                {t.home.brand.eyebrow}
              </div>
              <h2 className="text-3xl lg:text-4xl font-black text-gray-900 dark:text-gray-50 mb-3">
                {t.home.brand.title}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 max-w-xl mx-auto text-sm md:text-base">
                {t.home.brand.subtitle}
              </p>
            </div>
            <div className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-3 md:p-6 overflow-hidden">
              <img
                src={zofoLogoKit}
                alt="Zero to Forever - Brand Assets / Logo Kit"
                className="w-full h-auto rounded-2xl"
              />
            </div>
          </section>
        </>
      )}

      {/* ══════════════════════════ VỀ CHÚNG TÔI ══════════════════════════ */}
      {page === 'about' && (
        <>
          <PageHero
            icon={Sparkles}
            eyebrow={t.about.hero.eyebrow}
            title={t.about.hero.title}
            subtitle={t.about.hero.subtitle}
          />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading
              eyebrow={t.about.values.eyebrow}
              title={t.about.values.title}
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Target, color: 'text-[#FF543C]', bg: 'bg-red-50 dark:bg-red-500/10' },
                { icon: Eye, color: 'text-[#4B6BFF]', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { icon: HeartHandshake, color: 'text-[#8B4DFF]', bg: 'bg-purple-50 dark:bg-purple-500/10' },
              ].map((v, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-8">
                  <div className={`w-14 h-14 rounded-2xl ${v.bg} flex items-center justify-center mb-5`}>
                    <v.icon className={`w-7 h-7 ${v.color}`} />
                  </div>
                  <h4 className="font-bold text-xl text-gray-900 dark:text-gray-50 mb-3">{t.about.values.items[i].title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t.about.values.items[i].desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-5xl px-4 lg:px-8 py-10">
            <SectionHeading
              eyebrow={t.about.milestones.eyebrow}
              title={t.about.milestones.title}
              subtitle={t.about.milestones.subtitle}
            />
            <div className="space-y-6">
              {t.about.milestones.items.map((m, i) => (
                <div key={i} className="flex gap-6 items-start bg-white dark:bg-[#141b2e] rounded-2xl zofo-shadow-soft p-6">
                  <div className="flex-shrink-0 w-20 h-14 rounded-xl zofo-gradient-brand text-white font-black text-lg flex items-center justify-center">
                    {m.year}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-1">{m.title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading
              eyebrow={t.about.team.eyebrow}
              title={t.about.team.title}
              subtitle={t.about.team.subtitle}
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                'bg-red-50 text-[#FF543C] dark:bg-red-500/10',
                'bg-blue-50 text-[#4B6BFF] dark:bg-blue-500/10',
                'bg-purple-50 text-[#8B4DFF] dark:bg-purple-500/10',
                'bg-green-50 text-green-600 dark:bg-green-500/10',
              ].map((color, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-2xl zofo-shadow-soft p-6 text-center">
                  <div className={`w-16 h-16 rounded-full ${color} flex items-center justify-center mx-auto mb-4`}>
                    <User className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-gray-50">{t.about.team.roles[i]}</h4>
                </div>
              ))}
            </div>
          </section>

          <StatsBand stats={t.home.journeyPanel.stats} />
          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title={t.about.cta.title}
            subtitle={t.about.cta.subtitle}
            t={t}
          />
        </>
      )}

      {/* ══════════════════════════ HÀNH TRÌNH ══════════════════════════ */}
      {page === 'journey' && (
        <>
          <PageHero
            icon={Compass}
            eyebrow={t.journey.hero.eyebrow}
            title={t.journey.hero.title}
            subtitle={t.journey.hero.subtitle}
          />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow={t.journey.stages.eyebrow} title={t.journey.stages.title} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Mountain, bg: 'bg-gray-100 dark:bg-gray-500/10', color: 'text-gray-600 dark:text-gray-300' },
                { icon: Sprout, bg: 'bg-green-100 dark:bg-green-500/10', color: 'text-green-600' },
                { icon: Compass, bg: 'bg-blue-100 dark:bg-blue-500/10', color: 'text-[#4B6BFF]' },
                { icon: ShieldCheck, bg: 'bg-yellow-100 dark:bg-yellow-500/10', color: 'text-yellow-600' },
                { icon: Zap, bg: 'bg-red-100 dark:bg-red-500/10', color: 'text-[#FF543C]' },
                { icon: Crown, bg: 'bg-purple-100 dark:bg-purple-500/10', color: 'text-purple-600' },
                { icon: InfinityIcon, bg: 'bg-teal-100 dark:bg-teal-500/10', color: 'text-teal-600' },
              ].map((s, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-6 flex flex-col gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-7 h-7 ${s.color}`} />
                  </div>
                  <h4 className="font-black text-lg text-gray-900 dark:text-gray-50">{t.journey.stages.items[i].label}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t.journey.stages.items[i].desc}</p>
                </div>
              ))}
              <div className="bg-[#0B132B] rounded-3xl p-6 flex flex-col justify-center items-start gap-3 text-white">
                <Rocket className="w-8 h-8 text-[#00C2FF]" />
                <h4 className="font-black text-lg">{t.journey.stages.askCard.title}</h4>
                <p className="text-sm text-gray-300">{t.journey.stages.askCard.desc}</p>
                <button onClick={onGetStarted} className="mt-2 zofo-gradient-blue text-sm font-semibold px-5 py-2.5 rounded-full flex items-center gap-1">
                  {t.common.getStarted} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <div className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-8 lg:p-12 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <SectionHeading
                  center={false}
                  eyebrow={t.journey.exp.eyebrow}
                  title={t.journey.exp.title}
                  subtitle={t.journey.exp.subtitle}
                />
                <ul className="space-y-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t.journey.exp.items.map((text, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      {text}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#eef1fc] dark:bg-[#1a2036] rounded-3xl p-6">
                <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">{t.journey.exp.currentLevel}</p>
                    <p className="font-black text-xl text-gray-900">HERO</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">EXP</p>
                    <p className="font-bold text-gray-900">12.850 / 18.000</p>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden mb-6">
                  <div className="h-full zofo-gradient-brand" style={{ width: '68%' }}></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {t.journey.exp.quests.map((q, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${i !== 1 ? 'bg-green-100 text-green-500' : 'bg-purple-100 text-[#8B4DFF]'}`}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-gray-800 truncate">{q.label}</p>
                        <p className="text-[10px] text-gray-400">{q.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title={t.journey.cta.title}
            subtitle={t.journey.cta.subtitle}
            t={t}
          />
        </>
      )}

      {/* ══════════════════════════ CỘNG ĐỒNG ══════════════════════════ */}
      {page === 'community' && (
        <>
          <PageHero
            icon={Users}
            eyebrow={t.community.hero.eyebrow}
            title={t.community.hero.title}
            subtitle={t.community.hero.subtitle}
          />

          <StatsBand stats={t.home.journeyPanel.stats} />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow={t.community.ways.eyebrow} title={t.community.ways.title} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Users2, color: 'text-[#4B6BFF]', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { icon: CalendarDays, color: 'text-[#FF543C]', bg: 'bg-red-50 dark:bg-red-500/10' },
                { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-500/10' },
                { icon: Trophy, color: 'text-[#8B4DFF]', bg: 'bg-purple-50 dark:bg-purple-500/10' },
              ].map((c, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-6">
                  <div className={`w-14 h-14 rounded-2xl ${c.bg} flex items-center justify-center mb-4`}>
                    <c.icon className={`w-7 h-7 ${c.color}`} />
                  </div>
                  <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{t.community.ways.items[i].title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t.community.ways.items[i].desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <SectionHeading eyebrow={t.community.testimonials.eyebrow} title={t.community.testimonials.title} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {t.community.testimonials.items.map((tItem, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-6 flex flex-col gap-4">
                  <Quote className="w-8 h-8 text-[#4B6BFF] opacity-30" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 italic leading-relaxed flex-1">{tItem.quote}</p>
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-50">{tItem.name}</p>
                </div>
              ))}
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title={t.community.cta.title}
            subtitle={t.community.cta.subtitle}
            t={t}
          />
        </>
      )}

      {/* ══════════════════════════ CÔNG NGHỆ ══════════════════════════ */}
      {page === 'technology' && (
        <>
          <PageHero
            icon={Cpu}
            eyebrow={t.technology.hero.eyebrow}
            title={t.technology.hero.title}
            subtitle={t.technology.hero.subtitle}
          />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow={t.technology.pillars.eyebrow} title={t.technology.pillars.title} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { icon: Brain, color: 'text-[#FF543C]', bg: 'bg-red-50 dark:bg-red-500/10' },
                { icon: Boxes, color: 'text-[#8B4DFF]', bg: 'bg-purple-50 dark:bg-purple-500/10' },
                { icon: ScanFace, color: 'text-[#4B6BFF]', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { icon: Lock, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-500/10' },
              ].map((tech, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-8 flex gap-5">
                  <div className={`w-14 h-14 rounded-2xl ${tech.bg} flex items-center justify-center flex-shrink-0`}>
                    <tech.icon className={`w-7 h-7 ${tech.color}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 dark:text-gray-50 mb-2">{t.technology.pillars.items[i].title}</h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t.technology.pillars.items[i].desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-5xl px-4 lg:px-8 py-10">
            <div className="bg-[#0B132B] rounded-3xl p-8 lg:p-12 text-white">
              <div className="flex items-center gap-3 mb-6">
                <Fingerprint className="w-8 h-8 text-[#00C2FF]" />
                <h3 className="text-2xl font-bold">{t.technology.privacy.title}</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-5 text-sm text-gray-300">
                {t.technology.privacy.items.map((text, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#00C2FF] flex-shrink-0 mt-0.5" />
                    {text}
                  </div>
                ))}
              </div>
              <button
                onClick={openVideoHelp}
                className="mt-8 zofo-gradient-blue text-sm font-semibold px-6 py-3 rounded-full flex items-center gap-2 w-max"
              >
                {t.technology.privacy.cta} <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <SectionHeading eyebrow={t.technology.capabilities.eyebrow} title={t.technology.capabilities.title} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[Database, Layers, Coins, Wallet].map((Icon, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-2xl zofo-shadow-soft p-6 text-center">
                  <Icon className="w-8 h-8 text-[#4B6BFF] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t.technology.capabilities.items[i]}</p>
                </div>
              ))}
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title={t.technology.cta.title}
            subtitle={t.technology.cta.subtitle}
            t={t}
          />
        </>
      )}

      {/* ══════════════════════════ ĐỐI TÁC ══════════════════════════ */}
      {page === 'partners' && (
        <>
          <PageHero
            icon={Handshake}
            eyebrow={t.partners.hero.eyebrow}
            title={t.partners.hero.title}
            subtitle={t.partners.hero.subtitle}
          />

          <StatsBand stats={t.home.journeyPanel.stats} />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow={t.partners.ecosystem.eyebrow} title={t.partners.ecosystem.title} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Building2, color: 'text-[#FF543C]', bg: 'bg-red-50 dark:bg-red-500/10' },
                { icon: Handshake, color: 'text-[#4B6BFF]', bg: 'bg-blue-50 dark:bg-blue-500/10' },
                { icon: Cpu, color: 'text-[#8B4DFF]', bg: 'bg-purple-50 dark:bg-purple-500/10' },
              ].map((p, i) => (
                <div key={i} className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-8">
                  <div className={`w-14 h-14 rounded-2xl ${p.bg} flex items-center justify-center mb-5`}>
                    <p.icon className={`w-7 h-7 ${p.color}`} />
                  </div>
                  <h4 className="font-bold text-xl text-gray-900 dark:text-gray-50 mb-3">{t.partners.ecosystem.items[i].title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{t.partners.ecosystem.items[i].desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <SectionHeading eyebrow={t.partners.current.eyebrow} title={t.partners.current.title} />
            <div className="bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-8 lg:p-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="flex items-center justify-center gap-2 font-bold text-gray-700 dark:text-gray-200">
                  <Gamepad2 className="w-5 h-5 text-blue-900 dark:text-blue-300" /> STEAMLAND
                </div>
                <div className="flex items-center justify-center gap-2 font-bold text-gray-700 dark:text-gray-200">
                  <span className="text-[#FF543C] text-xl">▲</span> ACCESSTRADE
                </div>
                <div className="flex items-center justify-center gap-1 font-bold text-orange-500 text-sm">
                  <ShoppingBag className="w-4 h-4" /> Shopee
                </div>
                <div className="flex items-center justify-center gap-1 font-bold text-blue-800 dark:text-blue-300 text-sm">
                  <span className="text-pink-500 text-lg">♡</span> Lazada
                </div>
                <div className="flex items-center justify-center font-bold text-black dark:text-gray-200 text-sm">TikTok Shop</div>
                <div className="flex items-center justify-center font-bold text-blue-500 text-sm">Tiki</div>
                <div className="flex items-center justify-center gap-2 font-bold text-gray-400 text-sm">
                  <Building2 className="w-4 h-4" /> {t.partners.current.hospital}
                </div>
                <div className="flex items-center justify-center gap-2 font-bold text-gray-400 text-sm">
                  <Globe className="w-4 h-4" /> {t.partners.current.ngo}
                </div>
              </div>
            </div>
          </section>

          <section className="container mx-auto max-w-4xl px-4 lg:px-8 py-10 mb-10">
            <div className="bg-[#0B132B] rounded-3xl p-8 lg:p-12 text-center text-white">
              <BadgeCheck className="w-10 h-10 text-[#00C2FF] mx-auto mb-4" />
              <h3 className="text-2xl lg:text-3xl font-bold mb-3">{t.partners.becomePartner.title}</h3>
              <p className="text-gray-300 max-w-xl mx-auto mb-6 text-sm md:text-base">
                {t.partners.becomePartner.desc}
              </p>
              <a
                href={`mailto:${PARTNERSHIP_EMAIL}`}
                className="inline-flex items-center gap-2 zofo-gradient-brand px-6 py-3 rounded-full font-semibold hover:scale-105 transition transform"
              >
                <Mail className="w-4 h-4" /> {t.partners.becomePartner.cta}
              </a>
              <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#00C2FF]" />
                {t.footer.hotlineLabel}: <a href={`mailto:${HOTLINE_EMAIL}`} className="underline hover:text-white">{HOTLINE_EMAIL}</a>
              </p>
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title={t.partners.cta.title}
            subtitle={t.partners.cta.subtitle}
            t={t}
          />
        </>
      )}

      <LandingFooter t={t} setPage={setPage} />

      {/* ── Popup: Xem video giới thiệu (giống Help Popup của trang Login) ── */}
      {showVideoHelp && (
        <div
          onClick={() => setShowVideoHelp(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, backdropFilter: 'blur(6px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 640,
              background: '#0b1120',
              borderRadius: 20,
              border: '1px solid rgba(0,229,255,0.2)',
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
                  {t.videoModal.title}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
                  {t.videoModal.subtitle}
                </div>
              </div>
              <button
                onClick={() => setShowVideoHelp(false)}
                style={{
                  background: 'rgba(255,255,255,0.18)', border: 'none', borderRadius: 8,
                  width: 32, height: 32, cursor: 'pointer', color: '#fff',
                  fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <img
                src={anonymousProfileImg}
                alt="Anonymous Profile UUID"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />

              <div style={{ padding: '20px 22px 24px' }}>
                <div style={{
                  fontSize: 13, fontWeight: 800, color: '#00e5ff',
                  marginBottom: 12, letterSpacing: '.05em', textTransform: 'uppercase',
                }}>
                  {t.videoModal.guideLabel}
                </div>
                <div className="zofo-help-video-avatar-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.85fr) minmax(180px, 1fr)', gap: 14, alignItems: 'stretch' }}>
                  <div style={{
                    borderRadius: 14, overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: '#000', aspectRatio: '9/16', maxHeight: 500,
                  }}>
                    <iframe
                      src="https://www.youtube.com/embed/dw_8mIuH9DY?autoplay=0&rel=0&modestbranding=1"
                      title="Zero to Forever - Video giới thiệu"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 12, minHeight: 320 }}>
                    <UserUuid3DAvatar uuid="anonymous-profile-demo-uuid" isDark accent="#2d8a5e" label={t.videoModal.guestUuid} height="100%" minWidth={160} />
                    <UserUuid3DAvatar uuid="real-account-profile-demo-uuid" isDark accent="#00b8cc" label={t.videoModal.userUuid} height="100%" minWidth={160} />
                  </div>
                </div>

                <style>{`@media (max-width: 720px) { .zofo-help-video-avatar-grid { grid-template-columns: 1fr !important; } }`}</style>

                <div style={{
                  marginTop: 16, padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(45,138,94,0.1)',
                  border: '1px solid rgba(45,138,94,0.3)',
                  fontSize: 13, color: 'rgba(232,240,248,0.8)', lineHeight: 1.7,
                }}>
                  {t.videoModal.note}
                </div>

                <button
                  onClick={() => { setShowVideoHelp(false); onGetStarted() }}
                  className="mt-5 w-full zofo-gradient-brand text-white px-6 py-3 rounded-full font-semibold hover:scale-[1.02] transition transform flex items-center justify-center gap-2"
                >
                  {t.videoModal.cta} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Popup: Tải ứng dụng — hiện QR code thật (KLX12-QR-Code.png) ── */}
      {showQRModal && (
        <div
          onClick={() => setShowQRModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, backdropFilter: 'blur(6px)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative"
            style={{
              width: '100%', maxWidth: 380,
              background: '#0B132B',
              borderRadius: 24,
              border: '1px solid rgba(0,194,255,0.25)',
              boxShadow: '0 32px 100px rgba(0,0,0,0.6)',
              padding: '28px 24px 24px',
              textAlign: 'center',
              color: '#fff',
            }}
          >
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-3 right-3"
              style={{
                background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8,
                width: 30, height: 30, cursor: 'pointer', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center justify-center gap-2 mb-1">
              <img src={zofoLogo} alt="Zero to Forever" className="h-8 w-auto object-contain" />
            </div>
            <h3 className="text-lg font-bold mt-3">{t.qrModal.title}</h3>
            <p className="text-sm text-gray-400 mt-1 mb-5">{t.qrModal.subtitle}</p>

            <div className="bg-white p-4 rounded-2xl shadow-lg inline-flex flex-col items-center">
              <img alt="QR Code tải app Zero to Forever" className="w-48 h-48 object-contain" src={zofoQRCode} />
            </div>

            <p className="text-[11px] text-gray-400 mt-4 flex items-center justify-center gap-1">
              <QrCode className="w-3.5 h-3.5" /> {t.qrModal.scan}
            </p>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
