import React from 'react'
import { Gift } from 'lucide-react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import AffiliateGameContent from './AffiliateGameContent.jsx'

// ============================================================================
// AffiliateGamePage — bản "trang riêng" của popup "Affiliate Game" trong
// Hành Trình Bảo Vệ Cơ Thể, đặt ngay sau menu game đó (xem Sidebar.jsx +
// App.jsx: PANELS). Dùng chung component AffiliateGameContent.jsx với popup
// (GameAffiliateRewardWidget.jsx) nên link giới thiệu, điểm thưởng, bảng xếp
// hạng và tỉ lệ quy đổi LUÔN đồng bộ 1-1 dù xem ở trang này hay ở popup
// trong lúc chơi game.
//
// Link giới thiệu ở đây dùng ĐÚNG 1 UUID chung của toàn dự án (User ID nếu
// đã đặt, không thì UUID) — cùng định dạng ?ref=... mà App.jsx xử lý trung
// tâm cho mọi luồng đăng ký F1/F2 khác trong app, nên điểm/tiền và hoa hồng
// tuyến trên luôn quy về đúng 1 người.
export default function AffiliateGamePage({ onNext, nextLabel, onPrev, prevLabel }) {
  const { theme } = useApp()
  const { user } = useAuth()
  const isDark = theme === 'dark'

  const cardBg = isDark ? 'bg-slate-900/80 border-white/10' : 'bg-white border-gray-200'
  const pageBg = isDark ? 'bg-[#05070f]' : 'bg-[#f4f7fb]'
  const textMain = isDark ? 'text-gray-100' : 'text-gray-900'
  const textSub = isDark ? 'text-gray-400' : 'text-gray-500'

  if (!user?.uuid) {
    return (
      <div className={`animate-fade min-h-full w-full px-4 py-6 sm:px-6 md:px-8 ${pageBg}`}>
        <div className={`mx-auto max-w-2xl rounded-3xl border p-8 text-center shadow-2xl md:max-w-3xl lg:max-w-4xl ${cardBg}`}>
          <p className={textSub}>Vui lòng đăng nhập để xem link giới thiệu và phần thưởng của bạn.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`animate-fade min-h-full w-full px-4 py-6 sm:px-6 md:px-8 lg:px-10 xl:px-14 ${pageBg}`}>
      {/* Container rộng dần theo màn hình: điện thoại (mặc định) giữ nguyên
          như cũ, tablet (md) rộng hơn, laptop/desktop (lg+) rộng hẳn ra để
          không còn cảm giác 1 popup nhỏ nổi giữa màn hình lớn. */}
      <div className="mx-auto flex h-[calc(100svh-112px)] min-h-[600px] w-full max-w-2xl flex-col gap-5 max-lg:h-[calc(100svh-96px)] max-sm:h-[calc(100svh-80px)] md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
        {/* Header + khung nội dung: xếp dọc (header trên, thẻ nội dung dưới)
            trên điện thoại/tablet như trước; từ lg trở lên chuyển sang xếp
            ngang — header hoá thành cột giới thiệu bên trái, thẻ 3 tab (Thưởng
            / Xếp hạng BOSS / Quy đổi) chiếm hết phần còn lại bên phải, tận
            dụng chiều ngang rộng của màn hình laptop thay vì để trống 2 bên. */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-8">
          <div className="flex shrink-0 items-center gap-3 lg:w-72 lg:flex-col lg:items-start lg:gap-4 lg:pt-2 lg:text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 text-white shadow-lg shadow-rose-500/20 lg:h-14 lg:w-14">
              <Gift size={22} className="lg:hidden" />
              <Gift size={26} className="hidden lg:block" />
            </span>
            <div>
              <h1 className={`text-xl font-black leading-tight sm:text-2xl lg:text-3xl ${textMain}`}>
                🎁 Affiliate Game
              </h1>
              <p className={`text-xs sm:text-sm lg:mt-2 lg:max-w-xs lg:text-sm ${textSub}`}>
                Link giới thiệu, thưởng chơi game, xếp hạng BOSS và quy đổi điểm — đồng bộ 1 UUID cho toàn dự án.
              </p>
            </div>
          </div>

          <div className={`relative min-h-0 flex-1 overflow-hidden rounded-3xl border shadow-2xl ${cardBg}`}>
            <AffiliateGameContent
              uuid={user.uuid}
              userId={user.userId}
              playerName={user.name}
              gameId={null}
            />
          </div>
        </div>

        <NavButtons
          onNext={onNext}
          nextLabel={nextLabel}
          onPrev={onPrev}
          prevLabel={prevLabel}
        />
      </div>
    </div>
  )
}
