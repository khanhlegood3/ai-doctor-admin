# GON Arena — lưu cả hai kết quả và đánh giá

## Luồng mới

1. Sau khi **cả A và B đã hoàn tất** (thành công hoặc lỗi), tự lưu một snapshot gồm cả hai kết quả, chưa có vote.
2. Khi người dùng chọn **A tốt hơn / B tốt hơn / Hoà**, lưu snapshot revision tiếp theo của **cùng trận đấu**, có thêm vote, winner và thời điểm đánh giá.
3. Bản ghi đầy đủ được lưu cục bộ vào IndexedDB trước khi gửi API. Server chỉ xác nhận `saved: true` sau khi các JSON trên R2 và bản ghi MongoDB đã lưu thành công.
4. Mỗi kết quả thành công tự xuất hiện trong lịch sử GON hiện có, cả bản thắng và bản còn lại, không cần bấm “Dùng phiên bản này”. Kết quả lỗi được giữ trong JSON/database của trận đấu, không tạo HTML giả trong kho creation.
5. Sau vote có nút **Tải JSON hai kết quả + đánh giá**; khi cloud đã lưu thành công có link mở JSON trên R2. Danh tính model và các link JSON không hiển thị trước vote trong giao diện đấu mù.

Khi lưu lỗi, UI báo **Chưa lưu đủ JSON + database**, có nút **Thử lưu lại**, không báo thành công giả. Bản ghi chưa đồng bộ được giữ trong outbox IndexedDB và thử gửi lại khi mở GON hoặc khi có sự kiện trình duyệt `online`. Không cần chạy lại model. Nếu IndexedDB bị chặn, UI báo lỗi lưu; không được hiểu đây là bản sao cục bộ đã lưu thành công.

## Dữ liệu

API dùng lại endpoint `/api/groq-proxy`:

```json
{
  "provider": "bring-any-idea-to-life-arena-vote",
  "action": "save-comparison",
  "comparison": {
    "schemaVersion": 1,
    "id": "<UUID trận đấu>",
    "revision": 3,
    "description": "Làm game giáo dục",
    "videoUrls": ["https://www.youtube.com/watch?v=..."],
    "modelA": "groq",
    "modelB": "gemini",
    "results": {
      "a": {
        "id": "<UUID của lần chạy A>",
        "modelLabel": "Qwen 3.6 27B",
        "status": "error",
        "html": null,
        "error": "Video không có phụ đề",
        "completedAt": "<ISO timestamp>"
      },
      "b": {
        "id": "<UUID của lần chạy B>",
        "modelLabel": "Gemini 3.6 Flash",
        "status": "done",
        "html": "<!doctype html>...toàn bộ HTML...",
        "error": null,
        "completedAt": "<ISO timestamp>"
      }
    },
    "vote": "b",
    "createdAt": "<ISO timestamp>",
    "votedAt": "<ISO timestamp>"
  }
}
```

Server tính lại `winner` từ vote và mapping, không tin winner do client tự gửi; bổ sung engine vào từng kết quả. `vote: null` nghĩa là **chưa đánh giá**, khác với `vote: "tie"` nghĩa là **đã đánh giá hoà**.

`modelLabel` lưu nhãn cấu hình hiển thị tại thời điểm tạo snapshot; không phải model ID đã được nhà cung cấp chứng thực. Nếu production override model bằng biến môi trường, nhãn giao diện cần được cập nhật tương ứng.

Không đính kèm UID, email, IP, cookie hay API key từ form/sessionStorage vào dữ liệu so sánh. Lỗi từ nhà cung cấp được loại bỏ chính API key đang dùng nếu nhà cung cấp echo nguyên key. Nội dung do người dùng nhập và HTML do model sinh vẫn là nội dung được lưu theo yêu cầu; không phải hệ thống DLP để phát hiện mọi bí mật có thể nằm trong prompt/code.

## Vị trí lưu

