/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { useRef } from 'react'
import { AGENT_COLORS, INTERLOCUTOR_VOICES } from '../lib/presets/agents'
import Modal from './Modal'
import c from 'classnames'
import { useAgent, useUI } from '../lib/state'
import { useApp } from '../../../context/AppContext'

export default function EditAgent() {
  const { lang } = useApp()
  const isVi = lang !== 'en'
  const agent = useAgent(state => state.current)
  const updateAgent = useAgent(state => state.update)
  const nameInput = useRef(null)
  const { setShowAgentEdit } = useUI()

  function onClose() {
    setShowAgentEdit(false)
  }

  function updateCurrentAgent(adjustments) {
    updateAgent(agent.id, adjustments)
  }

  return (
    <Modal onClose={() => onClose()}>
      <div className="editAgent">
        <div>
          <form>
            <div>
              <input
                className="largeInput"
                type="text"
                placeholder={isVi ? 'Tên' : 'Name'}
                value={agent.name}
                onChange={e => updateCurrentAgent({ name: e.target.value })}
                ref={nameInput}
              />
            </div>

            <div>
              <label>
                {isVi ? 'Tính cách' : 'Personality'}
                <textarea
                  value={agent.personality}
                  onChange={e =>
                    updateCurrentAgent({ personality: e.target.value })
                  }
                  rows={7}
                  placeholder={isVi ? 'Tôi nên trò chuyện như thế nào? Vai trò/mục đích của tôi là gì?' : 'How should I act? Whatʼs my purpose? How would you describe my personality?'}
                />
              </label>
            </div>
          </form>
        </div>

        <div>
          <div>
            <ul className="colorPicker">
              {AGENT_COLORS.map((color, i) => (
                <li
                  key={i}
                  className={c({ active: color === agent.bodyColor })}
                >
                  <button
                    style={{ backgroundColor: color }}
                    onClick={() => updateCurrentAgent({ bodyColor: color })}
                  />
                </li>
              ))}
            </ul>
          </div>
          <div className="voicePicker">
            {isVi ? 'Giọng nói' : 'Voice'}
            <select
              value={agent.voice}
              onChange={e => {
                updateCurrentAgent({
                  voice: e.target.value,
                })
              }}
            >
              {INTERLOCUTOR_VOICES.map(voice => (
                <option key={voice} value={voice}>
                  {voice}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button onClick={() => onClose()} className="button primary">
          {isVi ? 'Bắt đầu!' : "Let's go!"}
        </button>
      </div>
    </Modal>
  )
}
