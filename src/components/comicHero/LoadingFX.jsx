// src/components/comicHero/LoadingFX.jsx
// Chuyển đổi từ infinite-heroes/LoadingFX.tsx (bỏ kiểu TypeScript).
import React, { useState, useEffect } from 'react'

const LOADING_FX = ['POW!', 'BAM!', 'ZAP!', 'KRAK!', 'SKREEE!', 'WHOOSH!', 'THWIP!', 'BOOM!']

export const LoadingFX = () => {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    const interval = setInterval(() => {
      const id = Date.now() + Math.random()
      const text = LOADING_FX[Math.floor(Math.random() * LOADING_FX.length)]
      const x = `${20 + Math.random() * 60}%`
      const y = `${20 + Math.random() * 60}%`
      const rot = Math.random() * 60 - 30
      const colors = ['text-yellow-400', 'text-red-500', 'text-blue-400', 'text-orange-500', 'text-purple-500']
      const color = colors[Math.floor(Math.random() * colors.length)]
      setParticles((prev) => [...prev, { id, text, x, y, rot, color }].slice(-4))
    }, 600)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="w-full h-full bg-white overflow-hidden relative border-r-4 border-gray-300">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-100 to-white opacity-50" />
      {particles.map((p) => (
        <div
          key={p.id}
          className={`absolute font-comic text-5xl md:text-7xl font-bold ${p.color} select-none whitespace-nowrap z-10`}
          style={{
            left: p.x,
            top: p.y,
            '--rot': `${p.rot}deg`,
            animation: 'comic-hero-pop 1.8s forwards ease-out',
            textShadow: '3px 3px 0px black, 0 0 20px rgba(255,255,255,0.8)',
          }}
        >
          {p.text}
        </div>
      ))}
      <p className="absolute bottom-24 inset-x-0 text-center font-comic text-xl text-gray-400 animate-pulse z-0 tracking-widest">
        INKING PAGE...
      </p>
    </div>
  )
}

export default LoadingFX
