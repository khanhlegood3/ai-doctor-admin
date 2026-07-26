import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Users, Settings, DollarSign, Plus, Trash2, ArrowRight,
  ShoppingCart, Sparkles, Loader2, MessageSquareText,
  Network, UserCircle, Lightbulb, HeartHandshake, PlayCircle,
  Clock, GraduationCap, Copy, CheckCircle2, Wallet, History, AlertTriangle,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useAuth } from '../context/AuthContext'
import { useApp } from '../context/AppContext'

// =====================================================================================
// AFFILIATE & EARN ĐA TẦNG — Panel tích hợp cho AI Doctor Admin
// - Core MLM Engine: dò ngược cây parentId, chia hoa hồng theo % từng tầng (F1, F2, F3…)
// - Earn: nhiệm vụ xem "quảng cáo" định kỳ (4h/lần) + Quiz kiến thức y khoa
// - Admin: cấu hình % hoa hồng theo tầng, mô phỏng giao dịch, sổ cái minh bạch
// - AI: dùng /api/anthropic-proxy đã có sẵn của dự án (không cần API key ngoài)
// Dữ liệu được lưu localStorage để demo hoạt động ngay không cần backend riêng.
// =====================================================================================

const STORAGE_KEY = 'cdoc_affiliate_v1'

const defaultBalances = { VND: 0, VIET: 0, PI: 0 }

const SEED_USERS = [
  { id: 'u1', name: 'Admin (Hệ Thống)', parentId: null, balances: { ...defaultBalances } },
  { id: 'u2', name: 'Nguyễn Văn A', parentId: 'u1', balances: { ...defaultBalances } },
  { id: 'u3', name: 'Trần Thị B', parentId: 'u2', balances: { ...defaultBalances } },
  { id: 'u4', name: 'Lê Văn C', parentId: 'u3', balances: { ...defaultBalances } },
  { id: 'u5', name: 'Phạm Thị D', parentId: 'u4', balances: { ...defaultBalances } },
  { id: 'u6', name: 'Hoàng Văn E', parentId: 'u2', balances: { ...defaultBalances } },
]

const SEED_POLICY = [
  { level: 1, rate: 10 },
  { level: 2, rate: 5 },
  { level: 3, rate: 2 },
]

const SEED_TRANSACTIONS = [
  { id: 't1', userId: 'u5', amount: 1000000, date: new Date().toISOString().split('T')[0], note: 'Quyên góp Quỹ Nhân Văn', type: 'PURCHASE' },
]

const QUIZ_QUESTIONS = [
  {
    question: 'Lợi ích tuyệt vời nhất của việc hiến máu là gì?',
    options: ['Giảm cân nhanh chóng', 'Kích thích tạo máu mới & cứu người', 'Tăng chiều cao', 'Không có lợi ích gì'],
    correct: 1,
    reward: { currency: 'VIET', amount: 10000 },
    baseValue: 5000,
  },
  {
    question: 'Khoảng cách an toàn giữa 2 lần hiến máu toàn phần là bao lâu?',
    options: ['1 tuần', '1 tháng', 'Khoảng 12 tuần (84 ngày)', '6 tháng'],
    correct: 2,
    reward: { currency: 'PI', amount: 0.5 },
    baseValue: 12000,
  },
  {
    question: 'Uống đủ nước mỗi ngày giúp cơ thể điều gì?',
    options: ['Không có tác dụng gì', 'Hỗ trợ tuần hoàn & đào thải độc tố', 'Gây mất ngủ', 'Làm chậm tiêu hoá'],
    correct: 1,
    reward: { currency: 'VND', amount: 8000 },
    baseValue: 8000,
  },
]

const AD_COOLDOWN_MS = 4 * 60 * 60 * 1000 // 4 giờ
const AD_WATCH_SECONDS = 15

const CURRENCY_LABEL = { VND: 'đ', VIET: 'VIET', PI: 'PI' }

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function saveState(state) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch { /* ignore quota errors */ }
}

