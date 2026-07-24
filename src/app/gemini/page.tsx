"use client";

import React, { useState } from "react";
import { 
  Shield, 
  Activity, 
  Heart, 
  Sparkles, 
  Brain, 
  Flame, 
  Droplet, 
  Wind,
  PlusCircle,
  BookOpen
} from "lucide-react";

// Mock Data for Body Pixel
const bodyPixels = [
  { id: "brain", name: "Não bộ (Brain)", x: "50%", y: "12%", color: "bg-pink-500", info: "Trung tâm điều khiển. Cần ngủ đủ 7-8 tiếng và bổ sung Omega-3." },
  { id: "heart", name: "Tim mạch (Heart)", x: "50%", y: "32%", color: "bg-red-500", info: "Bơm máu đi khắp cơ thể. Thường xuyên tập cardio để tim khỏe mạnh." },
  { id: "lungs", name: "Lá phổi (Lungs)", x: "42%", y: "30%", color: "bg-blue-400", info: "Trao đổi khí. Tập hít thở sâu và tránh xa khói thuốc lá." },
  { id: "stomach", name: "Dạ dày (Stomach)", x: "53%", y: "45%", color: "bg-amber-500", info: "Tiêu hóa thức ăn. Ăn đúng giờ, hạn chế đồ cay nóng và rượu bia." },
  { id: "liver", name: "Gan (Liver)", x: "45%", y: "42%", color: "bg-emerald-600", info: "Thải độc cho cơ thể. Uống nhiều nước và hạn chế chất béo xấu." },
  { id: "kidneys", name: "Thận (Kidneys)", x: "50%", y: "55%", color: "bg-indigo-500", info: "Lọc máu và chất thải. Đảm bảo uống ít nhất 2 lít nước mỗi ngày." },
  { id: "muscles", name: "Cơ bắp (Muscles)", x: "32%", y: "48%", color: "bg-orange-500", info: "Vận động và giữ tư thế. Bổ sung protein đầy đủ sau tập luyện." },
];

// Mock Data for Body Care
const bodyCareTips = [
  {
    category: "Hệ Thần Kinh & Trí Não",
    icon: <Brain className="w-6 h-6 text-pink-500" />,
    tips: [
      "Ngủ đủ giấc: Đảm bảo giấc ngủ từ 7-9 tiếng mỗi đêm để não bộ thải độc.",
      "Học tập chủ động: Đọc sách, chơi cờ hoặc giải đố để kích thích các liên kết thần kinh.",
      "Thiền định: Dành 10-15 phút thiền mỗi ngày giúp giảm stress, cải thiện trí nhớ."
    ]
  },
  {
    category: "Hệ Tuần Hoàn & Tim Mạch",
    icon: <Heart className="w-6 h-6 text-red-500" />,
    tips: [
      "Tăng cường Cardio: Đi bộ nhanh, chạy bộ hoặc đạp xe tối thiểu 150 phút/tuần.",
      "Hạn chế muối: Giảm lượng natri tiêu thụ dưới 2,300mg/ngày để bảo vệ huyết áp.",
      "Chất béo lành mạnh: Bổ sung quả bơ, các loại hạt và cá béo chứa nhiều Omega-3."
    ]
  },
  {
    category: "Hệ Hô Hấp",
    icon: <Wind className="w-6 h-6 text-blue-400" />,
    tips: [
      "Hít thở bằng mũi: Giúp lọc sạch, làm ấm và ẩm không khí trước khi vào phổi.",
      "Trồng cây xanh: Cải thiện chất lượng không khí trong không gian sống và làm việc.",
      "Vận động ngoài trời: Tập thể dục ở những nơi có không khí trong lành, nhiều cây xanh."
    ]
  },
  {
    category: "Hệ Tiêu Hóa & Thải Độc",
    icon: <Droplet className="w-6 h-6 text-emerald-500" />,
    tips: [
      "Bổ sung chất xơ: Ăn nhiều rau xanh, ngũ cốc nguyên hạt để hỗ trợ nhu động ruột.",
      "Uống đủ nước: Giúp thận và gan dễ dàng lọc và loại bỏ các độc tố ra ngoài.",
      "Hạn chế thực phẩm chế biến sẵn: Giảm tải áp lực hoạt động cực nhọc cho gan."
    ]
  }
];

