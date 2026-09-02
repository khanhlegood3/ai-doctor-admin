import React, { useEffect, useState, useCallback } from 'react';
import { KeyRound, CheckCircle2, XCircle, Info, RefreshCw, Lock } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// ApiAccessRequestsPanel.jsx
// Panel Admin: "Yêu Cầu Dùng API Trả Phí" — duyệt/từ chối các tài khoản đã
// tick "muốn dùng API trả phí" lúc đăng ký (xem LoginPage.jsx +
// AuthContext.jsx loginWithEmail).
//
// Khác với RoleMembershipAdminPanel (đọc/ghi localStorage cục bộ trên máy
// admin), panel này gọi thẳng /api/user-profile trên server (Mongo) — vì
// user đăng ký ở THIẾT BỊ CỦA HỌ, Admin cần thấy được yêu cầu đó dù đang ở
// một thiết bị khác. Bảo vệ bằng 1 "admin secret" (biến môi trường server
// ADMIN_API_SECRET) mà Admin tự nhập 1 lần và lưu cục bộ trên máy mình —
// đúng mức độ bảo mật hiện có của app (không có server-session thật, xem
// ghi chú đầu file api/user-profile.js).
// ─────────────────────────────────────────────────────────────────────────

const ADMIN_SECRET_STORAGE_KEY = 'cdoc_admin_api_secret';

export default function ApiAccessRequestsPanel() {
  const [adminSecret, setAdminSecret] = useState(() => {
    try { return localStorage.getItem(ADMIN_SECRET_STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [secretInput, setSecretInput] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [processingUuid, setProcessingUuid] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(() => setToast(''), 2400);
  };

  const fetchRequests = useCallback(async (secret) => {
    if (!secret) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/user-profile?adminApiAccessList=1', {
        headers: { 'x-admin-secret': secret },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Không tải được danh sách.');
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (adminSecret) fetchRequests(adminSecret);
  }, [adminSecret, fetchRequests]);

  const saveSecret = () => {
    const s = secretInput.trim();
    if (!s) return;
    try { localStorage.setItem(ADMIN_SECRET_STORAGE_KEY, s); } catch { /* ignore */ }
    setAdminSecret(s);
    setSecretInput('');
  };

  const clearSecret = () => {
    try { localStorage.removeItem(ADMIN_SECRET_STORAGE_KEY); } catch { /* ignore */ }
    setAdminSecret('');
    setRequests([]);
  };

  const decide = async (uuid, decision) => {
    setProcessingUuid(uuid);
    try {
      const res = await fetch('/api/user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decideApiAccess', uuid, decision, adminSecret }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Cập nhật thất bại.');
      setRequests((prev) => prev.filter((r) => r.uuid !== uuid));
      showToast(decision === 'approve' ? 'Đã duyệt quyền dùng API trả phí.' : 'Đã từ chối yêu cầu.');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessingUuid(null);
    }
  };

  if (!adminSecret) {
    return (
      <div className="animate-in fade-in duration-300 space-y-4 max-w-md">
        <h2 className="text-lg font-bold flex items-center gap-2 text-white">
          <KeyRound className="w-5 h-5 text-red-500" /> Yêu Cầu Dùng API Trả Phí
        </h2>
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Nhập ADMIN_API_SECRET (đã đặt trong biến môi trường Vercel) để xem và duyệt các yêu cầu.
            Secret chỉ lưu trên trình duyệt này, không gửi đi đâu khác ngoài request duyệt.
          </span>
        </div>
        <input
          type="password"
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveSecret()}
          placeholder="Dán ADMIN_API_SECRET..."
          className="w-full bg-[#0a0a0a] border border-[#262626] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-red-500/40"
        />
        <button
          type="button"
          onClick={saveSecret}
          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 transition"
        >
          Xác nhận
        </button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <KeyRound className="w-5 h-5 text-red-500" /> Yêu Cầu Dùng API Trả Phí
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Duyệt tài khoản được phép gọi các tính năng API trả phí sau khi đăng ký.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fetchRequests(adminSecret)}
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
          <button
            type="button"
            onClick={clearSecret}
            title="Xoá admin secret khỏi trình duyệt này"
            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-slate-500 hover:bg-white/10 transition"
          >
            <Lock className="w-3.5 h-3.5" /> Đổi secret
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {toast && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {toast}
        </div>
      )}

      <div className="bg-[#141414] rounded-2xl border border-[#262626] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#262626] flex items-center gap-2 text-xs text-slate-400 font-mono">
          <KeyRound className="w-3.5 h-3.5" /> {requests.length} yêu cầu đang chờ
        </div>
        {loading ? (
          <div className="p-10 text-center text-slate-500 text-sm">Đang tải...</div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">Không có yêu cầu nào đang chờ.</div>
        ) : (
          <div className="divide-y divide-[#222]">
            {requests.map((r) => (
              <div key={r.uuid} className="flex items-center gap-4 px-4 py-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-white truncate">{r.name || 'Không tên'}</div>
                  <div className="text-xs text-slate-500 truncate">{r.email || r.uuid}</div>
                  {r.apiAccessRequestedAt && (
                    <div className="text-[10px] text-slate-600 mt-0.5">
                      Gửi lúc: {new Date(r.apiAccessRequestedAt).toLocaleString('vi-VN')}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    disabled={processingUuid === r.uuid}
                    onClick={() => decide(r.uuid, 'approve')}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-30"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Duyệt
                  </button>
                  <button
                    type="button"
                    disabled={processingUuid === r.uuid}
                    onClick={() => decide(r.uuid, 'reject')}
                    className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 transition disabled:opacity-30"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Từ chối
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
