// src/lib/huggingFaceTransformersChat.js
// ─── Deterministic fallback replies cho Global AI Chatbot ────────────────────
//
// Trước đây file này còn có generateTransformersReply() — tải @huggingface/transformers
// từ CDN jsdelivr rồi chạy model ONNX Xenova/flan-t5-small ngay trong trình duyệt.
// Đã xác nhận hàm đó KHÔNG được gọi ở bất kỳ đâu trong codebase: chatbot chính dùng
// Groq API (xem useGlobalAIChatbotEngine.js → callGroqChat), phần Transformers.js
// chỉ là dead code kéo theo phụ thuộc CDN + tải model ONNX nặng không cần thiết.
// Đã xoá để giảm bề mặt phụ thuộc CDN; chỉ giữ lại phần fallback text-matching
// thuần JS đang thực sự được dùng (không gọi mạng, không phụ thuộc CDN).

const EMERGENCY_TERMS = ['dau nguc', 'kho tho', 'ngat', 'co giat', 'yeu liet', 'tu tu', 'tu hai', 'chay mau nhieu', 'cap cuu']
const FALLBACK_ROUTES = [
  { terms: ['chao', 'hello', 'xin chao'], reply: () => 'Xin chào! Tôi là trợ lý AI chung của Consensus Doctor. Tôi có thể chào hỏi, giải thích cách dùng website, hướng dẫn tải hồ sơ, xem InBody, dùng AI Healthcare Vision, tạo gia phả bệnh lý và in tài liệu trong Print Portal.' },
  { terms: ['upload record', 'tai ho so', 'tai len pdf', 'tai len anh', 'tai dicom'], reply: () => 'Bạn có thể vào Upload Records để tải PDF, ảnh, DICOM hoặc tài liệu khám bệnh. Sau khi tải lên, hệ thống sẽ lưu hồ sơ và có thể chuyển sang AI Healthcare Vision để xem/so sánh hình ảnh.' },
  { terms: ['print portal', 'cach in', 'lam sao in'], reply: () => 'Bạn hãy mở Print Portal ở cuối menu bệnh nhân. Tại đó có thể chọn loại tài liệu như kết quả khám bệnh, cây gia phả bệnh hoặc kết quả InBody, sau đó bấm "In ngay".' },
  { terms: ['inbody portal', 'ai inbody'], reply: () => 'AI InBody Portal giúp xem chỉ số thành phần cơ thể như cân nặng, cơ, mỡ và các gợi ý theo dõi. Nếu cần in báo cáo, hãy chuyển đến Print Portal.' },
  { terms: ['family medical tree', 'gia pha benh', 'cay gia pha'], reply: () => 'Family Medical Tree dùng để thêm thành viên gia đình, quan hệ và bệnh sử liên quan. Bạn cũng có thể mở hồ sơ từng thành viên để xem chi tiết.' },
  { terms: ['healthcare vision', 'ai vision', 'xem x quang', 'so sanh anh y te'], reply: () => 'AI Healthcare Vision hỗ trợ xem và so sánh ảnh y tế. Bạn nên tải hồ sơ/ảnh ở Upload Records trước, rồi chọn ảnh cần phân tích hoặc đối chiếu.' },
  { terms: ['dang nhap', 'login', 'doi giao dien', 'doi ngon ngu'], reply: () => 'Bạn có thể dùng Profile để xem/cập nhật thông tin cá nhân, đổi giao diện sáng/tối và ngôn ngữ. Nếu chưa đăng nhập, hãy dùng email hoặc Google/Apple trên màn hình đăng nhập.' },
]

function normalizeForMatch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9@/.' -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getDeterministicFallbackReply(question, activePanelLabel = '') {
  const normalized = normalizeForMatch(question)
  if (EMERGENCY_TERMS.some(term => normalized.includes(term))) {
    return 'Nếu bạn đang có dấu hiệu nguy hiểm như đau ngực, khó thở, ngất, yếu liệt, co giật, chảy máu nhiều hoặc ý định tự hại, hãy liên hệ cấp cứu hoặc đến cơ sở y tế gần nhất ngay. Chatbot không thay thế bác sĩ trong tình huống khẩn cấp.'
  }

  const matched = FALLBACK_ROUTES.find(route => route.terms.some(term => normalized.includes(term)))
  if (matched) return matched.reply(activePanelLabel)

  return ''
}

export function buildFallbackReply(question, activePanelLabel = '') {
  return getDeterministicFallbackReply(question, activePanelLabel) || `Tôi là trợ lý AI chung của Consensus Doctor${activePanelLabel ? `, hiện bạn đang ở mục ${activePanelLabel}` : ''}. Bạn có thể hỏi tôi cách dùng website, tải hồ sơ, phân tích ảnh y tế, xem InBody, tạo gia phả bệnh lý hoặc in tài liệu trong Print Portal. Nếu câu trả lời AI chưa ổn định, tôi sẽ chuyển sang hướng dẫn an toàn, ngắn gọn và dễ hiểu. Lưu ý: tôi chỉ hỗ trợ thông tin chung và không thay thế tư vấn của bác sĩ.`
}
