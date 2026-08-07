// SuperheroCursorPicker — bảng chọn màu + "hướng bay" cho con trỏ chuột
// hình siêu nhân, dùng riêng ở trang "🤖 AI chatbot control".
import React from 'react'
import { AGENT_COLORS } from '../../../lib/presets/agents'
import { CURSOR_POSES, buildHeroCursorPreviewSrc } from './superheroCursor'

export default function SuperheroCursorPicker({ isDark, isVi, border, text, muted, color, setColor, poseId, setPoseId }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: muted }}>{isVi ? 'Màu siêu nhân:' : 'Hero color:'}</span>
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

      <span style={{ fontSize: 11, fontWeight: 800, color: muted, marginLeft: 4 }}>{isVi ? 'Hướng bay:' : 'Flight pose:'}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CURSOR_POSES.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPoseId(p.id)}
            title={isVi ? p.vi : p.en}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              border: `1px solid ${border}`,
              borderRadius: 999,
              padding: '4px 10px 4px 6px',
              background: poseId === p.id ? 'linear-gradient(135deg, #0f4c81, #14b8a6)' : (isDark ? 'rgba(15,23,42,0.74)' : '#fff'),
              color: poseId === p.id ? '#fff' : text,
              fontSize: 11, fontWeight: 800, cursor: 'pointer',
            }}
          >
            <img src={buildHeroCursorPreviewSrc({ color, poseId: p.id })} alt="" width={18} height={18} style={{ display: 'block', filter: poseId === p.id ? 'brightness(0) invert(1)' : 'none' }} />
            {isVi ? p.vi : p.en}
          </button>
        ))}
      </div>
    </div>
  )
}
