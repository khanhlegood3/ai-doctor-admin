import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../../context/AppContext'
import NavButtons from '../NavButtons.jsx'
import {
  DEFAULT_FAMILY_MEMBERS,
  FAMILY_MEMBERS_CHANGED_EVENT,
  FAMILY_RELATION_META,
  getFamilyOwnerKey,
  loadFamilyMembers,
} from './familyData.js'

const STAGES = [
  { id: 'graph', icon: '🧬', title: 'Graph Building', accent: '#00e5ff' },
  { id: 'environment', icon: '🧑‍⚕️', title: 'Environment Setup', accent: '#9c6fff' },
  { id: 'simulation', icon: '⚡', title: 'Simulation Execution', accent: '#00e676' },
  { id: 'report', icon: '📊', title: 'Report Generation', accent: '#ffb74d' },
  { id: 'interaction', icon: '💬', title: 'Deep Interaction', accent: '#f48fb1' },
]

const RELATION_WEIGHT = {
  self: 1,
  father: 0.9,
  mother: 0.9,
  sibling: 0.74,
  child: 0.72,
  grandparent: 0.58,
  grandchild: 0.5,
  uncle_aunt: 0.46,
  cousin: 0.34,
  spouse: 0.18,
}

const AGENT_TEMPLATES = [
  { id: 'geneticist', name: 'Genetic Counselor Agent', abbr: 'GC', focus: 'heritability + cascade screening', color: '#00e5ff' },
  { id: 'oncologist', name: 'Oncology Risk Agent', abbr: 'ONC', focus: 'cancer clustering + red flags', color: '#ff5252' },
  { id: 'hepatology', name: 'Hepatology Agent', abbr: 'HEP', focus: 'HBV / HCC familial exposure', color: '#ffb74d' },
  { id: 'cardiometabolic', name: 'Cardiometabolic Agent', abbr: 'CM', focus: 'hypertension / diabetes trajectory', color: '#00e676' },
  { id: 'report', name: 'ReportAgent', abbr: 'RPT', focus: 'predictive summary + questions', color: '#9c6fff' },
]

const hasMeaningfulCondition = condition => !/^(khỏe mạnh|healthy)$/i.test(condition)

function normalizeCondition(condition) {
  return condition
    .toLowerCase()
    .replace(/nsclc|lung cancer|ung thư phổi/g, 'lung-oncology')
    .replace(/hcc|ung thư gan|liver cancer|xơ gan|cirrhosis|viêm gan b|hbv/g, 'hepatic')
    .replace(/tăng huyết áp|hypertension|tim mạch|heart disease|đột quỵ|stroke/g, 'cardiovascular')
    .replace(/tiểu đường|diabetes/g, 'metabolic')
    .replace(/ung thư vú|breast cancer|ung thư đại tràng|colon cancer|ung thư dạ dày|stomach cancer|ung thư|cancer/g, 'oncology')
}

function conditionCategory(condition) {
  const normalized = normalizeCondition(condition)
  if (normalized.includes('lung-oncology')) return { key: 'lung-oncology', label: 'Lung oncology', color: '#ff5252', base: 28 }
  if (normalized.includes('hepatic')) return { key: 'hepatic', label: 'Hepatic / HBV-HCC', color: '#ffb74d', base: 24 }
  if (normalized.includes('cardiovascular')) return { key: 'cardiovascular', label: 'Cardiovascular', color: '#ffd54f', base: 18 }
  if (normalized.includes('metabolic')) return { key: 'metabolic', label: 'Metabolic', color: '#00e676', base: 16 }
  if (normalized.includes('oncology')) return { key: 'oncology', label: 'Other oncology', color: '#f48fb1', base: 22 }
  return { key: normalized.slice(0, 24) || 'other', label: condition, color: '#80cbc4', base: 10 }
}

