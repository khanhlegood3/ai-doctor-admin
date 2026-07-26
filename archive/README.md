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

