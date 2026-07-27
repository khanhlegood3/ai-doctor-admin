import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { FAMILY_MEMBERS_CHANGED_EVENT, FAMILY_USER_STORAGE_KEY, LXK_PATIENT_PROFILE, getFamilyOwnerKey } from '../components/family/familyData.js'
import { getAnonSession, saveAnonSession, updateAnonSession, deleteAnonSession, clearAllGuestData, migrateGuestDataToUuid } from '../lib/anonDB.js'

const AuthContext = createContext(null)
const ADMIN_EMAIL = 'khanhlegood1@gmail.com'

// ─── Vai trò (role) & Gói thành viên (membership) ─────────────────────────
// role: 'admin' (Super Admin — cố định theo ADMIN_EMAIL) | 'sub_admin' | 'user'
// membership: 'vip_pro' | 'free'
// Lưu trực tiếp trong record user trong localStorage (cdoc_users), do
// Super Admin gán/thu hồi qua panel Quản Trị Vai Trò & Thành Viên.
const ROLE_SUB_ADMIN = 'sub_admin'
const MEMBERSHIP_VIP_PRO = 'vip_pro'
function enrichRoleFields(u) {
  const role = u.email === ADMIN_EMAIL ? 'admin' : (u.role || 'user')
  const membership = u.membership || 'free'
  return {
    role,
    membership,
    isSubAdmin: role === ROLE_SUB_ADMIN,
    isVIPPro: membership === MEMBERSHIP_VIP_PRO,
  }
}

const getUsers = () => { try { return JSON.parse(localStorage.getItem('cdoc_users') || '{}') } catch { return {} } }
const saveUsers = (u) => localStorage.setItem('cdoc_users', JSON.stringify(u))
const getSavedSession = () => { try { return JSON.parse(localStorage.getItem('cdoc_session') || 'null') } catch { return null } }
const saveSession = (s) => s ? localStorage.setItem('cdoc_session', JSON.stringify(s)) : localStorage.removeItem('cdoc_session')

