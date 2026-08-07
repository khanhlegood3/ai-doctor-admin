/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Bản GỐC (dino-pal.zip từ AI Studio) gọi thẳng @google/genai (Gemini) từ
// trình duyệt bằng process.env.API_KEY — VI PHẠM 2 ràng buộc của dự án
// ai-doctor-admin-main: (1) không thêm dependency npm mới (@google/genai
// chưa có trong package.json), (2) không gọi API key AI trực tiếp từ
// browser. Bản này ĐỔI SANG gọi endpoint dùng chung /api/groq-proxy với
// field `provider: 'dino-pal'` — giống hệt cách Comic Hero Game
// (provider: 'gemini-comic') và các tính năng khác dùng chung 1 trong 12
// Serverless Function cho phép của Vercel (xem api/groq-proxy.js).
//
// Server-side (api/_lib/dinoPalProxy.js) xử lý bằng Groq (miễn phí, đã có
// sẵn GROQ_API_KEY dùng chung với chatbot chính) thay cho Gemini, dùng chế
// độ response_format json_object + mô tả schema ngay trong prompt (Groq
// không hỗ trợ responseSchema kiểu Gemini) rồi trả về đúng "hình dạng"
// PetData như hàm cũ — nên App.tsx và các component khác của Dino pal
// KHÔNG cần đổi gì thêm.
import { PetData } from "../types";

export const generateChromeDino = async (name: string, baseColor: string): Promise<PetData> => {
  const response = await fetch("/api/groq-proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "dino-pal",
      name,
    }),
  });

  if (!response.ok) {
    let message = "Dino pal proxy error";
    try {
      const errBody = await response.json();
      message = errBody?.error || message;
    } catch {
      // ignore parse error, use default message
    }
    throw new Error(message);
  }

  const data = await response.json();

  return {
    personality: data.personality,
    stats: {
      hunger: 40,
      energy: 90,
      cleanliness: 100,
      love: 60,
    },
    // Dùng màu người dùng đã chọn (baseColor), không phải màu AI sinh ra.
    babyColor: baseColor,
    babySecondaryColor: "#757575",
    adultColor: "url(#rainbowGradient)",
    adultSecondaryColor: "#f1f5f9",
    stage: "BABY",
    ownedAccessories: [],
    money: 0,
  };
};
