import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Info,
  Loader2,
  Network,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// TRƯỚC ĐÂY: panel này được render KHÔNG TRUYỀN PROPS ở App.jsx nên luôn rơi
// về DEFAULT_USERS/DEFAULT_POLICY giả (3 user cứng, % "sửa được" nhưng không
// lưu đi đâu, nút "Mô phỏng đóng góp quỹ" chỉ reset form) — Admin tưởng đang
// quản trị hệ affiliate thật nhưng thực ra mọi thao tác đều vô tác dụng.
//
// GIỜ: panel gọi thẳng /api/affiliate-admin-stats (đọc MongoDB thật — cùng
// collection affiliate_referrals/user_profiles mà AffiliateUUIDReferralPanel.jsx
// dùng) để hiển thị ĐÚNG quy mô hệ thống. Rate hoa hồng KHÔNG còn ô "sửa %"
// giả nữa — hiển thị read-only vì rate (F1 10% · F2 5% · F3 2%) đã CỐ ĐỊNH
// trên smart-contract HienMauAffiliate.sol đã deploy, app này không có cơ chế
// nào ghi đè rate đó qua UI.
// ─────────────────────────────────────────────────────────────────────────

function shortUuid(uuid) {
  if (!uuid) return '—';
  return uuid.length > 14 ? `${uuid.slice(0, 8)}…${uuid.slice(-6)}` : uuid;
}

function IdentityLabel({ uuid, userId }) {
  return (
    <span className="font-mono">
      {userId ? `@${userId}` : shortUuid(uuid)}
      {userId && <span className="text-slate-500"> · {shortUuid(uuid)}</span>}
    </span>
  );
}

export default function AffiliateSystemAdminPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const loadStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/affiliate-admin-stats');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
      setStats(data);
    } catch (err) {
      setError(err?.message || 'Không tải được dữ liệu affiliate thật.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStats(); }, []);

  const handleAnalyzeSystem = () => {
    if (!stats) return;
    setIsAnalyzing(true);
    const lines = [
      `Hệ thống hiện có ${stats.totalProfiles} hồ sơ người dùng (user_profiles) và ${stats.totalReferralLinks} quan hệ referral đã ghi nhận.`,
      stats.topReferrers.length > 0
        ? `Người giới thiệu nhiều F1 nhất: ${stats.topReferrers[0].userId ? '@' + stats.topReferrers[0].userId : shortUuid(stats.topReferrers[0].referrerUuid)} (${stats.topReferrers[0].f1Count} F1).`
        : 'Chưa có ai có F1 trực tiếp.',
      'Rate hoa hồng cố định trên contract (F1 10% · F2 5% · F3 2%) — không cần và không thể chỉnh từ panel này.',
    ];
    setAiAnalysis(lines.join('\n'));
    setIsAnalyzing(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-300">
      <div className="bg-[#141414] p-6 rounded-2xl border border-[#262626]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2 text-white">
            <Target className="w-5 h-5 text-red-500" /> Chính Sách Hoa Hồng Đa Tầng
          </h2>
          <button
            onClick={loadStats}
            className="flex items-center gap-1 text-sm bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
          </button>
        </div>

        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-300">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <span>Rate bên dưới đã CỐ ĐỊNH trên smart-contract HienMauAffiliate.sol đã deploy — chỉ hiển thị, không chỉnh được từ đây.</span>
        </div>

        <div className="space-y-3 mb-6">
          {(stats?.fixedLevelRates || [{ level: 1, rate: 10 }, { level: 2, rate: 5 }, { level: 3, rate: 2 }]).map((levelPolicy) => (
            <div key={levelPolicy.level} className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded-xl border border-[#333]">
              <span className="font-bold text-red-400 bg-[#1a1a1a] px-3 py-1.5 rounded-lg border border-[#333]">
                Tầng F{levelPolicy.level}
              </span>
              <span className="text-white font-bold">{levelPolicy.rate}%</span>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-xl p-5 border border-[#333]">
          <h3 className="text-md font-bold text-white flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-red-500" /> Nhận Xét Nhanh
          </h3>
          <button
            onClick={handleAnalyzeSystem} disabled={isAnalyzing || !stats}
            className="w-full bg-[#262626] hover:bg-[#333] border border-[#444] text-white px-4 py-2.5 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
            Kiểm Tra Sức Khỏe Hệ Thống
          </button>
          {aiAnalysis && (
            <div className="mt-4 bg-[#0a0a0a] p-4 rounded-lg border border-[#333] text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
              {aiAnalysis}
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#141414] p-6 rounded-2xl border border-[#262626] flex flex-col">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4 text-white">
          <Users className="w-5 h-5 text-red-500" /> Quy Mô Hệ Thống (Dữ Liệu Thật)
        </h2>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-xs text-red-400">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#262626]">
            <div className="text-xs text-slate-400 mb-1">Hồ sơ đã tạo</div>
            <div className="text-2xl font-bold text-white">{loading ? '—' : stats?.totalProfiles ?? 0}</div>
          </div>
          <div className="bg-[#0a0a0a] p-3 rounded-xl border border-[#262626]">
            <div className="text-xs text-slate-400 mb-1">Quan hệ referral</div>
            <div className="text-2xl font-bold text-emerald-400">{loading ? '—' : stats?.totalReferralLinks ?? 0}</div>
          </div>
        </div>

        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Network className="w-4 h-4 text-cyan-400" /> Top Người Giới Thiệu (theo F1)
        </h3>
        <div className="space-y-1.5 mb-5 max-h-40 overflow-y-auto pr-1">
          {(stats?.topReferrers || []).map((r) => (
            <div key={r.referrerUuid} className="flex items-center justify-between text-xs bg-[#0a0a0a] rounded-lg px-3 py-2 border border-[#222]">
              <span className="flex items-center gap-1.5">
                <IdentityLabel uuid={r.referrerUuid} userId={r.userId} />
                {r.verified && <ShieldCheck className="w-3 h-3 text-emerald-400" />}
              </span>
              <span className="font-bold text-cyan-400">{r.f1Count} F1</span>
            </div>
          ))}
          {!loading && (stats?.topReferrers || []).length === 0 && (
            <p className="text-xs text-slate-500">Chưa có quan hệ referral nào trong hệ thống.</p>
          )}
        </div>

        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-red-400" /> Referral Gần Đây
        </h3>
        <div className="flex-1 max-h-48 overflow-y-auto space-y-1.5 pr-1">
          {(stats?.recentReferrals || []).map((r, idx) => (
            <div key={`${r.refereeUuid}_${idx}`} className="text-xs bg-[#0a0a0a] rounded-lg px-3 py-2 border border-[#222] flex items-center justify-between">
              <span className="font-mono text-slate-300">{shortUuid(r.refereeUuid)} <span className="text-slate-600">←</span> {shortUuid(r.referrerUuid)}</span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.chainStatus === 'synced' ? 'bg-emerald-500/20 text-emerald-300' : r.chainStatus === 'failed' ? 'bg-amber-500/20 text-amber-300' : 'bg-white/10 text-white/50'}`}>
                {r.chainStatus === 'synced' ? 'On-chain' : r.chainStatus === 'failed' ? 'Chờ đồng bộ' : 'Đang xử lý'}
              </span>
            </div>
          ))}
          {!loading && (stats?.recentReferrals || []).length === 0 && (
            <p className="text-xs text-slate-500">Chưa có quan hệ referral nào.</p>
          )}
        </div>
      </div>
    </div>
  );
}
