import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',

  plugins: [],
  // Tránh Vite tự "leo" thư mục cha để tìm postcss.config.mjs của app React
  // ngoài cùng (ai-doctor-admin) — file đó require('tailwindcss') vốn không
  // được cài trong node_modules riêng của mediapipe-khanh, gây crash dev server
  // khi chạy `npm run dev` ngay trong thư mục con này (đúng workflow mà
  // playwright.config.ts webServer đang dùng để test).
  css: {
    postcss: {
      plugins: [],
    },
  },
  optimizeDeps: {
    exclude: [
      '@mediapipe/tasks-vision',
      '@mediapipe/tasks-audio',
      '@mediapipe/tasks-text'
    ]
  },
  worker: {
    format: 'es'
  },
  server: {
    port: 5174,
    strictPort: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  preview: {
    port: 5174,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  }
});
