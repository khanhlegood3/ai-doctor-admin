import React, { useState, useCallback, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import NavButtons from '../NavButtons.jsx'
import { useMedicalData } from '../../hooks/useMedicalData.js'

import { CONDITION_COLORS, DEFAULT_FAMILY_MEMBERS, LXK_PATIENT_PROFILE, RELATIONS, RELATION_META, buildFamilyMemberPatientRecord, isNonDiseaseCondition, loadFamilyMembers, saveFamilyMembers, stripMissingNamePrefix } from './familyData.js'

// Backward-compatible exports for panels that import shared family data through this component.
export { DEFAULT_FAMILY_MEMBERS, loadFamilyMembers } from './familyData.js'
export const FAMILY_RELATION_META = RELATION_META


const formatDob = (dob) => {
  if (!dob || typeof dob !== 'string') return ''
  const [year, month, day] = dob.split('-')
  return year && month && day ? `${day}/${month}/${year}` : dob
}

// ─── Build patient record for Patient Record Visualizer ───────────────────
const buildMemberRecord = buildFamilyMemberPatientRecord

// ─── Empty form state ──────────────────────────────────────────────────────
const EMPTY_FORM = { name:'', age:'', gender:'M', relation:'child', dob:'', blood_type:'', conditions:'', symptoms:'', labs:'', imaging:'', medications:'', allergies:'', genomics:'', timeline:'', risk_factors:'', alive:true, note:'' }
const isPrimaryPatientMember = member => member?.relation === 'self' || member?.id === LXK_PATIENT_PROFILE.id
const displayNameFromUser = user => String(user?.name || '').trim()
const avatarFromUser = user => String(user?.avatar || '').trim()
const initialsFromName = name => String(name || '').split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
const syncPrimaryPatientProfile = (members, user) => {
  const patientName = displayNameFromUser(user)
  const patientAvatar = avatarFromUser(user)
  if (!patientName && !patientAvatar) return members
  let changed = false
  const nextMembers = members.map(member => {
    if (!isPrimaryPatientMember(member)) return member

    const nextName = patientName || member.name
    const nextAvatar = patientAvatar || member.avatar_url
    const needsName = member.name !== nextName
    const needsAvatar = nextAvatar && member.avatar_url !== nextAvatar
    const needsRecordName = member.medicalRecord && member.medicalRecord.name !== nextName
    const needsRecordAvatar = member.medicalRecord && nextAvatar && member.medicalRecord.avatar_url !== nextAvatar
    if (!needsName && !needsAvatar && !needsRecordName && !needsRecordAvatar) return member

    changed = true
    return {
      ...member,
      name: nextName,
      ...(nextAvatar ? { avatar_url: nextAvatar } : {}),
      medicalRecord: member.medicalRecord ? {
        ...member.medicalRecord,
        name: nextName,
        avatar_initials: initialsFromName(nextName),
        ...(nextAvatar ? { avatar_url: nextAvatar } : {}),
      } : member.medicalRecord,
    }
  })
  return changed ? nextMembers : members
}
const primaryPatientRecordId = ownerId => `PRIMARY-${String(ownerId || 'guest').trim().replace(/[^a-z0-9]+/gi, '-').toUpperCase() || 'GUEST'}`
const mergeById = (baseItems = [], uploadedItems = []) => {
  const existingIds = new Set(baseItems.map(item => item?.id).filter(Boolean))
  return [...uploadedItems.filter(item => !existingIds.has(item?.id)), ...baseItems]
}
const itemIds = items => (items || []).map(item => item?.id).filter(Boolean).join('|')
const syncUploadedRecordsToPrimaryPatient = (members, uploadedPatient, user, ownerId) => {
  if (!uploadedPatient?._fromUpload) return members
  let changed = false
  const nextMembers = members.map(member => {
    if (!isPrimaryPatientMember(member)) return member
    const baseRecord = member.medicalRecord || {}
    const primaryName = displayNameFromUser(user) || member.name || baseRecord.name || 'Patient'
    const primaryAvatar = avatarFromUser(user) || member.avatar_url || baseRecord.avatar_url || ''
    const nextRecord = {
      ...baseRecord,
      id: primaryPatientRecordId(ownerId),
      sourceDemoId: baseRecord.sourceDemoId || uploadedPatient.sourceDemoId,
      familyMemberId: member.id,
      name: primaryName,
      age: member.age || baseRecord.age || uploadedPatient.age || 0,
      gender: member.gender || baseRecord.gender || uploadedPatient.gender || 'M',
      dob: member.dob || baseRecord.dob || uploadedPatient.dob || '—',
      blood_type: member.blood_type || baseRecord.blood_type || uploadedPatient.blood_type || '—',
      avatar_initials: initialsFromName(primaryName),
      ...(primaryAvatar ? { avatar_url: primaryAvatar } : {}),
      imaging: mergeById(baseRecord.imaging, uploadedPatient.imaging),
      labs: mergeById(baseRecord.labs, uploadedPatient.labs),
      timeline: mergeById(baseRecord.timeline, uploadedPatient.timeline),
      _records: uploadedPatient._records || baseRecord._records || [],
      _hasUploadedImaging: !!uploadedPatient._hasUploadedImaging,
      _hasUploadedLabs: !!uploadedPatient._hasUploadedLabs,
      _isPrimaryPatient: true,
      _isDemoTemplate: false,
    }
    const sameUploadState =
      baseRecord.id === nextRecord.id &&
      baseRecord.name === nextRecord.name &&
      itemIds(baseRecord.imaging) === itemIds(nextRecord.imaging) &&
      itemIds(baseRecord.labs) === itemIds(nextRecord.labs) &&
      itemIds(baseRecord.timeline) === itemIds(nextRecord.timeline) &&
      itemIds(baseRecord._records) === itemIds(nextRecord._records)
    if (sameUploadState) return member
    changed = true
    return {
      ...member,
      name: primaryName,
      ...(primaryAvatar ? { avatar_url: primaryAvatar } : {}),
      medicalRecord: nextRecord,
    }
  })
  return changed ? nextMembers : members
}
const splitCommaItems = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean)
const joinMedicalItems = (items, key = 'name') => (
  Array.isArray(items) ? items.map(item => item?.[key] || item?.name || item).filter(Boolean).join(', ') : ''
)
const buildFamilyMedicalRecord = (memberId, form, conditions) => ({
  id: `FM-${memberId}`,
  familyMemberId: memberId,
  name: form.name.trim(),
  age: parseInt(form.age, 10) || 0,
  gender: form.gender,
  dob: form.dob.trim() || '—',
  blood_type: form.blood_type.trim() || '—',
  avatar_initials: form.name.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase(),
  diseases: conditions.filter(condition => !isNonDiseaseCondition(condition)).map((name, i) => ({ id: `fd-${i}`, name, icd10: 'Z00.0', onset: '—', severity: /ung thư|cancer|hcc|nsclc/i.test(name) ? 'critical' : 'moderate' })),
  symptoms: splitCommaItems(form.symptoms).map((name, i) => ({ id: `fs-${i}`, name, severity: 5, onset: '—', active: true })),
  labs: splitCommaItems(form.labs).map((name, i) => ({ id: `fl-${i}`, name, value: '—', unit: '', date: '—', trend: 'stable', critical: false })),
  imaging: splitCommaItems(form.imaging).map((type, i) => ({ id: `fi-${i}`, type, date: '—', modality: '—', ai_confidence: 0, findings: '', impression: '' })),
  medications: splitCommaItems(form.medications).map((name, i) => ({ id: `fm-${i}`, name, dose: '—', status: 'active', category: 'other' })),
  allergies: splitCommaItems(form.allergies).map((substance, i) => ({ id: `fa-${i}`, substance, reaction: '—', severity: 'moderate', verified: false })),
  genomics: splitCommaItems(form.genomics).map((name, i) => ({ id: `fg-${i}`, gene: name.split('·')[0].trim(), variant: name.split('·')[1]?.trim() || '—', effect: '—', clinical_sig: '—' })),
  timeline: splitCommaItems(form.timeline).map((event, i) => ({ id: `ft-${i}`, date: '—', event, type: 'consult' })),
  risk_factors: splitCommaItems(form.risk_factors).map((name, i) => ({ id: `fr-${i}`, name, weight: 50, category: 'clinical' })),
  diagnoses: conditions,
})

