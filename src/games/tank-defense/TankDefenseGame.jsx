import React from 'react'
import LegacyHtmlGame from '../LegacyHtmlGame.jsx'
import humanTankHtml from '../../../public/games/human-tank-camera-key.html?raw'
import classicTankHtml from '../../../public/games/co-the-tank-camera-key.html?raw'

export default function TankDefenseGame({ variant = 'human' }) {
  const html = variant === 'classic' ? classicTankHtml : humanTankHtml
  const title = variant === 'classic'
    ? 'Bảo Vệ Cơ Thể - Tank Defense (React)'
    : 'Medical AI PvP/PvE/Co-op - Tank Defense (React)'

  return <LegacyHtmlGame html={html} title={title} className="tank-defense-react-root" />
}
