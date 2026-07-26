import React from 'react'
import {
  ArrowRight, Play, CheckCircle2, Users, Heart, Droplet, HeartPulse,
  Brain, Trophy, Award, ShoppingBag, Gamepad2, Handshake, CalendarDays,
  Mountain, Sprout, Compass, ShieldCheck, Zap, Crown, Infinity as InfinityIcon,
  Quote, Fingerprint, QrCode, Smartphone, Menu, Home, User,
} from 'lucide-react'
import zofoLogo from '../assets/landing/ZeroToForever_Logo.png'
import zofoQRCode from '../assets/landing/KLX12-QR-Code.png'

/**
 * landingPageZeroToForever.jsx
 * -----------------------------------------------------------------------
 * Chuyển đổi từ file tĩnh "trang_chủ_zero_to_forever(2).html" sang React
 * component để dùng làm màn hình LandingPage đầu tiên của app.
 *
 * - Logo dùng ảnh thật: ZeroToForever_Logo.png
 * - QR "Quét để tải app" dùng ảnh thật: KLX12-QR-Code.png
 * - Icon Font Awesome trong bản HTML gốc được thay bằng lucide-react
 *   (thư viện icon đã có sẵn trong project) để không phải nhúng thêm
 *   CDN ngoài.
 *
 * Props (đều optional — component vẫn render standalone bình thường):
 *  - onGetStarted()   : bấm "Bắt đầu hành trình" / "Tham gia ngay" (CTA chính)
 *  - onLogin()        : bấm "Đăng nhập"
 *  - onWatchVideo()   : bấm "Xem video giới thiệu"
 *  - onDownloadApp()  : bấm "Tải ứng dụng"
 */
export default function LandingPageZeroToForever({
  onGetStarted = () => {},
  onLogin = () => {},
  onWatchVideo = () => {},
  onDownloadApp = () => {},
}) {
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

      {/* Navbar */}
      <nav className="absolute w-full z-50 top-0 left-0 pt-6 px-6 lg:px-12 flex justify-between items-center text-white">
        <div className="flex items-center gap-3">
          <img src={zofoLogo} alt="Zero to Forever" className="h-10 md:h-12 w-auto object-contain" />
        </div>
        <div className="hidden lg:flex space-x-8 text-sm font-medium">
          <a className="border-b-2 border-white pb-1" href="#">Trang chủ</a>
          <a className="text-gray-300 hover:text-white transition" href="#">Về chúng tôi</a>
          <a className="text-gray-300 hover:text-white transition" href="#">Hành trình</a>
          <a className="text-gray-300 hover:text-white transition" href="#">Cộng đồng</a>
          <a className="text-gray-300 hover:text-white transition" href="#">Công nghệ</a>
          <a className="text-gray-300 hover:text-white transition" href="#">Đối tác</a>
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
                onClick={onWatchVideo}
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
            <button className="mt-4 border border-[#4B6BFF] text-[#4B6BFF] hover:bg-[#4B6BFF] hover:text-white font-medium px-6 py-3 rounded-full transition w-max flex items-center gap-2">
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
              <h3 className="text-xl font-bold text-center mb-8">Hành trình Zero to Hero</h3>
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
              },
              {
                img: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                bg: 'bg-blue-100',
                title: 'Cộng đồng',
                desc: 'Kết nối – Chia sẻ – Lan tỏa những giá trị tích cực.',
              },
              {
                img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                bg: 'bg-orange-100',
                icon: ShoppingBag,
                title: 'Marketplace',
                desc: 'Sản phẩm & dịch vụ sức khỏe uy tín.',
                overlayCenter: true,
              },
              {
                img: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
                bg: 'bg-gray-900',
                title: 'Game hóa',
                desc: 'XP – Level – Quest – Guild. Lên cấp mỗi ngày.',
                darkOverlay: true,
              },
            ].map((card, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden zofo-shadow-soft flex flex-col group cursor-pointer hover:-translate-y-1 transition duration-300">
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
              </div>
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
              <a className="text-[#4B6BFF] text-sm font-semibold hover:underline" href="#">Xem tất cả →</a>
            </div>
          </div>
        </div>
      </section>

      {/* Dark Stats Banner */}
      <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-6">
        <div className="bg-[#0B132B] rounded-2xl shadow-xl p-6 lg:p-10 flex flex-wrap lg:flex-nowrap justify-between gap-6 relative overflow-hidden">
          <div className="absolute inset-0 zofo-hero-glow opacity-50"></div>
          {[
            { icon: HeartPulse, color: 'text-[#FF543C]', value: '3.248.765+', label: 'Lượt hành động tử tế' },
            { icon: Users, color: 'text-[#00C2FF]', value: '207.654+', label: 'Người đang tham gia' },
            { icon: Handshake, color: 'text-[#8B4DFF]', value: '1.245+', label: 'Đối tác & tổ chức' },
            { icon: CalendarDays, color: 'text-[#4B6BFF]', value: '365', label: 'Ngày - Hành trình tốt hơn' },
          ].map((s, i) => (
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
                Sẵn sàng trở thành phiên bản <span className="text-transparent bg-clip-text zofo-gradient-brand">tốt hơn</span> của chính mình?
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
                  onClick={onDownloadApp}
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
    </div>
  )
}
