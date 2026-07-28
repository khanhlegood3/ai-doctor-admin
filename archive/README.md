# Space Status (Hugging Face) — ĐÃ ARCHIVE, chưa xoá hẳn

Thư mục này mô phỏng ĐÚNG cấu trúc thư mục của repo thật (`api/`,
`src/components/`) để sau này chỉ cần copy đè theo đúng path tương ứng, khỏi
phải tự đoán chỗ đặt file:

```
archive/
├── api/
│   └── space-status.js              -> đặt lại vào api/space-status.js
└── src/components/
    └── SpaceStatusBadge.jsx         -> đặt lại vào src/components/SpaceStatusBadge.jsx
```

Bộ 2 file này bị gỡ khỏi luồng chạy chính vào 2026-07-26 vì:
- `api/space-status.js` là 1 trong 13 serverless function (Vercel Hobby chỉ
  cho 12), và component duy nhất gọi tới nó (`SpaceStatusBadge.jsx`) **không
  được import/render ở bất kỳ đâu** trong app — nên trên thực tế API này
  chưa từng nhận request thật nào từ user.

## Chức năng (để nhớ lại khi cần dùng lại)
- `api/space-status.js`: Vercel function, GET `/api/space-status?spaces=<namespace>/<repo>`
  (vd `3DAIGC/LAM`) — gọi API công khai của Hugging Face
  (`https://huggingface.co/api/spaces/{spaceId}`) để lấy `stage` thật
  (RUNNING/BUILDING/SLEEPING/BUILD_ERROR/...) TRƯỚC KHI user bấm "Generate",
  tránh để họ ăn lỗi 502 từ 1 chỗ khác gọi là `lam-generate.js` (file đó hiện
  không có trong repo — có thể đã bị xoá hoặc thuộc nhánh khác; nếu khôi phục
  tính năng này thì cần rà lại xem `lam-generate.js`/luồng "Generate" liên
  quan còn tồn tại không).
- `src/components/SpaceStatusBadge.jsx`: component React hiển thị badge
  trạng thái Space đó (màu + label VI/EN), fetch từ endpoint trên.

## Cách khôi phục khi cần (vd cho dự án Hugging Face Space lớn hơn — "huge
Hugging Face Space")
1. Copy `archive/api/space-status.js` → `api/space-status.js` (đúng path,
   không cần đổi tên).
2. Copy `archive/src/components/SpaceStatusBadge.jsx` →
   `src/components/SpaceStatusBadge.jsx`.
3. Import + render `<SpaceStatusBadge spaces={['namespace/repo']} />` ở màn
   hình thật sự cần badge đó (trước đây dự kiến gắn cạnh nút "Generate" của
   1 tính năng dùng LAM Hugging Face Space — kiểm tra lại vì tính năng gọi
   đó có thể chưa/không còn tồn tại trong repo hiện tại).
4. Kiểm tra lại quota 12 function của Vercel trước khi thêm lại — hiện đang
   dùng đúng 11/12 (sau khi gỡ file này) + 1 file mới `affiliate-admin-stats.js`
   coi như dùng lại đúng 12/12 (xem ghi chú kèm theo repo).

---

# My Image to Video (Wan 2.x) — ĐÃ ARCHIVE, chưa xoá hẳn

```
archive/
├── api/
│   └── wan-image-to-video.js        -> đặt lại vào api/wan-image-to-video.js
└── src/components/
    └── MyImageToVideoPanel.jsx      -> đặt lại vào src/components/MyImageToVideoPanel.jsx
```

Bộ 2 file này bị gỡ khỏi luồng chạy chính vào 2026-07-28 vì repo lại chạm mốc
13/12 serverless functions (Vercel Hobby chỉ cho 12) sau khi có thêm
`affiliate-admin-stats.js`. Đây là tính năng admin-only (`myImageToVideo`,
`ADMIN_ONLY_PANELS`), tần suất dùng thấp, nên được ưu tiên gỡ trước.

## Chức năng (để nhớ lại khi cần dùng lại)
- `api/wan-image-to-video.js`: Vercel serverless function, nhận ảnh + prompt
  từ `MyImageToVideoPanel.jsx`, gọi model Wan image-to-video (qua Hugging
  Face / provider tương ứng — xem lại API key/env var cụ thể trong file khi
  khôi phục) để tạo video ngắn từ 1 ảnh tĩnh.
- `src/components/MyImageToVideoPanel.jsx`: panel React admin-only cho phép
  upload ảnh, nhập prompt, gọi endpoint trên, hiển thị tiến trình + video kết
  quả (bilingual VI/EN, theo đúng convention chung của app).

## Cách khôi phục khi cần
1. Copy `archive/api/wan-image-to-video.js` → `api/wan-image-to-video.js`
   (đúng path, không đổi tên).
2. Copy `archive/src/components/MyImageToVideoPanel.jsx` →
   `src/components/MyImageToVideoPanel.jsx`.
3. Trong `src/App.jsx`:
   - Thêm lại `import MyImageToVideoPanel from './components/MyImageToVideoPanel.jsx'`.
   - Thêm lại `'myImageToVideo'` vào mảng `PANELS` và `ADMIN_ONLY_PANELS`.
   - Thêm lại `myImageToVideo: 'My Image to Video',` vào `panelLabels`.
   - Thêm lại khối render:
     ```jsx
     {active === 'myImageToVideo' && user?.isAdmin && <MyImageToVideoPanel onPrev={goPrev} prevLabel={prevLabel} />}
     {active === 'myImageToVideo' && !user?.isAdmin && (
       <div style={{ padding: 40, textAlign: 'center', color: '#ff5252' }}>🔒 Admin only</div>
     )}
     ```
4. Trong `src/components/Sidebar.jsx`, thêm lại:
   `{ id: 'myImageToVideo', label: t('admin_myImageToVideo'), step: 'LAST', icon: '🎞️' },`
5. Trong `src/context/AppContext.jsx`, thêm lại 2 dòng dịch:
   - VI: `admin_myImageToVideo: 'Ảnh Sang Video Của Tôi',`
   - EN: `admin_myImageToVideo: 'My Image to Video',`
6. Trong `vercel.json`, thêm lại config `maxDuration` cho function này (đã gỡ
   khỏi `vercel.json` cùng lúc archive — thiếu bước này thì build sẽ lỗi
   "unmatched function pattern" nếu quên gỡ, hoặc video generation bị timeout
   sớm nếu quên thêm lại khi khôi phục):
   ```json
   "functions": {
     "api/wan-image-to-video.js": { "maxDuration": 60 }
   }
   ```
7. Kiểm tra lại quota 12 function của Vercel trước khi thêm lại (đang đúng
   12/12 sau khi gỡ file này — cần gỡ bớt 1 function khác nếu muốn khôi phục
   tính năng này).

