import React from 'react'
import { Sparkles, Video, Layers3 } from 'lucide-react'
import { useApp } from '../context/AppContext'

const RECON_LINKS = {
  project: 'https://jiahao620.github.io/reconviagen/',
  legacyGithub: 'https://github.com/GAP-LAB-CUHK-SZ/ReconViaGen',
  legacySpace: 'https://huggingface.co/spaces/Stable-X/ReconViaGen',
  legacyEmbed: 'https://stable-x-reconviagen.hf.space',
  v05Github: 'https://github.com/GAP-LAB-CUHK-SZ/ReconViaGen/tree/v0.5',
  v05Space: 'https://huggingface.co/spaces/Stable-X/ReconViaGen-v0.5',
  v05Embed: 'https://stable-x-reconviagen-v0-5.hf.space',
}

function ReconViaGenFrame({ version, badge, description, isDark, border, surface, text, text2, text3, vi }) {
  return (
    <section style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 16, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <Sparkles size={16} color={isDark ? '#00e5ff' : '#00b8cc'} />
        <div style={{ fontSize: 14, fontWeight: 800, color: text }}>{version}</div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
          background: isDark ? 'rgba(0,230,118,0.15)' : 'rgba(0,230,118,0.1)', color: '#00c46a',
        }}>{badge}</span>
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 12.5, color: text2, lineHeight: 1.6 }}>{description}</p>
      <div style={{ border: `1px solid ${border}`, borderRadius: 14, padding: 16, color: text2, fontSize: 12.5, lineHeight: 1.6 }}>
        {vi ? 'Link/iframe GitHub và Hugging Face Space đã được ẩn theo cấu hình nội bộ.' : 'GitHub and Hugging Face Space links/iframes are hidden by internal configuration.'}
      </div>
    </section>
  )
}

export default function Create3DVideoFrom2DPanel() {
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const vi = lang === 'vi'

  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'
  const surface = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'
  const text = isDark ? '#e8f0f8' : '#1a2035'
  const text2 = isDark ? 'rgba(232,240,248,0.62)' : '#5a6270'
  const text3 = isDark ? 'rgba(232,240,248,0.4)' : '#8a90a0'

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '4px 4px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{
          width: 46, height: 46, borderRadius: 13, flexShrink: 0,
          background: 'linear-gradient(135deg, #00b8cc, #6b3fd4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Video size={22} color="#fff" />
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: text }}>Create 3D Video From 2D</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: isDark ? 'rgba(107,63,212,0.18)' : 'rgba(107,63,212,0.1)',
              color: '#9c6fff', letterSpacing: 0.4,
            }}>ReconViaGen</span>
          </div>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: text2, lineHeight: 1.6, maxWidth: 720 }}>
            {vi
              ? 'Trang riêng cho bộ Multi-view 3D Object Reconstruction via Generation: tái dựng vật thể 3D từ nhiều ảnh/góc nhìn 2D, gồm cả bản demo cũ và bản v0.5 mới.'
              : 'A dedicated page for Multi-view 3D Object Reconstruction via Generation: reconstruct 3D objects from multiple 2D images/viewpoints, with both the legacy demo and the new v0.5 demo.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, padding: 14, background: surface, border: `1px solid ${border}`, borderRadius: 12 }}>
          <Layers3 size={18} color={isDark ? '#00e5ff' : '#00b8cc'} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>{vi ? 'Đầu vào đa góc' : 'Multi-view input'}</div>
            <div style={{ fontSize: 12, color: text2, lineHeight: 1.5 }}>{vi ? 'Dùng nhiều ảnh của cùng một vật thể để tăng độ chính xác so với 1 ảnh.' : 'Use several images of the same object for better accuracy than single-image reconstruction.'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, padding: 14, background: surface, border: `1px solid ${border}`, borderRadius: 12 }}>
          <Sparkles size={18} color={isDark ? '#00e5ff' : '#00b8cc'} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: text, marginBottom: 2 }}>{vi ? 'Reconstruction + generation' : 'Reconstruction + generation'}</div>
            <div style={{ fontSize: 12, color: text2, lineHeight: 1.5 }}>{vi ? 'Kết hợp tái dựng và sinh ảnh để hoàn thiện các vùng bị khuất.' : 'Combines reconstruction and generation to complete occluded regions.'}</div>
          </div>
        </div>
      </div>

      <ReconViaGenFrame
        version={vi ? 'ReconViaGen bản cũ' : 'Legacy ReconViaGen'}
        badge="Stable-X/ReconViaGen"
        description={vi
          ? 'Phiên bản demo cũ của Multi-view 3D Object Reconstruction via Generation. Giữ lại để so sánh pipeline và kết quả với bản v0.5.'
          : 'The older demo of Multi-view 3D Object Reconstruction via Generation. Kept here so you can compare its pipeline and outputs against v0.5.'}
        isDark={isDark}
        border={border}
        surface={surface}
        text={text}
        text2={text2}
        text3={text3}
        vi={vi}
      />

      <ReconViaGenFrame
        version={vi ? 'ReconViaGen v0.5' : 'ReconViaGen v0.5'}
        badge="Stable-X/ReconViaGen-v0.5"
        description={vi
          ? 'Bản v0.5 dùng cho quy trình tái dựng nhiều góc nhìn; các link/iframe ngoài đã được ẩn theo cấu hình nội bộ.'
          : 'The v0.5 build for multi-view reconstruction; external links/iframes are hidden by internal configuration.'}
        isDark={isDark}
        border={border}
        surface={surface}
        text={text}
        text2={text2}
        text3={text3}
        vi={vi}
      />
    </div>
  )
}
