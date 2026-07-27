import React, { useState } from 'react'
import {
  ArrowRight, ArrowUpRight, Play, CheckCircle2, Users, Users2, Heart, Droplet, HeartPulse,
  Brain, Trophy, Award, ShoppingBag, Gamepad2, Handshake, CalendarDays,
  Mountain, Sprout, Compass, ShieldCheck, Zap, Crown, Infinity as InfinityIcon,
  Quote, Fingerprint, QrCode, Smartphone, Menu, Home, User, X,
  Target, Eye, Sparkles, Rocket, Cpu, Database, Layers, MapPin, Building2,
  Star, MessageCircle, Mail, ChevronRight, Lock, Globe, Coins, Wallet,
  BadgeCheck, HeartHandshake, Clock, ScanFace, Boxes,
} from 'lucide-react'
import zofoLogo from '../assets/landing/ZeroToForever_Logo.png'
import zofoQRCode from '../assets/landing/KLX12-QR-Code.png'
import zofoLogoKit from '../assets/landing/ZeroToForever-Logo-Kit.png'
import anonymousProfileImg from './AnonymousProfileUUID-Avatar-1080x720.png'
import UserUuid3DAvatar from '../components/UserUuid3DAvatar.jsx'

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
 * Props (đều optional — component vẫn render standalone bình thường):
 *  - onGetStarted()   : bấm "Bắt đầu hành trình" / "Tham gia ngay" (CTA chính)
 *  - onLogin()        : bấm "Đăng nhập"
 *  - onWatchVideo()   : bấm "Xem video giới thiệu"
 *  - onDownloadApp()  : bấm "Tải ứng dụng"
 */

const NAV_ITEMS = [
  { key: 'home', label: 'Trang chủ' },
  { key: 'about', label: 'Về chúng tôi' },
  { key: 'journey', label: 'Hành trình' },
  { key: 'community', label: 'Cộng đồng' },
  { key: 'technology', label: 'Công nghệ' },
  { key: 'partners', label: 'Đối tác' },
]

