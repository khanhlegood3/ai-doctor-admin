# mediapipe-api

Backend MediaPipe (pose / hand / face / gesture) tách riêng khỏi
`ai-doctor-admin`, chạy trên Vercel Python serverless functions, bán theo
lượt gọi API (API key + usage metering qua Upstash Redis).

## Vì sao tách riêng bằng Python thay vì dùng lại `@mediapipe/tasks-vision` (JS/WASM)?

Bản JS chạy trong app hiện tại được thiết kế cho **trình duyệt** (WebGL +
camera trực tiếp), rất khó/không ổn định khi chạy trong môi trường
serverless Node. Backend này dùng gói `mediapipe` (Python) — được hỗ trợ
tốt để chạy suy luận (inference) trên server, tự tải ảnh/frame do client
gửi lên qua HTTP.

## Admin dashboard (đăng nhập bằng mật khẩu, có session)

Trang tại `/admin` giờ có **đăng nhập thật** thay vì form nhập secret trần:

- `GET /admin` chưa đăng nhập → hiện form nhập mật khẩu (chính là
  `ADMIN_SECRET`).
- Đăng nhập đúng → set cookie `HttpOnly` + `Secure` + `SameSite=Strict`
  (ký bằng HMAC-SHA256, không dùng dependency ngoài), sống 12 tiếng, rồi
  chuyển vào dashboard.
- Vào dashboard rồi thì các ô "Admin Secret" ở tab Dashboard/Keys tự điền
  sẵn (server đã biết bạn đăng nhập đúng nên không bắt gõ lại).
- `GET /admin?logout=1` — xoá cookie, có nút "Đăng xuất" trên góc phải header.
- Trang dashboard **không còn là file tĩnh** (`admin/index.html` cũ đã bị
  xoá) — nó chỉ tồn tại dưới dạng chuỗi HTML render server-side trong
  `api/_lib/admin_page_html.py`, chỉ trả về sau khi cookie hợp lệ, nên
  không ai truy cập trực tiếp bypass đăng nhập được.

3 tab bên trong vẫn như cũ:
- **Test kết nối** — kiểm tra hệ thống (`/api/health`, không cần đăng nhập
  admin), test API + overlay landmarks.
- **Dashboard đo lường & tính tiền**.
- **Quản lý API key** (kèm nhãn khách hàng).

Cần thêm biến môi trường:
- `ADMIN_SECRET` — mật khẩu riêng cho dashboard (khác hẳn API key của khách).
- `PRICE_PER_CALL_USD` — giá mỗi lượt gọi để tính tiền ước tính (mặc định `0.001`).

⚠️ Trang admin giờ đã yêu cầu đăng nhập bằng `ADMIN_SECRET` trước khi vào
được bất kỳ tab nào (cookie ký HMAC, `HttpOnly`/`Secure`, sống 12h) — không
còn phải tự bật thêm Vercel Password Protection nữa. Muốn đăng xuất sớm
hơn 12h thì vào `/admin?logout=1`.

## Domain miễn phí

Có 2 lựa chọn, đều **miễn phí phía Vercel** (không tính phí thêm domain):

1. **Domain phụ tự động của Vercel** — mỗi project luôn có sẵn 1 domain
   dạng `<ten-project>.vercel.app`, dùng ngay không cần cấu hình gì. App
   chính của bạn cũng từng chạy kiểu này (`hienmaunhanvan.vercel.app`
   trước khi đổi sang domain riêng — thấy trong `src/lib/siteUrl.js`).
2. **Subdomain riêng trên domain đã có** (`hienmaunhanvan.com`) — vì bạn
   đã sở hữu domain này rồi nên tạo `api.hienmaunhanvan.com` cũng miễn phí:
   - Vercel project settings → Domains → thêm `api.hienmaunhanvan.com`.
   - Vào nơi quản lý DNS của `hienmaunhanvan.com` (Cloudflare/Namecheap/...),
     thêm bản ghi `CNAME api → cname.vercel-dns.com` (Vercel sẽ hiện đúng
     giá trị cần thêm ngay trong bước trên).
   - Đợi DNS lan truyền (thường vài phút tới ~1 giờ) là xong, hoàn toàn
     không phát sinh chi phí ngoài phí duy trì domain bạn đã trả sẵn.

