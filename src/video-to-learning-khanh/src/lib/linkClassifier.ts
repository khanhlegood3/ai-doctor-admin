// src/video-to-learning-khanh/src/lib/linkClassifier.ts
// Phân loại 1 khối text người dùng dán vào (có thể là 1 link, hoặc 1 danh
// sách nhiều link mỗi dòng 1 cái, hoặc dán liền các link cách nhau bằng
// khoảng trắng/dấu phẩy) thành từng entry có type rõ ràng:
//   'youtube_video'   — link video YouTube thường (watch?v=, youtu.be/, /embed/)
//   'youtube_short'   — link YouTube Shorts (/shorts/<id>)
//   'youtube_channel' — link kênh YouTube (/channel/, /@handle, /c/, /user/)
//   'website'         — mọi link http/https khác (không phải YouTube)
//
// KHÔNG dùng cho việc validate video ID chi tiết (đã có youtube.ts lo phần
// đó) — module này chỉ quyết định "link này nên đi vào pipeline nào".

import { getYouTubeVideoId } from './youtube';

export type LinkType = 'youtube_video' | 'youtube_short' | 'youtube_channel' | 'website';

export interface ClassifiedLink {
  raw: string;
  url: string;
  type: LinkType;
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

function isYoutubeHost(hostname: string): boolean {
  return YOUTUBE_HOSTS.has(hostname.toLowerCase());
}

export function classifyLink(rawInput: string): ClassifiedLink | null {
  const raw = rawInput.trim();
  if (!raw) return null;

  // Cho phép người dùng dán link thiếu "https://" (vd "youtube.com/watch?v=...")
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null; // không parse được -> bỏ qua, không phải 1 URL hợp lệ
  }

  if (!isYoutubeHost(parsed.hostname)) {
    return { raw, url: parsed.toString(), type: 'website' };
  }

  const path = parsed.pathname;

  if (path.startsWith('/shorts/')) {
    return { raw, url: parsed.toString(), type: 'youtube_short' };
  }

  if (
    path.startsWith('/channel/') ||
    path.startsWith('/c/') ||
    path.startsWith('/user/') ||
    path.startsWith('/@')
  ) {
    return { raw, url: parsed.toString(), type: 'youtube_channel' };
  }

  // watch?v=..., youtu.be/<id>, /embed/<id> -> video thường, nếu trích được videoId hợp lệ
  if (getYouTubeVideoId(parsed.toString())) {
    return { raw, url: parsed.toString(), type: 'youtube_video' };
  }

  // Link youtube.com khác không nhận diện được (vd trang chủ, /results?search_query=...)
  // -> coi như 1 "website" bình thường để không rớt mất, AI vẫn có thể tóm tắt trang đó.
  return { raw, url: parsed.toString(), type: 'website' };
}

/**
 * Tách 1 khối text thành danh sách các link đã phân loại — chấp nhận
 * xuống dòng, dấu phẩy, hoặc khoảng trắng làm dấu phân cách, loại bỏ trùng
 * lặp (giữ lần xuất hiện đầu tiên).
 */
export function classifyLinkList(blockText: string): ClassifiedLink[] {
  const pieces = blockText
    .split(/[\n\r,]+|\s+(?=https?:\/\/)/g)
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const results: ClassifiedLink[] = [];
  for (const piece of pieces) {
    const classified = classifyLink(piece);
    if (!classified) continue;
    if (seen.has(classified.url)) continue;
    seen.add(classified.url);
    results.push(classified);
  }
  return results;
}

export const LINK_TYPE_LABELS: Record<LinkType, { vi: string; en: string; icon: string }> = {
  youtube_video: { vi: 'Video YouTube', en: 'YouTube video', icon: '▶️' },
  youtube_short: { vi: 'YouTube Short', en: 'YouTube Short', icon: '🎞️' },
  youtube_channel: { vi: 'Kênh YouTube', en: 'YouTube channel', icon: '📺' },
  website: { vi: 'Trang web', en: 'Website', icon: '🌐' },
};
