import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { listVibeHistory, type VibeHistoryKind, type VibeHistoryRecord } from '../lib/vibeHistoryStorage';

export default function VibeHistoryCalendar({ kind }: { kind: VibeHistoryKind }) {
  const [records, setRecords] = useState<VibeHistoryRecord[]>([]);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const load = () => listVibeHistory(kind).then(setRecords).catch(() => setRecords([]));
  useEffect(() => { load(); const h = () => load(); window.addEventListener('vibe_tracking_history_changed', h); window.addEventListener('cdoc_medical_records_changed', h); return () => { window.removeEventListener('vibe_tracking_history_changed', h); window.removeEventListener('cdoc_medical_records_changed', h); }; }, [kind]);
  const daysInMonth = useMemo(() => new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate(), [month]);
  const byDay = useMemo(() => records.reduce<Record<number, VibeHistoryRecord[]>>((acc, r) => { if ((r.uploadedAt || '').slice(0,7) !== month) return acc; const d = new Date(r.uploadedAt).getDate(); (acc[d] ||= []).push(r); return acc; }, {}), [records, month]);
  const dayRecords = byDay[selectedDay] || [];
  return <div className="bg-slate-800/80 border-4 border-black p-4 rounded-[2rem] text-white shadow-[8px_8px_0_rgba(0,0,0,1)]">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-4 border-black pb-3 mb-3">
      <h2 className="text-lg font-black uppercase italic flex items-center gap-2"><CalendarDays className="w-5 h-5" /> History Calendar · 31 days</h2>
      <div className="flex gap-2"><input type="month" value={month} onChange={e => { setMonth(e.target.value); setSelectedDay(1); }} className="bg-slate-900 border-2 border-slate-600 rounded-xl px-3 py-1 text-xs font-bold" /><button onClick={load} className="bg-indigo-500 border-2 border-black rounded-xl px-3 py-1"><RefreshCw className="w-4 h-4" /></button></div>
    </div>
    <div className="grid grid-cols-7 gap-2 mb-4">{Array.from({ length: Math.min(31, daysInMonth) }, (_, i) => i + 1).map(day => <button key={day} onClick={() => setSelectedDay(day)} className={`rounded-xl border-2 p-2 text-xs font-black ${selectedDay === day ? 'bg-emerald-500 border-black' : byDay[day]?.length ? 'bg-indigo-600 border-indigo-300' : 'bg-slate-900 border-slate-700 text-slate-500'}`}>{day}<div className="text-[9px]">{byDay[day]?.length || ''}</div></button>)}</div>
    <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">{dayRecords.length ? dayRecords.map(r => <article key={r.id} className="bg-slate-900/80 border border-slate-700 rounded-2xl p-3">
      <div className="font-black text-sm">{r.title}</div><div className="text-[10px] text-slate-400 mb-2">{new Date(r.uploadedAt).toLocaleString()} · synced to Upload Records</div>
      {r.r2Url ? <video src={r.r2Url} controls className="w-full rounded-xl bg-black mb-2" /> : <div className="text-xs text-amber-300 mb-2">Video chưa upload được lên R2, nhưng phân tích text đã lưu IndexedDB.</div>}
      <div className="text-sm text-indigo-100 whitespace-pre-wrap"><b>{r.analysisSummary}</b>{r.analysisDetails ? `\n\n${r.analysisDetails}` : ''}</div>
    </article>) : <div className="text-sm text-slate-400 italic border border-dashed border-slate-700 rounded-2xl p-4 text-center">No saved Vibe Tracking record for this day.</div>}</div>
  </div>;
}
