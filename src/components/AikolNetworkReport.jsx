// src/components/AikolNetworkReport.jsx
// Báo cáo tương tác "AIKOL Network" (7 tab) viết bằng React thuần:
// - đồng bộ theme tối/sáng của landing (prop `isDark` + class `dark:`),
// - song ngữ vi/en (src/i18n/aikolReportI18n.js),
// - biểu đồ dùng chart.js + react-chartjs-2.
// Các mô phỏng chỉ mang tính minh họa cơ chế, KHÔNG phải dữ liệu thị trường thực.
import React, { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { ExternalLink } from 'lucide-react'
import { getAikolReportT } from '../i18n/aikolReportI18n.js'
import { AIKOL_TOKEN_ADDRESS } from './AikolTokenBanner.jsx'

ChartJS.register(ArcElement, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

const TAB_KEYS = ['overview', 'viction', 'pumpfun', 'sybil', 'engine', 'tunecore', 'mica']
const TAB_ICONS = { overview: '📊', viction: '⚡', pumpfun: '🚀', sybil: '🛡️', engine: '🔬', tunecore: '💎', mica: '⚖️' }
const PALETTE = ['#4B6BFF', '#10b981', '#f59e0b', '#64748b', '#FF543C']
const LAYER_WEIGHTS = [10, 20, 25, 15, 30]
const REPORT_SITE_URL = 'https://hienmaunhanvan.com'
const fmt = (n) => Number(n).toLocaleString('en-US')

/* ───────────── helpers ───────────── */

// **đậm**  `mã`  //nghiêng//
function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\/\/[^/]+\/\/)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) {
          return <strong key={i} className="font-bold text-gray-900 dark:text-gray-100">{p.slice(2, -2)}</strong>
        }
        if (p.startsWith('`') && p.endsWith('`') && p.length > 2) {
          return (
            <code key={i} className="px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-white/10 text-[0.85em] font-mono break-words text-gray-800 dark:text-gray-100">
              {p.slice(1, -1)}
            </code>
          )
        }
        if (p.startsWith('//') && p.endsWith('//') && p.length > 4) return <em key={i}>{p.slice(2, -2)}</em>
        return <React.Fragment key={i}>{p}</React.Fragment>
      })}
    </>
  )
}

function Card({ className = '', children }) {
  return <div className={`bg-white dark:bg-[#141b2e] rounded-3xl zofo-shadow-soft p-6 md:p-8 ${className}`}>{children}</div>
}

function PanelHeader({ eyebrow, title, intro }) {
  return (
    <div className="max-w-3xl">
      <div className="inline-block border border-[#8B4DFF] text-[#8B4DFF] font-semibold text-xs rounded-full px-4 py-1 tracking-wide mb-3">
        {eyebrow}
      </div>
      <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-50 leading-tight mb-3">{title}</h3>
      <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed"><Rich text={intro} /></p>
    </div>
  )
}

function SimNote({ children }) {
  return <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-3">{children}</p>
}

function CodeBlock({ lines }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] sm:text-xs p-4 space-y-1 overflow-x-auto">
      {lines.map((line, i) => {
        if (line.startsWith('//')) return <p key={i} className="text-emerald-400 whitespace-pre">{line}</p>
        const slot = line.match(/^(slot \d+:)(.*)$/)
        if (slot) {
          return (
            <p key={i} className="whitespace-pre"><span className="text-pink-400">{slot[1]}</span>{slot[2]}</p>
          )
        }
        return <p key={i} className="whitespace-pre">{line}</p>
      })}
    </div>
  )
}

/* ───────────── main component ───────────── */

