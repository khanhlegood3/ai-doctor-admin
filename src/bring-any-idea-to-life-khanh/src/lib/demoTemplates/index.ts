/**
 * Bộ "mẫu demo" cho Bring Any Idea to Life — tương đương EXAMPLE_VIDEOS của
 * Video to Learning (xem src/video-to-learning-khanh/src/App.tsx +
 * lib/history/examples.json): mỗi mẫu là 1 HTML tự chứa (đã "sinh sẵn"),
 * bấm vào là xem ngay trong LivePreview, KHÔNG gọi AI, KHÔNG lưu vào
 * IndexedDB/R2 lịch sử cá nhân của người dùng (xem handleSelectDemo trong
 * App.tsx) — giống hệt cách loadMockExample() của Video to Learning không
 * persist các ví dụ mẫu vào lịch sử thật.
 *
 * Bản gốc AI Studio từng nạp 3 "creation mẫu" từ bucket demo của Google
 * (storage.googleapis.com/sideprojects-asronline/...) nhưng bị chặn CORS khi
 * tự host domain khác (xem ghi chú đã xoá trong App.tsx) — bộ 9 mẫu này thay
 * thế hoàn toàn bằng HTML tự viết, tự host, không phụ thuộc mạng ngoài.
 */
import { CALM_SPACE_HTML } from './calmSpace';
import { CYBER_RAIN_HTML } from './cyberRain';
import { COLOR_ROOM_HTML } from './colorRoom';
import { FLOW_SHADER_HTML } from './flowShader';
import { DREAM_RUN_HTML } from './dreamRun';
import { VORTEX_GALLERY_HTML } from './vortexGallery';
import { ASCII_MOON_HTML } from './asciiMoon';
import { MOON_NOTE_HTML } from './moonNote';
import { SEASIDE_STAY_HTML } from './seasideStay';

export interface DemoTemplate {
  id: string;
  name: string;
  descriptionEn: string;
  descriptionVi: string;
  thumbnail: string;
  html: string;
}

export const DEMO_TEMPLATES: DemoTemplate[] = [
  {
    id: 'calm-space',
    name: 'Calm Space',
    descriptionEn: 'A breathing orb that guides you through a slow, calming cycle.',
    descriptionVi: 'Một quả cầu ánh sáng dẫn nhịp thở chậm rãi, thư giãn.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/10-calm-space-fullstack-en-long.png',
    html: CALM_SPACE_HTML,
  },
  {
    id: 'cyber-rain',
    name: 'Cyber Rain',
    descriptionEn: 'Matrix-style digital rain with live speed, density, and color controls.',
    descriptionVi: 'Mưa dữ liệu kiểu Matrix, chỉnh được tốc độ, mật độ và màu.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/1-cyber-rain-frontend-en-long.png',
    html: CYBER_RAIN_HTML,
  },
  {
    id: 'color-room',
    name: 'Color Room',
    descriptionEn: 'A 3D room you repaint wall-by-wall, then spin around to admire.',
    descriptionVi: 'Một căn phòng 3D bạn tự sơn từng mảng, xoay quanh để ngắm.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/2-color-room-frontend-en-long.jpg',
    html: COLOR_ROOM_HTML,
  },
  {
    id: 'flow-shader',
    name: 'Flow Shader',
    descriptionEn: 'A cursor-reactive particle flow field with switchable palettes.',
    descriptionVi: 'Trường hạt chuyển động theo con trỏ, đổi được bảng màu.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/3-flow-shader-frontend-en-long.jpg',
    html: FLOW_SHADER_HTML,
  },
  {
    id: 'dream-run',
    name: 'Dream Run',
    descriptionEn: 'A pastel endless runner — jump crystal spikes, collect sparkles.',
    descriptionVi: 'Trò chạy vô tận màu pastel — nhảy qua chướng ngại, gom sao lấp lánh.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/5-dream-run-frontend-en-long.png',
    html: DREAM_RUN_HTML,
  },
  {
    id: 'vortex-gallery',
    name: 'Vortex Gallery',
    descriptionEn: 'A 3D ring of cards you drag to spin and scroll to zoom.',
    descriptionVi: 'Vòng thẻ 3D kéo để xoay, cuộn để phóng to/thu nhỏ.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/7-vortex-gallery-frontend-en-long.png',
    html: VORTEX_GALLERY_HTML,
  },
  {
    id: 'ascii-moon',
    name: 'ASCII Moon',
    descriptionEn: 'A rotating moon rendered entirely in ASCII, terminal-green style.',
    descriptionVi: 'Mặt trăng xoay được vẽ hoàn toàn bằng ký tự ASCII, phong cách terminal xanh lá.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/6-ascii-moon-frontend-en-long.png',
    html: ASCII_MOON_HTML,
  },
  {
    id: 'moon-note',
    name: 'Moon Note',
    descriptionEn: 'A quiet night-themed notes app with a starfield backdrop.',
    descriptionVi: 'Ứng dụng ghi chú ban đêm yên tĩnh với nền trời đầy sao.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/9-moon-note-fullstack-en-long.png',
    html: MOON_NOTE_HTML,
  },
  {
    id: 'seaside-stay',
    name: 'Seaside Stay',
    descriptionEn: 'A vacation-rental landing page with search and a booking flow.',
    descriptionVi: 'Trang cho thuê nhà nghỉ ven biển với tìm kiếm và luồng đặt phòng.',
    thumbnail: 'https://kimi-img.moonshot.cn/pub/websites/template/full-images/12-seaside-stay-fullstack-en-long.jpg',
    html: SEASIDE_STAY_HTML,
  },
];
