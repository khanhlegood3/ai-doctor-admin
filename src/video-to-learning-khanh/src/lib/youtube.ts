// Chuyển thể từ video-to-learning-app (AI Studio) gốc — giữ nguyên logic,
// chỉ dọn lại phần import/export cho phù hợp cấu trúc sub-app "-khanh".

export const getYouTubeVideoId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.hostname === 'www.youtube.com' ||
      parsedUrl.hostname === 'youtube.com'
    ) {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
    if (parsedUrl.hostname === 'youtu.be') {
      const videoId = parsedUrl.pathname.substring(1);
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
    if (parsedUrl.pathname.startsWith('/embed/')) {
      const videoId = parsedUrl.pathname.substring(7);
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
  } catch (e) {
    console.warn('URL parsing failed:', e);
  }
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return match[2];
  }
  return null;
};

export function validateYoutubeUrl(url: string): {
  isValid: boolean;
  error?: string;
} {
  if (getYouTubeVideoId(url)) {
    return { isValid: true };
  }
  return { isValid: false, error: 'Link YouTube không hợp lệ' };
}

export function getYoutubeEmbedUrl(url: string): string {
  const videoId = getYouTubeVideoId(url);
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }
  console.warn('Could not extract video ID for embedding, using original URL:', url);
  return url;
}
