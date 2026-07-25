import React, { useEffect, useState } from 'react';
import { ORGANS, getOrganById, lowerFirst } from '../../data/organs.js';
import AnatomyHoverOverlay from '../AnatomyHoverOverlay.jsx';
import HeroPopupCornerCloseButtons from './HeroPopupCornerCloseButtons.jsx';

// ============================================================================
// HeroZoneStackPopup — popup "Bản đồ 3D nội tạng anh hùng" (bấm ở Cấp 4 của
// DonationHeroPanel). Tách ra file riêng để bất kỳ trang nào khác cũng gọi
// lại được, không chỉ DonationHeroPanel.
//
// Trước đây toàn bộ nằm trực tiếp trong DonationHeroPanel.jsx (buildHeroZones,
// MapPath, state riêng, JSX popup) — nay gom hết vào đây, tự quản lý state
// nội bộ (selectedHeroZoneId / mapTilt / stackHeroZonesAsHuman), component
// cha chỉ cần truyền open/onClose/isDark/isEn/organId.
//
// ── FIX: toggle "Chồng nội tạng theo cột cơ thể" to bất thường trên laptop,
// xấu trên điện thoại ─────────────────────────────────────────────────────
// Toggle cũ chỉ có 1 kích thước cố định (h-8 w-14 / thumb h-6 w-6) dùng
// chung cho mọi màn hình, và <button> không có appearance-none/p-0/box-border
// — một số trình duyệt/OS áp style mặc định của thẻ <button> (padding, min-
// width theo font-size gốc) đè lên kích thước Tailwind, khiến nút phình to
// không đều trên laptop và bị lệch/vỡ hình tròn trên điện thoại. Sửa bằng
// cách: (1) reset triệt để appearance/border/padding của <button>, (2) định
// kích thước responsive rõ ràng — nhỏ gọn hơn ở mobile (h-6 w-11, thumb
// h-4 w-4) và đúng kích thước cũ ở sm trở lên (h-8 w-14, thumb h-6 w-6),
// (3) thêm box-border + shrink-0 để không bị bóp méo bởi flex cha.
// ============================================================================

const HERO_ZONE_LAYOUT = [
  { x: 15, y: 55, z: 18, color: '#38bdf8' },
  { x: 31, y: 28, z: 58, color: '#fb7185' },
  { x: 48, y: 18, z: 82, color: '#a78bfa' },
  { x: 66, y: 40, z: 48, color: '#22d3ee' },
  { x: 58, y: 69, z: 34, color: '#34d399' },
  { x: 79, y: 22, z: 96, color: '#facc15' },
  { x: 23, y: 78, z: 42, color: '#f97316' },
  { x: 42, y: 51, z: 68, color: '#ef4444' },
  { x: 74, y: 65, z: 52, color: '#14b8a6' },
  { x: 88, y: 47, z: 74, color: '#e879f9' },
  { x: 12, y: 23, z: 88, color: '#c084fc' },
];

const HERO_ZONE_HUMAN_LAYOUT = {
  giacmac: { x: 50, y: 10, z: 108 },
  phoi: { x: 50, y: 27, z: 92 },
  tim: { x: 50, y: 38, z: 104 },
  gan: { x: 50, y: 49, z: 82 },
  than: { x: 50, y: 60, z: 76 },
  tuy: { x: 50, y: 69, z: 70 },
  ruot: { x: 50, y: 80, z: 64 },
  xuong: { x: 26, y: 57, z: 54 },
  da: { x: 74, y: 57, z: 54 },
  mauhiem: { x: 26, y: 40, z: 66 },
  'all-after-death': { x: 74, y: 40, z: 66 },
};

function buildHeroZones(isEn, stackAsHuman = false) {
  return ORGANS.map((organ, index) => {
    const layout = stackAsHuman
      ? { ...HERO_ZONE_LAYOUT[index % HERO_ZONE_LAYOUT.length], ...(HERO_ZONE_HUMAN_LAYOUT[organ.id] || {}) }
      : HERO_ZONE_LAYOUT[index % HERO_ZONE_LAYOUT.length];
    const label = isEn ? organ.en : organ.vi;
    return {
      ...layout,
      id: organ.id,
      icon: organ.emoji,
      title: label,
      subtitle: isEn
        ? `Focus the hero map on ${lowerFirst(label)}.`
        : `Tập trung bản đồ anh hùng vào ${lowerFirst(label)}.`,
      anatomyAnnotationId: organ.anatomyAnnotationId,
    };
  });
}

