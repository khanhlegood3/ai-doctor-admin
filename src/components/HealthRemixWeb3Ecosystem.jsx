// src/components/HealthRemixWeb3Ecosystem.jsx
// -----------------------------------------------------------------------
// Chuyển đổi từ file tĩnh `health_remix_web3_ecosystem.html` sang component
// React thuần (JSX + Tailwind + react-chartjs-2), dùng trong trang con
// "products" của landingPageZeroToForever.jsx (mục menu "Our Products" ->
// "Remix the KOL's Health to Mine").
//
// Giữ nguyên nội dung & bố cục gốc (4 giai đoạn theo "Hành trình Hero"):
//   1. Virtual Twin (AI Pose Tracking - canvas skeleton simulator)
//   2. Real-life Remix (Chỉ số lâm sàng - Bar chart + progress bars)
//   3. Reputation & Web3 (Soulbound Badges - Radar chart)
//   4. Creator Economy (Story Protocol - IP flow)
//
// Khác biệt so với bản HTML gốc:
//   - Chart.js (CDN) -> react-chartjs-2 (đã có sẵn trong package.json)
//   - <canvas id="poseCanvas"> + script DOM thuần -> useRef + useEffect,
//     dọn dẹp animation frame khi unmount để tránh leak khi chuyển trang.
//   - <script> setInterval mô phỏng % tương đồng -> useState + useEffect.
//   - Tailwind CDN -> dùng trực tiếp class Tailwind của project (đã có
//     cấu hình content glob `src/**/*.{js,ts,jsx,tsx}`).
//   - Nav nội bộ (anchor #intro, #virtual...) giữ lại dưới dạng nav phụ
//     cuộn mượt bên trong component, độc lập với nav chính của landing page.

import React, { useEffect, useRef, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar, Radar } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

const NAV_LINKS = [
  { href: '#hr-intro', label: 'Giới thiệu' },
  { href: '#hr-virtual', label: 'Virtual Twin' },
  { href: '#hr-clinical', label: 'Chỉ số Thực' },
  { href: '#hr-reputation', label: 'Danh tiếng' },
  { href: '#hr-economy', label: 'Kinh tế IP' },
]

const POSE_POINTS = [
  { x: 200, y: 50 }, // Head
  { x: 200, y: 100 }, // Neck
  { x: 150, y: 100 }, { x: 250, y: 100 }, // Shoulders
  { x: 140, y: 160 }, { x: 260, y: 160 }, // Elbows
  { x: 130, y: 220 }, { x: 270, y: 220 }, // Wrists
  { x: 170, y: 200 }, { x: 230, y: 200 }, // Hips
  { x: 175, y: 250 }, { x: 225, y: 250 }, // Knees
  { x: 180, y: 290 }, { x: 220, y: 290 }, // Ankles
]

function drawSkeleton(ctx, color, offset) {
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.beginPath()

  // Torso & Head
  ctx.moveTo(POSE_POINTS[0].x + offset, POSE_POINTS[0].y)
  ctx.lineTo(POSE_POINTS[1].x + offset, POSE_POINTS[1].y)

  // Shoulders
  ctx.moveTo(POSE_POINTS[2].x + offset, POSE_POINTS[2].y)
  ctx.lineTo(POSE_POINTS[3].x + offset, POSE_POINTS[3].y)

  // Arms
  ctx.lineTo(POSE_POINTS[5].x + offset, POSE_POINTS[5].y)
  ctx.lineTo(POSE_POINTS[7].x + offset, POSE_POINTS[7].y)
  ctx.moveTo(POSE_POINTS[2].x + offset, POSE_POINTS[2].y)
  ctx.lineTo(POSE_POINTS[4].x + offset, POSE_POINTS[4].y)
  ctx.lineTo(POSE_POINTS[6].x + offset, POSE_POINTS[6].y)

  // Body to Hips
  ctx.moveTo(POSE_POINTS[1].x + offset, POSE_POINTS[1].y)
  ctx.lineTo(POSE_POINTS[8].x + offset, POSE_POINTS[8].y)
  ctx.lineTo(POSE_POINTS[9].x + offset, POSE_POINTS[9].y)
  ctx.lineTo(POSE_POINTS[1].x + offset, POSE_POINTS[1].y)

  // Legs
  ctx.moveTo(POSE_POINTS[8].x + offset, POSE_POINTS[8].y)
  ctx.lineTo(POSE_POINTS[10].x + offset, POSE_POINTS[10].y)
  ctx.lineTo(POSE_POINTS[12].x + offset, POSE_POINTS[12].y)
  ctx.moveTo(POSE_POINTS[9].x + offset, POSE_POINTS[9].y)
  ctx.lineTo(POSE_POINTS[11].x + offset, POSE_POINTS[11].y)
  ctx.lineTo(POSE_POINTS[13].x + offset, POSE_POINTS[13].y)

  ctx.stroke()

  // Draw joints
  POSE_POINTS.forEach((p) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x + offset, p.y, 4, 0, Math.PI * 2)
    ctx.fill()
  })
}