## Deploy

1. Trên Vercel: **New Project** → chọn repo này → **Root Directory**:
   `mediapipe-api` (deploy độc lập với app React, không đụng tới app cũ).
2. Thêm biến môi trường trong Vercel project settings:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   (Tạo free database tại https://upstash.com — chọn Redis → REST API,
   copy 2 giá trị trên vào Vercel.)
   - `ADMIN_SECRET` — mật khẩu cho trang `/admin` (bịa 1 chuỗi dài, ngẫu nhiên).
   - `PRICE_PER_CALL_USD` (tuỳ chọn) — giá mỗi lượt gọi, mặc định `0.001`.
   - `RATE_LIMIT_PER_MINUTE` (tuỳ chọn) — giới hạn request/phút mỗi API key,
     mặc định `0` (không giới hạn). Đặt ví dụ `60` để chặn spam/abuse.
3. Deploy. Lần gọi API đầu tiên cho mỗi endpoint sẽ hơi chậm (cold start
   tải model `.task` từ Google về `/tmp`, ~vài MB–chục MB mỗi model);
   các lần sau trong cùng execution environment sẽ nhanh vì đã cache.

## Cấp API key cho khách

Chưa có UI quản trị — thêm key thủ công trong Upstash console (Redis CLI /
Data Browser):

```
SADD mediapipe:keys "sk_khach_abc123"
```

Xoá quyền truy cập:

```
SREM mediapipe:keys "sk_khach_abc123"
```

## Endpoints

Tất cả POST endpoint yêu cầu header `X-API-Key: <key>` và body JSON theo
1 trong 2 dạng:

```json
{ "image": "<base64 JPEG/PNG, có hoặc không có data: prefix>" }
```
hoặc (video / nhiều frame, tối đa 30 frame/request):
```json
{ "frames": ["<base64>", "<base64>", "..."] }
```

| Endpoint         | Trả về                                   |
|------------------|-------------------------------------------|
| `POST /api/pose`    | Toạ độ 33 điểm khớp cơ thể (x, y, z, visibility) |
| `POST /api/hand`    | Toạ độ 21 điểm mỗi bàn tay + tay trái/phải |
| `POST /api/face`    | 478 điểm khuôn mặt + blendshapes (biểu cảm) |
| `POST /api/gesture` | Cử chỉ tay được nhận diện (vd: Thumb_Up, Victory...) |
| `GET /api/usage`    | Số lượt đã dùng trong tháng (theo API key) |
| `GET /api/health`   | Trạng thái hệ thống (Redis, env var) — **không cần API key**, dùng để debug lúc mới deploy |
| `POST /api/admin-stripe-sync` | Báo usage lên Stripe cho các key có gắn Stripe Customer ID (admin, hoặc tự động qua cron) |

Ví dụ gọi:

```bash
curl -X POST https://<your-domain>/api/pose \
  -H "X-API-Key: sk_khach_abc123" \
  -H "Content-Type: application/json" \
  -d '{"image": "'"$(base64 -w0 photo.jpg)"'"}'
```

## Tính phí — hiện tại vs bước tiếp theo

- **Đo lượng dùng:** mỗi request thành công tăng counter trong Redis
  (`mediapipe:usage:<key>:<YYYY-MM>`), xem qua `GET /api/usage` hoặc tab
  Dashboard.
- **Thu tiền tự động qua Stripe** — đã làm xong phần báo cáo usage, còn 1
  bước thủ công 1 lần trong Stripe Dashboard cho mỗi khách mới (chi tiết
  bên dưới).

### Thiết lập Stripe (làm 1 lần)

1. Tạo tài khoản Stripe (nếu chưa có) tại https://dashboard.stripe.com.
2. **Billing → Meters** → tạo 1 meter mới, đặt tên event = giá trị bạn sẽ
   set cho env var `STRIPE_METER_EVENT_NAME` (mặc định `mediapipe_api_calls`,
   để mặc định cũng được, chỉ cần khớp).
