/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { PuzzlePieceIcon } from '@heroicons/react/24/outline';

interface OneShotArcadeCardProps {
  onSelect: () => void;
  disabled?: boolean;
}

// Điểm vào cho "One Shot Arcade" (chuyển thể từ one-shot-arcade.zip).
// CỐ Ý tách khỏi <DemoTemplates /> — bộ đó được ghi chú rõ "KHÔNG gọi AI",
// còn mục này gọi AI THẬT mỗi lần chơi (Groq Vision mô tả ảnh, Pollinations
// "flux" ẩn danh sinh sprite, xem src/lib/oneShotArcade.ts +
// api/_lib/arcadeSprite.js). Vì vậy được hiển thị như 1 thẻ nổi bật riêng,
// không trộn vào lưới 9 mẫu demo tĩnh.
export const OneShotArcadeCard: React.FC<OneShotArcadeCardProps> = ({ onSelect, disabled }) => {
  return (
    <div className="w-full max-w-5xl mx-auto mt-6">
      <button
        type="button"
        disabled={disabled}
        onClick={onSelect}
        title="Biến ảnh của bạn thành nhân vật game 8-bit và né quái vật trong mê cung — AI sinh sprite thật (Groq + Pollinations)"
        className="group w-full flex items-center gap-4 text-left rounded-xl overflow-hidden bg-gradient-to-r from-cyan-950/60 to-zinc-900/60 border border-cyan-800/60 hover:border-cyan-400/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed px-4 py-3.5"
      >
        <div className="shrink-0 w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-2xl">
          🕹️
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-cyan-300 group-hover:text-cyan-200 flex items-center gap-2">
            One Shot Arcade
            <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">AI thật</span>
          </div>
          <div className="text-xs text-zinc-400 truncate group-hover:text-zinc-300">
            Tải ảnh của bạn lên, AI vẽ thành sprite pixel 8-bit rồi né quái trong mê cung
          </div>
        </div>
        <PuzzlePieceIcon className="w-5 h-5 text-cyan-500/70 shrink-0" />
      </button>
    </div>
  );
};
