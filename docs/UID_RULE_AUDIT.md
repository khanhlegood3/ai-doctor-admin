# Kiểm tra Rule UID — 14/11/2026

## Kết luận

Code gốc **chưa đáp ứng đầy đủ** rule. Bản sửa này chuẩn hoá luồng UID mới và liên kết Google; **chưa chạy migration xoá UID/dữ liệu cũ trên production hoặc trên điện thoại người dùng**.

“Thiết bị” trong cơ chế IndexedDB thực tế là **một browser profile trên cùng origin**. Chrome/Safari, chế độ riêng tư, các domain khác nhau, hoặc xoá site data có kho riêng; không thể bảo đảm một UID cho toàn bộ phần cứng chỉ bằng IndexedDB. Không dùng IP, user-agent, kích thước màn hình hoặc salt cũ để quyết định xoá tài khoản.

## Sai lệch tìm thấy trong bản gốc

| Vị trí | Sai lệch |
| --- | --- |
| `src/context/AuthContext.jsx` | Lần mở web đầu tiên chưa tạo guest; chỉ tạo khi bấm nút khách/mic. |
| `resolveUUIDForNewAccount` | Referral có thể khiến đổi UID; xoá guest theo kiểu fire-and-forget trước khi đăng ký thành công. |
| Google login | Chỉ tra tài khoản trong `cdoc_users` cục bộ; chưa có ánh xạ Google subject → UID được xác minh ở server. |
| `seedAdmin` | Tự tạo tài khoản Google giả với UID riêng trước khi Google xác thực, nên lần đăng nhập Google admin đầu tiên không lấy UID guest. |
| `public/games/portal-index.html` | Có UUID riêng trong localStorage, có thể khác UID app cha. |
| One Shot Arcade | Có `osa_fallback_uuid` riêng. |
| Video to Learning | Có `video-to-learning:guest-uuid` riêng. |
| Dino Pal backup | Có `dino-pal-device-id` riêng. |

## Quy tắc đã áp dụng cho luồng mới

- `public/device-identity.js` là logic chung cho React và game standalone cùng origin; `cdoc_guest/session`, key `anon`, là nguồn UID guest chính.
- Tạo guest ngay khi khởi tạo app chính; mở lại dùng đúng UID cũ, kể cả field legacy `anonUUID`.
- Đọc/tạo guest trong một transaction IndexedDB: gọi đồng thời hoặc React StrictMode không tạo nhiều UID được lưu.
- Liên kết Google mới giữ nguyên UID guest. Chỉ bỏ con trỏ guest sau khi server xác nhận và tài khoản được lưu; không xoá dữ liệu có UID đó.
- Google đã tồn tại trả UID đã liên kết; không tiêu thụ UID guest đang chờ của người khác trên máy.
- Chuyển sang ẩn danh/đăng xuất: tái dùng guest đang chờ; chỉ tạo UID tiếp theo nếu guest trước đã được liên kết.
- Bỏ ngoại lệ referral làm thay đổi UID. Không cho `updateProfile` thay UID.
- Dữ liệu `journey`, `inventory`, `records` chưa có owner được gắn UID lúc nâng cấp, trong cùng transaction với việc bỏ guest pointer. Khôi phục cả trường hợp nâng cấp bị ngắt giữa chừng.
- Callback cập nhật profile/userId muộn không tạo lại guest đã liên kết hoặc ghi vào guest kế tiếp.
- Khoá thao tác xác thực bằng Web Locks khi trình duyệt hỗ trợ; transaction IndexedDB vẫn bảo vệ bước tạo guest. Tab khác đổi danh tính sẽ reload app để tránh tiếp tục dùng cache tài khoản cũ.
- Không tự sinh UID tạm khi IndexedDB lỗi; yêu cầu người dùng cho phép lưu dữ liệu thay vì âm thầm tách danh tính.
- Dừng tự seed tài khoản admin giả. Tài khoản admin đã có cục bộ vẫn được giữ nguyên; tài khoản mới cần đi qua đăng nhập thật. Cơ chế role/admin hiện hữu không được thay bằng hệ thống phân quyền server trong thay đổi này.

### Chuỗi kiểm thử

```text
Lần đầu vào → guest UID1
Google1 mới → UID1, không còn guest pointer
Đăng xuất → guest UID2
Google1 cũ → UID1, guest UID2 vẫn được giữ
Trở lại ẩn danh → UID2
Google2 mới → UID2
Đăng xuất → guest UID3
Reload → UID3
```

## Google ở server

Dùng action `loginWithGoogle` trên `/api/user-profile` (không thêm serverless endpoint). Server gọi Google tokeninfo + userinfo để kiểm tra client/audience, hạn dùng, subject và email đã xác minh. Không tin email/verified do client tự gửi. Token chỉ tồn tại trong request, không lưu vào database/localStorage.

