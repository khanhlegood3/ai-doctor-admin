import React, { useEffect, useMemo, useState } from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext.jsx'
import { getGlobalChatHistory } from '../lib/globalChatbotStorage.js'
import { JourneyView, HeroView } from './AdminConceptPanel.jsx'

const RANGE_OPTIONS = [
  { value: 30, vi: '30 ngày qua', en: 'Past 30 days' },
  { value: 90, vi: '3 tháng qua', en: 'Past 3 months' },
  { value: 180, vi: '6 tháng qua', en: 'Past 6 months' },
  { value: 365, vi: '1 năm qua', en: 'Past year' },
]

const SAMPLE_EVENTS = [
  { createdAt: '2026-07-08T08:15:00.000Z', role: 'assistant', content: 'Tư vấn theo dõi huyết áp buổi sáng, nhắc uống nước và ghi nhận giấc ngủ.' },
  { createdAt: '2026-07-06T14:40:00.000Z', role: 'user', content: 'Siêu anh hùng hỏi về chỉ số InBody, cân nặng, cơ xương và kế hoạch vận động nhẹ.' },
  { createdAt: '2026-07-03T21:10:00.000Z', role: 'assistant', content: 'Tóm tắt lịch sử chat, nhắc lịch kiểm tra lại hồ sơ và theo dõi stress.' },
  { createdAt: '2026-06-29T02:30:00.000Z', role: 'assistant', content: 'Phân tích webcam/face mesh, kiểm tra tư thế ngồi và nhắc nghỉ mắt.' },
  { createdAt: '2026-06-22T09:20:00.000Z', role: 'user', content: 'Tra cứu thuốc, triệu chứng đau đầu nhẹ, ăn uống và lịch uống nước.' },
]

function getMessageText(message) {
  if (!message) return ''
  if (typeof message.content === 'string') return message.content
  if (typeof message.text === 'string') return message.text
  if (Array.isArray(message.content)) return message.content.map(part => part?.text || '').join(' ')
  return ''
}

function getMessageDate(message) {
  const raw = message?.createdAt || message?.timestamp || message?.date
  const d = raw ? new Date(raw) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function formatHour(hour) {
  if (hour == null) return '—'
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 || 12
  return `${h} ${suffix}`
}

function buildReflection(messages, daysBack, isVi) {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - daysBack)

  const realMessages = (messages || [])
    .map(message => ({ ...message, _date: getMessageDate(message), _text: getMessageText(message) }))
    .filter(message => message._date && message._date >= start && message._date <= now)

  const sourceMessages = realMessages.length ? realMessages : SAMPLE_EVENTS.map(message => ({ ...message, _date: new Date(message.createdAt), _text: message.content, _sample: true }))
  const byDay = new Map()
  const byHour = new Map()
  const keywordBuckets = [
    { key: 'huyết áp', words: ['huyết áp', 'blood pressure', 'tim mạch'] },
    { key: 'InBody', words: ['inbody', 'cân nặng', 'cơ xương', 'bmi'] },
    { key: 'uống nước', words: ['uống nước', 'nước', 'hydration'] },
    { key: 'stress/giấc ngủ', words: ['stress', 'giấc ngủ', 'ngủ', 'mệt'] },
    { key: 'webcam/face mesh', words: ['webcam', 'face mesh', 'camera', 'tư thế'] },
  ]
  const keywordCounts = Object.fromEntries(keywordBuckets.map(bucket => [bucket.key, 0]))

  for (const message of sourceMessages) {
    const day = message._date.toLocaleDateString('vi-VN', { weekday: 'long' })
    const hour = message._date.getHours()
    byDay.set(day, (byDay.get(day) || 0) + 1)
    byHour.set(hour, (byHour.get(hour) || 0) + 1)
    const text = message._text.toLowerCase()
    keywordBuckets.forEach(bucket => {
      if (bucket.words.some(word => text.includes(word))) keywordCounts[bucket.key] += 1
    })
  }

  const topDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
  const peakHour = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const topics = Object.entries(keywordCounts).filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const totalConsultations = Math.max(1, Math.ceil(sourceMessages.length / 2))
  const totalDays = new Set(sourceMessages.map(message => message._date.toISOString().slice(0, 10))).size
  const peakTopic = topics[0]?.[0] || (isVi ? 'theo dõi sức khỏe tổng quát' : 'general health tracking')

  const chart = Array.from({ length: 14 }, (_, index) => {
    const d = new Date(now)
    d.setDate(now.getDate() - (13 - index))
    const key = d.toISOString().slice(0, 10)
    const count = sourceMessages.filter(message => message._date.toISOString().slice(0, 10) === key).length
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: count }
  })

  const title = isVi
    ? `${totalConsultations} phiên tư vấn, trọng tâm là ${peakTopic}.`
    : `${totalConsultations} consultations, mostly focused on ${peakTopic}.`
  const paragraph = isVi
    ? `Trong ${daysBack} ngày qua, AI Doctor ghi nhận ${sourceMessages.length} lượt trao đổi trên ${totalDays} ngày hoạt động. Nội dung nổi bật xoay quanh ${topics.map(([topic]) => topic).join(', ') || 'hồ sơ siêu anh hùng'}, kết hợp nhắc lịch theo dõi, đọc lại lịch sử chat và chuẩn bị dữ liệu cho bác sĩ trước buổi khám tiếp theo.${realMessages.length ? '' : ' Đây là dữ liệu minh họa vì tài khoản hiện chưa có đủ lịch sử chat trong khoảng đã chọn.'}`
    : `Over the last ${daysBack} days, AI Doctor found ${sourceMessages.length} exchanges across ${totalDays} active days. The most visible themes were ${topics.map(([topic]) => topic).join(', ') || 'hero records'}, combining follow-up reminders, chat-history review, and doctor-ready preparation before the next visit.${realMessages.length ? '' : ' Demo data is shown because this account has limited chat history for the selected range.'}`

  return { title, paragraph, topDay, peakHour: formatHour(peakHour), totalConsultations, totalDays, topics, chart, usingSample: !realMessages.length }
}

