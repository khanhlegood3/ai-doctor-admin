import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Square } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useGlobalAIChatbotEngine } from '../../lib/useGlobalAIChatbotEngine.js';
import { renderBasicFace } from '../aiChatbotControl/components/demo/basic-face/basic-face-render';
import { useAgent } from '../aiChatbotControl/lib/state';

// ============================================================================
// HeroMicVoiceButton — nút mic "trao đổi thoại trực tiếp" dùng riêng cho 2
// trang "Anh Hùng" (ChooseUserRolePanel / DonationHeroPanel).
//
// Bấm vào đây KHÔNG mở popup chat (GlobalAIChatbot) — chỉ:
//   1. Ghi âm ngay tại chỗ (nút chuyển thành bong bóng màu đỏ đang ghi âm).
//   2. Chuyển giọng nói thành chữ rồi GỬI THẲNG cho AI (autoSubmitVoice —
//      không có ô để sửa vì không có chatbox hiển thị ở đây).
//   3. AI trả lời và được ĐỌC TO (TTS) ngay tại trang này.
//   4. Trạng thái hiện tại (Đang nghe / Đang xử lý / Đang suy nghĩ / Đang
//      trả lời) hiện ngay dưới nút mic này — không phải ở góc màn hình nơi
//      popup chat nằm.
//
// Nội dung hội thoại vẫn dùng CHUNG hook + kho lưu trữ với GlobalAIChatbot
// (useGlobalAIChatbotEngine → globalChatbotStorage.js), nên tự động đồng bộ
// ngầm vào popup chat. Popup chỉ xử lý khi người dùng chủ động mở nó ra và
// bấm nút trong đó — component này không đụng vào trạng thái mở/đóng của
// popup.
// ============================================================================