function buildSimulation(members) {
  const activeMembers = members.filter(member => member.conditions?.some(hasMeaningfulCondition))
  const entities = members.map(member => ({
    id: member.id,
    name: member.name,
    relation: member.relation,
    age: member.age,
    alive: member.alive !== false,
    conditions: member.conditions || [],
    row: FAMILY_RELATION_META[member.relation]?.row || 3,
  }))

  const conditionMap = new Map()
  const edges = []

  activeMembers.forEach(member => {
    member.conditions.filter(hasMeaningfulCondition).forEach(condition => {
      const category = conditionCategory(condition)
      const prev = conditionMap.get(category.key) || { ...category, count: 0, weighted: 0, members: [], raw: [] }
      const relationWeight = RELATION_WEIGHT[member.relation] || 0.3
      const mortalityBoost = member.alive === false ? 1.14 : 1
      const ageBoost = member.age >= 65 ? 1.08 : member.age <= 35 ? 0.9 : 1
      prev.count += 1
      prev.weighted += category.base * relationWeight * mortalityBoost * ageBoost
      prev.members.push(member.name)
      prev.raw.push(condition)
      conditionMap.set(category.key, prev)

      if (member.relation !== 'self') {
        edges.push({
          from: member.id,
          to: 'fm-3',
          label: category.label,
          strength: Math.round(relationWeight * 100),
          color: category.color,
        })
      }
    })
  })

  const riskClusters = Array.from(conditionMap.values())
    .map(cluster => ({
      ...cluster,
      score: Math.min(98, Math.round(cluster.weighted + (cluster.count > 1 ? cluster.count * 8 : 0))),
      confidence: Math.min(96, Math.round(58 + cluster.count * 9 + cluster.members.length * 2)),
      members: Array.from(new Set(cluster.members)),
      raw: Array.from(new Set(cluster.raw)),
    }))
    .sort((a, b) => b.score - a.score)

  const interactions = riskClusters.flatMap((cluster, index) => [
    {
      agent: AGENT_TEMPLATES[index % AGENT_TEMPLATES.length].abbr,
      text: `${cluster.label}: ${cluster.members.length} related node(s), score ${cluster.score}/100`,
      color: cluster.color,
    },
    {
      agent: 'RPT',
      text: `Temporal memory update: ${cluster.raw.slice(0, 2).join(' + ')} co-occurs across ${cluster.members.join(', ')}`,
      color: '#9c6fff',
    },
  ]).slice(0, 8)

  const topCluster = riskClusters[0]
  const report = topCluster
    ? `Predictive signal strongest for ${topCluster.label}. Prioritize structured family-history verification, targeted screening, and follow-up questions for ${topCluster.members.slice(0, 3).join(', ')}.`
    : 'No inherited disease signal was detected from the current family tree. Add family members or diagnoses to run a richer simulation.'

  return { entities, edges, riskClusters, interactions, report, activeMembers }
}

function StageCard({ stage, index, active, complete, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minWidth: 160,
        flex: 1,
        padding: 14,
        borderRadius: 14,
        textAlign: 'left',
        cursor: 'pointer',
        background: active ? `${stage.accent}18` : 'var(--surface, rgba(255,255,255,0.03))',
        border: `1px solid ${active ? stage.accent : complete ? `${stage.accent}70` : 'var(--border, rgba(255,255,255,0.08))'}`,
        color: 'var(--text, #e8f0f8)',
        fontFamily: 'inherit',
        transition: 'all .18s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 20 }}>{stage.icon}</span>
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: stage.accent }}>0{index + 1}</span>
      </div>
      <div style={{ marginTop: 10, fontWeight: 800, fontSize: 13 }}>{stage.title}</div>
      <div style={{ marginTop: 7, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: complete ? '100%' : active ? '68%' : '18%', height: '100%', background: stage.accent, borderRadius: 99 }} />
      </div>
    </button>
  )
}

function SectionTitle({ children, kicker }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {kicker && <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--text3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>{kicker}</div>}
      <h3 style={{ margin: 0, fontSize: 18, color: 'var(--text)' }}>{children}</h3>
    </div>
  )
}

function RiskBar({ cluster }) {
  return (
    <div style={{ padding: 14, borderRadius: 13, border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, color: cluster.color }}>{cluster.label}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>{cluster.members.join(' · ')}</div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: cluster.color, fontFamily: 'var(--font-mono)' }}>{cluster.score}</div>
      </div>
      <div style={{ marginTop: 12, height: 9, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${cluster.score}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${cluster.color}, #ffffff66)` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, color: 'var(--text3)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
        <span>{cluster.count} evidence node(s)</span>
        <span>{cluster.confidence}% confidence</span>
      </div>
    </div>
  )
}

