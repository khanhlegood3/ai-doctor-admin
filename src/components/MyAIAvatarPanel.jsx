import React, { useState } from 'react'
import {
  Sparkles, Github, ExternalLink, FileText, Copy, Check,
  UploadCloud, Video, Wand2, Smartphone, Mic, Terminal, MessageSquareText, Zap,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import OpenAvatarChatPanel from './OpenAvatarChatPanel'
import OpenAvatarChatVideoPanel from './OpenAvatarChatVideoPanel'

const LINKS = {
  github: 'https://github.com/aigc3d/LAM',
  project: 'https://aigc3d.github.io/projects/LAM/',
  paper: 'https://arxiv.org/abs/2502.17796',
  audio2exp: 'https://github.com/aigc3d/LAM_Audio2Expression',
  webRender: 'https://github.com/aigc3d/LAM_WebRender',
  openAvatarChat: 'https://github.com/HumanAIGC-Engineering/OpenAvatarChat',
  // OpenAvatarChat — bản demo CHÍNH THỨC do team tự host trên HF Space
  // (đang "Running"), dùng ngay được, không cần tự host nữa
  openAvatarChatSpace: 'https://huggingface.co/spaces/HumanAIGC-Engineering-Team/open-avatar-chat',
  openAvatarChatSpaceEmbed: 'https://humanaigc-engineering-team-open-avatar-chat.static.hf.space/index.html',
  // Hi3DGen (Stable3DGen) — KHÁC nhóm với LAM: đây là mesh 3D chất lượng
  // cao cho VẬT THỂ NÓI CHUNG (không chuyên avatar người), dùng normal-map
  // làm cầu nối trung gian giữa ảnh 2D và hình học 3D. Space đang "Running
  // on Zero" tại thời điểm viết.
  stable3dgenGithub: 'https://github.com/Stable-X/Stable3DGen',
  hi3dgenSpace: 'https://huggingface.co/spaces/Stable-X/Hi3DGen',
  hi3dgenSpaceEmbed: 'https://stable-x-hi3dgen.hf.space/?__theme=system',
  hi3dgenProject: 'https://stable-x.github.io/Hi3DGen/',
}

const OAC_SETUP_CMD = `git clone https://github.com/HumanAIGC-Engineering/OpenAvatarChat.git
cd OpenAvatarChat
git submodule update --init --recursive --depth 1
uv venv --python 3.11.11
uv pip install --editable .
# Config mặc định (chat_with_openai_compatible_edge_tts.yaml) đã dùng RtcClient (WebRTC)
# + LiteAvatar — GIỮ NGUYÊN để có mặt avatar chuyển động thật, không đổi sang WsClient.
python install.py --uv --config config/chat_with_openai_compatible_edge_tts.yaml
bash scripts/download_liteavatar_weights.sh   # tải model khuôn mặt LiteAvatar
python src/demo.py --config config/chat_with_openai_compatible_edge_tts.yaml
# Server (kèm giao diện web gốc có avatar) chạy ở https://<host>:8282
# -> dán địa chỉ đó vào ô "Video avatar thật" bên dưới.
# Nếu client và server không cùng mạng, WebRTC cần thêm TURN server (xem ghi chú notebook Colab).`

const CITATION = `@inproceedings{he2025lam,
  title={LAM: Large Avatar Model for One-shot Animatable Gaussian Head},
  author={He, Yisheng and Gu, Xiaodong and Ye, Xiaodan and Xu, Chao and Zhao, Zhengyi and Dong, Yuan and Yuan, Weihao and Dong, Zilong and Bo, Liefeng},
  booktitle={Proceedings of the Special Interest Group on Computer Graphics and Interactive Techniques Conference Conference Papers},
  pages={1--13},
  year={2025}
}`

function FeatureCard({ icon, title, desc, isDark, border, surface, text, text2 }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: 14,
      background: surface, border: `1px solid ${border}`, borderRadius: 12,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: isDark ? 'rgba(0,229,255,0.12)' : 'rgba(0,184,204,0.12)',
        color: isDark ? '#00e5ff' : '#00b8cc',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: text2, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  )
}

