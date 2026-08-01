// src/video-to-learning-khanh/src/AdminHistoryPanel.tsx
// Panel Admin cho tính năng "Video to Learning": xem TOÀN BỘ user đã dùng
// link nào (video/short/kênh YouTube/trang web), AI đã trả lời gì theo thời
// gian, và vài số liệu thống kê xu hướng — dữ liệu lấy từ MongoDB qua
// /api/groq-proxy:
//   - provider: 'video-to-learning-admin-stats'  -> tổng quan + xu hướng
//   - provider: 'video-to-learning-history', action: 'list', uuid: <chọn>
//                                                  -> lịch sử chi tiết của 1 user
//
// KHÔNG thêm dependency mới (không dùng recharts) — vẽ biểu đồ xu hướng
// bằng 1 dãy cột CSS đơn giản, đúng tinh thần các file khác trong dự án.
//
// Component này KHÔNG tự gating quyền admin — nơi gọi nó (route/menu admin)
// chịu trách nhiệm chỉ hiển thị cho đúng tài khoản admin (xem
// affiliate-admin-stats.js / mô hình bảo mật hiện tại: gating ở client).

import { useEffect, useMemo, useState } from 'react';
import { LINK_TYPE_LABELS, type LinkType } from './lib/linkClassifier';

interface AdminOverview {
  totalEntries: number;
  totalUsers: number;
  byType: Record<LinkType, number>;
  byAiSource: Record<string, number>;
  dailyTrend: { date: string; count: number }[];
  perUser: { uuid: string; userId: string | null; name: string | null; count: number; lastActivity: string }[];
  recentEntries: any[];
}

