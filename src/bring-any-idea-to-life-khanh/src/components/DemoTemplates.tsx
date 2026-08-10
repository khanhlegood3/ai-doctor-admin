/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { DEMO_TEMPLATES, type DemoTemplate } from '../lib/demoTemplates';
import { buildSafePreviewSrcDoc } from './CreationHistory';

interface DemoTemplatesProps {
  onSelect: (template: DemoTemplate) => void;
  disabled?: boolean;
}

// Gallery "bộ mẫu demo" — cùng vai trò với EXAMPLE_VIDEOS trong Video to
// Learning (xem src/video-to-learning-khanh/src/App.tsx): cho người dùng mới
// thấy ngay sản phẩm làm được gì, bấm vào là xem trực tiếp trong LivePreview,
// không tốn 1 lượt gọi AI nào. Bố cục cố ý dùng cặp thumbnail + app preview
// giống CreationHistory để người dùng thấy ngay ảnh nguồn và kết quả tương ứng.
export const DemoTemplates: React.FC<DemoTemplatesProps> = ({ onSelect, disabled }) => {
  return (
    <div className="w-full max-w-6xl mx-auto mt-2">
      <div className="flex items-center justify-center gap-2 mb-4 text-zinc-500">
        <SparklesIcon className="w-4 h-4" />
        <span className="text-xs font-mono uppercase tracking-wider">Or try one of these first</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {DEMO_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(template)}
            title={template.descriptionEn}
            className="group flex min-h-[20rem] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/60 text-left transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/60 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-950/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <div className="grid h-44 grid-cols-2 border-b border-zinc-800 bg-zinc-950/80">
              <div className="relative overflow-hidden border-r border-zinc-800">
                <div className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 backdrop-blur">Thumb</div>
                <img
                  src={template.thumbnail}
                  alt={`${template.name} thumbnail`}
                  loading="lazy"
                  className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
                />
              </div>
              <div className="relative overflow-hidden bg-white">
                <div className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">App</div>
                <iframe
                  title={`${template.name} app preview`}
                  srcDoc={buildSafePreviewSrcDoc(template.html)}
                  className="h-[300%] w-[300%] origin-top-left scale-[0.333] pointer-events-none"
                  tabIndex={-1}
                  loading="lazy"
                  sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                />
              </div>
            </div>
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-300">Demo</span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600">No AI cost</span>
              </div>
              <div className="line-clamp-1 text-sm font-semibold text-zinc-200 group-hover:text-white">
                {template.name}
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-zinc-500">{template.descriptionVi}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
