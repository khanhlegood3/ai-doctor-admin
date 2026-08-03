/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Charlotte, Paul, Shane, Penny } from './presets/agents'

/**
 * User
 * name/info are now synced automatically from the app's real Profile
 * (AuthContext) by AIChatbotControlPanel.jsx — no manual "Your name / Your
 * info" popup anymore.
 */
export const useUser = create(set => ({
  name: '',
  info: '',
  setName: name => set({ name }),
  setInfo: info => set({ info }),
}))

/**
 * Agents
 */
function getAgentById(id) {
  const { availablePersonal, availablePresets } = useAgent.getState()
  return (
    availablePersonal.find(agent => agent.id === id) ||
    availablePresets.find(agent => agent.id === id)
  )
}

export const useAgent = create(
  persist(
    set => ({
      current: Paul,
      availablePresets: [Paul, Charlotte, Shane, Penny],
      availablePersonal: [],

      addAgent: (agent) => {
        set(state => ({
          availablePersonal: [...state.availablePersonal, agent],
          current: agent,
        }))
      },
      setCurrent: (agent) =>
        set({ current: typeof agent === 'string' ? getAgentById(agent) : agent }),
      update: (agentId, adjustments) => {
        let agent = getAgentById(agentId)
        if (!agent) return
        const updatedAgent = { ...agent, ...adjustments }
        set(state => ({
          availablePresets: state.availablePresets.map(a =>
            a.id === agentId ? updatedAgent : a
          ),
          availablePersonal: state.availablePersonal.map(a =>
            a.id === agentId ? updatedAgent : a
          ),
          current: state.current.id === agentId ? updatedAgent : state.current,
        }))
      },
    }),
    {
      // Lưu lại lựa chọn companion (đặc biệt là bodyColor) vào localStorage để
      // 2 trang "Anh Hùng" (HeroMicVoiceButton) đọc được màu khuôn mặt tròn
      // NGAY TỪ ĐẦU, kể cả sau khi tải lại trang — không chỉ trong lúc đang
      // mở panel "AI chatbot control".
      name: 'ai-doctor-admin.companion-agent',
    }
  )
)

/**
 * UI
 */
export const useUI = create(set => ({
  showAgentEdit: false,
  setShowAgentEdit: (show) => set({ showAgentEdit: show }),
}))