// ─── "Khoá sở hữu" cho /api/user-profile (Mức 1) ──────────────────────────
// Sinh 1 LẦN DUY NHẤT cho mỗi uuid, lưu cục bộ, KHÔNG rời khỏi thiết bị trừ
// lúc gửi kèm request cập nhật tên — server dùng nó để xác nhận đúng "chủ"
// UUID đang cập nhật, chặn thiết bị khác tự đặt tên giả cho UUID không phải
// của họ (xem chú thích chi tiết trong api/user-profile.js).
const PROFILE_SECRET_PREFIX = 'cdoc_profile_secret:'
function getOrCreateProfileSecret(uuid) {
  if (!uuid) return null
  const key = `${PROFILE_SECRET_PREFIX}${uuid}`
  try {
    let secret = localStorage.getItem(key)
    if (!secret) {
      secret = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`)
      localStorage.setItem(key, secret)
    }
    return secret
  } catch {
    return null
  }
}

const syncPrimaryPatientNameInFamilyTree = (ownerId, name, avatar = '') => {
  const patientName = String(name || '').trim()
  const patientAvatar = String(avatar || '').trim()
  if (!ownerId || (!patientName && !patientAvatar)) return
  try {
    const ownerKey = getFamilyOwnerKey(ownerId)
    const byUser = JSON.parse(localStorage.getItem(FAMILY_USER_STORAGE_KEY) || '{}')
    const userPatients = byUser[ownerKey]
    const members = userPatients?.['LXK-2024']
    if (!Array.isArray(members)) return

    let changed = false
    const nextMembers = members.map(member => {
      if (member?.relation !== 'self' && member?.id !== LXK_PATIENT_PROFILE.id) return member
      const nextName = patientName || member.name
      const nextAvatar = patientAvatar || member.avatar_url
      if (member.name === nextName && member.avatar_url === nextAvatar && member.medicalRecord?.name === nextName && member.medicalRecord?.avatar_url === nextAvatar) return member
      changed = true
      return {
        ...member,
        name: nextName,
        ...(nextAvatar ? { avatar_url: nextAvatar } : {}),
        medicalRecord: member.medicalRecord ? {
          ...member.medicalRecord,
          name: nextName,
          avatar_initials: nextName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase(),
          ...(nextAvatar ? { avatar_url: nextAvatar } : {}),
        } : member.medicalRecord,
      }
    })
    if (!changed) return

    byUser[ownerKey] = { ...userPatients, 'LXK-2024': nextMembers }
    localStorage.setItem(FAMILY_USER_STORAGE_KEY, JSON.stringify(byUser))
    window.dispatchEvent(new CustomEvent(FAMILY_MEMBERS_CHANGED_EVENT, {
      detail: { patientId: 'LXK-2024', ownerId: ownerKey },
    }))
  } catch (e) { console.error('Profile-to-family sync error:', e) }
}

// Simulate Google OAuth — in production replace with real Google Sign-In SDK
// Returns a profile object mimicking what Google's ID token gives you
// ─── Google Identity Services (real OAuth popup) ──────────────────────────────
// Replace VITE_GOOGLE_CLIENT_ID in your .env with your actual OAuth 2.0 Client ID
// from https://console.cloud.google.com → APIs & Services → Credentials
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

function googleOAuthPopup() {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('VITE_GOOGLE_CLIENT_ID chưa được cấu hình trong file .env'))
      return
    }

    // Wait for GSI library to load
    const tryInit = (retries = 20) => {
      if (typeof window.google === 'undefined' || !window.google?.accounts?.oauth2) {
        if (retries <= 0) { reject(new Error('Google Identity Services chưa tải xong')); return }
        setTimeout(() => tryInit(retries - 1), 200)
        return
      }

      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (tokenResponse) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error))
            return
          }
          try {
            // Fetch real user profile from Google People API
            const res = await fetch(
              `https://www.googleapis.com/oauth2/v3/userinfo`,
              { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
            )
            if (!res.ok) throw new Error('Không lấy được thông tin tài khoản Google')
            const info = await res.json()
            resolve({
              email: info.email,
              name: info.name,
              given_name: info.given_name || '',
              family_name: info.family_name || '',
              picture: info.picture || '',
              provider: 'google',
              email_verified: info.email_verified ?? true,
              locale: info.locale || 'vi',
            })
          } catch (err) {
            reject(err)
          }
        },
        error_callback: (err) => {
          // User closed popup or denied permission — treat as cancellation
          reject(new Error(err?.message || 'Đăng nhập Google bị huỷ'))
        },
      })
      client.requestAccessToken({ prompt: 'select_account' })
    }

    tryInit()
  })
}

function simulateAppleOAuth() {
  return {
    email: 'user@icloud.com',
    name: 'Apple User',
    given_name: 'Apple',
    family_name: 'User',
    picture: `https://ui-avatars.com/api/?name=Apple+User&background=1c1c1e&color=fff&size=128&bold=true&rounded=true`,
    provider: 'apple',
    email_verified: true,
    locale: 'vi',
  }
}

