// Chuyển thể từ video-to-learning-app (AI Studio) gốc — giữ nguyên logic,
// chỉ dọn lại phần import/export cho phù hợp cấu trúc sub-app "-khanh".

export const getYouTubeVideoId = (url: string): string | null => {
  try {
    const parsedUrl = new URL(url);
    const host = parsedUrl.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (host === 'youtube.com' || host === 'music.youtube.com') {
      const videoId = parsedUrl.searchParams.get('v');
      if (videoId && videoId.length === 11) {
        return videoId;
      }
      // BUG THỰC TẾ đã gặp: link YouTube Shorts (vd
      // youtube.com/shorts/HRUpX7-srVE?si=...) không có query ?v=, mà video
      // ID nằm trong path /shorts/<id> — trước đây hàm này chỉ nhận diện
      // /embed/, KHÔNG có /shorts/ hay /live/, nên trả về null cho mọi link
      // Shorts. getYoutubeEmbedUrl() bên dưới khi đó fallback về dùng NGUYÊN
      // URL gốc (trang xem thường, không phải /embed/) làm src cho <iframe>
      // — YouTube CHẶN nhúng trang xem thường trong iframe (X-Frame-Options),
      // khiến khung preview lỗi/trắng thay vì phát được video. Cùng bug (và
      // cùng cách sửa: parse bằng URL/pathname) đã xử lý ở backend
      // api/_lib/youtubeTranscript.js — sửa lại tương tự ở đây vì đây là 1
      // bản sao RIÊNG, KHÔNG dùng chung code với backend.
      const pathMatch = parsedUrl.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/);
      if (pathMatch && pathMatch[2].length === 11) {
        return pathMatch[2];
      }
    }
    if (host === 'youtu.be') {
      const videoId = parsedUrl.pathname.split('/').filter(Boolean)[0];
      if (videoId && videoId.length === 11) {
        return videoId;
      }
    }
  } catch (e) {
    console.warn('URL parsing failed:', e);
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

export function getFacebookEmbedUrl(url: string): string {
  return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
}
