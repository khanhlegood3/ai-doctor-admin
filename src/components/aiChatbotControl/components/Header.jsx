/**
 * Ported from chatterbots (Google I/O 2025 Live API Demo).
 * Original license: Apache-2.0, Copyright 2024 Google LLC
 */
import React, { useEffect, useState } from 'react'
import { useLiveAPIContext } from '../contexts/VoiceCompanionContext'
import { createNewAgent } from '../lib/presets/agents'
import { useAgent, useUI, useUser } from '../lib/state'
import c from 'classnames'
import { useApp } from '../../../context/AppContext'

export default function Header() {
  const { setShowAgentEdit } = useUI()
  const { lang } = useApp()
  const isVi = lang !== 'en'
  const { name } = useUser()
  const { current, setCurrent, availablePresets, availablePersonal, addAgent } =
    useAgent()
  const { disconnect } = useLiveAPIContext()

  let [showRoomList, setShowRoomList] = useState(false)

  useEffect(() => {
    addEventListener('click', () => setShowRoomList(false))
    return () => removeEventListener('click', () => setShowRoomList(false))
  }, [])

  function changeAgent(agent) {
    disconnect()
    setCurrent(agent)
  }

  function addNewChatterBot() {
    disconnect()
    addAgent(createNewAgent())
    setShowAgentEdit(true)
  }

  return (
    <header>
      <div className="roomInfo">
        <div className="roomName">
          <button
            onClick={e => {
              e.stopPropagation()
              setShowRoomList(!showRoomList)
            }}
          >
            <h1 className={c({ active: showRoomList })}>
              {current.name}
              <span className="icon">arrow_drop_down</span>
            </h1>
          </button>

          <button
            onClick={() => setShowAgentEdit(true)}
            className="button createButton"
          >
            <span className="icon">edit</span> {isVi ? 'Sửa' : 'Edit'}
          </button>
        </div>

        <div className={c('roomList', { active: showRoomList })}>
          <div>
            <h3>{isVi ? 'Mẫu có sẵn' : 'Presets'}</h3>
            <ul>
              {availablePresets
                .filter(agent => agent.id !== current.id)
                .map(agent => (
                  <li
                    key={agent.name}
                    className={c({ active: agent.id === current.id })}
                  >
                    <button onClick={() => changeAgent(agent)}>
                      {agent.name}
                    </button>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h3>{isVi ? 'Chatbot của bạn' : 'Your ChatterBots'}</h3>
            {
              <ul>
                {availablePersonal.length ? (
                  availablePersonal.map(({ id, name }) => (
                    <li key={name} className={c({ active: id === current.id })}>
                      <button onClick={() => changeAgent(id)}>{name}</button>
                    </li>
                  ))
                ) : (
                  <p>{isVi ? 'Chưa có.' : 'None yet.'}</p>
                )}
              </ul>
            }
            <button
              className="newRoomButton"
              onClick={() => {
                addNewChatterBot()
              }}
            >
              <span className="icon">add</span>{isVi ? 'Chatbot mới' : 'New ChatterBot'}
            </button>
          </div>
        </div>
      </div>
      <div className="userSettingsButton" title={name ? undefined : (isVi ? 'Cập nhật tên trong Hồ sơ cá nhân' : 'Update your name in Profile')}>
        <p className="user-name">{name || (isVi ? 'Khách' : 'Guest')}</p>
      </div>
    </header>
  )
}
