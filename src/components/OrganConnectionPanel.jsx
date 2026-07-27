import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import NavButtons from './NavButtons.jsx'
import AnatomyHoverOverlay from './AnatomyHoverOverlay.jsx'
import AnatomyHoverOverlayRightPanel from './AnatomyHoverOverlayRightPanel.jsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext.jsx'
import { useGlobalAIChatbotEngine, quickPrompts, MAX_FILES, getModeLabel } from '../lib/useGlobalAIChatbotEngine.js'

import organBoyUrl        from '../organ-connection/assets/boy.png'
import organBrainUrl      from '../organ-connection/assets/brain.png'
import organBrainProUrl   from '../organ-connection/assets/brainpro.png'
import organFullBodyBoxUrl from '../organ-connection/assets/fullbodybox.png'
import organHeartUrl      from '../organ-connection/assets/heart.png'
import organHeartProUrl   from '../organ-connection/assets/heartpro.png'
import organKidneyUrl     from '../organ-connection/assets/kidney.png'
import organKidneyProUrl  from '../organ-connection/assets/kidneypro.png'
import organLiverUrl      from '../organ-connection/assets/liver.png'
import organLiverProUrl   from '../organ-connection/assets/liverpro.png'
import organLungsUrl      from '../organ-connection/assets/lungs.png'
import organLungsProUrl   from '../organ-connection/assets/lungspro.png'
import organStomachUrl    from '../organ-connection/assets/stomach.png'
import organStomachProUrl from '../organ-connection/assets/stomachpro.png'
import organVegetablesUrl from '../organ-connection/assets/vegetables.png'


const ORGAN_ANATOMY_ANNOTATION = {
  brain: 'brain',
  heart: 'heart',
  liver: 'liver',
  kidney: 'kidneys',
  stomach: 'stomach',
  lungs: 'lungs',
}

function OrganAnatomyHoverWrap({ organKey, children, previewTitle = 'Bản đồ giải phẫu cơ thể', previewHint = 'Đang highlight đúng cơ quan bạn đang trỏ chuột' }) {
  const annotationId = ORGAN_ANATOMY_ANNOTATION[organKey]
  const [open, setOpen] = useState(false)

  if (!annotationId) return children

  const popup = open && typeof document !== 'undefined' ? createPortal(
    <div
      style={{
        position:'fixed',
        inset:0,
        zIndex:10050,
        display:'flex',
        alignItems:'center',
        justifyContent:'center',
        padding:16,
        pointerEvents:'none',
      }}
      aria-hidden="true"
    >
      <div style={{ width:'min(580px, calc(100vw - 32px))', maxHeight:'calc(100vh - 32px)' }}>
        <div style={{ border:'1px solid rgba(16,185,129,0.25)', background:'#0f172a', borderRadius:18, padding:12, boxShadow:'0 24px 80px rgba(2,6,23,0.42)' }}>
          <div style={{ color:'#6ee7b7', fontSize:12, fontWeight:900, marginBottom:8 }}>{previewTitle}</div>
          <AnatomyHoverOverlay focusAnnotationId={annotationId} showOnlyFocus />
          <div style={{ color:'#94a3b8', fontSize:10, marginTop:8 }}>{previewHint}</div>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div
      style={{ position:'relative', width:'100%' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false) }}
    >
      {children}
      {popup}
    </div>
  )
}

// ─── Organ focus guidance videos ("X thích ăn gì?") ─────────────────────────
const ORGAN_VIDEOS = {
  brain: { id: 'lt2uHzTrKQA', start: 0,  title: 'Não bộ thích ăn gì?',  emoji: '🧠' },
  liver: { id: 'wbh3SjzydnQ', start: 38, title: 'Gan thích ăn gì?',     emoji: '🫀' },
}

// ─── Playlist gợi ý ở cuối trang (video thật, nhúng bằng YouTube IFrame Player
// API — giống hệt cơ chế playlist tương tác bên khu RSS Portal: có danh sách
// video thật của playlist để bấm chuyển bài, không cần API key). ──────────────
const KIENTHUC_PLAYLIST_ID = 'PLWivcxVBsMwLBuWyD6aGymzWx-IHBKPX-'
const KIENTHUC_PLAYLIST_START_VIDEO = 'a0cnfEw-jCU'

let ytApiPromise = null
function loadYouTubeIframeAPI() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT)
  if (ytApiPromise) return ytApiPromise
  ytApiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevCallback === 'function') prevCallback()
      resolve(window.YT)
    }
    if (!document.getElementById('youtube-iframe-api-script')) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api-script'
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    }
  })
  return ytApiPromise
}

async function fetchYouTubeTitle(videoId) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
    )
    if (!res.ok) return null
    const data = await res.json()
    return data.title || null
  } catch {
    return null
  }
}

// ─── Database ────────────────────────────────────────────────────────────────
const DB = {
  target: [
    { id: 'liver',   name: 'Trọng tâm: Gan',       emoji: '🫀', img: organLiverUrl,  desc: 'Ưu tiên x1.5 điểm Giải độc & lọc cồn',         organKey: 'liver' },
    { id: 'kidney',  name: '💧 Trọng tâm: Thận',   emoji: '💧',                       desc: 'Ưu tiên x1.5 điểm Lọc màng & tiết niệu',       organKey: 'kidney' },
    { id: 'heart',   name: '❤️ Trọng tâm: Tim mạch',emoji: '❤️',                      desc: 'Ưu tiên x1.5 điểm Bền mạch & hạ mỡ máu',       organKey: 'heart' },
    { id: 'stomach', name: '🦠 Trọng tâm: Tiêu hóa',emoji: '🦠',                     desc: 'Ưu tiên x1.5 điểm Tráng niêm mạc & enzyme',    organKey: 'stomach' },
    { id: 'brain',   name: '🧠 Trọng tâm: Não bộ', emoji: '🧠',                       desc: 'Ưu tiên x1.5 điểm Tuần hoàn & thông mạch não', organKey: 'brain' },
    { id: 'lungs',   name: '🌬️ Trọng tâm: Phổi',  emoji: '🌬️',                      desc: 'Ưu tiên x1.5 điểm Thanh phế & hô hấp',         organKey: 'lungs' },
  ],
  base: [
    { id: 'yenmach',    name: 'Yến mạch nguyên cám', emoji: '🥣', heart:5,liver:5,stomach:9,kidney:5,brain:6,lungs:5,  tag:'Tráng dạ dày' },
    { id: 'gaobasmati', name: 'Gạo Basmati',          emoji: '🍚', heart:5,liver:4,stomach:8,kidney:4,brain:4,lungs:3,  tag:'GI thấp' },
    { id: 'miengaolut', name: 'Miến gạo lứt',          emoji: '🍜', heart:4,liver:5,stomach:7,kidney:4,brain:4,lungs:3,  tag:'Nhẹ bụng' },
    { id: 'khoaimon',   name: 'Khoai môn hấp',         emoji: '🍠', heart:3,liver:5,stomach:8,kidney:6,brain:3,lungs:4,  tag:'Nhiều xơ' },
    { id: 'daukho',     name: 'Đậu tổng hợp',           emoji: '🫘', heart:8,liver:6,stomach:4,kidney:5,brain:7,lungs:5,  tag:'Siêu đạm thô' },
  ],
  protein: [
    { id: 'trungga',  name: 'Trứng gà ta luộc',  emoji: '🥚', heart:5,liver:5,stomach:7,kidney:4,brain:8,lungs:4,  tag:'Giàu Choline' },
    { id: 'tom',      name: 'Tôm hấp nước dừa',  emoji: '🦐', heart:6,liver:4,stomach:5,kidney:4,brain:5,lungs:4,  tag:'Canxi tinh khiết' },
    { id: 'cathu',    name: 'Cá thu đại dương',   emoji: '🐟', heart:8,liver:5,stomach:5,kidney:4,brain:8,lungs:7,  tag:'Dồi dào DHA' },
    { id: 'dauhu',    name: 'Đậu hũ non',          emoji: '🧈', heart:7,liver:6,stomach:8,kidney:5,brain:5,lungs:5,  tag:'Thanh nhiệt' },
    { id: 'ucvit',    name: 'Ức vịt áp chảo',     emoji: '🦆', heart:3,liver:2,stomach:4,kidney:2,brain:3,lungs:2,  tag:'Tính hàn' },
    { id: 'cangu',    name: 'Cá ngừ phi-lê',       emoji: '🐠', heart:7,liver:5,stomach:4,kidney:4,brain:8,lungs:6,  tag:'Bổ máu' },
    { id: 'cahoi',    name: 'Cá hồi Na Uy',        emoji: '🍣', heart:8,liver:3,stomach:5,kidney:4,brain:7,lungs:8,  tag:'Vua Omega-3' },
    { id: 'ucga',     name: 'Ức gà xé phay',       emoji: '🍗', heart:5,liver:2,stomach:6,kidney:3,brain:4,lungs:3,  tag:'Đạm nạc' },
    { id: 'thitbo',   name: 'Thịt bò thăn đỏ',    emoji: '🥩', heart:2,liver:1,stomach:2,kidney:-2,brain:3,lungs:2, tag:'Nặng thận' },
  ],
  veg: [
    { id: 'cailoxoan', name: 'Cải xoăn Kale',       emoji: '🥬', heart:8,liver:7,stomach:5,kidney:4,brain:7,lungs:9,  tag:'Vua chống oxy hóa' },
    { id: 'raucai',    name: 'Rau cải mầm',           emoji: '🥗', heart:6,liver:6,stomach:7,kidney:5,brain:5,lungs:7,  tag:'Kích thích tiêu hóa' },
    { id: 'bido',      name: 'Bí đỏ nướng',           emoji: '🎃', heart:5,liver:5,stomach:8,kidney:5,brain:6,lungs:8,  tag:'Bổ thần kinh' },
    { id: 'mangtay',   name: 'Măng tây xanh',         emoji: '🌱', heart:6,liver:7,stomach:5,kidney:8,brain:5,lungs:5,  tag:'Lợi tiểu cực mạnh' },
    { id: 'dualeo',    name: 'Dưa leo baby',           emoji: '🥒', heart:5,liver:4,stomach:8,kidney:7,brain:4,lungs:4,  tag:'Cấp nước sinh học' },
    { id: 'bokchoy',   name: 'Cải thìa (Bok Choy)',   emoji: '🥬', heart:7,liver:7,stomach:6,kidney:6,brain:5,lungs:7,  tag:'Giàu Folate' },
    { id: 'bongcai',   name: 'Bông cải xanh',         emoji: '🥦', heart:4,liver:9,stomach:3,kidney:5,brain:6,lungs:8,  tag:'Sulforaphane lọc gan' },
    { id: 'carot',     name: 'Cà rốt hấp chín',       emoji: '🥕', heart:3,liver:4,stomach:8,kidney:4,brain:4,lungs:9,  tag:'Xơ hòa tan' },
    { id: 'nambaongu', name: 'Nấm bào ngư',           emoji: '🍄', heart:5,liver:6,stomach:4,kidney:7,brain:5,lungs:6,  tag:'Tăng đề kháng' },
  ],
  top: [
    { id: 'hatoccho', name: 'Hạt óc chó',          emoji: '🌰', heart:9,liver:4,stomach:4,kidney:5,brain:9,lungs:6,  tag:'Dinh dưỡng não' },
    { id: 'hatchia',  name: 'Hạt chia ngâm',        emoji: '⚫', heart:8,liver:5,stomach:8,kidney:5,brain:7,lungs:6,  tag:'Quét sạch thành ruột' },
    { id: 'vietquat', name: 'Việt quất tươi',       emoji: '🫐', heart:6,liver:8,stomach:5,kidney:5,brain:9,lungs:7,  tag:'Bảo vệ vi mạch' },
    { id: 'bo',       name: 'Bơ sáp lát',           emoji: '🥑', heart:8,liver:6,stomach:6,kidney:4,brain:8,lungs:6,  tag:'Chất béo đơn không no' },
    { id: 'nghe',     name: 'Tinh bột nghệ',        emoji: '🟡', heart:6,liver:9,stomach:8,kidney:4,brain:7,lungs:8,  tag:'Curcumin chống viêm' },
    { id: 'toi',      name: 'Tỏi đen cô đơn',       emoji: '🧄', heart:8,liver:7,stomach:5,kidney:4,brain:5,lungs:9,  tag:'Kháng sinh tự nhiên' },
    { id: 'traxanh',  name: 'Bột Matcha trà xanh',  emoji: '🍵', heart:6,liver:8,stomach:4,kidney:5,brain:8,lungs:7,  tag:'L-theanine thư giãn' },
    { id: 'dichuu',   name: 'Dầu Oliu Extra',        emoji: '🫒', heart:7,liver:5,stomach:6,kidney:4,brain:6,lungs:5,  tag:'Polyphenol' },
    { id: 'meden',    name: 'Mè đen rang',           emoji: '🧋', heart:4,liver:4,stomach:5,kidney:8,brain:6,lungs:5,  tag:'Bổ thận âm' },
    { id: 'muoihin',  name: 'Muối tinh chế',         emoji: '🧂', heart:-2,liver:-1,stomach:-1,kidney:-6,brain:-2,lungs:-3, tag:'Giữ nước độc hại' },
  ],
  avoid: [
    { id: 'bia',      name: 'Bia tươi / Cồn',          emoji: '🍺', heart:-4,liver:-8,stomach:-5,kidney:-4,brain:-6,lungs:-5,  tag:'Hủy hoại tế bào gan' },
    { id: 'nuocngot', name: 'Nước ngọt có gas',         emoji: '🥤', heart:-5,liver:-4,stomach:-5,kidney:-4,brain:-6,lungs:-3,  tag:'Quá tải tụy & sỏi thận' },
    { id: 'xucxich',  name: 'Xúc xích công nghiệp',    emoji: '🌭', heart:-6,liver:-5,stomach:-4,kidney:-4,brain:-3,lungs:-6,  tag:'Nitrat gây ung thư' },
    { id: 'khoga',    name: 'Khô gà tẩm gia vị',       emoji: '🍗', heart:-2,liver:-2,stomach:-2,kidney:-4,brain:-1,lungs:-2,  tag:'Thừa lượng muối Natri' },
    { id: 'mitom',    name: 'Mì ăn liền chiên',         emoji: '🍜', heart:-5,liver:-5,stomach:-6,kidney:-5,brain:-4,lungs:-5,  tag:'Chất béo chuyển hóa' },
  ],
}

