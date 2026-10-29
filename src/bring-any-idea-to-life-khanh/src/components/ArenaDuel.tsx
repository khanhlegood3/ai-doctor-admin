/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
// GON ARENA — chế độ so sánh ẨN DANH 2 model AI (Groq vs Gemini) cùng tạo
// game/app từ MỘT input, hiển thị song song "Model A" / "Model B" (vị trí
// random hoá ở App.tsx), người dùng chơi thử cả hai rồi vote — danh tính
// model chỉ lộ SAU khi vote, đúng tinh thần so sánh mù của arena.ai/LMArena.
//
// Quy trình (yêu cầu owner):
//   1. searching  — (chỉ khi user nhập text thuần) GON tự tìm tối đa 2 video
//   2. confirming — XEM TRƯỚC video (dán tay HOẶC tự tìm) để user xác nhận đúng
//                   video chưa; sai thì tìm kiếm/dán lại cho tới khi đúng mới đấu
//   3. battling   — 2 model chạy song song, xem kết quả, vote, lộ danh tính
//
// Khi 1 model gặp sự cố (timeout, hết quota, video không có phụ đề...), user
// có thể dán API KEY CỦA CHÍNH MÌNH để chạy lại bên đó — hệ thống tự đoán
// model theo prefix key (gsk_ = Groq, AIza = Gemini). Key chỉ giữ trong
// sessionStorage của tab (dùng tiếp trong session), KHÔNG lưu DB/cloud.
//
// Luồng dữ liệu: InputArea.tsx -> App.tsx handleArenaBattle() (search ->
// confirm -> gọi bringToLife engine='groq'/'gemini' song song) -> component
// này render từng phase.

import React, { useState } from 'react';
import { XMarkIcon, CpuChipIcon, TrophyIcon, ScaleIcon, KeyIcon, MagnifyingGlassIcon, PlayIcon } from '@heroicons/react/24/outline';
import { detectEngineFromApiKey } from '../lib/api';
import { classifyVideoUrl, getVideoEmbedUrl } from '../lib/videoLink';

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
  phase: 'searching' | 'confirming' | 'battling';
  // Lỗi của lần tìm video gần nhất (hiển thị ở phase confirming cùng ô nhập
  // để user thử lại ngay mà không mất video đang có).
  searchError?: string | null;
  sides: Record<ArenaSideName, ArenaSideState>;
  vote: ArenaVoteChoice | null;
  voteSaved: boolean;
  // Nhãn engine thật của từng bên — CHỈ được truyền xuống sau khi đã vote
  // (trước đó = null để giữ so sánh mù).
  revealedLabels: Partial<Record<ArenaSideName, string>> | null;
  onVote: (choice: ArenaVoteChoice) => void;
  onUseVersion: (side: ArenaSideName) => void;
  // Phase confirming: user xác nhận video đúng -> bắt đầu đấu thật.
  onConfirmBattle: () => void;
  // Phase confirming: nhập mô tả mới để tìm lại video, HOẶC dán tối đa 2
  // link video khác (mỗi dòng 1 link) -> quay lại xác nhận lần nữa.
  onResearch: (input: string) => void;
  // Bên lỗi: chạy lại bằng API key của chính user (đoán model từ prefix).
  onRetryWithKey: (side: ArenaSideName, apiKey: string) => void;
  onClose: () => void;
}

const SIDE_TITLE: Record<ArenaSideName, string> = { a: 'Model A', b: 'Model B' };

// Panel 1 bên (Model A/B): loading / lỗi (kèm form dán API key của user để
// chạy lại) / iframe kết quả.
const SidePanel: React.FC<{
  side: ArenaSideName;
  state: ArenaSideState;
  revealedLabel?: string;
  wonVote: boolean;
  canUse: boolean;
  onUseVersion: (side: ArenaSideName) => void;
  onRetryWithKey: (side: ArenaSideName, apiKey: string) => void;
}> = ({ side, state, revealedLabel, wonVote, canUse, onUseVersion, onRetryWithKey }) => {
  const [keyValue, setKeyValue] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);

  // Đoán model theo prefix khi user gõ — hiện nhãn gợi ý ngay trong ô.
  const detected = detectEngineFromApiKey(keyValue);
  const detectedHint = keyValue.trim()
    ? detected === 'groq'
      ? '→ sẽ chạy lại bằng Groq (key gsk_...)'
      : detected === 'gemini'
        ? '→ sẽ chạy lại bằng Gemini (key AIza...)'
        : '⚠ Không nhận diện được key — cần gsk_... (Groq) hoặc AIza... (Gemini)'
    : null;

  const submitKey = () => {
    const trimmed = keyValue.trim();
    if (!trimmed) return;
    if (!detected) {
      setKeyError('Key không đúng format đã biết — Groq bắt đầu bằng "gsk_", Gemini bắt đầu bằng "AIza".');
      return;
    }
    setKeyError(null);
    onRetryWithKey(side, trimmed);
    setKeyValue('');
  };

  return (
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
          <div className="absolute inset-0 overflow-y-auto flex flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="text-sm text-red-400 font-medium">Model này gặp sự cố khi tạo app</p>
            <p className="text-xs text-zinc-500 leading-relaxed max-h-32 overflow-y-auto break-words">{state.error}</p>
            {/* Form API key của user — dùng lại trong session, không lưu DB/cloud */}
            <div className="w-full max-w-md mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3 space-y-2 text-left">
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-200">
                <KeyIcon className="w-3.5 h-3.5" />
                Chạy lại bằng API key của bạn
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  value={keyValue}
                  onChange={(event) => {
                    setKeyValue(event.target.value);
                    if (keyError) setKeyError(null);
                  }}
                  placeholder="gsk_... (Groq) hoặc AIza... (Gemini)"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-lg bg-zinc-900/70 border border-zinc-700 focus:border-emerald-500 px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={submitKey}
                  disabled={!keyValue.trim()}
                  className="shrink-0 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-3 py-2 text-xs font-semibold text-white transition-colors"
                >
                  Chạy lại
                </button>
              </div>
              {detectedHint && (
                <p className={`text-[10px] font-mono ${detected ? 'text-emerald-400' : 'text-amber-400'}`}>{detectedHint}</p>
              )}
              {keyError && <p className="text-xs text-red-400">{keyError}</p>}
              <p className="text-[10px] leading-4 text-zinc-600">
                🔒 Key chỉ giữ trong phiên trình duyệt (sessionStorage — tự xoá khi đóng tab) để dùng tiếp cho các lần
                đấu sau; KHÔNG lưu lên database/cloud, KHÔNG hiện trong lịch sử hay link chia sẻ.
              </p>
            </div>
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
};