export default function GeminiPage() {
  const [activeTab, setActiveTab] = useState<"body-pixel" | "body-care">("body-pixel");
  const [selectedPixel, setSelectedPixel] = useState<typeof bodyPixels[0] | null>(bodyPixels[0]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg text-white">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                3D Map for Hero
              </h1>
              <p className="text-xs text-slate-400">Hệ thống giám sát và chăm sóc sức khỏe trực quan</p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("body-pixel")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "body-pixel"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              Body Pixel
            </button>
            <button
              onClick={() => setActiveTab("body-care")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === "body-care"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Body Care
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        
        {/* Tab: Body Pixel */}
        {activeTab === "body-pixel" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Interactive Pixel Body Panel */}
            <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 flex flex-col items-center relative overflow-hidden min-h-[600px] justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
              
              <h2 className="text-lg font-semibold text-slate-200 mb-8 z-10 flex items-center gap-2 self-start">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                Bản Đồ Điểm Ảnh Cơ Thể (Body Pixel)
              </h2>

              {/* Pixel Human Body Vector Container */}
              <div className="relative w-72 h-[480px] bg-slate-800/20 border border-slate-700/50 rounded-3xl flex justify-center items-center p-4 z-10 shadow-2xl backdrop-blur-sm">
                
                {/* SVG Silhouette of Human Body */}
                <svg
                  className="w-full h-full text-slate-700 opacity-60 transition-all duration-300 hover:text-slate-600"
                  viewBox="0 0 100 200"
                  fill="currentColor"
                >
                  <path d="M50,10 C46,10 43,13 43,17 C43,21 46,24 50,24 C54,24 57,21 57,17 C57,13 54,10 50,10 Z M46,25 C40,25 35,28 34,34 L28,68 C27,72 30,75 34,75 L38,75 L38,120 C38,125 41,128 45,128 L46,128 L46,190 C46,195 50,198 54,198 C58,198 62,195 62,190 L62,128 L63,128 C67,128 70,125 70,120 L70,75 L74,75 C78,75 81,72 80,68 L74,34 C73,28 68,25 62,25 Z" />
                </svg>

                {/* Hotspot Nodes */}
                {bodyPixels.map((pixel) => (
                  <button
                    key={pixel.id}
                    onClick={() => setSelectedPixel(pixel)}
                    style={{ left: pixel.x, top: pixel.y }}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-full border-2 border-slate-900 transition-all duration-300 transform hover:scale-125 hover:ring-4 hover:ring-indigo-500/50 cursor-pointer ${pixel.color} ${
                      selectedPixel?.id === pixel.id ? "ring-4 ring-white scale-125 z-20" : "scale-100"
                    }`}
                    title={pixel.name}
                  >
                    <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                  </button>
                ))}
              </div>

              <p className="text-xs text-slate-400 mt-4 z-10 text-center">
                * Click vào các điểm màu phát sáng trên cơ thể để phân tích nhanh.
              </p>
            </div>

            {/* Information Details Panel */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-slate-100">Chi Tiết Bộ Phận</h3>
                    <p className="text-xs text-slate-400">Phân tích sinh học & chỉ số cơ bản</p>
                  </div>
                </div>

                {selectedPixel ? (
                  <div className="space-y-6">
                    <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`w-3.5 h-3.5 rounded-full ${selectedPixel.color}`} />
                        <h4 className="text-lg font-bold text-white">{selectedPixel.name}</h4>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {selectedPixel.info}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
                        <span className="text-xs text-slate-400 block mb-1">Trạng thái</span>
                        <span className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                          Hoạt động tốt
                        </span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800/80 p-4 rounded-xl">
                        <span className="text-xs text-slate-400 block mb-1">Mức độ ưu tiên</span>
                        <span className="text-sm font-semibold text-indigo-400">
                          Cao (Hàng ngày)
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-slate-800 pt-6">
                      <h5 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                        Khuyến nghị chăm sóc nhanh
                      </h5>
                      <ul className="space-y-2 text-xs text-slate-300">
                        <li className="flex items-start gap-2">
                          <PlusCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <span>Duy trì vận động nhẹ nhàng định kỳ 30 phút mỗi ngày.</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <PlusCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                          <span>Hạn chế nạp các chất kích thích có hại sau 8 giờ tối.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <p className="text-sm">Hãy chọn một điểm ảnh trên mô hình cơ thể bên trái để xem phân tích chi tiết.</p>
                  </div>
                )}
              </div>

              {/* Hero Status Summary Widget */}
              <div className="bg-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
                <div className="flex items-start gap-4">
                  <span className="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                    <Shield className="w-6 h-6" />
                  </span>
                  <div>
                    <h4 className="font-semibold text-indigo-300">Chỉ số Hero Shield</h4>
                    <p className="text-sm text-slate-300 mt-1">
                      Cơ thể của bạn đang hoạt động ở mức năng suất ổn định 92%. Hãy tiếp tục duy trì lối sống lành mạnh!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Body Care */}
        {activeTab === "body-care" && (
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-indigo-900/40 to-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col md:flex-row gap-6 justify-between items-center">
              <div className="space-y-2 max-w-2xl">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 rounded-full text-xs font-medium text-indigo-400 border border-indigo-500/20">
                  <BookOpen className="w-3.5 h-3.5" /> Cẩm nang Sức khỏe
                </div>
                <h2 className="text-2xl font-bold text-white">Chế Độ Chăm Sóc Sức Khỏe Hero</h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Tổng hợp các thói quen vàng và cách thức bảo vệ các cơ quan cốt lõi của bạn hằng ngày. Thay đổi nhỏ ngày hôm nay kiến tạo một sức khỏe phi thường ngày mai.
                </p>
              </div>
              <div className="p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 flex flex-col items-center justify-center shrink-0 w-full md:w-auto min-w-[200px]">
                <span className="text-3xl font-extrabold text-indigo-400">04</span>
                <span className="text-xs text-slate-400 mt-1">Trụ cột bảo vệ cốt lõi</span>
              </div>
            </div>

            {/* Care Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {bodyCareTips.map((categoryItem, index) => (
                <div 
                  key={index} 
                  className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 hover:border-indigo-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-slate-800 rounded-xl border border-slate-700/50">
                      {categoryItem.icon}
                    </div>
                    <h3 className="font-bold text-lg text-slate-100">{categoryItem.category}</h3>
                  </div>

                  <ul className="space-y-3.5 mt-4">
                    {categoryItem.tips.map((tip, idx) => {
                      const [title, desc] = tip.split(":");
                      return (
                        <li key={idx} className="flex items-start gap-2.5 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 shrink-0" />
                          <div className="text-slate-300">
                            <strong className="text-slate-100 font-medium">{title}:</strong>
                            {desc}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Bottom Call to Action */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center max-w-2xl mx-auto space-y-4">
              <h3 className="text-lg font-bold text-white">Bạn cần một lộ trình tập luyện cá nhân hóa?</h3>
              <p className="text-xs text-slate-400">
                Hãy tư vấn thêm ý kiến bác sĩ chuyên khoa để xây dựng chế độ dinh dưỡng và tập thể hình phù hợp nhất với thể trạng của riêng bạn.
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}