const ORGAN_KEYS = ['liver', 'kidney', 'heart', 'stomach', 'brain', 'lungs']
const GOOD_CATS  = ['base', 'protein', 'veg', 'top']

const ORGAN_COLOR = { brain:'#8b5cf6', heart:'#ef4444', liver:'#f59e0b', kidney:'#3b82f6', stomach:'#10b981', lungs:'#06b6d4' }

const RESULT_ORGAN_META = [
  { key:'brain',   label:'Não bộ',   img: organBrainProUrl,   emoji:'🧠' },
  { key:'heart',   label:'Tim mạch', img: organHeartProUrl,   emoji:'❤️' },
  { key:'liver',   label:'Gan',      img: organLiverProUrl,   emoji:'🟤' },
  { key:'kidney',  label:'Thận',     img: organKidneyProUrl,  emoji:'💧' },
  { key:'stomach', label:'Dạ dày',   img: organStomachProUrl, emoji:'🦠' },
  { key:'lungs',   label:'Phổi',     img: organLungsProUrl,   emoji:'🌬️' },
]

const HC_ORGAN_META = [
  { key:'brain',   label:'Não Bộ',  norm: organBrainUrl,   pro: organBrainProUrl,   color:'#8b5cf6', emoji:'🧠' },
  { key:'liver',   label:'Gan',     norm: organLiverUrl,   pro: organLiverProUrl,   color:'#f59e0b', emoji:'🟤' },
  { key:'kidney',  label:'Thận',    norm: organKidneyUrl,  pro: organKidneyProUrl,  color:'#3b82f6', emoji:'💧' },
  { key:'lungs',   label:'Phổi',    norm: organLungsUrl,   pro: organLungsProUrl,   color:'#06b6d4', emoji:'🌬️' },
  { key:'heart',   label:'Tim',     norm: organHeartUrl,   pro: organHeartProUrl,   color:'#ef4444', emoji:'❤️' },
]
const HC_STOMACH = { key:'stomach', label:'Dạ Dày', norm: organStomachUrl, pro: organStomachProUrl, color:'#10b981', emoji:'🦠' }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getOrganMax(selection) {
  const organMax = {}
  ORGAN_KEYS.forEach(o => {
    let total = 0
    GOOD_CATS.forEach(cat => {
      const best = Math.max(...DB[cat].map(it => it[o] || 0))
      total += Math.max(0, best)
    })
    if (selection.target?.organKey === o) total = Math.round(total * 1.5)
    organMax[o] = total || 1
  })
  return organMax
}

function calculateScores(selection) {
  let sums = { liver:0, kidney:0, heart:0, stomach:0, brain:0, lungs:0 }
  let hasItem = false

  GOOD_CATS.forEach(c => {
    const it = selection[c]
    if (it) {
      hasItem = true
      ORGAN_KEYS.forEach(o => { sums[o] += (it[o] || 0) })
    }
  })

  const haz = selection.avoid
  if (haz) {
    ORGAN_KEYS.forEach(o => { sums[o] += (haz[o] || 0) })
  }

  const targetOrgan = selection.target?.organKey
  if (targetOrgan && hasItem) {
    sums[targetOrgan] = Math.round(sums[targetOrgan] * 1.5)
  }

  const organMax = getOrganMax(selection)

  const clamp = (val, organ) => {
    if (!hasItem && !haz) return 0
    const sc = Math.round((val / organMax[organ]) * 10)
    return Math.max(-10, Math.min(10, sc))
  }

  return {
    scores: {
      liver:   clamp(sums.liver,   'liver'),
      kidney:  clamp(sums.kidney,  'kidney'),
      heart:   clamp(sums.heart,   'heart'),
      stomach: clamp(sums.stomach, 'stomach'),
      brain:   clamp(sums.brain,   'brain'),
      lungs:   clamp(sums.lungs,   'lungs'),
    },
    hasItem,
    targetOrgan,
  }
}

function resultScoreLabel(v) {
  if (v <= 0)  return { txt:'Báo động',   color:'#f87171' }
  if (v <= 3)  return { txt:'Thấp',        color:'#fb923c' }
  if (v <= 6)  return { txt:'Bình thường', color:'#facc15' }
  if (v <= 8)  return { txt:'Khá',         color:'#34d399' }
  return              { txt:'Rất tốt',     color:'#22d3ee' }
}

function getDoctorAIMsg(selection, scores) {
  const { avoid, target, veg, top, protein } = selection
  if (avoid?.id === 'bia' && target?.organKey === 'liver') {
    return `🔥 <strong>Nghịch lý lâm sàng:</strong> Bạn đặt mục tiêu bảo vệ Gan, nhưng lại vừa rót một ly Bia (-8 Gan)? Cồn đang trực tiếp vô hiệu hóa toàn bộ nỗ lực ăn uống của bạn!`
  }
  if (avoid?.id === 'nuocngot') {
    return `⚠️ <strong>Báo động Thận & Tụy:</strong> Lượng đường Fructose lỏng trong nước ngọt đang tạo ra một cơn bão Insulin. Thận của bạn phải gồng mình lọc rác.`
  }
  if (target?.organKey === 'liver' && veg?.id === 'bongcai' && top?.id === 'nghe') {
    return `🌟 <strong>Đại tiệc của Gan:</strong> Sulforaphane (Bông cải) + Curcumin (Nghệ) + Trọng số Mục tiêu tạo ra mâm cơm giải độc hoàn hảo nhất thế giới! Khen ngợi!`
  }
  if (top?.id === 'hatoccho' && protein?.id === 'cathu') {
    return `🧠 <strong>Sóng Alpha não bộ:</strong> Bộ đơn Cá thu đại dương và Hạt óc chó đang bơm trực tiếp DHA và chất béo cấu trúc vào chất xám của bạn.`
  }
  if (!selection.base && !selection.protein && !selection.veg) {
    return `"Hãy chọn 1 Mục tiêu sức khỏe bên trái, sau đó thêm Nền, Đạm và Rau..."`
  }
  return `Công thức khá cân bằng! Hãy thử bấm sang tab <strong>🚫 Tránh ăn</strong> và chọn "Bia" hoặc "Nước ngọt" để thử thách sức chịu đựng của mâm cơm này xem sao?`
}

