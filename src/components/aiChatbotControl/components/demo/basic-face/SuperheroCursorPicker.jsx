// SuperheroCursorPicker — bảng chọn Kiểu (Không dùng / Phù thuỷ cưỡi chổi
// bay / 12 con giáp) + màu + hướng bay (nếu là kiểu Phù thuỷ) cho con trỏ
// chuột, dùng riêng ở trang "🤖 AI chatbot control".
import React from 'react'
import { AGENT_COLORS } from '../../../lib/presets/agents'
import { CURSOR_TYPES, CURSOR_POSES, buildCursorPreviewSrc } from './superheroCursor'

export default function SuperheroCursorPicker({
  isDark, isVi, border, text, muted, type, setType, color, setColor, poseId, setPoseId,
  flyEffectEnabled, setFlyEffectEnabled, gazeTrackEnabled, setGazeTrackEnabled,
}) {
  const chipStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 6,
    border: `1px solid ${border}`,
    borderRadius: 999,
    padding: '4px 10px',
    background: active ? 'linear-gradient(135deg, #0f4c81, #14b8a6)' : (isDark ? 'rgba(15,23,42,0.74)' : '#fff'),
    color: active ? '#fff' : text,
    fontSize: 11, fontWeight: 800, cursor: 'pointer',
  })

  const toggleRowStyle = { display: 'flex', alignItems: 'center', gap: 8 }
  const toggleLabelStyle = { fontSize: 11, fontWeight: 800, color: text, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: muted }}>{isVi ? 'Kiểu:' : 'Type:'}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CURSOR_TYPES.map(t => (
            <button key={t.id} type="button" onClick={() => setType(t.id)} style={chipStyle(type === t.id)}>
              {t.id !== 'none' && (
                <img src={buildCursorPreviewSrc({ type: t.id, color, poseId })} alt="" width={16} height={16} style={{ display: 'block', filter: type === t.id ? 'brightness(0) invert(1)' : 'none' }} />
              )}
              {isVi ? t.vi : t.en}
            </button>
          ))}
        </div>
      </div>

      {type !== 'none' && (
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
        </div>
      )}

      {type === 'hero' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: muted }}>{isVi ? 'Hướng bay:' : 'Flight pose:'}</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CURSOR_POSES.map(p => (
              <button key={p.id} type="button" onClick={() => setPoseId(p.id)} style={chipStyle(poseId === p.id)}>
                <img src={buildCursorPreviewSrc({ type: 'hero', color, poseId: p.id })} alt="" width={16} height={16} style={{ display: 'block', filter: poseId === p.id ? 'brightness(0) invert(1)' : 'none' }} />
                {isVi ? p.vi : p.en}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 2 tuỳ chọn bật/tắt hiệu ứng độc lập với kiểu con trỏ ở trên — áp
          dụng đồng bộ luôn cho 2 trang Anh Hùng (không có UI riêng ở đó). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, borderTop: `1px dashed ${border}` }}>
        <label style={toggleRowStyle}>
          <input
            type="checkbox"
            checked={!flyEffectEnabled}
            onChange={(e) => setFlyEffectEnabled(!e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer' }}
          />
          <span style={toggleLabelStyle}>
            {isVi ? 'Không dùng hiệu ứng bay (phù thuỷ / người nhện khi click chuột)' : 'No flying effect (witch / spider on mouse click)'}
          </span>
        </label>
        <label style={toggleRowStyle}>
          <input
            type="checkbox"
            checked={!gazeTrackEnabled}
            onChange={(e) => setGazeTrackEnabled(!e.target.checked)}
            style={{ width: 15, height: 15, cursor: 'pointer' }}
          />
          <span style={toggleLabelStyle}>
            {isVi ? 'Không dùng hiệu ứng nhìn dõi theo (mắt/mũi khuôn mặt AI theo chuột)' : 'No gaze-tracking effect (AI face eyes/nose follow mouse)'}
          </span>
        </label>
      </div>
    </div>
  )
}