function MapPath({ from, to }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  return (
    <div
      className="absolute h-1 rounded-full shadow-[0_0_18px_rgba(34,211,238,0.65)]"
      style={{
        left: `${from.x}%`,
        top: `${from.y}%`,
        width: `${length}%`,
        transformOrigin: '0 50%',
        transform: `rotate(${angle}deg) translateZ(8px)`,
        background: 'linear-gradient(90deg, rgba(34,211,238,0.85), rgba(250,204,21,0.7))',
      }}
    />
  );
}

// Toggle switch dùng riêng cho popup này — kích thước responsive, reset
// triệt để style mặc định của <button> để không bị trình duyệt "phình to".
function StackToggleSwitch({ checked, onChange, label, sublabel, isDark }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-3xl border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-cyan-100 bg-white/80'}`}>
      <div className="text-left">
        <p className={`m-0 text-[11px] font-bold uppercase tracking-[0.14em] ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{label}</p>
        <p className={`mt-1 text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>{sublabel}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-pressed={checked}
        aria-label={label}
        style={{ appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none', padding: 0, margin: 0, boxSizing: 'border-box', lineHeight: 0, font: 'inherit' }}
        className={`relative inline-block h-6 w-11 shrink-0 rounded-full border outline-none transition-colors sm:h-8 sm:w-14 ${
          checked
            ? 'border-emerald-300 bg-emerald-500'
            : isDark
              ? 'border-white/10 bg-slate-800'
              : 'border-slate-200 bg-slate-100'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow-md transition-transform sm:top-1 sm:h-6 sm:w-6 ${
            checked ? 'translate-x-5 sm:translate-x-6' : 'translate-x-0.5 sm:translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export default function HeroZoneStackPopup({
  open,
  onClose,
  isDark,
  isEn,
  organId,
  title,
  hint,
  wrapperClassName,
  closeLabel,
}) {
  const [selectedHeroZoneId, setSelectedHeroZoneId] = useState(null);
  const [mapTilt, setMapTilt] = useState({ x: 58, y: -18 });
  const [stackHeroZonesAsHuman, setStackHeroZonesAsHuman] = useState(false);

  const organ = getOrganById(organId);

  useEffect(() => {
    setSelectedHeroZoneId(organ.id);
  }, [organ.id]);

  if (!open) return null;

  const HERO_ZONES = buildHeroZones(isEn, stackHeroZonesAsHuman);
  const selectedHeroZone = HERO_ZONES.find((zone) => zone.id === (selectedHeroZoneId || organ.id)) || HERO_ZONES[0];
  const heroZonePaths = HERO_ZONES.slice(0, -1).map((zone, index) => ({ from: zone, to: HERO_ZONES[index + 1] }));
  const toggleLabel = isEn ? 'Human vertical organ stack' : 'Chồng nội tạng theo cột cơ thể';
  const toggleSublabel = isEn ? 'Arrange organ buttons like a friendly body silhouette.' : 'Sắp xếp các nút cơ quan thành dáng người thân thiện.';
  const popupTitle = title ?? (isEn ? '3D hero organ map' : 'Bản đồ 3D nội tạng anh hùng');
  const popupHint = hint ?? (isEn ? 'Click Level 4 to open HERO_ZONES map' : 'Bấm vào Cấp 4 để mở bản đồ HERO_ZONES');

  const handleMapPointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width - 0.5;
    const py = (event.clientY - rect.top) / rect.height - 0.5;
    setMapTilt({ x: 58 - py * 10, y: -18 + px * 14 });
  };

  const defaultWrapperClassName = `
    fixed left-2 right-2 bottom-24 mb-0 w-auto translate-x-0
    sm:absolute sm:bottom-full sm:left-1/2 sm:right-auto sm:mb-4 sm:-translate-x-1/2
    sm:w-[min(820px,calc(100vw-2rem))]
    md:w-[min(920px,calc(100vw-3rem))]
    lg:w-[min(1040px,calc(100vw-4rem))]
    transition-all duration-200 ease-out origin-bottom z-30 opacity-100 scale-100 pointer-events-auto
  `;

  return (
    <div className={wrapperClassName || defaultWrapperClassName}>
      <div className={`relative max-h-[82vh] overflow-y-auto rounded-2xl border p-3 shadow-2xl ${isDark ? 'border-cyan-400/20 bg-[#0f172a]' : 'border-cyan-100 bg-white'}`}>
        <HeroPopupCornerCloseButtons onClose={onClose} isDark={isDark} label={closeLabel ?? (isEn ? 'Close popup' : 'Đóng popup')} />
        <div className="mb-2 px-10 text-center">
          <span className={`text-xs font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{popupTitle}</span>
        </div>

        <section className={`overflow-hidden rounded-[28px] border shadow-2xl ${isDark ? 'border-cyan-400/20 bg-slate-950/70 shadow-cyan-950/20' : 'border-cyan-100 bg-white/80 shadow-slate-200/70'}`}>
          <div className="p-5 md:p-6">
            <div className={`rounded-3xl border p-4 ${isDark ? 'border-white/10 bg-white/5' : 'border-cyan-100 bg-white/80'}`}>
              <div className="text-4xl">{selectedHeroZone.icon}</div>
              <h3 className={`mt-2 text-xl font-extrabold ${isDark ? 'text-gray-100' : 'text-slate-900'}`}>{selectedHeroZone.title}</h3>
              <p className={`mt-1 text-sm leading-6 ${isDark ? 'text-gray-300' : 'text-slate-500'}`}>{selectedHeroZone.subtitle}</p>
              {selectedHeroZone.anatomyAnnotationId ? (
                <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-slate-950">
                  <AnatomyHoverOverlay focusAnnotationId={selectedHeroZone.anatomyAnnotationId} showOnlyFocus />
                </div>
              ) : (
                <div className={`mt-3 rounded-2xl border px-4 py-6 text-sm ${isDark ? 'border-white/10 bg-slate-900/70 text-gray-300' : 'border-emerald-100 bg-emerald-50 text-emerald-800'}`}>
                  {isEn ? 'This choice represents all donation opportunities after death.' : 'Lựa chọn này đại diện cho tất cả cơ hội hiến tặng sau khi mất.'}
                </div>
              )}
            </div>
          </div>
          <div onPointerMove={handleMapPointerMove} onPointerLeave={() => setMapTilt({ x: 58, y: -18 })} className={`relative mx-5 mb-5 min-h-[460px] overflow-hidden rounded-[28px] border md:mx-6 md:mb-6 ${isDark ? 'border-cyan-400/20 bg-gradient-to-b from-slate-900/90 to-slate-950' : 'border-cyan-100 bg-gradient-to-b from-white/90 to-blue-100/80'}`} style={{ perspective: 1100, boxShadow: 'inset 0 0 90px rgba(14,165,233,0.16)' }}>
            <div className="absolute inset-[12%_8%]" style={{ transformStyle: 'preserve-3d', transform: `rotateX(${mapTilt.x}deg) rotateZ(${mapTilt.y}deg)`, transition: 'transform 180ms ease-out' }}>
              <div className="absolute inset-0 rounded-full border-2 border-cyan-300/25 bg-[radial-gradient(circle,rgba(34,211,238,0.2),rgba(16,185,129,0.1)_44%,rgba(14,165,233,0.03)_70%)]" style={{ transform: 'translateZ(-18px)' }} />
              {heroZonePaths.map((path) => <MapPath key={`${path.from.id}-${path.to.id}`} {...path} />)}
              {HERO_ZONES.map((zone) => (
                <button key={zone.id} type="button" onClick={() => setSelectedHeroZoneId(zone.id)} aria-label={zone.title} className="absolute grid h-[74px] w-[74px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-3xl text-3xl text-white shadow-2xl transition-transform hover:scale-105 sm:h-[88px] sm:w-[88px]" style={{ left: `${zone.x}%`, top: `${zone.y}%`, transform: `translate(-50%, -50%) translateZ(${zone.z}px)`, border: selectedHeroZone.id === zone.id ? `3px solid ${zone.color}` : '1px solid rgba(255,255,255,0.35)', background: `linear-gradient(145deg, ${zone.color}33, rgba(15,23,42,0.84))`, boxShadow: `0 18px 45px ${zone.color}55` }}>
                  <span style={{ transform: `rotateZ(${-mapTilt.y}deg) rotateX(${-mapTilt.x}deg)` }}>{zone.icon}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="px-5 pb-5 md:px-6 md:pb-6">
            <StackToggleSwitch
              checked={stackHeroZonesAsHuman}
              onChange={() => setStackHeroZonesAsHuman((prev) => !prev)}
              label={toggleLabel}
              sublabel={toggleSublabel}
              isDark={isDark}
            />
          </div>
        </section>

        <p className={`mt-2 px-1 text-center text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{popupHint}</p>
      </div>
      <div className={`w-3 h-3 rotate-45 mx-auto -mt-1.5 border-r border-b ${isDark ? 'border-cyan-400/20 bg-[#0f172a]' : 'border-cyan-100 bg-white'}`} />
    </div>
  );
}
