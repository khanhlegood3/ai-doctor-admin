import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, ShieldCheck, Lock, BookOpen, CheckCircle2 } from 'lucide-react';
import useHeroPanelPrefs from './heroPanels/useHeroPanelPrefs.js';
import HeroPanelPrefsToggle from './heroPanels/HeroPanelPrefsToggle.jsx';
import useHeroSelection from './heroPanels/useHeroSelection.js';
import HeroMicVoiceButton from './heroPanels/HeroMicVoiceButton.jsx';
import HeroPopupCornerCloseButtons from './heroPanels/HeroPopupCornerCloseButtons.jsx';
import { useSuperheroCursor, useFlyEffectEnabled } from './aiChatbotControl/components/demo/basic-face/superheroCursor.js';
import { useClickHeroSpiderEffects } from './aiChatbotControl/components/effects/ClickHeroSpiderEffects.jsx';
import { buildOrganLabels, getOrganAnatomyAnnotationId } from '../data/organs.js';
import AnatomyHoverOverlay from './AnatomyHoverOverlay.jsx';

// ============================================================================
// ChooseUserRolePanel — màn hình "Chọn Vai Trò Anh Hùng", đứng TRƯỚC
// "Anh Hùng Hiến Tặng" trong menu. Cho người dùng chọn nhanh 1 trong 3 vai
// trò (Hiến tặng / Rèn luyện sức khỏe / Nhận tạng) và 1 cơ quan quan tâm,
// trước khi bước vào hành trình Anh Hùng Hiến Tặng (DonationHeroPanel).
//
// Giống DonationHeroPanel, đây là màn hình ĐỘC LẬP với theme sáng/tối
// chung của app — nhưng CÓ theme sáng/tối + ngôn ngữ Việt/Anh RIÊNG, đồng
// bộ với DonationHeroPanel thông qua useHeroPanelPrefs (localStorage).
// ============================================================================

const TEXT = {
  vi: {
    subtitleTop: 'Lựa chọn hành trình chăm sóc sức khỏe',
    titleDonate: 'Hiến tặng',
    titleOr: 'hoặc',
    titleReceive: 'Nhận',
    titleOrgan: 'nội tạng',
    titleTrain: 'Hoặc rèn luyện sức khỏe bền vững?',
    subtitleChoose: 'Hãy chọn bên dưới nhé..',
    roleEyebrowDonate: 'TÔI MUỐN',
    roleTitleDonate: 'Hiến tặng',
    roleEyebrowTrain: 'TÔI CHỈ MUỐN',
    roleTitleTrain: 'Rèn luyện sức khỏe',
    roleEyebrowReceive: 'TÔI MUỐN',
    roleTitleReceive: 'Nhận tạng',
    roleNote: 'Tôi cũng có thể Hiến / Nhận Tạng trong tương lai.',
    quickOrganTitle: 'Chọn nhanh cơ quan có thể hiến / nhận',
    organPreviewTitle: 'Bản đồ giải phẫu cơ thể',
    organPreviewHint: 'Bấm vào từng cơ quan để xem chú thích',
    viewAll: 'Tôi chưa muốn hiến tặng',
    legalText: 'Tất cả hoạt động hiến và nhận tạng đều theo quy trình cơ quan pháp luật tại quốc gia của bạn.',
    legalTags: ['An toàn', 'Minh bạch', 'Bảo mật', 'Nhân văn'],
    micLabel: 'Nhấn để nói',
    continueTitle: 'Tiếp tục tìm hiểu',
    continueSub: 'Học kiến thức · Hiểu quy trình · Chuẩn bị cho tương lai',
    privacy: 'Dữ liệu bạn cung cấp đều nằm ở máy của bạn, không bao giờ lưu vào server của chúng tôi. ',
    privacyBold: 'Tất cả dữ liệu là của bạn.',
    backToLanding: 'Landing Page',
  },
  en: {
    subtitleTop: 'Choose your health journey',
    titleDonate: 'Donate',
    titleOr: 'or',
    titleReceive: 'Receive',
    titleOrgan: 'organs',
    titleTrain: 'Or simply improving your health?',
    subtitleChoose: 'Please choose below..',
    roleEyebrowDonate: 'I WANT TO',
    roleTitleDonate: 'Donate',
    roleEyebrowTrain: 'I JUST WANT TO',
    roleTitleTrain: 'Improve my health',
    roleEyebrowReceive: 'I WANT TO',
    roleTitleReceive: 'Receive an organ',
    roleNote: 'I may also Donate / Receive an organ in the future.',
    quickOrganTitle: 'Quickly choose an organ to donate / receive',
    organPreviewTitle: 'Body anatomy atlas',
    organPreviewHint: 'Click an organ to view its note',
    viewAll: "I don't want to donate yet",
    legalText: 'All organ donation and transplant activities follow the legal procedures of the authorities in your country.',
    legalTags: ['Safe', 'Transparent', 'Secure', 'Humane'],
    micLabel: 'Tap to speak',
    continueTitle: 'Continue learning',
    continueSub: 'Learn · Understand the process · Prepare for the future',
    privacy: 'The data you provide stays on your device and is never stored on our servers. ',
    privacyBold: 'All your data belongs to you.',
    backToLanding: 'Landing Page',
  },
};

