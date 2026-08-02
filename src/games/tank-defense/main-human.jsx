import React from 'react'
import { createRoot } from 'react-dom/client'
import TankDefenseGame from './TankDefenseGame.jsx'

createRoot(document.getElementById('root')).render(<TankDefenseGame variant="human" />)
