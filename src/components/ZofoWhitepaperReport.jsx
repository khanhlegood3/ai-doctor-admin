// src/components/ZofoWhitepaperReport.jsx
// Bạch thư tương tác $ZoFo (5 tab) viết bằng React thuần:
// - đồng bộ theme tối/sáng của landing (prop `isDark` + class `dark:`),
// - song ngữ vi/en (src/i18n/zofoWhitepaperI18n.js),
// - biểu đồ dùng chart.js + react-chartjs-2.
// Các công cụ mô phỏng chỉ mang tính minh họa (giá giả định), KHÔNG phải dữ liệu thị trường thực.
import React, { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Doughnut, Line } from 'react-chartjs-2'
import { ExternalLink, AlertTriangle, Copy, Check } from 'lucide-react'
import { getZofoWhitepaperT, ZOFO_ROW_COLORS } from '../i18n/zofoWhitepaperI18n.js'
import { copyText } from './ZofoTokenBanner.jsx'

ChartJS.register(ArcElement, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Legend, Filler)

const TAB_KEYS = ['vision', 'tokenomics', 'vesting', 'blockchain', 'sandbox']
const TAB_ICONS = { vision: '📘', tokenomics: '💎', vesting: '📈', blockchain: '⚡', sandbox: '🔬' }
const ALLOC_MILLIONS = [250, 200, 250, 100, 100, 70, 30]
const CIRCULATING = [464, 485, 520, 640, 760, 880, 950, 1000]
// Nguồn cung lưu thông tại TGE lấy từ chính dữ liệu biểu đồ (250M Presale + 200M LP + 14M Marketing = 464M)
const INITIAL_CIRCULATING = CIRCULATING[0] * 1000000
const TOTAL_SUPPLY = 1000000000
const REWARD_PER_LESSON = 250
const SITE_URL = 'https://hienmaunhanvan.com/'
// Địa chỉ hợp đồng $ZoFo (BEP-20 theo bạch thư) — checksum EIP-55 hợp lệ
export const ZOFO_BSC_CONTRACT = '0x767004b8C83D0A38605804caBDa6151ED6B8D72b'
const ZOFO_BSCSCAN_URL = `https://bscscan.com/token/${ZOFO_BSC_CONTRACT}`
const LOG_COLORS = ['text-teal-400', 'text-amber-400', 'text-indigo-400', 'text-emerald-400']
const RISK_STYLES = {
  tech: 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/30',
  eco: 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/30',
  ai: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-500/10 dark:border-indigo-500/30',
}
const fmt = (n, opts) => Number(n).toLocaleString('en-US', opts)

/* ───────────── helpers ───────────── */

// **đậm**  `mã`  //nghiêng//
function Rich({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\/\/[^/]+\/\/)/g)
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return <strong key={i} className="font-bold">{p.slice(2, -2)}</strong>
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

function PanelHeader({ badge, title, intro, side }) {
  return (
    <div className="max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-block border border-[#8B4DFF] text-[#8B4DFF] font-semibold text-xs rounded-full px-4 py-1 tracking-wide">{badge}</span>
        {side && <span className="text-xs text-gray-500 dark:text-gray-400">{side}</span>}
      </div>
      <h3 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-50 leading-tight mb-3">{title}</h3>
      <p className="text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed">{intro}</p>
    </div>
  )
}

/* ───────────── main component ───────────── */