/* ── Phase 1: Canvas mô phỏng Pose Tracking (User vs KOL skeleton) ── */
function PoseSimulatorCanvas() {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    canvas.width = 400
    canvas.height = 300

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // KOL Skeleton (tham chiếu, tĩnh)
      drawSkeleton(ctx, 'rgba(255, 255, 255, 0.2)', -80)

      // User Skeleton (rung nhẹ mô phỏng chuyển động thời gian thực)
      const jitter = Math.sin(Date.now() / 200) * 2
      ctx.save()
      ctx.translate(jitter, jitter)
      drawSkeleton(ctx, '#10b981', 80)
      ctx.restore()

      frameRef.current = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <div className="chart-container-hr h-80 flex items-center justify-center bg-gray-800 rounded-xl">
      <canvas ref={canvasRef} className="rounded-lg" />
    </div>
  )
}

/* ── Live "similarity score" giả lập, dao động quanh 85% ── */
function useSimilarityScore() {
  const [score, setScore] = useState(85)

  useEffect(() => {
    const id = setInterval(() => {
      const base = 85
      const variance = Math.floor(Math.random() * 10) - 5
      setScore(base + variance)
    }, 1500)
    return () => clearInterval(id)
  }, [])

  const color = score > 88 ? '#34d399' : score < 82 ? '#f87171' : '#10b981'
  return { score, color }
}

const healthComparisonData = {
  labels: ['Khối cơ (kg)', 'Mỡ (%)', 'Protein (kg)', 'Khoáng (kg)'],
  datasets: [
    {
      label: 'KOL Target',
      data: [38, 12, 12, 4.5],
      backgroundColor: 'rgba(209, 213, 219, 0.5)',
      borderRadius: 8,
    },
    {
      label: 'Bạn (User)',
      data: [32, 18, 10, 4.1],
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      borderRadius: 8,
    },
  ],
}

const healthComparisonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom', labels: { font: { size: 10 } } },
  },
  scales: {
    y: { beginAtZero: true, grid: { display: false } },
    x: { grid: { display: false } },
  },
}

const heroRadarData = {
  labels: ['Kiến thức', 'Kỹ năng (AI)', 'Thực hành (Lâm sàng)', 'Cho đi (Hiến máu)', 'Sáng tạo IP'],
  datasets: [
    {
      label: 'Hồ sơ Hero của bạn',
      data: [85, 92, 70, 100, 45],
      fill: true,
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
      borderColor: 'rgb(16, 185, 129)',
      pointBackgroundColor: 'rgb(16, 185, 129)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgb(16, 185, 129)',
    },
  ],
}

const heroRadarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  elements: { line: { borderWidth: 3 } },
  plugins: { legend: { display: false } },
  scales: {
    r: {
      angleLines: { display: true },
      suggestedMin: 0,
      suggestedMax: 100,
      ticks: { display: false },
    },
  },
}

const INBODY_PROGRESS = [
  { label: 'Tỷ lệ mỡ nội tạng', value: 92, valueLabel: 'Đạt 92% KOL', barColor: 'bg-emerald-500', textColor: 'text-emerald-600' },
  { label: 'Khối lượng cơ xương', value: 78, valueLabel: 'Đạt 78% KOL', barColor: 'bg-blue-500', textColor: 'text-blue-600' },
  { label: 'Chỉ số Huyết áp (Ổn định)', value: 100, valueLabel: 'Đạt 100% Target', barColor: 'bg-rose-500', textColor: 'text-rose-500' },
]

