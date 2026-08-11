/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useEffect, useMemo, useState } from 'react';
import { ClockIcon, ArrowRightIcon, DocumentIcon, PhotoIcon, FilmIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { classifyVideoUrl, getVideoEmbedUrl } from '../lib/videoLink';

export interface Creation {
  id: string;
  name: string;
  html: string;
  originalImage?: string; // Base64 data URL hoặc URL R2 của ảnh/PDF/video upload trực tiếp
  mimeType?: string | null; // MIME của originalImage khi originalImage là URL R2
  videoUrl?: string; // Link YouTube/Facebook gốc, nếu creation đến từ link video (không upload file)
  timestamp: Date;
}

interface CreationHistoryProps {
  history: Creation[];
  onSelect: (creation: Creation) => void;
  onLoadR2: () => void;
  isLoadingR2: boolean;
}

const ITEMS_PER_PAGE = 5;

function getCreationSourceKey(item: Creation): string {
  if (item.videoUrl) return `video:${item.videoUrl}`;
  if (item.originalImage && !item.originalImage.startsWith('data:')) return `source:${item.originalImage}`;
  return `single:${item.id}`;
}

function getCreationSourceLabel(item: Creation): string {
  if (item.videoUrl) return item.videoUrl;
  if (item.originalImage && !item.originalImage.startsWith('data:')) return item.originalImage;
  return item.name;
}

interface CreationGroup {
  key: string;
  label: string;
  items: Creation[];
  latest: Creation;
}

function groupCreationsBySource(history: Creation[]): CreationGroup[] {
  const groups = new Map<string, CreationGroup>();
  history.forEach((item) => {
    const key = getCreationSourceKey(item);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
      existing.items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      existing.latest = existing.items[0];
    } else {
      groups.set(key, { key, label: getCreationSourceLabel(item), items: [item], latest: item });
    }
  });
  return Array.from(groups.values()).sort((a, b) => b.latest.timestamp.getTime() - a.latest.timestamp.getTime());
}

