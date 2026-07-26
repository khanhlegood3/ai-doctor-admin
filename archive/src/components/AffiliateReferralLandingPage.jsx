import React, { useMemo, useState } from 'react'
import { HeartHandshake, ShieldCheck, Users, Gift, ArrowRight, CheckCircle2, Stethoscope } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const REFERRAL_CODES_STORAGE_KEY = 'affiliate-control-referral-codes-v1'
const AFFILIATE_STATE_KEY = 'cdoc_affiliate_v1'
const REFERRAL_SIGNUPS_KEY = 'affiliate-referral-signups-v1'

const SEED_REFERRERS = {
  u1: 'Admin (Hệ Thống)',
  u2: 'Nguyễn Văn A',
  u3: 'Trần Thị B',
  u4: 'Lê Văn C',
  u5: 'Phạm Thị D',
  u6: 'Hoàng Văn E',
}

const defaultBalances = { VND: 0, VIET: 0, PI: 0 }

function safeJson(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try { return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback)) || fallback } catch { return fallback }
}

function getReferralCodeFromPath() {
  if (typeof window === 'undefined') return ''
  const match = window.location.pathname.match(/^\/r\/([^/?#]+)/i)
  return match ? decodeURIComponent(match[1]) : ''
}

function resolveReferrer(code) {
  const codes = safeJson(REFERRAL_CODES_STORAGE_KEY, {})
  const referrerId = Object.entries(codes).find(([, storedCode]) => storedCode === code)?.[0] || null
  const affiliateState = safeJson(AFFILIATE_STATE_KEY, {})
  const referrerName = affiliateState?.users?.find?.((u) => u.id === referrerId)?.name || SEED_REFERRERS[referrerId] || 'Đối tác giới thiệu'
  return { referrerId, referrerName }
}

function saveSignupRecord({ code, referrerId, newUser, source }) {
  const signups = safeJson(REFERRAL_SIGNUPS_KEY, [])
  const nextSignup = {
    id: `ref_signup_${Date.now()}`,
    referralCode: code,
    referrerId,
    childUserId: newUser?.uuid ? `me-${newUser.uuid}` : null,
    childEmail: newUser?.email || null,
    childName: newUser?.name || 'Thành viên F1 mới',
    source,
    createdAt: new Date().toISOString(),
  }
  window.localStorage.setItem(REFERRAL_SIGNUPS_KEY, JSON.stringify([nextSignup, ...signups]))

  if (!referrerId || !newUser?.uuid) return
  const state = safeJson(AFFILIATE_STATE_KEY, {})
  const users = Array.isArray(state.users) ? state.users : []
  const childId = `me-${newUser.uuid}`
  const childUser = {
    id: childId,
    name: newUser.name || newUser.email || 'Thành viên F1 mới',
    parentId: referrerId,
    balances: { ...defaultBalances },
  }
  const nextUsers = users.some((u) => u.id === childId)
    ? users.map((u) => u.id === childId ? { ...u, name: childUser.name, parentId: referrerId } : u)
    : [...users, childUser]
  window.localStorage.setItem(AFFILIATE_STATE_KEY, JSON.stringify({ ...state, users: nextUsers }))
}

export default function AffiliateReferralLandingPage() {
  const { loginWithEmail, loginAnonymous } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

  const referralCode = useMemo(getReferralCodeFromPath, [])
  const { referrerId, referrerName } = useMemo(() => resolveReferrer(referralCode), [referralCode])

  const handleRegister = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage(null)
    try {
      const newUser = await loginWithEmail(email.trim(), password, name.trim())
      saveSignupRecord({ code: referralCode, referrerId, newUser, source: 'email' })
      setMessage({ type: 'success', text: `Đăng ký F1 thành công dưới link Ref của ${referrerName}.` })
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Không thể đăng ký tài khoản.' })
    } finally {
      setLoading(false)
    }
  }

  const handleAnonymous = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const newUser = await loginAnonymous()
      saveSignupRecord({ code: referralCode, referrerId, newUser, source: 'anonymous' })
      setMessage({ type: 'success', text: `Đã bắt đầu ẩn danh và ghi nhận bạn là F1 của ${referrerName}.` })
    } catch (error) {
      setMessage({ type: 'error', text: error?.message || 'Không thể bắt đầu ẩn danh.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f4fbf7] text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-cyan-700 text-white">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 20%, #fff 0, transparent 24%), radial-gradient(circle at 80% 0%, #7dd3fc 0, transparent 28%)' }} />
        <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-12 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-16">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold backdrop-blur">
              <HeartHandshake className="h-4 w-4 text-red-200" /> Link Ref tuyển dụng F1
            </div>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">Tham gia cộng đồng Hiến Máu Nhân Văn</h1>
            <p className="mt-5 max-w-2xl text-lg text-emerald-50/90">Bạn đang đăng ký qua link giới thiệu của <b>{referrerName}</b>. Hoàn tất thông tin để trở thành F1, nhận nhiệm vụ sức khỏe, tích thưởng và cùng lan tỏa hành động nhân văn.</p>
            <div className="mt-7 grid gap-3 text-sm sm:grid-cols-3">
              {[['Minh bạch tuyến F1', Users], ['Bảo mật hồ sơ', ShieldCheck], ['Nhận thưởng nhiệm vụ', Gift]].map(([label, Icon]) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur"><Icon className="mb-2 h-6 w-6 text-emerald-200" /><b>{label}</b></div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/20 bg-white p-5 text-slate-900 shadow-2xl md:p-7">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><Stethoscope /></div>
              <div><h2 className="text-2xl font-black">Đăng ký F1</h2><p className="text-sm text-slate-500">Mã Ref: <span className="font-mono font-bold text-emerald-700">{referralCode}</span></p></div>
            </div>
            <form onSubmit={handleRegister} className="space-y-3">
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Họ và tên" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-400" />
              <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email đăng nhập" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-400" />
              <input required minLength={4} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-emerald-400" />
              {message && <div className={`rounded-2xl px-4 py-3 text-sm font-semibold ${message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{message.text}</div>}
              <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:opacity-60">
                {loading ? 'Đang xử lý...' : 'Tạo tài khoản F1'} <ArrowRight className="h-5 w-5" />
              </button>
            </form>
            <button onClick={handleAnonymous} disabled={loading} className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60">Bắt đầu ẩn danh trước</button>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <div className="mb-2 flex items-center gap-2 font-bold text-slate-800"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Sau khi đăng ký</div>
              Hệ thống lưu quan hệ F1 vào trình duyệt: bạn là F1 của người sở hữu link Ref, phục vụ demo Affiliate Control Panel trên cùng thiết bị.
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