const ECONOMY_STEPS = [
  { step: 1, border: 'border-purple-500', chip: 'bg-purple-100 text-purple-600', title: 'Đăng ký IP Asset', desc: 'Biến chuỗi video Pose Tracking của bạn thành tài sản on-chain với ERC-6551 (IP Account).' },
  { step: 2, border: 'border-blue-500', chip: 'bg-blue-100 text-blue-600', title: 'Thiết lập License', desc: 'Cho phép người khác Remix miễn phí hoặc có thu phí bản quyền tự động qua Royalty Module.' },
  { step: 3, border: 'border-emerald-500', chip: 'bg-emerald-100 text-emerald-600', title: 'Phân phối Doanh thu', desc: 'Dòng tiền từ người dùng cấp dưới tự động chảy về ví của bạn và các KOL/Bác sĩ gốc.' },
]

/**
 * HealthRemixWeb3Ecosystem
 * Trang giới thiệu hệ sinh thái "Remix Sức Khỏe": AI Pose Tracking, dữ liệu
 * lâm sàng, huy hiệu Soulbound (Web3) và kinh tế sáng tạo (Story Protocol).
 * Component độc lập, không phụ thuộc props bắt buộc — có thể nhúng thẳng
 * vào bất kỳ trang nào (vd. trang con "products" của landing page).
 */