async function callGroqProxy(body: Record<string, unknown>) {
  const res = await fetch('/api/groq-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Lỗi máy chủ (${res.status})`);
  return data;
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'error'
      ? 'bg-red-900/50 text-red-300'
      : status === 'saved-only'
        ? 'bg-slate-800 text-slate-400'
        : 'bg-emerald-900/50 text-emerald-300';
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${cls}`}>{status}</span>;
}

function TrendBars({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex items-end gap-1 h-28">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
          <div
            className="w-full bg-sky-600 group-hover:bg-sky-400 rounded-t transition-colors"
            style={{ height: `${Math.max(4, (d.count / max) * 96)}px` }}
            title={`${d.date}: ${d.count}`}
          />
          <span className="text-[9px] text-slate-500 rotate-0 whitespace-nowrap">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminHistoryPanel() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUser, setSelectedUser] = useState<{ uuid: string; name: string | null } | null>(null);
  const [userHistory, setUserHistory] = useState<any[]>([]);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);

  const [typeFilter, setTypeFilter] = useState<LinkType | 'all'>('all');

  const loadOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callGroqProxy({ provider: 'video-to-learning-admin-stats' });
      setOverview(data as AdminOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được số liệu.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const openUser = async (uuid: string, name: string | null) => {
    setSelectedUser({ uuid, name });
    setUserHistoryLoading(true);
    try {
      const data = await callGroqProxy({ provider: 'video-to-learning-history', action: 'list', uuid, limit: 200 });
      setUserHistory(data.items || []);
    } catch (err) {
      setUserHistory([]);
    } finally {
      setUserHistoryLoading(false);
    }
  };

  const filteredRecent = useMemo(() => {
    if (!overview) return [];
    if (typeFilter === 'all') return overview.recentEntries;
    return overview.recentEntries.filter((e) => e.type === typeFilter);
  }, [overview, typeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">Đang tải số liệu admin...</div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center px-4">
        <p className="text-red-400 text-sm">{error || 'Không có dữ liệu.'}</p>
        <button onClick={loadOverview} className="rounded-md bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-sm font-medium">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 text-slate-100">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">📊 Video to Learning — Admin</h2>
        <button onClick={loadOverview} className="text-xs rounded-md border border-slate-700 hover:border-sky-500 px-3 py-1.5">
          Làm mới
        </button>
      </div>

      {/* Tổng quan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-400">Tổng lượt dùng</p>
          <p className="text-2xl font-bold mt-1">{overview.totalEntries}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-400">Số user đã dùng</p>
          <p className="text-2xl font-bold mt-1">{overview.totalUsers}</p>
        </div>
        {(Object.keys(overview.byType) as LinkType[]).slice(0, 2).map((t) => (
          <div key={t} className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">
              {LINK_TYPE_LABELS[t].icon} {LINK_TYPE_LABELS[t].vi}
            </p>
            <p className="text-2xl font-bold mt-1">{overview.byType[t]}</p>
          </div>
        ))}
      </div>

      {/* Phân loại theo type + nguồn AI */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Theo loại link</h3>
          <div className="flex flex-col gap-2">
            {(Object.keys(overview.byType) as LinkType[]).map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm">
                <span className="w-40 truncate text-slate-400">
                  {LINK_TYPE_LABELS[t].icon} {LINK_TYPE_LABELS[t].vi}
                </span>
                <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-sky-600"
                    style={{ width: `${overview.totalEntries ? (overview.byType[t] / overview.totalEntries) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-400">{overview.byType[t]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Theo nguồn AI</h3>
          <div className="flex flex-col gap-2">
            {Object.entries(overview.byAiSource).map(([source, count]) => (
              <div key={source} className="flex items-center gap-2 text-sm">
                <span className="w-40 truncate text-slate-400">{source}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-emerald-600"
                    style={{ width: `${overview.totalEntries ? (count / overview.totalEntries) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-8 text-right text-slate-400">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Xu hướng 14 ngày */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Xu hướng sử dụng (14 ngày gần nhất)</h3>
        {overview.dailyTrend.length === 0 ? (
          <p className="text-slate-500 text-xs">Chưa có dữ liệu.</p>
        ) : (
          <TrendBars data={overview.dailyTrend} />
        )}
      </div>

      {/* Danh sách user */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Người dùng ({overview.perUser.length})</h3>
        <div className="overflow-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="text-slate-500 text-left sticky top-0 bg-slate-900">
              <tr>
                <th className="py-1.5 pr-2">Tên</th>
                <th className="py-1.5 pr-2">userId</th>
                <th className="py-1.5 pr-2">Số lượt</th>
                <th className="py-1.5 pr-2">Hoạt động gần nhất</th>
                <th className="py-1.5" />
              </tr>
            </thead>
            <tbody>
              {overview.perUser.map((u) => (
                <tr key={u.uuid} className="border-t border-slate-800 hover:bg-slate-800/50">
                  <td className="py-1.5 pr-2 text-slate-200">{u.name || '(ẩn danh)'}</td>
                  <td className="py-1.5 pr-2 text-slate-400">{u.userId || '—'}</td>
                  <td className="py-1.5 pr-2 text-slate-400">{u.count}</td>
                  <td className="py-1.5 pr-2 text-slate-500">{new Date(u.lastActivity).toLocaleString('vi-VN')}</td>
                  <td className="py-1.5">
                    <button onClick={() => openUser(u.uuid, u.name)} className="text-sky-400 hover:text-sky-300">
                      Xem lịch sử
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hoạt động gần đây toàn hệ thống */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Hoạt động gần đây (toàn hệ thống)</h3>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as LinkType | 'all')}
            className="text-xs bg-slate-950 border border-slate-700 rounded px-2 py-1"
          >
            <option value="all">Tất cả loại</option>
            {(Object.keys(LINK_TYPE_LABELS) as LinkType[]).map((t) => (
              <option key={t} value={t}>
                {LINK_TYPE_LABELS[t].vi}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2 max-h-80 overflow-auto">
          {filteredRecent.map((e, i) => (
            <div key={e._id || i} className="rounded-md border border-slate-800 bg-slate-950 p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <span>{LINK_TYPE_LABELS[(e.type as LinkType) || 'website']?.icon}</span>
                <span className="flex-1 truncate text-slate-200">{e.title || e.link}</span>
                <StatusBadge status={e.status} />
              </div>
              <div className="text-slate-500 mt-1 truncate">{e.link}</div>
              <div className="text-slate-600 mt-1 flex items-center gap-2">
                <span>{e.name || e.uuid}</span>
                <span>·</span>
                <span>{e.aiSource || '—'}</span>
                <span>·</span>
                <span>{new Date(e.createdAt).toLocaleString('vi-VN')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal chi tiết lịch sử 1 user */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setSelectedUser(null)}>
          <div
            className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <h3 className="font-semibold">Lịch sử: {selectedUser.name || selectedUser.uuid}</h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex flex-col gap-2">
              {userHistoryLoading ? (
                <p className="text-slate-500 text-sm">Đang tải...</p>
              ) : userHistory.length === 0 ? (
                <p className="text-slate-500 text-sm">Không có lịch sử.</p>
              ) : (
                userHistory.map((h, i) => (
                  <div key={h._id || i} className="rounded-md border border-slate-800 bg-slate-950 p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span>{LINK_TYPE_LABELS[(h.type as LinkType) || 'website']?.icon}</span>
                      <span className="flex-1 truncate text-slate-200">{h.title || h.link}</span>
                      <StatusBadge status={h.status} />
                    </div>
                    <div className="text-slate-500 mt-1 truncate">{h.link}</div>
                    <div className="text-slate-600 mt-1 flex items-center gap-2">
                      <span>{h.aiSource || '—'}</span>
                      <span>·</span>
                      <span>{new Date(h.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    {h.specPreview && <p className="text-slate-400 mt-2 line-clamp-4 whitespace-pre-wrap">{h.specPreview}</p>}
                    {h.errorMessage && <p className="text-red-400 mt-2">{h.errorMessage}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
