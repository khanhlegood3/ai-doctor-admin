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

## Deploy

1. Trên Vercel: **New Project** → chọn repo này → **Root Directory**:
   `mediapipe-api` (deploy độc lập với app React, không đụng tới app cũ).
2. Thêm biến môi trường trong Vercel project settings:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   (Tạo free database tại https://upstash.com — chọn Redis → REST API,
   copy 2 giá trị trên vào Vercel.)
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

Ví dụ gọi:

```bash
curl -X POST https://<your-domain>/api/pose \
  -H "X-API-Key: sk_khach_abc123" \
  -H "Content-Type: application/json" \
  -d '{"image": "'"$(base64 -w0 photo.jpg)"'"}'
```

## Tính phí — hiện tại vs bước tiếp theo

- **Hiện tại:** mỗi request thành công tăng counter trong Redis
  (`mediapipe:usage:<key>:<YYYY-MM>`), xem qua `GET /api/usage`. Đây là
  "đếm", chưa tự động thu tiền.
- **Bước tiếp theo (khi có khách thật):** thêm 1 cron job (Vercel Cron)
  chạy cuối ngày, đọc counter từ Redis rồi báo cáo lên Stripe Metered
  Billing để tự động xuất hoá đơn theo mức giá bạn đặt (vd: $0.001/lượt
  gọi). Chưa làm phần này vì cần bạn có tài khoản Stripe + quyết bậc giá
  trước.

## Giới hạn hiện tại (cần biết trước khi bán)

- Mỗi request tối đa 30 frame (batch/video) — tránh timeout function.
- `maxDuration: 60s` trong `vercel.json` — cần gói Vercel Pro trở lên nếu
  muốn hơn 10s (Hobby plan giới hạn 10s/function).
- Chưa có rate limiting theo giây/phút, chỉ đếm theo tháng — nên thêm nếu
  lo bị spam.