export default function HealthRemixWeb3Ecosystem() {
  const { score, color } = useSimilarityScore()

  return (
    <div className="hr-ecosystem hero-gradient-hr min-h-screen font-sans text-[#2d3436]">
      <style>{`
        .hero-gradient-hr { background: linear-gradient(135deg, #fff5f5 0%, #f0fdf4 100%); }
        .card-shadow-hr { box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05); }
        .chart-container-hr { position: relative; width: 100%; max-width: 600px; margin-left: auto; margin-right: auto; }
        .hr-ecosystem .nav-link-hr:hover { color: #059669; }
      `}</style>

      {/* Nav nội bộ (cuộn giữa các giai đoạn trong chính trang này) */}
      <nav className="sticky top-0 w-full bg-white/80 backdrop-blur-md z-40 border-b border-gray-100 rounded-t-3xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">H</div>
              <span className="text-xl font-bold tracking-tight text-emerald-800">Health Remix</span>
            </div>
            <div className="hidden md:flex space-x-8">
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="nav-link-hr font-medium text-gray-700 hover:text-emerald-600 transition">
                  {link.label}
                </a>
              ))}
            </div>
            <button className="bg-emerald-600 text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-emerald-700 transition">
              Bắt đầu Remix
            </button>
          </div>
        </div>
      </nav>

      {/* Hero / Intro */}
      <header id="hr-intro" className="pt-16 pb-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
            Đừng chỉ Remix video, hãy <span className="text-emerald-600">Remix Sức Khỏe</span> của chính bạn
          </h1>
          <p className="text-lg text-gray-600 mb-10">
            Hệ sinh thái Web3 tiên phong kết hợp AI Pose Tracking, dữ liệu y tế InBody và Story Protocol để biến hành trình rèn luyện thành tài sản trí tuệ giá trị.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="p-4 bg-white rounded-2xl card-shadow-hr border border-gray-50">
              <div className="text-emerald-500 text-2xl mb-2">✦</div>
              <h3 className="font-bold text-gray-800">HienMauNhanVan.Com</h3>
              <p className="text-xs text-gray-500 mt-1">Nơi khởi nguồn của lòng nhân ái</p>
            </div>
            <div className="p-4 bg-white rounded-2xl card-shadow-hr border border-gray-50">
              <div className="text-blue-500 text-2xl mb-2">✦</div>
              <h3 className="font-bold text-gray-800">BloodDonation.Space</h3>
              <p className="text-xs text-gray-500 mt-1">Kết nối Hero toàn cầu</p>
            </div>
            <div className="p-4 bg-white rounded-2xl card-shadow-hr border border-gray-50">
              <div className="text-rose-500 text-2xl mb-2">✦</div>
              <h3 className="font-bold text-gray-800">DonationHero.Online</h3>
              <p className="text-xs text-gray-500 mt-1">Vinh danh Master Hero</p>
            </div>
          </div>
        </div>
      </header>

      {/* Phase 1: Virtual Twin AI Engine */}
      <section id="hr-virtual" className="py-16 bg-white rounded-3xl">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <div className="flex-1">
              <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full mb-4">GIAI ĐOẠN 1</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">AI Pose Tracking: Remix Chuyển Động Thời Gian Thực</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Sử dụng công nghệ <strong>MediaPipe BlazePose</strong> và WebAssembly, hệ thống phân tích 33 điểm mốc sinh trắc học của bạn ngay trên trình duyệt. Bạn sẽ "Remix" lại các động tác của KOL trong LiveStream. Thuật toán <strong>Cosine Similarity</strong> sẽ đo lường độ chính xác của góc khớp so với bản gốc của chuyên gia.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-xs mr-3 mt-1">✓</span>
                  <span>Độ trễ &lt; 70ms giúp phản hồi LiveStream tức thì.</span>
                </li>
                <li className="flex items-start">
                  <span className="w-6 h-6 bg-emerald-500 text-white rounded-full flex-shrink-0 flex items-center justify-center text-xs mr-3 mt-1">✓</span>
                  <span>Thuật toán DTW đồng bộ hóa nhịp độ tập luyện.</span>
                </li>
              </ul>
            </div>
            <div className="flex-1 w-full">
              <div className="bg-gray-900 rounded-3xl p-6 relative overflow-hidden card-shadow-hr">
                <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-3 py-1 rounded-md text-xs">
                  Live Feedback: <span className="font-bold" style={{ color }}>{score}%</span>
                </div>
                <PoseSimulatorCanvas />
                <div className="mt-4 flex justify-between text-white text-xs">
                  <span>User: Digital Twin (Draft)</span>
                  <span>KOL: Master Template</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 2: Clinical Health Remix */}
      <section id="hr-clinical" className="py-16 bg-emerald-50/50 rounded-3xl mt-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full mb-4">GIAI ĐOẠN 2</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Remix Chỉ Số Sức Khỏe Đời Thật</h2>
            <p className="text-gray-600">
              Khi bản sao kỹ thuật số đã hoàn thiện, đây là lúc bạn đồng bộ dữ liệu lâm sàng từ InBody, huyết áp và hồ sơ bệnh viện qua API. Chỉ khi chỉ số thực tế của bạn tiệm cận KOL, bạn mới chính thức trở thành Hero.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-6 rounded-3xl card-shadow-hr">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <span className="mr-2">📊</span> So sánh chỉ số Hero (User vs KOL)
              </h3>
              <div className="chart-container-hr h-64">
                <Bar data={healthComparisonData} options={healthComparisonOptions} />
              </div>
            </div>
            <div className="bg-white p-6 rounded-3xl card-shadow-hr">
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <span className="mr-2">🛡️</span> Dashboard Tiến Trình InBody
              </h3>
              <div className="space-y-6">
                {INBODY_PROGRESS.map((row) => (
                  <div key={row.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500 font-medium">{row.label}</span>
                      <span className={`${row.textColor} font-bold`}>{row.valueLabel}</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className={`${row.barColor} h-full`} style={{ width: `${row.value}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 p-4 bg-emerald-50 border border-emerald-100 rounded-xl text-sm text-emerald-800 italic">
                "Zero to Forever" đang giám sát lộ trình của bạn...
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 3: Reputation & Web3 */}
      <section id="hr-reputation" className="py-16 bg-white rounded-3xl mt-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 order-2 md:order-1">
              <div className="bg-emerald-900 rounded-3xl p-8 text-white relative overflow-hidden">
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold mb-4">Hệ Thống Huy Chương Soulbound (SBT)</h3>
                  <p className="text-emerald-100/80 mb-6 text-sm">
                    Khác với NFT thông thường, huy hiệu tại Health Remix là <strong>Soulbound</strong> - không thể chuyển nhượng. Nó ghi dấu vĩnh viễn nỗ lực và lòng nhân ái của bạn qua Ethereum Attestation Service (EAS).
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/20 text-center hover:bg-white/20 transition cursor-default">
                      <div className="text-2xl mb-1">🩸</div>
                      <div className="font-bold text-xs">Donation Hero</div>
                      <div className="text-[10px] text-emerald-300">Verified by EAS</div>
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/20 text-center hover:bg-white/20 transition cursor-default">
                      <div className="text-2xl mb-1">🏃</div>
                      <div className="font-bold text-xs">Master Trainer</div>
                      <div className="text-[10px] text-emerald-300">Verified by Z2F</div>
                    </div>
                  </div>
                </div>
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
              </div>
            </div>
            <div className="flex-1 order-1 md:order-2">
              <span className="inline-block px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full mb-4">TRIẾT LÝ SỐNG</span>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Zero to Forever: Sống Để Cho Đi</h2>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Sức khỏe không chỉ là cơ bắp, mà là sự cống hiến. Khi bạn tham gia hiến máu nhân đạo tại <strong>HienMauNhanDao.com</strong>, hành động này được tích hợp vào hồ sơ Master Hero. Đây là thước đo cao nhất về sự phát triển con người mà hệ sinh thái hướng tới.
              </p>
              <div className="chart-container-hr h-64">
                <Radar data={heroRadarData} options={heroRadarOptions} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Phase 4: Creator Economy & Story Protocol */}
      <section id="hr-economy" className="py-16 bg-gray-50 rounded-3xl mt-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-block px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full mb-4">KINH TẾ PHI TẬP TRUNG</span>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Nền Kinh Tế Sáng Tạo Master Hero</h2>
            <p className="text-gray-600">
              Khi trở thành Master Hero, bạn có quyền tạo nội dung "Remix" mới. Story Protocol giúp bạn token hóa các bài tập, video thành <strong>IP Assets</strong> với giấy phép có thể lập trình (PIL).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ECONOMY_STEPS.map((s) => (
              <div key={s.step} className={`bg-white p-8 rounded-3xl card-shadow-hr border-t-4 ${s.border}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 font-bold text-xl ${s.chip}`}>{s.step}</div>
                <h3 className="text-xl font-bold mb-4 text-gray-800">{s.title}</h3>
                <p className="text-gray-500 text-sm">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-16 bg-white p-8 rounded-3xl card-shadow-hr max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
              <h3 className="text-xl font-bold">Mô phỏng Dòng tiền IP (Remix Flow)</h3>
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">MASTER HERO</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-full">STORY PROTOCOL</span>
              </div>
            </div>
            <div className="relative py-10 px-4 flex justify-between items-center bg-gray-50 rounded-2xl border border-dashed border-gray-300">
              <div className="text-center">
                <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-2 flex items-center justify-center">👤</div>
                <p className="text-[10px] font-bold">KOL Gốc</p>
              </div>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-emerald-400 to-purple-400 relative">
                <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 text-[10px] bg-white px-2 border border-gray-100 rounded shadow-sm">Remix License</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-emerald-500 rounded-full mx-auto mb-2 flex items-center justify-center shadow-lg shadow-emerald-200">🦸</div>
                <p className="text-[10px] font-bold text-emerald-600">Bạn (Master Hero)</p>
              </div>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-purple-400 to-blue-400 relative">
                <div className="absolute top-[-15px] left-1/2 -translate-x-1/2 text-[10px] bg-white px-2 border border-gray-100 rounded shadow-sm">Derivative Content</div>
              </div>
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full mx-auto mb-2 flex items-center justify-center">👥</div>
                <p className="text-[10px] font-bold text-blue-600">Học viên mới</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white pt-16 pb-8 border-t border-gray-100 rounded-b-3xl mt-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">H</div>
                <span className="text-xl font-bold text-emerald-800 uppercase tracking-widest">Health Remix Web3</span>
              </div>
              <p className="text-gray-500 text-sm max-w-sm">
                Nền tảng kết hợp sức khỏe lâm sàng và Web3, được chứng nhận bởi Zero to Forever. Chúng tôi tin rằng mỗi người đều là một Hero tiềm năng.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-6">Hệ sinh thái</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-emerald-600 transition">HienMauNhanDao.com</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition">BloodDonation.Space</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition">DonationHero.Online</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-6">Công nghệ</h4>
              <ul className="space-y-4 text-sm text-gray-500">
                <li><a href="#" className="hover:text-emerald-600 transition">MediaPipe AI</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition">Story Protocol</a></li>
                <li><a href="#" className="hover:text-emerald-600 transition">Soulbound Tokens</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-xs">© 2026 Health Remix Web3. All rights reserved by Zero to Forever Corp.</p>
            <div className="flex gap-6">
              <span className="text-xs text-emerald-600 font-bold">● Network Status: Mainnet</span>
              <span className="text-xs text-gray-400 italic">EAS Attestations: 1,240,512</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
