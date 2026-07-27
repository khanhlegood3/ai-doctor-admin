import React, { useMemo, useState } from 'react';
import {
  ShieldCheck,
  ShieldPlus,
  ShieldOff,
  Crown,
  Search,
  Users,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────
// RoleMembershipAdminPanel.jsx
// Panel Admin mới: "Quản Trị Vai Trò & Nâng Cấp Thành Viên"
//  - Gán / thu hồi vai trò Sub-Admin cho từng tài khoản (không đụng tới
//    Super Admin — email cố định trong AuthContext).
//  - Nâng cấp / hạ cấp gói thành viên VIP Pro cho từng tài khoản.
// Dữ liệu đọc/ghi qua AuthContext (getAllUsers/setUserRole/setUserMembership),
// lưu trong localStorage (cdoc_users) — đồng bộ với toàn bộ hệ thống auth
// hiện có của app (không gọi API riêng).
// ─────────────────────────────────────────────────────────────────────────

function RoleBadge({ user }) {
  if (user.isAdmin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/25 text-red-400">
        <ShieldCheck className="w-3 h-3" /> SUPER ADMIN
      </span>
    );
  }
  if (user.isSubAdmin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400">
        <ShieldPlus className="w-3 h-3" /> SUB-ADMIN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
      USER
    </span>
  );
}

function MembershipBadge({ user }) {
  if (user.isVIPPro) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/25 text-fuchsia-400">
        <Crown className="w-3 h-3" /> VIP PRO
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-slate-400">
      FREE
    </span>
  );
}

export default function RoleMembershipAdminPanel() {
  const { getAllUsers, setUserRole, setUserMembership } = useAuth();
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [refreshTick, setRefreshTick] = useState(0);

  const users = useMemo(() => {
    const all = typeof getAllUsers === 'function' ? getAllUsers() : [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? all.filter(u =>
          (u.name || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q))
      : all;
    return filtered.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
    // refreshTick chỉ để ép re-render/re-read sau khi thao tác — không dùng trực tiếp
  }, [getAllUsers, query, refreshTick]);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2400);
  };

  const toggleSubAdmin = (u) => {
    if (u.isAdmin) return;
    const nextRole = u.isSubAdmin ? 'user' : 'sub_admin';
    const ok = setUserRole?.(u.email, nextRole);
    if (ok) {
      showToast(nextRole === 'sub_admin'
        ? `Đã cấp quyền Sub-Admin cho ${u.name || u.email}.`
        : `Đã thu hồi quyền Sub-Admin của ${u.name || u.email}.`);
      setRefreshTick(t => t + 1);
    }
  };

  const toggleVIPPro = (u) => {
    const nextMembership = u.isVIPPro ? 'free' : 'vip_pro';
    const ok = setUserMembership?.(u.email, nextMembership);
    if (ok) {
      showToast(nextMembership === 'vip_pro'
        ? `Đã nâng cấp ${u.name || u.email} lên VIP Pro.`
        : `Đã hạ cấp ${u.name || u.email} về gói Free.`);
      setRefreshTick(t => t + 1);
    }
  };

  const subAdminCount = users.filter(u => u.isSubAdmin).length;
  const vipProCount = users.filter(u => u.isVIPPro).length;

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Header + stats */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <ShieldPlus className="w-5 h-5 text-red-500" /> Quản Trị Vai Trò &amp; Nâng Cấp Thành Viên
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gán quyền Sub-Admin và nâng cấp gói VIP Pro cho tài khoản người dùng.
          </p>
        </div>
        <div className="flex gap-3">
          <div className="bg-[#0a0a0a] px-4 py-2.5 rounded-xl border border-[#262626] text-center">
            <div className="text-lg font-bold text-amber-400">{subAdminCount}</div>
            <div className="text-[10px] text-slate-500">Sub-Admin</div>
          </div>
          <div className="bg-[#0a0a0a] px-4 py-2.5 rounded-xl border border-[#262626] text-center">
            <div className="text-lg font-bold text-fuchsia-400">{vipProCount}</div>
            <div className="text-[10px] text-slate-500">VIP Pro</div>
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Sub-Admin là vai trò hỗ trợ Super Admin, không thể tự đổi vai trò của Super Admin.
          Nâng cấp VIP Pro áp dụng ngay cho tài khoản (nếu người dùng đang đăng nhập, quyền lợi
          sẽ được nhận diện ở lần điều hướng/tải lại tiếp theo).
        </span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/40"
        />
      </div>

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {toast}
        </div>
      )}

      {/* Users table */}
      <div className="bg-[#141414] rounded-2xl border border-[#262626] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#262626] flex items-center gap-2 text-xs text-slate-400 font-mono">
          <Users className="w-3.5 h-3.5" /> {users.length} tài khoản
        </div>
        {users.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">Không tìm thấy tài khoản nào.</div>
        ) : (
          <div className="divide-y divide-[#222]">
            {users.map((u) => (
              <div key={u.email} className="flex items-center gap-4 px-4 py-3 flex-wrap">
                <img
                  src={u.avatar}
                  alt=""
                  className="w-9 h-9 rounded-full border-2 flex-shrink-0"
                  style={{ borderColor: u.isAdmin ? '#ff5252' : u.isSubAdmin ? '#ffb74d' : '#6b3fd4' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{u.name || 'Không tên'}</div>
                  <div className="text-xs text-slate-500 truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <RoleBadge user={u} />
                  <MembershipBadge user={u} />
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={u.isAdmin}
                    onClick={() => toggleSubAdmin(u)}
                    title={u.isAdmin ? 'Không thể đổi vai trò của Super Admin' : ''}
                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-30 disabled:cursor-not-allowed ${
                      u.isSubAdmin
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    {u.isSubAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldPlus className="w-3.5 h-3.5" />}
                    {u.isSubAdmin ? 'Thu hồi Sub-Admin' : 'Cấp Sub-Admin'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleVIPPro(u)}
                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border transition ${
                      u.isVIPPro
                        ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400 hover:bg-fuchsia-500/20'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <Crown className="w-3.5 h-3.5" />
                    {u.isVIPPro ? 'Hạ cấp về Free' : 'Nâng cấp VIP Pro'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
