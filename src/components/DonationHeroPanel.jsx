import React, { useState, useRef, useEffect } from 'react';
import { UserPlus, ShieldCheck, Lock, Leaf, Sparkles, Award, Star, LogIn } from 'lucide-react';
import useHeroPanelPrefs from './heroPanels/useHeroPanelPrefs.js';
import HeroPanelPrefsToggle from './heroPanels/HeroPanelPrefsToggle.jsx';
import useHeroSelection from './heroPanels/useHeroSelection.js';
import HeroMicVoiceButton from './heroPanels/HeroMicVoiceButton.jsx';
import HeroPopupCornerCloseButtons from './heroPanels/HeroPopupCornerCloseButtons.jsx';
import { getOrganById, lowerFirst } from '../data/organs.js';
import BackButton from './common/BackButton.jsx';
import AnatomyHoverOverlay from './AnatomyHoverOverlay.jsx';
import HeroZoneStackPopup from './heroPanels/HeroZoneStackPopup.jsx';

// ============================================================================
// DonationHeroPanel — màn hình chào mừng cho tính năng "Anh Hùng Hiến Tặng"
// (hỗ trợ tìm hiểu hành trình hiến tặng). Dựng theo bản thiết kế tham
// khảo: avatar trợ lý ở giữa, bản đồ HERO_ZONES, Micro, và
// "Hành trình Siêu Anh Hùng" gồm 5 cấp độ để
// khuyến khích người dùng quay lại tìm hiểu dần từng bước.
//
// Đây là màn hình ĐỘC LẬP với theme sáng/tối chung của app — nhưng CÓ theme
// sáng/tối + ngôn ngữ Việt/Anh RIÊNG, đồng bộ với ChooseUserRolePanel thông
// qua useHeroPanelPrefs (localStorage).
// ============================================================================



