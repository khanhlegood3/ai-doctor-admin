import React from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { getLandingT } from './i18n/zofoLandingI18n.js'
import ZofoTokenBanner from './components/ZofoTokenBanner.jsx'
import AikolNetworkReport from './components/AikolNetworkReport.jsx'
const lang = new URLSearchParams(location.search).get('lang') || 'vi'
const t = getLandingT(lang)
createRoot(document.getElementById('root')).render(<div className="dark"><style>{`.zofo-shadow-soft{box-shadow:0 10px 40px -10px rgba(0,0,0,.4)}.zofo-gradient-brand{background:linear-gradient(135deg,#FF543C,#8B4DFF)}`}</style><div style={{background:'#0B132B'}}><ZofoTokenBanner t={t} /><AikolNetworkReport t={t} language={lang} isDark={true} /></div></div>)