export default function ZofoWhitepaperReport({ t, language = 'vi', isDark = false }) {
  const r = useMemo(() => getZofoWhitepaperT(language), [language])
  const p = t.zofo.page

  const [tab, setTab] = useState('vision')
  const [pillar, setPillar] = useState('religion')
  const [price, setPrice] = useState('0.005')
  const [tasks, setTasks] = useState(3)
  const [workoutStep, setWorkoutStep] = useState(1)
  const [riskFilter, setRiskFilter] = useState('all')
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (await copyText(ZOFO_BSC_CONTRACT)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  /* ── màu chart theo theme ── */
  const ink = isDark ? '#cbd5e1' : '#475569'
  const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.07)'
  const sliceBorder = isDark ? '#141b2e' : '#ffffff'
  const legendLabels = { color: ink, font: { size: 10 }, padding: 8, boxWidth: 12 }

  /* ── Tokenomics doughnut ── */
  const allocData = {
    labels: r.tokenomics.chartLabels,
    datasets: [{ data: ALLOC_MILLIONS, backgroundColor: ZOFO_ROW_COLORS, borderWidth: 2, borderColor: sliceBorder }],
  }
  const allocOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { position: 'bottom', labels: legendLabels },
      tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt(c.raw)} ${r.tokenomics.chartUnit}` } },
    },
  }

  /* ── Vesting line ── */
  const vestData = {
    labels: r.vesting.chartLabels,
    datasets: [
      {
        label: r.vesting.chartDataset,
        data: CIRCULATING,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13,148,136,0.12)',
        fill: true,
        tension: 0.3,
        borderWidth: 3,
        pointBackgroundColor: '#0d9488',
      },
    ],
  }
  const vestOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { grid: { display: false }, ticks: { color: ink, font: { size: 10 } } },
      y: { min: 400, max: 1000, grid: { color: grid }, ticks: { color: ink, font: { size: 10 }, callback: (v) => `${v}M` } },
    },
    plugins: { legend: { position: 'top', labels: { ...legendLabels, font: { size: 11 } } } },
  }

  /* ── Yield simulator ── */
  const priceNum = Math.max(0, parseFloat(price) || 0)
  const initialMc = INITIAL_CIRCULATING * priceNum
  const fdv = TOTAL_SUPPLY * priceNum
  const monthlyTokens = tasks * REWARD_PER_LESSON * 30
  const monthlyUsd = monthlyTokens * priceNum
  const perTaskUsd = REWARD_PER_LESSON * priceNum

  const activePillar = r.vision.pillars.find((x) => x.key === pillar) || r.vision.pillars[0]
  const visibleRisks = r.sandbox.risks.filter((x) => riskFilter === 'all' || x.cat === riskFilter)
  const log = r.blockchain.aiLogs[workoutStep - 1]

  const rangeCls = 'w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-gray-200 dark:bg-white/15 accent-[#0d9488]'
  const inputCls =
    'w-full p-2.5 rounded-xl font-mono text-sm border border-gray-300 dark:border-white/15 bg-white dark:bg-[#0B132B] text-gray-900 dark:text-gray-50 focus:outline-none focus:ring-2 focus:ring-[#4B6BFF]'

  return (
    <section className="container mx-auto max-w-7xl px-4 lg:px-8 py-10">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#4B6BFF] mb-1">{p.reportEyebrow}</div>
        <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-50">{p.reportTitle}</h2>
      </div>

      {/* Lưu ý rủi ro */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 mb-5 text-xs md:text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />
        <p><Rich text={r.common.notice} /></p>
      </div>

      {/* Địa chỉ hợp đồng */}
      <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141b2e] p-4 mb-5">
        <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">{r.contract.label}</div>
        <div className="flex flex-col md:flex-row gap-2 md:items-stretch">
          <code className="flex-1 min-w-0 break-all text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-50 bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-3 select-all">
            {ZOFO_BSC_CONTRACT}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? r.contract.copied : r.contract.copy}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 text-xs font-semibold transition py-2.5"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            {copied ? r.contract.copied : r.contract.copy}
          </button>
          <a
            href={ZOFO_BSCSCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-4 rounded-xl bg-[#0B132B] dark:bg-white text-white dark:text-[#0B132B] text-xs font-bold py-2.5 hover:opacity-90 transition"
          >
            {r.contract.view} <ExternalLink className="w-4 h-4" />
          </a>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">{r.contract.hint}</p>
      </div>

      {/* Ticker chỉ số nhanh */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {r.ticker.map((x) => (
          <div key={x.label} className="shrink-0 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-[#141b2e] px-4 py-1.5 text-xs whitespace-nowrap">
            <span className="text-gray-500 dark:text-gray-400">{x.label} </span>
            <span className="font-bold text-gray-900 dark:text-gray-50">{x.value}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label={p.reportTitle} className="flex gap-2 overflow-x-auto pb-3 mb-6 -mx-1 px-1">
        {TAB_KEYS.map((k, i) => {
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
              <span aria-hidden="true">{TAB_ICONS[k]}</span> {i + 1}. {r.tabs[k]}
            </button>
          )
        })}
      </div>

      <div role="tabpanel" className="space-y-8">
        {/* ═══ 1. VISION ═══ */}
        {tab === 'vision' && (
          <>
            <Card className="!bg-[#0B132B] dark:!bg-[#0B132B] border border-white/10 text-white relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(120deg, rgba(13,148,136,0.28), rgba(75,107,255,0.18))' }} />
              <div className="relative z-10 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="border border-teal-300/40 text-teal-200 text-xs font-bold px-3 py-1 rounded-full uppercase">{r.vision.badge}</span>
                  <span className="text-gray-400 text-xs">{r.vision.year}</span>
                </div>
                <h3 className="text-2xl md:text-4xl font-black leading-tight mb-3">{r.vision.title}</h3>
                <p className="text-gray-300 text-sm md:text-base leading-relaxed">{r.vision.intro}</p>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {r.vision.cards.map((c) => (
                <Card key={c.title} className="flex flex-col justify-between !p-6">
                  <div>
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center text-2xl mb-3" aria-hidden="true">{c.icon}</div>
                    <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{c.title}</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{c.desc}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-white/10 text-xs font-semibold text-teal-600 dark:text-teal-300">{c.tag}</div>
                </Card>
              ))}
            </div>

            <Card>
              <h4 className="text-xl font-black text-gray-900 dark:text-gray-50">{r.vision.pillarsTitle}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">{r.vision.pillarsIntro}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {r.vision.pillars.map((x) => {
                  const active = x.key === pillar
                  return (
                    <button
                      key={x.key}
                      type="button"
                      onClick={() => setPillar(x.key)}
                      aria-pressed={active}
                      className={`text-left rounded-2xl border p-4 transition-all ${
                        active
                          ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                          : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 hover:border-teal-500'
                      }`}
                    >
                      <div className="text-2xl mb-2" aria-hidden="true">{x.icon}</div>
                      <div className="font-bold text-sm text-gray-900 dark:text-gray-50">{x.name}</div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{x.short}</p>
                      <span className="text-[11px] font-bold text-teal-600 dark:text-teal-300 mt-2 block">{r.vision.explore}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-5 rounded-2xl bg-slate-900 text-white p-5" aria-live="polite">
                <div className="font-bold text-teal-400 text-sm mb-1">{activePillar.title}</div>
                <p className="text-slate-300 text-xs md:text-sm leading-relaxed">{activePillar.desc}</p>
              </div>
            </Card>
          </>
        )}

        {/* ═══ 2. TOKENOMICS ═══ */}
        {tab === 'tokenomics' && (
          <>
            <PanelHeader badge={r.tokenomics.badge} title={r.tokenomics.title} intro={r.tokenomics.intro} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <Card className="lg:col-span-5">
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-3">{r.tokenomics.chartTitle}</h4>
                <div className="relative h-80">
                  <Doughnut data={allocData} options={allocOptions} />
                </div>
                <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mt-3 text-center">{r.tokenomics.chartHint}</p>
              </Card>

              <Card className="lg:col-span-7 !p-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5">
                  <h4 className="font-bold text-sm text-gray-900 dark:text-gray-50">{r.tokenomics.tableTitle}</h4>
                  <span className="text-xs font-mono bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded font-semibold whitespace-nowrap">Supply: 1,000,000,000</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs min-w-[560px]">
                    <thead className="bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-gray-300">
                      <tr>{r.tokenomics.tableHead.map((h) => <th key={h} className="p-3 font-bold">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/10 text-gray-700 dark:text-gray-300">
                      {r.tokenomics.rows.map((row, i) => (
                        <tr key={row.name}>
                          <td className="p-3 font-bold whitespace-nowrap">
                            <span className="inline-block w-2.5 h-2.5 rounded-full mr-2 align-middle" style={{ background: ZOFO_ROW_COLORS[i] }} />
                            <span className="text-gray-900 dark:text-gray-50">{row.name}</span>
                          </td>
                          <td className="p-3">{row.pct}</td>
                          <td className="p-3 font-mono">{row.amount}</td>
                          <td className="p-3 text-gray-500 dark:text-gray-400">{row.terms}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-4">{r.tokenomics.pipelineTitle}</h4>
                <ol className="space-y-3 text-xs">
                  {r.tokenomics.pipeline.map((s, i) => (
                    <li key={s.title} className="flex items-start gap-3 rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-3">
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">{i + 1}</span>
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-50">{s.title}</span>
                        <p className="text-gray-600 dark:text-gray-300 mt-0.5">{s.desc}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </Card>
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50 mb-2">{r.tokenomics.taxTitle}</h4>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed mb-4">{r.tokenomics.taxIntro}</p>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  {r.tokenomics.tax.map((x) => (
                    <div key={x.label} className="rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 p-3">
                      <div className="text-lg font-black text-[#4B6BFF]">{x.pct}</div>
                      <div className="font-bold text-gray-900 dark:text-gray-50">{x.label}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{x.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-100 p-4 text-xs leading-relaxed">
                  <div className="font-bold mb-1">{r.tokenomics.buybackTitle}</div>
                  <Rich text={r.tokenomics.buybackText} />
                </div>
              </Card>
            </div>
          </>
        )}

        {/* ═══ 3. VESTING & YIELD ═══ */}
        {tab === 'vesting' && (
          <>
            <PanelHeader badge={r.vesting.badge} title={r.vesting.title} intro={r.vesting.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50">{r.vesting.chartTitle}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">{r.vesting.chartUnit}</p>
                <div className="relative h-72 md:h-80">
                  <Line data={vestData} options={vestOptions} />
                </div>
                <p className="text-[11px] italic text-gray-500 dark:text-gray-400 mt-3 text-center">{r.vesting.chartNote}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 text-center">{r.vesting.tgeBreakdown}</p>
              </Card>

              <Card>
                <h4 className="font-bold text-gray-900 dark:text-gray-50">{r.vesting.calcTitle}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-5">{r.vesting.calcIntro}</p>
                <div className="space-y-5">
                  <div>
                    <label htmlFor="zofo-price" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{r.vesting.priceLabel}</label>
                    <input id="zofo-price" type="number" min="0" step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
                    <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 block">{r.vesting.priceHint}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <label htmlFor="zofo-tasks" className="font-semibold text-gray-700 dark:text-gray-200">{r.vesting.tasksLabel}</label>
                      <span className="font-extrabold text-teal-600 dark:text-teal-300">{tasks} {r.vesting.tasksUnit}</span>
                    </div>
                    <input id="zofo-tasks" type="range" min="1" max="10" value={tasks} onChange={(e) => setTasks(parseInt(e.target.value, 10))} className={rangeCls} />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>{r.vesting.tasksMin}</span><span>{r.vesting.tasksMid}</span><span>{r.vesting.tasksMax}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{r.vesting.baseReward}</p>
                  </div>
                </div>

                <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-3">
                    <dt className="text-xs text-gray-500 dark:text-gray-400">{r.vesting.outMc}</dt>
                    <dd className="text-lg font-extrabold text-gray-900 dark:text-gray-50">${fmt(initialMc, { maximumFractionDigits: 0 })}</dd>
                    <dd className="text-[11px] text-gray-400">{r.vesting.outMcSub.replace('{amount}', fmt(INITIAL_CIRCULATING))}</dd>
                  </div>
                  <div className="rounded-2xl bg-gray-50 dark:bg-white/5 p-3">
                    <dt className="text-xs text-gray-500 dark:text-gray-400">{r.vesting.outFdv}</dt>
                    <dd className="text-lg font-extrabold text-gray-900 dark:text-gray-50">${fmt(fdv, { maximumFractionDigits: 0 })}</dd>
                    <dd className="text-[11px] text-gray-400">{r.vesting.outFdvSub}</dd>
                  </div>
                  <div className="rounded-2xl bg-teal-50 dark:bg-teal-500/10 p-3">
                    <dt className="text-xs text-gray-600 dark:text-gray-300">{r.vesting.outMonthly}</dt>
                    <dd className="text-lg font-extrabold text-teal-700 dark:text-teal-300">${fmt(monthlyUsd, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd>
                    <dd className="text-[11px] text-gray-500 dark:text-gray-400">{fmt(monthlyTokens)} ZoFo</dd>
                  </div>
                  <div className="rounded-2xl bg-teal-50 dark:bg-teal-500/10 p-3">
                    <dt className="text-xs text-gray-600 dark:text-gray-300">{r.vesting.outPerTask}</dt>
                    <dd className="text-lg font-extrabold text-teal-700 dark:text-teal-300">${perTaskUsd.toFixed(3)}</dd>
                    <dd className="text-[11px] text-gray-500 dark:text-gray-400">{r.vesting.outPerTaskSub}</dd>
                  </div>
                </dl>
                <p className="text-xs italic text-gray-500 dark:text-gray-400 mt-4">{r.common.simNote}</p>
              </Card>
            </div>
          </>
        )}

        {/* ═══ 4. BLOCKCHAIN & AI ═══ */}
        {tab === 'blockchain' && (
          <>
            <PanelHeader badge={r.blockchain.badge} title={r.blockchain.title} intro={r.blockchain.intro} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {r.blockchain.cards.map((c) => (
                <Card key={c.title}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-500/10 flex items-center justify-center text-2xl" aria-hidden="true">{c.icon}</div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-gray-50">{c.title}</h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{c.sub}</p>
                    </div>
                  </div>
                  <ul className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                    {c.items.map((it) => (
                      <li key={it.b} className="flex gap-2">
                        <span className="text-emerald-500 font-bold" aria-hidden="true">✓</span>
                        <span><strong className="text-gray-900 dark:text-gray-50">{it.b}</strong> {it.t}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            <Card className="!bg-slate-900 dark:!bg-slate-900 text-white border border-white/10">
              <span className="inline-block border border-teal-300/40 text-teal-200 text-xs font-bold px-3 py-1 rounded-full">{r.blockchain.aiBadge}</span>
              <h4 className="font-bold text-lg mt-2">{r.blockchain.aiTitle}</h4>
              <p className="text-sm text-slate-400 mt-1 mb-5">{r.blockchain.aiIntro}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {r.blockchain.aiSteps.map((s, i) => {
                  const reached = i + 1 <= workoutStep
                  return (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setWorkoutStep(i + 1)}
                      aria-pressed={reached}
                      className={`p-3 rounded-xl border font-bold text-left transition-all ${
                        reached ? 'border-teal-500 bg-teal-500/20 text-white' : 'border-slate-800 bg-slate-800/60 text-slate-400'
                      }`}
                    >
                      <div className="text-xl mb-1" aria-hidden="true">{s.icon}</div>
                      {s.label}
                    </button>
                  )
                })}
              </div>
              <div className="mt-4 rounded-xl bg-black/40 p-4 font-mono text-xs leading-relaxed space-y-1" aria-live="polite">
                <div className={`font-bold ${LOG_COLORS[workoutStep - 1]}`}>{log.head}</div>
                <div className="text-slate-400">{log.body}</div>
              </div>
              <p className="text-[11px] italic text-slate-400 mt-3">{r.blockchain.aiNote}</p>
            </Card>
          </>
        )}

        {/* ═══ 5. SANDBOX & RISK ═══ */}
        {tab === 'sandbox' && (
          <>
            <PanelHeader badge={r.sandbox.badge} title={r.sandbox.title} intro={r.sandbox.intro} />
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-gray-50">{r.sandbox.sandboxTitle}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.sandbox.sandboxSub}</p>
                </div>
                <a
                  href={SITE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-3 py-1.5 rounded-lg hover:opacity-90"
                >
                  {r.sandbox.visit} <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {r.sandbox.bullets.map((b) => (
                  <div key={b.title} className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4">
                    <div className="font-bold text-sm text-gray-900 dark:text-gray-50 mb-1">{b.title}</div>
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{b.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h4 className="font-bold text-lg text-gray-900 dark:text-gray-50">{r.sandbox.riskTitle}</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{r.sandbox.riskSub}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs" role="group" aria-label={r.sandbox.riskTitle}>
                  {Object.entries(r.sandbox.filters).map(([k, label]) => {
                    const active = riskFilter === k
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setRiskFilter(k)}
                        aria-pressed={active}
                        className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                          active
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/20'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-4">
                {visibleRisks.map((x) => (
                  <div key={x.title} className={`rounded-2xl border p-4 text-xs ${RISK_STYLES[x.cat]}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <h5 className="font-bold text-sm text-gray-900 dark:text-gray-50">{x.title}</h5>
                      <span className="px-2 py-0.5 rounded-full bg-white/70 dark:bg-white/10 text-gray-700 dark:text-gray-200 font-semibold">{x.tag}</span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed"><strong>{r.sandbox.riskLabel}</strong> {x.risk}</p>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-1"><strong>{r.sandbox.fixLabel}</strong> {x.fix}</p>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>

      <div className="mt-10 text-center text-xs text-gray-500 dark:text-gray-400 space-y-2">
        <p className="font-semibold">{r.footer.org}</p>
        <p>{r.footer.copy}</p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {r.footer.chips.map((c) => (
            <span key={c} className="px-3 py-1 rounded-full border border-gray-200 dark:border-white/10">{c}</span>
          ))}
        </div>
      </div>
    </section>
  )
}