const TEXT = {
  vi: {
    createAccountBtn: 'Tạo tài khoản',
    createAccountNote: 'Để lưu hành trình học tập\nvà nâng cấp siêu anh hùng',
    greeting: 'Xin chào! Tôi ở đây để',
    titlePre: 'đồng hành cùng bạn tìm hiểu',
    titleHighlight: (organLabel) => `hiến tặng ${lowerFirst(organLabel)}`,
    titleHighlightGeneral: 'chăm sóc sức khỏe bền vững',
    titlePost: '.',
    levelBadge: (level) => (
      <>Bạn đang là <span className="font-bold">siêu anh hùng cấp độ {level}</span> 💚</>
    ),
    micLabel: 'Nhấn để nói',
    organBadgePrefix: 'Đang tìm hiểu về',
    journeyTitle: 'Hành trình Siêu Anh Hùng',
    levelLabel: 'Cấp',
    current: 'Đang ở đây',
    unlocked: 'Đã mở khoá',
    locked: 'Chưa mở khoá',
    privacy: 'Dữ liệu bạn cung cấp đều nằm ở máy của bạn, không bao giờ lưu vào server của chúng tôi. ',
    privacyBold: 'Tất cả dữ liệu là của bạn.',
    anatomyPreviewTitle: 'Bản đồ giải phẫu cơ thể',
    anatomyPreviewHint: 'Bấm vào từng điểm để xem chú thích',
    bodyProtectionPreviewTitle: 'Game bảo vệ cơ thể',
    bodyProtectionPreviewHint: 'Bấm vào Cấp 2 để xem trước trò chơi',
    captainKhanhPreviewTitle: 'Captain Khánh Game',
    captainKhanhPreviewHint: 'Bấm vào Cấp 3 để mở trò chơi',
    heroZonesPreviewTitle: 'Bản đồ 3D nội tạng anh hùng',
    heroZonesPreviewHint: 'Bấm vào Cấp 4 để mở bản đồ HERO_ZONES',
    footer: 'Anh Hùng Hiến Tặng · Cùng nhau lan toả sự sống',
    back: 'Quay lại',
    login: 'Đăng nhập',
    levels: [
      { level: 1, title: 'Người Tìm Hiểu', icon: '🥷', ring: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-500' },
      { level: 2, title: 'Người Quan Tâm', icon: '💚', ring: 'from-emerald-300 to-emerald-500', badge: 'bg-emerald-400' },
      { level: 3, title: 'Người Có Kiến Thức', icon: '📖', ring: 'from-sky-300 to-sky-500', badge: 'bg-sky-500' },
      { level: 4, title: 'Người Sẵn Sàng', icon: '🌱', ring: 'from-violet-300 to-violet-500', badge: 'bg-violet-500' },
      { level: 5, title: 'Đại Sứ Hiến Tặng', icon: '🛡️', ring: 'from-amber-300 to-amber-500', badge: 'bg-amber-500' },
    ],
  },
  en: {
    createAccountBtn: 'Create account',
    createAccountNote: 'To save your learning journey\nand level up your superhero',
    greeting: "Hi! I'm here to",
    titlePre: 'guide you through',
    titleHighlight: (organLabel) => `${lowerFirst(organLabel)} donation`,
    titleHighlightGeneral: 'sustainable health & wellness',
    titlePost: '.',
    levelBadge: (level) => (
      <>You're a <span className="font-bold">level {level} superhero</span> 💚</>
    ),
    micLabel: 'Tap to speak',
    organBadgePrefix: 'Currently exploring',
    journeyTitle: 'Superhero Journey',
    levelLabel: 'Level',
    current: 'You are here',
    unlocked: 'Unlocked',
    locked: 'Locked',
    privacy: 'The data you provide stays on your device and is never stored on our servers. ',
    privacyBold: 'All your data belongs to you.',
    anatomyPreviewTitle: 'Body anatomy atlas',
    anatomyPreviewHint: 'Click each point for details',
    bodyProtectionPreviewTitle: 'Body protection game',
    bodyProtectionPreviewHint: 'Click Level 2 to preview the game',
    captainKhanhPreviewTitle: 'Captain Khánh Game',
    captainKhanhPreviewHint: 'Click Level 3 to open the game',
    heroZonesPreviewTitle: '3D hero organ map',
    heroZonesPreviewHint: 'Click Level 4 to open HERO_ZONES map',
    footer: 'Donation Hero · Spreading life together',
    back: 'Back',
    login: 'Log in',
    levels: [
      { level: 1, title: 'Learner', icon: '🥷', ring: 'from-emerald-400 to-emerald-600', badge: 'bg-emerald-500' },
      { level: 2, title: 'Interested Person', icon: '💚', ring: 'from-emerald-300 to-emerald-500', badge: 'bg-emerald-400' },
      { level: 3, title: 'Knowledgeable Person', icon: '📖', ring: 'from-sky-300 to-sky-500', badge: 'bg-sky-500' },
      { level: 4, title: 'Ready Person', icon: '🌱', ring: 'from-violet-300 to-violet-500', badge: 'bg-violet-500' },
      { level: 5, title: 'Donation Ambassador', icon: '🛡️', ring: 'from-amber-300 to-amber-500', badge: 'bg-amber-500' },
    ],
  },
};

export default function DonationHeroPanel({ mode = 'guest', onEnterAction, onBack, onLogin }) {
  const [currentLevel] = useState(1);
  // Popup xem trước bản đồ giải phẫu (thẻ Cấp 1 "Người Tìm Hiểu") chỉ được
  // mở khi người dùng chủ động click/tap hoặc nhấn Enter/Space. Không dùng
  // hover để mở popup, tránh iframe/game chạy ngầm khi người dùng chỉ rê chuột.
  const [showAnatomyPreview, setShowAnatomyPreview] = useState(false);
  const [showBodyProtectionPreview, setShowBodyProtectionPreview] = useState(false);
  const [showCaptainKhanhPreview, setShowCaptainKhanhPreview] = useState(false);
  const [showHeroZonesPreview, setShowHeroZonesPreview] = useState(false);
  const anatomyPreviewRef = useRef(null);
  const bodyProtectionPreviewRef = useRef(null);
  const captainKhanhPreviewRef = useRef(null);
  const heroZonesPreviewRef = useRef(null);

  // Trên mobile không có sự kiện "hover ra ngoài" để tự đóng popup, nên cần
  // tự bắt sự kiện chạm/click ra ngoài vùng thẻ Cấp 1/Cấp 2 + popup để đóng lại.
  useEffect(() => {
    if (!showAnatomyPreview && !showBodyProtectionPreview && !showCaptainKhanhPreview && !showHeroZonesPreview) return;
    const handleOutsideInteraction = (event) => {
      if (anatomyPreviewRef.current && !anatomyPreviewRef.current.contains(event.target)) {
        setShowAnatomyPreview(false);
      }
      if (bodyProtectionPreviewRef.current && !bodyProtectionPreviewRef.current.contains(event.target)) {
        setShowBodyProtectionPreview(false);
      }
      if (captainKhanhPreviewRef.current && !captainKhanhPreviewRef.current.contains(event.target)) {
        setShowCaptainKhanhPreview(false);
      }
      if (heroZonesPreviewRef.current && !heroZonesPreviewRef.current.contains(event.target)) {
        setShowHeroZonesPreview(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideInteraction);
    return () => document.removeEventListener('pointerdown', handleOutsideInteraction);
  }, [showAnatomyPreview, showBodyProtectionPreview, showCaptainKhanhPreview, showHeroZonesPreview]);

  const isGuest = mode === 'guest';
  const { isDark, isEn, toggleTheme, toggleLang } = useHeroPanelPrefs();
  // "Trang sau" của ChooseUserRolePanel: đọc lại đúng Cơ quan người dùng đã
  // chọn (lưu trong IndexedDB) để hiển thị đúng tên + hình (emoji) — mặc
  // định 'mauhiem' (Hiến Máu Nhân Văn / Máu Hiếm) nếu chưa từng chọn.
  const { organId, role } = useHeroSelection();
  const organ = getOrganById(organId);
  const t = isEn ? TEXT.en : TEXT.vi;
  const JOURNEY_LEVELS = t.levels;
  const organLabel = isEn ? organ.en : organ.vi;
  // Nếu ở màn hình trước người dùng chọn "Tôi chưa muốn hiến tặng"
  // (role === 'notDonate') HOẶC chọn thẻ "Rèn luyện sức khỏe"
  // (role === 'train'), trang này không nên nói "tìm hiểu hiến tặng
  // <cơ quan>" nữa (cơ quan lúc đó chỉ là giá trị mặc định/cũ từ lần chọn
  // trước, không còn là ý định thật của người dùng) — thay bằng nội dung
  // tổng quát về chăm sóc sức khỏe, đồng bộ hành vi giữa 2 lựa chọn này.
  const isNotDonate = role === 'notDonate' || role === 'train';
  const titleHighlight = isNotDonate ? t.titleHighlightGeneral : t.titleHighlight(organLabel);
  // guest (chưa đăng nhập): bấm Tạo tài khoản dẫn sang trang Login
  // (onEnterAction do App.jsx truyền xuống). Các nút "Tìm hiểu hiến tặng"
  // và "Kiến thức y khoa" đã được bỏ để Micro là lối vào hành động chính.

  return (
    <div
      className={`min-h-full w-full px-4 py-6 sm:px-5 sm:py-8 md:px-10 md:py-10 transition-colors ${
        isDark
          ? 'bg-gradient-to-b from-[#0b1220] to-[#0f172a] text-gray-100'
          : 'bg-gradient-to-b from-[#f6faf7] to-[#eef7f1] text-[#16241c]'
      }`}
      style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
    >
      <div className="max-w-2xl lg:max-w-3xl mx-auto">

        {/* Đổi giao diện sáng/tối + ngôn ngữ, và Tạo tài khoản (chỉ khách) */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
          <HeroPanelPrefsToggle
            isDark={isDark}
            isEn={isEn}
            onToggleTheme={toggleTheme}
            onToggleLang={toggleLang}
          />

          {isGuest && (
            <div className="text-right">
              <button
                onClick={onEnterAction}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md transition-all ${
                  isDark
                    ? 'border-emerald-400/30 bg-white/5 text-emerald-300 hover:border-emerald-400/60'
                    : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300'
                }`}
              >
                <UserPlus size={16} />
                {t.createAccountBtn}
              </button>
              <p className={`mt-2 text-xs leading-snug max-w-[190px] ml-auto whitespace-pre-line ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {t.createAccountNote}
              </p>
            </div>
          )}
        </div>

        {/* Avatar trợ lý */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-10 h-44 w-44">
            <Sparkles className="absolute -top-2 -left-6 text-emerald-400" size={22} />
            <Sparkles className="absolute -bottom-1 -right-5 text-emerald-400" size={16} />
            <div className="absolute inset-2 rounded-full bg-white shadow-[0_0_0_6px_rgba(255,255,255,0.9),0_0_28px_rgba(16,185,129,0.35)]" />
            <div className="absolute inset-[14px] rounded-full bg-gradient-to-br from-slate-800 via-indigo-700 to-slate-900 flex items-center justify-center overflow-hidden">
              <div className="absolute inset-0 opacity-40" style={{
                backgroundImage: 'radial-gradient(circle at 30% 30%, rgba(255,180,80,0.5), transparent 55%), radial-gradient(circle at 70% 70%, rgba(56,189,248,0.5), transparent 55%)'
              }} />
              <span className="text-5xl relative">🧑‍⚕️</span>
            </div>
            <div className="absolute left-[calc(100%-10px)] top-1/2 z-10 -translate-y-1/2">
              <HeroMicVoiceButton
                mode={mode}
                activePanelLabel="Anh Hùng Hiến Tặng"
                isVi={!isEn}
                isDark={isDark}
                micLabel={t.micLabel}
                variant="expanded"
                buttonSize={88}
                iconSize={34}
                holoEffect
                compact
              />
            </div>
          </div>

          <p className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-emerald-400/80' : 'text-emerald-600/80'}`}>{t.greeting}</p>
          <h1 className={`mt-3 text-2xl sm:text-[28px] md:text-[32px] font-extrabold leading-[1.25] tracking-[-0.01em] mb-5 ${isDark ? 'text-gray-100' : 'text-[#16241c]'}`}>
            {t.titlePre}{' '}
            <span className={`bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-emerald-300 to-sky-300' : 'from-emerald-600 to-sky-600'}`}>
              {titleHighlight}
            </span>
            {t.titlePost}
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Cơ quan đang chọn — tên + hình (emoji), load từ IndexedDB, đồng bộ với
            ChooseUserRolePanel. Ẩn khi người dùng đã chọn "Tôi chưa muốn hiến tặng"
            vì lúc đó cơ quan không còn liên quan đến lựa chọn của họ. */}
            {!isNotDonate && (
              <div className={`inline-flex items-center gap-2 rounded-full border shadow-sm px-4 py-2 text-sm ${isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-white border-emerald-100 text-gray-600'}`}>
                <span className="text-lg leading-none">{organ.emoji}</span>
                <span>{t.organBadgePrefix}: <span className="font-bold">{organLabel}</span></span>
              </div>
            )}
          </div>

        </div>

        {/* Hành trình siêu anh hùng */}
        <div className="mt-14">
          <div className="flex items-center justify-center gap-3 mb-8">
            <span className={`h-px w-8 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
            <h2 className={`text-xs font-bold tracking-[0.15em] uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.journeyTitle}</h2>
            <span className={`h-px w-8 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
          </div>

          <div className="flex flex-wrap justify-center gap-x-2 gap-y-8 sm:gap-x-4">
            {JOURNEY_LEVELS.map((lvl) => {
              const unlocked = lvl.level <= currentLevel;
              const isCurrent = lvl.level === currentLevel;
              const isLevelOne = lvl.level === 1;
              const isLevelTwo = lvl.level === 2;
              const isLevelThree = lvl.level === 3;
              const isLevelFour = lvl.level === 4;
              const isPreviewLevel = isLevelOne || isLevelTwo || isLevelThree || isLevelFour;
              return (
                <div
                  key={lvl.level}
                  ref={isLevelOne ? anatomyPreviewRef : isLevelTwo ? bodyProtectionPreviewRef : isLevelThree ? captainKhanhPreviewRef : isLevelFour ? heroZonesPreviewRef : undefined}
                  className={`relative flex flex-col items-center w-[150px] text-center ${isPreviewLevel ? 'group' : ''}`}

                >
                  <div className="relative mb-3">
                    {isLevelOne && unlocked && (
                      <div
                        className="absolute -inset-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-40 blur-md transition duration-500 animate-pulse group-hover:opacity-100 group-hover:duration-200 group-hover:animate-none"
                        style={{ clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)' }}
                      />
                    )}
                    <div
                      className={`relative overflow-hidden w-16 h-16 flex items-center justify-center text-2xl bg-gradient-to-br ${isLevelOne && unlocked ? 'from-slate-900/80 to-slate-950' : unlocked ? lvl.ring : (isDark ? 'from-white/10 to-white/5' : 'from-gray-200 to-gray-300')} shadow-sm transition-all duration-300 ${isPreviewLevel ? 'cursor-pointer group-hover:scale-[0.98]' : ''}`}
                      style={{ clipPath: 'polygon(50% 0%, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)' }}
                      {...(isPreviewLevel
                        ? {
                            // Bấm để mở/đóng popup; không mở bằng hover.
                            onClick: () => {
                              if (isLevelOne) setShowAnatomyPreview((prev) => !prev);
                              if (isLevelTwo) setShowBodyProtectionPreview((prev) => !prev);
                              if (isLevelThree) setShowCaptainKhanhPreview((prev) => !prev);
                              if (isLevelFour) setShowHeroZonesPreview((prev) => !prev);
                            },
                            role: 'button',
                            tabIndex: 0,
                            'aria-expanded': isLevelOne ? showAnatomyPreview : isLevelTwo ? showBodyProtectionPreview : isLevelThree ? showCaptainKhanhPreview : showHeroZonesPreview,
                            onKeyDown: (event) => {
                              if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                if (isLevelOne) setShowAnatomyPreview((prev) => !prev);
                                if (isLevelTwo) setShowBodyProtectionPreview((prev) => !prev);
                                if (isLevelThree) setShowCaptainKhanhPreview((prev) => !prev);
                                if (isLevelFour) setShowHeroZonesPreview((prev) => !prev);
                              }
                            },
                          }
                        : {})}
                    >
                      {isLevelOne && unlocked && (
                        <span className="absolute top-0 left-[-100%] h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-45deg] group-hover:animate-shine" />
                      )}
                      <span className={unlocked ? '' : 'opacity-40 grayscale'}>{lvl.icon}</span>
                    </div>
                    <span className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full text-[11px] font-bold text-white flex items-center justify-center border-2 ${isDark ? 'border-[#0f172a]' : 'border-white'} ${unlocked ? lvl.badge : 'bg-gray-400'}`}>
                      {lvl.level}
                    </span>
                  </div>
                  <div className={`font-bold text-sm ${isDark ? 'text-gray-100' : 'text-[#16241c]'}`}>{t.levelLabel} {lvl.level}</div>
                  <div className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{lvl.title}</div>

                  {/* Popup xem trước bản đồ giải phẫu — chỉ gắn vào thẻ Cấp 1
                  "Người Tìm Hiểu". Điều khiển bằng state showAnatomyPreview
                  (thay vì chỉ CSS group-hover thuần) để:
                  - Mở/đóng khi bấm vào icon (onClick), và tự đóng khi chạm/click
                    ra ngoài (xem useEffect pointerdown ở trên).
                  Định vị tuyệt đối phía trên thẻ, căn giữa theo chiều ngang. */}
                  {isLevelOne && showAnatomyPreview && (
                    <div
                      className={`
                        fixed left-2 right-2 bottom-24 mb-0 w-auto translate-x-0
                        sm:absolute sm:bottom-full sm:left-1/2 sm:right-auto sm:mb-4 sm:-translate-x-1/2
                        sm:w-[min(520px,calc(100vw-2rem))]
                        md:w-[min(580px,calc(100vw-3rem))]
                        lg:w-[min(640px,calc(100vw-4rem))]
                        transition-all duration-200 ease-out origin-bottom z-30 opacity-100 scale-100 pointer-events-auto
                      `}
                    >
                      <div className={`relative rounded-2xl border p-3 shadow-2xl ${isDark ? 'border-emerald-400/20 bg-[#0f172a]' : 'border-emerald-100 bg-white'}`}>
                        <HeroPopupCornerCloseButtons onClose={() => setShowAnatomyPreview(false)} isDark={isDark} label={isEn ? 'Close popup' : 'Đóng popup'} />
                        <div className="flex items-center justify-between mb-2 px-10">
                          <span className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{t.anatomyPreviewTitle}</span>
                        </div>
                        <AnatomyHoverOverlay />
                        <p className={`mt-2 px-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.anatomyPreviewHint}</p>
                      </div>
                      {/* Mũi tên chỉ xuống thẻ Cấp 1 */}
                      <div
                        className={`w-3 h-3 rotate-45 mx-auto -mt-1.5 border-r border-b ${isDark ? 'border-emerald-400/20 bg-[#0f172a]' : 'border-emerald-100 bg-white'}`}
                      />
                    </div>
                  )}

                  {/* Popup xem trước game bảo vệ cơ thể — gắn vào thẻ Cấp 2
                  "Người Quan Tâm". Mở/đóng khi bấm icon, tương tự popup Cấp 1. */}
                  {isLevelTwo && showBodyProtectionPreview && (
                    <div
                      className={`
                        fixed left-2 right-2 bottom-24 mb-0 w-auto translate-x-0
                        sm:absolute sm:bottom-full sm:left-1/2 sm:right-auto sm:mb-4 sm:-translate-x-1/2
                        sm:w-[min(720px,calc(100vw-2rem))]
                        md:w-[min(820px,calc(100vw-3rem))]
                        lg:w-[min(920px,calc(100vw-4rem))]
                        transition-all duration-200 ease-out origin-bottom z-30 opacity-100 scale-100 pointer-events-auto
                      `}
                    >
                      <div className={`relative rounded-2xl border p-3 shadow-2xl ${isDark ? 'border-emerald-400/20 bg-[#0f172a]' : 'border-emerald-100 bg-white'}`}>
                        <HeroPopupCornerCloseButtons onClose={() => setShowBodyProtectionPreview(false)} isDark={isDark} label={isEn ? 'Close popup' : 'Đóng popup'} />
                        <div className="flex items-center justify-between mb-2 px-10">
                          <span className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{t.bodyProtectionPreviewTitle}</span>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                          <iframe
                            src="/games/bao-ve-co-the-auto.html"
                            title={t.bodyProtectionPreviewTitle}
                            className="h-[min(62vh,520px)] w-full"
                            loading="lazy"
                          />
                        </div>
                        <p className={`mt-2 px-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.bodyProtectionPreviewHint}</p>
                      </div>
                      <div
                        className={`w-3 h-3 rotate-45 mx-auto -mt-1.5 border-r border-b ${isDark ? 'border-emerald-400/20 bg-[#0f172a]' : 'border-emerald-100 bg-white'}`}
                      />
                    </div>
                  )}

                  {/* Popup iframe Captain Khánh Game — gắn vào thẻ Cấp 3.
                  Mở/đóng khi bấm icon. */}
                  {isLevelThree && showCaptainKhanhPreview && (
                    <div
                      className={`
                        fixed left-2 right-2 bottom-24 mb-0 w-auto translate-x-0
                        sm:absolute sm:bottom-full sm:left-1/2 sm:right-auto sm:mb-4 sm:-translate-x-1/2
                        sm:w-[min(720px,calc(100vw-2rem))]
                        md:w-[min(820px,calc(100vw-3rem))]
                        lg:w-[min(920px,calc(100vw-4rem))]
                        transition-all duration-200 ease-out origin-bottom z-30 opacity-100 scale-100 pointer-events-auto
                      `}
                    >
                      <div className={`relative rounded-2xl border p-3 shadow-2xl ${isDark ? 'border-sky-400/20 bg-[#0f172a]' : 'border-sky-100 bg-white'}`}>
                        <HeroPopupCornerCloseButtons onClose={() => setShowCaptainKhanhPreview(false)} isDark={isDark} label={isEn ? 'Close popup' : 'Đóng popup'} />
                        <div className="flex items-center justify-between mb-2 px-10">
                          <span className={`text-xs font-bold ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>{t.captainKhanhPreviewTitle}</span>
                        </div>
                        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                          <iframe
                            src="https://captain-khanh-game.vercel.app/"
                            title={t.captainKhanhPreviewTitle}
                            className="h-[min(62vh,520px)] w-full"
                            loading="lazy"
                            allow="fullscreen; autoplay; clipboard-read; clipboard-write"
                          />
                        </div>
                        <p className={`mt-2 px-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.captainKhanhPreviewHint}</p>
                      </div>
                      <div
                        className={`w-3 h-3 rotate-45 mx-auto -mt-1.5 border-r border-b ${isDark ? 'border-sky-400/20 bg-[#0f172a]' : 'border-sky-100 bg-white'}`}
                      />
                    </div>
                  )}


                  {/* Popup HERO_ZONES — chỉ xuất hiện khi người dùng bấm Cấp 4.
                  Đã tách toàn bộ ra HeroZoneStackPopup.jsx (state, toggle,
                  bản đồ 3D) để trang nào khác cũng gọi lại được, không chỉ
                  ở đây. */}
                  {isLevelFour && (
                    <HeroZoneStackPopup
                      open={showHeroZonesPreview}
                      onClose={() => setShowHeroZonesPreview(false)}
                      isDark={isDark}
                      isEn={isEn}
                      organId={organId}
                      title={t.heroZonesPreviewTitle}
                      hint={t.heroZonesPreviewHint}
                      closeLabel={isEn ? 'Close popup' : 'Đóng popup'}
                    />
                  )}


                  {isCurrent ? (
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full ${isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                      {t.current}
                    </span>
                  ) : unlocked ? (
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1 ${isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                      <Star size={11} /> {t.unlocked}
                    </span>
                  ) : (
                    <span className={`text-[11px] font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1 ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                      {t.locked} <Lock size={11} />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <div className={`inline-flex items-center gap-2 rounded-full border shadow-sm px-4 py-2 text-sm ${isDark ? 'bg-white/5 border-white/10 text-gray-200' : 'bg-white border-emerald-100 text-gray-600'}`}>
              <ShieldCheck size={16} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
              {t.levelBadge(currentLevel)}
            </div>
          </div>
        </div>

        {/* Ghi chú quyền riêng tư */}
        <div className={`mt-12 flex items-center gap-4 rounded-2xl px-5 py-4 shadow-sm ${isDark ? 'border border-white/10 bg-white/5' : 'border border-emerald-100 bg-white/70'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            <Lock className={isDark ? 'text-emerald-400' : 'text-emerald-600'} size={18} />
          </div>
          <p className={`text-sm leading-snug ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            {t.privacy}
            <span className={`font-bold ${isDark ? 'text-gray-100' : 'text-[#16241c]'}`}>{t.privacyBold}</span>
          </p>
          <Leaf className="text-emerald-500 ml-auto flex-shrink-0 hidden sm:block" size={22} />
        </div>

        {/* Quay lại (trái) — đồng bộ vị trí/hình dạng với các nút điều hướng
        khác trong toàn dự án, luôn đặt ở dưới cùng màn hình. Đăng nhập
        (phải, chỉ hiển thị với khách) — cùng hàng với nút Quay lại. */}
        {(onBack || (isGuest && onLogin)) && (
          <div className="mt-8 flex flex-col sm:flex-row justify-center sm:justify-between items-center gap-3">
            {onBack ? <BackButton isDark={isDark} label={t.back} onClick={onBack} /> : <span />}

            {isGuest && onLogin && (
              <button
                type="button"
                onClick={onLogin}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-semibold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  isDark
                    ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300 hover:border-emerald-400/60'
                    : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300'
                }`}
              >
                <LogIn size={16} />
                {t.login}
              </button>
            )}
          </div>
        )}

        <div className={`flex items-center gap-1.5 justify-center mt-6 text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          <Award size={12} />
          {t.footer}
        </div>
      </div>
    </div>
  );
}
