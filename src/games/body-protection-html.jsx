import React from 'react'
import { createRoot } from 'react-dom/client'
import LegacyHtmlGame from './LegacyHtmlGame.jsx'

import autoHtml from '../../public/games/bao-ve-co-the-auto.html?raw'
import cameraKeyHtml from '../../public/games/bao-ve-co-the-camera-key.html?raw'
import cameraKeyAngryBirdHtml from '../../public/games/bao-ve-co-the-camera-key-2angrybird.html?raw'
import journeyHtml from '../../public/games/hanh-trinh-bao-ve-co-the.html?raw'
import humanCameraAngryBirdHtml from '../../public/games/human-camera-key-1angrybird.html?raw'

const GAMES = {
  auto: {
    html: autoHtml,
    title: 'Bảo Vệ Cơ Thể – Chế Độ Tự Động (React)',
  },
  'camera-key': {
    html: cameraKeyHtml,
    title: 'Bảo Vệ Cơ Thể – Camera Cử Chỉ (React)',
  },
  'camera-key-2angrybird': {
    html: cameraKeyAngryBirdHtml,
    title: 'Bảo Vệ Cơ Thể – 2 Người Chơi Camera (React)',
  },
  'hanh-trinh': {
    html: journeyHtml,
    title: 'Bảo Vệ Cơ Thể – Hành Trình (React)',
  },
  'human-camera-key-1angrybird': {
    html: humanCameraAngryBirdHtml,
    title: 'Bảo Vệ Cơ Thể – Human Angry Bird Camera (React)',
  },
}

const params = new URLSearchParams(window.location.search)
const gameId = params.get('game') || 'auto'
const selectedGame = GAMES[gameId] || GAMES.auto

createRoot(document.getElementById('root')).render(
  <LegacyHtmlGame html={selectedGame.html} title={selectedGame.title} />,
)