/* ── Shared: thanh điều hướng trên cùng, dùng chung cho mọi trang con ── */
function NavBar({ page, setPage, onLogin, onGetStarted }) {
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
      <div className="hidden lg:flex items-center space-x-4">
        <button
          onClick={onLogin}
          className="text-sm font-medium hover:text-gray-300 transition px-4 py-2 border border-white/30 rounded-full"
        >
          Đăng nhập
        </button>
        <button
          onClick={onGetStarted}
          className="text-sm font-semibold zofo-gradient-blue px-6 py-2 rounded-full zofo-shadow-neon-cyan hover:scale-105 transition transform flex items-center gap-1"
        >
          Tham gia ngay <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="lg:hidden">
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
function StatsBand() {
  const stats = [
    { icon: HeartPulse, color: 'text-[#FF543C]', value: '3.248.765+', label: 'Lượt hành động tử tế' },
    { icon: Users, color: 'text-[#00C2FF]', value: '207.654+', label: 'Người đang tham gia' },
    { icon: Handshake, color: 'text-[#8B4DFF]', value: '1.245+', label: 'Đối tác & tổ chức' },
    { icon: CalendarDays, color: 'text-[#4B6BFF]', value: '365', label: 'Ngày - Hành trình tốt hơn' },
  ]
  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-6">
      <div className="bg-[#0B132B] rounded-2xl shadow-xl p-6 lg:p-10 flex flex-wrap lg:flex-nowrap justify-between gap-6 relative overflow-hidden">
        <div className="absolute inset-0 zofo-hero-glow opacity-50"></div>
        {stats.map((s, i) => (
          <div key={i} className="w-1/2 lg:w-1/4 flex items-center gap-4 relative z-10">
            <s.icon className={`w-9 h-9 ${s.color}`} />
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white leading-tight">{s.value}</h3>
              <p className="text-gray-400 text-sm">{s.label}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ── Shared: dải CTA gọn, dùng ở cuối các trang con ── */
function CTABand({ onGetStarted, onOpenQR, title, subtitle }) {
  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10 mb-20">
      <div className="rounded-3xl shadow-2xl relative overflow-hidden bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100 border border-white">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{ background: 'linear-gradient(90deg, rgba(255,84,60,0.1) 0%, rgba(139,77,255,0.2) 50%, rgba(0,194,255,0.1) 100%)' }}
        ></div>
        <div className="relative z-10 p-10 lg:p-14 text-center flex flex-col items-center gap-6">
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 leading-tight max-w-2xl">
            {title}
          </h2>
          <p className="text-gray-700 font-medium max-w-xl">{subtitle}</p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
              onClick={onGetStarted}
              className="bg-[#0B132B] text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-[0_0_20px_rgba(0,194,255,0.4)] transition w-full sm:w-auto"
            >
              Tham gia ngay
            </button>
            <button
              onClick={onOpenQR}
              className="bg-white/50 backdrop-blur border-2 border-[#0B132B] text-[#0B132B] px-8 py-4 rounded-full font-bold hover:bg-white transition flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Smartphone className="w-4 h-4" /> Tải ứng dụng
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
      <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-3 leading-tight">{title}</h2>
      {subtitle && <p className="text-gray-500 text-sm md:text-base">{subtitle}</p>}
    </div>
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

  const openVideoHelp = () => setShowVideoHelp(true)
  const openQRModal = () => setShowQRModal(true)

  const goHome = () => setPage('home')

  return (
    <div className="antialiased bg-[#F2F4F8] text-[#333] overflow-x-hidden font-sans">
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
        .zofo-shadow-soft { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        .zofo-shadow-neon-cyan { box-shadow: 0 0 20px rgba(0, 194, 255, 0.4); }
        .zofo-shadow-neon-purple { box-shadow: 0 0 20px rgba(139, 77, 255, 0.4); }
        .zofo-gradient-brand { background: linear-gradient(135deg, #FF543C 0%, #8B4DFF 100%); }
        .zofo-gradient-blue { background: linear-gradient(135deg, #00C2FF 0%, #4B6BFF 100%); }
        .zofo-hero-glow { background: radial-gradient(circle at 50% 50%, rgba(139, 77, 255, 0.15) 0%, rgba(11, 19, 43, 0) 60%); }
      `}</style>

      <NavBar page={page} setPage={setPage} onLogin={onLogin} onGetStarted={onGetStarted} />

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
                  Khám phá sức mạnh bên trong bạn. <br />
                  Sống khỏe – Sống ý nghĩa – Sống mãi giá trị.
                </h3>
                <p className="text-gray-400 max-w-lg text-sm md:text-base leading-relaxed">
                  Từ từng tế bào đến tâm hồn, từ mỗi hành động tử tế đến những thay đổi bền vững, để mỗi ngày bạn trở thành phiên bản tốt hơn của chính mình.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <button
                    onClick={onGetStarted}
                    className="zofo-gradient-brand text-white px-8 py-4 rounded-full font-semibold zofo-shadow-neon-purple hover:scale-105 transition transform flex items-center gap-2"
                  >
                    Bắt đầu hành trình <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={openVideoHelp}
                    className="flex items-center gap-3 text-white hover:text-[#00C2FF] transition px-4 py-2"
                  >
                    <div className="w-12 h-12 rounded-full border border-gray-400 flex items-center justify-center bg-white/5 backdrop-blur-sm">
                      <Play className="w-4 h-4 ml-0.5" />
                    </div>
                    <div className="text-sm text-left">
                      <div className="font-semibold">Xem video giới thiệu</div>
                      <div className="text-gray-400">(2:45)</div>
                    </div>
                  </button>
                </div>
                <div className="flex flex-wrap gap-6 pt-8 text-sm font-medium text-gray-300">
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00C2FF]" /> An toàn</span>
                  <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-[#00C2FF]" /> Minh bạch</span>
                  <span className="flex items-center gap-2"><Users className="w-4 h-4 text-[#00C2FF]" /> Cộng đồng</span>
                  <span className="flex items-center gap-2"><Heart className="w-4 h-4 text-[#00C2FF]" /> Tích cực</span>
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
                    <p className="text-[#00C2FF] font-medium">Become The Hero Within.</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Feature Pillars (Overlapping Hero) */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 relative z-20 -mt-16">
            <div className="bg-white rounded-3xl zofo-shadow-soft p-6 lg:p-8 flex flex-wrap lg:flex-nowrap justify-between gap-6">
              {[
                { icon: Droplet, bg: 'bg-red-50', color: 'text-[#FF543C]', title: 'Hiến máu', sub: 'Nhân Văn' },
                { icon: HeartPulse, bg: 'bg-green-50', color: 'text-green-500', title: 'Sức khỏe', sub: 'Toàn diện' },
                { icon: Brain, bg: 'bg-blue-50', color: 'text-[#4B6BFF]', title: 'AI Coach', sub: 'Cá nhân hóa', hot: true },
                { icon: Trophy, bg: 'bg-orange-50', color: 'text-yellow-500', title: 'Game hóa', sub: 'Zero to Hero' },
                { icon: Award, bg: 'bg-purple-50', color: 'text-[#8B4DFF]', title: 'POAP & Badge', sub: 'Dấu ấn vĩnh cửu' },
                { icon: Users, bg: 'bg-blue-50', color: 'text-[#4B6BFF]', title: 'Cộng đồng', sub: 'Tích cực' },
              ].map((item, i) => (
                <div key={i} className="flex flex-col items-center text-center w-1/2 lg:w-1/5 group relative">
                  {item.hot && (
                    <div className="absolute -top-4 text-xs font-bold bg-[#00C2FF] text-white px-3 py-1 rounded-full shadow-md">HOT</div>
                  )}
                  <div className={`w-16 h-16 rounded-full ${item.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition`}>
                    <item.icon className={`w-7 h-7 ${item.color}`} />
                  </div>
                  <h4 className="font-bold text-gray-800 leading-tight">
                    {item.title}<br /><span className="text-gray-500 font-medium">{item.sub}</span>
                  </h4>
                </div>
              ))}
            </div>
          </section>

          {/* AI Coach + Journey + Phone Mockup */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left: AI Coach Text */}
              <div className="lg:col-span-3 space-y-6 bg-white p-8 rounded-3xl zofo-shadow-soft h-full flex flex-col justify-center">
                <div className="inline-block border border-[#8B4DFF] text-[#8B4DFF] font-semibold text-xs rounded-full px-4 py-1 tracking-wide w-max">
                  AI COACH
                </div>
                <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                  <span className="text-[#FF543C]">AI</span> đồng hành <br />
                  trên hành trình <span className="text-[#4B6BFF]">của bạn</span>
                </h2>
                <ul className="space-y-4 text-sm font-medium text-gray-700">
                  {[
                    'Phân tích sức khỏe & thói quen',
                    'Thiết kế Roadmap riêng cho bạn',
                    'Gợi ý Daily Quest phù hợp',
                    'Theo dõi tiến độ & động lực mỗi ngày',
                  ].map((text, i) => (
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
                  Khám phá AI Coach <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Center: Phone Mockup */}
              <div className="lg:col-span-4 flex justify-center relative z-10 lg:scale-110">
                <div className="w-[280px] h-[580px] bg-white rounded-[2.5rem] border-[12px] border-gray-900 shadow-2xl relative overflow-hidden flex flex-col">
                  <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 rounded-b-xl w-32 mx-auto z-20"></div>
                  <div className="flex-1 bg-gray-50 pt-10 px-5 flex flex-col gap-4 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-gray-900">Xin chào, Hero! 👋</h4>
                        <p className="text-xs text-gray-500">Hôm nay bạn đã sẵn sàng chưa?</p>
                      </div>
                      <div className="w-8 h-8 rounded-full border border-gray-200 overflow-hidden flex items-center justify-center bg-gray-100">
                        <User className="w-4 h-4 text-gray-400" />
                      </div>
                    </div>
                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 font-medium mb-1">Điểm sức khỏe</p>
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
                        <h5 className="font-bold text-sm">Daily Quest</h5>
                        <span className="text-xs text-gray-400">4/5 hoàn thành</span>
                      </div>
                      <div className="space-y-3">
                        {[
                          { title: 'Đi bộ 6.000 bước', sub: '6.200/6.000', done: true },
                          { title: 'Uống 2L nước', sub: '1.8/2L', done: true },
                          { title: 'Thiền 10 phút', sub: '7/10', done: false },
                          { title: 'Ngủ trước 23:00', sub: '22:30 ✔', done: true, red: true },
                        ].map((q, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${q.done ? 'bg-green-100 text-green-500' : 'bg-purple-100 text-[#8B4DFF]'}`}>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-gray-800">{q.title}</p>
                              <p className={`text-[10px] ${q.red ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>{q.sub}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="h-16 bg-white border-t border-gray-100 flex justify-around items-center px-4 text-xs font-medium text-gray-400">
                    <div className="flex flex-col items-center text-[#4B6BFF]"><Home className="w-4 h-4 mb-1" /> Home</div>
                    <div className="flex flex-col items-center"><Compass className="w-4 h-4 mb-1" /> Quest</div>
                    <div className="flex flex-col items-center"><Users className="w-4 h-4 mb-1" /> Community</div>
                    <div className="flex flex-col items-center"><User className="w-4 h-4 mb-1" /> Profile</div>
                  </div>
                </div>
              </div>

              {/* Right: Journey & Stats */}
              <div className="lg:col-span-5 bg-[#eef1fc] p-8 rounded-3xl flex flex-col gap-8 h-full zofo-shadow-soft">
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold">Hành trình Zero to Hero</h3>
                    <button onClick={() => setPage('journey')} className="text-xs font-semibold text-[#4B6BFF] hover:underline flex items-center gap-1">
                      Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="zofo-timeline-line flex justify-between px-2">
                    {[
                      { icon: Mountain, bg: 'bg-gray-300', text: 'text-gray-600', label: 'Zero' },
                      { icon: Sprout, bg: 'bg-green-400', text: 'text-white', label: 'Awaken', labelColor: 'text-green-600' },
                      { icon: Compass, bg: 'bg-blue-400', text: 'text-white', label: 'Explorer', labelColor: 'text-[#4B6BFF]' },
                      { icon: ShieldCheck, bg: 'bg-yellow-400', text: 'text-white', label: 'Guardian', labelColor: 'text-yellow-600' },
                      { icon: Zap, bg: 'bg-[#FF543C]', text: 'text-white', label: 'Hero', labelColor: 'text-[#FF543C]', big: true, bold: true },
                      { icon: Crown, bg: 'bg-purple-500', text: 'text-white', label: 'Legend', labelColor: 'text-purple-600', dim: true },
                      { icon: InfinityIcon, bg: 'bg-teal-400', text: 'text-white', label: 'Forever', labelColor: 'text-teal-600', dim: true },
                    ].map((step, i) => (
                      <div key={i} className={`flex flex-col items-center gap-2 relative z-10 group ${step.dim ? 'opacity-50' : ''}`}>
                        <div className={`${step.big ? 'w-12 h-12 -translate-y-1' : 'w-10 h-10'} rounded-full ${step.bg} ${step.text} flex items-center justify-center shadow-md`}>
                          <step.icon className={step.big ? 'w-5 h-5' : 'w-4 h-4'} />
                        </div>
                        <span className={`text-xs ${step.bold ? 'font-bold' : 'font-semibold'} ${step.labelColor || 'text-gray-600'}`}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-auto">
                  {[
                    { icon: Users, color: 'text-[#4B6BFF]', value: '100.000+', label: 'Thành viên' },
                    { icon: Droplet, color: 'text-[#FF543C]', value: '50.000+', label: 'Đơn vị máu' },
                    { icon: Award, color: 'text-yellow-500', value: '10.000+', label: 'Anh Hùng' },
                    { icon: Trophy, color: 'text-[#8B4DFF]', value: '1.000.000+', label: 'Nhiệm vụ' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 text-center shadow-sm">
                      <s.icon className={`w-6 h-6 ${s.color} mb-1 mx-auto`} />
                      <h4 className="font-bold text-gray-900">{s.value}</h4>
                      <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 flex items-center gap-4 relative overflow-hidden">
                  <Quote className="w-8 h-8 text-[#4B6BFF] opacity-20 absolute top-2 left-2" />
                  <p className="text-sm font-medium text-gray-700 italic relative z-10 w-2/3">
                    Không phải ai cũng có cơ hội bay vào vũ trụ. Nhưng ai cũng có thể khám phá sức mạnh vô hạn bên trong mình.
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
                    title: 'Proof of Humanity',
                    desc: 'Ghi nhận mỗi hành động tốt đẹp của bạn bằng POAP & SBT.',
                    overlay: true,
                    goto: 'technology',
                  },
                  {
                    img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-blue-100',
                    title: 'Cộng đồng',
                    desc: 'Kết nối – Chia sẻ – Lan tỏa những giá trị tích cực.',
                    goto: 'community',
                  },
                  {
                    img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-orange-100',
                    icon: ShoppingBag,
                    title: 'Marketplace',
                    desc: 'Sản phẩm & dịch vụ sức khỏe uy tín.',
                    overlayCenter: true,
                    goto: 'partners',
                  },
                  {
                    img: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                    bg: 'bg-gray-900',
                    title: 'Game hóa',
                    desc: 'XP – Level – Quest – Guild. Lên cấp mỗi ngày.',
                    darkOverlay: true,
                    goto: 'journey',
                  },
                ].map((card, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(card.goto)}
                    className="text-left bg-white rounded-2xl overflow-hidden zofo-shadow-soft flex flex-col group cursor-pointer hover:-translate-y-1 transition duration-300"
                  >
                    <div className={`h-40 ${card.bg} relative overflow-hidden`}>
                      <img alt={card.title} className={`w-full h-full object-cover ${card.darkOverlay ? 'opacity-60' : 'opacity-90'} group-hover:scale-105 transition duration-500`} src={card.img} />
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
                      <h4 className="font-bold text-lg text-gray-900 mb-2">{card.title}</h4>
                      <p className="text-sm text-gray-500 flex-1">{card.desc}</p>
                      <span className="text-[#4B6BFF] text-sm font-semibold mt-4 group-hover:text-[#8B4DFF] transition">Tìm hiểu thêm →</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Partners List */}
              <div className="lg:col-span-1 bg-white rounded-2xl zofo-shadow-soft p-6 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-center gap-2 font-bold text-gray-700">
                    <Gamepad2 className="w-5 h-5 text-blue-900" /> STEAMLAND
                  </div>
                  <div className="flex items-center justify-center gap-2 font-bold text-gray-700">
                    <span className="text-[#FF543C] text-xl">▲</span> ACCESSTRADE
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-center gap-1 font-bold text-orange-500 text-sm">
                      <ShoppingBag className="w-4 h-4" /> Shopee
                    </div>
                    <div className="flex items-center justify-center gap-1 font-bold text-blue-800 text-sm">
                      <span className="text-pink-500 text-lg">♡</span> Lazada
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-center gap-1 font-bold text-black text-sm">TikTok Shop</div>
                    <div className="flex items-center justify-center font-bold text-blue-500 text-sm">Tiki</div>
                  </div>
                </div>
                <div className="text-center mt-6">
                  <button onClick={() => setPage('partners')} className="text-[#4B6BFF] text-sm font-semibold hover:underline">Xem tất cả →</button>
                </div>
              </div>
            </div>
          </section>

          <StatsBand />

          {/* CTA Section */}
          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10 mb-20">
            <div className="rounded-3xl shadow-2xl relative overflow-hidden bg-gradient-to-br from-orange-100 via-purple-100 to-blue-100 border border-white">
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
                  <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-4 leading-tight">
                    Sẵn sàng trở thành phiên bản{' '}
                    <span
                      style={{
                        backgroundImage: 'linear-gradient(135deg, #FF543C 0%, #8B4DFF 100%)',
                        WebkitBackgroundClip: 'text',
                        backgroundClip: 'text',
                        color: 'transparent',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      tốt hơn
                    </span>{' '}
                    của chính mình?
                  </h2>
                  <p className="text-gray-700 font-medium mb-8">
                    Bắt đầu ngay hôm nay – Hành trình chỉ thuộc về bạn.
                  </p>
                  <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                    <button
                      onClick={onGetStarted}
                      className="bg-[#0B132B] text-white px-8 py-4 rounded-full font-bold shadow-lg hover:shadow-[0_0_20px_rgba(0,194,255,0.4)] transition w-full sm:w-auto"
                    >
                      Tham gia ngay
                    </button>
                    <button
                      onClick={openQRModal}
                      className="bg-white/50 backdrop-blur border-2 border-[#0B132B] text-[#0B132B] px-8 py-4 rounded-full font-bold hover:bg-white transition flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Smartphone className="w-4 h-4" /> Tải ứng dụng
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
                      <QrCode className="w-3 h-3" /> quét để tải app
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
                BRAND ASSETS
              </div>
              <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-3">
                Bộ nhận diện thương hiệu
              </h2>
              <p className="text-gray-500 max-w-xl mx-auto text-sm md:text-base">
                Logo, màu sắc, typography và các quy chuẩn sử dụng chính thức của Zero to Forever.
              </p>
            </div>
            <div className="bg-white rounded-3xl zofo-shadow-soft p-3 md:p-6 overflow-hidden">
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
            eyebrow="Về chúng tôi"
            title="Chúng tôi tin ai cũng có thể trở thành phiên bản tốt hơn của chính mình"
            subtitle="Zero to Forever là nền tảng game hóa hành trình sống khỏe & sống tử tế — nơi mỗi hành động nhân văn của bạn, từ hiến máu đến chăm sóc sức khỏe mỗi ngày, đều được ghi nhận và lan tỏa."
          />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading
              eyebrow="SỨ MỆNH · TẦM NHÌN · GIÁ TRỊ"
              title="Điều thôi thúc chúng tôi mỗi ngày"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Target, color: 'text-[#FF543C]', bg: 'bg-red-50', title: 'Sứ mệnh', desc: 'Biến mỗi hành động tử tế nhỏ nhất — hiến máu, tập luyện, nghỉ ngơi đủ giấc — thành một bước tiến có thể đo lường và ghi nhận vĩnh viễn.' },
                { icon: Eye, color: 'text-[#4B6BFF]', bg: 'bg-blue-50', title: 'Tầm nhìn', desc: 'Trở thành hệ sinh thái "sống khỏe – sống ý nghĩa" lớn nhất Việt Nam, nơi công nghệ AI và Web3 phục vụ giá trị con người thật.' },
                { icon: HeartHandshake, color: 'text-[#8B4DFF]', bg: 'bg-purple-50', title: 'Giá trị cốt lõi', desc: 'An toàn – Minh bạch – Bảo mật – Nhân văn. Dữ liệu của bạn luôn thuộc về bạn, không đánh đổi bằng quảng cáo hay dữ liệu cá nhân.' },
              ].map((v, i) => (
                <div key={i} className="bg-white rounded-3xl zofo-shadow-soft p-8">
                  <div className={`w-14 h-14 rounded-2xl ${v.bg} flex items-center justify-center mb-5`}>
                    <v.icon className={`w-7 h-7 ${v.color}`} />
                  </div>
                  <h4 className="font-bold text-xl text-gray-900 mb-3">{v.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-5xl px-4 lg:px-8 py-10">
            <SectionHeading
              eyebrow="CHẶNG ĐƯỜNG"
              title="Câu chuyện của chúng tôi"
              subtitle="Từ một ý tưởng nhỏ về việc khuyến khích hiến máu, đến một hệ sinh thái sống khỏe toàn diện."
            />
            <div className="space-y-6">
              {[
                { year: '2023', title: 'Khởi nguồn ý tưởng', desc: 'Nhóm sáng lập nhận ra: mọi người muốn làm điều tốt, nhưng thiếu một nơi để ghi nhận & duy trì động lực lâu dài.' },
                { year: '2024', title: 'Xây dựng bản thử nghiệm', desc: 'Ra mắt chương trình "Hiến máu nhân văn" thí điểm cùng vài bệnh viện & tổ chức đối tác đầu tiên.' },
                { year: '2025', title: 'Ra mắt Zero to Forever', desc: 'Chính thức ra mắt nền tảng game hóa Zero to Hero, tích hợp AI Coach cá nhân hóa và hệ thống POAP/SBT ghi nhận vĩnh viễn.' },
                { year: '2026', title: 'Mở rộng hệ sinh thái', desc: 'Kết nối thêm đối tác y tế, doanh nghiệp và nền tảng công nghệ để nhân rộng hành trình "sống khỏe – sống ý nghĩa" trên toàn quốc.' },
              ].map((m, i) => (
                <div key={i} className="flex gap-6 items-start bg-white rounded-2xl zofo-shadow-soft p-6">
                  <div className="flex-shrink-0 w-20 h-14 rounded-xl zofo-gradient-brand text-white font-black text-lg flex items-center justify-center">
                    {m.year}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">{m.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading
              eyebrow="ĐỘI NGŨ"
              title="Những người đứng sau hành trình"
              subtitle="Một đội ngũ nhỏ, đa lĩnh vực — y tế, công nghệ AI, thiết kế game hóa và cộng đồng."
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { role: 'Founder & CEO', color: 'bg-red-50 text-[#FF543C]' },
                { role: 'Product & Game Design', color: 'bg-blue-50 text-[#4B6BFF]' },
                { role: 'AI & Công nghệ', color: 'bg-purple-50 text-[#8B4DFF]' },
                { role: 'Cộng đồng & Đối tác', color: 'bg-green-50 text-green-600' },
              ].map((p, i) => (
                <div key={i} className="bg-white rounded-2xl zofo-shadow-soft p-6 text-center">
                  <div className={`w-16 h-16 rounded-full ${p.color} flex items-center justify-center mx-auto mb-4`}>
                    <User className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-sm text-gray-900">{p.role}</h4>
                </div>
              ))}
            </div>
          </section>

          <StatsBand />
          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title="Cùng chúng tôi viết tiếp câu chuyện này"
            subtitle="Mỗi thành viên tham gia là một chương mới trong hành trình Zero to Forever."
          />
        </>
      )}

      {/* ══════════════════════════ HÀNH TRÌNH ══════════════════════════ */}
      {page === 'journey' && (
        <>
          <PageHero
            icon={Compass}
            eyebrow="Hành trình"
            title="Zero to Hero — 7 chặng để trở thành phiên bản tốt hơn"
            subtitle="Một hệ thống cấp bậc game hóa, biến mỗi thói quen tốt và hành động tử tế thành kinh nghiệm (EXP) để bạn lên cấp mỗi ngày."
          />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow="7 CHẶNG HÀNH TRÌNH" title="Bạn đang ở đâu trên hành trình?" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Mountain, bg: 'bg-gray-100', color: 'text-gray-600', label: 'Zero', desc: 'Bắt đầu hành trình. Tạo hồ sơ ẩn danh chỉ trong 5 giây, không cần đăng ký.' },
                { icon: Sprout, bg: 'bg-green-100', color: 'text-green-600', label: 'Awaken', desc: 'Khám phá bản thân qua các bài đánh giá sức khỏe & thói quen đầu tiên.' },
                { icon: Compass, bg: 'bg-blue-100', color: 'text-[#4B6BFF]', label: 'Explorer', desc: 'Thử nghiệm Daily Quest, làm quen với AI Coach và cộng đồng.' },
                { icon: ShieldCheck, bg: 'bg-yellow-100', color: 'text-yellow-600', label: 'Guardian', desc: 'Xây dựng thói quen bền vững: vận động, dinh dưỡng, giấc ngủ đều đặn.' },
                { icon: Zap, bg: 'bg-red-100', color: 'text-[#FF543C]', label: 'Hero', desc: 'Tạo ra giá trị thật: hiến máu, giúp đỡ cộng đồng, hoàn thành nhiệm vụ lớn.' },
                { icon: Crown, bg: 'bg-purple-100', color: 'text-purple-600', label: 'Legend', desc: 'Truyền cảm hứng — dẫn dắt Guild, cố vấn cho các Hero mới.' },
                { icon: InfinityIcon, bg: 'bg-teal-100', color: 'text-teal-600', label: 'Forever', desc: 'Sống mãi giá trị — dấu ấn của bạn được ghi nhận vĩnh viễn bằng POAP & SBT.' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-3xl zofo-shadow-soft p-6 flex flex-col gap-4">
                  <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center`}>
                    <s.icon className={`w-7 h-7 ${s.color}`} />
                  </div>
                  <h4 className="font-black text-lg text-gray-900">{s.label}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
              <div className="bg-[#0B132B] rounded-3xl p-6 flex flex-col justify-center items-start gap-3 text-white">
                <Rocket className="w-8 h-8 text-[#00C2FF]" />
                <h4 className="font-black text-lg">Bạn sẽ ở chặng nào?</h4>
                <p className="text-sm text-gray-300">Bắt đầu ngay để AI Coach xác định điểm khởi đầu phù hợp với bạn.</p>
                <button onClick={onGetStarted} className="mt-2 zofo-gradient-blue text-sm font-semibold px-5 py-2.5 rounded-full flex items-center gap-1">
                  Bắt đầu hành trình <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <div className="bg-white rounded-3xl zofo-shadow-soft p-8 lg:p-12 grid lg:grid-cols-2 gap-10 items-center">
              <div>
                <SectionHeading
                  center={false}
                  eyebrow="CÁCH LÊN CẤP"
                  title="EXP, Daily Quest & Streak"
                  subtitle="Mỗi hành động tốt đều quy đổi thành EXP minh bạch, có thể theo dõi từng ngày."
                />
                <ul className="space-y-4 text-sm font-medium text-gray-700">
                  {[
                    'Hoàn thành Daily Quest (đi bộ, uống nước, thiền, ngủ đúng giờ) để nhận EXP mỗi ngày',
                    'Duy trì streak liên tục để nhận thêm hệ số EXP thưởng',
                    'Hiến máu, tham gia sự kiện cộng đồng nhận EXP & Badge đặc biệt',
                    'AI Coach tự động đề xuất Roadmap lên cấp phù hợp với thể trạng của bạn',
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-[#eef1fc] rounded-3xl p-6">
                <div className="bg-white rounded-2xl p-5 shadow-sm flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs text-gray-500 font-medium mb-1">Cấp hiện tại</p>
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
                  {[
                    { label: 'Đi bộ 6.000 bước', value: '6.432/6.000', done: true },
                    { label: 'Uống 2 lít nước', value: '1,8/2 lít', done: false },
                    { label: 'Thiền 10 phút', value: '10/10', done: true },
                    { label: 'Ngủ trước 23:00', value: '22:30', done: true },
                  ].map((q, i) => (
                    <div key={i} className="bg-white rounded-xl p-3 shadow-sm flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${q.done ? 'bg-green-100 text-green-500' : 'bg-purple-100 text-[#8B4DFF]'}`}>
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
            title="Bắt đầu chặng đầu tiên của bạn ngay hôm nay"
            subtitle="Không cần đăng ký — hồ sơ ẩn danh của bạn đã sẵn sàng trong vài giây."
          />
        </>
      )}

      {/* ══════════════════════════ CỘNG ĐỒNG ══════════════════════════ */}
      {page === 'community' && (
        <>
          <PageHero
            icon={Users}
            eyebrow="Cộng đồng"
            title="Một cộng đồng cùng nhau trở nên tốt hơn mỗi ngày"
            subtitle="Hơn 207.000 thành viên đang cùng nhau hiến máu, rèn luyện sức khỏe và lan tỏa những giá trị tích cực khắp Việt Nam."
          />

          <StatsBand />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow="THAM GIA CÙNG NHAU" title="Nhiều cách để kết nối" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Users2, color: 'text-[#4B6BFF]', bg: 'bg-blue-50', title: 'Guild theo sở thích', desc: 'Tham gia Guild như Blood Hero, Runner Guild... để cùng thi đua và hỗ trợ nhau.' },
                { icon: CalendarDays, color: 'text-[#FF543C]', bg: 'bg-red-50', title: 'Sự kiện offline', desc: 'Ngày hội hiến máu, giải chạy cộng đồng, workshop sức khỏe tại nhiều tỉnh thành.' },
                { icon: MessageCircle, color: 'text-green-600', bg: 'bg-green-50', title: 'Diễn đàn chia sẻ', desc: 'Chia sẻ hành trình, kinh nghiệm sống khỏe và động viên nhau mỗi ngày.' },
                { icon: Trophy, color: 'text-[#8B4DFF]', bg: 'bg-purple-50', title: 'Bảng xếp hạng', desc: 'Thi đua lành mạnh giữa các Hero và Guild theo tuần, tháng, mùa giải.' },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-3xl zofo-shadow-soft p-6">
                  <div className={`w-14 h-14 rounded-2xl ${c.bg} flex items-center justify-center mb-4`}>
                    <c.icon className={`w-7 h-7 ${c.color}`} />
                  </div>
                  <h4 className="font-bold text-gray-900 mb-2">{c.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <SectionHeading eyebrow="CẢM NHẬN THÀNH VIÊN" title="Câu chuyện từ cộng đồng" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { name: 'Minh — Blood Hero Guild', quote: 'Lần đầu hiến máu tôi thấy hơi lo, nhưng khi thấy Badge "First Blood" xuất hiện trong hồ sơ, tôi thật sự tự hào và muốn tiếp tục.' },
                { name: 'Lan Anh — Runner Guild', quote: 'Daily Quest giúp tôi duy trì thói quen chạy bộ đều đặn suốt 3 tháng — điều tôi chưa từng làm được trước đây.' },
                { name: 'Khang — Health Hero', quote: 'AI Coach nhắc tôi uống nước và ngủ đúng giờ mỗi ngày, nhỏ nhưng thay đổi lớn cho sức khỏe của tôi.' },
              ].map((t, i) => (
                <div key={i} className="bg-white rounded-3xl zofo-shadow-soft p-6 flex flex-col gap-4">
                  <Quote className="w-8 h-8 text-[#4B6BFF] opacity-30" />
                  <p className="text-sm text-gray-700 italic leading-relaxed flex-1">{t.quote}</p>
                  <p className="text-xs font-bold text-gray-900">{t.name}</p>
                </div>
              ))}
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title="Tham gia cộng đồng Zero to Forever ngay hôm nay"
            subtitle="Kết nối với hàng trăm ngàn Hero khác trên khắp Việt Nam."
          />
        </>
      )}

      {/* ══════════════════════════ CÔNG NGHỆ ══════════════════════════ */}
      {page === 'technology' && (
        <>
          <PageHero
            icon={Cpu}
            eyebrow="Công nghệ"
            title="Công nghệ phục vụ con người — không phải ngược lại"
            subtitle="AI cá nhân hóa, ghi nhận vĩnh viễn bằng công nghệ blockchain, và quyền riêng tư tuyệt đối — tất cả được thiết kế để phục vụ hành trình của bạn."
          />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow="4 TRỤ CỘT CÔNG NGHỆ" title="Nền tảng đứng sau Zero to Forever" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { icon: Brain, color: 'text-[#FF543C]', bg: 'bg-red-50', title: 'AI Coach cá nhân hóa', desc: 'Phân tích thói quen, thiết kế roadmap và gợi ý Daily Quest riêng cho từng người, học hỏi liên tục từ tiến độ thực tế của bạn.' },
                { icon: Boxes, color: 'text-[#8B4DFF]', bg: 'bg-purple-50', title: 'POAP & Soulbound Token', desc: 'Mỗi cột mốc hành trình được ghi nhận bằng NFT vĩnh viễn (POAP/SBT) — bằng chứng nhân văn không thể làm giả, không thể xóa.' },
                { icon: ScanFace, color: 'text-[#4B6BFF]', bg: 'bg-blue-50', title: 'Avatar 3D cá nhân hóa', desc: 'Tạo nhân vật đại diện 3D (VRM) riêng cho hành trình của bạn, đồng bộ chuyển động và cảm xúc sống động.' },
                { icon: Lock, color: 'text-green-600', bg: 'bg-green-50', title: 'Bảo mật & quyền riêng tư', desc: 'Hồ sơ ẩn danh theo UUID thiết bị, dữ liệu sức khỏe không rời khỏi thiết bị của bạn nếu bạn không muốn.' },
              ].map((t, i) => (
                <div key={i} className="bg-white rounded-3xl zofo-shadow-soft p-8 flex gap-5">
                  <div className={`w-14 h-14 rounded-2xl ${t.bg} flex items-center justify-center flex-shrink-0`}>
                    <t.icon className={`w-7 h-7 ${t.color}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-gray-900 mb-2">{t.title}</h4>
                    <p className="text-sm text-gray-500 leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-5xl px-4 lg:px-8 py-10">
            <div className="bg-[#0B132B] rounded-3xl p-8 lg:p-12 text-white">
              <div className="flex items-center gap-3 mb-6">
                <Fingerprint className="w-8 h-8 text-[#00C2FF]" />
                <h3 className="text-2xl font-bold">Kiến trúc quyền riêng tư "UUID-first"</h3>
              </div>
              <div className="grid sm:grid-cols-2 gap-5 text-sm text-gray-300">
                {[
                  'Mỗi thiết bị được cấp một UUID duy nhất — không cần email hay mật khẩu để bắt đầu.',
                  'Hồ sơ, cấp độ và tiến trình được lưu ngay trên thiết bị của bạn.',
                  'Bạn có thể nâng cấp lên tài khoản thật bất cứ lúc nào để đồng bộ đa thiết bị.',
                  'Dữ liệu sức khỏe không bao giờ được bán hay chia sẻ cho bên thứ ba.',
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-[#00C2FF] flex-shrink-0 mt-0.5" />
                    {t}
                  </div>
                ))}
              </div>
              <button
                onClick={openVideoHelp}
                className="mt-8 zofo-gradient-blue text-sm font-semibold px-6 py-3 rounded-full flex items-center gap-2 w-max"
              >
                Xem giải thích chi tiết <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <SectionHeading eyebrow="NĂNG LỰC NỀN TẢNG" title="Được xây dựng để mở rộng" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { icon: Database, label: 'Dữ liệu on-device' },
                { icon: Layers, label: 'Kiến trúc module hóa' },
                { icon: Coins, label: 'Token hóa hành động tốt' },
                { icon: Wallet, label: 'Ví định danh ẩn' },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl zofo-shadow-soft p-6 text-center">
                  <s.icon className="w-8 h-8 text-[#4B6BFF] mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-700">{s.label}</p>
                </div>
              ))}
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title="Trải nghiệm công nghệ đứng sau hành trình của bạn"
            subtitle="Bắt đầu miễn phí, ẩn danh, không ràng buộc."
          />
        </>
      )}

      {/* ══════════════════════════ ĐỐI TÁC ══════════════════════════ */}
      {page === 'partners' && (
        <>
          <PageHero
            icon={Handshake}
            eyebrow="Đối tác"
            title="Cùng nhau nhân rộng những giá trị tốt đẹp"
            subtitle="Hơn 1.245 đối tác & tổ chức — từ bệnh viện, doanh nghiệp đến nền tảng công nghệ — đang đồng hành cùng Zero to Forever."
          />

          <StatsBand />

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-16">
            <SectionHeading eyebrow="HỆ SINH THÁI ĐỐI TÁC" title="Đối tác trong nhiều lĩnh vực" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Building2, color: 'text-[#FF543C]', bg: 'bg-red-50', title: 'Đối tác Y tế', desc: 'Bệnh viện, trung tâm hiến máu và tổ chức y tế phối hợp trong quy trình hiến – nhận tạng an toàn, minh bạch.' },
                { icon: Handshake, color: 'text-[#4B6BFF]', bg: 'bg-blue-50', title: 'Đối tác Doanh nghiệp', desc: 'Chương trình CSR, phúc lợi nhân viên gắn với sức khỏe và hoạt động tử tế, đo lường tác động thực tế.' },
                { icon: Cpu, color: 'text-[#8B4DFF]', bg: 'bg-purple-50', title: 'Đối tác Công nghệ', desc: 'Tích hợp API, marketplace và hạ tầng thanh toán/giao vận để mở rộng trải nghiệm cho thành viên.' },
              ].map((p, i) => (
                <div key={i} className="bg-white rounded-3xl zofo-shadow-soft p-8">
                  <div className={`w-14 h-14 rounded-2xl ${p.bg} flex items-center justify-center mb-5`}>
                    <p.icon className={`w-7 h-7 ${p.color}`} />
                  </div>
                  <h4 className="font-bold text-xl text-gray-900 mb-3">{p.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
            <SectionHeading eyebrow="ĐỐI TÁC HIỆN TẠI" title="Cùng đồng hành" />
            <div className="bg-white rounded-3xl zofo-shadow-soft p-8 lg:p-10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="flex items-center justify-center gap-2 font-bold text-gray-700">
                  <Gamepad2 className="w-5 h-5 text-blue-900" /> STEAMLAND
                </div>
                <div className="flex items-center justify-center gap-2 font-bold text-gray-700">
                  <span className="text-[#FF543C] text-xl">▲</span> ACCESSTRADE
                </div>
                <div className="flex items-center justify-center gap-1 font-bold text-orange-500 text-sm">
                  <ShoppingBag className="w-4 h-4" /> Shopee
                </div>
                <div className="flex items-center justify-center gap-1 font-bold text-blue-800 text-sm">
                  <span className="text-pink-500 text-lg">♡</span> Lazada
                </div>
                <div className="flex items-center justify-center font-bold text-black text-sm">TikTok Shop</div>
                <div className="flex items-center justify-center font-bold text-blue-500 text-sm">Tiki</div>
                <div className="flex items-center justify-center gap-2 font-bold text-gray-400 text-sm">
                  <Building2 className="w-4 h-4" /> Bệnh viện & TT Y tế
                </div>
                <div className="flex items-center justify-center gap-2 font-bold text-gray-400 text-sm">
                  <Globe className="w-4 h-4" /> Tổ chức phi lợi nhuận
                </div>
              </div>
            </div>
          </section>

          <section className="container mx-auto max-w-4xl px-4 lg:px-8 py-10 mb-10">
            <div className="bg-[#0B132B] rounded-3xl p-8 lg:p-12 text-center text-white">
              <BadgeCheck className="w-10 h-10 text-[#00C2FF] mx-auto mb-4" />
              <h3 className="text-2xl lg:text-3xl font-bold mb-3">Trở thành đối tác của Zero to Forever</h3>
              <p className="text-gray-300 max-w-xl mx-auto mb-6 text-sm md:text-base">
                Cùng chúng tôi mở rộng tác động tích cực đến hàng trăm ngàn con người trên khắp Việt Nam.
              </p>
              <a
                href="mailto:partners@zerotoforever.com"
                className="inline-flex items-center gap-2 zofo-gradient-brand px-6 py-3 rounded-full font-semibold hover:scale-105 transition transform"
              >
                <Mail className="w-4 h-4" /> Liên hệ hợp tác
              </a>
            </div>
          </section>

          <CTABand
            onGetStarted={onGetStarted}
            onOpenQR={openQRModal}
            title="Cùng Zero to Forever lan tỏa giá trị tốt đẹp"
            subtitle="Trở thành một phần trong hệ sinh thái vì cộng đồng."
          />
        </>
      )}

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
                  🌿 Hồ sơ ẩn danh (UUID) là gì?
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 3 }}>
                  Bắt đầu ngay — không cần đăng ký tài khoản
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
                  🎬 Video hướng dẫn
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
                    <UserUuid3DAvatar uuid="anonymous-profile-demo-uuid" isDark accent="#2d8a5e" label="Guest UUID" height="100%" minWidth={160} />
                    <UserUuid3DAvatar uuid="real-account-profile-demo-uuid" isDark accent="#00b8cc" label="User UUID" height="100%" minWidth={160} />
                  </div>
                </div>

                <style>{`@media (max-width: 720px) { .zofo-help-video-avatar-grid { grid-template-columns: 1fr !important; } }`}</style>

                <div style={{
                  marginTop: 16, padding: '14px 16px', borderRadius: 12,
                  background: 'rgba(45,138,94,0.1)',
                  border: '1px solid rgba(45,138,94,0.3)',
                  fontSize: 13, color: 'rgba(232,240,248,0.8)', lineHeight: 1.7,
                }}>
                  🔑 Mỗi thiết bị được cấp một UUID duy nhất. Hồ sơ, cấp độ và tiến trình của bạn được lưu ngay trên thiết bị — không cần email hay mật khẩu. Bạn có thể nâng cấp lên tài khoản thật bất cứ lúc nào để đồng bộ đa thiết bị.
                </div>

                <button
                  onClick={() => { setShowVideoHelp(false); onGetStarted() }}
                  className="mt-5 w-full zofo-gradient-brand text-white px-6 py-3 rounded-full font-semibold hover:scale-[1.02] transition transform flex items-center justify-center gap-2"
                >
                  Bắt đầu hành trình ngay <ArrowRight className="w-4 h-4" />
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
            <h3 className="text-lg font-bold mt-3">Tải ứng dụng Zero to Forever</h3>
            <p className="text-sm text-gray-400 mt-1 mb-5">Quét mã QR bên dưới bằng camera điện thoại để tải app.</p>

            <div className="bg-white p-4 rounded-2xl shadow-lg inline-flex flex-col items-center">
              <img alt="QR Code tải app Zero to Forever" className="w-48 h-48 object-contain" src={zofoQRCode} />
            </div>

            <p className="text-[11px] text-gray-400 mt-4 flex items-center justify-center gap-1">
              <QrCode className="w-3.5 h-3.5" /> quét để tải app
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