function LinkButton({ href, icon, label, primary, isDark }) {
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '9px 14px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
        textDecoration: 'none', cursor: 'pointer', transition: 'all 0.15s',
        border: primary ? '1px solid transparent' : `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}`,
        background: primary ? 'linear-gradient(135deg, #00b8cc, #6b3fd4)' : 'transparent',
        color: primary ? '#fff' : (isDark ? '#e8f0f8' : '#1a2035'),
      }}
    >
      {icon}{label}
    </a>
  )
}

export default function MyAIAvatarPanel() {
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const vi = lang === 'vi'

  const [oacIframeLoaded, setOacIframeLoaded] = useState(false)
  const [hi3dgenIframeLoaded, setHi3dgenIframeLoaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedSetup, setCopiedSetup] = useState(false)

  const border   = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const surface  = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
  const text     = isDark ? '#e8f0f8' : '#1a2035'
  const text2    = isDark ? 'rgba(232,240,248,0.62)' : '#5a6270'
  const text3    = isDark ? 'rgba(232,240,248,0.4)' : '#8a90a0'

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(CITATION)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard unavailable, ignore */ }
  }

  const copySetupCmd = async () => {
    try {
      await navigator.clipboard.writeText(OAC_SETUP_CMD)
      setCopiedSetup(true)
      setTimeout(() => setCopiedSetup(false), 1800)
    } catch { /* clipboard unavailable, ignore */ }
  }


  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '4px 4px 40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg, #00b8cc, #6b3fd4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Sparkles size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: text }}>My AI Avatar</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: isDark ? 'rgba(107,63,212,0.18)' : 'rgba(107,63,212,0.1)',
              color: '#9c6fff', letterSpacing: 0.4,
            }}>SIGGRAPH 2025 · LAM</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: text2, lineHeight: 1.6, maxWidth: 640 }}>
            {vi
              ? 'Tạo avatar 3D dạng Gaussian Head có thể tạo biểu cảm và chuyển động ngay chỉ từ MỘT tấm ảnh chân dung, dựa trên nghiên cứu LAM (Large Avatar Model) của nhóm 3DAIGC. Khác với "Tạo Avatar" (chọn avatar VRM có sẵn), tính năng này tái tạo avatar 3D trực tiếp từ khuôn mặt thật của bạn.'
              : 'Reconstruct an animatable 3D Gaussian-head avatar from a single portrait photo, powered by the LAM (Large Avatar Model) research from the 3DAIGC team. Unlike "Tạo Avatar" (which picks from ready-made VRM avatars), this feature rebuilds a 3D avatar directly from your own face.'}
          </p>
        </div>
      </div>

      {/* Feature grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
        <FeatureCard isDark={isDark} border={border} surface={surface} text={text} text2={text2}
          icon={<Zap size={16} />}
          title={vi ? 'Dựng avatar trong ~1 giây' : 'One-shot, ~1 second'}
          desc={vi ? 'Một lượt suy luận duy nhất, không cần quay video hay quét nhiều góc mặt.' : 'A single forward pass — no multi-angle scans or training video required.'} />
        <FeatureCard isDark={isDark} border={border} surface={surface} text={text} text2={text2}
          icon={<Smartphone size={16} />}
          title={vi ? 'Render đa nền tảng, thời gian thực' : 'Cross-platform real-time render'}
          desc={vi ? 'Avatar Gaussian dựng được có thể chạy mượt trên trình duyệt và cả điện thoại.' : 'The reconstructed Gaussian avatar renders smoothly in the browser and even on mobile.'} />
        <FeatureCard isDark={isDark} border={border} surface={surface} text={text} text2={text2}
          icon={<Mic size={16} />}
          title={vi ? 'Biểu cảm theo giọng nói' : 'Audio-driven expressions'}
          desc={vi ? 'Kết hợp LAM_Audio2Expression để avatar nhép miệng và biểu cảm theo âm thanh.' : 'Pair with LAM_Audio2Expression to drive lip-sync and facial expression from audio.'} />
        <FeatureCard isDark={isDark} border={border} surface={surface} text={text} text2={text2}
          icon={<Wand2 size={16} />}
          title={vi ? 'Trợ lý AI có gương mặt riêng' : 'Realtime chatting avatar'}
          desc={vi ? 'SDK OpenAvatarChat cho phép ghép LLM + ASR/TTS + avatar LAM để trò chuyện thời gian thực.' : 'The OpenAvatarChat SDK wires an LLM + ASR/TTS to a LAM avatar for live conversations.'} />
      </div>

      {/* How to use */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 10 }}>
          {vi ? 'Cách sử dụng demo bên dưới' : 'How to use the demo below'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {[
            { icon: <UploadCloud size={14} />, t: vi ? '1. Tải ảnh chân dung' : '1. Upload a portrait', d: vi ? 'Ảnh chính diện, đủ sáng, nhìn thẳng camera cho kết quả tốt nhất.' : 'A well-lit, front-facing photo gives the best result.' },
            { icon: <Video size={14} />, t: vi ? '2. Chọn video chuyển động' : '2. Pick a driving video', d: vi ? 'Dùng video mẫu có sẵn hoặc video khuôn mặt để dẫn hướng biểu cảm.' : 'Use a sample motion clip or a face video to drive the expression.' },
            { icon: <Wand2 size={14} />, t: vi ? '3. Nhấn Generate' : '3. Click Generate', d: vi ? 'Mô hình chạy trên GPU của Hugging Face, mất khoảng vài chục giây.' : 'Runs on Hugging Face GPU; takes roughly tens of seconds.' },
          ].map((s, i) => (
            <div key={i} style={{ fontSize: 12, color: text2, lineHeight: 1.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: text, fontWeight: 700, marginBottom: 3 }}>{s.icon}{s.t}</div>
              {s.d}
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 12, fontSize: 11.5, color: text3, borderTop: `1px dashed ${border}`, paddingTop: 10,
        }}>
          {vi
            ? 'Lưu ý: đây là bản demo công khai của nhóm nghiên cứu chạy trên hạ tầng GPU miễn phí của Hugging Face Space, nên có thể vào hàng đợi hoặc thỉnh thoảng báo lỗi runtime khi quá tải. Nếu khung bên dưới không tải được, hãy dùng nút "Mở demo trong tab mới".'
            : 'Note: this is the research team\'s public demo running on Hugging Face\'s free shared GPU tier, so it may queue or occasionally show a runtime error under load. If the frame below fails to load, use the "Open demo in new tab" button.'}
        </div>
      </div>


      {/* Real-time avatar chat powered by OpenAvatarChat */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <MessageSquareText size={16} color={isDark ? '#00e5ff' : '#00b8cc'} />
          <div style={{ fontSize: 14, fontWeight: 800, color: text }}>
            {vi ? 'Trò chuyện thời gian thực với Avatar AI' : 'Real-time AI Avatar conversation'}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: isDark ? 'rgba(0,230,118,0.15)' : 'rgba(0,230,118,0.1)', color: '#00c46a',
          }}>OpenAvatarChat</span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: text2, lineHeight: 1.6 }}>
          {vi
            ? 'Dự án mã nguồn mở OpenAvatarChat (ghép LLM + ASR + TTS + Avatar) tự phục vụ MỘT giao diện web đầy đủ, đã vẽ sẵn khuôn mặt avatar chuyển động (LiteAvatar/LAM) qua WebRTC. Vì backend cần GPU và tải model nặng, bạn tự chạy nó (miễn phí, mã nguồn mở) rồi dán URL server vào panel video bên dưới — không có mô phỏng hay dữ liệu giả.'
            : 'The open-source OpenAvatarChat project (LLM + ASR + TTS + Avatar) serves a complete web frontend of its own that already draws the moving avatar face (LiteAvatar/LAM) over WebRTC. Because the backend needs a GPU and heavyweight models, you run it yourself (free, open source) and paste the server URL into the video panel below — nothing here is simulated.'}
        </p>

        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: text }}>
              <Sparkles size={14} /> {vi ? 'Cách nhanh nhất: demo chính thức (không cần tự host)' : 'Fastest option: official demo (no self-hosting needed)'}
            </div>
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 12, color: text3, lineHeight: 1.6 }}>
            {vi
              ? 'Chính team HumanAIGC-Engineering-Team tự host sẵn một bản demo đầy đủ (chọn được LiteAvatar hoặc LAM) trên Hugging Face Space — dùng thử ngay bên dưới, không cần dựng server riêng.'
              : 'The HumanAIGC-Engineering-Team itself hosts a complete demo (choice of LiteAvatar or LAM) on a Hugging Face Space — try it right below, no need to stand up your own server.'}
          </p>
          <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: 14, color: text3, fontSize: 12, lineHeight: 1.6 }}>
            {vi ? 'Link/iframe Hugging Face Space đã được ẩn theo cấu hình nội bộ.' : 'Hugging Face Space link/iframe is hidden by internal configuration.'}
          </div>
        </div>

        <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: text }}>
              <Terminal size={14} /> {vi ? 'Hoặc tự host backend riêng (tuỳ chỉnh được nhiều hơn)' : 'Or self-host your own backend (more customizable)'}
            </div>
            <button onClick={copySetupCmd} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
              padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${border}`, background: 'transparent', color: text2,
            }}>
              {copiedSetup ? <Check size={13} color="#00e676" /> : <Copy size={13} />}
              {copiedSetup ? (vi ? 'Đã sao chép' : 'Copied') : (vi ? 'Sao chép lệnh' : 'Copy commands')}
            </button>
          </div>
          <pre style={{
            margin: 0, fontSize: 11, lineHeight: 1.65, color: text2, overflowX: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre',
          }}>{OAC_SETUP_CMD}</pre>
          <div style={{ marginTop: 10, fontSize: 11.5, color: text3 }}>
            {vi
              ? 'Cần: máy có GPU NVIDIA (khuyến nghị), Python 3.11 và uv. Docker + docker-compose.yml có sẵn trong repo nếu bạn muốn chạy container hoá. Yêu cầu API key cho LLM (ví dụ DASHSCOPE_API_KEY) tuỳ theo file config bạn chọn. Không chạy được máy riêng? Dùng notebook Colab đính kèm (chọn AVATAR_MODE = "native_video") để có URL public trong vài phút.'
              : 'Requires: an NVIDIA GPU (recommended), Python 3.11, and uv. A Docker + docker-compose.yml setup ships in the repo if you\'d rather containerize it. You\'ll need an LLM API key (e.g. DASHSCOPE_API_KEY) depending on the config you pick. No spare machine? Use the bundled Colab notebook (set AVATAR_MODE = "native_video") to get a public URL in a few minutes.'}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <OpenAvatarChatVideoPanel
            isDark={isDark} vi={vi} border={border} surface={surface} text={text} text2={text2} text3={text3}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 8px' }}>
          <div style={{ flex: 1, height: 1, background: border }} />
          <span style={{ fontSize: 11, color: text3, whiteSpace: 'nowrap' }}>
            {vi ? 'Hoặc: chế độ nhẹ, chỉ chữ + âm thanh (không có mặt)' : 'Or: lightweight mode, text + audio only (no face)'}
          </span>
          <div style={{ flex: 1, height: 1, background: border }} />
        </div>
        <p style={{ margin: '0 0 10px', fontSize: 11.5, color: text3, lineHeight: 1.55 }}>
          {vi
            ? 'Panel dưới đây là client WebSocket tự viết (không dùng WebRTC, né được vấn đề TURN/NAT) — chỉ hiển thị chữ và phát âm thanh, KHÔNG vẽ mặt avatar. Cần chạy backend ở chế độ AVATAR_MODE = "text_only_legacy" (đổi RtcClient → WsClient) trong notebook Colab để dùng được chế độ này.'
            : 'The panel below is a hand-written WebSocket client (no WebRTC, so no TURN/NAT hassle) — it shows text and plays audio only, it does NOT draw the avatar face. It needs the backend run with AVATAR_MODE = "text_only_legacy" (RtcClient → WsClient) in the Colab notebook.'}
        </p>

        <OpenAvatarChatPanel
          isDark={isDark} vi={vi} border={border} surface={surface} text={text} text2={text2} text3={text3}
        />
      </div>

      {/* Bonus: Hi3DGen (Stable3DGen) — mesh 3D chất lượng cao cho VẬT THỂ
          NÓI CHUNG, khác nhánh với LAM. Dùng khi
          cần dựng mesh chi tiết từ 1 ảnh cho vật thể bất kỳ, không riêng
          người/mặt. */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Sparkles size={16} color={isDark ? '#00e5ff' : '#00b8cc'} />
          <div style={{ fontSize: 14, fontWeight: 800, color: text }}>
            {vi ? 'Bonus: Hi3DGen / Stable3DGen (mesh 3D vật thể chung)' : 'Bonus: Hi3DGen / Stable3DGen (general-object 3D mesh)'}
          </div>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
            background: isDark ? 'rgba(0,230,118,0.15)' : 'rgba(0,230,118,0.1)', color: '#00c46a',
          }}>Stable-X/Hi3DGen</span>
        </div>
        <p style={{ margin: '0 0 12px', fontSize: 12.5, color: text2, lineHeight: 1.6 }}>
          {vi
            ? 'Khác nhánh với LAM ở trên (chuyên avatar người có thể tạo dáng/animate): Hi3DGen dựng mesh 3D độ chi tiết cao từ MỘT ảnh bất kỳ — dùng normal-map làm cầu nối trung gian giữa ảnh 2D và hình học 3D. Các link/iframe ngoài đã được ẩn theo cấu hình nội bộ.'
            : 'A different branch from LAM above: Hi3DGen builds a high-detail 3D mesh from a single arbitrary image using a normal map as an intermediate bridge. External links/iframes are hidden by internal configuration.'}
        </p>
        <div style={{ marginBottom: 12, color: text3, fontSize: 12, lineHeight: 1.6 }}>
          {vi ? 'Các link GitHub/Hugging Face/Project đã được ẩn theo cấu hình nội bộ.' : 'GitHub/Hugging Face/project links are hidden by internal configuration.'}
        </div>
        <div style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 16, color: text3, fontSize: 12.5, lineHeight: 1.6 }}>
          {vi ? 'Iframe Hugging Face Space đã được ẩn theo cấu hình nội bộ.' : 'Hugging Face Space iframe is hidden by internal configuration.'}
        </div>
      </div>

      {/* External GitHub/Hugging Face/project links are intentionally hidden. */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16, marginBottom: 20, color: text2, fontSize: 12.5, fontWeight: 800 }}>
        {vi ? 'Các link GitHub, Hugging Face Space và trang dự án ngoài đã được ẩn theo cấu hình nội bộ.' : 'GitHub, Hugging Face Space, and external project links are hidden by internal configuration.'}
      </div>

      {/* Citation */}
      <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: text }}>{vi ? 'Trích dẫn nghiên cứu' : 'Citation'}</div>
          <button
            onClick={copyCitation}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
              padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
              border: `1px solid ${border}`, background: 'transparent', color: text2,
            }}
          >
            {copied ? <Check size={13} color="#00e676" /> : <Copy size={13} />}
            {copied ? (vi ? 'Đã sao chép' : 'Copied') : (vi ? 'Sao chép' : 'Copy')}
          </button>
        </div>
        <pre style={{
          margin: 0, fontSize: 11, lineHeight: 1.6, color: text2, overflowX: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre',
        }}>{CITATION}</pre>
      </div>
    </div>
  )
}
