import React, { useState } from 'react'

const navItems = [
  { id: 'dashboard', label: 'Trang chủ', icon: '▦' },
  { id: 'api', label: 'Tài nguyên AI', icon: '◈' },
]

const aiLoad = [12000, 19000, 15000, 17000, 14000, 22000, 15420]
const hours = ['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00']
const stacked = [
  [110, 35, 25], [40, 15, 8], [300, 70, 35], [1500, 400, 220],
  [2000, 600, 300], [1800, 500, 260], [2500, 700, 400], [800, 220, 120],
]

export default function AdminConceptPanel() {
  const [active, setActive] = useState('dashboard')
  const activeLabel = navItems.find(item => item.id === active)?.label

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>AI Doctor</div>
        <div style={styles.navWrap}>
          {navItems.map(item => (
            <button key={item.id} type="button" onClick={() => setActive(item.id)} style={{ ...styles.navItem, ...(active === item.id ? styles.navActive : {}) }}>
              <span style={styles.navIcon}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </aside>
      <section style={{ ...styles.content, ...(active === 'journey' ? styles.journeyBg : {}) }}>
        <div style={styles.topMeta}>
          <span>{activeLabel}</span>
          <span style={styles.statusPill}>{active === 'api' ? 'Giám sát quota realtime' : 'Hệ thống bình thường'}</span>
        </div>
        {active === 'dashboard' && <DashboardView />}
        {active === 'api' && <ApiMonitorView />}
      </section>
    </div>
  )
}

function DashboardView() {
  return <>
    <h1 style={styles.h1}>Tổng quan hệ thống</h1>
    <div style={styles.cardGrid3}>
      <Metric title="Siêu anh hùng khám hôm nay" value="142" trend="↑ 12% so với hôm qua" color="#10b981" />
      <Metric title="Tổng lượt gọi AI (24h)" value="15,420" trend="↓ 2% so với hôm qua" color="#4f46e5" warn />
      <Metric title="Nhiệm vụ Hành trình hoàn thành" value="890" trend="↑ 5% so với tuần trước" color="#059669" />
    </div>
    <div style={styles.twoCol}>
      <Card title="Tải lượng AI (7 ngày qua)"><LineChart values={aiLoad} labels={['T2','T3','T4','T5','T6','T7','CN']} color="#4f46e5" /></Card>
      <Card title="Tin tức & Cập nhật">
        {['10/07/2026|Tích hợp thành công Wan Image-to-Video API.', '09/07/2026|Nâng cấp thuật toán Consensus Engine v3.', '08/07/2026|Bảo trì máy chủ cơ sở dữ liệu InBody.'].map(item => { const [d, t] = item.split('|'); return <div key={item} style={styles.news}><small>{d}</small><b>{t}</b></div> })}
      </Card>
    </div>
  </>
}

export function HeroView({ userName = 'Nguyễn Văn A', userAvatar = '', userMeta = 'ID: HERO-2026-9042 · Nam · 34 tuổi' } = {}) {
  const initials = String(userName || 'Hero').trim().split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'SH'
  return <>
    <header style={styles.patientHeader}><div style={styles.avatar}>{userAvatar ? <img src={userAvatar} alt={userName} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : initials}</div><div><h1 style={styles.h1}>{userName}</h1><p style={styles.muted}>{userMeta}</p></div></header>
    <div style={styles.twoCol}>
      <Card title="⚡ Phản ngẫm Tóm tắt (AI Reflection)" accent>
        <p>Trong 30 ngày qua, siêu anh hùng đã có <b>4 buổi tư vấn</b> với AI Coach, chủ yếu tập trung vào vấn đề <i>giảm mỡ nội tạng</i> và <i>cải thiện giấc ngủ</i>.</p>
        <p><b>Điểm sáng:</b> Siêu anh hùng tuân thủ rất tốt lịch uống nước (hoàn thành 28/30 ngày) và đã cập nhật 2 kết quả đo InBody cho thấy xu hướng tích cực.</p>
        <p><b>Khuyến nghị cho bác sĩ:</b> Trong lần khám tới, hãy kiểm tra lại chỉ số huyết áp do siêu anh hùng từng đề cập đến việc thỉnh thoảng chóng mặt vào buổi sáng trong chat history ngày 12/06.</p>
      </Card>
      <Card title="Tiến triển Chỉ số InBody"><RadarChart /></Card>
    </div>
  </>
}

export function JourneyView() {
  return <>
    <div style={styles.gameHero}><div><h1 style={{...styles.h1, color:'#26e0c6'}}>Hành trình Khỏe mạnh</h1><p style={styles.muted}>Level 12 · Chiến binh Dinh dưỡng</p></div><div style={styles.expBox}><b>ĐIỂM EXP<br/><span>4,250</span></b><b>🔥 CHUỖI<br/><span>14 Ngày</span></b></div></div>
    <Card title="Nhiệm vụ hằng ngày"><Quest done title="Uống 2 lít nước" meta="Tiến độ: 2000/2000 ml" reward="+50 EXP" /><Quest title="Đi bộ 5000 bước" meta="Tiến độ: 3000/5000 bước" reward="+100 EXP" progress={60} /></Card>
    <h2 style={{color:'#fff'}}>Bộ sưu tập Huy hiệu</h2><div style={styles.badges}>{['💧|Vua Giải Khát', '🏃‍♀️|Chân Chạy Gió', '🥦|Thánh Ăn Xanh (Khóa)', '🧘|Bậc Thầy Thiền (Khóa)'].map((b,i)=>{const [e,t]=b.split('|');return <div key={b} style={{...styles.badge, opacity: i > 1 ? 0.45 : 1}}><span>{e}</span><b>{t}</b></div>})}</div>
  </>
}

function ApiMonitorView() {
  return <><h1 style={styles.h1}>Quản lý Tài nguyên & API Provider</h1><div style={styles.alert}>⚠️ Cảnh báo: Claude 3.5 Sonnet sắp chạm giới hạn thanh toán tháng (92%). Xem xét switch sang Gemini Pro tạm thời.</div><div style={styles.cardGrid3}><Provider name="Groq (Llama-3)" usage="45,200 / 100,000 req" pct={45} color="#10b981" /><Provider name="Anthropic (Claude)" usage="$460 / $500 limit" pct={92} color="#ef4444" warning /><Provider name="Google (Gemini 1.5)" usage="$120 / $1000 limit" pct={12} color="#3b82f6" /></div><Card title="Tần suất gọi API theo khung giờ (Hôm nay)"><StackedBars /></Card></>
}

function Metric({ title, value, trend, color, warn }) { return <div style={styles.card}><p style={styles.muted}>{title}</p><strong style={{fontSize:36, color}}>{value}</strong><p style={{color: warn ? '#ef4444' : '#22c55e', fontWeight:700}}>{trend}</p></div> }
function Card({ title, children, accent }) { return <div style={{...styles.card, ...(accent ? styles.accentCard : {})}}><h2 style={styles.h2}>{title}</h2>{children}</div> }
function Provider({ name, usage, pct, color, warning }) { return <div style={styles.card}><h2 style={styles.h2}>{name} <span style={{...styles.badgeMini, background: warning?'#fee2e2':'#dcfce7', color: warning?'#dc2626':'#15803d'}}>{warning?'Warning':'Active'}</span></h2><p style={styles.muted}>Usage: {usage}</p><div style={styles.progress}><span style={{width:`${pct}%`, background: color}} /></div></div> }
function Quest({ done, title, meta, reward, progress = 100 }) { return <div style={styles.quest}><span style={done ? styles.check : styles.emptyCircle}>{done?'✓':''}</span><div style={{flex:1}}><b>{title}</b><p style={styles.muted}>{meta}</p>{!done && <div style={styles.progress}><span style={{width:`${progress}%`, background:'#06b6d4'}} /></div>}</div><b style={{color:'#34d399'}}>{reward}</b></div> }

function LineChart({ values, labels, color }) { const max=Math.max(...values), min=Math.min(...values); const pts=values.map((v,i)=>`${(i/(values.length-1))*100},${90-((v-min)/(max-min))*70}`).join(' '); return <svg viewBox="0 0 100 100" style={styles.svg}><polyline fill="none" stroke={color} strokeWidth="2" points={pts}/>{values.map((v,i)=><circle key={i} cx={(i/(values.length-1))*100} cy={90-((v-min)/(max-min))*70} r="1.8" fill="#fff" stroke={color}/>) }{labels.map((l,i)=><text key={l} x={(i/(labels.length-1))*100} y="99" fontSize="4" textAnchor="middle" fill="#6b7280">{l}</text>)}</svg> }
function RadarChart() { const pts='50,18 72,42 70,72 50,95 28,70 30,45'; const old='50,35 82,32 78,70 50,70 36,62 38,52'; return <svg viewBox="0 0 100 100" style={styles.svg}>{[20,35,50].map(r=><polygon key={r} points={`50,${50-r} ${50+r*.86},${50-r/2} ${50+r*.86},${50+r/2} 50,${50+r} ${50-r*.86},${50+r/2} ${50-r*.86},${50-r/2}`} fill="none" stroke="#e5e7eb"/>)}<polygon points={old} fill="rgba(107,114,128,.12)" stroke="#9ca3af" strokeWidth="1.4"/><polygon points={pts} fill="rgba(79,70,229,.18)" stroke="#4f46e5" strokeWidth="1.4"/></svg> }
function StackedBars() { const max=4000; return <div style={styles.barChart}>{stacked.map((v,i)=><div key={hours[i]} style={styles.barCol}><div style={styles.barStack}>{v.map((n,j)=><span key={j} style={{height:`${(n/max)*220}px`, background:['#10b981','#f43f5e','#3b82f6'][j]}} />)}</div><small>{hours[i]}</small></div>)}</div> }

const styles = {
  shell:{display:'flex', minHeight:'calc(100vh - 58px)', fontFamily:'Inter, system-ui, sans-serif', color:'#1f2937'}, sidebar:{width:240, background:'#312e81', color:'#fff', padding:'28px 18px', flexShrink:0}, brand:{fontSize:28, fontWeight:900, marginBottom:34}, navWrap:{display:'grid', gap:10}, navItem:{border:0, borderRadius:8, padding:'14px 16px', color:'#fff', background:'transparent', textAlign:'left', fontSize:18, fontWeight:700, cursor:'pointer', display:'flex', gap:12}, navIcon:{opacity:.8}, navActive:{background:'#4338ca'}, content:{flex:1, padding:36, background:'#f8fafc', overflow:'hidden'}, journeyBg:{background:'#071022', backgroundImage:'linear-gradient(30deg, rgba(255,255,255,.08) 12%, transparent 12.5%, transparent 87%, rgba(255,255,255,.08) 87.5%)', backgroundSize:'64px 64px'}, topMeta:{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, color:'#64748b', fontWeight:800}, statusPill:{background:'#dcfce7', color:'#166534', borderRadius:999, padding:'8px 14px'}, h1:{fontSize:38, margin:'0 0 28px', fontWeight:900}, h2:{fontSize:22, margin:'0 0 22px', fontWeight:900}, muted:{color:'#6b7280', margin:'6px 0'}, cardGrid3:{display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:24, marginBottom:32}, twoCol:{display:'grid', gridTemplateColumns:'2fr 1fr', gap:28}, card:{background:'#fff', border:'1px solid #e5e7eb', borderRadius:16, padding:28, boxShadow:'0 1px 8px rgba(15,23,42,.06)'}, accentCard:{borderLeft:'5px solid #6366f1'}, news:{display:'grid', gap:8, marginBottom:24}, patientHeader:{display:'flex', gap:20, alignItems:'center', marginBottom:28}, avatar:{width:76, height:76, borderRadius:'50%', background:'#4f46e5', display:'grid', placeItems:'center', color:'#050505', fontSize:34}, svg:{width:'100%', height:300}, gameHero:{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:34}, expBox:{display:'flex', gap:22, background:'rgba(30,41,59,.85)', color:'#94a3b8', padding:'18px 24px', borderRadius:16, border:'1px solid rgba(148,163,184,.25)'}, quest:{display:'flex', alignItems:'center', gap:18, color:'#fff', background:'#1e293b', border:'1px solid #475569', borderRadius:14, padding:20, marginTop:16}, check:{width:30, height:30, borderRadius:'50%', display:'grid', placeItems:'center', background:'#10b981', color:'#fff'}, emptyCircle:{width:26, height:26, borderRadius:'50%', border:'3px solid #64748b'}, badges:{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:18}, badge:{background:'rgba(30,41,59,.88)', color:'#fff', minHeight:120, border:'1px solid #334155', borderRadius:16, display:'grid', placeItems:'center', textAlign:'center', fontSize:20}, alert:{background:'#fef2f2', color:'#b91c1c', borderLeft:'5px solid #ef4444', borderRadius:8, padding:22, fontWeight:900, marginBottom:28}, badgeMini:{float:'right', fontSize:14, borderRadius:6, padding:'6px 10px'}, progress:{height:10, background:'#e5e7eb', borderRadius:999, overflow:'hidden'}, barChart:{height:310, display:'flex', alignItems:'end', gap:28, borderBottom:'1px solid #d1d5db', padding:'20px 10px'}, barCol:{display:'grid', justifyItems:'center', gap:8, flex:1}, barStack:{height:230, display:'flex', flexDirection:'column-reverse', justifyContent:'flex-start', width:54},
}
