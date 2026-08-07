/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';
import { DEMO_TEMPLATES, type DemoTemplate } from '../lib/demoTemplates';

interface DemoTemplatesProps {
  onSelect: (template: DemoTemplate) => void;
  disabled?: boolean;
}

// Gallery "bộ mẫu demo" — cùng vai trò với EXAMPLE_VIDEOS trong Video to
// Learning (xem src/video-to-learning-khanh/src/App.tsx): cho người dùng mới
// thấy ngay sản phẩm làm được gì, bấm vào là xem trực tiếp trong LivePreview,
// không tốn 1 lượt gọi AI nào. Ảnh thumbnail là ảnh minh hoạ phong cách,
// không phải ảnh chụp trực tiếp của HTML mẫu bên dưới.
export const DemoTemplates: React.FC<DemoTemplatesProps> = ({ onSelect, disabled }) => {
  return (
    <div className="w-full max-w-5xl mx-auto mt-2">
      <div className="flex items-center justify-center gap-2 mb-4 text-zinc-500">
        <SparklesIcon className="w-4 h-4" />
        <span className="text-xs font-mono uppercase tracking-wider">Or try one of these first</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {DEMO_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(template)}
            title={template.descriptionEn}
            className="group text-left rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800 hover:border-blue-500/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="relative w-full bg-zinc-800" style={{ paddingTop: '62%' }}>
              <img
                src={template.thumbnail}
                alt={template.name}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            <div className="px-2.5 py-2">
              <div className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                {template.name}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