// ─── Member Card ───────────────────────────────────────────────────────────
function MemberCard({ member, lang, isDark, c, onViewRecord, onEdit, onDelete }) {
  const isPrimaryPatient = isPrimaryPatientMember(member)
  const avatarUrl = isPrimaryPatient ? member.avatar_url || member.medicalRecord?.avatar_url : ''
  const meta     = FAMILY_RELATION_META[member.relation] || { color:'#888', label:{ vi:'Khác', en:'Other' } }
  const relColor = meta.color
  const hasDisease = (member.conditions || []).some(cd => !isNonDiseaseCondition(cd))

  return (
    <div style={{ position:'relative', flexShrink:0, width:148 }}>
      {/* Hover badge */}
      <div className="member-hover-badge" style={{
        position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
        background: relColor, color:'#fff',
        fontSize:8, fontWeight:700, fontFamily:'monospace',
        padding:'2px 8px', borderRadius:20, letterSpacing:'.06em', whiteSpace:'nowrap',
        opacity:0, transition:'opacity 0.18s', pointerEvents:'none', zIndex:10,
      }}>{isPrimaryPatient ? (lang === 'vi' ? 'Sửa thông tin, tên từ Hồ sơ cá nhân →' : 'Edit details, name from User Profile →') : (lang === 'vi' ? 'Sửa thành viên →' : 'Edit member →')}</div>

      {/* Main card */}
      <div
        onClick={() => onEdit(member)}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-4px)'
          e.currentTarget.style.boxShadow = `0 10px 28px ${relColor}30`
          e.currentTarget.style.borderColor = relColor
          const b = e.currentTarget.parentElement.querySelector('.member-hover-badge')
          if (b) b.style.opacity = '1'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderColor = hasDisease ? relColor+'55' : c.border
          const b = e.currentTarget.parentElement.querySelector('.member-hover-badge')
          if (b) b.style.opacity = '0'
        }}
        style={{
          background: isDark ? 'rgba(255,255,255,0.04)' : '#fff',
          border: `1.5px solid ${hasDisease ? relColor+'55' : c.border}`,
          borderRadius:12, padding:'14px 10px', textAlign:'center',
          cursor:'pointer', transition:'all 0.18s',
          opacity: member.alive === false ? 0.65 : 1,
        }}
      >
        {/* Avatar */}
        <div style={{
          width:44, height:44, borderRadius:'50%', margin:'0 auto 8px',
          background:`${relColor}20`, border:`2px solid ${relColor}55`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:20,
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={member.name} style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} />
          ) : (member.alive === false ? '🕊️' : member.gender === 'F' ? '👩' : member.relation === 'child' || member.relation === 'grandchild' ? '🧒' : '👨')}
        </div>

        <div style={{ fontSize:12, fontWeight:700, color:c.text, marginBottom:2, lineHeight:1.3 }}>{member.name}</div>
        <div style={{ fontSize:10, color:relColor, fontWeight:600, marginBottom:6 }}>
          {meta.label[lang] || meta.label.vi}{member.age ? ` · ${member.age}t` : ''}
        </div>

        {(member.dob || member.blood_type) && (
          <div style={{ fontSize:9, color:c.text3, marginBottom:6, lineHeight:1.35 }}>
            {member.dob ? `🎂 ${formatDob(member.dob)}` : ''}{member.dob && member.blood_type ? ' · ' : ''}{member.blood_type ? `🩸 ${member.blood_type}` : ''}
          </div>
        )}

        {(member.conditions || []).map((cond, i) => {
          const cc = CONDITION_COLORS[cond] || (hasDisease && !isNonDiseaseCondition(cond) ? '#ff8a65' : '#888')
          return (
            <div key={i} style={{
              fontSize:9, padding:'2px 5px', borderRadius:4, marginBottom:2,
              background:`${cc}15`, color:cc, border:`1px solid ${cc}30`,
              textAlign:'left',
            }}>{cond}</div>
          )
        })}

        {member.note && (
          <div style={{ fontSize:9, color:c.text3, marginTop:5, fontStyle:'italic', textAlign:'left', lineHeight:1.4 }}>
            📝 {member.note}
          </div>
        )}
        {member.alive === false && <div style={{ fontSize:9, color:c.text3, marginTop:4 }}>† Đã mất</div>}
      </div>

      {/* Edit / Delete buttons */}
      <div style={{ display:'flex', gap:4, marginTop:6, justifyContent:'center' }}>
        <button
          onClick={e => { e.stopPropagation(); onViewRecord(buildMemberRecord(member)) }}
          style={{
            flex:1, padding:'4px 0', borderRadius:6, border:`1px solid ${c.border}`,
            background: isDark ? 'rgba(255,255,255,0.05)' : '#f0f4f8',
            color:c.text2, fontSize:10, cursor:'pointer', transition:'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='#00b8cc'; e.currentTarget.style.color='#00b8cc' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=c.border; e.currentTarget.style.color=c.text2 }}
        >📋 Hồ sơ</button>
        {!isPrimaryPatient && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(member.id) }}
            style={{
              flex:1, padding:'4px 0', borderRadius:6, border:'1px solid rgba(255,82,82,0.2)',
              background:'rgba(255,82,82,0.06)',
              color:'#ff5252', fontSize:10, cursor:'pointer', transition:'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(255,82,82,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(255,82,82,0.06)' }}
          >🗑️ Xoá</button>
        )}
      </div>
    </div>
  )
}