export default function HeroReflectPanel({ onNext, onPrev, prevLabel, nextLabel }) {
  const { theme, lang } = useApp()
  const { user } = useAuth()
  const isDark = theme === 'dark'
  const isVi = lang !== 'en'
  const [range, setRange] = useState(30)
  const [messages, setMessages] = useState([])

  useEffect(() => {
    let cancelled = false
    getGlobalChatHistory(user?.uuid).then(history => { if (!cancelled) setMessages(history) })
    return () => { cancelled = true }
  }, [user?.uuid])

  const reflection = useMemo(() => buildReflection(messages, range, isVi), [messages, range, isVi])
  const text = isDark ? '#f8fafc' : '#102033'
  const muted = isDark ? 'rgba(226,232,240,0.68)' : '#64748b'
  const border = isDark ? 'rgba(148,163,184,0.22)' : 'rgba(15,76,129,0.14)'
  const card = isDark ? 'rgba(15,23,42,0.94)' : '#fff'
  const maxValue = Math.max(1, ...reflection.chart.map(point => point.value))

  return (
    <div style={{ minHeight: '100%', background: isDark ? '#050914' : '#f3f9ff', padding: '22px clamp(14px, 3vw, 30px) 38px' }}>
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <section style={{ border: `1px solid ${border}`, borderRadius: 30, padding: 24, background: card, boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.38)' : '0 24px 70px rgba(14,165,233,0.13)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.6, color: '#0ea5e9' }}>AI DOCTOR · REFLECT</div>
              <h2 style={{ margin: '8px 0 8px', color: text, fontSize: 30 }}>{isVi ? '🪞 Hero Reflection / Phản chiếu Siêu Anh Hùng' : '🪞 Hero Reflection / Phản chiếu Siêu Anh Hùng'}</h2>
              <p style={{ margin: 0, color: muted, lineHeight: 1.6 }}>{isVi ? 'Tóm tắt lịch sử chat, hồ sơ và nhịp sử dụng thành báo cáo nhanh cho bác sĩ.' : 'Summarize chat history, records, and usage rhythm into a doctor-ready report.'}</p>
            </div>
            <select value={range} onChange={e => setRange(Number(e.target.value))} style={{ border: `1px solid ${border}`, borderRadius: 14, padding: '10px 12px', color: text, background: isDark ? '#111827' : '#f8fafc', fontWeight: 800 }}>
              {RANGE_OPTIONS.map(option => <option key={option.value} value={option.value}>{isVi ? option.vi : option.en}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 24, maxWidth: 820 }}>
            <h1 style={{ margin: '0 0 14px', color: text, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.08 }}>{reflection.title}</h1>
            <p style={{ margin: 0, color: muted, fontSize: 16, lineHeight: 1.75 }}>{reflection.paragraph}</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, marginTop: 28 }}>
            <Metric label={isVi ? 'Ngày hoạt động nhất' : 'Most active day'} value={reflection.topDay} muted={muted} text={text} />
            <Metric label={isVi ? 'Giờ cao điểm' : 'Peak hour'} value={reflection.peakHour} muted={muted} text={text} />
            <Metric label={isVi ? 'Tổng tư vấn' : 'Total consultations'} value={reflection.totalConsultations} muted={muted} text={text} />
          </div>

          <div style={{ marginTop: 28, borderTop: `1px solid ${border}`, paddingTop: 20 }}>
            <div style={{ color: muted, fontSize: 12, fontWeight: 900, letterSpacing: 1.3, textTransform: 'uppercase' }}>{isVi ? 'Hoạt động 14 ngày gần nhất' : 'Last 14 days activity'}</div>
            <div style={{ height: 180, display: 'flex', alignItems: 'end', gap: 10, paddingTop: 18 }}>
              {reflection.chart.map(point => (
                <div key={point.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div title={`${point.label}: ${point.value}`} style={{ width: '100%', minHeight: 4, height: `${Math.max(4, (point.value / maxValue) * 130)}px`, borderRadius: '12px 12px 4px 4px', background: point.value ? 'linear-gradient(180deg, #38bdf8, #f97316)' : (isDark ? 'rgba(148,163,184,0.14)' : '#e2e8f0') }} />
                  <span style={{ fontSize: 10, color: muted }}>{point.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
            {reflection.topics.map(([topic, count]) => <span key={topic} style={{ border: `1px solid ${border}`, borderRadius: 999, padding: '8px 11px', color: text, background: isDark ? 'rgba(14,165,233,0.10)' : '#ecfeff', fontSize: 12, fontWeight: 800 }}>#{topic} · {count}</span>)}
            {reflection.usingSample && <span style={{ border: '1px solid rgba(249,115,22,0.35)', borderRadius: 999, padding: '8px 11px', color: '#f97316', background: 'rgba(249,115,22,0.08)', fontSize: 12, fontWeight: 900 }}>{isVi ? 'Đang dùng dữ liệu demo' : 'Demo data'}</span>}
          </div>
        </section>

        <section style={{ marginTop: 24, border: `1px solid ${border}`, borderRadius: 30, padding: 24, background: card, boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.32)' : '0 24px 70px rgba(14,165,233,0.10)' }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.6, color: '#0ea5e9', marginBottom: 16 }}>{isVi ? 'AI DOCTOR ADMIN · SIÊU ANH HÙNG' : 'AI DOCTOR ADMIN · HERO'}</div>
          <div style={{ color: '#1f2937' }}>
            <HeroView userName={user?.name || (isVi ? 'Siêu Anh Hùng' : 'Hero')} userAvatar={user?.avatar || ''} userMeta={`UUID: ${user?.uuid || 'guest'} · ${isVi ? 'đồng bộ từ Hồ sơ cá nhân' : 'synced from User Profile'}`} />
          </div>
        </section>

        <section style={{ marginTop: 24, border: `1px solid ${border}`, borderRadius: 30, padding: 24, background: '#071022', backgroundImage: 'linear-gradient(30deg, rgba(255,255,255,.08) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,.08) 87.5%)', backgroundSize: '64px 64px', boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.32)' : '0 24px 70px rgba(14,165,233,0.10)' }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.6, color: '#26e0c6', marginBottom: 16 }}>{isVi ? 'AI DOCTOR ADMIN · HÀNH TRÌNH' : 'AI DOCTOR ADMIN · JOURNEY'}</div>
          <JourneyView />
        </section>

        <NavButtons onPrev={onPrev} prevLabel={prevLabel} onNext={onNext} nextLabel={nextLabel} />
      </div>
    </div>
  )
}

function Metric({ label, value, muted, text }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ color: text, fontSize: 28, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ color: muted, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 900 }}>{label}</div>
    </div>
  )
}