export default function HeroMicVoiceButton({
  mode = 'guest',
  activePanelLabel,
  isVi,
  isDark,
  micLabel,
  buttonSize = 64,
  iconSize = 24,
  holoEffect = false,
  compact = false,
}) {
  const { user, loginAnonymous } = useAuth();
  const userKey = user?.uuid || null;
  const audioElementRef = useRef(null);
  const faceCanvasRef = useRef(null);
  const [showPlaybackControls, setShowPlaybackControls] = useState(true);

  // Màu khuôn mặt tròn đồng bộ với lựa chọn của user tại trang "🤖 AI chatbot
  // control" (AgentEdit → colorPicker ghi vào cùng store `useAgent`, có
  // persist localStorage) — nên ngay lần đầu vào 2 trang "Anh Hùng" đã đúng
  // màu, không cần mở panel kia trước.
  const faceColor = useAgent(state => state.current?.bodyColor) || '#ea4335';

  const {
    busy,
    speaking, stop: stopSpeaking, speechPaused, pauseSpeaking, resumeSpeaking, replaySpeaking,
    speechVolume, setSpeechVolume, speechRate, setSpeechRate, hasSpeechReplay,
    recording, transcribing, toggleMic, voiceError,
  } = useGlobalAIChatbotEngine({ userKey, activePanelLabel, isVi, audioElementRef, autoSubmitVoice: true });

  // Khách (guest) cần có 1 phiên anonymous thật (uuid) TRƯỚC khi ghi âm, để
  // lịch sử hội thoại gắn với đúng danh tính ngay từ câu đầu tiên (đồng bộ
  // với menu "Lịch sử Chat với AI") — loginAnonymous() tự tái sử dụng phiên
  // cũ nếu đã có, không tạo trùng. Không setActive/điều hướng gì thêm: người
  // dùng vẫn đứng nguyên tại trang này.
  const handlePress = async () => {
    if (speaking) stopSpeaking();
    if (mode === 'guest') {
      try { await loginAnonymous(); } catch (e) { console.warn('Không tạo được phiên khách khi bấm mic:', e); }
    }
    toggleMic();
  };

  const isActive = recording || transcribing || busy || speaking;
  const icon = recording ? '🎙️' : transcribing ? '⏳' : busy ? '💭' : speaking ? '🔊' : null;

  // Khuôn mặt tròn của "Trợ lý thoại companion" (ported từ basic-face-render.js
  // của keynote-companion) thay cho icon Mic — render trực tiếp lên canvas,
  // không cần LiveAPIProvider vì đây chỉ là avatar tĩnh/biểu cảm nhẹ theo
  // trạng thái recording/transcribing/busy/speaking của CHÍNH nút này.
  const faceSize = Math.max(buttonSize - 12, 20);
  useEffect(() => {
    const ctx = faceCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    let frameId;
    const start = performance.now();

    const draw = (now) => {
      const t = (now - start) / 1000;
      let eyeScale = 1;
      let mouthScale = 0.12;

      if (recording) {
        eyeScale = 1.15;
        mouthScale = 0.08;
      } else if (transcribing || busy) {
        eyeScale = 0.55 + Math.sin(t * 3) * 0.15;
        mouthScale = 0.08;
      } else if (speaking) {
        eyeScale = 1;
        mouthScale = 0.15 + Math.abs(Math.sin(t * 8)) * 0.35;
      } else {
        eyeScale = (t % 4) > 3.85 ? 0.15 : 1;
        mouthScale = 0.12;
      }

      renderBasicFace({ ctx, eyeScale, mouthScale, color: faceColor });
      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, [recording, transcribing, busy, speaking, faceColor]);
  const label = recording
    ? (isVi ? 'Đang nghe...' : 'Listening...')
    : transcribing
      ? (isVi ? 'Đang xử lý...' : 'Processing...')
      : busy
        ? (isVi ? 'Đang suy nghĩ...' : 'Thinking...')
        : speaking
          ? (isVi ? 'Đang trả lời...' : 'Speaking...')
          : null;

  return (
    <div className={`flex flex-col items-center justify-center gap-2 ${compact ? 'py-0' : 'py-4'}`}>
      <audio ref={audioElementRef} preload="none" style={{ display: 'none' }} />
      <div className={holoEffect ? 'relative group inline-flex items-center justify-center' : ''}>
        {holoEffect && !isActive && (
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-40 blur-md transition duration-500 animate-pulse group-hover:opacity-100 group-hover:duration-200 group-hover:animate-none" />
        )}
        <button
          type="button"
          onClick={handlePress}
          disabled={transcribing || busy}
          aria-label={micLabel}
          className={`relative rounded-full border-2 flex items-center justify-center overflow-hidden transition-all duration-300 shadow-sm ${
            isActive
              ? 'border-red-500 bg-red-500'
              : holoEffect
                ? 'border-white/10 bg-slate-900/80 backdrop-blur-sm group-hover:bg-slate-900 group-hover:scale-[0.98]'
                : isDark
                  ? 'border-emerald-500 bg-white/5 hover:bg-white/10'
                  : 'border-emerald-500 bg-white hover:bg-emerald-50'
          }`}
          style={{ width: buttonSize, height: buttonSize, cursor: (transcribing || busy) ? 'wait' : 'pointer' }}
        >
          {isActive && recording && (
            <span className="absolute inset-0 rounded-full bg-red-500/40 animate-ping" />
          )}
          {holoEffect && !isActive && (
            <span className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <span className="absolute top-0 left-[-100%] h-full w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-45deg] group-hover:animate-shine" />
            </span>
          )}
          <canvas
            ref={faceCanvasRef}
            width={faceSize}
            height={faceSize}
            className="relative"
            style={{ display: 'block', borderRadius: '50%' }}
          />
        </button>
      </div>

      {/* Label tĩnh để 2 trang Anh Hùng cùng hiển thị lời nhắc dưới micro. */}
      {!isActive && (
        <span className={`${compact ? 'rounded-full px-2 py-0.5 text-[10px] shadow-sm backdrop-blur-sm' : ''} font-bold ${compact ? (isDark ? 'bg-slate-950/80 text-cyan-100' : 'bg-white/90 text-emerald-700') : (isDark ? 'text-gray-100' : 'text-[#16241c]')}`}>
          {isVi ? 'Nhấn để nói' : (micLabel || 'Tap to speak')}
        </span>
      )}

      {/* Bong bóng trạng thái — ngay dưới nút mic của TRANG NÀY, không phải góc màn hình popup chat */}
      {isActive && (
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm ${isDark ? 'bg-white/10 text-gray-100' : 'bg-white text-gray-700 border border-gray-100'}`}>
          <span>{icon}</span>
          <span>{label}</span>
        </span>
      )}

      {voiceError && !isActive && (
        <span className={`max-w-[360px] rounded-full px-3 py-1.5 text-center text-xs font-semibold shadow-sm ${isDark ? 'bg-red-500/10 text-red-200 border border-red-400/20' : 'bg-red-50 text-red-700 border border-red-100'}`}>
          {voiceError}
        </span>
      )}

      {(speaking || hasSpeechReplay) && (
        <>
          <button
            type="button"
            onClick={() => setShowPlaybackControls(value => !value)}
            className={`text-xs font-extrabold rounded-full px-3 py-1.5 shadow-sm ${isDark ? 'border border-white/10 bg-slate-950/70 text-gray-100' : 'border border-emerald-100 bg-white text-gray-700'}`}
            aria-expanded={showPlaybackControls}
            aria-label={showPlaybackControls ? (isVi ? 'Ẩn vùng loa AI' : 'Hide AI speaker controls') : (isVi ? 'Hiện vùng loa AI' : 'Show AI speaker controls')}
          >
            🔊 {showPlaybackControls ? (isVi ? 'Ẩn loa' : 'Hide speaker') : (isVi ? 'Hiện loa' : 'Show speaker')}
          </button>
          {showPlaybackControls && (
            <div className={`w-full max-w-[360px] rounded-2xl border p-3 shadow-sm ${isDark ? 'border-white/10 bg-slate-950/70 text-gray-100' : 'border-emerald-100 bg-white text-gray-700'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl text-white shadow-sm">
                🔊
                {speaking && !speechPaused && <span className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping" />}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-bold">{isVi ? 'AI đang nói' : 'AI is speaking'}</div>
                <div className={`text-[11px] ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
                  {speaking
                    ? (speechPaused ? (isVi ? 'Đã tạm dừng' : 'Paused') : (isVi ? 'Đang phát câu trả lời' : 'Playing reply'))
                    : (isVi ? 'Sẵn sàng nghe lại' : 'Ready to replay')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {speaking && (
                <button
                  type="button"
                  onClick={speechPaused ? resumeSpeaking : pauseSpeaking}
                  className={`rounded-full p-2 transition ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-emerald-50 hover:bg-emerald-100'}`}
                  aria-label={speechPaused ? (isVi ? 'Nghe tiếp' : 'Resume') : (isVi ? 'Tạm dừng nghe' : 'Pause')}
                >
                  {speechPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={replaySpeaking}
                className={`rounded-full p-2 transition ${isDark ? 'bg-white/10 hover:bg-white/15' : 'bg-emerald-50 hover:bg-emerald-100'}`}
                aria-label={isVi ? 'Nghe lại' : 'Replay'}
              >
                <RotateCcw size={16} />
              </button>
              {speaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="rounded-full bg-red-500 p-2 text-white transition hover:bg-red-600"
                  aria-label={isVi ? 'Dừng hẳn việc nghe' : 'Stop playback'}
                >
                  <Square size={15} fill="currentColor" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-2 text-[11px] font-semibold">
            <label className="grid grid-cols-[74px_1fr_38px] items-center gap-2">
              <span>{isVi ? 'Âm lượng' : 'Volume'}</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={speechVolume}
                onChange={(event) => setSpeechVolume(event.target.value)}
                aria-label={isVi ? 'Điều chỉnh nghe to nhỏ' : 'Adjust volume'}
              />
              <span className="text-right">{Math.round(speechVolume * 100)}%</span>
            </label>
            <label className="grid grid-cols-[74px_1fr_38px] items-center gap-2">
              <span>{isVi ? 'Tốc độ' : 'Speed'}</span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.05"
                value={speechRate}
                onChange={(event) => setSpeechRate(event.target.value)}
                aria-label={isVi ? 'Điều chỉnh nghe nhanh chậm' : 'Adjust playback speed'}
              />
              <span className="text-right">{speechRate.toFixed(2)}×</span>
            </label>
          </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
