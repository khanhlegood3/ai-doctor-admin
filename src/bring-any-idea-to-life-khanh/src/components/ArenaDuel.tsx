/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// GON ARENA — chế độ so sánh ẨN DANH 2 model AI (Groq vs Gemini) cùng tạo
// game/app từ MỘT input, hiển thị song song "Model A" / "Model B" (vị trí
// random hoá ở App.tsx), người dùng chơi thử cả hai rồi vote — danh tính
// model chỉ lộ SAU khi vote, đúng tinh thần so sánh mù của arena.ai/LMArena.
//
// Luồng dữ liệu: InputArea.tsx (nhập mô tả + tối đa 2 link video, hoặc chỉ
// text để tự tìm video) -> App.tsx handleArenaBattle() (gọi searchVideoLinks
// nếu thiếu link, rồi bắn 2 request bringToLife engine='groq'/'gemini' song
// song) -> component này render tiến trình + kết quả từng bên.

import React from 'react';
import { XMarkIcon, CpuChipIcon, TrophyIcon, ScaleIcon } from '@heroicons/react/24/outline';

export type ArenaSideName = 'a' | 'b';
export type ArenaVoteChoice = ArenaSideName | 'tie';

export interface ArenaSideState {
  status: 'loading' | 'done' | 'error';
  html?: string;
  error?: string;
}

export interface ArenaDuelProps {
  description: string;
  videoUrls: string[];
  // Tiêu đề video khi link do GON tự tìm (từ searchVideoLinks) — hiển thị để
  // người dùng biết GON đã chọn video nào.
  videoTitles?: string[];
  phase: 'searching' | 'battling';
  sides: Record<ArenaSideName, ArenaSideState>;
  vote: ArenaVoteChoice | null;
  voteSaved: boolean;
  // Nhãn engine thật của từng bên — CHỈ được truyền xuống sau khi đã vote
  // (trước đó = null để giữ so sánh mù).
  revealedLabels: Partial<Record<ArenaSideName, string>> | null;
  onVote: (choice: ArenaVoteChoice) => void;
  onUseVersion: (side: ArenaSideName) => void;
  onClose: () => void;
}

const SIDE_TITLE: Record<ArenaSideName, string> = { a: 'Model A', b: 'Model B' };

const SidePanel: React.FC<{
  side: ArenaSideName;
  state: ArenaSideState;
  revealedLabel?: string;
  wonVote: boolean;
  canUse: boolean;
  onUseVersion: (side: ArenaSideName) => void;
}> = ({ side, state, revealedLabel, wonVote, canUse, onUseVersion }) => (
  <div className={`flex flex-col rounded-xl border overflow-hidden bg-zinc-900/40 transition-colors ${wonVote ? 'border-amber-400/70 shadow-[0_0_30px_rgba(251,191,36,0.12)]' : 'border-zinc-800'}`}>
    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
      <div className="flex items-center gap-2 min-w-0">
        {wonVote && <TrophyIcon className="w-4 h-4 text-amber-400 shrink-0" />}
        <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">{SIDE_TITLE[side]}</span>
        {revealedLabel && (
          <span className="text-xs font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded px-1.5 py-0.5 truncate" title={revealedLabel}>
            {revealedLabel}
          </span>
        )}
      </div>
      {revealedLabel && state.status === 'done' && (
        <button
          type="button"
          onClick={() => onUseVersion(side)}
          className="shrink-0 text-xs font-medium text-blue-300 hover:text-blue-200 border border-blue-500/40 hover:border-blue-400/60 rounded px-2 py-1 transition-colors"
          title="Lưu phiên bản này vào lịch sử GON và mở ở chế độ xem đầy đủ"
        >
          Dùng phiên bản này
        </button>
      )}
      {!revealedLabel && canUse && (
        <span className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-zinc-600">Ẩn danh tới khi vote</span>
      )}
    </div>
    <div className="relative flex-1 min-h-[46vh] lg:min-h-[56vh]">
      {state.status === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-500">
          <CpuChipIcon className="w-8 h-8 text-blue-400 animate-spin-slow" />
          <p className="text-sm font-light">Đang tạo ứng dụng bằng AI ẩn danh...</p>
          <p className="text-[11px] text-zinc-600 font-mono">quá trình này có thể mất 1-2 phút</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="text-sm text-red-400 font-medium">Model này gặp sự cố khi tạo app</p>
          <p className="text-xs text-zinc-500 leading-relaxed max-h-40 overflow-y-auto break-words">{state.error}</p>
        </div>
      )}
      {state.status === 'done' && state.html && (
        <iframe
          title={`GON Arena ${SIDE_TITLE[side]}`}
          srcDoc={state.html}
          className="absolute inset-0 w-full h-full bg-white"
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
        />
      )}
    </div>
  </div>
);