export default function FamilyRelationInferencePanel({ patientId = 'LXK-2024', storageOwnerId = 'guest', onNext, nextLabel, onPrev, prevLabel, embedded = false, title = null }) {
  const { theme, lang } = useApp()
  const isDark = theme === 'dark'
  const [activeStage, setActiveStage] = useState(0)
  const [selectedAgent, setSelectedAgent] = useState('report')
  const [question, setQuestion] = useState('Which family branch creates the strongest predictive signal?')

  const [members, setMembers] = useState(() => loadFamilyMembers(patientId, storageOwnerId) || DEFAULT_FAMILY_MEMBERS)

  useEffect(() => {
    const refreshMembers = () => setMembers(loadFamilyMembers(patientId, storageOwnerId) || DEFAULT_FAMILY_MEMBERS)
    const handleFamilyChange = event => {
      const detail = event.detail || {}
      if (detail.patientId && detail.patientId !== patientId) return
      if (detail.ownerId && detail.ownerId !== getFamilyOwnerKey(storageOwnerId)) return
      refreshMembers()
    }

    refreshMembers()
    window.addEventListener(FAMILY_MEMBERS_CHANGED_EVENT, handleFamilyChange)
    window.addEventListener('storage', refreshMembers)
    return () => {
      window.removeEventListener(FAMILY_MEMBERS_CHANGED_EVENT, handleFamilyChange)
      window.removeEventListener('storage', refreshMembers)
    }
  }, [patientId, storageOwnerId])

  const simulation = useMemo(() => buildSimulation(members), [members])
  const activeAgent = AGENT_TEMPLATES.find(agent => agent.id === selectedAgent) || AGENT_TEMPLATES.at(-1)
  const topCluster = simulation.riskClusters[0]

  const c = isDark ? {
    bg: '#04060f', panel: 'rgba(255,255,255,0.035)', panel2: 'rgba(255,255,255,0.055)', border: 'rgba(255,255,255,0.08)', text: '#e8f0f8', text2: 'rgba(232,240,248,0.62)', text3: 'rgba(232,240,248,0.34)',
  } : {
    bg: '#f4f7fb', panel: 'rgba(255,255,255,0.92)', panel2: 'rgba(0,0,0,0.035)', border: 'rgba(0,0,0,0.09)', text: '#1a2035', text2: '#556', text3: '#9aa',
  }

  const stageCopy = [
    lang === 'vi'
      ? 'Trích xuất thành viên, bệnh lý, độ gần huyết thống và trạng thái thời gian để dựng Knowledge Graph / GraphRAG mô phỏng theo bộ nhớ ngữ cảnh kiểu Zep.'
      : 'Extract family members, conditions, kinship distance, and temporal state into a Knowledge Graph / GraphRAG memory inspired by Zep-style context graphs.',
    lang === 'vi'
      ? 'Sinh persona agent chuyên khoa và cấu hình môi trường giả lập: nhánh nội/ngoại, bệnh ung thư, gan mật, tim mạch và chuyển hoá.'
      : 'Generate specialist agent personas and environment configuration for paternal/maternal branches, oncology, hepatic, cardiovascular, and metabolic signals.',
    lang === 'vi'
      ? 'Chạy tương tác đa agent song song trên đồ thị gia đình, cập nhật trí nhớ theo thời gian khi các node bệnh lý cùng xuất hiện.'
      : 'Run parallel multi-agent interaction on the family graph, updating temporal memory when disease nodes co-occur.',
    lang === 'vi'
      ? 'ReportAgent tổng hợp log mô phỏng thành dự báo nguy cơ, mức tin cậy và khuyến nghị xác minh tiền sử.'
      : 'ReportAgent transforms simulation logs into predictive risk, confidence, and family-history verification recommendations.',
    lang === 'vi'
      ? 'Người dùng có thể chat giả lập với từng agent hoặc ReportAgent để đào sâu câu hỏi lâm sàng cụ thể.'
      : 'Users can simulate a chat with any specialist agent or ReportAgent to explore clinical nuances.',
  ]

  const answer = topCluster
    ? `${activeAgent.name}: ${question} → ${topCluster.label} is currently the strongest graph signal (${topCluster.score}/100) because ${topCluster.members.join(', ')} share related evidence. Next step: validate diagnosis age, exposure history, and screening status.`
    : `${activeAgent.name}: Add more family disease history in Family Medical Tree to generate a meaningful relationship simulation.`

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100%', background: embedded ? 'transparent' : c.bg, color: c.text, padding: embedded ? 0 : 24, '--surface': c.panel, '--surface2': c.panel2, '--border': c.border, '--text': c.text, '--text2': c.text2, '--text3': c.text3 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, .7fr)', gap: 18, alignItems: 'stretch' }}>
          <div style={{ padding: 22, borderRadius: 22, border: `1px solid ${c.border}`, background: `linear-gradient(135deg, ${c.panel}, rgba(0,229,255,0.08))`, overflow: 'hidden', position: 'relative' }}>
            <div style={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', right: -80, top: -100, background: 'radial-gradient(circle, rgba(0,229,255,0.22), transparent 65%)' }} />
            <div style={{ fontSize: 10, color: '#00e5ff', fontFamily: 'var(--font-mono)', letterSpacing: '.16em', textTransform: 'uppercase', marginBottom: 10 }}>GraphRAG · Zep-style memory · MiroFish lifecycle</div>
            <h1 style={{ margin: 0, fontSize: 34, lineHeight: 1.05, letterSpacing: '-.04em' }}>{title || 'Family Relationship Inference'}</h1>
            <p style={{ margin: '14px 0 0', maxWidth: 780, color: c.text2, lineHeight: 1.7, fontSize: 14 }}>
              {lang === 'vi'
                ? 'Trang giả lập các mối quan hệ tiền sử bệnh án gia đình đã input tại Family Medical Tree. Hệ thống biến dữ liệu thân nhân thành graph y khoa, sinh AI agents chuyên khoa và tạo báo cáo dự đoán theo vòng đời 5 giai đoạn.'
                : 'Simulates the family medical-history relationships entered in Family Medical Tree. The page converts relatives into a medical graph, generates specialist AI agents, and creates a predictive report through the five-stage lifecycle.'}
            </p>
          </div>

          <div style={{ padding: 20, borderRadius: 22, border: `1px solid ${c.border}`, background: c.panel }}>
            <SectionTitle kicker="Simulation state">Input from Family Medical Tree</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <Stat value={members.length} label="members" color="#00e5ff" />
              <Stat value={simulation.activeMembers.length} label="disease nodes" color="#ffb74d" />
              <Stat value={simulation.edges.length} label="risk edges" color="#9c6fff" />
            </div>
            <div style={{ marginTop: 16, padding: 13, borderRadius: 14, background: c.panel2, border: `1px solid ${c.border}`, color: c.text2, fontSize: 12, lineHeight: 1.55 }}>
              {simulation.report}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 18, overflowX: 'auto', paddingBottom: 4 }}>
          {STAGES.map((stage, index) => (
            <StageCard key={stage.id} stage={stage} index={index} active={activeStage === index} complete={activeStage > index} onClick={() => setActiveStage(index)} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, .95fr) minmax(0, 1.05fr)', gap: 18, marginTop: 18 }}>
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 18, background: c.panel, padding: 18 }}>
            <SectionTitle kicker={STAGES[activeStage].title}>Lifecycle output</SectionTitle>
            <p style={{ margin: '0 0 16px', color: c.text2, lineHeight: 1.65, fontSize: 13 }}>{stageCopy[activeStage]}</p>
            {activeStage === 0 && <GraphView entities={simulation.entities} edges={simulation.edges} c={c} />}
            {activeStage === 1 && <AgentGrid agents={AGENT_TEMPLATES} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} />}
            {activeStage === 2 && <InteractionLog interactions={simulation.interactions} c={c} />}
            {activeStage === 3 && <ReportPanel riskClusters={simulation.riskClusters} report={simulation.report} />}
            {activeStage === 4 && <DeepInteraction agents={AGENT_TEMPLATES} selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent} question={question} setQuestion={setQuestion} answer={answer} c={c} />}
          </div>

          <div style={{ border: `1px solid ${c.border}`, borderRadius: 18, background: c.panel, padding: 18 }}>
            <SectionTitle kicker="Predictive clusters">Family relationship inference</SectionTitle>
            <div style={{ display: 'grid', gap: 12 }}>
              {simulation.riskClusters.length ? simulation.riskClusters.map(cluster => <RiskBar key={cluster.key} cluster={cluster} />) : (
                <div style={{ padding: 28, textAlign: 'center', color: c.text3, border: `1px dashed ${c.border}`, borderRadius: 14 }}>No disease relationship signals yet.</div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginTop: 18 }}>
          {AGENT_TEMPLATES.map(agent => (
            <button key={agent.id} type="button" onClick={() => { setSelectedAgent(agent.id); setActiveStage(4) }} style={{ cursor: 'pointer', textAlign: 'left', border: `1px solid ${selectedAgent === agent.id ? agent.color : c.border}`, borderRadius: 16, background: selectedAgent === agent.id ? `${agent.color}14` : c.panel, padding: 14, color: c.text, fontFamily: 'inherit' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: `${agent.color}20`, color: agent.color, fontWeight: 900, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{agent.abbr}</div>
              <div style={{ marginTop: 10, fontWeight: 800, fontSize: 12 }}>{agent.name}</div>
              <div style={{ marginTop: 5, color: c.text3, fontSize: 10 }}>{agent.focus}</div>
            </button>
          ))}
        </div>

        {!embedded && <NavButtons onNext={onNext} nextLabel={nextLabel || (lang === 'vi' ? 'Hồ sơ Siêu Anh Hùng' : 'Patient Record')} onPrev={onPrev} prevLabel={prevLabel} style={{ marginTop: 22 }} />}
      </div>
    </div>
  )
}