export const ArenaDuel: React.FC<ArenaDuelProps> = ({
  description,
  videoUrls,
  videoTitles = [],
  phase,
  searchError,
  sides,
  vote,
  voteSaved,
  revealedLabels,
  onVote,
  onUseVersion,
  onConfirmBattle,
  onResearch,
  onRetryWithKey,
  onClose,
}) => {
  const bothSettled = sides.a.status !== 'loading' && sides.b.status !== 'loading';
  const winnerSide: ArenaSideName | null = vote === 'a' || vote === 'b' ? vote : null;

  // Ô "tìm lại / đổi video" ở phase confirming — nội dung cục bộ, submit qua
  // onResearch. Prefill mô tả hiện tại để user sửa nhanh khi tìm sai video.
  const [researchInput, setResearchInput] = useState(description);

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

        {phase === 'searching' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-24 text-zinc-400">
            <div className="w-10 h-10 rounded-full border-2 border-zinc-700 border-t-purple-400 animate-spin" />
            <p className="text-sm font-light">Đang tìm tối đa 2 video phù hợp với mô tả của bạn...</p>
            <p className="text-xs text-zinc-600 font-mono max-w-md text-center px-4">
              {description}
            </p>
          </div>
        )}

        {phase === 'confirming' && (
          <div className="flex-1 flex flex-col items-center gap-6 py-8 w-full max-w-5xl mx-auto">
            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-semibold text-zinc-100">👀 Xác nhận video nguồn</h3>
              <p className="text-sm text-zinc-400 font-light max-w-xl">
                Xem trước video bên dưới — nếu ĐÚNG video bạn muốn dùng thì bấm "Bắt đầu đấu",
                chưa đúng thì tìm lại / dán link khác rồi xác nhận lại.
              </p>
            </div>

            {videoUrls.length > 0 ? (
              <div className={`grid grid-cols-1 ${videoUrls.length > 1 ? 'md:grid-cols-2' : 'max-w-xl'} gap-4 w-full`}>
                {videoUrls.map((url, index) => {
                  const classified = classifyVideoUrl(url);
                  return (
                    <div key={url} className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-800">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 shrink-0">Video #{index + 1}</span>
                        <span className="truncate text-xs text-zinc-300" title={videoTitles[index] || url}>
                          {videoTitles[index] || url}
                        </span>
                      </div>
                      <div className="aspect-video bg-black">
                        {classified ? (
                          <iframe
                            title={`Xem trước video ${index + 1}`}
                            src={getVideoEmbedUrl(classified)}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-4">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-xs underline break-all text-center">
                              {url}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Chưa có video nào — nhập mô tả để tìm, hoặc dán tối đa 2 link video bên dưới.</p>
            )}

            {searchError && (
              <p className="text-xs text-red-400 max-w-xl text-center">{searchError}</p>
            )}

            {/* Tìm lại / đổi video: ô nhập linh hoạt — toàn link video (mỗi
                dòng 1 link) thì dùng thẳng các link đó, ngược lại coi như mô
                tả mới và tìm lại bằng text. */}
            <div className="w-full max-w-xl space-y-2">
              <textarea
                rows={2}
                value={researchInput}
                onChange={(event) => setResearchInput(event.target.value)}
                placeholder="Nhập mô tả mới để tìm lại video — hoặc dán tối đa 2 link video khác (mỗi dòng 1 link)"
                className="w-full rounded-lg bg-zinc-900/50 border border-zinc-700 focus:border-purple-500 px-3 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition-colors resize-y"
              />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => onResearch(researchInput)}
                  disabled={!researchInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors"
                >
                  <MagnifyingGlassIcon className="w-4 h-4" />
                  Tìm lại / đổi video
                </button>
                <button
                  type="button"
                  onClick={onConfirmBattle}
                  disabled={videoUrls.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                >
                  <PlayIcon className="w-4 h-4" />
                  Đúng video này — bắt đầu đấu
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === 'battling' && (
          <>
            {/* Nguồn video dùng cho trận đấu (đã qua bước xác nhận) */}
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
                onRetryWithKey={onRetryWithKey}
              />
              <SidePanel
                side="b"
                state={sides.b}
                revealedLabel={revealedLabels?.b}
                wonVote={winnerSide === 'b'}
                canUse={bothSettled && !vote}
                onUseVersion={onUseVersion}
                onRetryWithKey={onRetryWithKey}
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
