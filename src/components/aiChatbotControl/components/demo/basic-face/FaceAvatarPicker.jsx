// FaceAvatarPicker — hàng chọn màu + phong cách cho khuôn mặt tròn AI,
// dùng chung UI y hệt ở: trang "🤖 AI chatbot control" và popup chatbot
// chung. Đọc/ghi trực tiếp vào kho `useAgent` (bodyColor/faceStyle) nên
// bất kỳ nơi nào gọi component này cũng cùng cập nhật 1 trạng thái.
import React from 'react'
import { useAgent } from '../../../lib/state'
import { AGENT_COLORS, FACE_STYLES } from '../../../lib/presets/agents'

export default function FaceAvatarPicker({ isDark, isVi, border, text, muted }) {
  const current = useAgent(state => state.current)
  const update = useAgent(state => state.update)
  const color = current?.bodyColor || AGENT_COLORS[0]
  const style = current?.faceStyle || 'round'

  const setColor = (next) => update(current.id, { bodyColor: next })
  const setStyle = (next) => update(current.id, { faceStyle: next })

  const styleBtn = (active) => ({
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: '6px 10px',
    background: active ? 'linear-gradient(135deg, #0f4c81, #14b8a6)' : (isDark ? 'rgba(15,23,42,0.74)' : '#fff'),
    color: active ? '#fff' : text,
    fontSize: 11,
    fontWeight: 800,
    cursor: 'pointer',
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: muted }}>{isVi ? 'Màu:' : 'Color:'}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {AGENT_COLORS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            title={c}
            style={{
              width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer',
              border: color === c ? `2px solid ${isDark ? '#fff' : '#0f172a'}` : `1px solid ${border}`,
              boxShadow: color === c ? '0 0 0 2px rgba(20,184,166,0.4)' : 'none',
            }}
          />
        ))}
        <label style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: `1px solid ${border}`, cursor: 'pointer', position: 'relative' }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ position: 'absolute', inset: -4, width: 30, height: 30, border: 'none', padding: 0, cursor: 'pointer' }} />
        </label>
      </div>

      <span style={{ fontSize: 11, fontWeight: 800, color: muted, marginLeft: 4 }}>{isVi ? 'Phong cách:' : 'Style:'}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {FACE_STYLES.map(s => (
          <button key={s.id} type="button" onClick={() => setStyle(s.id)} style={styleBtn(style === s.id)}>
            {isVi ? s.vi : s.en}
          </button>
        ))}
      </div>
    </div>
  )
}