export const ArenaDuel: React.FC<ArenaDuelProps> = ({
  description,
  videoUrls,
  videoTitles = [],
  phase,
  sides,
  vote,
  voteSaved,
  revealedLabels,
  onVote,
  onUseVersion,
  onClose,
}) => {
  const bothSettled = sides.a.status !== 'loading' && sides.b.status !== 'loading';
  const winnerSide: ArenaSideName | null = vote === 'a' || vote === 'b' ? vote : null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full w-full max-w-[110rem] mx-auto flex flex-col px-3 sm:px-6 pb-10">
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-3 sm:-mx-6 px-3 sm:px-6 py-3 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <ScaleIcon className="w-4 h-4 text-purple-400 shrink-0" />
              <span>GON Arena — 2 model AI ẩn danh đấu song song</span>
            </div>
            <div className="text-xs text-zinc-500 truncate mt-0.5" title={description}>
              {description ? `“${description}”` : 'Input: link video'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors"
          >
            <XMarkIcon className="w-4 h-4" />
            Thoát arena
          </button>
        </div>

        {phase === 'searching' ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24 text-zinc-400">
            <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-purple-400 animate-spin" />
            <p className="text-sm font-light">Đang tìm tối đa 2 video phù hợp với mô tả của bạn...</p>
            <p className="text-xs text-zinc-600 font-mono max-w-md text-center px-4">
              {description}
            </p>
          </div>
        ) : (
          <>
            {/* Nguồn video dùng cho trận đấu (tự tìm hoặc người dùng dán) */}
            {videoUrls.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">Nguồn video:</span>
                {videoUrls.map((url, index) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="max-w-full inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 px-2.5 py-1 text-xs text-zinc-300 transition-colors"
                    title={url}
                  >
                    <span className="text-zinc-500 font-mono">#{index + 1}</span>
                    <span className="truncate max-w-[16rem]">{videoTitles[index] || url}</span>
                  </a>
                ))}
              </div>
            )}

            {/* 2 phiên bản song song */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
              <SidePanel
                side="a"
                state={sides.a}
                revealedLabel={revealedLabels?.a}
                wonVote={winnerSide === 'a'}
                canUse={bothSettled && !vote}
                onUseVersion={onUseVersion}
              />
              <SidePanel
                side="b"
                state={sides.b}
                revealedLabel={revealedLabels?.b}
                wonVote={winnerSide === 'b'}
                canUse={bothSettled && !vote}
                onUseVersion={onUseVersion}
              />
            </div>

            {/* Thanh vote — mở khoá khi cả 2 bên đã xong (thành công hoặc lỗi) */}
            <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              {!vote ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm text-zinc-400 text-center font-light">
                    Chơi thử cả hai phiên bản rồi chọn bản tốt hơn — danh tính model chỉ lộ sau khi bạn vote.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      disabled={!bothSettled}
                      onClick={() => onVote('a')}
                      className="rounded-lg bg-zinc-800 hover:bg-blue-600/20 border border-zinc-700 hover:border-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors"
                    >
                      👈 Model A tốt hơn
                    </button>
                    <button
                      type="button"
                      disabled={!bothSettled}
                      onClick={() => onVote('tie')}
                      className="rounded-lg bg-zinc-800 hover:bg-zinc-700/60 border border-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-zinc-300 transition-colors"
                    >
                      🤝 Hoà
                    </button>
                    <button
                      type="button"
                      disabled={!bothSettled}
                      onClick={() => onVote('b')}
                      className="rounded-lg bg-zinc-800 hover:bg-blue-600/20 border border-zinc-700 hover:border-blue-500/50 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-zinc-100 transition-colors"
                    >
                      Model B tốt hơn 👉
                    </button>
                  </div>
                  {!bothSettled && (
                    <p className="text-[11px] text-zinc-600 font-mono">đang chờ cả 2 model hoàn tất...</p>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <p className="text-sm text-zinc-200 font-medium">
                    🗳️ Đã ghi nhận: {vote === 'tie' ? 'hai bên hoà nhau' : `${SIDE_TITLE[winnerSide as ArenaSideName]} thắng`}
                    {!voteSaved && <span className="text-zinc-500 font-normal"> (đang lưu vote...)</span>}
                  </p>
                  {revealedLabels && (
                    <p className="text-xs text-zinc-400">
                      Danh tính đã lộ — Model A: <span className="text-amber-300 font-semibold">{revealedLabels.a}</span>
                      {' • '}Model B: <span className="text-amber-300 font-semibold">{revealedLabels.b}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-zinc-600">Vote được lưu ẩn danh để thống kê Groq vs Gemini (không lưu thông tin cá nhân).</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
