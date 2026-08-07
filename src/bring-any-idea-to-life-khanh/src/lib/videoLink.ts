/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// src/bring-any-idea-to-life-khanh/src/lib/videoLink.ts
//
// Nhận diện link YouTube/Facebook video mà người dùng dán vào ô "Link video"
// (tính năng mới, mang từ "Video to Learning" sang — xem
// src/video-to-learning-khanh/src/lib/linkClassifier.ts + youtube.ts, đây là
// bản RÚT GỌN chỉ giữ phần "đây có phải link video hay không" + build URL
// nhúng iframe để hiện lại video gốc ở Split View, vì Bring Any Idea to Life
// chỉ cần link video (không cần phân biệt Shorts/kênh/website như bên kia).

export type VideoLinkType = 'youtube' | 'facebook';

export interface ClassifiedVideoLink {
  url: string;
  type: VideoLinkType;
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const FACEBOOK_HOSTS = new Set(['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch']);

export function getYouTubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com' || parsedUrl.hostname === 'm.youtube.com') {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && videoId.length === 11) return videoId;
      if (parsedUrl.pathname.startsWith('/shorts/')) {
        const id = parsedUrl.pathname.split('/')[2];
        if (id && id.length === 11) return id;
      }
      if (parsedUrl.pathname.startsWith('/embed/')) {
        const id = parsedUrl.pathname.substring(7);
        if (id && id.length === 11) return id;
      }
    }
    if (parsedUrl.hostname === 'youtu.be') {
      const videoId = parsedUrl.pathname.substring(1);
      if (videoId && videoId.length === 11) return videoId;
    }
  } catch {
    // fallthrough to regex below
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2]?.length === 11) return match[2];
  return null;
}

function isFacebookVideoPath(pathname: string): boolean {
  return /\/(videos|watch|reel|share\/v|share\/r)\b/i.test(pathname) || pathname === '/watch';
}

/** Trả về null nếu KHÔNG phải link video YouTube/Facebook hợp lệ (vd trang chủ, kênh, link web bất kỳ). */
export function classifyVideoUrl(rawInput: string): ClassifiedVideoLink | null {
  const raw = rawInput.trim();
  if (!raw) return null;

  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (FACEBOOK_HOSTS.has(hostname)) {
    if (hostname === 'fb.watch' || isFacebookVideoPath(parsed.pathname)) {
      return { url: parsed.toString(), type: 'facebook' };
    }
    return null; // link Facebook nhưng không phải video (vd trang cá nhân/group)
  }

  if (YOUTUBE_HOSTS.has(hostname)) {
    if (getYouTubeVideoId(parsed.toString())) {
      return { url: parsed.toString(), type: 'youtube' };
    }
    return null; // link YouTube nhưng không phải video cụ thể (vd kênh, trang chủ)
  }

  return null;
}

export function getYoutubeEmbedUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
}

export function getFacebookEmbedUrl(url: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
}

export function getVideoEmbedUrl(link: ClassifiedVideoLink): string {
  return link.type === 'youtube' ? getYoutubeEmbedUrl(link.url) : getFacebookEmbedUrl(link.url);
}
