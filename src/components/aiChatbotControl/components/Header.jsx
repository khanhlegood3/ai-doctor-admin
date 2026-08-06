/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 *
 * ĐÃ ĐƠN GIẢN HOÁ: bản gốc cho phép chọn giữa nhiều "nhân vật" demo
 * (Charlotte/Paul/Shane/Penny) + tự tạo thêm chatbot riêng, hiển thị qua 1
 * dropdown "roomList". Theo yêu cầu, trang này giờ CHỈ CÒN ĐÚNG 1 chatbot
 * duy nhất (ProjectAI, icon 😊 — xem lib/presets/agents.js) cho toàn dự án,
 * nên dropdown chọn/tạo nhân vật không còn cần thiết — chỉ còn hiển thị tên +
 * nút "Sửa" (đổi tính cách/giọng nói/màu nếu muốn, vẫn qua AgentEdit.jsx).
 */
import React from 'react'
import { useUI, useUser, useAgent } from '../lib/state'
import { useApp } from '../../../context/AppContext'

export default function Header() {
  const { setShowAgentEdit } = useUI()
  const { lang } = useApp()
  const isVi = lang !== 'en'
  const { name } = useUser()
  const { current } = useAgent()

  return (
    <header>
      <div className="roomInfo">
        <div className="roomName">
          <h1>{current.name}</h1>

          <button
            onClick={() => setShowAgentEdit(true)}
            className="button createButton"
          >
            <span className="icon">edit</span> {isVi ? 'Sửa' : 'Edit'}
          </button>
        </div>
      </div>
      <div className="userSettingsButton" title={name ? undefined : (isVi ? 'Cập nhật tên trong Hồ sơ cá nhân' : 'Update your name in Profile')}>
        <p className="user-name">{name || (isVi ? 'Khách' : 'Guest')}</p>
      </div>
    </header>
  )
}