// ─── Anonymous UUID Generator ─────────────────────────────────────────────────
// Format: HEALTH-YYYYMMDDhhmmss-XXXXXXXX-SALT
// SALT = short hash derived from browser fingerprint (userAgent + screen + timezone)
function generateAnonUUID() {
  const now = new Date()
  const pad = (n, l = 2) => String(n).padStart(l, '0')
  const timestamp =
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  const random = Math.floor(10000000 + Math.random() * 90000000) // 8 digits
  // Device salt: simple non-cryptographic fingerprint
  const raw = `${navigator.userAgent}|${screen.width}x${screen.height}|${Intl.DateTimeFormat().resolvedOptions().timeZone}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0 }
  const salt = Math.abs(hash).toString(36).toUpperCase().padStart(6, '0').slice(0, 6)
  return `HEALTH-${timestamp}-${random}-${salt}`
}

function seedAdmin() {
  const users = getUsers()
  if (!users[ADMIN_EMAIL]) {
    const adminName = 'Lê Xuân Khánh'
    const adminAvatar = `https://ui-avatars.com/api/?name=Le+Xuan+Khanh&background=00b8cc&color=fff&size=128&bold=true&rounded=true`
    users[ADMIN_EMAIL] = {
      email: ADMIN_EMAIL,
      uuid: generateAnonUUID(),
      name: adminName,
      given_name: 'Khánh',
      family_name: 'Lê',
      // Use Google avatar as default — user can change later
      avatar: adminAvatar,
      googleAvatar: adminAvatar, // keep original Google avatar
      provider: 'google',
      password: 'admin123',
      specialty: 'Quản trị hệ thống',
      phone: '',
      profileComplete: true, // admin profile pre-seeded
      createdAt: '2024-01-01T00:00:00.000Z',
      patients: [],
      records: [],
    }
    saveUsers(users)
  } else if (!users[ADMIN_EMAIL].uuid) {
    // Backfill uuid for an admin record seeded before uuid existed
    users[ADMIN_EMAIL].uuid = generateAnonUUID()
    saveUsers(users)
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // needsProfileSetup = true right after first OAuth login, triggers setup modal
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false)

  useEffect(() => {
    const init = async () => {
      seedAdmin()
      // 1. Restore named session first
      const session = getSavedSession()
      if (session) {
        const users = getUsers()
        if (users[session.email]) {
          let restored = users[session.email]
          if (!restored.uuid) {
            restored = { ...restored, uuid: generateAnonUUID() }
            users[session.email] = restored
            saveUsers(users)
          }
          setUser({ ...restored, isAdmin: session.email === ADMIN_EMAIL, ...enrichRoleFields(restored) })
          setLoading(false)
          return
        }
      }
      // 2. Restore anonymous session from IndexedDB
      try {
        const anon = await getAnonSession()
        // `uuid` is the unified identifier field (same name used for every
        // user type). Older guest sessions stored it as `anonUUID` — accept
        // either so an existing guest's journey is never lost on this device.
        const existingUUID = anon?.uuid || anon?.anonUUID
        if (existingUUID) {
          const backfilled = {
            given_name: '', family_name: '', specialty: '', phone: '',
            avatarCustomized: false, profileComplete: false,
            level: 1, journeyProgress: 0, achievements: 0,
            ...anon,
            uuid: existingUUID,
          }
          delete backfilled.anonUUID
          if (!anon.uuid) {
            // One-time migration: persist under the new field name going forward
            updateAnonSession({ uuid: existingUUID }).catch(() => {})
          }
          setUser({ ...backfilled, isAnonymous: true, isAdmin: false })
        }
      } catch (e) {
        console.warn('anonDB restore failed, falling back to localStorage', e)
      }
      setLoading(false)
    }
    init()
  }, [])

  // ─── Đồng bộ TÊN của chính mình lên server theo UUID (best-effort) ───────
  // Không có bước này, LoginPage (trang Đăng ký) sẽ KHÔNG thể tự tra ra tên
  // của người giới thiệu (referrer) khi họ ở 1 thiết bị/trình duyệt khác —
  // vì trước giờ tên chỉ nằm trong localStorage/IndexedDB CỤC BỘ của chính
  // họ. Chạy lại mỗi khi uuid/tên đổi (debounce nhẹ qua ref để tránh spam
  // API lúc re-render liên tục); lỗi mạng bỏ qua, không chặn luồng chính.
  const lastSyncedProfileRef = useRef('')
  useEffect(() => {
    const uuid = user?.uuid
    const name = (user?.name || '').trim()
    if (!uuid || !name) return
    const key = `${uuid}:${name}`
    if (lastSyncedProfileRef.current === key) return
    lastSyncedProfileRef.current = key
    const secret = getOrCreateProfileSecret(uuid)
    if (!secret) return // localStorage không dùng được (vd Safari Private) -> bỏ qua, không có cách chứng minh sở hữu
    // Chỉ đánh dấu verified khi tên đến từ 1 provider OAuth đã xác thực danh
    // tính (Google/Apple) — tên tự gõ tay lúc đăng ký email/ẩn danh KHÔNG
    // được coi là verified (xem Mức 2).
    const verified = user?.provider === 'google' || user?.provider === 'apple'
    // User ID KHÔNG còn được hỏi lúc đăng ký nữa (chỉ đặt sau, từ màn Profile
    // qua updateUserId() bên dưới) — lần đồng bộ tên này không kèm userId.
    fetch('/api/user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid, name, secret, verified }),
    })
      .catch(() => { /* ignore — không có mạng cũng không sao, thử lại ở lần đổi tên tiếp theo */ })
  }, [user?.uuid, user?.name, user?.provider])

  // ─── Đồng bộ NGƯỢC userId từ server nếu thiết bị này chưa có cục bộ ──────
  // Trường hợp: tài khoản tạo trước khi có tính năng User ID, hoặc lưu cục bộ
  // bị mất/thất bại ở lần trước — server (uuid -> userId) vẫn là nguồn sự
  // thật cuối cùng, nên khi phát hiện thiếu, hỏi lại 1 lần rồi cache vào
  // state + storage cục bộ. Best-effort, im lặng bỏ qua nếu lỗi mạng.
  const userIdReconcileRef = useRef('')
  useEffect(() => {
    const uuid = user?.uuid
    if (!uuid || user?.userId) return
    if (userIdReconcileRef.current === uuid) return
    userIdReconcileRef.current = uuid
    fetch(`/api/user-profile?uuid=${encodeURIComponent(uuid)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!data?.userId) return
        setUser(u => (u && u.uuid === uuid && !u.userId) ? { ...u, userId: data.userId } : u)
        if (user?.isAnonymous) {
          updateAnonSession({ userId: data.userId }).catch(() => {})
        } else if (user?.email) {
          try {
            const users = getUsers()
            if (users[user.email]) { users[user.email].userId = data.userId; saveUsers(users) }
          } catch { /* ignore */ }
        }
      })
      .catch(() => { /* ignore */ })
  }, [user?.uuid, user?.userId])

  // Enrich and save a new or returning user, then set as current session
  const _finalize = (u) => {
    const enriched = { ...u, isAdmin: u.email === ADMIN_EMAIL, ...enrichRoleFields(u) }
    setUser(enriched)
    saveSession({ email: u.email })
    return enriched
  }

  // ── Uuid cho TÀI KHOẢN THẬT mới tạo (đăng ký email hoặc lần đầu login
  // Google/Apple) ───────────────────────────────────────────────────────────
  // Yêu cầu: uuid CHỈ được sinh 1 LẦN DUY NHẤT — nếu thiết bị này đã có 1
  // phiên "khách" (anonymous, vd từ lúc bấm nút mic trên Anh Hùng Hiến Tặng
  // hoặc "Tiếp tục với tư cách khách") thì tài khoản thật phải TÁI SỬ DỤNG
  // đúng uuid đó thay vì sinh uuid mới, để mọi thứ đã lưu theo uuid (lịch sử
  // chat, v.v.) tự động "đồng bộ" sang tài khoản thật — không bị tách rời
  // thành 2 danh tính khác nhau. Chỉ khi thiết bị CHƯA từng có phiên nào
  // (guest lẫn tài khoản) mới sinh uuid mới hoàn toàn.
  const resolveUUIDForNewAccount = async () => {
    // Nếu đang có 1 link giới thiệu (?ref=...) chờ xử lý TRÙNG với chính uuid
    // ẩn danh sắp được tái sử dụng bên dưới -> đây rất có thể là ca "User 1
    // dùng máy này (đang có sẵn phiên ẩn danh của User 1) để đăng ký tài
    // khoản THẬT (email/Google) CHO User 2, bằng đúng link giới thiệu của
    // chính User 1" — vd ngồi cạnh nhau, User 1 đưa máy cho User 2 gõ email/
    // chọn tài khoản Google của User 2. Nếu cứ tái sử dụng uuid ẩn danh như
    // bình thường, tài khoản MỚI (của User 2) sẽ vô tình trùng UUID với
    // chính người giới thiệu (User 1) -> biến 1 lượt giới thiệu hợp lệ thành
    // "tự giới thiệu chính mình" (bị chặn) một cách oan uổng. Trường hợp này
    // KHÔNG tái sử dụng uuid ẩn danh — sinh uuid mới hoàn toàn cho tài khoản
    // thật, để quan hệ F1 giữa 2 người tách biệt được ghi nhận đúng.
    const pendingReferralUuid = (() => {
      try {
        return JSON.parse(sessionStorage.getItem('cdoc_pending_referral') || 'null')?.uuid || null
      } catch { return null }
    })()

    // 1. Phiên anonymous đang có sẵn trong state (đã gọi loginAnonymous() ở
    // tab này, vd qua nút mic) -> dùng luôn, khỏi cần đọc IndexedDB.
    if (user?.isAnonymous && user?.uuid && user.uuid !== pendingReferralUuid) {
      // Khoá lại toàn bộ dữ liệu journey/inventory/records đang ở "bucket
      // khách chung" của thiết bị vào ĐÚNG uuid vừa nâng cấp — nếu không làm
      // bước này, dữ liệu đó vẫn nằm ở dạng "chưa có chủ" và một vị khách
      // khác dùng chung thiết bị sau khi đăng xuất có thể vô tình ghi đè lên.
      migrateGuestDataToUuid(user.uuid).catch(() => {})
      // Uuid này vừa được "thăng cấp" thành tài khoản thật -> xoá phiên
      // anonymous cũ trong IndexedDB, để nếu có 1 khách KHÁC dùng chung
      // thiết bị này sau khi đăng xuất, loginAnonymous() sẽ sinh uuid mới
      // thay vì vô tình dùng lại uuid đã thuộc về tài khoản vừa tạo.
      deleteAnonSession().catch(() => {})
      return user.uuid
    }
    // 2. Chưa có trong state (vd người dùng mở thẳng form đăng ký mà chưa
    // từng bấm mic/"Tiếp tục với tư cách khách" trong tab này) -> vẫn có
    // thể đã tồn tại phiên anonymous từ lần ghé thăm trước TRÊN CÙNG THIẾT
    // BỊ (lưu bền trong IndexedDB) -> đọc ra dùng lại.
    try {
      const anon = await getAnonSession()
      const existingUUID = anon?.uuid || anon?.anonUUID
      if (existingUUID && existingUUID !== pendingReferralUuid) {
        migrateGuestDataToUuid(existingUUID).catch(() => {}) // tương tự lý do ở nhánh (1)
        deleteAnonSession().catch(() => {}) // tương tự lý do ở nhánh (1)
        return existingUUID
      }
    } catch (e) {
      console.warn('Không đọc được phiên anonymous khi tạo tài khoản mới:', e)
    }
    // 3. Thật sự chưa từng có phiên nào trước đó (hoặc bị bỏ qua ở trên vì
    // trùng chính người giới thiệu) -> sinh uuid mới duy nhất 1 lần.
    return generateAnonUUID()
  }

  // Create user from OAuth profile if first time, else merge only non-overridable fields
  const _upsertOAuth = async (oauthProfile) => {
    const users = getUsers()
    const existing = users[oauthProfile.email]

    if (!existing) {
      // First-time login: seed from Google/Apple profile
      const newUser = {
        email: oauthProfile.email,
        uuid: await resolveUUIDForNewAccount(),
        name: oauthProfile.name,                  // from Google
        given_name: oauthProfile.given_name,
        family_name: oauthProfile.family_name,
        avatar: oauthProfile.picture,             // Google photo
        googleAvatar: oauthProfile.picture,       // keep original; used in profile UI
        provider: oauthProfile.provider,
        email_verified: oauthProfile.email_verified,
        locale: oauthProfile.locale || 'vi',
        specialty: '',
        phone: '',
        profileComplete: false,                   // trigger profile-setup prompt
        password: null,
        patients: [],
        records: [],
        createdAt: new Date().toISOString(),
      }
      users[oauthProfile.email] = newUser
      saveUsers(users)
      setNeedsProfileSetup(true)              // show profile setup after login
      return _finalize(newUser)
    } else {
      // Returning user: refresh Google avatar in case it changed, but keep custom name if set
      const refreshed = {
        ...existing,
        uuid: existing.uuid || generateAnonUUID(), // backfill for accounts created before uuid existed
        googleAvatar: oauthProfile.picture,   // always sync latest Google photo
        // Only update avatar if user hasn't customised it
        avatar: existing.avatarCustomized ? existing.avatar : oauthProfile.picture,
      }
      users[oauthProfile.email] = refreshed
      saveUsers(users)
      return _finalize(refreshed)
    }
  }

  // ── Anonymous login: no account needed, progress stored in IndexedDB ────────
  const loginAnonymous = async () => {
    // Reuse existing anon session if present (same device)
    try {
      const existing = await getAnonSession()
      const existingUUID = existing?.uuid || existing?.anonUUID
      if (existingUUID) {
        const backfilled = {
          given_name: '', family_name: '', specialty: '', phone: '',
          avatarCustomized: false, profileComplete: false,
          level: 1, journeyProgress: 0, achievements: 0,
          ...existing,
          uuid: existingUUID,
        }
        delete backfilled.anonUUID
        if (!existing.uuid) {
          // One-time migration: persist under the new field name going forward
          updateAnonSession({ uuid: existingUUID }).catch(() => {})
        }
        const anonUser = { ...backfilled, isAnonymous: true, isAdmin: false }
        setUser(anonUser)
        return anonUser
      }
    } catch (e) {
      console.warn('anonDB read failed', e)
    }
    const uuid = generateAnonUUID()
    const anonUser = {
      uuid,
      name: 'Guest Explorer',
      given_name: 'Guest',
      family_name: 'Explorer',
      email: null,
      provider: 'anonymous',
      isAnonymous: true,
      isAdmin: false,
      avatar: null,
      avatarCustomized: false,
      specialty: '',
      phone: '',
      profileComplete: false,
      level: 1,
      journeyProgress: 0,
      achievements: 0,
      createdAt: new Date().toISOString(),
    }
    try {
      await saveAnonSession(anonUser)
    } catch (e) {
      console.warn('anonDB write failed, session will not persist', e)
    }
    setUser(anonUser)
    return anonUser
  }

  const loginWithGoogle = async (adminHint = null) => {
    // adminHint kept for backward-compat but real OAuth always opens popup
    const profile = await googleOAuthPopup()
    return _upsertOAuth(profile)
  }

  const loginWithApple = async () => {
    const profile = simulateAppleOAuth()
    return _upsertOAuth(profile)
  }

  const loginWithEmail = async (email, password, name = null) => {
    const users = getUsers()
    if (name) {
      // Register
      if (users[email]) throw new Error('Email đã tồn tại. Vui lòng đăng nhập.')
      const u = {
        email, name,
        uuid: await resolveUUIDForNewAccount(),
        given_name: name.split(' ').pop(),
        family_name: name.split(' ').slice(0, -1).join(' '),
        password,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6b3fd4&color=fff&size=128&bold=true&rounded=true`,
        googleAvatar: null,
        provider: 'email',
        specialty: '',
        phone: '',
        profileComplete: false,
        patients: [], records: [],
        createdAt: new Date().toISOString(),
      }
      users[email] = u
      saveUsers(users)
      setNeedsProfileSetup(true)
      return _finalize(u)
    } else {
      // Login
      let u = users[email]
      if (!u) throw new Error('Tài khoản không tồn tại')
      if (u.password !== password) throw new Error('Sai mật khẩu')
      if (!u.uuid) {
        u = { ...u, uuid: generateAnonUUID() } // backfill for accounts created before uuid existed
        users[email] = u
        saveUsers(users)
      }
      return _finalize(u)
    }
  }

  const logout = () => {
    setUser(null)
    setNeedsProfileSetup(false)
    saveSession(null)
    // Logout only ends the current session — it never deletes anyone's data.
    // Guest (anonymous) progress stays in IndexedDB so the same UUID and journey
    // are restored next time loginAnonymous() runs on this device. Permanent
    // removal only happens via deleteAccount().
  }

  // Called from ProfileSetupModal or Settings when user updates their info
  const updateProfile = (updates) => {
    // Guest (anonymous) users have no email/localStorage record — persist to IndexedDB instead
    if (user?.isAnonymous) {
      const merged = { ...user, ...updates, profileComplete: true, isAnonymous: true, isAdmin: false }
      setUser(merged)
      updateAnonSession({ ...updates, profileComplete: true }).catch(e => console.warn('anonDB profile update failed', e))
      return merged
    }
    const users = getUsers()
    const existingUser = users[user.email] || {}
    const hasCustomAvatar = updates.avatar && updates.avatar !== existingUser.googleAvatar
    const avatarCustomized = typeof updates.avatarCustomized === 'boolean'
      ? updates.avatarCustomized
      : hasCustomAvatar || existingUser.avatarCustomized || false
    const updated = {
      ...existingUser,
      ...updates,
      avatarCustomized,
      profileComplete: true,
    }
    users[user.email] = updated
    saveUsers(users)
    syncPrimaryPatientNameInFamilyTree(user.uuid, updated.name, updated.avatar)
    const enriched = { ...updated, isAdmin: user.isAdmin }
    setUser(enriched)
    return enriched
  }

  const dismissProfileSetup = () => {
    setNeedsProfileSetup(false)
    // Mark profile as "seen" so we don't re-prompt on refresh
    const users = getUsers()
    if (users[user?.email]) {
      users[user.email].profileComplete = true
      saveUsers(users)
      setUser(u => ({ ...u, profileComplete: true }))
    }
  }

  // ── Link/unlink an additional sign-in provider to the CURRENT account ───────
  // (different from loginWithGoogle/loginWithApple, which sign IN as that
  // provider's account — this attaches the provider to the account already
  // logged in, without switching sessions.)
  const linkProvider = async (providerName) => {
    if (!user || user.isAnonymous) throw new Error('No active account to link to')
    const profile = providerName === 'google' ? await googleOAuthPopup() : simulateAppleOAuth()

    const users = getUsers()
    // Guard: don't let someone link an account that's already a separate, distinct user
    if (profile.email && profile.email !== user.email && users[profile.email]) {
      throw new Error(
        providerName === 'google'
          ? 'Tài khoản Google này đã được dùng cho một hồ sơ khác.'
          : 'Tài khoản Apple này đã được dùng cho một hồ sơ khác.'
      )
    }

    const existingUser = users[user.email] || user
    const linkedProviders = Array.from(new Set([...(existingUser.linkedProviders || [existingUser.provider]), providerName]))
    const linkedAccounts = { ...(existingUser.linkedAccounts || {}), [providerName]: { email: profile.email, picture: profile.picture, name: profile.name } }

    const updated = { ...existingUser, linkedProviders, linkedAccounts }
    users[user.email] = updated
    saveUsers(users)
    const enriched = { ...updated, isAdmin: user.isAdmin }
    setUser(enriched)
    return enriched
  }

  const unlinkProvider = (providerName) => {
    if (!user || user.isAnonymous) return user
    const users = getUsers()
    const existingUser = users[user.email] || user
    const currentLinked = existingUser.linkedProviders || [existingUser.provider]
    if (currentLinked.length <= 1) return user // always keep at least one provider linked

    const linkedProviders = currentLinked.filter(p => p !== providerName)
    const linkedAccounts = { ...(existingUser.linkedAccounts || {}) }
    delete linkedAccounts[providerName]

    const updated = { ...existingUser, linkedProviders, linkedAccounts }
    users[user.email] = updated
    saveUsers(users)
    const enriched = { ...updated, isAdmin: user.isAdmin }
    setUser(enriched)
    return enriched
  }

  // ── Permanently delete the current account (everyone except Admin) ──────────
  // Removes the user record and related family-tree data, then logs out. Cannot be undone.
  const deleteAccount = () => {
    if (!user) return
    if (user.email === ADMIN_EMAIL) throw new Error('Không thể xoá tài khoản Quản trị viên.')

    if (user.isAnonymous) {
      // Guest account: wipe local IndexedDB progress entirely
      setUser(null)
      saveSession(null)
      return clearAllGuestData().catch(e => console.warn('anonDB clear failed', e))
    }

    const email = user.email
    // 1. Remove the account record itself
    const users = getUsers()
    delete users[email]
    saveUsers(users)

    // 2. Remove this account's Family Medical Tree data
    try {
      const ownerKey = getFamilyOwnerKey(user.uuid)
      const byUser = JSON.parse(localStorage.getItem(FAMILY_USER_STORAGE_KEY) || '{}')
      if (byUser[ownerKey]) {
        delete byUser[ownerKey]
        localStorage.setItem(FAMILY_USER_STORAGE_KEY, JSON.stringify(byUser))
      }
    } catch (e) { console.warn('Family tree cleanup failed', e) }

    // 3. End the session
    setUser(null)
    setNeedsProfileSetup(false)
    saveSession(null)
  }

  // ── Đặt User ID từ màn Profile (sau khi tài khoản/uuid đã tồn tại) ───────────
  // Dùng lại đúng /api/user-profile POST (đã hỗ trợ userId) — không cần
  // endpoint riêng. Validate định dạng ở client trước cho phản hồi nhanh,
  // server (USER_ID_REGEX + unique index + "chỉ set 1 lần") vẫn là điểm chặn
  // cuối cùng. CHỈ ĐƯỢC LƯU 1 LẦN DUY NHẤT — không cho đổi lại sau khi đã có
  // userId, để tránh lạm dụng (vd đổi liên tục để "chiếm" nhiều handle đẹp
  // rồi nhả ra, hoặc gây nhầm lẫn cho người đã lỡ chia sẻ User ID cũ).
  const updateUserId = async (newUserId) => {
    if (!user?.uuid) throw new Error('Chưa có tài khoản/UUID để đặt User ID.')
    if (user.userId) throw new Error('Bạn đã đặt User ID rồi — mỗi tài khoản chỉ được đặt User ID 1 lần duy nhất, không thể đổi lại.')
    const id = String(newUserId || '').trim()
    if (!/^[A-Za-z0-9_]{3,24}$/.test(id)) {
      throw new Error('User ID không hợp lệ — chỉ chữ không dấu, số, gạch dưới, 3-24 ký tự.')
    }
    const secret = getOrCreateProfileSecret(user.uuid)
    if (!secret) throw new Error('Không tạo được khoá sở hữu trên thiết bị này (thử tắt chế độ duyệt web riêng tư).')
    const verified = user.provider === 'google' || user.provider === 'apple'
    const res = await fetch('/api/user-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uuid: user.uuid, name: user.name || 'User', secret, verified, userId: id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'Không thể cập nhật User ID.')

    if (user.isAnonymous) {
      updateAnonSession({ userId: id }).catch(() => {})
    } else if (user.email) {
      const users = getUsers()
      const existing = users[user.email] || user
      users[user.email] = { ...existing, userId: id }
      saveUsers(users)
    }
    setUser(u => (u ? { ...u, userId: id } : u))
    return id
  }

  const getAllUsers = () => Object.values(getUsers()).map(u => ({ ...u, isAdmin: u.email === ADMIN_EMAIL, ...enrichRoleFields(u) }))

  // ── Quản trị Vai trò (Sub-Admin) & Gói thành viên (VIP Pro) ─────────────
  // Chỉ dùng bởi Super Admin (ADMIN_EMAIL) từ panel Quản Trị Vai Trò & Thành
  // Viên trong nhóm menu Admin. Không cho phép đổi role của chính Super
  // Admin (role của Super Admin luôn cố định = 'admin' theo ADMIN_EMAIL).
  const setUserRole = (email, role) => {
    if (!email || email === ADMIN_EMAIL) return false
    const users = getUsers()
    if (!users[email]) return false
    users[email] = { ...users[email], role: role === ROLE_SUB_ADMIN ? ROLE_SUB_ADMIN : 'user' }
    saveUsers(users)
    setUser(u => (u && u.email === email) ? { ...u, ...enrichRoleFields(users[email]) } : u)
    return true
  }

  const setUserMembership = (email, membership) => {
    if (!email) return false
    const users = getUsers()
    if (!users[email]) return false
    users[email] = { ...users[email], membership: membership === MEMBERSHIP_VIP_PRO ? MEMBERSHIP_VIP_PRO : 'free' }
    saveUsers(users)
    setUser(u => (u && u.email === email) ? { ...u, ...enrichRoleFields(users[email]) } : u)
    return true
  }

  return (
    <AuthContext.Provider value={{
      user, loading,
      needsProfileSetup, dismissProfileSetup,
      loginWithGoogle, loginWithApple, loginWithEmail, loginAnonymous,
      logout, updateProfile, linkProvider, unlinkProvider, deleteAccount,
      updateUserId,
      getAllUsers,
      setUserRole, setUserMembership,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