// Gọi AI qua proxy Anthropic sẵn có của dự án (api/anthropic-proxy.js) — không cần key ngoài.
async function callProjectAI(prompt) {
  try {
    const res = await fetch('/api/anthropic-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return `Lỗi AI: ${data?.error || res.status}`
    const text = Array.isArray(data?.content)
      ? data.content.map((block) => block?.text || '').filter(Boolean).join('\n')
      : ''
    return text || 'AI không trả về nội dung.'
  } catch (err) {
    return `Không thể kết nối AI: ${err?.message || 'lỗi không xác định'}`
  }
}

function formatMoney(n) {
  return Math.round(n || 0).toLocaleString('vi-VN')
}

function fmtCooldown(msLeft) {
  const total = Math.max(0, Math.floor(msLeft / 1000))
  const h = String(Math.floor(total / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function AffiliateSystemPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { user } = useAuth()
  const { theme } = useApp()
  const isDark = theme === 'dark'
  const isAdmin = Boolean(user?.isAdmin)

  const [tab, setTab] = useState('earn') // earn | admin | stats
  const [users, setUsers] = useState(SEED_USERS)
  const [policy, setPolicy] = useState(SEED_POLICY)
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS)
  const [adCooldowns, setAdCooldowns] = useState({})
  const [quizCompleted, setQuizCompleted] = useState({})
  const [now, setNow] = useState(Date.now())
  const [toast, setToast] = useState(null)

  const [isWatchingAd, setIsWatchingAd] = useState(false)
  const [adTimer, setAdTimer] = useState(0)
  const [quizIndex, setQuizIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [copied, setCopied] = useState(false)

  const [aiAnalysis, setAiAnalysis] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [marketingCopy, setMarketingCopy] = useState('')
  const [isGeneratingCopy, setIsGeneratingCopy] = useState(false)

  // Người dùng hiện tại trong cây affiliate. Nếu là admin -> gốc cây (u1).
  // Nếu là user thường -> tự thêm vào cây (mặc định dưới quyền u2) để demo
  // hoa hồng đệ quy chạy được ngay mà không cần backend thật.
  const viewingUserId = useMemo(() => {
    if (isAdmin) return 'u1'
    return user?.uuid ? `me-${user.uuid}` : 'u2'
  }, [isAdmin, user?.uuid])

  // Khởi tạo từ localStorage (hoặc seed mặc định) + đảm bảo user hiện tại có mặt trong cây.
  useEffect(() => {
    const saved = loadState()
    let nextUsers = saved?.users?.length ? saved.users : SEED_USERS
    const nextPolicy = saved?.policy?.length ? saved.policy : SEED_POLICY
    const nextTx = saved?.transactions?.length ? saved.transactions : SEED_TRANSACTIONS
    setAdCooldowns(saved?.adCooldowns || {})
    setQuizCompleted(saved?.quizCompleted || {})

    if (!isAdmin && user?.uuid) {
      const myId = `me-${user.uuid}`
      if (!nextUsers.some((u) => u.id === myId)) {
        nextUsers = [
          ...nextUsers,
          { id: myId, name: user?.name || 'Thành viên mới', parentId: 'u2', balances: { ...defaultBalances } },
        ]
      }
    }
    setUsers(nextUsers)
    setPolicy(nextPolicy)
    setTransactions(nextTx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    saveState({ users, policy, transactions, adCooldowns, quizCompleted })
  }, [users, policy, transactions, adCooldowns, quizCompleted])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!isWatchingAd) return
    if (adTimer <= 0) {
      handleAdSuccess()
      return
    }
    const t = setTimeout(() => setAdTimer((v) => v - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWatchingAd, adTimer])

  const showToast = useCallback((title, message, type = 'success') => {
    setToast({ title, message, type })
    window.setTimeout(() => setToast(null), 3200)
  }, [])

  // ===================== CORE MLM ENGINE (đệ quy dò ngược cây parentId) =====================
  const commissions = useMemo(() => {
    const result = []
    transactions.forEach((tx) => {
      const buyer = users.find((u) => u.id === tx.userId)
      if (!buyer) return
      let currentId = buyer.parentId
      let level = 1
      while (currentId && level <= policy.length) {
        const referrer = users.find((u) => u.id === currentId)
        if (!referrer) break
        const levelPolicy = policy.find((p) => p.level === level)
        if (levelPolicy && levelPolicy.rate > 0) {
          const amount = (tx.amount * levelPolicy.rate) / 100
          result.push({
            id: `comm_${tx.id}_${referrer.id}`,
            transactionId: tx.id,
            buyerName: buyer.name,
            referrerId: referrer.id,
            referrerName: referrer.name,
            level,
            rate: levelPolicy.rate,
            amount,
            date: tx.date,
            note: tx.note,
          })
        }
        currentId = referrer.parentId
        level += 1
      }
    })
    return result
  }, [transactions, users, policy])

  const userStats = useMemo(() => {
    return users
      .map((u) => {
        const myCommissions = commissions.filter((c) => c.referrerId === u.id)
        const commissionVND = myCommissions.reduce((sum, c) => sum + c.amount, 0)
        const f1Count = users.filter((x) => x.parentId === u.id).length
        return {
          ...u,
          realBalances: { ...u.balances, VND: u.balances.VND + commissionVND },
          totalCommissionVND: commissionVND,
          f1Count,
          myCommissions,
        }
      })
      .sort((a, b) => b.totalCommissionVND - a.totalCommissionVND)
  }, [users, commissions])

  const me = userStats.find((u) => u.id === viewingUserId)
  const chartData = userStats
    .filter((u) => u.totalCommissionVND > 0)
    .map((u) => ({ name: u.name, 'Hoa hồng (VNĐ)': Math.round(u.totalCommissionVND) }))

  const cooldownUntil = adCooldowns[viewingUserId]
  const cooldownLeft = cooldownUntil ? cooldownUntil - now : 0
  const adOnCooldown = cooldownLeft > 0
  const quizDone = Boolean(quizCompleted[viewingUserId])

  // ===================== State helpers =====================
  const updateBalance = (userId, currency, amount) => {
    setUsers((prev) => prev.map((u) => (
      u.id === userId ? { ...u, balances: { ...u.balances, [currency]: (u.balances[currency] || 0) + amount } } : u
    )))
  }

  const addTransaction = (tx) => setTransactions((prev) => [...prev, tx])

  // ===================== Earn: Ad task =====================
  const startAdTask = () => {
    if (adOnCooldown) return
    setIsWatchingAd(true)
    setAdTimer(AD_WATCH_SECONDS)
  }

  const handleAdSuccess = () => {
    setIsWatchingAd(false)
    updateBalance(viewingUserId, 'VND', 5000)
    updateBalance(viewingUserId, 'PI', 0.1)
    setAdCooldowns((prev) => ({ ...prev, [viewingUserId]: Date.now() + AD_COOLDOWN_MS }))
    addTransaction({
      id: `t_ad_${Date.now()}`,
      userId: viewingUserId,
      amount: 5000,
      date: new Date().toLocaleString('vi-VN'),
      note: 'Xem quảng cáo AdSense',
      type: 'TASK_AD',
    })
    showToast('Hoàn thành!', 'Nhận +5.000đ và 0.1 PI. Hệ thống đã chia hoa hồng cho tuyến trên.')
  }

  // ===================== Earn: Quiz task =====================
  const answerQuiz = () => {
    if (selectedAnswer === null) return
    const q = QUIZ_QUESTIONS[quizIndex]
    if (selectedAnswer === q.correct) {
      updateBalance(viewingUserId, q.reward.currency, q.reward.amount)
      addTransaction({
        id: `t_qz_${Date.now()}`,
        userId: viewingUserId,
        amount: q.baseValue,
        date: new Date().toLocaleString('vi-VN'),
        note: 'Hoàn thành bài Quiz y khoa',
        type: 'TASK_QUIZ',
      })
      showToast('Chính xác!', `Bạn nhận được ${q.reward.amount} ${CURRENCY_LABEL[q.reward.currency]}.`)
      if (quizIndex < QUIZ_QUESTIONS.length - 1) {
        window.setTimeout(() => { setQuizIndex((v) => v + 1); setSelectedAnswer(null) }, 1200)
      } else {
        setQuizCompleted((prev) => ({ ...prev, [viewingUserId]: true }))
      }
    } else {
      showToast('Chưa đúng!', 'Đáp án chưa chính xác, hãy thử lại nhé.', 'error')
    }
  }

  const resetQuiz = () => {
    setQuizIndex(0)
    setSelectedAnswer(null)
    setQuizCompleted((prev) => ({ ...prev, [viewingUserId]: false }))
  }

  const copyRefLink = () => {
    const params = new URLSearchParams({ ref: viewingUserId })
    if (me?.name) params.set('refName', me.name)
    const link = `${window.location.origin}/?${params.toString()}`
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(link).catch(() => {})
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
    showToast('Đã sao chép', `Liên kết giới thiệu: ${link}`)
  }

  // ===================== Admin: policy =====================
  const updateRate = (level, rateStr) => {
    const rate = parseFloat(rateStr) || 0
    setPolicy((prev) => prev.map((p) => (p.level === level ? { ...p, rate } : p)))
  }
  const addLevel = () => {
    const next = policy.length ? Math.max(...policy.map((p) => p.level)) + 1 : 1
    setPolicy((prev) => [...prev, { level: next, rate: 0 }])
  }
  const removeLevel = (level) => {
    setPolicy((prev) => prev.filter((p) => p.level !== level).map((p, i) => ({ ...p, level: i + 1 })))
  }

  const simulatePurchase = (e) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const userId = form.get('userId')
    const amount = parseFloat(form.get('amount'))
    const note = form.get('note') || 'Ủng hộ Quỹ Nhân Văn'
    if (!userId || !amount) return
    addTransaction({
      id: `t_${Date.now()}`,
      userId,
      amount,
      date: new Date().toLocaleString('vi-VN'),
      note,
      type: 'PURCHASE',
    })
    e.currentTarget.reset()
    showToast('Thành công', `Đã ghi nhận giao dịch ${formatMoney(amount)}đ và chia hoa hồng!`)
  }

  const analyzeSystem = async () => {
    setIsAnalyzing(true)
    setAiAnalysis('')
    const totalPaid = transactions.reduce((s, t) => s + t.amount, 0)
    const prompt = `Hệ thống Affiliate & Earn "Hiến Máu Nhân Văn" có chính sách hoa hồng: ${JSON.stringify(policy)}. Tổng ${users.length} thành viên, tổng ${transactions.length} giao dịch, tổng giá trị đã xử lý ${totalPaid} VNĐ. Hãy đưa ra 3 nhận xét ngắn gọn về rủi ro/lạm phát quỹ và 1 lời khuyên tối ưu chính sách, viết bằng tiếng Việt, súc tích.`
    const result = await callProjectAI(prompt)
    setAiAnalysis(result)
    setIsAnalyzing(false)
  }

  const generateMarketingCopy = async () => {
    setIsGeneratingCopy(true)
    const prompt = `Viết 1 đoạn bài đăng ngắn (dưới 40 từ) cho "${me?.name || 'thành viên'}" khoe vừa hoàn thành nhiệm vụ trên app "Hiến Máu Nhân Văn" và nhận được hoa hồng giới thiệu. Kêu gọi bạn bè tham gia qua link giới thiệu. Dùng vài emoji, giọng gần gũi, tiếng Việt.`
    const result = await callProjectAI(prompt)
    setMarketingCopy(result)
    setIsGeneratingCopy(false)
  }

  // ===================== Styling helpers (theo theme sáng/tối sẵn có của app) =====================
  const card = isDark ? 'bg-white/[0.03] border-white/10' : 'bg-white border-black/10'
  const textMain = isDark ? 'text-slate-100' : 'text-slate-900'
  const textDim = isDark ? 'text-slate-400' : 'text-slate-500'
  const pageBg = isDark ? 'bg-[#04060f]' : 'bg-[#f4f7fb]'

  const TABS = [
    { id: 'earn', label: 'Kiếm Tiền', icon: Wallet },
    ...(isAdmin ? [{ id: 'admin', label: 'Quản Trị', icon: Settings }] : []),
    { id: 'stats', label: 'Thống Kê', icon: Network },
  ]

  return (
    <div className={`min-h-full ${pageBg} ${textMain} px-4 md:px-8 py-6 pb-28`}>
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[300] max-w-sm rounded-xl border px-4 py-3 shadow-2xl ${toast.type === 'error' ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'}`}>
          <div className="font-bold text-sm">{toast.title}</div>
          <div className="text-xs opacity-90 mt-0.5">{toast.message}</div>
        </div>
      )}

      {/* Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 mb-6 ${isDark ? 'border-white/10' : 'border-black/10'}`}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.25)]">
            <HeartHandshake className="text-red-500 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-black">Affiliate & Earn Đa Tầng</h1>
            <p className={`text-xs ${textDim}`}>Chia sẻ ứng dụng · Kiếm thưởng · Đóng góp Quỹ Nhân Văn</p>
          </div>
        </div>
        <div className={`flex gap-1 rounded-xl border p-1 ${isDark ? 'border-white/10 bg-white/[0.03]' : 'border-black/10 bg-black/[0.03]'}`}>
          {TABS.map((t) => {
            const Icon = t.icon
            const activeTab = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition ${activeTab ? 'bg-cyan-500/20 text-cyan-300' : `${textDim} hover:text-current`}`}
              >
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {tab === 'earn' && (
        <div className="grid gap-5 md:grid-cols-3">
          {/* Balance card */}
          <div className={`rounded-2xl border p-5 md:col-span-1 ${card}`}>
            <div className="flex items-center gap-2 mb-3">
              <UserCircle size={18} className="text-cyan-400" />
              <span className="font-bold text-sm">{me?.name || 'Thành viên'}</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className={textDim}>Số dư VNĐ</span><span className="font-bold">{formatMoney(me?.realBalances?.VND)}đ</span></div>
              <div className="flex justify-between"><span className={textDim}>VIET Token</span><span className="font-bold">{formatMoney(me?.realBalances?.VIET)}</span></div>
              <div className="flex justify-between"><span className={textDim}>PI</span><span className="font-bold">{(me?.realBalances?.PI || 0).toFixed(2)}</span></div>
              <div className="flex justify-between pt-2 border-t border-white/10 mt-2">
                <span className={textDim}>Hoa hồng đã nhận</span>
                <span className="font-bold text-emerald-400">+{formatMoney(me?.totalCommissionVND)}đ</span>
              </div>
              <div className="flex justify-between"><span className={textDim}>Số F1 đang giới thiệu</span><span className="font-bold">{me?.f1Count || 0}</span></div>
            </div>

            <button
              type="button"
              onClick={copyRefLink}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-xs font-bold py-2.5 hover:bg-cyan-500/20 transition"
            >
              {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
              {copied ? 'Đã sao chép!' : 'Sao chép link giới thiệu'}
            </button>

            <button
              type="button"
              onClick={generateMarketingCopy}
              disabled={isGeneratingCopy}
              className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-bold py-2.5 hover:bg-violet-500/20 transition disabled:opacity-60"
            >
              {isGeneratingCopy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              AI viết bài chia sẻ giúp bạn
            </button>
            {marketingCopy && (
              <div className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed ${isDark ? 'border-white/10 bg-black/20' : 'border-black/10 bg-black/5'}`}>
                <MessageSquareText size={12} className="inline mr-1 text-violet-400" />
                {marketingCopy}
              </div>
            )}
          </div>

          {/* Ad task */}
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-3">
              <PlayCircle size={18} className="text-amber-400" />
              <span className="font-bold text-sm">Xem quảng cáo nhận thưởng</span>
            </div>
            <p className={`text-xs mb-4 ${textDim}`}>Xem quảng cáo mô phỏng để nhận 5.000đ + 0.1 PI. Có thể làm lại sau mỗi 4 giờ.</p>

            {isWatchingAd ? (
              <div className="text-center py-8">
                <Loader2 className="animate-spin mx-auto mb-3 text-amber-400" size={28} />
                <div className="text-2xl font-black">{adTimer}s</div>
                <div className={`text-xs ${textDim}`}>Đang xem quảng cáo…</div>
              </div>
            ) : adOnCooldown ? (
              <div className="text-center py-8">
                <Clock className="mx-auto mb-3 text-slate-500" size={28} />
                <div className="text-lg font-mono font-bold">{fmtCooldown(cooldownLeft)}</div>
                <div className={`text-xs ${textDim}`}>Quay lại sau để nhận thêm</div>
              </div>
            ) : (
              <button
                type="button"
                onClick={startAdTask}
                className="w-full py-8 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 font-bold text-sm hover:bg-amber-500/20 transition"
              >
                ▶ Bắt đầu xem ({AD_WATCH_SECONDS}s)
              </button>
            )}
          </div>

          {/* Quiz task */}
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-3">
              <GraduationCap size={18} className="text-emerald-400" />
              <span className="font-bold text-sm">Quiz kiến thức y khoa</span>
            </div>
            {quizDone ? (
              <div className="text-center py-6">
                <CheckCircle2 className="mx-auto mb-2 text-emerald-400" size={28} />
                <div className={`text-xs ${textDim} mb-3`}>Bạn đã hoàn thành hết các câu hỏi hôm nay!</div>
                <button type="button" onClick={resetQuiz} className="text-xs font-bold text-cyan-400 hover:underline">Làm lại để ôn tập</button>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold mb-3">{QUIZ_QUESTIONS[quizIndex].question}</p>
                <div className="space-y-2">
                  {QUIZ_QUESTIONS[quizIndex].options.map((opt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedAnswer(i)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition ${selectedAnswer === i ? 'border-cyan-400 bg-cyan-500/15 text-cyan-200' : `${isDark ? 'border-white/10' : 'border-black/10'} hover:border-cyan-400/40`}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={answerQuiz}
                  disabled={selectedAnswer === null}
                  className="mt-3 w-full py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/25 transition disabled:opacity-50"
                >
                  Trả lời ({quizIndex + 1}/{QUIZ_QUESTIONS.length})
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'admin' && isAdmin && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2"><Settings size={18} className="text-cyan-400" /><span className="font-bold text-sm">Chính sách hoa hồng theo tầng</span></div>
              <button type="button" onClick={addLevel} className="flex items-center gap-1 text-xs font-bold text-cyan-400 hover:underline"><Plus size={13} /> Thêm tầng</button>
            </div>
            <div className="space-y-2">
              {policy.map((p) => (
                <div key={p.level} className="flex items-center gap-2">
                  <span className="w-14 text-xs font-bold shrink-0">Tầng F{p.level}</span>
                  <input
                    type="number"
                    step="0.5"
                    value={p.rate}
                    onChange={(e) => updateRate(p.level, e.target.value)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-sm bg-transparent ${isDark ? 'border-white/15' : 'border-black/15'}`}
                  />
                  <span className={`text-xs ${textDim}`}>%</span>
                  <button type="button" onClick={() => removeLevel(p.level)} className="text-red-400 hover:text-red-300"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={analyzeSystem}
              disabled={isAnalyzing}
              className="mt-4 w-full flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-bold py-2.5 hover:bg-violet-500/20 transition disabled:opacity-60"
            >
              {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <Lightbulb size={14} />}
              AI phân tích rủi ro quỹ
            </button>
            {aiAnalysis && (
              <div className={`mt-3 rounded-xl border p-3 text-xs leading-relaxed whitespace-pre-wrap ${isDark ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                <AlertTriangle size={12} className="inline mr-1 text-amber-400" />
                {aiAnalysis}
              </div>
            )}
          </div>

          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-3"><ShoppingCart size={18} className="text-emerald-400" /><span className="font-bold text-sm">Mô phỏng giao dịch / Ủng hộ quỹ</span></div>
            <form onSubmit={simulatePurchase} className="space-y-3">
              <select name="userId" required className={`w-full rounded-lg border px-3 py-2 text-sm bg-transparent ${isDark ? 'border-white/15' : 'border-black/15'}`}>
                {users.map((u) => <option key={u.id} value={u.id} className="bg-[#111]">{u.name}</option>)}
              </select>
              <input name="amount" type="number" min="1000" step="1000" required placeholder="Số tiền (VNĐ)" className={`w-full rounded-lg border px-3 py-2 text-sm bg-transparent ${isDark ? 'border-white/15' : 'border-black/15'}`} />
              <input name="note" type="text" placeholder="Ghi chú (tuỳ chọn)" className={`w-full rounded-lg border px-3 py-2 text-sm bg-transparent ${isDark ? 'border-white/15' : 'border-black/15'}`} />
              <button type="submit" className="w-full py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold hover:bg-cyan-500/25 transition flex items-center justify-center gap-2">
                <DollarSign size={14} /> Ghi nhận & chia hoa hồng
              </button>
            </form>

            <div className="mt-5">
              <div className={`flex items-center gap-2 mb-2 text-xs font-bold ${textDim}`}><Users size={14} /> Cây thành viên ({users.length})</div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                {users.map((u) => (
                  <div key={u.id} className={`flex items-center justify-between text-xs rounded-lg px-2.5 py-1.5 ${isDark ? 'bg-white/[0.03]' : 'bg-black/[0.03]'}`}>
                    <span className="flex items-center gap-1.5">
                      {u.parentId ? <ArrowRight size={11} className="opacity-40" /> : null}
                      {u.name}
                    </span>
                    <span className={textDim}>{u.parentId ? `↳ ${users.find((p) => p.id === u.parentId)?.name || '—'}` : 'Gốc'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'stats' && (
        <div className="grid gap-5">
          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-4"><Network size={18} className="text-cyan-400" /><span className="font-bold text-sm">Bảng xếp hạng thu nhập hệ thống</span></div>
            {chartData.length ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: isDark ? '#94a3b8' : '#475569' }} />
                    <Tooltip contentStyle={{ background: isDark ? '#0d1226' : '#fff', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }} />
                    <Bar dataKey="Hoa hồng (VNĐ)" fill="#00e5ff" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className={`text-xs ${textDim}`}>Chưa có hoa hồng nào được ghi nhận.</p>
            )}
          </div>

          <div className={`rounded-2xl border p-5 ${card}`}>
            <div className="flex items-center gap-2 mb-3"><History size={18} className="text-violet-400" /><span className="font-bold text-sm">Sổ cái hoa hồng (minh bạch, thời gian thực)</span></div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className={`text-left ${textDim} border-b ${isDark ? 'border-white/10' : 'border-black/10'}`}>
                    <th className="py-2 pr-2">Ngày</th>
                    <th className="py-2 pr-2">Người mua</th>
                    <th className="py-2 pr-2">Người nhận (Tầng)</th>
                    <th className="py-2 pr-2 text-right">Hoa hồng</th>
                  </tr>
                </thead>
                <tbody>
                  {[...commissions].reverse().map((c) => (
                    <tr key={c.id} className={`border-b ${isDark ? 'border-white/5' : 'border-black/5'}`}>
                      <td className="py-2 pr-2 whitespace-nowrap">{c.date}</td>
                      <td className="py-2 pr-2">{c.buyerName}</td>
                      <td className="py-2 pr-2">{c.referrerName} <span className={textDim}>(F{c.level} · {c.rate}%)</span></td>
                      <td className="py-2 pr-2 text-right font-bold text-emerald-400">+{formatMoney(c.amount)}đ</td>
                    </tr>
                  ))}
                  {!commissions.length && (
                    <tr><td colSpan={4} className={`py-4 text-center ${textDim}`}>Chưa có giao dịch nào.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Điều hướng đồng bộ với các panel khác trong app */}
      {(onPrev || onNext) && (
        <div className="flex justify-between mt-8">
          {onPrev ? (
            <button type="button" onClick={onPrev} className={`text-xs font-bold px-4 py-2 rounded-lg border ${isDark ? 'border-white/10 text-slate-300' : 'border-black/10 text-slate-600'}`}>← {prevLabel || 'Trước'}</button>
          ) : <span />}
          {onNext ? (
            <button type="button" onClick={onNext} className="text-xs font-bold px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">{nextLabel || 'Tiếp'} →</button>
          ) : <span />}
        </div>
      )}
    </div>
  )
}