export default function AikolNetworkReport({ t, language = 'vi', isDark = false }) {
  const r = useMemo(() => getAikolReportT(language), [language])
  const p = t.aikol.page

  const [tab, setTab] = useState('overview')
  // Trạng thái các mô phỏng được giữ ở đây để không bị reset khi đổi tab
  const [sol, setSol] = useState(15)
  const [sybilFlags, setSybilFlags] = useState([false, false, false, true])
  const [scores, setScores] = useState([85, 90, 88, 75, 92])
  const [revenue, setRevenue] = useState('10000')
  const [stream, setStream] = useState('secondary')

  /* ── màu chart theo theme ── */
  const ink = isDark ? '#cbd5e1' : '#475569'
  const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'
  const sliceBorder = isDark ? '#141b2e' : '#ffffff'
  const legendLabels = { color: ink, font: { size: 11 }, boxWidth: 12, padding: 14 }

  /* ── 1. Tokenomics ── */
  const tokenomicsData = {
    labels: r.overview.chartLabels,
    datasets: [{ data: [35, 30, 15, 10, 10], backgroundColor: PALETTE, borderWidth: 2, borderColor: sliceBorder }],
  }
  const tokenomicsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: { position: 'bottom', labels: legendLabels },
      tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.raw}% ( ${c.raw * 10}M $AIKOL )` } },
    },
  }

  /* ── 2. Bonding curve ── */
  const ratio = sol / 85
  const marketCap = Math.round(5000 + ratio * 64000)
  const tokenPrice = (0.000005 + ratio ** 2 * 0.00008).toFixed(7)
  const remainingTokens = Math.round(800000000 - ratio * 600000000)
  let bondingStage = 'launch'
  if (sol >= 85) bondingStage = 'graduated'
  else if (sol >= 50) bondingStage = 'near'
  else if (sol >= 25) bondingStage = 'mid'
  const bondingBadge = {
    launch: 'bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200',
    mid: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    near: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
    graduated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  }[bondingStage]
  const lpText = bondingStage === 'graduated' ? r.pumpfun.lp.burned : bondingStage === 'near' ? r.pumpfun.lp.unlockedNew : r.pumpfun.lp.unlocked
  const lpColor = bondingStage === 'graduated' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'

  const curvePoints = useMemo(() => {
    const labels = []
    const prices = []
    for (let s = 0; s <= 85; s += 5) {
      labels.push(`${s} SOL`)
      prices.push(0.000005 + (s / 85) ** 2 * 0.00008)
    }
    return { labels, prices }
  }, [])
  const activeIdx = Math.min(Math.round(sol / 5), curvePoints.prices.length - 1)
  const bondingData = {
    labels: curvePoints.labels,
    datasets: [
      {
        label: r.pumpfun.chartDataset,
        data: curvePoints.prices,
        borderColor: '#4B6BFF',
        backgroundColor: 'rgba(75,107,255,0.10)',
        fill: true,
        tension: 0.4,
        pointRadius: curvePoints.prices.map((_, i) => (i === activeIdx ? 8 : 3)),
        pointBackgroundColor: curvePoints.prices.map((_, i) => (i === activeIdx ? '#FF543C' : '#4B6BFF')),
        pointHoverRadius: 7,
      },
    ],
  }
  const bondingOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: ink, font: { size: 10 } } },
      y: { grid: { color: grid }, ticks: { color: ink, font: { size: 10 }, callback: (v) => Number(v).toFixed(6) } },
    },
    plugins: { legend: { display: false } },
  }

  /* ── 3. Sybil ── */
  let sybilScore = 0
  if (sybilFlags[0]) sybilScore += 40
  if (sybilFlags[1]) sybilScore += 30
  if (sybilFlags[2]) sybilScore += 25
  if (sybilFlags[3]) sybilScore -= 20
  sybilScore = Math.max(0, Math.min(100, sybilScore))
  const sybilRisky = sybilScore > 50

  /* ── 4. Quint-Engine ── */
  const quintTotal = scores.reduce((sum, v, i) => sum + (v * LAYER_WEIGHTS[i]) / 100, 0)
  const quintLevel = quintTotal >= 85 ? 'master' : quintTotal >= 70 ? 'standard' : 'below'
  const quintBadgeClass = {
    master: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    standard: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    below: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
  }[quintLevel]
  const quintData = {
    labels: LAYER_WEIGHTS.map((w, i) => `Layer ${i + 1} (${w}%)`),
    datasets: [{ label: r.engine.chartDataset, data: scores, backgroundColor: '#4B6BFF', borderRadius: 6 }],
  }
  const quintOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    scales: {
      x: { min: 0, max: 100, grid: { color: grid }, ticks: { color: ink, font: { size: 10 } } },
      y: { grid: { display: false }, ticks: { color: ink, font: { size: 10 } } },
    },
    plugins: { legend: { display: false } },
  }

  /* ── 5. TuneCore ── */
  const revenueNum = Math.max(0, parseFloat(revenue) || 0)
  const SPLITS = { secondary: [25, 60, 10, 5], primary: [85, 0, 10, 5], microsync: [30, 50, 20, 0] }
  const split = SPLITS[stream]
  const splitValues = split.map((pc) => (revenueNum * pc) / 100)
  const tuneData = {
    labels: [r.tunecore.chartCategory],
    datasets: r.tunecore.datasets.map((label, i) => ({
      label,
      data: [splitValues[i]],
      backgroundColor: ['#4B6BFF', '#10b981', isDark ? '#94a3b8' : '#1e293b', '#f59e0b'][i],
    })),
  }
  const tuneOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { color: ink, font: { size: 10 } } },
      y: { stacked: true, grid: { color: grid }, ticks: { color: ink, font: { size: 10 } } },
    },
    plugins: { legend: { position: 'bottom', labels: legendLabels } },
  }
  const shareColors = ['text-[#4B6BFF]', 'text-emerald-600 dark:text-emerald-400', 'text-gray-900 dark:text-gray-100', 'text-amber-600 dark:text-amber-400']

  const rangeCls = 'w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-white/15 accent-[#4B6BFF]'

  /* ───────────── render ───────────── */
  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#4B6BFF] mb-1">{p.reportEyebrow}</div>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-50">{p.reportTitle}</h2>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label={p.reportTitle} className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-1 px-1">
        {TAB_KEYS.map((k) => {
          const active = tab === k
          return (
            <button
              key={k}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(k)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1.5 transition-all border ${
                active
                  ? 'zofo-gradient-brand text-white border-transparent shadow-lg'
                  : 'bg-white dark:bg-[#141b2e] text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <span aria-hidden="true">{TAB_ICONS[k]}</span> {r.tabs[k]}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="space-y-8">
        {/* ═══ 1. OVERVIEW ═══ */}
        {tab === 'overview' && (
          <>
            <Card className="!bg-[#0B132B] dark:!bg-[#0B132B] border border-white/10 text-white relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(120deg, rgba(75,107,255,0.25), rgba(139,77,255,0.20))' }} />
              <div className="relative z-10 max-w-3xl">
                <span className="inline-block border border-white/30 text-gray-200 text-xs font-semibold rounded-full px-4 py-1 mb-4">{r.overview.badge}</span>
                <h3 className="text-2xl md:text-4xl font-black leading-tight mb-3">{r.overview.title}</h3>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed mb-4">
                  {r.overview.intro.split(/(`[^`]+`)/g).map((part, i) =>
                    part.startsWith('`') ? (
                      <code key={i} className="px-1.5 py-0.5 rounded-md bg-white/10 text-[0.85em] font-mono text-white">{part.slice(1, -1)}</code>
                    ) : (
                      <React.Fragment key={i}>{part}</React.Fragment>
                    )
                  )}
                </p>
                <a href={REPORT_SITE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-cyan-200 hover:underline">
                  {r.common.reportSite} <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {r.overview.metrics.map((m) => (
                <Card key={m.label} className="!p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{m.label}</span>
                    <span className="text-xl" aria-hidden="true">{m.icon}</span>
                  </div>
                  <p className="text-xl md:text-2xl font-black text-gray-900 dark:text-gray-50 break-words">{m.value}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.sub}</p>
                </Card>
              ))}
            </div>

            <Card>
              <h4 className="text-xl font-black text-gray-900 dark:text-gray-50 mb-2">{r.overview.modelTitle}</h4>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed max-w-4xl mb-8">{r.overview.modelText}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-gray-50 mb-3">{r.overview.chartTitle}</h5>
                  <div className="relative h-72 md:h-80">
                    <Doughnut data={tokenomicsData} options={tokenomicsOptions} />
                  </div>
                </div>
                <div>
                  <h5 className="font-bold text-gray-900 dark:text-gray-50 mb-3">{r.overview.detailTitle}</h5>
                  <div className="space-y-3">
                    {r.overview.funds.map((f, i) => (
                      <div key={f.name} className="flex items-start justify-between gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-3">
                        <div className="flex gap-3">
                          <span className="mt-1.5 w-3 h-3 rounded-full shrink-0" style={{ background: PALETTE[i] }} />
                          <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-gray-50">{f.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.desc}</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#4B6BFF] whitespace-nowrap">{f.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ═══ 2. VICTION ═══ */}
        {tab === 'viction' && (
          <>
            <PanelHeader eyebrow={r.viction.eyebrow} title={r.viction.title} intro={r.viction.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {r.viction.cards.map((c) => (
                <Card key={c.title} className="flex flex-col justify-between !p-6">
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-2xl mb-4" aria-hidden="true">{c.icon}</div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{c.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"><Rich text={c.desc} /></p>
                    <CodeBlock lines={c.code} />
                  </div>
                  <div className="mt-4 text-xs font-semibold text-[#4B6BFF] bg-blue-50 dark:bg-blue-500/10 rounded-xl px-3 py-2">{c.note}</div>
                </Card>
              ))}
            </div>
            <Card>
              <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-5"><span aria-hidden="true">🔄</span> {r.viction.flowTitle}</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {r.viction.steps.map((s, i) => (
                  <div key={s.title} className="rounded-2xl border border-gray-100 dark:border-white/10 p-4">
                    <div className="text-xs font-bold text-[#8B4DFF] mb-1">{r.viction.stepWord} {i + 1}</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-50 mb-1">{s.title}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ═══ 3. PUMP.FUN ═══ */}
        {tab === 'pumpfun' && (
          <>
            <PanelHeader
              eyebrow={r.pumpfun.eyebrow}
              title={r.pumpfun.title}
              intro={r.pumpfun.intro.replace('{address}', AIKOL_TOKEN_ADDRESS)}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="flex items-center justify-between gap-2 mb-5">
                  <h4 className="font-bold text-gray-900 dark:text-gray-50">{r.pumpfun.panelTitle}</h4>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${bondingBadge}`}>{r.pumpfun.status[bondingStage]}</span>
                </div>
                <div className="mb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <label htmlFor="aikol-sol-slider" className="font-semibold text-gray-700 dark:text-gray-200">{r.pumpfun.sliderLabel}</label>
                    <span className="font-extrabold text-[#4B6BFF]">{sol.toFixed(1)} SOL</span>
                  </div>
                  <input id="aikol-sol-slider" type="range" min="0" max="85" step="0.5" value={sol} onChange={(e) => setSol(parseFloat(e.target.value))} className={rangeCls} />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    {r.pumpfun.marks.map((m) => <span key={m}>{m}</span>)}
                  </div>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">{r.pumpfun.marketCap}</dt><dd className="font-extrabold text-gray-900 dark:text-gray-50">${fmt(marketCap)} USD</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">{r.pumpfun.tokenPrice}</dt><dd className="font-extrabold text-[#4B6BFF]">{tokenPrice} SOL</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">{r.pumpfun.virtualTokens}</dt><dd className="font-extrabold text-gray-900 dark:text-gray-50">{fmt(remainingTokens)}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-gray-500 dark:text-gray-400">{r.pumpfun.lpLabel}</dt><dd className={`font-bold text-right ${lpColor}`}>{lpText}</dd></div>
                </dl>
                <div className="mt-5 text-xs leading-relaxed bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 rounded-2xl p-3">
                  <Rich text={r.pumpfun.note} />
                </div>
                <SimNote>{r.common.simNote}</SimNote>
              </Card>
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-4">{r.pumpfun.chartTitle}</h4>
                <div className="relative h-72 md:h-80">
                  <Line data={bondingData} options={bondingOptions} />
                </div>
              </Card>
            </div>
            <Card className="!p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm min-w-[560px]">
                  <thead className="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                    <tr>{r.pumpfun.tableHead.map((h) => <th key={h} className="px-5 py-3 font-bold">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/10 text-gray-700 dark:text-gray-300">
                    {r.pumpfun.rows.map((row) => (
                      <tr key={row[0]}>
                        <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-50">{row[0]}</td>
                        <td className="px-5 py-3 whitespace-nowrap">{row[1]}</td>
                        <td className="px-5 py-3">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ═══ 4. SYBIL ═══ */}
        {tab === 'sybil' && (
          <>
            <PanelHeader eyebrow={r.sybil.eyebrow} title={r.sybil.title} intro={r.sybil.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2"><span aria-hidden="true">🛡️</span> {r.sybil.checklistTitle}</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{r.sybil.checklistIntro}</p>
                <div className="space-y-3">
                  {r.sybil.criteria.map((c, i) => (
                    <label key={c.label} className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-white/10 p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        checked={sybilFlags[i]}
                        onChange={() => setSybilFlags((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                        className="mt-1 w-4 h-4 accent-[#4B6BFF]"
                      />
                      <div>
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-50">{c.label}</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{c.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-200">{r.sybil.scoreLabel}</span>
                    <span className={`font-extrabold ${sybilRisky ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {sybilScore}% ({sybilRisky ? r.sybil.verdictRisk : r.sybil.verdictSafe})
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-white/15 overflow-hidden">
                    <div className={`h-2.5 rounded-full transition-all duration-300 ${sybilRisky ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${sybilScore}%` }} />
                  </div>
                  <p className={`text-xs font-semibold mt-2 ${sybilRisky ? 'text-rose-700 dark:text-rose-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                    {sybilRisky ? r.sybil.statusRisk : r.sybil.statusSafe}
                  </p>
                </div>
                <SimNote>{r.common.simNote}</SimNote>
              </Card>

              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2"><span aria-hidden="true">🌳</span> {r.sybil.merkleTitle}</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed"><Rich text={r.sybil.merkleIntro} /></p>
                <div className="mt-4 rounded-2xl bg-slate-900 text-slate-200 font-mono text-[11px] sm:text-xs p-4 overflow-x-auto leading-relaxed">
                  <div className="text-emerald-400 whitespace-pre">{r.sybil.merkleComment}</div>
                  <div className="whitespace-pre"><span className="text-pink-400">function</span> <span className="text-sky-300">claimAirdrop</span>(bytes32[] calldata proof, uint256 amount) <span className="text-pink-400">external</span> {'{'}</div>
                  <div className="whitespace-pre pl-4">bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));</div>
                  <div className="whitespace-pre pl-4">require(MerkleProof.verify(proof, merkleRoot, leaf), <span className="text-amber-300">"Invalid Proof"</span>);</div>
                  <div className="whitespace-pre pl-4">require(!hasClaimed[msg.sender], <span className="text-amber-300">"Already Claimed"</span>);</div>
                  <div className="whitespace-pre pl-4">hasClaimed[msg.sender] = true;</div>
                  <div className="whitespace-pre pl-4">_transferTokensToERC6551Account(msg.sender, amount);</div>
                  <div>{'}'}</div>
                </div>
                <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
                  {r.sybil.bullets.map((b) => <li key={b}><Rich text={b} /></li>)}
                </ul>
              </Card>
            </div>
          </>
        )}

        {/* ═══ 5. QUINT-ENGINE ═══ */}
        {tab === 'engine' && (
          <>
            <PanelHeader eyebrow={r.engine.eyebrow} title={r.engine.title} intro={r.engine.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-5">{r.engine.slidersTitle}</h4>
                <div className="space-y-5">
                  {r.engine.layers.map((l, i) => (
                    <div key={l.name}>
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <label htmlFor={`aikol-layer-${i}`} className="font-semibold text-gray-700 dark:text-gray-200">
                          {l.name} <span className="text-gray-400 font-normal">(w{i + 1} = {LAYER_WEIGHTS[i]}%)</span>
                        </label>
                        <span className="font-mono font-bold text-[#4B6BFF]">{scores[i]} {r.common.points}</span>
                      </div>
                      <input
                        id={`aikol-layer-${i}`}
                        type="range"
                        min="0"
                        max="100"
                        value={scores[i]}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value)
                          setScores((prev) => prev.map((x, j) => (j === i ? v : x)))
                        }}
                        className={rangeCls}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{l.desc}</p>
                    </div>
                  ))}
                </div>
                <SimNote>{r.common.simNote}</SimNote>
              </Card>
              <div className="space-y-6">
                <Card>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{r.engine.totalLabel}</span>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-extrabold ${quintBadgeClass}`}>{r.engine.badges[quintLevel]}</span>
                  </div>
                  <p className="text-4xl font-extrabold text-[#4B6BFF]">
                    {quintTotal.toFixed(2)} <span className="text-lg text-gray-400 font-normal">/ 100</span>
                  </p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-gray-300 leading-relaxed mt-3"><Rich text={r.engine.descs[quintLevel]} /></p>
                </Card>
                <Card>
                  <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-3">{r.engine.chartTitle}</h4>
                  <div className="relative h-64">
                    <Bar data={quintData} options={quintOptions} />
                  </div>
                </Card>
              </div>
            </div>
          </>
        )}

        {/* ═══ 6. TUNECORE ═══ */}
        {tab === 'tunecore' && (
          <>
            <PanelHeader eyebrow={r.tunecore.eyebrow} title={r.tunecore.title} intro={r.tunecore.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-5">{r.tunecore.calcTitle}</h4>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="aikol-revenue" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{r.tunecore.revenueLabel}</label>
                    <input
                      id="aikol-revenue"
                      type="number"
                      min="0"
                      value={revenue}
                      onChange={(e) => setRevenue(e.target.value)}
                      className="w-full p-2.5 rounded-xl font-mono border border-gray-300 dark:border-white/15 bg-white dark:bg-[#0B132B] text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4B6BFF]"
                    />
                  </div>
                  <div>
                    <label htmlFor="aikol-stream" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{r.tunecore.streamLabel}</label>
                    <select
                      id="aikol-stream"
                      value={stream}
                      onChange={(e) => setStream(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-gray-300 dark:border-white/15 bg-white dark:bg-[#0B132B] text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4B6BFF]"
                    >
                      {Object.entries(r.tunecore.streams).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                  </div>
                </div>
                <dl className="mt-6 space-y-3 text-sm">
                  {r.tunecore.shares.map((label, i) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-gray-100 dark:border-white/10 pb-2">
                      <dt className="text-gray-600 dark:text-gray-300">{label}</dt>
                      <dd className={`font-bold ${shareColors[i]}`}>${fmt(splitValues[i])} ({split[i]}%)</dd>
                    </div>
                  ))}
                </dl>
                <SimNote>{r.common.simNote}</SimNote>
              </Card>
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-4">{r.tunecore.chartTitle}</h4>
                <div className="relative h-72 md:h-80">
                  <Bar data={tuneData} options={tuneOptions} />
                </div>
              </Card>
            </div>
            <Card>
              <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-5">{r.tunecore.casesTitle}</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {r.tunecore.cases.map((c) => (
                  <div key={c.tag} className="rounded-2xl border border-gray-100 dark:border-white/10 p-4">
                    <span className="text-xs font-bold text-[#8B4DFF]">{c.tag}</span>
                    <h5 className="text-sm font-bold text-gray-900 dark:text-gray-50 mt-1 mb-2">{c.title}</h5>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{c.desc}</p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* ═══ 7. MICA ═══ */}
        {tab === 'mica' && (
          <>
            <PanelHeader eyebrow={r.mica.eyebrow} title={r.mica.title} intro={r.mica.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-4">{r.mica.classTitle}</h4>
                <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-4">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-semibold text-gray-600 dark:text-gray-300">{r.mica.classLabel}</span>
                    <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200">{r.mica.classValue}</span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{r.mica.classText}</p>
                </div>
              </Card>
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-4">{r.mica.exemptTitle}</h4>
                <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300 list-disc pl-5">
                  {r.mica.exemptions.map((x) => <li key={x}><Rich text={x} /></li>)}
                </ul>
              </Card>
            </div>
            <Card className="!bg-rose-50 dark:!bg-rose-500/10 border border-rose-200 dark:border-rose-500/30">
              <h4 className="font-bold text-rose-800 dark:text-rose-200 mb-2">{r.mica.riskTitle}</h4>
              <p className="text-sm text-rose-900 dark:text-rose-100 leading-relaxed"><Rich text={r.mica.riskText} /></p>
              <p className="text-xs italic text-rose-700 dark:text-rose-300 mt-3">{r.mica.legalNote}</p>
            </Card>
          </>
        )}
      </div>

      <div className="mt-10 text-center text-xs text-gray-500 dark:text-gray-400 space-y-1">
        {r.footer.map((line) => <p key={line}>{line}</p>)}
      </div>
    </section>
  )
}