| Nơi lưu | Vị trí |
| --- | --- |
| JSON đầy đủ, gồm HTML/lỗi A+B và vote | R2: `gon-arena/comparisons/<duelId>/<revision>-<sha256>.json` |
| Hai creation thành công để mở lại trong archive GON hiện có | R2: `bring-any-idea-to-life/creations/<resultId>.json` |
| Bản ghi đầy đủ mới nhất, có HTML/lỗi A+B, vote, winner và `jsonUrl` | MongoDB `ai-doctor-db.gon_arena_comparisons`, `_id = duelId` |
| Bản cục bộ và hàng đợi gửi lại | IndexedDB `gon-arena-history-db`, store `comparisons` |
| Cache creation thành công, tương thích lịch sử hiện có | IndexedDB `bring-any-idea-to-life-history-db`, store `creations` |

Ví dụ đối soát trực tiếp MongoDB:

```javascript
db.gon_arena_comparisons.find({ vote: { $ne: null } }).sort({ createdAt: -1 })
db.gon_arena_comparisons.find({ comparable: true, winner: 'gemini' })
```

Trường `comparable: false` đánh dấu trường hợp người dùng retry khiến hai bên cùng engine: vẫn giữ đầy đủ hai kết quả và đánh giá, nhưng không nên tính vào xếp hạng model khác nhau. Đây là **đánh giá do client gửi**, không phải benchmark được ký/xác thực hay hệ thống chống gian lận.

## Retry, revision và tính nhất quán

- Mỗi trận có một UUID; mỗi lần chạy model có UUID kết quả riêng. Bấm lưu lại không sinh UUID mới.
- MongoDB có sẵn unique index `_id`; revision cũ không ghi đè revision mới. Trận đã vote không được sửa kết quả/vote bằng revision mới.
- JSON snapshot có key gồm revision và hash nội dung; request đến chậm không ghi đè JSON của vote mới.
- Gửi lại cùng revision và nội dung là idempotent. Cùng revision nhưng khác nội dung bị từ chối.
- MongoDB và R2 **không có transaction chung**: ghi JSON trước rồi cập nhật MongoDB. Nếu MongoDB lỗi, có thể còn JSON chưa được tham chiếu; outbox gửi lại cùng payload để hoàn tất, thay vì UI báo đã lưu.
- Bộ nhớ cục bộ ghi nhận vote mới ngay cả khi request lưu kết quả trước vote còn đang chờ. ACK cũ không được đánh dấu revision mới đã đồng bộ.
- Server giới hạn HTML từng bên ở 1.000.000 ký tự và tổng JSON chuẩn hoá tối đa 3 MiB; vượt giới hạn sẽ báo lỗi, không âm thầm cắt cụt code.

## Tương thích và triển khai

- Giữ action legacy `record` và helper lưu vote cũ cho client cũ. Client mới lưu đủ kết quả/vote ở prefix và collection mới; khi tổng hợp thống kê mới cần dùng dữ liệu comparison mới thay vì chỉ đọc `gon-arena/votes/`.
- Không tự tái tạo HTML của các trận cũ chỉ có vote: dữ liệu đó chưa từng được lưu nên không thể backfill từ vote.
- Dùng cùng cấu hình MongoDB và R2 hiện có (`MONGODB_URI`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_ACCESS_URL`). Không thêm serverless endpoint.
- JSON/creation trên public R2 tiếp tục theo mô hình chia sẻ công khai của archive GON hiện hữu. Không dùng cho nội dung cần lưu riêng tư.
- Middleware Vite có xử lý cùng action `save-comparison` để dev không chuyển request lưu mới sang backend khác.

## Kiểm thử

- `npm run test:gon-arena`: kiểm thử server, IndexedDB outbox và App React thật (mock phần sinh model/network/presentation).
- `node --test tests/*.test.js`: chạy cả regression tests UID hiện có.
- `npm run build:main` và `npm run build:subapps`.

Các tests dùng mock R2/MongoDB và fake-indexeddb, không ghi dữ liệu production hoặc gọi model trả phí. Trước khi triển khai thực tế cần kiểm tra cấu hình R2/MongoDB và thử một trận thật, đối chiếu `id` giữa JSON và collection.
