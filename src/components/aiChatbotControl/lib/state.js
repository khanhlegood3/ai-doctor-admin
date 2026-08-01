/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import { create } from 'zustand'
import { Charlotte, Paul, Shane, Penny } from './presets/agents'

/**
 * User
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

export const useAgent = create(set => ({
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
}))

/**
 * UI
 */
export const useUI = create(set => ({
  showUserConfig: true,
  setShowUserConfig: (show) => set({ showUserConfig: show }),
  showAgentEdit: false,
  setShowAgentEdit: (show) => set({ showAgentEdit: show }),
}))
