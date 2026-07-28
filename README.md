# ai-doctor-admin (hợp nhất — public/games + api/ + src/ cùng 1 project)

Đây là TOÀN BỘ repo `ai-doctor-admin` gốc (đã bỏ `archive/` và `.env` thật),
giữ nguyên kiến trúc app React cha nhúng game qua iframe. Không còn tách
riêng `bao-ve-co-the` thành 1 project/deploy khác — mọi thứ (React app,
game tĩnh, API) nằm chung 1 repo, 1 Vercel project, cùng origin.

## Kiến trúc / luồng dữ liệu

```
src/components/BodyProtectionJourneyPanel.jsx
  └─ nhúng <iframe src="/games/portal-index.html"> (same-origin)
       └─ public/games/portal-index.html (game portal, file tĩnh)
            ├─ localStorage: leaderboard, tên, UUID người chơi (không đổi)
            ├─ [MỚI] tự sinh UUID nếu chạy standalone (ensureOwnUUID)
            ├─ [MỚI] bắt ?ref=<uuid|userId> trên URL, lưu 1 lần (captureReferrerFromUrl)
            ├─ Khi thắng game:
            │    ├─ postMessage(data) lên window.parent (CŨ — app cha xử lý thưởng on-chain)
            │    └─ [MỚI] fetch POST /api/affiliate-referral (đăng ký quan hệ giới thiệu)
            └─ api/user-profile.js, api/affiliate-referral.js, api/game-leaderboard.js
                 └─ MongoDB Atlas (MONGODB_URI)
```

**Vì sao vẫn giữ cả 2 đường (postMessage VÀ fetch trực tiếp):**
- `postMessage` → app cha (`BodyProtectionJourneyPanel.jsx`) vẫn là nơi xử
  lý **thưởng on-chain thật** (gọi `src/lib/gameAffiliateChain.js` →
  smart contract BSC Testnet) — phần này KHÔNG có trong `api/`, không đổi.
- `fetch('/api/affiliate-referral')` mới thêm để **portal vẫn ghi được quan
  hệ giới thiệu dù chạy standalone** (không bị nhúng iframe) — 2 đường không
  xung đột vì endpoint đã idempotent (gọi 2 lần không tạo trùng bản ghi).

## 3 chỗ đã sửa trong `public/games/portal-index.html`

1. `ensureOwnUUID()` — tự sinh UUID bằng `crypto.randomUUID()` nếu chưa có,
   thay vì chỉ chờ app cha gán qua `window.setPlayerIdentity`.
2. `captureReferrerFromUrl()` — đọc `?ref=` trên URL, tra UUID qua
   `GET /api/user-profile?userId=...` nếu cần, lưu 1 lần duy nhất.
3. `maybeRegisterAffiliateReferral()` — gọi `POST /api/affiliate-referral`
   khi thắng game, có cờ tránh gọi lặp.

## Việc cần làm trước khi deploy

1. Copy `.env.example` → `.env`, điền:
   - `MONGODB_URI` (bắt buộc — dùng chung cho user-profile, affiliate-referral,
     game-leaderboard, moralis, affiliate-admin-stats)
   - `ANTHROPIC_API_KEY` — **key cũ trong repo gốc đã bị lộ công khai, đã
     revoke/rotate key mới rồi mới điền vào đây.**
   - Các biến `VITE_*`, `MORALIS_STREAM_SECRET` theo nhu cầu thực tế.
2. `npm install`
3. `npm run dev` (Vite) để chạy local — hoặc deploy thẳng lên Vercel
   (1 project duy nhất, không cần rewrite/proxy sang domain khác nữa).
4. Test: mở `/games/portal-index.html?ref=<userId>` rồi thắng 1 ván, kiểm
   tra Network tab thấy `POST /api/affiliate-referral` chạy đúng, đồng thời
   nếu nhúng trong `BodyProtectionJourneyPanel.jsx` thì luồng thưởng on-chain
   cũ vẫn chạy như trước (không bị ảnh hưởng).