// ─── Standalone Field wrapper (must be outside modal to avoid remount) ───────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:'block', fontSize:11, color:'var(--text3,#aaa)', marginBottom:5, fontWeight:600 }}>{label}</label>
      {children}
    </div>
  )
}

// ─── Member Form Modal ─────────────────────────────────────────────────────
function MemberFormModal({ mode, initialForm, onSave, onClose, lang, isDark, c, lockName = false }) {
  // Use local ref-backed state so typing never causes parent re-render
  const [localForm, setLocalForm] = useState(initialForm)
  const title = mode === 'add'
    ? (lang === 'vi' ? '+ Thêm thành viên' : '+ Add Member')
    : (lang === 'vi' ? '✏️ Sửa thành viên' : '✏️ Edit Member')

  const inputStyle = {
    width:'100%', padding:'9px 12px', borderRadius:8,
    border:`1px solid ${c.border}`, background: isDark ? '#0d1226' : '#f8fafc',
    color:c.text, fontSize:13, boxSizing:'border-box', outline:'none',
    fontFamily:'inherit',
  }
  const selectStyle = { ...inputStyle, cursor:'pointer' }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16,
    }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: isDark ? '#080c1a' : '#fff',
        border:`1px solid ${c.border}`, borderRadius:18,
        padding:'28px 28px 22px', width:'100%', maxWidth:440,
        boxShadow:'0 32px 80px rgba(0,0,0,0.5)',
        maxHeight:'90vh', overflowY:'auto',
      }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
          <h3 style={{ fontSize:16, fontWeight:800, color:c.text, margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:c.text3, cursor:'pointer', fontSize:20, lineHeight:1 }}>✕</button>
        </div>

        <Field label={lang === 'vi' ? 'Họ và tên *' : 'Full Name *'}>
          <input
            value={localForm.name}
            onChange={e => setLocalForm(p => ({ ...p, name:e.target.value }))}
            disabled={lockName}
            placeholder={lang === 'vi' ? 'Nguyễn Văn A' : 'John Doe'}
            style={{ ...inputStyle, opacity: lockName ? 0.7 : 1, cursor: lockName ? 'not-allowed' : 'text' }}
          />
          {lockName && (
            <div style={{ fontSize:10, color:'#ffb74d', marginTop:4, lineHeight:1.45 }}>
              {lang === 'vi'
                ? 'Tên Patient chính lấy từ Hồ sơ cá nhân. Vào User Profile để đổi tên và hệ thống sẽ tự đồng bộ lại.'
                : 'The primary Patient name comes from User Profile. Update User Profile to sync it here.'}
            </div>
          )}
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label={lang === 'vi' ? 'Tuổi' : 'Age'}>
            <input
              type="number" value={localForm.age} onChange={e => setLocalForm(p => ({ ...p, age:e.target.value }))}
              placeholder="45" min={0} max={120} style={inputStyle}
            />
          </Field>
          <Field label={lang === 'vi' ? 'Giới tính' : 'Gender'}>
            <select value={localForm.gender} onChange={e => setLocalForm(p => ({ ...p, gender:e.target.value }))} style={selectStyle}>
              <option value="M">{lang === 'vi' ? 'Nam' : 'Male'}</option>
              <option value="F">{lang === 'vi' ? 'Nữ' : 'Female'}</option>
            </select>
          </Field>
          <Field label={lang === 'vi' ? 'Ngày sinh' : 'Date of birth'}>
            <input
              type="date" value={localForm.dob} onChange={e => setLocalForm(p => ({ ...p, dob:e.target.value }))}
              style={inputStyle}
            />
          </Field>
          <Field label={lang === 'vi' ? 'Nhóm máu' : 'Blood type'}>
            <input
              value={localForm.blood_type} onChange={e => setLocalForm(p => ({ ...p, blood_type:e.target.value }))}
              placeholder="O+" style={inputStyle}
            />
          </Field>
        </div>

        <Field label={lang === 'vi' ? 'Quan hệ với Siêu Anh Hùng' : 'Relation to Patient'}>
          <select value={localForm.relation} onChange={e => setLocalForm(p => ({ ...p, relation:e.target.value }))} style={selectStyle}>
            {RELATIONS.map(r => (
              <option key={r} value={r}>{FAMILY_RELATION_META[r]?.label?.[lang] || FAMILY_RELATION_META[r]?.label?.vi || r}</option>
            ))}
          </select>
        </Field>

        <Field label={lang === 'vi' ? 'Bệnh lý (phân cách bằng dấu phẩy)' : 'Conditions (comma-separated)'}>
          <input
            value={localForm.conditions}
            onChange={e => setLocalForm(p => ({ ...p, conditions:e.target.value }))}
            placeholder={lang === 'vi' ? 'Ung thư phổi, Tăng huyết áp' : 'Lung Cancer, Hypertension'}
            style={inputStyle}
          />
          <div style={{ fontSize:10, color:c.text3, marginTop:4 }}>
            {lang === 'vi' ? 'VD: Ung thư phổi, Tiểu đường, Khỏe mạnh' : 'E.g: Lung Cancer, Diabetes, Healthy'}
          </div>
        </Field>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {[
            ['symptoms', lang === 'vi' ? 'Triệu chứng' : 'Symptoms'],
            ['labs', lang === 'vi' ? 'Xét nghiệm' : 'Labs'],
            ['imaging', lang === 'vi' ? 'Hình ảnh' : 'Imaging'],
            ['medications', lang === 'vi' ? 'Thuốc' : 'Medications'],
            ['allergies', lang === 'vi' ? 'Dị ứng' : 'Allergies'],
            ['genomics', lang === 'vi' ? 'Genomics' : 'Genomics'],
            ['timeline', lang === 'vi' ? 'Lịch sử' : 'Timeline'],
            ['risk_factors', lang === 'vi' ? 'Yếu tố rủi ro' : 'Risk factors'],
          ].map(([key, label]) => (
            <Field key={key} label={`${label} (${lang === 'vi' ? 'phân cách bằng dấu phẩy' : 'comma-separated'})`}>
              <textarea
                value={localForm[key]}
                onChange={e => setLocalForm(p => ({ ...p, [key]: e.target.value }))}
                placeholder={lang === 'vi' ? `${label} 1, ${label} 2` : `${label} 1, ${label} 2`}
                style={{ ...inputStyle, minHeight:64, resize:'vertical', lineHeight:1.45 }}
              />
            </Field>
          ))}
        </div>

        <Field label={lang === 'vi' ? 'Ghi chú thêm' : 'Additional Notes'}>
          <input
            value={localForm.note} onChange={e => setLocalForm(p => ({ ...p, note:e.target.value }))}
            placeholder={lang === 'vi' ? 'Ví dụ: cần tầm soát định kỳ từ 40 tuổi' : 'E.g: needs annual screening from age 40'}
            style={inputStyle}
          />
        </Field>

        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <div
            onClick={() => setLocalForm(p => ({ ...p, alive:!p.alive }))}
            style={{
              width:40, height:22, borderRadius:11, cursor:'pointer', transition:'all .2s',
              background: localForm.alive ? '#00b8cc' : 'rgba(255,255,255,0.15)',
              position:'relative', flexShrink:0,
            }}
          >
            <div style={{
              width:16, height:16, borderRadius:'50%', background:'#fff',
              position:'absolute', top:3, transition:'left .2s',
              left: localForm.alive ? 21 : 3,
            }} />
          </div>
          <span style={{ fontSize:12, color:c.text2 }}>
            {localForm.alive ? (lang === 'vi' ? '✅ Còn sống' : '✅ Alive') : (lang === 'vi' ? '✝ Đã mất' : '✝ Deceased')}
          </span>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button
            onClick={() => onSave(localForm)} disabled={!localForm.name.trim()}
            style={{
              flex:1, padding:'11px', borderRadius:9, cursor: localForm.name.trim() ? 'pointer' : 'not-allowed',
              border:'none', background:'linear-gradient(135deg,#00b8cc,#6b3fd4)',
              color:'#fff', fontWeight:700, fontSize:13, opacity: localForm.name.trim() ? 1 : 0.5,
              fontFamily:'inherit',
            }}
          >{mode === 'add' ? (lang === 'vi' ? '+ Thêm' : '+ Add') : (lang === 'vi' ? '💾 Lưu' : '💾 Save')}</button>
          <button onClick={onClose} style={{
            flex:1, padding:'11px', borderRadius:9, cursor:'pointer',
            border:`1px solid ${c.border}`, background:'none', color:c.text2,
            fontSize:13, fontFamily:'inherit',
          }}>{lang === 'vi' ? 'Huỷ' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function FamilyTreePanel({ patientId, storageOwnerId = 'guest', onNext, nextLabel, onPrev, prevLabel, onViewRecord }) {
  const { theme, lang, t } = useApp()
  const { user } = useAuth()
  const isDark    = theme === 'dark'
  const { patient: uploadedPatient } = useMedicalData({ lang })

  // Load from localStorage, fallback to DEFAULT_MEMBERS
  const [members, setMembersState] = useState(() => syncPrimaryPatientProfile(loadFamilyMembers(patientId, storageOwnerId) || DEFAULT_FAMILY_MEMBERS, user))
  const [modal, setModal]   = useState(null)   // null | 'add' | 'edit'
  const [form, setForm]     = useState(EMPTY_FORM)
  const [editId, setEditId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    setMembersState(syncPrimaryPatientProfile(loadFamilyMembers(patientId, storageOwnerId) || DEFAULT_FAMILY_MEMBERS, user))
    setModal(null)
    setEditId(null)
    setDeleteConfirm(null)
  }, [patientId, storageOwnerId, user?.name, user?.avatar])

  useEffect(() => {
    if (!displayNameFromUser(user) && !avatarFromUser(user)) return
    setMembersState(prev => {
      const next = syncPrimaryPatientProfile(prev, user)
      if (next !== prev) saveFamilyMembers(patientId, next, storageOwnerId)
      return next
    })
  }, [patientId, storageOwnerId, user?.name, user?.avatar])

  useEffect(() => {
    if (!uploadedPatient?._fromUpload) return
    setMembersState(prev => {
      const next = syncUploadedRecordsToPrimaryPatient(prev, uploadedPatient, user, storageOwnerId)
      if (next !== prev) saveFamilyMembers(patientId, next, storageOwnerId)
      return next
    })
  }, [patientId, storageOwnerId, uploadedPatient, user?.name, user?.avatar])

  // Persist every change
  const setMembers = useCallback((updater) => {
    setMembersState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      const syncedNext = syncPrimaryPatientProfile(next, user)
      saveFamilyMembers(patientId, syncedNext, storageOwnerId)
      return syncedNext
    })
  }, [patientId, storageOwnerId, user])

  const c = isDark ? {
    bg:'transparent', border:'rgba(255,255,255,0.08)',
    text:'#e8f0f8', text2:'rgba(232,240,248,0.55)', text3:'rgba(232,240,248,0.28)',
    surface:'rgba(255,255,255,0.03)', surface2:'rgba(255,255,255,0.06)',
  } : {
    bg:'transparent', border:'rgba(0,0,0,0.09)',
    text:'#1a2035', text2:'#555', text3:'#aaa',
    surface:'rgba(0,0,0,0.02)', surface2:'rgba(0,0,0,0.05)',
  }

  // ── CRUD handlers ────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal('add')
  }

  const openEdit = (member) => {
    const medicalRecord = member.medicalRecord || {}
    setForm({
      name:       member.name,
      age:        member.age?.toString() || '',
      gender:     member.gender || 'M',
      relation:   member.relation,
      dob:        member.dob || medicalRecord.dob || '',
      blood_type: member.blood_type || medicalRecord.blood_type || '',
      conditions: (member.conditions || []).join(', '),
      symptoms:   joinMedicalItems(medicalRecord.symptoms),
      labs:       joinMedicalItems(medicalRecord.labs),
      imaging:    joinMedicalItems(medicalRecord.imaging, 'type'),
      medications:joinMedicalItems(medicalRecord.medications),
      allergies:  Array.isArray(medicalRecord.allergies) ? medicalRecord.allergies.map(a => a.substance || a.name || a).filter(Boolean).join(', ') : '',
      genomics:   Array.isArray(medicalRecord.genomics) ? medicalRecord.genomics.map(g => g.gene ? `${g.gene}${g.variant ? ` · ${g.variant}` : ''}` : (g.name || g)).filter(Boolean).join(', ') : '',
      timeline:   joinMedicalItems(medicalRecord.timeline, 'event'),
      risk_factors: joinMedicalItems(medicalRecord.risk_factors),
      alive:      member.alive !== false,
      note:       member.note || '',
    })
    setEditId(member.id)
    setModal('edit')
  }

  const handleSave = (localForm) => {
    const memberId = modal === 'add' ? `fm-${Date.now()}` : editId
    const conditions = splitCommaItems(localForm.conditions).length ? splitCommaItems(localForm.conditions) : ['Chưa rõ tiền sử']
    const parsed = {
      name:       stripMissingNamePrefix(isPrimaryPatientMember(members.find(m => m.id === editId)) ? displayNameFromUser(user) || localForm.name.trim() : localForm.name.trim()),
      age:        parseInt(localForm.age, 10) || 0,
      gender:     localForm.gender,
      relation:   localForm.relation,
      dob:        localForm.dob.trim(),
      blood_type: localForm.blood_type.trim(),
      conditions,
      medicalRecord: buildFamilyMedicalRecord(memberId, localForm, conditions),
      alive:      localForm.alive,
      note:       localForm.note.trim(),
    }
    if (!parsed.name) return

    if (modal === 'add') {
      setMembers(prev => [...prev, { id: memberId, ...parsed }])
    } else {
      setMembers(prev => prev.map(m => m.id === editId ? { ...m, ...parsed } : m))
    }
    setModal(null)
  }

  const handleDelete = (id) => {
    if (isPrimaryPatientMember(members.find(m => m.id === id))) return
    setMembers(prev => prev.filter(m => m.id !== id))
    setDeleteConfirm(null)
  }

  // ── Group by row ──────────────────────────────────────────────────────────
  const rows = [1,2,3,4,5]
  const byRow = members.reduce((acc, m) => {
    const row = FAMILY_RELATION_META[m.relation]?.row || 3
    if (!acc[row]) acc[row] = []
    acc[row].push(m)
    return acc
  }, {})

  // ── Risk calc ─────────────────────────────────────────────────────────────
  const cancerCount = members.filter(m =>
    (m.conditions || []).some(cd => /ung thư|cancer/i.test(cd))
  ).length
  const riskLevel  = cancerCount >= 3 ? 'high' : cancerCount >= 1 ? 'medium' : 'low'
  const riskColor  = { high:'#ff5252', medium:'#ffb74d', low:'#00e676' }[riskLevel]
  const riskLabel  = lang === 'vi'
    ? { high:'Nguy cơ cao', medium:'Nguy cơ trung bình', low:'Nguy cơ thấp' }[riskLevel]
    : { high:'High Risk',   medium:'Medium Risk',        low:'Low Risk'      }[riskLevel]

  return (
    <div style={{ padding:28, display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:c.text, margin:0 }}>
            🌳 {t('familyTreeTitle')}
          </h2>
          <p style={{ color:c.text2, fontSize:12, marginTop:4 }}>
            {`${members.length} ${t('membersCount')} · ${t('aiHereditary')} · ${lang === 'vi' ? 'Nhấn thẻ để sửa thành viên' : 'Click a card to edit member'}`}
          </p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:700, background:`${riskColor}18`, color:riskColor, border:`1px solid ${riskColor}30` }}>
            🧬 {riskLabel}
          </div>
          <button onClick={openAdd} style={{
            padding:'8px 18px', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700,
            background:'linear-gradient(135deg,#00b8cc22,#6b3fd422)',
            border:'1px solid rgba(0,180,200,0.35)', color:'#00b8cc',
            transition:'all .15s', fontFamily:'inherit',
          }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(0,180,200,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background='linear-gradient(135deg,#00b8cc22,#6b3fd422)' }}
          >+ {t('addMember')}</button>
        </div>
      </div>

      {/* ── Tree ───────────────────────────────────────────────────────────── */}
      <div style={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:16, padding:'28px 20px', overflowX:'auto' }}>
        {rows.filter(r => byRow[r]?.length).map((row, ri, arr) => (
          <div key={row} style={{ marginBottom: ri < arr.length-1 ? 40 : 0, position:'relative' }}>
            {/* Row label */}
            <div style={{ fontSize:9, color:c.text3, fontFamily:'monospace', letterSpacing:'.1em', textTransform:'uppercase', marginBottom:14, textAlign:'center' }}>
              {{ 1:'Generation I', 2:'Generation II', 3:'Generation III (Patient)', 4:'Generation IV', 5:'Generation V' }[row]}
            </div>

            {/* Connector line down */}
            {ri < arr.length-1 && (
              <div style={{ position:'absolute', bottom:-32, left:'50%', width:1, height:30, background: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)' }} />
            )}

            {/* Cards row */}
            <div style={{ display:'flex', justifyContent:'center', gap:16, flexWrap:'wrap' }}>
              {byRow[row].map(member => (
                <MemberCard
                  key={member.id}
                  member={member}
                  lang={lang}
                  isDark={isDark}
                  c={c}
                  onViewRecord={onViewRecord || (() => {})}
                  onEdit={openEdit}
                  onDelete={id => setDeleteConfirm(id)}
                />
              ))}
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:c.text3 }}>
            <div style={{ fontSize:40, marginBottom:12 }}>🌳</div>
            <div style={{ fontSize:14, marginBottom:16 }}>{lang === 'vi' ? 'Chưa có thành viên gia đình nào' : 'No family members yet'}</div>
            <button onClick={openAdd} style={{ padding:'10px 24px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#00b8cc,#6b3fd4)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              + {lang === 'vi' ? 'Thêm thành viên đầu tiên' : 'Add first member'}
            </button>
          </div>
        )}
      </div>

      {/* ── Member list table ───────────────────────────────────────────────── */}
      <div style={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'14px 18px', borderBottom:`1px solid ${c.border}`, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:c.text3, fontFamily:'monospace', flex:1 }}>
            {t('memberList')} ({members.length})
          </span>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)' }}>
                {[
                  lang === 'vi' ? 'Họ tên' : 'Name',
                  lang === 'vi' ? 'Quan hệ' : 'Relation',
                  lang === 'vi' ? 'Tuổi' : 'Age',
                  lang === 'vi' ? 'Bệnh lý' : 'Conditions',
                  lang === 'vi' ? 'Trạng thái' : 'Status',
                  lang === 'vi' ? 'Ghi chú' : 'Note',
                  lang === 'vi' ? 'Thao tác' : 'Actions',
                ].map(h => (
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:9, color:c.text3, fontFamily:'monospace', letterSpacing:'.08em', textTransform:'uppercase', whiteSpace:'nowrap', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {members.map((member, i) => {
                const meta = FAMILY_RELATION_META[member.relation]
                const relColor = meta?.color || '#888'
                const hasDisease = (member.conditions || []).some(cd => !isNonDiseaseCondition(cd))
                return (
                  <tr key={member.id} style={{ borderTop:`1px solid ${c.border}`, transition:'background .15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:`${relColor}20`, border:`1.5px solid ${relColor}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, overflow:'hidden' }}>
                          {isPrimaryPatientMember(member) && (member.avatar_url || member.medicalRecord?.avatar_url) ? (
                            <img src={member.avatar_url || member.medicalRecord?.avatar_url} alt={member.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          ) : (member.alive === false ? '🕊️' : member.gender === 'F' ? '👩' : '👨')}
                        </div>
                        <span style={{ fontWeight:600, color:c.text }}>{member.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ padding:'2px 8px', borderRadius:4, fontSize:10, background:`${relColor}18`, color:relColor, border:`1px solid ${relColor}30`, fontFamily:'monospace' }}>
                        {meta?.label?.[lang] || meta?.label?.vi || member.relation}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', color:c.text2 }}>{member.age ? `${member.age}t` : '—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                        {(member.conditions || []).map((cd, ci) => {
                          const cc = CONDITION_COLORS[cd] || (!isNonDiseaseCondition(cd) ? '#ff8a65' : '#00e676')
                          return (
                            <span key={ci} style={{ padding:'1px 6px', borderRadius:3, fontSize:9, background:`${cc}15`, color:cc, border:`1px solid ${cc}30` }}>{cd}</span>
                          )
                        })}
                      </div>
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <span style={{ fontSize:10, color: member.alive === false ? c.text3 : '#00e676', fontFamily:'monospace' }}>
                        {member.alive === false ? '✝ Đã mất' : '● Sống'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', color:c.text2, fontSize:11, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {member.note || '—'}
                    </td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={() => onViewRecord && onViewRecord(buildMemberRecord(member))} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid rgba(0,229,255,0.25)`, background:'rgba(0,229,255,0.08)', color:'var(--cyan,#00e5ff)', fontSize:10, cursor:'pointer', whiteSpace:'nowrap' }}>
                          📋 Hồ sơ
                        </button>
                        <button onClick={() => openEdit(member)} style={{ padding:'4px 8px', borderRadius:6, border:`1px solid ${c.border}`, background:'transparent', color:c.text2, fontSize:10, cursor:'pointer' }}>
                          ✏️
                        </button>
                        {!isPrimaryPatientMember(member) && (
                          <button onClick={() => setDeleteConfirm(member.id)} style={{ padding:'4px 8px', borderRadius:6, border:'1px solid rgba(255,82,82,0.2)', background:'rgba(255,82,82,0.06)', color:'#ff5252', fontSize:10, cursor:'pointer' }}>
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AI Risk panel ───────────────────────────────────────────────────── */}
      <div style={{ background:c.surface, border:`1px solid ${c.border}`, borderRadius:14, padding:16 }}>
        <div style={{ fontSize:10, letterSpacing:'.12em', color:c.text3, marginBottom:12, textTransform:'uppercase', fontFamily:'monospace' }}>
          🤖 {t('aiHereditary')}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ background:'rgba(255,82,82,0.06)', border:'1px solid rgba(255,82,82,0.2)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#ff5252', marginBottom:6 }}>🧬 {lang === 'vi' ? 'Gen nguy cơ phát hiện' : 'Risk Genes Detected'}</div>
            <div style={{ fontSize:11, color:c.text2, lineHeight:1.6 }}>
              {cancerCount > 0
                ? (lang === 'vi' ? `${cancerCount} thành viên mắc ung thư → nguy cơ di truyền cao. Khuyến nghị xét nghiệm BRCA1/BRCA2, EGFR.` : `${cancerCount} members with cancer → high hereditary risk. Recommend BRCA1/BRCA2, EGFR genetic testing.`)
                : (lang === 'vi' ? 'Không phát hiện yếu tố ung thư di truyền rõ ràng trong gia đình.' : 'No clear hereditary cancer factors detected in family.')}
            </div>
          </div>
          <div style={{ background:'rgba(255,183,77,0.06)', border:'1px solid rgba(255,183,77,0.2)', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#ffb74d', marginBottom:6 }}>📋 {t('screeningRec')}</div>
            <div style={{ fontSize:11, color:c.text2, lineHeight:1.6 }}>
              {lang === 'vi'
                ? 'Con cái: CT ngực low-dose hàng năm từ 40 tuổi. Anh/em: xét nghiệm gen. Toàn gia đình: cai thuốc lá, giảm phơi nhiễm AQI.'
                : 'Children: Annual low-dose chest CT from age 40. Siblings: Genetic testing. Whole family: Smoking cessation, reduce AQI exposure.'}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <NavButtons onNext={onNext} nextLabel={nextLabel || t('patientRecord')} onPrev={onPrev} prevLabel={prevLabel} />

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      {modal && (
        <MemberFormModal
          key={editId || 'add'}
          mode={modal} initialForm={form}
          onSave={handleSave} onClose={() => setModal(null)}
          lang={lang} isDark={isDark} c={c}
          lockName={modal === 'edit' && isPrimaryPatientMember(members.find(m => m.id === editId))}
        />
      )}

      {/* ── Delete confirm ───────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
          <div style={{ background: isDark ? '#080c1a' : '#fff', border:`1px solid rgba(255,82,82,0.3)`, borderRadius:16, padding:28, maxWidth:380, width:'90%', textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:12 }}>🗑️</div>
            <h3 style={{ fontSize:16, fontWeight:800, color:c.text, marginBottom:8 }}>
              {t('confirmDelete')}
            </h3>
            <p style={{ fontSize:12, color:c.text2, marginBottom:24 }}>
              {lang === 'vi'
                ? `Thành viên "${members.find(m=>m.id===deleteConfirm)?.name}" sẽ bị xoá vĩnh viễn.`
                : `Member "${members.find(m=>m.id===deleteConfirm)?.name}" will be permanently deleted.`}
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex:1, padding:'10px', borderRadius:8, border:'none', background:'#ff5252', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
                {lang === 'vi' ? '🗑️ Xoá' : '🗑️ Delete'}
              </button>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex:1, padding:'10px', borderRadius:8, border:`1px solid ${c.border}`, background:'none', color:c.text2, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
                {lang === 'vi' ? 'Huỷ' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