Cấu hình server cần `GOOGLE_CLIENT_ID` (hoặc biến hiện hữu `VITE_GOOGLE_CLIENT_ID`); giao diện vẫn cần `VITE_GOOGLE_CLIENT_ID`. Cần MongoDB hoạt động và có quyền tạo unique indexes `uuid`, `googleSub`, `googleEmailLower` trên `user_profiles`.

Nếu index không tạo được do dữ liệu trùng lịch sử, đăng nhập Google mới **dừng an toàn**, không tự đổi UID. Nếu một tài khoản cục bộ đã có UID khác UID Google trên server, cũng dừng để đối soát, không tự merge hai người. Các tài khoản Google lịch sử chưa có `googleSub` cần được liên kết từ thiết bị gốc có UID + secret hợp lệ; không đoán liên kết dựa vào tên hiển thị.

## Giữ UID không đồng nghĩa đã đồng bộ toàn bộ database

Các dữ liệu đã keyed bằng UID tiếp tục thuộc cùng UID khi nâng cấp Google: game progress/rewards trong `cdoc_game_affiliate`, health journey trong `cdoc_guest/settings`, inventory/shop theo UID, leaderboard/play log MongoDB và các API lưu theo UID.

Tuy nhiên, nhiều dữ liệu vẫn chỉ có trên thiết bị (IndexedDB/localStorage), ví dụ một phần inventory/mua bán, reward queue và private key ví. Việc có ánh xạ Google → UID **không tự upload/download các kho này sang máy khác**. Bản sửa này không tuyên bố đã xây đồng bộ cloud cho tất cả màn chơi, giao dịch, điểm và ví. Đặc biệt không được tự sao chép/xoá private key hoặc coi giao dịch on-chain đã bị xoá khi xoá một dòng local.

Các backup cũ theo `video-to-learning:guest-uuid`, `dino-pal-device-id`, `osa_fallback_uuid`, hoặc UUID portal riêng chưa được tự migrate sang UID chung. Bản sửa không xoá các key/backup đó; dữ liệu lịch sử cần đối soát trước khi import hoặc xoá. Các lần lưu mới ở những đường vừa sửa dùng UID chung.

## Việc dọn UID ẩn danh cũ: CHƯA thực hiện

Schema guest chuẩn chỉ có một record `id=anon`; nhiều UID còn thấy trên máy có thể là tài khoản Google hợp lệ, guest orphan, UID riêng của module, hoặc dữ liệu không có thông tin chủ. Không thể chỉ đếm chuỗi UUID rồi xoá tất cả trừ một.

Quy trình cần có trước khi xoá thật:

1. Sao lưu IndexedDB/localStorage trên chính browser bị lỗi, MongoDB và các object cloud liên quan. Repo không thể trực tiếp đọc IndexedDB trên điện thoại từ xa.
2. Lập manifest có UID, thời điểm tạo có căn cứ, bằng chứng cùng browser/origin, provider/Google subject nếu có, và danh sách dữ liệu quan hệ. Các UID không đủ bằng chứng phải để `unknown`, không coi là anonymous.
3. Loại khỏi tập xoá toàn bộ UID đã gắn Google/email/Apple. Đối soát các liên kết Google lịch sử chưa có trên server. Giữ đúng guest mới nhất trong nhóm **đã chứng minh chưa liên kết**.
4. Dry-run đếm dữ liệu theo từng UID: `cdoc_guest` (kể cả health journey trong settings), `cdoc_game_affiliate` (progress/rewards/codes/referrals), các DB chat/medical/history, localStorage mua/bán/kho đồ/family, MongoDB profiles/referrals/game logs/leaderboard, và R2 theo module. Không xoá theo substring UID hoặc quét xoá mù toàn database.
5. Chốt manifest; chạy theo batch có log và khả năng tiếp tục/khôi phục. IndexedDB, MongoDB và R2 không có transaction chung. Quan hệ affiliate và giao dịch on-chain cần chính sách riêng, không được coi là cascade đơn giản.
6. Kiểm tra UID được giữ và toàn bộ tài khoản Google không mất dữ liệu.

Không có mapping lịch sử đáng tin cậy để tự động làm các bước 2–5 trong lần sửa này. Vì vậy **không có lệnh xoá production hàng loạt hoặc migration tự động nguy hiểm** được thêm/chạy.

## Kiểm tra kỹ thuật

- `npm run test:identity`: tests bằng Node, fake-indexeddb và React test renderer; bao gồm AuthProvider thật với Google/API giả lập và kiểm tra xác minh Google ở helper server.
- `npm run build:main`
- `npm run build:subapps`
- Kiểm tra cú pháp module inline portal và `git diff --check`.

Chưa thử OAuth thật trên Google/thiết bị thật, chưa chạy integration với MongoDB/R2 production. Build có các cảnh báo CSS/chunk size hiện hữu; không tự nâng dependency ngoài phạm vi UID.
