// src/components/cookingGuide/kitchenConstants.js
// Dữ liệu cho tính năng "Hướng Dẫn Nấu Ăn Ngon Và Khỏe Mạnh".
// Chuyển thể từ app demo "Function Call Kitchen" (Google AI Studio, dùng
// Gemini function-calling) — bản gốc gọi thẳng @google/genai với tools/
// functionDeclarations. Dự án này chưa có Gemini key production (xem
// api/groq-proxy.js), nên logic AI được viết lại để gọi qua endpoint Groq
// sẵn có (JSON mode), giữ nguyên tinh thần "chọn nguyên liệu + áp dụng thao
// tác nấu → AI tạo ra món ăn mới" của bản gốc.

// `name`  = định danh nội bộ (dùng khi hỏi AI, không dấu, an toàn)
// `label` = tên hiển thị tiếng Việt

export const STARTING_INGREDIENTS = [
  { name: 'gao', label: 'Gạo', emoji: '🍚' },
  { name: 'trung', label: 'Trứng', emoji: '🥚' },
  { name: 'thit_ga', label: 'Thịt gà', emoji: '🐔' },
  { name: 'thit_bo', label: 'Thịt bò', emoji: '🥩' },
  { name: 'thit_heo', label: 'Thịt heo', emoji: '🐷' },
  { name: 'ca', label: 'Cá', emoji: '🐟' },
  { name: 'tom', label: 'Tôm', emoji: '🦐' },
  { name: 'dau_hu', label: 'Đậu hũ', emoji: '🧈' },
  { name: 'rau_muong', label: 'Rau muống', emoji: '🥬' },
  { name: 'cai_ngot', label: 'Cải ngọt', emoji: '🥬' },
  { name: 'bap_cai', label: 'Bắp cải', emoji: '🥬' },
  { name: 'ca_rot', label: 'Cà rốt', emoji: '🥕' },
  { name: 'ca_chua', label: 'Cà chua', emoji: '🍅' },
  { name: 'dua_leo', label: 'Dưa leo', emoji: '🥒' },
  { name: 'gia_do', label: 'Giá đỗ', emoji: '🌱' },
  { name: 'nam', label: 'Nấm', emoji: '🍄' },
  { name: 'hanh_la', label: 'Hành lá', emoji: '🌿' },
  { name: 'hanh_tim', label: 'Hành tím', emoji: '🧅' },
  { name: 'toi', label: 'Tỏi', emoji: '🧄' },
  { name: 'gung', label: 'Gừng', emoji: '🫚' },
  { name: 'sa', label: 'Sả', emoji: '🌾' },
  { name: 'ot', label: 'Ớt', emoji: '🌶️' },
  { name: 'rau_thom', label: 'Rau thơm', emoji: '🌿' },
  { name: 'chanh', label: 'Chanh', emoji: '🍋' },
  { name: 'me', label: 'Me', emoji: '🫐' },
  { name: 'nuoc_mam', label: 'Nước mắm', emoji: '🍶' },
  { name: 'nuoc_tuong', label: 'Nước tương', emoji: '🍶' },
  { name: 'dau_an', label: 'Dầu ăn', emoji: '🫒' },
  { name: 'muoi', label: 'Muối', emoji: '🧂' },
  { name: 'duong', label: 'Đường', emoji: '🍯' },
  { name: 'tieu', label: 'Tiêu', emoji: '🌶️' },
  { name: 'bun', label: 'Bún', emoji: '🍜' },
  { name: 'pho', label: 'Bánh phở', emoji: '🍜' },
  { name: 'mi', label: 'Mì', emoji: '🍝' },
  { name: 'banh_trang', label: 'Bánh tráng', emoji: '🫓' },
  { name: 'nuoc_dung', label: 'Nước dùng', emoji: '🍲' },
  { name: 'nuoc', label: 'Nước', emoji: '💧' },
  { name: 'nuoc_dua', label: 'Nước dừa', emoji: '🥥' },
  { name: 'dau_phong', label: 'Đậu phộng', emoji: '🥜' },
  { name: 'dua', label: 'Dừa nạo', emoji: '🥥' },
  { name: 'yen_mach', label: 'Yến mạch', emoji: '🌾' },
  { name: 'sua_hat', label: 'Sữa hạt', emoji: '🥛' },
  { name: 'sua_chua', label: 'Sữa chua', emoji: '🥛' },
  { name: 'chuoi', label: 'Chuối', emoji: '🍌' },
  { name: 'xoai', label: 'Xoài', emoji: '🥭' },
  { name: 'thom', label: 'Thơm (dứa)', emoji: '🍍' },
  { name: 'buoi', label: 'Bưởi', emoji: '🍊' },
  { name: 'kho_qua', label: 'Khổ qua', emoji: '🥒' },
  { name: 'bi_do', label: 'Bí đỏ', emoji: '🎃' },
  { name: 'khoai_lang', label: 'Khoai lang', emoji: '🍠' },
]

