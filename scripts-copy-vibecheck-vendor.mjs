// scripts-copy-vibecheck-vendor.mjs
// ─── Self-host p5.js + three.js cho vibe-check-khanh Renderer.tsx ─────────────
//
// Renderer.tsx render sketch/shader do AI sinh ra bên trong <iframe srcDoc="...">
// sandbox — đây là 1 tài liệu HTML độc lập, KHÔNG đi qua bundle Vite của app,
// nên không thể `import` p5/three như module thường. Trước đây 2 thư viện này
// được nạp trực tiếp từ CDN (cdnjs cho p5.js, unpkg cho three.js) ngay bên
// trong srcDoc — không cache dùng chung, phụ thuộc mạng ngoài mỗi lần mở app.
//
// Script này copy sẵn 2 file build tĩnh từ node_modules (đã có trong
// package.json) vào public/vendor/ — Vite sẽ serve nguyên trạng ở root khi
// dev/build, iframe srcDoc dùng URL tương đối "/vendor/..." sẽ resolve theo
// origin của trang cha (cùng origin, iframe có allow-same-origin) — không
// cần CDN nữa.
import fs from 'fs'
import path from 'path'

const destDir = path.join('public', 'vendor')
fs.mkdirSync(destDir, { recursive: true })

const files = [
  { src: path.join('node_modules', 'p5', 'lib', 'p5.min.js'), dest: path.join(destDir, 'p5.min.js') },
  { src: path.join('node_modules', 'three', 'build', 'three.module.js'), dest: path.join(destDir, 'three.module.js') },
]

for (const { src, dest } of files) {
  if (!fs.existsSync(src)) {
    console.warn(`[vibecheck-vendor] Bỏ qua (không tìm thấy): ${src}`)
    continue
  }
  fs.copyFileSync(src, dest)
  console.log(`Copied ${src} -> ${dest}`)
}
