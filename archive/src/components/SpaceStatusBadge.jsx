import React, { useEffect, useState, useCallback } from 'react'
import { CircleDot, RefreshCw } from 'lucide-react'

// Hiện trạng thái THẬT của một Hugging Face Space (RUNNING/BUILDING/lỗi...)
// bằng cách hỏi /api/space-status (server-side, dùng API công khai của HF)
// TRƯỚC KHI người dùng bấm Generate — để họ biết ngay "Space đang lỗi build"
// thay vì bấm xong mới nhận lỗi 502. Không tự chặn nút Generate: trạng thái
// có thể vừa đổi giữa lúc check và lúc bấm, nên đây là gợi ý, không phải
// khoá cứng.

const STAGE_COLOR = {
  RUNNING: '#00c46a',
  RUNNING_BUILDING: '#00c46a',
  BUILDING: '#f5a623',
  SLEEPING: '#8a90a0',
  PAUSED: '#8a90a0',
  STOPPED: '#8a90a0',
  BUILD_ERROR: '#ff5252',
  RUNTIME_ERROR: '#ff5252',
  NO_APP_FILE: '#ff5252',
  CONFIG_ERROR: '#ff5252',
  unknown: '#8a90a0',
}

export default function SpaceStatusBadge({ space, vi, text3 }) {
  const [state, setState] = useState(null) // null = loading
  const [checking, setChecking] = useState(false)

  const check = useCallback(async () => {
    setChecking(true)
    try {
      const resp = await fetch(`/api/space-status?spaces=${encodeURIComponent(space)}`)
      const data = await resp.json()
      setState(data?.results?.[0] || { stage: 'unknown' })
    } catch {
      setState({ stage: 'unknown' })
    } finally {
      setChecking(false)
    }
  }, [space])

  useEffect(() => { check() }, [check])

  const stage = state?.stage || 'unknown'
  const color = STAGE_COLOR[stage] || STAGE_COLOR.unknown
  const label = state ? (vi ? state.labelVi : state.labelEn) : (vi ? 'Đang kiểm tra...' : 'Checking...')

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: text3 }}>
      <style>{'@keyframes lhm-status-spin { to { transform: rotate(360deg) } }'}</style>
      <CircleDot size={11} color={color} style={{ flexShrink: 0 }} />
      <span>{space}: <strong style={{ color }}>{label}</strong></span>
      <button
        onClick={check}
        disabled={checking}
        title={vi ? 'Kiểm tra lại' : 'Recheck'}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 5, border: 'none', background: 'transparent',
          color: text3, cursor: checking ? 'default' : 'pointer', padding: 0,
        }}
      >
        <RefreshCw size={11} style={{ animation: checking ? 'lhm-status-spin 0.8s linear infinite' : 'none' }} />
      </button>
    </div>
  )
}