function Stat({ value, label, color }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: `${color}12`, border: `1px solid ${color}32` }}>
      <div style={{ color, fontSize: 24, fontWeight: 900, fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }}>{label}</div>
    </div>
  )
}

function GraphView({ entities, edges, c }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {entities.slice(0, 12).map(entity => {
          const meta = FAMILY_RELATION_META[entity.relation]
          return (
            <div key={entity.id} style={{ padding: '9px 11px', borderRadius: 999, background: `${meta?.color || '#00e5ff'}18`, border: `1px solid ${meta?.color || '#00e5ff'}45`, color: c.text, fontSize: 11 }}>
              <span style={{ color: meta?.color || '#00e5ff', fontWeight: 800 }}>{entity.name}</span> · {meta?.label?.vi || entity.relation}
            </div>
          )
        })}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        {edges.slice(0, 6).map((edge, index) => (
          <div key={`${edge.from}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 10, alignItems: 'center', color: c.text2, fontSize: 11 }}>
            <span>{entities.find(e => e.id === edge.from)?.name}</span>
            <span style={{ color: edge.color, fontFamily: 'var(--font-mono)' }}>─ {edge.label} / {edge.strength}% →</span>
            <span>Patient</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AgentGrid({ agents, selectedAgent, setSelectedAgent }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {agents.map(agent => (
        <button key={agent.id} type="button" onClick={() => setSelectedAgent(agent.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, border: `1px solid ${selectedAgent === agent.id ? agent.color : 'var(--border)'}`, background: selectedAgent === agent.id ? `${agent.color}14` : 'var(--surface2)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: `${agent.color}20`, color: agent.color, display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 11 }}>{agent.abbr}</span>
          <span><strong>{agent.name}</strong><br /><small style={{ color: 'var(--text3)' }}>{agent.focus}</small></span>
        </button>
      ))}
    </div>
  )
}

function InteractionLog({ interactions, c }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {interactions.map((item, index) => (
        <div key={index} style={{ padding: 12, borderRadius: 12, border: `1px solid ${c.border}`, background: c.panel2 }}>
          <span style={{ color: item.color, fontWeight: 900, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{item.agent}</span>
          <span style={{ color: c.text2, marginLeft: 8, fontSize: 12 }}>{item.text}</span>
        </div>
      ))}
    </div>
  )
}

function ReportPanel({ riskClusters, report }) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ padding: 14, borderRadius: 14, background: 'rgba(156,111,255,.12)', border: '1px solid rgba(156,111,255,.28)', color: 'var(--text2)', lineHeight: 1.65, fontSize: 13 }}>{report}</div>
      {riskClusters.slice(0, 3).map((cluster, index) => (
        <div key={cluster.key} style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'var(--text2)', fontSize: 12 }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: `${cluster.color}20`, color: cluster.color, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{index + 1}</span>
          <span><strong style={{ color: cluster.color }}>{cluster.label}</strong> · verify {cluster.raw.slice(0, 2).join(', ')}</span>
        </div>
      ))}
    </div>
  )
}

function DeepInteraction({ agents, selectedAgent, setSelectedAgent, question, setQuestion, answer, c }) {
  return (
    <div>
      <select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${c.border}`, background: c.panel2, color: c.text, marginBottom: 10 }}>
        {agents.map(agent => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
      </select>
      <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: 12, border: `1px solid ${c.border}`, background: c.panel2, color: c.text, resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: `1px solid ${c.border}`, background: 'rgba(0,229,255,.08)', color: c.text2, lineHeight: 1.65, fontSize: 13 }}>{answer}</div>
    </div>
  )
}