export const PRESELECTED_INGREDIENTS = []

export const COOKING_ACTIONS = [
  { name: 'chien', label: 'Chiên', emoji: '🍳' },
  { name: 'luoc', label: 'Luộc', emoji: '🫧' },
  { name: 'hap', label: 'Hấp', emoji: '🥟' },
  { name: 'xao', label: 'Xào', emoji: '🥘' },
  { name: 'nuong', label: 'Nướng', emoji: '🔥' },
  { name: 'ham', label: 'Hầm', emoji: '🍲' },
  { name: 'kho', label: 'Kho', emoji: '🍯' },
  { name: 'nau_canh', label: 'Nấu canh', emoji: '🥣' },
  { name: 'tron', label: 'Trộn', emoji: '🥗' },
  { name: 'uop', label: 'Ướp gia vị', emoji: '🧂' },
  { name: 'cat_lat', label: 'Cắt lát', emoji: '🔪' },
  { name: 'thai_nho', label: 'Thái nhỏ', emoji: '🔪' },
  { name: 'bam_nhuyen', label: 'Băm nhuyễn', emoji: '🔪' },
  { name: 'gia_nhuyen', label: 'Giã nhuyễn', emoji: '🔨' },
  { name: 'ep_lay_nuoc', label: 'Ép lấy nước', emoji: '🍹' },
  { name: 'vat', label: 'Vắt', emoji: '🍋' },
  { name: 'rang', label: 'Rang', emoji: '🥜' },
  { name: 'chan_so', label: 'Chần sơ', emoji: '🥦' },
  { name: 'ngam_muoi', label: 'Ngâm muối', emoji: '🥒' },
  { name: 'phoi_kho', label: 'Phơi/để ráo', emoji: '💧' },
  { name: 'cuon', label: 'Cuốn', emoji: '🌯' },
  { name: 'xay_nhuyen', label: 'Xay nhuyễn', emoji: '⚙️' },
  { name: 'danh_bong', label: 'Đánh bông', emoji: '🥄' },
  { name: 'nem_nem', label: 'Nêm nếm', emoji: '🥄' },
  { name: 'phi_thom', label: 'Phi thơm', emoji: '🧄' },
  { name: 'de_nguoi', label: 'Để nguội', emoji: '❄️' },
  { name: 'serve', label: 'Phục vụ món', emoji: '🍽️' },
  { name: 'pass', label: 'Bỏ qua đơn này', emoji: '🏳️' },
]

export const EXAMPLE_ORDERS = [
  { id: 'order-1', name: 'Trứng Chiên', emoji: '🍳', difficulty: 'easy', status: 'not_started' },
  { id: 'order-2', name: 'Canh Chua Cá', emoji: '🍲', difficulty: 'intermediate', status: 'not_started' },
  { id: 'order-3', name: 'Phở Bò', emoji: '🍜', difficulty: 'difficult', status: 'not_started' },
]

export function findAction(name) {
  return COOKING_ACTIONS.find(a => a.name === name) || null
}

export function findIngredientTemplate(name) {
  return STARTING_INGREDIENTS.find(i => i.name === name) || null
}