// ─── RadarSVG ────────────────────────────────────────────────────────────────
function RadarSVG({ scores, cx, cy, maxR, labelExtra, svgW, svgH, showIcons = true }) {
  const n = RESULT_ORGAN_META.length
  const ang = i => -Math.PI / 2 + i * (2 * Math.PI / n)
  const pt = (i, val) => {
    const r = (Math.max(0, val) / 10) * maxR
    const a = ang(i)
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const ptR = (i, r) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))]
  const iconR = Math.round(maxR * 0.22)
  const dataPts = RESULT_ORGAN_META.map((m, i) => pt(i, scores[m.key] || 0).join(',')).join(' ')
  const zeroPts = RESULT_ORGAN_META.map((_, i) => pt(i, 0).join(',')).join(' ')

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%', maxWidth: svgW }}>
      <defs>
        <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#a855f7', stopOpacity: 0.55 }} />
          <stop offset="100%" style={{ stopColor: '#f43f5e', stopOpacity: 0.45 }} />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((frac, fi) => (
        <polygon key={fi}
          points={RESULT_ORGAN_META.map((_, i) => pt(i, 10 * frac).join(',')).join(' ')}
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      ))}
      {RESULT_ORGAN_META.map((_, i) => {
        const [x, y] = pt(i, 10)
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
      })}
      <polygon points={dataPts} fill="url(#radarFill)" stroke="#e879f9" strokeWidth="2.5" strokeLinejoin="round">
        <animate attributeName="points" from={zeroPts} to={dataPts} dur="0.8s" fill="freeze" calcMode="spline" keySplines="0.34 0.8 0.64 1" />
      </polygon>
      {RESULT_ORGAN_META.map((m, i) => {
        const [vx, vy] = pt(i, scores[m.key] || 0)
        const color = ORGAN_COLOR[m.key]
        const [lx, ly] = ptR(i, maxR + labelExtra)
        const sc = scores[m.key] || 0
        return (
          <g key={m.key}>
            <circle cx={vx} cy={vy} r="4.5" fill={color} stroke="#0b0a1f" strokeWidth="1.5" />
            {showIcons && iconR >= 16 ? (
              <>
                <circle cx={lx} cy={ly} r={iconR + 4} fill="rgba(15,12,40,0.85)" stroke="rgba(255,255,255,0.15)" />
                <image href={m.img} x={lx - iconR} y={ly - iconR} width={iconR * 2} height={iconR * 2} preserveAspectRatio="xMidYMid meet" />
                <text x={lx} y={ly + iconR + 14} textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff">{m.label}</text>
                <text x={lx} y={ly + iconR + 27} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>{sc}/10</text>
              </>
            ) : (
              <text x={lx} y={ly} textAnchor="middle" fontSize="8" fontWeight="700" fill={color}>{sc}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

// ─── OrganMapModal ────────────────────────────────────────────────────────────
function OrganMapModal({ open, onClose, selection }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)

  const goodItems = GOOD_CATS.map(k => selection[k]).filter(Boolean)
  const hazardItem = selection.avoid || null
  const allItems = [...goodItems, ...(hazardItem ? [hazardItem] : [])]
  const organKeys = ['brain', 'heart', 'liver', 'kidney', 'stomach', 'lungs']

  const organTotals = {}
  organKeys.forEach(o => { organTotals[o] = 0 })
  goodItems.forEach(it => { organKeys.forEach(o => { organTotals[o] += (it[o] || 0) }) })
  if (hazardItem) { organKeys.forEach(o => { organTotals[o] += (hazardItem[o] || 0) }) }

  const damagedOrgans = new Set()
  const boostedOrgans = new Set()
  organKeys.forEach(o => {
    let goodSum = 0
    goodItems.forEach(it => { goodSum += (it[o] || 0) })
    if (hazardItem && (hazardItem[o] || 0) < 0) damagedOrgans.add(o)
    if (goodSum > 0) boostedOrgans.add(o)
  })

  useEffect(() => {
    if (!open || !svgRef.current || !containerRef.current) return
    const timeout = setTimeout(() => {
      const svg = svgRef.current
      const container = containerRef.current
      if (!svg || !container) return
      svg.innerHTML = ''
      const svgRect = svg.getBoundingClientRect()

      // Good food lines
      goodItems.forEach((it, i) => {
        const foodNode = container.querySelectorAll('.oc-food-node')[i]
        if (!foodNode) return
        const foodRect = foodNode.getBoundingClientRect()
        const fx = foodRect.right - svgRect.left
        const fy = foodRect.top + foodRect.height / 2 - svgRect.top

        organKeys.forEach(o => {
          if ((it[o] || 0) <= 0) return
          const organNode = container.querySelector(`.oc-organ-node[data-organ="${o}"]`)
          if (!organNode) return
          const oRect = organNode.getBoundingClientRect()
          const ox = oRect.left - svgRect.left
          const oy = oRect.top + oRect.height / 2 - svgRect.top
          const score = it[o]
          const color = ORGAN_COLOR[o]
          const opacity = 0.18 + (score / 10) * 0.65
          const strokeW = 0.8 + (score / 10) * 2.8
          const pathLen = Math.sqrt((ox - fx) ** 2 + (oy - fy) ** 2)
          const uid = `pos_${i}_${o}`
          const ctrl1x = fx + (ox - fx) * 0.4, ctrl1y = fy
          const ctrl2x = fx + (ox - fx) * 0.6, ctrl2y = oy
          svg.innerHTML += `
            <defs>
              <linearGradient id="grad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#6366f1;stop-opacity:0.5"/>
                <stop offset="100%" style="stop-color:${color};stop-opacity:0.9"/>
              </linearGradient>
            </defs>
            <path id="${uid}" d="M${fx},${fy} C${ctrl1x},${ctrl1y} ${ctrl2x},${ctrl2y} ${ox},${oy}"
              fill="none" stroke="url(#grad_${uid})" stroke-width="${strokeW}" stroke-opacity="${opacity}"
              stroke-dasharray="${pathLen}" stroke-dashoffset="${pathLen}">
              <animate attributeName="stroke-dashoffset" from="${pathLen}" to="0" dur="0.7s" begin="${0.25 + i * 0.1}s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>
            </path>
            <circle r="3.5" fill="${color}" opacity="0.9">
              <animateMotion dur="2.8s" repeatCount="indefinite" begin="${0.25 + i * 0.1 + 0.7}s">
                <mpath href="#${uid}"/>
              </animateMotion>
            </circle>`
        })
      })

      // Hazard lines
      if (hazardItem) {
        const hNode = container.querySelectorAll('.oc-food-node')[4]
        if (hNode) {
          const hRect = hNode.getBoundingClientRect()
          const fx = hRect.right - svgRect.left
          const fy = hRect.top + hRect.height / 2 - svgRect.top
          organKeys.forEach(o => {
            const val = hazardItem[o] || 0
            if (val >= 0) return
            const organNode = container.querySelector(`.oc-organ-node[data-organ="${o}"]`)
            if (!organNode) return
            const oRect = organNode.getBoundingClientRect()
            const ox = oRect.left - svgRect.left
            const oy = oRect.top + oRect.height / 2 - svgRect.top
            const severity = Math.abs(val)
            const strokeW = 0.8 + (severity / 10) * 3.5
            const opacity = 0.3 + (severity / 10) * 0.65
            const pathLen = Math.sqrt((ox - fx) ** 2 + (oy - fy) ** 2)
            const uid = `neg_${o}`
            const ctrl1x = fx + (ox - fx) * 0.35, ctrl1y = fy + 30
            const ctrl2x = fx + (ox - fx) * 0.65, ctrl2y = oy - 30
            svg.innerHTML += `
              <defs>
                <linearGradient id="grad_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" style="stop-color:#f43f5e;stop-opacity:0.7"/>
                  <stop offset="100%" style="stop-color:#dc2626;stop-opacity:1"/>
                </linearGradient>
              </defs>
              <path id="${uid}" d="M${fx},${fy} C${ctrl1x},${ctrl1y} ${ctrl2x},${ctrl2y} ${ox},${oy}"
                fill="none" stroke="url(#grad_${uid})" stroke-width="${strokeW}" stroke-opacity="${opacity}"
                stroke-dasharray="6 4" stroke-dashoffset="${pathLen}">
                <animate attributeName="stroke-dashoffset" from="${pathLen}" to="0" dur="0.9s" begin="${0.15 + goodItems.length * 0.1}s" fill="freeze"/>
                <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" begin="${0.15 + goodItems.length * 0.1 + 0.9}s" repeatCount="indefinite"/>
              </path>
              <circle r="5" fill="#dc2626" opacity="0.95">
                <animateMotion dur="2s" repeatCount="indefinite" begin="${0.15 + goodItems.length * 0.1 + 0.9}s">
                  <mpath href="#${uid}"/>
                </animateMotion>
              </circle>
              <text font-size="9" text-anchor="middle" dominant-baseline="central" opacity="0.9">
                <animateMotion dur="2s" repeatCount="indefinite" begin="${0.15 + goodItems.length * 0.1 + 0.9}s">
                  <mpath href="#${uid}"/>
                </animateMotion>☠
              </text>`
          })
        }
      }
    }, 520)
    return () => clearTimeout(timeout)
  }, [open, selection])

  if (!open) return null

  const organImgMap = {
    brain: organBrainProUrl, lungs: organLungsProUrl, heart: organHeartProUrl,
    liver: organLiverProUrl, stomach: organStomachProUrl, kidney: organKidneyProUrl,
  }
  const organLabels = { brain:'🧠 Não bộ', lungs:'🌬️ Phổi', heart:'❤️ Tim mạch', liver:'🟤 Gan', stomach:'🦠 Dạ dày', kidney:'💧 Thận' }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(5,4,20,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:'12px', overflowY:'auto' }}>
      <style>{`
        .oc-modal { background:linear-gradient(135deg,#0f0c29,#141428,#1a1035); }
        .oc-grid-bg { background-image:linear-gradient(rgba(99,102,241,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.08) 1px,transparent 1px); background-size:40px 40px; }
        .oc-food-node { opacity:0; transform:scale(0.5) translateX(-20px); transition:all 0.5s cubic-bezier(0.34,1.56,0.64,1); }
        .oc-food-node.visible { opacity:1; transform:scale(1) translateX(0); }
        .oc-food-node-hazard { border:1px solid rgba(239,68,68,0.5)!important; background:rgba(127,29,29,0.4)!important; box-shadow:0 0 12px rgba(239,68,68,0.25); }
        .oc-organ-node { transition:all 0.4s ease; }
        .oc-organ-node.organ-active .oc-organ-img { filter:drop-shadow(0 0 12px currentColor); transform:scale(1.05); }
        .oc-organ-node.organ-dimmed { opacity:0.25; filter:grayscale(0.8); }
        .oc-organ-node.organ-damaged .oc-organ-img { filter:drop-shadow(0 0 14px #dc2626) brightness(0.85) saturate(1.4); transform:scale(1.05); animation:oc-damage-pulse 1.2s ease-in-out infinite; }
        @keyframes oc-damage-pulse { 0%,100%{ filter:drop-shadow(0 0 10px #dc2626) brightness(0.85); } 50%{ filter:drop-shadow(0 0 22px #f43f5e) brightness(0.7) saturate(1.8); } }
        .oc-badge { opacity:0; transform:scale(0.5); transition:all 0.4s cubic-bezier(0.34,1.56,0.64,1); transition-delay:0.2s; }
        .oc-badge.visible { opacity:1; transform:scale(1); }
        .oc-organ-img { transition:all 0.4s ease; }
        .oc-map-desktop { display:flex; flex:1; align-items:stretch; overflow:hidden; position:relative; }
        .oc-map-mobile  { display:none; flex:1; overflow-y:auto; padding:16px; gap:16px; flex-direction:column; }
        @media (max-width:768px) {
          .oc-map-desktop { display:none !important; }
          .oc-map-mobile  { display:flex !important; }
        }
      `}</style>
      <div className="oc-modal" style={{ borderRadius:24, width:'96vw', maxWidth:1100, height:'min(96vh, calc(100vh - 24px))', maxHeight:'calc(100vh - 24px)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div className="oc-grid-bg" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />

        {/* Header */}
        <div style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 32px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
          <div>
            <h2 style={{ color:'#fff', fontSize:22, fontWeight:900, display:'flex', alignItems:'center', gap:12, margin:0 }}>
              🧬 Food → Organ Connection Map
            </h2>
            <p style={{ color:'#a5b4fc', fontSize:13, margin:'4px 0 0' }}>Xem đường truyền dinh dưỡng từ thức ăn đến nội tạng</p>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* ── Desktop body (SVG lines) ── */}
        <div ref={containerRef} className="oc-map-desktop">
          <svg ref={svgRef} style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:10 }} />

          {/* Left: Food nodes */}
          <div style={{ position:'relative', zIndex:20, display:'flex', flexDirection:'column', padding:'16px 24px', width:260, flexShrink:0, overflowY:'auto', scrollbarWidth:'none' }}>
            <div style={{ fontSize:10, fontWeight:900, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Thức ăn đã chọn</div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {[0,1,2,3].map(i => {
                const it = goodItems[i]
                const topOrgan = it ? ORGAN_KEYS.slice().sort((a,b)=>(it[b]||0)-(it[a]||0))[0] : null
                return (
                  <div key={i} className={`oc-food-node${it ? ' visible' : ''}`} style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(15,12,40,0.85)', border:'1px solid rgba(255,255,255,0.1)', backdropFilter:'blur(8px)', borderRadius:16, padding:'8px 12px' }}>
                    <span style={{ fontSize:28, lineHeight:1, width:36, textAlign:'center', flexShrink:0 }}>{it?.emoji || ''}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{it ? (it.name.length > 14 ? it.name.substring(0,14)+'…' : it.name) : ''}</div>
                      <div style={{ color:'#a5b4fc', fontSize:10 }}>{it?.tag || ''}</div>
                      {it && topOrgan && <div style={{ color: ORGAN_COLOR[topOrgan], fontSize:10, fontWeight:700, marginTop:2 }}>+{it[topOrgan]}pts</div>}
                    </div>
                  </div>
                )
              })}
              {hazardItem && (
                <>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
                    <div style={{ flex:1, height:1, background:'rgba(239,68,68,0.3)' }} />
                    <span style={{ fontSize:9, fontWeight:900, color:'#f87171', textTransform:'uppercase', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>⚠ Chất phá hoại</span>
                    <div style={{ flex:1, height:1, background:'rgba(239,68,68,0.3)' }} />
                  </div>
                  <div className="oc-food-node oc-food-node-hazard visible" style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(127,29,29,0.4)', border:'1px solid rgba(239,68,68,0.5)', borderRadius:16, padding:'8px 12px' }}>
                    <span style={{ fontSize:28, lineHeight:1, width:36, textAlign:'center', flexShrink:0 }}>{hazardItem.emoji}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{hazardItem.name.length > 14 ? hazardItem.name.substring(0,14)+'…' : hazardItem.name}</div>
                      <div style={{ color:'#fca5a5', fontSize:10 }}>{hazardItem.tag}</div>
                      <div style={{ color:'#f87171', fontSize:10, fontWeight:700, marginTop:2 }}>☠️ {ORGAN_KEYS.slice().sort((a,b)=>(hazardItem[a]||0)-(hazardItem[b]||0))[0] && (hazardItem[ORGAN_KEYS.slice().sort((a,b)=>(hazardItem[a]||0)-(hazardItem[b]||0))[0]]||0)}pts</div>
                    </div>
                  </div>
                </>
              )}
              {allItems.length === 0 && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'32px 0', gap:12, marginTop:16 }}>
                  <div style={{ fontSize:48, opacity:0.4 }}>🍽️</div>
                  <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>Hãy chọn thức ăn<br/>để xem kết nối</div>
                </div>
              )}
            </div>
          </div>

          {/* Center: body silhouette */}
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            <img src={organFullBodyBoxUrl} style={{ height:'70%', maxHeight:420, objectFit:'contain', opacity:0.2, filter:'brightness(2) saturate(0)', userSelect:'none' }} alt="" />
          </div>

          {/* Right: Organ nodes */}
          <div style={{ position:'relative', zIndex:20, display:'flex', flexDirection:'column', alignItems:'center', padding:'16px 20px', width:190, flexShrink:0 }}>
            <div style={{ fontSize:11, fontWeight:900, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8, alignSelf:'flex-start' }}>Nội tạng</div>
            {['brain','lungs','heart','liver','stomach','kidney'].map(o => {
              const net = organTotals[o]
              const isDamaged = damagedOrgans.has(o)
              const isBoosted = boostedOrgans.has(o)
              let cls = 'oc-organ-node'
              if (allItems.length === 0 || (net === 0 && !isDamaged && !isBoosted)) cls += ' organ-dimmed'
              else if (isDamaged && net < 0) cls += ' organ-damaged'
              else cls += ' organ-active'
              const badgeColor = (isDamaged && net < 0) ? '#dc2626' : (isDamaged && net >= 0) ? (net > 3 ? ORGAN_COLOR[o] : '#f59e0b') : ORGAN_COLOR[o]
              const badgeText = allItems.length > 0 && (isBoosted || isDamaged) ? (net > 0 ? `+${net}` : `${net}`) : ''
              return (
                <OrganAnatomyHoverWrap key={o} organKey={o}>
                  <div className={cls} data-organ={o} style={{ width:'100%', display:'flex', flexDirection:'row', alignItems:'center', gap:8, padding:'8px', borderRadius:12, color: ORGAN_COLOR[o] }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <img src={organImgMap[o]} className="oc-organ-img" style={{ width:44, height:44, objectFit:'contain' }} alt="" />
                      {badgeText && (
                        <span className="oc-badge visible" style={{ position:'absolute', top:-8, right:-8, fontSize:9, fontWeight:900, color:'#fff', background:badgeColor, padding:'2px 4px', borderRadius:999, whiteSpace:'nowrap' }}>{badgeText}</span>
                      )}
                    </div>
                    <div style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{organLabels[o]}</div>
                  </div>
                </OrganAnatomyHoverWrap>
              )
            })}
          </div>
        </div>

        {/* ── Mobile body: sơ đồ liên kết dạng card ── */}
        <div className="oc-map-mobile">
          {allItems.length === 0 ? (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'48px 0', gap:12 }}>
              <div style={{ fontSize:56, opacity:0.35 }}>🍽️</div>
              <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>Hãy chọn thức ăn<br/>để xem kết nối</div>
            </div>
          ) : (
            <>
              {/* Food → Organ connection cards */}
              {allItems.map((it, idx) => {
                const isHazard = it === hazardItem
                const sortedOrgans = ORGAN_KEYS.slice().sort((a,b) => isHazard ? (it[a]||0)-(it[b]||0) : (it[b]||0)-(it[a]||0))
                const relevantOrgans = sortedOrgans.filter(o => (it[o]||0) !== 0).slice(0,4)
                return (
                  <div key={it.id} style={{ background: isHazard ? 'rgba(127,29,29,0.45)' : 'rgba(15,12,40,0.85)', border: isHazard ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:14, backdropFilter:'blur(8px)' }}>
                    {/* Food header */}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
                      <div style={{ width:44, height:44, background:'rgba(255,255,255,0.1)', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0 }}>{it.emoji}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ color: isHazard ? '#fca5a5' : '#fff', fontSize:13, fontWeight:800 }}>{it.name}</div>
                        <div style={{ fontSize:11, color: isHazard ? '#f87171' : '#818cf8', marginTop:2 }}>{isHazard ? '⚠ Chất phá hoại' : it.tag}</div>
                      </div>
                      <div style={{ fontSize:10, fontWeight:900, color: isHazard ? '#f87171' : '#34d399', background: isHazard ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.12)', padding:'3px 8px', borderRadius:999, border: isHazard ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(52,211,153,0.25)', whiteSpace:'nowrap' }}>
                        {isHazard ? '☠️ Phá hoại' : '✦ Bổ trợ'}
                      </div>
                    </div>
                    {/* Arrow */}
                    <div style={{ textAlign:'center', fontSize:16, color:'rgba(255,255,255,0.3)', marginBottom:10, letterSpacing:4 }}>{'↓ ↓ ↓'}</div>
                    {/* Organ impact chips */}
                    <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                      {relevantOrgans.map(o => {
                        const val = it[o] || 0
                        const color = ORGAN_COLOR[o]
                        const isNeg = val < 0
                        const barW = Math.abs(val) / 10 * 100
                        return (
                          <OrganAnatomyHoverWrap key={o} organKey={o}>
                          <div style={{ flex:'1 1 130px', background:'rgba(255,255,255,0.05)', border:`1px solid ${isNeg ? 'rgba(239,68,68,0.3)' : color+'44'}`, borderRadius:12, padding:'8px 10px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                              <img src={organImgMap[o]} style={{ width:28, height:28, objectFit:'contain', flexShrink:0 }} alt="" />
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#fff' }}>{organLabels[o]}</div>
                                <div style={{ fontSize:12, fontWeight:900, color: isNeg ? '#f87171' : color }}>{val > 0 ? '+' : ''}{val} pts</div>
                              </div>
                            </div>
                            <div style={{ height:5, borderRadius:999, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
                              <div style={{ height:'100%', width:`${barW}%`, background: isNeg ? '#dc2626' : color, borderRadius:999, transition:'width 0.6s ease' }} />
                            </div>
                          </div>
                        </OrganAnatomyHoverWrap>
                        )
                      })}
                    </div>
                  </div>
                )
              })}

              {/* Organ summary row */}
              <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.25)', borderRadius:18, padding:14 }}>
                <div style={{ fontSize:10, fontWeight:900, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Tổng tác động lên nội tạng</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                  {['brain','lungs','heart','liver','stomach','kidney'].map(o => {
                    const net = organTotals[o]
                    const isDamaged = damagedOrgans.has(o)
                    const color = ORGAN_COLOR[o]
                    const isNeg = net < 0
                    return (
                      <OrganAnatomyHoverWrap key={o} organKey={o}>
                        <div style={{ flex:'1 1 130px', display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${isNeg ? 'rgba(239,68,68,0.3)' : color+'33'}`, borderRadius:12, padding:'8px 10px' }}>
                        <img src={organImgMap[o]} style={{ width:32, height:32, objectFit:'contain', flexShrink:0, ...(isDamaged && isNeg ? { filter:'drop-shadow(0 0 8px #dc2626) brightness(0.85)' } : net > 0 ? { filter:`drop-shadow(0 0 6px ${color})` } : {}) }} alt="" />
                        <div>
                          <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', fontWeight:600 }}>{organLabels[o]}</div>
                          <div style={{ fontSize:14, fontWeight:900, color: isNeg ? '#f87171' : net > 0 ? color : 'rgba(255,255,255,0.3)' }}>{net > 0 ? '+' : ''}{net}</div>
                        </div>
                      </div>
                      </OrganAnatomyHoverWrap>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer legend */}
        <div style={{ position:'relative', zIndex:10, padding:'12px 32px', borderTop:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', gap:24, fontSize:12, color:'rgba(255,255,255,0.5)', flexShrink:0, flexWrap:'wrap' }}>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:32, height:2, background:'linear-gradient(to right, #6366f1, #a855f7)', display:'inline-block', borderRadius:2 }}></span>Dinh dưỡng mạnh</span>
          <span style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:24, height:2, background:'linear-gradient(to right, #f43f5e, #dc2626)', display:'inline-block', borderRadius:2, borderTop:'1px dashed #f43f5e' }}></span>Phá hoại nội tạng</span>
          <span style={{ marginLeft:'auto', color:'#818cf8', fontWeight:600 }}>Đường dày = ảnh hưởng mạnh • Chấm chạy = dòng đang lưu thông</span>
        </div>
      </div>
    </div>
  )
}

// ─── ResultModal ──────────────────────────────────────────────────────────────
function ResultModal({ open, onClose, scores, hasItem, selection }) {
  if (!open) return null
  const haz = selection.avoid
  const avg = Object.values(scores).reduce((a, b) => a + b, 0) / RESULT_ORGAN_META.length
  const best = RESULT_ORGAN_META.slice().sort((a, b) => (scores[b.key] || 0) - (scores[a.key] || 0))[0]
  const worst = RESULT_ORGAN_META.slice().sort((a, b) => (scores[a.key] || 0) - (scores[b.key] || 0))[0]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(5,4,20,0.9)', display:'flex', alignItems:'center', justifyContent:'center', padding:'12px', overflowY:'auto' }}>
      <style>{`.rm-grid-bg { background-image:linear-gradient(rgba(99,102,241,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.08) 1px,transparent 1px); background-size:40px 40px; }
        @media(max-width:768px){.rm-body{flex-direction:column!important;overflow:auto!important}.rm-right-panel{width:100%!important;border-left:none!important;border-top:1px solid rgba(255,255,255,0.1)!important}}
      `}</style>
      <div style={{ background:'linear-gradient(135deg,#0f0c29,#141428,#1a1035)', borderRadius:24, width:'96vw', maxWidth:1000, height:'min(96vh, calc(100vh - 24px))', maxHeight:'calc(100vh - 24px)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div className="rm-grid-bg" style={{ position:'absolute', inset:0, pointerEvents:'none' }} />
        <div style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 32px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
          <div>
            <h2 style={{ color:'#fff', fontSize:22, fontWeight:900, display:'flex', alignItems:'center', gap:12, margin:0 }}>✨ Kết quả tổng kết sức khỏe</h2>
            <p style={{ color:'#a5b4fc', fontSize:13, margin:'4px 0 0' }}>Lục giác chỉ số nội tạng dựa trên công thức bạn vừa tạo</p>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div className="rm-body" style={{ position:'relative', zIndex:10, flex:1, display:'flex', alignItems:'stretch', overflow:'hidden' }}>
          {/* Left: Radar */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px 24px', overflowY:'auto', scrollbarWidth:'none' }}>
            <div style={{ fontSize:11, fontWeight:900, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:8, alignSelf:'flex-start', marginLeft:8 }}>Các chỉ số nội tạng</div>
            {!hasItem ? (
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:48, opacity:0.4 }}>🍽️</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontWeight:600, marginTop:8 }}>Hãy chọn thức ăn ở trang chính<br/>để xem kết quả tổng kết</div>
              </div>
            ) : (
              <RadarSVG scores={scores} cx={240} cy={230} maxR={165} labelExtra={38} svgW={480} svgH={480} showIcons={true} />
            )}
          </div>

          {/* Right: AI Analysis */}
          <div className="rm-right-panel" style={{ width:300, flexShrink:0, borderLeft:'1px solid rgba(255,255,255,0.1)', padding:'20px', overflowY:'auto', scrollbarWidth:'none' }}>
            <div style={{ fontSize:11, fontWeight:900, color:'#818cf8', textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:12 }}>Phân tích AI</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {RESULT_ORGAN_META.map(m => {
                const v = scores[m.key] || 0
                const lbl = resultScoreLabel(v)
                return (
                  <OrganAnatomyHoverWrap key={m.key} organKey={m.key}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'8px 10px' }}>
                    <img src={m.img} style={{ width:32, height:32, objectFit:'contain', flexShrink:0 }} alt={m.label} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ color:'#fff', fontSize:13, fontWeight:700 }}>{m.label}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:lbl.color }}>{lbl.txt}</div>
                    </div>
                    <div style={{ fontSize:15, fontFamily:'monospace', fontWeight:900, color:lbl.color }}>{v}/10</div>
                  </div>
                  </OrganAnatomyHoverWrap>
                )
              })}
            </div>
            {hasItem && (
              <div style={{ marginTop:20, padding:12, borderRadius:12, background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', fontSize:13, color:'#c7d2fe', lineHeight:1.6 }}>
                <strong>📊 Điểm trung bình: {avg.toFixed(1)}/10.</strong>{' '}
                Cơ quan khỏe nhất là <strong style={{ color: ORGAN_COLOR[best.key] }}>{best.label}</strong> ({scores[best.key]}/10).{' '}
                {(scores[worst.key] || 0) <= 3
                  ? <>Cần chú ý <strong style={{ color:'#f87171' }}>{worst.label}</strong> ({scores[worst.key]}/10) đang ở mức thấp{haz ? `, có thể do "${haz.name}"` : ''}.</>
                  : 'Các cơ quan còn lại đang ở mức ổn định, hãy tiếp tục duy trì công thức này!'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── HealthCardModal ──────────────────────────────────────────────────────────
function HealthCardModal({ open, onClose, scores, hasItem, selection }) {
  const cardRef = useRef(null)
  const wrapRef = useRef(null)

  const handleMouseMove = useCallback(e => {
    if (!cardRef.current) return
    const r = cardRef.current.getBoundingClientRect()
    const x = ((e.clientX - r.left) / r.width - 0.5) * 24
    const y = ((e.clientY - r.top) / r.height - 0.5) * -24
    cardRef.current.style.transition = 'transform 0.1s linear'
    cardRef.current.style.transform = `rotateX(${y}deg) rotateY(${x}deg)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return
    cardRef.current.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)'
    cardRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)'
  }, [])

  if (!open) return null

  const PRO = 6
  const allOrgans = [...HC_ORGAN_META, HC_STOMACH]
  const sel = selection
  const aiText = getDoctorAIMsg(selection, scores).replace(/<[^>]*>/g, '')
  const targetName = sel.target?.name?.replace('Trọng tâm: ','').replace(/^[^\w]/,'').trim() || 'Vitamin K'

  const sArr = Object.values(scores)
  const avg = (sArr.reduce((a,b)=>a+b,0)/sArr.length).toFixed(1)
  const bestO = allOrgans.slice().sort((a,b)=>(scores[b.key]||0)-(scores[a.key]||0))[0]
  const worstO = allOrgans.slice().sort((a,b)=>(scores[a.key]||0)-(scores[b.key]||0))[0]

  return (
    <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(5,4,20,0.92)', display:'flex', alignItems:'center', justifyContent:'center', padding:'12px', overflowY:'auto' }}>
      <style>{`
        .hc-grid-bg { background-image:linear-gradient(rgba(99,102,241,0.08) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.08) 1px,transparent 1px); background-size:40px 40px; }
        @keyframes hc-card-shine { from{transform:translateX(-120%) rotate(25deg)} to{transform:translateX(120%) rotate(25deg)} }
        @keyframes hc-float { 0%,100%{transform:translateY(-5px)} 50%{transform:translateY(5px)} }
        .hc-shine { animation:hc-card-shine 5s linear infinite; }
        .hc-veg-float { animation:hc-float 4s ease-in-out infinite; }
        .hc-body { display:flex; align-items:flex-start; justify-content:center; gap:32px; padding:24px 28px; overflow:hidden; flex:1; }
        .hc-left-col { display:flex; align-items:flex-start; justify-content:center; overflow-y:auto; overflow-x:hidden; flex-shrink:0; max-height:100%; padding-right:4px; scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.2) transparent; }
        .hc-left-col::-webkit-scrollbar { width:5px; }
        .hc-left-col::-webkit-scrollbar-track { background:transparent; }
        .hc-left-col::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2); border-radius:4px; }
        @media (max-width:900px) {
          .hc-body { flex-direction:column; align-items:center; overflow-y:auto; padding:16px; gap:20px; }
          .hc-left-col { max-height:none; overflow:visible; width:100%; justify-content:center; padding-right:0; }
          .hc-right-col { width:100% !important; max-height:none !important; }
        }
      `}</style>
      <div className="hc-grid-bg" style={{ background:'linear-gradient(135deg,#0f0c29,#141428,#1a1035)', borderRadius:24, width:'96vw', maxWidth:900, maxHeight:'calc(100vh - 24px)', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', flexShrink:0 }}>
        <div style={{ position:'relative', zIndex:10, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 28px 16px', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
          <div>
            <h2 style={{ color:'#fff', fontSize:20, fontWeight:900, display:'flex', alignItems:'center', gap:12, margin:0 }}>🃏 My Health Level Card</h2>
            <p style={{ color:'#6ee7b7', fontSize:12, margin:'4px 0 0' }}>Di chuyển chuột trên thẻ để xem hiệu ứng 3D • Tổng hợp toàn bộ chỉ số nội tạng</p>
          </div>
          <button onClick={onClose} style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div className="hc-body" style={{ position:'relative', zIndex:10 }}>
          {/* Card — left col with scroll */}
          <div className="hc-left-col">
          <div ref={wrapRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} style={{ perspective:1800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <div ref={cardRef} style={{ width:380, minHeight:660, borderRadius:32, position:'relative', transformStyle:'preserve-3d', background:'linear-gradient(170deg,#7fe0d7 0%,#5bc8bd 40%,#3db8ac 100%)', boxShadow:'0 40px 100px rgba(0,0,0,.55),0 0 0 1.5px rgba(255,255,255,0.25) inset', overflow:'hidden' }}>
              {/* Shine */}
              <div className="hc-shine" style={{ position:'absolute', inset:0, background:'linear-gradient(115deg,transparent 30%,rgba(255,255,255,.38) 50%,transparent 70%)', pointerEvents:'none', zIndex:10 }} />
              <div style={{ position:'absolute', inset:0, borderRadius:32, border:'2px solid rgba(255,255,255,.4)', boxShadow:'inset 0 2px 4px rgba(255,255,255,.75)', pointerEvents:'none', zIndex:11 }} />

              {/* Bubble */}
              <div style={{ position:'absolute', left:14, top:14, background:'#ffe44f', color:'#333', fontSize:11, fontWeight:900, padding:'6px 13px', borderRadius:999, zIndex:5, boxShadow:'0 2px 8px rgba(0,0,0,.15)' }}>{targetName}</div>

              {/* Header */}
              <div style={{ padding:'14px 14px 10px', position:'relative', zIndex:5 }}>
                <div style={{ fontSize:52, fontWeight:900, color:'#0d8f4f', textAlign:'center', lineHeight:1, textShadow:'0 4px 16px rgba(0,100,60,.25)' }}>{targetName[0] || 'K'}</div>
                <div style={{ background:'#ffe44f', color:'#d33b00', fontSize:24, fontWeight:900, borderRadius:20, padding:'10px 14px', textAlign:'center', margin:'0 14px', boxShadow:'0 4px 14px rgba(255,180,0,.3)' }}>CHIẾN THẦN SỨC KHỎE</div>
              </div>

              {/* Body */}
              <div style={{ display:'flex', gap:10, padding:'10px 14px', position:'relative', zIndex:5 }}>
                <div style={{ width:'46%', background:'rgba(255,255,255,.12)', border:'2px solid rgba(255,255,255,.35)', borderRadius:24, backdropFilter:'blur(8px)', overflow:'hidden' }}>
                  <img src={organBoyUrl} alt="Hero" style={{ width:'100%' }} />
                </div>
                <div style={{ width:'54%', background:'rgba(255,255,255,.12)', border:'2px solid rgba(255,255,255,.35)', borderRadius:24, backdropFilter:'blur(8px)', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
                  {allOrgans.map((o, idx) => {
                    const v = scores[o.key] || 0
                    const isPro = v >= PRO
                    const img = isPro ? o.pro : o.norm
                    const isDanger = v <= 0
                    const circ = 62.8
                    const dash = Math.max(0, v) / 10 * circ
                    const ringColor = isDanger ? '#f87171' : o.color
                    return (
                      <OrganAnatomyHoverWrap key={o.key} organKey={o.key}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(255,255,255,.13)', borderRadius:14, padding:'5px 7px' }}>
                        <img src={img} alt={o.label} style={{ width:40, height:40, objectFit:'contain', ...(isPro ? { filter:`drop-shadow(0 0 8px ${o.color})` } : {}) }} />
                        <div style={{ flex:1 }}>
                          <div style={{ background: isDanger ? '#c0392b' : '#1d964d', color:'#fff', borderRadius:9, padding:'4px 7px', fontWeight:900, fontSize:10, textAlign:'center', marginBottom:3 }}>{o.label}{isPro ? ' ✦' : ''}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                            <svg width="36" height="36" viewBox="0 0 44 44" style={{ transform:'rotate(-90deg)' }}>
                              <circle cx="22" cy="22" r="10" fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="4"/>
                              <circle cx="22" cy="22" r="10" fill="none" stroke={ringColor} strokeWidth="4" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round">
                                <animate attributeName="stroke-dasharray" from={`0 ${circ}`} to={`${dash} ${circ}`} dur="0.8s" fill="freeze" begin={`${idx*0.07+0.3}s`}/>
                              </circle>
                              <text x="22" y="22" fontSize="8" fontWeight="900" fill="white" textAnchor="middle" dominantBaseline="central" style={{ transform:'rotate(90deg) translateX(2px)' }}>{v}</text>
                            </svg>
                            <span style={{ fontSize:11, fontWeight:900, color: isDanger ? '#f87171' : o.color }}>{v}<span style={{ fontSize:9, color:'rgba(255,255,255,.5)', fontWeight:600 }}>/10</span></span>
                          </div>
                        </div>
                      </div>
                      </OrganAnatomyHoverWrap>
                    )
                  })}
                </div>
              </div>

              {/* Bottom strip */}
              <div style={{ margin:'4px 14px 10px', background:'rgba(0,0,0,.22)', border:'1px solid rgba(255,255,255,.18)', borderRadius:20, padding:10, position:'relative', zIndex:5, display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ flexShrink:0 }}>
                  <img src={organVegetablesUrl} className="hc-veg-float" style={{ width:80, opacity:0.92 }} alt="" />
                </div>
                <div style={{ flex:1, fontSize:9.5, color:'rgba(255,255,255,.85)', lineHeight:1.6 }}>
                  <strong style={{ color:'#fff' }}>Công thức:</strong><br/>
                  {sel.base && <>{sel.base.name.substring(0,18)}<br/></>}
                  {sel.protein && <>{sel.protein.name.substring(0,18)}<br/></>}
                  {sel.veg && <>{sel.veg.name.substring(0,18)}<br/></>}
                  {sel.top && <>{sel.top.name.substring(0,18)}<br/></>}
                  {sel.avoid && <span style={{ color:'#f87171' }}>⚠ {sel.avoid.name.substring(0,16)}</span>}
                  <div style={{ fontSize:9, color:'rgba(255,255,255,.65)', fontStyle:'italic', borderTop:'1px solid rgba(255,255,255,.12)', paddingTop:6, marginTop:4, lineHeight:1.5 }}>{aiText.substring(0,90)}...</div>
                </div>
              </div>
            </div>
          </div>
          </div>{/* end hc-left-col */}

          {/* Right panel */}
          <div className="hc-right-col" style={{ flex:1, display:'flex', flexDirection:'column', gap:16, overflowY:'auto', maxHeight:'calc(100vh - 160px)', scrollbarWidth:'none' }}>
            <div style={{ fontSize:10, fontWeight:900, color:'#34d399', textTransform:'uppercase', letterSpacing:'0.1em' }}>Phân tích chi tiết</div>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:8 }}>📊 Lục giác chỉ số nội tạng</div>
              <RadarSVG scores={scores} cx={190} cy={180} maxR={118} labelExtra={26} svgW={380} svgH={360} showIcons={true} />
            </div>
            <div style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#fff', marginBottom:12 }}>🫀 Trạng thái từng cơ quan</div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {allOrgans.map(o => {
                  const v = scores[o.key] || 0
                  const isPro = v >= PRO
                  const img = isPro ? o.pro : o.norm
                  const lbl = resultScoreLabel(v)
                  return (
                    <OrganAnatomyHoverWrap key={o.key} organKey={o.key}>
                    <div style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.05)', borderRadius:12, padding:'8px 12px' }}>
                      <img src={img} style={{ width:36, height:36, objectFit:'contain', flexShrink:0, ...(isPro ? { filter:`drop-shadow(0 0 6px ${o.color})` } : {}) }} alt={o.label}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                          <span style={{ color:'#fff', fontSize:12, fontWeight:700 }}>{o.label}{isPro ? ' ✦ PRO' : ''}</span>
                          <span style={{ fontSize:12, fontFamily:'monospace', fontWeight:900, color:lbl.color }}>{v}/10</span>
                        </div>
                        <div style={{ height:6, borderRadius:999, background:'rgba(255,255,255,0.1)' }}>
                          <div style={{ height:'100%', borderRadius:999, width:`${Math.max(0,v)*10}%`, background:o.color, transition:'width 0.7s ease' }} />
                        </div>
                        <div style={{ fontSize:10, fontWeight:700, color:lbl.color, marginTop:2 }}>{lbl.txt}</div>
                      </div>
                    </div>
                    </OrganAnatomyHoverWrap>
                  )
                })}
              </div>
            </div>
            <div style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', borderRadius:16, padding:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#a5b4fc', marginBottom:8 }}>💬 Nhận định AI</div>
              <div style={{ fontSize:12, color:'#c7d2fe', lineHeight:1.6 }}>
                <strong>Điểm trung bình: {avg}/10.</strong>{' '}
                Cơ quan khỏe nhất là <strong style={{ color: bestO.color }}>{bestO.label}</strong> ({scores[bestO.key] || 0}/10{(scores[bestO.key]||0)>=PRO ? ' — đạt cấp độ PRO ✦' : ''}).
                {(scores[worstO.key] || 0) <= 3 && <> Cần chú ý <strong style={{ color:'#f87171' }}>{worstO.label}</strong> ({scores[worstO.key] || 0}/10){sel.avoid ? ` — do ảnh hưởng của "${sel.avoid.name}"` : ''}.</>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
const EMPTY_SEL = { target:null, base:null, protein:null, veg:null, top:null, avoid:null }

// ─── Bác sĩ Dinh Dưỡng AI — chat thật nhúng vào trang "Ăn gì tốt hôm nay" ───
// Dùng CHUNG hook + kho lưu trữ (globalChatbotStorage.js) với widget GlobalAIChatbot
// (góc màn hình) và trang "Lịch sử Chat với AI" → mọi tin nhắn gửi ở đây cũng xuất
// hiện đồng bộ song song ở 2 nơi kia, và ngược lại — không cần đóng/mở lại trang.
function NutritionAIChatView({ contextHint, onClose }) {
  const { user } = useAuth()
  const userKey = user?.uuid || null
  const scrollRef = useRef(null)
  const docInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const {
    messages,
    input, setInput,
    status,
    mode,
    busy,
    attachedFiles,
    handleFilesSelect, removeAttachedFile,
    submitQuestion,
    speaking, speak,
    recording, transcribing, toggleMic,
  } = useGlobalAIChatbotEngine({ userKey, activePanelLabel: 'Ăn gì tốt hôm nay', isVi: true })

  useEffect(() => {
    window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 30)
  }, [messages, busy])

  const border = '#e2e8f0'
  const surface = '#f8fafc'
  const ink = '#0f172a'
  const muted = '#64748b'
  const userBubble = 'linear-gradient(135deg,#4f46e5,#6366f1)'
  const botBubble = '#f1f5f9'
  const accent = '#4f46e5'

  return (
    <div style={{ width:'100%', maxWidth:500, maxHeight:'100%', display:'flex', flexDirection:'column', borderRadius:16, overflow:'hidden', border:`1px solid ${border}`, background:'#fff', boxShadow:'0 24px 70px rgba(0,0,0,0.34)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 14px', background:surface, borderBottom:`1px solid ${border}` }}>
        <span style={{ fontSize:20 }}>🥗</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:900, fontSize:13, color:ink, textTransform:'uppercase', letterSpacing:'0.04em' }}>Bác sĩ Dinh Dưỡng AI</div>
          <div style={{ fontSize:11, color:muted, marginTop:2 }}>{status} · {getModeLabel(mode, true)}</div>
        </div>
        <span style={{ fontSize:10, padding:'3px 8px', borderRadius:999, background:'#eef2ff', color:accent, fontWeight:800 }}>Đồng bộ lịch sử</span>
        {onClose && (
          <button type="button" onClick={onClose} title="Đóng chat" style={{ width:28, height:28, borderRadius:'50%', border:'none', background:'#e2e8f0', color:ink, fontSize:14, cursor:'pointer', flexShrink:0 }}>✕</button>
        )}
      </div>

      {contextHint && (
        <div style={{ fontSize:12, color:'#475569', lineHeight:1.6, fontStyle:'italic', padding:'10px 14px', borderBottom:`1px solid ${border}`, background:'#fafbff' }} dangerouslySetInnerHTML={{ __html: contextHint }} />
      )}

      {/* Quick prompts */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, padding:'8px 12px 0' }}>
        {['Mâm cơm này có tốt cho gan không?', 'Gợi ý món thay thế lành mạnh hơn', 'Uống bia có ảnh hưởng gì?'].map(prompt => (
          <button key={prompt} type="button" disabled={busy} onClick={() => submitQuestion(prompt)}
            style={{ fontSize:11, padding:'5px 10px', borderRadius:999, border:`1px solid ${border}`, background:surface, color:muted, cursor: busy ? 'not-allowed' : 'pointer', fontFamily:'inherit', opacity: busy ? 0.6 : 1 }}>
            {prompt}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex:'1 1 auto', minHeight:220, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, padding:'12px 14px' }}>
        {messages.length === 0 && !busy && (
          <div style={{ fontSize:12, color:muted, textAlign:'center', padding:'12px 0' }}>Hỏi Bác sĩ Dinh Dưỡng AI bất cứ điều gì về mâm cơm và mục tiêu sức khỏe của bạn 👇</div>
        )}
        {messages.map(msg => (
          <div key={msg.id} style={{ display:'flex', flexDirection:'column', gap:4, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{ maxWidth:'86%', padding:'9px 12px', borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px', background: msg.role === 'user' ? userBubble : botBubble, color: msg.role === 'user' ? '#fff' : ink, fontSize:12.5, lineHeight:1.55, wordBreak:'break-word' }}>
              {msg.imageDataUrls && msg.imageDataUrls.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: msg.text ? 8 : 0 }}>
                  {msg.imageDataUrls.map((img, i) => (
                    img.kind === 'pdf'
                      ? <div key={i} style={{ width:44, height:44, borderRadius:8, background:'rgba(255,255,255,0.2)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', fontSize:16 }}>📄</div>
                      : <img key={i} src={img.dataUrl} alt={img.name || 'attached'} style={{ width:44, height:44, borderRadius:8, objectFit:'cover', display:'block' }} />
                  ))}
                </div>
              )}
              {msg.fileNames && msg.fileNames.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom: msg.text ? 8 : 0 }}>
                  {msg.fileNames.map((name, i) => <span key={i} style={{ fontSize:9, padding:'3px 7px', borderRadius:8, background:'rgba(255,255,255,0.2)' }}>📃 {name}</span>)}
                </div>
              )}
              {msg.text}
            </div>
            {msg.role === 'assistant' && (
              <button type="button" onClick={() => speak(msg.text)}
                title={speaking ? 'Dừng đọc' : 'Đọc to'}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:13, color:muted, padding:'2px 4px' }}>
                {speaking ? '⏸' : '🔊'}
              </button>
            )}
          </div>
        ))}
        {busy && mode === 'thinking' && (
          <div style={{ maxWidth:'70%', padding:'9px 12px', borderRadius:'16px 16px 16px 4px', background:botBubble, display:'flex', gap:5, alignItems:'center' }}>
            {[0, 0.2, 0.4].map((d, i) => (
              <span key={i} style={{ width:6, height:6, borderRadius:'50%', background:accent, display:'inline-block', animation:`ocNutritionChatDot 1.2s ${d}s ease-in-out infinite` }} />
            ))}
          </div>
        )}
      </div>

      {/* Attached file previews */}
      {attachedFiles.length > 0 && (
        <div style={{ display:'flex', gap:8, padding:'8px 14px 0', overflowX:'auto' }}>
          {attachedFiles.map(f => (
            <div key={f.id} style={{ position:'relative', flexShrink:0 }}>
              {f.kind === 'image'
                ? <img src={f.dataUrl} alt={f.name} title={f.name} style={{ width:44, height:44, borderRadius:8, objectFit:'cover', display:'block' }} />
                : <div title={f.name} style={{ width:44, height:44, borderRadius:8, background:surface, border:`1px solid ${border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>{f.kind === 'pdf' ? '📄' : '📃'}</div>}
              <button type="button" onClick={() => removeAttachedFile(f.id)}
                style={{ position:'absolute', top:-5, right:-5, border:'none', background:'#fff', color:ink, borderRadius:'50%', width:16, height:16, cursor:'pointer', fontSize:9, lineHeight:'16px', padding:0, textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,0.35)', fontWeight:800 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ display:'flex', gap:6, alignItems:'flex-end', padding:'10px 14px 12px', borderTop:`1px solid ${border}` }}>
        <input ref={docInputRef} type="file" accept="image/*,application/pdf,text/plain,text/csv,.csv,.txt,.md" multiple onChange={handleFilesSelect} style={{ display:'none' }} />
        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesSelect} style={{ display:'none' }} />

        <button type="button" onClick={() => docInputRef.current?.click()} disabled={busy || attachedFiles.length >= MAX_FILES}
          title={`Đính kèm PDF / văn bản / ảnh (tối đa ${MAX_FILES})`}
          style={{ width:34, height:34, borderRadius:10, border:`1px solid ${border}`, background:surface, color:ink, fontSize:16, fontWeight:900, cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer', opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1, flexShrink:0 }}>
          +
        </button>

        <textarea value={input} onChange={e => setInput(e.target.value)} rows={1}
          placeholder={transcribing ? 'Đang nhận diện giọng nói…' : 'Hỏi Bác sĩ Dinh Dưỡng AI… (Enter để gửi)'}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion() } }}
          style={{ flex:1, resize:'none', borderRadius:10, border:`1px solid ${border}`, background:surface, color:ink, fontSize:12.5, padding:'8px 10px', fontFamily:'inherit', outline:'none', lineHeight:1.5 }} />

        <button type="button" onClick={toggleMic} disabled={busy && !recording}
          title={recording ? 'Dừng ghi âm' : 'Nói để hỏi'}
          style={{ width:34, height:34, borderRadius:10, border:'none', background: recording ? 'linear-gradient(135deg,#ef4444,#f97316)' : surface, color: recording ? '#fff' : ink, fontSize:16, cursor: transcribing ? 'wait' : 'pointer', flexShrink:0, opacity: transcribing ? 0.7 : 1 }}>
          {transcribing ? '⏳' : recording ? '⏹️' : '🎙️'}
        </button>

        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy || attachedFiles.length >= MAX_FILES}
          title={`Gửi hình ảnh để AI phân tích (tối đa ${MAX_FILES})`}
          style={{ width:34, height:34, borderRadius:10, border:`1px solid ${border}`, background: attachedFiles.length > 0 ? '#eef2ff' : surface, color:ink, fontSize:16, cursor: (busy || attachedFiles.length >= MAX_FILES) ? 'not-allowed' : 'pointer', flexShrink:0, opacity: (busy || attachedFiles.length >= MAX_FILES) ? 0.5 : 1 }}>
          🖼️
        </button>

        <button type="button" onClick={() => submitQuestion()} disabled={busy || (!input.trim() && attachedFiles.length === 0)}
          style={{ height:34, padding:'0 14px', borderRadius:10, border:'none', background:accent, color:'#fff', fontWeight:800, fontSize:12.5, cursor: (busy || (!input.trim() && attachedFiles.length === 0)) ? 'not-allowed' : 'pointer', opacity: (busy || (!input.trim() && attachedFiles.length === 0)) ? 0.55 : 1, flexShrink:0, fontFamily:'inherit' }}>
          {busy ? '…' : 'Gửi'}
        </button>
      </div>

      <div style={{ fontSize:9.5, color:muted, textAlign:'center', padding:'0 14px 10px' }}>
        Thông tin chỉ mang tính hỗ trợ, không thay thế tư vấn bác sĩ.
      </div>

      <style>{`
        @keyframes ocNutritionChatDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>
    </div>
  )
}

export default function OrganConnectionPanel({ onNext, onPrev, prevLabel, nextLabel }) {
  const { theme } = useApp()
  const isDark = theme === 'dark'

  const [activeTab, setActiveTab]       = useState('target')
  const [selection, setSelection]       = useState(EMPTY_SEL)
  const [showOrganMap, setShowOrganMap]  = useState(false)
  const [showResult, setShowResult]     = useState(false)
  const [showHealthCard, setShowHealthCard] = useState(false)
  const [showOrganVideo, setShowOrganVideo] = useState(false)
  const [showAIChat, setShowAIChat] = useState(false)

  // ── Playlist gợi ý cuối trang (real YT.Player, giống khu RSS) ──
  const ytPlaylistPlayerRef = useRef(null)
  const ytPlaylistContainerRef = useRef(null)
  const [playlistVideos, setPlaylistVideos] = useState([])
  const [playlistActiveId, setPlaylistActiveId] = useState(null)
  const [playlistLoading, setPlaylistLoading] = useState(false)

  const playPlaylistVideoAt = (index) => {
    if (ytPlaylistPlayerRef.current && typeof ytPlaylistPlayerRef.current.playVideoAt === 'function') {
      ytPlaylistPlayerRef.current.playVideoAt(index)
    }
  }

  useEffect(() => {
    let cancelled = false
    setPlaylistLoading(true)

    loadYouTubeIframeAPI().then((YT) => {
      if (cancelled || !YT || !ytPlaylistContainerRef.current) return
      if (ytPlaylistPlayerRef.current) {
        ytPlaylistPlayerRef.current.destroy()
        ytPlaylistPlayerRef.current = null
      }
      ytPlaylistPlayerRef.current = new YT.Player(ytPlaylistContainerRef.current, {
        width: '100%',
        height: '100%',
        videoId: KIENTHUC_PLAYLIST_START_VIDEO,
        playerVars: { listType: 'playlist', list: KIENTHUC_PLAYLIST_ID, rel: 0 },
        events: {
          onReady: (e) => {
            if (cancelled) return
            const ids = e.target.getPlaylist ? (e.target.getPlaylist() || []) : []
            const idx = e.target.getPlaylistIndex ? e.target.getPlaylistIndex() : 0
            setPlaylistActiveId(ids[idx] || ids[0] || null)
            setPlaylistVideos(ids.map((id, i) => ({ id, title: `Video ${i + 1}` })))
            setPlaylistLoading(false)
            ids.forEach(async (id) => {
              const title = await fetchYouTubeTitle(id)
              if (cancelled || !title) return
              setPlaylistVideos(prev => prev.map(v => (v.id === id ? { ...v, title } : v)))
            })
          },
          onStateChange: (e) => {
            if (cancelled) return
            const ids = e.target.getPlaylist ? (e.target.getPlaylist() || []) : []
            const idx = e.target.getPlaylistIndex ? e.target.getPlaylistIndex() : -1
            if (idx >= 0 && ids[idx]) setPlaylistActiveId(ids[idx])
          },
        },
      })
    })

    return () => {
      cancelled = true
      if (ytPlaylistPlayerRef.current) { ytPlaylistPlayerRef.current.destroy(); ytPlaylistPlayerRef.current = null }
    }
  }, [])

  const { scores, hasItem, targetOrgan } = calculateScores(selection)
  const aiMsg = getDoctorAIMsg(selection, scores)
  const organVideo = ORGAN_VIDEOS[selection.target?.organKey]

  const selectItem = (cat, itemId) => {
    const itemData = DB[cat].find(i => i.id === itemId)
    setSelection(prev => {
      if (prev[cat]?.id === itemId) {
        // deselect
        if (cat !== 'target' && cat !== 'avoid') {
          const el = document.getElementById(`plate-${cat}`)
          if (el) el.classList.remove('active')
        }
        if (cat === 'target') setShowOrganVideo(false)
        return { ...prev, [cat]: null }
      }
      // select
      if (cat === 'target') setShowOrganVideo(false)
      return { ...prev, [cat]: itemData }
    })
  }

  const resetAll = () => setSelection({ ...EMPTY_SEL })

  // Plate animation via class
  useEffect(() => {
    GOOD_CATS.forEach(cat => {
      const el = document.getElementById(`plate-${cat}`)
      if (!el) return
      if (selection[cat]) {
        el.textContent = selection[cat].emoji
        el.classList.remove('plate-active')
        void el.offsetWidth
        el.classList.add('plate-active')
      } else {
        el.classList.remove('plate-active')
      }
    })
  }, [selection])

  const TOPBAR_H = 56
  const iframeH = `calc(100svh - ${TOPBAR_H}px)`

  return (
    <>
    <div className="oc-root" style={{ height:iframeH, background: isDark ? '#0a0d1a' : '#f8fafc', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <style>{`
        /* ── Base font scale ── */
        .oc-root { font-size: clamp(13px, 1.5vw, 16px); }

        /* Plate items */
        .plate-item {
          transition: all 0.5s cubic-bezier(0.34,1.56,0.64,1);
          transform: scale(0) translate(-50%,-50%);
          opacity:0;
          position:absolute;
          transform-origin:top left;
        }
        .plate-item.plate-active { transform:scale(1) translate(-50%,-50%); opacity:1; }

        /* Progress bars */
        .oc-progress { transition:width 0.5s cubic-bezier(0.4,0,0.2,1); }

        /* Tab active states */
        .oc-tab-active-indigo { background:#4f46e5!important; color:#fff!important; font-weight:800!important; }
        .oc-tab-active-slate  { background:#0f172a!important; color:#fff!important; font-weight:800!important; }
        .oc-tab-active-rose   { background:#dc2626!important; color:#fff!important; font-weight:800!important; }

        /* Hazard pulse */
        @keyframes oc-pulse-red { 0%,100%{filter:drop-shadow(0 0 8px rgba(239,68,68,0.6))} 50%{filter:drop-shadow(0 0 16px rgba(239,68,68,0.9))} }
        @keyframes ocVideoFlipIn { 0%{ opacity:0; transform:perspective(1200px) rotateY(-8deg) scale(0.96); } 100%{ opacity:1; transform:perspective(1200px) rotateY(0deg) scale(1); } }
        .hazard-active { animation:oc-pulse-red 2s infinite; }

        /* Custom scrollbar */
        .oc-scroll::-webkit-scrollbar { width:6px; }
        .oc-scroll::-webkit-scrollbar-track { background:#f1f5f9; }
        .oc-scroll::-webkit-scrollbar-thumb { background:#cbd5e1; border-radius:4px; }

        /* Receipt bg */
        .receipt-paper {
          background:#fff;
          background-image:linear-gradient(to bottom,rgba(240,243,246,1) 1px,transparent 1px);
          background-size:100% 24px;
          box-shadow:0 10px 25px -5px rgba(0,0,0,0.08);
        }

        /* Nav bar */
        .organ-nav-bar {
          display:flex;
          flex-shrink:0;
          padding:8px clamp(12px,3vw,24px);
          background:${isDark?'#0a0d1a':'#f8fafc'};
          border-top:1px solid ${isDark?'rgba(255,255,255,0.08)':'#e2e8f0'};
          z-index:20;
        }

        /* ── Responsive: Workspace layout ── */
        .oc-workspace {
          flex:1;
          display:flex;
          overflow:hidden;
        }
        .oc-aside-left, .oc-aside-right {
          width: clamp(220px, 26vw, 360px);
          background:#fff;
          display:flex;
          flex-direction:column;
          flex-shrink:0;
          z-index:10;
        }
        .oc-aside-left { border-right:1px solid #e2e8f0; }
        .oc-aside-right { border-left:1px solid #e2e8f0; overflow:hidden; }
        .oc-main-center { flex:1; display:flex; flex-direction:column; background:#eff3f7; position:relative; overflow-x:hidden; overflow-y:auto; justify-content:space-between; align-items:center; padding:clamp(12px,3vh,32px) 0; gap:16px; }

        /* ── Tablet: 768px–1024px ── */
        @media (max-width:1024px) {
          .oc-aside-left, .oc-aside-right { width: clamp(200px, 28vw, 280px); }
          .oc-header-btns button { font-size:11px!important; padding:5px 9px!important; }
          .oc-header-badge { display:none!important; }
        }

        /* ── Mobile: ≤ 768px ── */
        @media (max-width:768px) {
          .oc-workspace { flex-direction:column; overflow:auto; }
          .oc-aside-left {
            width:100%!important;
            border-right:none!important;
            border-bottom:1px solid #e2e8f0;
            flex-shrink:0;
            max-height: 42vh;
          }
          .oc-main-center {
            min-height:260px;
            padding:16px 0;
          }
          .oc-aside-right {
            width:100%!important;
            border-left:none!important;
            border-top:1px solid #e2e8f0;
            flex-shrink:0;
            max-height:54vh;
          }
          .oc-header { flex-direction:column; align-items:flex-start!important; gap:8px; padding:10px 16px!important; }
          .oc-header-btns { flex-wrap:wrap; gap:6px!important; }
          .oc-header-btns button { font-size:11px!important; padding:5px 9px!important; }
          .oc-header-badge { display:none!important; }
          .oc-header-title { font-size:15px!important; }
          .oc-header-sub  { font-size:10px!important; }
          .oc-visual-title { font-size:18px!important; }
          .oc-plate-wrap { height:280px!important; }
          .oc-plate-circle { width:240px!important; height:240px!important; }
          .plate-item { font-size:52px!important; }
          .oc-hazard-emoji { font-size:48px!important; }
        }

        /* ── Small mobile: ≤ 480px ── */
        @media (max-width:480px) {
          .oc-aside-left { max-height:38vh; }
          .oc-aside-right { max-height:48vh; }
          .oc-main-center { min-height:220px; }
          .oc-plate-circle { width:200px!important; height:200px!important; }
          .oc-header-title { font-size:13px!important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <header className="oc-header" style={{ background:'#fff', padding:'12px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid #e2e8f0', flexShrink:0, zIndex:20, boxShadow:'0 1px 2px rgba(0,0,0,0.04)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ fontSize:28 }}>🥗</div>
          <div>
            <div className="oc-header-title" style={{ fontWeight:900, fontSize:17, color:'#0f172a', letterSpacing:'-0.01em', display:'flex', alignItems:'center', gap:8 }}>
              HEALTHY CUSTOMIZER
            </div>
            <div className="oc-header-sub" style={{ fontSize:12, color:'#94a3b8' }}>Organ Formula Builder</div>
          </div>
        </div>
        <div className="oc-header-btns" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <button onClick={() => setShowOrganMap(true)} style={{ fontSize:12, fontWeight:700, color:'#fff', background:'#4f46e5', border:'none', padding:'6px 12px', borderRadius:8, cursor:'pointer' }}>🧬 Organ Connection</button>
          <button onClick={() => setShowResult(true)} style={{ fontSize:12, fontWeight:700, color:'#fff', background:'linear-gradient(to right,#c026d3,#f59e0b)', border:'none', padding:'6px 12px', borderRadius:8, cursor:'pointer' }}>✨ Show Result</button>
          <button onClick={() => setShowHealthCard(true)} style={{ fontSize:12, fontWeight:700, color:'#fff', background:'linear-gradient(to right,#10b981,#14b8a6)', border:'none', padding:'6px 12px', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}><span>🃏</span> My Health Level Card</button>
          <button onClick={resetAll} style={{ fontSize:12, fontWeight:700, color:'#64748b', background:'#fff', border:'1px solid #e2e8f0', padding:'6px 12px', borderRadius:8, cursor:'pointer' }}>🔄 Làm lại từ đầu</button>
        </div>
      </header>

      {/* ── WORKSPACE ── */}
      <div className="oc-workspace">

        {/* LEFT: Tabs */}
        <aside className="oc-aside-left">
          {/* Tab grid */}
          <div style={{ padding:8, background:'#f1f5f9', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4 }}>
              {[
                { id:'target',  label:'🎯 Mục tiêu', count:'' },
                { id:'base',    label:'🍚 Nền', count:'(5)' },
                { id:'protein', label:'🥩 Đạm', count:'(9)' },
                { id:'veg',     label:'🥦 Rau', count:'(9)' },
                { id:'top',     label:'🫒 Super', count:'(10)' },
                { id:'avoid',   label:'🚫 Tránh', count:'(5)' },
              ].map(t => {
                const isActive = activeTab === t.id
                const isAvoid = t.id === 'avoid'
                let style = { padding:'6px 4px', borderRadius:12, fontSize:12, fontWeight:700, cursor:'pointer', border:'none', transition:'all 0.15s', width:'100%' }
                if (isActive) {
                  style = { ...style, background: t.id === 'target' ? '#4f46e5' : isAvoid ? '#dc2626' : '#0f172a', color:'#fff' }
                } else {
                  style = { ...style, background: isAvoid ? '#fff1f2' : '#fff', color: isAvoid ? '#be123c' : '#475569', border: isAvoid ? '1px solid #fecdd3' : '1px solid #e2e8f0' }
                }
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={style}>
                    {t.label} {t.count}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tab panels */}
          <div className="oc-scroll" style={{ flex:1, overflowY:'auto', padding:8 }}>
            {activeTab === 'target' && (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div style={{ padding:12, background:'#eef2ff', border:'1px solid #e0e7ff', borderRadius:12, marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#1e1b4b', marginBottom:4 }}>Cơ chế "Base Drink"</div>
                  <div style={{ fontSize:12, color:'#4338ca', lineHeight:1.6 }}>Chọn 1 cơ quan làm Trọng tâm. Các nguyên liệu bồi bổ đúng cơ quan này sẽ được <strong>nhân hệ số x1.5 điểm</strong>.</div>
                </div>
                {DB.target.map(it => <ItemButton key={it.id} cat="target" item={it} selection={selection} onSelect={selectItem} />)}
              </div>
            )}
            {activeTab === 'base' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {DB.base.map(it => <ItemButton key={it.id} cat="base" item={it} selection={selection} onSelect={selectItem} />)}
              </div>
            )}
            {activeTab === 'protein' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {DB.protein.map(it => <ItemButton key={it.id} cat="protein" item={it} selection={selection} onSelect={selectItem} />)}
              </div>
            )}
            {activeTab === 'veg' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {DB.veg.map(it => <ItemButton key={it.id} cat="veg" item={it} selection={selection} onSelect={selectItem} />)}
              </div>
            )}
            {activeTab === 'top' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {DB.top.map(it => <ItemButton key={it.id} cat="top" item={it} selection={selection} onSelect={selectItem} />)}
              </div>
            )}
            {activeTab === 'avoid' && (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ padding:12, background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:12, marginBottom:4 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#7f1d1d', marginBottom:4 }}>⚠️ Cảnh báo hãm phanh</div>
                  <div style={{ fontSize:12, color:'#be123c', lineHeight:1.6 }}>Mô phỏng thói quen thực tế. Thêm các món này sẽ trực tiếp trừ vỡ quỹ điểm nội tạng mà bạn vừa cất công gom phía trên.</div>
                </div>
                {DB.avoid.map(it => <ItemButton key={it.id} cat="avoid" item={it} selection={selection} onSelect={selectItem} />)}
              </div>
            )}
          </div>
        </aside>

        {/* CENTER: Visual Stage */}
        <main className="oc-main-center">
          <div style={{ textAlign:'center', zIndex:10 }}>
            <span style={{ fontSize:11, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.15em', display:'block', marginBottom:4 }}>Visual Stage</span>
            <h2 className="oc-visual-title" style={{ fontSize:24, fontWeight:900, color:'#1e293b', margin:0 }}>Mâm Cơm Thần Kỳ</h2>
            <p style={{ fontSize:12, color:'#64748b', marginTop:4 }}>
              {selection.target ? `Mục tiêu: ${selection.target.name.replace('Trọng tâm: ','')}` : 'Hãy chọn 1 mục tiêu sức khỏe để bắt đầu'}
            </p>
            {organVideo && (
              <button
                type="button"
                onClick={() => setShowOrganVideo(true)}
                style={{
                  marginTop:8, display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
                  padding:'6px 14px', borderRadius:999, border:'1px solid #c7d2fe', background:'#eef2ff',
                  color:'#4338ca', fontSize:12, fontWeight:800,
                }}
              >
                🔄 Lật thẻ · Xem video "{organVideo.title}"
              </button>
            )}
          </div>

          {/* Plate */}
          <div className="oc-plate-wrap" style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', width:'100%', maxWidth:500, height:420 }}>
            <div className="oc-plate-circle" id="main-plate" style={{ width:360, height:360, borderRadius:'50%', background:'#fff', border:'18px solid #f8fafc', boxShadow:'0 25px 50px -12px rgba(0,0,0,0.25)', position:'relative', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.7s ease', transform: selection.avoid ? 'scale(0.92) translateX(-20px)' : 'scale(1) translateX(0)' }}>
              <div style={{ position:'absolute', width:'100%', height:2, background:'#f1f5f9', top:'50%', left:0, transform:'translateY(-50%)' }} />
              <div style={{ position:'absolute', height:'100%', width:2, background:'#f1f5f9', left:'50%', top:0, transform:'translateX(-50%)' }} />
              <div id="plate-base"    className="plate-item" style={{ top:'38%', left:'32%', fontSize:75 }} />
              <div id="plate-veg"     className="plate-item" style={{ top:'62%', left:'68%', fontSize:75 }} />
              <div id="plate-protein" className="plate-item" style={{ top:'32%', left:'68%', fontSize:75 }} />
              <div id="plate-top"     className="plate-item" style={{ top:'50%', left:'50%', fontSize:65 }} />
            </div>

            {/* Hazard */}
            <div style={{ position:'absolute', bottom:16, right:24, display:'flex', flexDirection:'column', alignItems:'center' }}>
              <div className={`oc-hazard-emoji${selection.avoid ? ' hazard-active' : ''}`} style={{ fontSize:70, transform: selection.avoid ? 'scale(1)' : 'scale(0)', opacity: selection.avoid ? 1 : 0, transition:'all 0.5s ease', userSelect:'none' }}>
                {selection.avoid?.emoji || '🍺'}
              </div>
              <span style={{ fontSize:10, fontWeight:900, background:'#dc2626', color:'#fff', padding:'2px 8px', borderRadius:999, marginTop:4, opacity: selection.avoid ? 1 : 0, transition:'opacity 0.3s' }}>CHẤT PHÁ HOẠI</span>
            </div>
          </div>

          <div style={{ fontSize:12, fontWeight:600, color:'#94a3b8' }}>
            Gợi ý: Thử chọn <span style={{ color:'#4f46e5', fontWeight:700 }}>Mục tiêu Gan</span> + <span style={{ color:'#059669', fontWeight:700 }}>Bông cải</span> + <span style={{ color:'#dc2626', fontWeight:700 }}>Bia</span> để xem AI phản ứng.
          </div>

          {/* AI card — đã chuyển xuống đây (dưới vùng gợi ý), thay vì nằm bên cột phân tích bên phải */}
          <div style={{ width:'100%', maxWidth:500, background:'#fff', border: selection.avoid?.id === 'bia' && selection.target?.organKey === 'liver' ? '1px solid #ef4444' : '1px solid #e2e8f0', borderRadius:16, padding:12, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:18 }}>💬</span>
                <span style={{ fontSize:12, fontWeight:900, color:'#0f172a', textTransform:'uppercase', letterSpacing:'0.05em' }}>Bác sĩ Dinh Dưỡng AI:</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAIChat(v => !v)}
                style={{ fontSize:11, fontWeight:800, color:'#4f46e5', background:'#eef2ff', border:'1px solid #c7d2fe', borderRadius:999, padding:'4px 10px', cursor:'pointer', flexShrink:0 }}
              >
                {showAIChat ? '✕ Đóng chat' : '🤗 Chat ngay'}
              </button>
            </div>
            <div style={{ fontSize:13, color:'#475569', lineHeight:1.6, fontStyle:'italic' }} dangerouslySetInnerHTML={{ __html: aiMsg }} />
          </div>
        </main>

        {/* Chat thật với Bác sĩ Dinh Dưỡng AI — modal nổi lên trên, dùng chung Global AI Chat, đồng bộ lịch sử.
            Render qua createPortal thẳng vào document.body để chắc chắn không bị ancestor nào
            (overflow:hidden, stacking context, z-index cục bộ...) che mất hoặc cắt cụt. */}
        {showAIChat && createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Bác sĩ Dinh Dưỡng AI"
            onClick={(e) => { if (e.target === e.currentTarget) setShowAIChat(false) }}
            style={{ position:'fixed', inset:0, zIndex:99999, background:'rgba(15,23,42,0.55)', display:'flex', alignItems:'center', justifyContent:'center', padding:12, overflowY:'auto' }}
          >
            <div style={{ width:'100%', maxWidth:480, maxHeight:'calc(100vh - 24px)', display:'flex' }}>
              <NutritionAIChatView onClose={() => setShowAIChat(false)} />
            </div>
          </div>,
          document.body
        )}

        {/* FULL-SCREEN FLIP: organ guidance video (always opens at full viewport height) */}
        {showOrganVideo && organVideo && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={organVideo.title}
            style={{
              position:'fixed', inset:0, width:'100vw', height:'100vh', zIndex:2000,
              background:'rgba(10,12,24,0.97)', display:'flex', flexDirection:'column',
              animation:'ocVideoFlipIn 0.32s ease',
            }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, padding:'14px 20px', flexShrink:0, flexWrap:'wrap' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ fontSize:24 }}>{organVideo.emoji}</span>
                <span style={{ fontSize:16, fontWeight:900, color:'#fff' }}>{organVideo.title}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowOrganVideo(false)}
                style={{
                  display:'flex', alignItems:'center', gap:6, cursor:'pointer',
                  padding:'8px 16px', borderRadius:999, border:'1px solid rgba(255,255,255,0.25)',
                  background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:13, fontWeight:800,
                }}
              >
                🔄 Lật thẻ · Về Mâm Cơm Thần Kỳ
              </button>
            </div>
            <div style={{ flex:1, minHeight:0, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 12px 16px' }}>
              <div style={{ position:'relative', height:'100%', maxHeight:'calc(100vh - 76px)', width:'auto', aspectRatio:'9/16', maxWidth:'100%', borderRadius:16, overflow:'hidden', background:'#000', boxShadow:'0 25px 60px -15px rgba(0,0,0,0.6)' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${organVideo.id}${organVideo.start ? `?start=${organVideo.start}` : ''}`}
                  title={organVideo.title}
                  style={{ position:'absolute', inset:0, width:'100%', height:'100%', border:0 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: Analytics */}
        <aside className="oc-aside-right">
          {/* Score bars */}
          <div style={{ padding:12, borderBottom:'1px solid #f1f5f9', background:'#f8fafc', flexShrink:0 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, fontWeight:900, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.1em' }}>Hệ thống đo lường</span>
                <span className="oc-header-badge" style={{ background:'#0f172a', color:'#fff', padding:'4px 10px', borderRadius:10, fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:6 }}>⚡ 46 Bio-Ingredients</span>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:4, background:'#dcfce7', color:'#166534', display:'flex', alignItems:'center', gap:4 }}>
                <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', animation:'pulse 2s infinite', display:'inline-block' }} /> Phản ứng nội tạng
              </span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { key:'liver',   label:'Giải độc Gan',      icon: <img src={organLiverUrl} style={{width:16,height:16,objectFit:'contain'}} alt=""/>, color:'#f59e0b' },
                { key:'kidney',  label:'Lọc Thận & Niệu',   icon:'💧', color:'#38bdf8' },
                { key:'heart',   label:'Máu & Tim mạch',    icon:'❤️', color:'#ef4444' },
                { key:'stomach', label:'Niêm mạc Dạ dày',   icon:'🦠', color:'#10b981' },
                { key:'brain',   label:'Thần kinh & Não',   icon:'🧠', color:'#a855f7' },
                { key:'lungs',   label:'Hô hấp & Phổi',     icon:'🌬️', color:'#06b6d4' },
              ].map(({ key, label, icon, color }) => {
                const v = scores[key] || 0
                const isNeg = v < 0
                const isTarget = targetOrgan === key
                return (
                  <OrganAnatomyHoverWrap key={key} organKey={key}>
                    <div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:700, marginBottom:4, color:'#334155' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:6, ...(isTarget ? { padding:'0 4px', borderRadius:4, background:'#fef3c7' } : {}) }}>
                          {typeof icon === 'string' ? icon : icon} {label}{isTarget ? ' ⭐' : ''}
                        </span>
                        <span style={{ fontFamily:'monospace', color: isNeg ? '#dc2626' : '#94a3b8', fontWeight:600, ...(isNeg ? { animation:'pulse 1s infinite' } : {}) }}>
                          {v}/10{isNeg ? ' ⚠️' : ''}
                        </span>
                      </div>
                      <div style={{ height:8, width:'100%', background:'#e2e8f0', borderRadius:999, overflow:'hidden', padding:2, ...(isTarget ? { ring:'2px solid #fbbf24' } : {}) }}>
                        <div className="oc-progress" style={{ height:'100%', borderRadius:999, background: isNeg ? '#b91c1c' : color, width: isNeg ? '100%' : `${v * 10}%` }} />
                      </div>
                    </div>
                  </OrganAnatomyHoverWrap>
                )
              })}
            </div>
          </div>

          {/* Bottom: AI + receipt */}
          <div className="oc-scroll" style={{ flex:1, overflowY:'auto', padding:12, display:'flex', flexDirection:'column', gap:12, background:'rgba(241,245,249,0.6)' }}>
            {/* Receipt */}
            <div className="receipt-paper" style={{ border:'1px solid #e2e8f0', borderRadius:12, padding:12, fontFamily:'monospace', fontSize:12, color:'#334155', position:'relative' }}>
              <div style={{ position:'absolute', top:-12, right:16, background:'#065f46', color:'#fff', fontWeight:900, fontSize:10, padding:'2px 8px', borderRadius:999, textTransform:'uppercase', letterSpacing:'0.1em' }}>Custom Formula</div>
              <div style={{ textAlign:'center', paddingBottom:8, borderBottom:'2px dashed #cbd5e1' }}>
                <div style={{ fontWeight:900, fontSize:14, color:'#0f172a' }}>CÔNG THỨC NỘI TẠNG</div>
                <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>Mã mâm cơm: #BIO-2026</div>
              </div>
              <div style={{ padding:'8px 0', borderBottom:'2px dashed #cbd5e1', display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}><span style={{ color:'#94a3b8' }}>Trọng tâm:</span> <strong style={{ color:'#4f46e5' }}>{selection.target ? selection.target.name.replace('Trọng tâm: ','').replace(/^[❤️💧🧠🌬️🦠]/,'').trim() : 'Chưa đặt'}</strong></div>
              </div>
              <div style={{ padding:'8px 0', borderBottom:'2px dashed #cbd5e1', display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', marginBottom:2 }}>THÀNH PHẦN LẮP GHÉP:</div>
                {[['Nền','base'],['Đạm','protein'],['Rau','veg'],['Super','top']].map(([l,k]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}><span style={{ color:'#64748b' }}>{l}:</span> <strong>{selection[k]?.name || '---'}</strong></div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color: selection.avoid ? '#dc2626' : undefined }}>
                  <span style={{ color:'#fca5a5' }}>Phá hoại:</span>
                  <span style={{ fontWeight: selection.avoid ? 900 : 400, background: selection.avoid ? '#fee2e2' : undefined, padding: selection.avoid ? '0 4px' : undefined, borderRadius: selection.avoid ? 4 : undefined }}>
                    {selection.avoid ? `+ ${selection.avoid.name}` : 'Không có'}
                  </span>
                </div>
              </div>
              <div style={{ paddingTop:8, textAlign:'center', fontSize:11, color:'#94a3b8' }}>
                "Uống/Ăn có trách nhiệm với từng tế bào"
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modals */}
      <OrganMapModal open={showOrganMap} onClose={() => setShowOrganMap(false)} selection={selection} />
      <ResultModal open={showResult} onClose={() => setShowResult(false)} scores={scores} hasItem={hasItem} selection={selection} />
      <HealthCardModal open={showHealthCard} onClose={() => setShowHealthCard(false)} scores={scores} hasItem={hasItem} selection={selection} />
    </div>

    {/* Playlist video gợi ý — nằm dưới cùng của trang, cuộn xuống để xem.
        Nhúng bằng YouTube IFrame Player API thật (giống hệt playlist bên khu RSS):
        có danh sách video thật của playlist để bấm chuyển bài, không cần API key. */}
    <div style={{ padding: 'clamp(16px,3vw,28px) clamp(12px,3vw,24px) 24px', background: isDark ? '#0a0d1a' : '#f8fafc' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 800, color: isDark ? '#e2e8f0' : '#0f172a' }}>
          🎬 Playlist gợi ý: Kiến Thức Sức Khỏe 3D
        </h3>
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)', background: '#000' }}>
          <div ref={ytPlaylistContainerRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Danh sách video trong playlist{playlistVideos.length > 0 ? ` (${playlistVideos.length})` : ''}
            </span>
            {playlistLoading && <span style={{ fontSize: 10, color: isDark ? '#64748b' : '#94a3b8' }}>Đang tải…</span>}
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4 }}>
            {playlistVideos.map((v, i) => (
              <button
                key={v.id}
                type="button"
                onClick={() => playPlaylistVideoAt(i)}
                title={v.title}
                style={{
                  display: 'flex', flexDirection: 'column', width: 150, flexShrink: 0, textAlign: 'left',
                  background: playlistActiveId === v.id ? 'rgba(79,70,229,0.08)' : (isDark ? 'rgba(255,255,255,0.04)' : '#fff'),
                  border: `1px solid ${playlistActiveId === v.id ? '#4f46e5' : (isDark ? 'rgba(255,255,255,0.09)' : '#e2e8f0')}`,
                  borderRadius: 10, overflow: 'hidden', cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                }}
              >
                <img
                  src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`}
                  alt={v.title}
                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block', background: '#111' }}
                />
                <div style={{
                  padding: '6px 8px 8px', fontSize: 11, fontWeight: 700, lineHeight: 1.3,
                  color: playlistActiveId === v.id ? '#4f46e5' : (isDark ? '#e2e8f0' : '#0f172a'),
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {v.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>

    <AnatomyHoverOverlayRightPanel isDark={isDark} scores={scores} selection={selection} />

    {/* Nav bar — luôn ở dưới cùng của toàn trang */}
    <div className="organ-nav-bar">
      <NavButtons onPrev={onPrev} prevLabel={prevLabel} onNext={onNext} nextLabel={nextLabel} />
    </div>
    </>
  )
}

// ─── ItemButton ───────────────────────────────────────────────────────────────
function ItemButton({ cat, item, selection, onSelect }) {
  const isSelected = selection[cat]?.id === item.id
  const isHazard = cat === 'avoid'
  const isTarget = cat === 'target'

  let borderColor = '#e2e8f0'
  let bg = '#fff'
  if (isSelected) {
    if (isTarget)  { borderColor = '#4f46e5'; bg = '#eef2ff' }
    else if (isHazard) { borderColor = '#dc2626'; bg = '#fff1f2' }
    else           { borderColor = '#10b981'; bg = '#f0fdf4' }
  }

  const button = (
    <button
      onClick={() => onSelect(cat, item.id)}
      style={{ width:'100%', textAlign:'left', padding:6, border:`2px solid ${borderColor}`, borderRadius:12, transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'space-between', background:bg, cursor:'pointer' }}
    >
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <span style={{ width:32, height:32, background:'#f8fafc', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:8, fontSize:20, flexShrink:0 }}>
          {item.img ? <img src={item.img} style={{ width:28, height:28, objectFit:'contain' }} alt="" /> : item.emoji}
        </span>
        <div>
          <div style={{ fontWeight:700, fontSize:13, color: isHazard ? '#be123c' : '#0f172a' }}>{item.name}</div>
          <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{item.desc || item.tag}</div>
        </div>
      </div>
      {!isTarget && !isHazard && (
        <div style={{ fontSize:10, fontFamily:'monospace', background:'#f1f5f9', padding:'2px 6px', borderRadius:4, color:'#64748b', whiteSpace:'nowrap', opacity: isSelected ? 1 : 0 }}>
          🟤{item.liver} 💧{item.kidney}
        </div>
      )}
    </button>
  )

  return button
}