3. **Product catalog** → tạo 1 Price kiểu "Metered" gắn vào meter vừa tạo,
   đặt giá tiền/1 lượt gọi tại đây (đây mới là giá **thật sự bị trừ tiền**,
   khác với `PRICE_PER_CALL_USD` — biến đó chỉ để dashboard tự ước tính,
   không liên quan tới Stripe).
4. **Developers → API keys** → copy Secret key, set vào env var
   `STRIPE_SECRET_KEY` trên Vercel.

Với mỗi khách hàng mới:
5. Tạo Stripe Customer cho họ (Dashboard hoặc qua Payment Link/Checkout) và
   **subscribe họ vào Price ở bước 3** (bắt buộc — chưa subscribe thì dù
   báo usage lên Stripe cũng không tính tiền được). Cách nhanh nhất: tạo 1
   Payment Link cho Price đó, gửi khách hàng tự nhập thẻ.
6. Copy **Customer ID** (`cus_...`) của họ, dán vào ô "Stripe Customer ID"
   khi thêm key ở tab **Quản lý API key** trong admin dashboard.

Sau đó hệ thống tự lo phần còn lại:
- **Tự động (cron):** `vercel.json` đã cấu hình chạy `/api/admin-stripe-sync`
  mỗi ngày lúc 3h sáng UTC — đọc số lượt dùng trong tháng của từng key có
  gắn Stripe Customer ID, báo phần **chênh lệch** (delta) lên Stripe, Stripe
  tự tính tiền & xuất hoá đơn theo chu kỳ subscription của khách.
- **Thủ công / test ngay:** nút "💳 Đồng bộ lên Stripe" ở tab Dashboard,
  đồng bộ ngay lập tức, không cần đợi cron.

Cần thêm biến môi trường cho phần này:
- `STRIPE_SECRET_KEY` — secret key từ bước 4.
- `STRIPE_METER_EVENT_NAME` (tuỳ chọn) — mặc định `mediapipe_api_calls`,
  phải khớp với tên event của meter ở bước 2.
- `CRON_SECRET` (khuyến nghị) — Vercel tự thêm header xác thực cho cron job
  khi biến này được set (Vercel docs: Cron Jobs → Securing cron jobs).
  Không set thì cron vẫn chạy được (endpoint tự chấp nhận), nhưng nên set
  để tránh người ngoài gọi endpoint sync tuỳ ý (dù họ vẫn cần biết được
  URL và endpoint cũng an toàn nhờ mỗi request idempotent — không double-bill).

⚠️ **Lưu ý quan trọng:** hệ thống **không tự tạo Stripe Customer/Subscription**
— bạn vẫn phải làm bước 5 thủ công mỗi khách mới (thu thẻ qua Payment
Link/Checkout của Stripe). Việc tự động hoá hoàn toàn bước đó (tự sinh
Payment Link khi thêm key) có thể làm sau nếu cần.

## Giới hạn hiện tại (cần biết trước khi bán)

- Mỗi request tối đa 30 frame (batch/video) — tránh timeout function.
- `maxDuration: 60s` trong `vercel.json` — cần gói Vercel Pro trở lên nếu
  muốn hơn 10s (Hobby plan giới hạn 10s/function).
- Rate limit theo phút có thể bật qua `RATE_LIMIT_PER_MINUTE`, nhưng đây là
  giới hạn "best effort" (đếm theo cửa sổ 1 phút cố định, không phải sliding
  window chính xác tuyệt đối) — đủ để chặn spam thô, chưa phải chống DDoS.
- Session đăng nhập admin sống 12h rồi tự hết hạn (hoặc bấm "Đăng xuất").
  Không có tài khoản nhiều người dùng — chỉ 1 mật khẩu chung (`ADMIN_SECRET`).
- Thu tiền vẫn là **thủ công**: dashboard chỉ cho số liệu + ước tính $,
  chưa tự trừ tiền/xuất hoá đơn. Khi cần tự động, nối Stripe Metered
  Billing như mô tả ở trên.