export function buildSafePreviewSrcDoc(html: string): string {
  const baseStyle = '<style>html,body{background:#ffffff;color:#111111;color-scheme:light;}</style>';

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (match) => `${match}${baseStyle}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (match) => `${match}<head>${baseStyle}</head>`);
  }
  return `<!DOCTYPE html><html><head><meta charset="utf-8">${baseStyle}<style>body{margin:0;padding:24px;font-family:ui-monospace,monospace;white-space:pre-wrap;line-height:1.6;}</style></head><body>${html}</body></html>`;
}

const SourceThumbnail: React.FC<{ item: Creation; isPdf: boolean; isVideo: boolean }> = ({ item, isPdf, isVideo }) => {
  if (item.videoUrl) {
    const classified = classifyVideoUrl(item.videoUrl);
    if (classified) {
      return (
        <iframe
          title={`${item.name} source video thumbnail`}
          src={getVideoEmbedUrl(classified)}
          className="h-full w-full pointer-events-none"
          tabIndex={-1}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
      );
    }
  }

  if (item.originalImage && !isPdf && !item.originalImage.startsWith('data:video')) {
    return <img src={item.originalImage} alt={`${item.name} source thumbnail`} className="h-full w-full object-cover" loading="lazy" />;
  }

  const Icon = isVideo ? FilmIcon : isPdf ? DocumentIcon : item.originalImage ? PhotoIcon : DocumentIcon;
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-500">
      <Icon className="h-8 w-8" />
      <span className="text-[10px] font-bold uppercase tracking-wider">{isVideo ? 'Video' : isPdf ? 'PDF' : 'Source'}</span>
    </div>
  );
};

export const CreationHistory: React.FC<CreationHistoryProps> = ({ history, onSelect, onLoadR2, isLoadingR2 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const groupedHistory = useMemo(() => groupCreationsBySource(history), [history]);
  const pageCount = Math.max(1, Math.ceil(groupedHistory.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const visibleGroups = useMemo(() => groupedHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE), [groupedHistory, startIndex]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, pageCount));
  }, [pageCount]);

  const canGoPrevious = currentPage > 1;
  const canGoNext = currentPage < pageCount;
  const paginationControls = history.length > 0 ? (
    <div className="flex flex-col gap-2 rounded-2xl border border-zinc-800/80 bg-zinc-900/30 p-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
        Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, groupedHistory.length)} of {groupedHistory.length} source groups · {history.length} versions
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
          disabled={!canGoPrevious}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-3 w-3" /> Prev
        </button>
        <span className="min-w-16 text-center text-[11px] font-mono text-zinc-400">Page {currentPage}/{pageCount}</span>
        <button
          type="button"
          onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
          disabled={!canGoNext}
          className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-300 transition-colors hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next <ChevronRightIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col gap-3 px-2 mb-3">
        <div className="flex items-center space-x-3">
          <ClockIcon className="w-4 h-4 text-zinc-500" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">Archive</h2>
          <div className="h-px flex-1 bg-zinc-800"></div>
          <button
            type="button"
            onClick={onLoadR2}
            disabled={isLoadingR2}
            className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-300 transition-colors hover:border-blue-400 hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoadingR2 ? 'Loading R2...' : 'Load history from R2'}
          </button>
        </div>

        {paginationControls}
      </div>
      
      {history.length === 0 ? (
        <div className="px-2 pb-2 text-xs text-zinc-600">No local history yet. Load previous searches from R2 to restore saved creations.</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 px-2 pb-2 lg:grid-cols-5">
          {visibleGroups.map((group) => {
            const item = group.latest;
            const isPdf = item.originalImage?.startsWith('data:application/pdf') ?? false;
            const isVideo = Boolean(item.videoUrl) || (item.originalImage?.startsWith('data:video') ?? false);
            return (
              <button
                key={group.key}
                onClick={() => onSelect(item)}
                className="group relative flex min-h-[21rem] flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 text-left transition-all duration-200 hover:-translate-y-1 hover:border-blue-500/60 hover:bg-zinc-900 hover:shadow-2xl hover:shadow-blue-950/20"
              >
                <div className="grid h-44 grid-cols-2 border-b border-zinc-800 bg-zinc-950/80">
                  <div className="relative overflow-hidden border-r border-zinc-800">
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 backdrop-blur">Thumb</div>
                    <SourceThumbnail item={item} isPdf={isPdf} isVideo={isVideo} />
                  </div>
                  <div className="relative overflow-hidden bg-white">
                    <div className="absolute left-2 top-2 z-10 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur">App</div>
                    <iframe
                      title={`${item.name} app preview`}
                      srcDoc={buildSafePreviewSrcDoc(item.html)}
                      className="h-[300%] w-[300%] origin-top-left scale-[0.333] pointer-events-none"
                      tabIndex={-1}
                      loading="lazy"
                      sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin"
                    />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-zinc-700 bg-zinc-800/80 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      {group.items.length > 1 ? `${group.items.length} versions` : isVideo ? 'Video' : isPdf ? 'PDF' : item.originalImage ? 'Image' : 'HTML'}
                    </span>
                    <span className="shrink-0 text-[10px] font-mono text-zinc-600 group-hover:text-zinc-400">
                      {item.timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })} · {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-semibold text-zinc-200 group-hover:text-white">{item.name}</h3>
                  <p className="mt-2 line-clamp-2 break-all text-[10px] leading-4 text-zinc-500">{group.label}</p>
                  {group.items.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {group.items.slice(0, 6).map((version, index) => (
                        <button
                          key={version.id}
                          type="button"
                          onClick={() => onSelect(version)}
                          className="rounded-full border border-zinc-700 bg-zinc-950/80 px-2 py-1 text-[10px] font-bold text-zinc-300 transition-colors hover:border-blue-400 hover:text-blue-200"
                          title={`${version.name} · ${version.timestamp.toLocaleString()}`}
                        >
                          v{group.items.length - index}
                        </button>
                      ))}
                      {group.items.length > 6 && <span className="px-1 py-1 text-[10px] text-zinc-500">+{group.items.length - 6}</span>}
                    </div>
                  )}
                  <div className="mt-auto flex items-center space-x-1 pt-4 opacity-80 transition-opacity group-hover:opacity-100">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Restore latest preview</span>
                    <ArrowRightIcon className="w-3 h-3 text-blue-400" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      {history.length > 0 && <div className="px-2 pt-3">{paginationControls}</div>}
    </div>
  );
};