function buildRoleCards(t) {
  return [
    {
      id: 'donate',
      eyebrow: t.roleEyebrowDonate,
      title: t.roleTitleDonate,
      emoji: '🫶',
      accent: '#059669',
      accentSoft: '#ecfdf5',
      accentSoftDark: 'rgba(5,150,105,0.14)',
      border: '#a7f3d0',
      btn: '#16a34a',
    },
    {
      id: 'train',
      eyebrow: t.roleEyebrowTrain,
      title: t.roleTitleTrain,
      emoji: '💪',
      accent: '#d97706',
      accentSoft: '#fffbeb',
      accentSoftDark: 'rgba(217,119,6,0.14)',
      border: '#fde68a',
      btn: '#f59e0b',
    },
    {
      id: 'receive',
      eyebrow: t.roleEyebrowReceive,
      title: t.roleTitleReceive,
      emoji: '💙',
      accent: '#2563eb',
      accentSoft: '#eff6ff',
      accentSoftDark: 'rgba(37,99,235,0.14)',
      border: '#bfdbfe',
      btn: '#2563eb',
    },
  ];
}

const NO_DONATION_ROLE_ID = 'notDonate';

export default function ChooseUserRolePanel({ mode = 'guest', onSelectRole, onEnterAction, onBackToLanding }) {
  // selectedRole / selectedOrgan được đọc + ghi vào IndexedDB (thay vì chỉ
  // useState nội bộ) để trang sau (DonationHeroPanel) load lại đúng lựa
  // chọn, và để quay lại màn hình này sau cũng thấy đúng lựa chọn cũ.
  const { role: selectedRole, organId: selectedOrgan, setRole: setSelectedRole, setOrgan: setSelectedOrgan } = useHeroSelection();
  const [previewOrganId, setPreviewOrganId] = useState(null);
  const { isDark, isEn, toggleTheme, toggleLang } = useHeroPanelPrefs();
  // Con trỏ chuột (12 con giáp / phù thuỷ cưỡi chổi bay) + hiệu ứng click
  // "phù thuỷ cưỡi chổi bay tới / người nhện đu dây tới" — đồng bộ với lựa
  // chọn ở trang "🤖 AI chatbot control" (không có UI đổi riêng ở trang này).
  const { color: cursorColor, cursorCss } = useSuperheroCursor();
  const [flyEffectEnabled] = useFlyEffectEnabled();
  const { layer: clickEffectsLayer, handleClick: handleHeroSpiderClick, handleContextMenu: handleHeroSpiderRightClick } = useClickHeroSpiderEffects(cursorColor, flyEffectEnabled);
  const t = isEn ? TEXT.en : TEXT.vi;
  const ROLE_CARDS = buildRoleCards(t);
  const ORGANS = buildOrganLabels(isEn);
  const previewAnnotationId = previewOrganId ? getOrganAnatomyAnnotationId(previewOrganId) : null;
  const organPreviewPopup = previewAnnotationId ? (
    <div
      className={`
        absolute left-1/2 bottom-full z-30 mb-4 w-[min(580px,calc(100vw-2rem))] -translate-x-1/2
        transition-all duration-200 ease-out origin-bottom sm:scale-[0.8] pointer-events-auto
      `}
    >
      <div className={`relative rounded-2xl border p-3 shadow-2xl ${isDark ? 'border-emerald-400/20 bg-[#0f172a]' : 'border-emerald-100 bg-white'}`}>
        <HeroPopupCornerCloseButtons onClose={() => setPreviewOrganId(null)} isDark={isDark} label={isEn ? 'Close popup' : 'Đóng popup'} />
        <div className="flex items-center justify-between mb-2 px-10">
          <span className={`text-xs font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>{t.organPreviewTitle}</span>
        </div>
        <AnatomyHoverOverlay
          focusAnnotationId={previewAnnotationId}
          showOnlyFocus
        />
        <p className={`mt-2 px-1 text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{t.organPreviewHint}</p>
      </div>
      <div
        className={`mx-auto -mt-1.5 h-3 w-3 rotate-45 border-r border-b ${isDark ? 'border-emerald-400/20 bg-[#0f172a]' : 'border-emerald-100 bg-white'}`}
      />
    </div>
  ) : null;

  const handlePickRole = (roleId) => {
    setSelectedRole(roleId);
    if (typeof onSelectRole === 'function') onSelectRole(roleId);
  };

  return (
    <div
      className={`min-h-full w-full px-4 py-6 sm:px-5 sm:py-8 md:px-10 md:py-10 transition-colors ${
        isDark
          ? 'bg-gradient-to-b from-[#0b1220] to-[#0f172a] text-gray-100'
          : 'bg-gradient-to-b from-[#f6faf7] to-[#eef7f1] text-[#16241c]'
      }`}
      style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))', cursor: cursorCss }}
      onClick={handleHeroSpiderClick}
      onContextMenu={handleHeroSpiderRightClick}
    >
      {clickEffectsLayer}
      <div className="max-w-4xl lg:max-w-5xl mx-auto">

        {/* Đổi giao diện sáng/tối + ngôn ngữ */}
        <div className="flex flex-wrap justify-end gap-2 mb-6">
          <HeroPanelPrefsToggle
            isDark={isDark}
            isEn={isEn}
            onToggleTheme={toggleTheme}
            onToggleLang={toggleLang}
          />
        </div>

        {/* Tiêu đề */}
        <div className="text-center max-w-2xl mx-auto">
          <p className={`text-[11px] sm:text-xs font-semibold uppercase tracking-[0.18em] ${isDark ? 'text-emerald-400/80' : 'text-emerald-600/80'}`}>{t.subtitleTop}</p>
          <h1 className={`mt-3 text-2xl sm:text-[28px] md:text-[32px] font-extrabold leading-[1.28] tracking-[-0.01em] mb-3 ${isDark ? 'text-gray-100' : 'text-[#16241c]'}`}>
            <span className={`bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-emerald-300 to-emerald-500' : 'from-emerald-600 to-emerald-700'}`}>
              {t.titleDonate}
            </span>{' '}
            <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{t.titleOr}</span>
            <br />
            <span className={`bg-clip-text text-transparent bg-gradient-to-r ${isDark ? 'from-sky-300 to-sky-500' : 'from-sky-600 to-sky-700'}`}>
              {t.titleReceive}
            </span> {t.titleOrgan}
            <br />
            {t.titleTrain}
          </h1>
          <p className={isDark ? 'text-base text-gray-300 mb-4' : 'text-base text-gray-600 mb-4'}>{t.subtitleChoose}</p>
        </div>

        {/* 3 thẻ vai trò */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mt-8 items-stretch">
          {ROLE_CARDS.map((card) => {
            const isSelected = selectedRole === card.id;
            return (
              <button
                key={card.id}
                onClick={() => handlePickRole(card.id)}
                className="group text-center rounded-2xl p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all flex flex-col items-center"
                style={{
                  background: isDark ? card.accentSoftDark : card.accentSoft,
                  border: `1.5px solid ${isSelected ? card.accent : (isDark ? 'rgba(255,255,255,0.12)' : card.border)}`,
                  boxShadow: isSelected ? `0 0 0 3px ${isDark ? card.accentSoftDark : card.accentSoft}, 0 8px 24px rgba(0,0,0,0.08)` : undefined,
                }}
              >
                <div className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: card.accent }}>{card.eyebrow}</div>
                <div className="text-lg sm:text-xl font-extrabold tracking-[-0.01em] mb-3 normal-case leading-snug" style={{ color: card.accent }}>{card.title}</div>

                <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-3 group-hover:scale-105 transition-transform ${isDark ? 'bg-white/10' : 'bg-white/70'}`}>
                  {card.emoji}
                </div>

                <div
                  className="text-xs leading-snug mb-4 min-h-[32px] font-bold px-2 py-1 rounded-lg"
                  style={{ color: card.accent, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }}
                >
                  {t.roleNote}
                </div>

                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white mt-auto"
                  style={{ background: card.btn }}
                >
                  {isSelected ? <CheckCircle2 size={18} /> : <ArrowRight size={16} />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Chọn nhanh cơ quan */}
        <div className="mt-10">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className={`h-px w-8 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
            <h2 className={`text-xs font-bold tracking-[0.15em] uppercase ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              {t.quickOrganTitle}
            </h2>
            <span className={`h-px w-8 ${isDark ? 'bg-gray-600' : 'bg-gray-300'}`} />
          </div>

          <div className="relative flex flex-wrap justify-center gap-3">
            {ORGANS.map((organ) => {
              const isActive = selectedOrgan === organ.id;
              return (
                <button
                  key={organ.id}
                  onClick={() => {
                    setSelectedOrgan(organ.id);
                    setPreviewOrganId(organ.anatomyAnnotationId ? organ.id : null);
                  }}
                  className="flex flex-col items-center gap-1.5 w-[76px] sm:w-[84px]"
                >
                  <span
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm transition-all ${isDark ? 'bg-white/10' : 'bg-white'}`}
                    style={{ border: `2px solid ${isActive ? '#16a34a' : 'transparent'}` }}
                  >
                    {organ.emoji}
                  </span>
                  <span
                    className="text-xs font-semibold text-center leading-tight"
                    style={{ color: isActive ? '#16a34a' : (isDark ? '#9ca3af' : '#4b5563') }}
                  >
                    {organ.label}
                  </span>
                </button>
              );
            })}

            {organPreviewPopup}
            <button
              onClick={() => handlePickRole(NO_DONATION_ROLE_ID)}
              className="flex flex-col items-center gap-1.5 w-[76px] sm:w-[84px]"
            >
              <span
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${isDark ? 'bg-white/10' : 'bg-white'}`}
                style={{ border: `2px solid ${selectedRole === NO_DONATION_ROLE_ID ? '#16a34a' : 'transparent'}` }}
              >
                <span className="grid grid-cols-2 gap-1">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <span key={i} className="w-2 h-2 rounded-full bg-emerald-500" />
                  ))}
                </span>
              </span>
              <span className={isDark ? 'text-xs font-semibold text-emerald-400' : 'text-xs font-semibold text-emerald-600'}>{t.viewAll}</span>
            </button>
          </div>
        </div>

        {/* Băng pháp lý */}
        <div className={`mt-10 flex flex-col sm:flex-row items-center gap-5 rounded-2xl px-6 py-5 shadow-sm ${isDark ? 'border border-white/10 bg-white/5' : 'border border-emerald-100 bg-white/70'}`}>
          <div className={`w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-3xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-50'}`}>
            🏥
          </div>
          <div className="flex-1 text-center sm:text-left">
            <p className={`text-sm leading-snug mb-2 ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
              {t.legalText}
            </p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-x-5 gap-y-1.5">
              {t.legalTags.map((label) => (
                <span key={label} className={`inline-flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Mic: trao đổi thoại trực tiếp NGAY TẠI TRANG NÀY — không mở popup
        chat. Nội dung vẫn tự đồng bộ ngầm vào popup chat (kho lưu trữ +
        sự kiện đồng bộ dùng chung với GlobalAIChatbot), popup chỉ xử lý
        khi người dùng chủ động mở nó ra. */}
        <div className="flex items-center justify-center mt-8">
          <HeroMicVoiceButton
            mode={mode}
            activePanelLabel="Chọn Vai Trò Anh Hùng"
            isVi={!isEn}
            isDark={isDark}
            micLabel={t.micLabel}
            variant="expanded"
            buttonSize={144}
            iconSize={58}
            holoEffect
          />
        </div>

        {/* Tiếp tục tìm hiểu */}
        <button
          onClick={onEnterAction}
          className="w-full mt-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 text-white px-6 py-4 flex items-center justify-center gap-3 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
        >
          <BookOpen size={20} />
          <span className="text-left">
            <span className="block font-extrabold text-base leading-tight">{t.continueTitle}</span>
            <span className="block text-xs text-white/85 font-medium">{t.continueSub}</span>
          </span>
          <ArrowRight size={20} className="ml-auto" />
        </button>

        {/* Ghi chú quyền riêng tư */}
        <div className={`mt-6 flex items-center gap-3 justify-center text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <Lock size={14} />
          <span>
            {t.privacy}
            <span className={`font-bold ${isDark ? 'text-gray-100' : 'text-[#16241c]'}`}>{t.privacyBold}</span>
          </span>
        </div>

        {/* Quay lại Landing Page */}
        {onBackToLanding && (
          <div className="mt-6 flex justify-start">
            <button
              onClick={onBackToLanding}
              className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-full transition-colors ${
                isDark
                  ? 'text-gray-300 hover:text-white hover:bg-white/10'
                  : 'text-gray-600 hover:text-[#16241c] hover:bg-black/5'
              }`}
            >
              <ArrowLeft size={16} />
              {t.backToLanding}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
