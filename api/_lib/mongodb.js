// api/_lib/mongodb.js
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI; // Chuỗi kết nối từ MongoDB Atlas của bồ
const options = {};

if (!uri) {
  throw new Error('Bồ ơi, thiếu MONGODB_URI trong biến môi trường Vercel rồi!');
}

// BUG THỰC TẾ (13/08/2026, POST /api/user-profile trả 500 rời rạc, không lặp
// lại theo pattern rõ ràng): bản cũ cache `clientPromise` (kết quả của
// `client.connect()`) VĨNH VIỄN cho suốt vòng đời 1 lambda instance đang chạy
// — kể cả ở production, không chỉ nhánh dev qua `global._mongoClientPromise`.
// Nếu lần connect() ĐẦU TIÊN của 1 cold start thất bại (Atlas cluster free
// tier M0 tự pause khi rảnh và cần vài giây "đánh thức", DNS SRV lookup lỗi
// thoáng qua, mạng chập chờn lúc khởi tạo...), promise bị REJECT đó vẫn được
// giữ nguyên trong biến module-scope — MỌI request tiếp theo được route vào
// ĐÚNG lambda instance ấm (warm) đó sẽ `await` lại chính promise đã hỏng ấy
// và luôn nhận lỗi y hệt, dù bản thân Atlas đã kết nối lại bình thường ngay
// sau đó — cho tới khi Vercel tự thay instance mới (có thể vài phút tới vài
// giờ). Đây khớp với triệu chứng quan sát được: 1 lỗi 500 xuất hiện đơn lẻ,
// không có quy luật rõ ràng theo hành động của người dùng.
//
// FIX: mỗi khi promise kết nối bị reject, XOÁ NGAY cache
// (`globalThis._mongoClientPromise = null`) trước khi throw lỗi lên trên —
// để lần gọi `connectToDatabase()` kế tiếp tự tạo 1 `MongoClient` +
// `connect()` MỚI thay vì kẹt vĩnh viễn với 1 promise đã hỏng. Dùng
// `globalThis` (thay vì phân nhánh dev/production như bản cũ) vì cơ chế
// cache-và-tự-reset này đúng cho cả 2 môi trường như nhau: dev cần global để
// sống sót qua hot-reload, production cần nó để tái sử dụng connection giữa
// các lần gọi trên cùng 1 lambda ấm — chỉ khác ở việc TỰ SỬA khi kết nối đầu
// tiên bị hỏng, thứ mà cả 2 môi trường đều cần.
function createClientPromise() {
  const client = new MongoClient(uri, options);
  return client.connect().catch((err) => {
    globalThis._mongoClientPromise = null; // xoá cache hỏng -> lần gọi kế tiếp tự retry connect() mới
    throw err;
  });
}

if (!globalThis._mongoClientPromise) {
  globalThis._mongoClientPromise = createClientPromise();
}

export async function connectToDatabase() {
  if (!globalThis._mongoClientPromise) {
    // Bị reset bởi 1 lần gọi trước đó (kết nối cũ đã hỏng) -> tạo lại đúng 1 lần.
    globalThis._mongoClientPromise = createClientPromise();
  }
  const client = await globalThis._mongoClientPromise;
  const db = client.db('ai-doctor-db'); // Tên database của bồ trên Atlas
  return { client, db };
}
