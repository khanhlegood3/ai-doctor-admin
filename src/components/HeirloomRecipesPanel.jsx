// src/components/HeirloomRecipesPanel.jsx
//
// "Bữa ăn heirloom recipes" — chuyển thể từ app demo Google AI Studio
// "heirloom-recipes" (React 19 + TypeScript + Firebase Auth/Firestore +
// @google/genai gọi thẳng Gemini từ trình duyệt, có "household" nhiều
// thành viên dùng chung sổ công thức).
//
// Dự án này không có Firebase project riêng cho tính năng này và cũng
// không có Gemini API key production, nên được viết lại theo ĐÚNG công
// nghệ đã dùng cho các trang "Vision" (AI Healthcare Vision / Wiki Med
// Vision) trong repo này:
//   - Lưu trữ: raw IndexedDB nội bộ, khoá theo user.uuid (useAuth()),
//     KHÔNG Firebase — xem src/lib/heirloomRecipesStorage.js, cùng
//     pattern với src/lib/wikiMedVisionChatStorage.js.
//   - AI: gọi qua /api/groq-proxy sẵn có (JSON mode + nhánh ảnh
//     gemini-comic/Pollinations), KHÔNG gọi thẳng Gemini từ trình duyệt —
//     xem src/components/heirloomRecipes/heirloomRecipesClient.js, cùng
//     pattern với src/components/cookingGuide/kitchenClient.js.
//   - UI: React function component thuần, style inline (không Tailwind),
//     dùng useApp()/useAuth() + <NavButtons/>, cùng phong cách với
//     CookingGuidePanel.jsx / AIHealthcareVisionPanel.jsx.
// Bỏ khái niệm "household" nhiều người dùng chung của bản gốc (không có
// hạ tầng multi-user realtime ở đây) — mỗi tài khoản có sổ công thức
// riêng, giống mọi tính năng cá nhân hoá khác trong app.

import React, { useEffect, useMemo, useState } from 'react'
import NavButtons from './NavButtons.jsx'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext.jsx'
import { CATEGORIES, listRecipes, saveRecipe, deleteRecipe } from '../lib/heirloomRecipesStorage.js'
import { generateRecipeIdea, importRecipeFromText, generateRecipeImage } from './heirloomRecipes/heirloomRecipesClient.js'

const CATEGORY_LABELS_VI = {
  Breakfast: 'Bữa sáng', Lunch: 'Bữa trưa', Dinner: 'Bữa tối',
  Dessert: 'Tráng miệng', Snack: 'Ăn vặt', Drink: 'Đồ uống', Other: 'Khác',
}
const CATEGORY_LABELS_EN = {
  Breakfast: 'Breakfast', Lunch: 'Lunch', Dinner: 'Dinner',
  Dessert: 'Dessert', Snack: 'Snack', Drink: 'Drink', Other: 'Other',
}

const emptyForm = { title: '', ingredientsText: '', instructionsText: '', category: 'Dinner', estimatedTime: '', imageUrl: '', sourceUrl: '', rating: 0 }

export default function HeirloomRecipesPanel({ onNext, nextLabel, onPrev, prevLabel }) {
  const { lang } = useApp()
  const { user } = useAuth()
  const isVi = lang === 'vi'
  const catLabels = isVi ? CATEGORY_LABELS_VI : CATEGORY_LABELS_EN

  const surface = 'rgba(255,255,255,0.035)'
  const border  = 'rgba(255,255,255,0.09)'
  const text    = '#e8f0f8'
  const text2   = 'rgba(232,240,248,0.55)'
  const text3   = 'rgba(232,240,248,0.35)'
  const accent  = '#00e5ff'
  const bad     = '#ef4444'
  const panelCard = { background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 14 }
  const inputStyle = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${border}`, borderRadius: 8, color: text, padding: '8px 10px', fontSize: 14 }
  const btn = (bg) => ({ background: bg, color: '#04101c', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' })
  const btnGhost = { background: 'transparent', color: text2, border: `1px solid ${border}`, borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }

  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [viewingId, setViewingId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [formError, setFormError] = useState('')
  const [aiOpen, setAiOpen] = useState(false) // false | 'generate' | 'import'
  const [aiCategory, setAiCategory] = useState('Dinner')
  const [aiDetails, setAiDetails] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')
  const [imageBusy, setImageBusy] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    listRecipes(user?.uuid).then((rows) => { if (alive) { setRecipes(rows); setLoading(false) } }).catch(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [user?.uuid])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return recipes.filter((r) => {
      const matchesCat = category === 'All' || r.category === category
      const matchesQ = !q || r.title.toLowerCase().includes(q) || r.ingredients.some((i) => i.toLowerCase().includes(q))
      return matchesCat && matchesQ
    })
  }, [recipes, search, category])

  const viewingRecipe = recipes.find((r) => r.id === viewingId) || null

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setFormError('') }

  const openAddForm = () => { resetForm(); setFormOpen(true); setAiOpen(false) }
  const openEditForm = (r) => {
    setForm({
      title: r.title,
      ingredientsText: r.ingredients.join('\n'),
      instructionsText: r.instructions.join('\n'),
      category: r.category,
      estimatedTime: r.estimatedTime ?? '',
      imageUrl: r.imageUrl || '',
      sourceUrl: r.sourceUrl || '',
      rating: r.rating || 0,
    })
    setEditingId(r.id)
    setFormOpen(true)
    setViewingId(null)
    setAiOpen(false)
  }

  const applyRecipeToForm = (parsed) => {
    setForm({
      title: parsed.title,
      ingredientsText: parsed.ingredients.join('\n'),
      instructionsText: parsed.instructions.join('\n'),
      category: parsed.category,
      estimatedTime: parsed.estimatedTime ?? '',
      imageUrl: '',
      sourceUrl: parsed.sourceUrl || '',
      rating: 0,
    })
    setEditingId(null)
    setFormOpen(true)
    setAiOpen(false)
  }

  const handleAiGenerate = async () => {
    setAiBusy(true); setAiError('')
    try {
      const parsed = await generateRecipeIdea({ category: aiCategory, details: aiDetails })
      applyRecipeToForm(parsed)
    } catch (e) {
      setAiError(e?.message || String(e))
    } finally {
      setAiBusy(false)
    }
  }

  const handleAiImport = async () => {
    if (!aiDetails.trim()) { setAiError(isVi ? 'Hãy dán link hoặc nội dung công thức.' : 'Please paste a link or recipe text.'); return }
    setAiBusy(true); setAiError('')
    try {
      const parsed = await importRecipeFromText(aiDetails.trim())
      applyRecipeToForm(parsed)
    } catch (e) {
      setAiError(e?.message || String(e))
    } finally {
      setAiBusy(false)
    }
  }

  const handleGenerateImage = async () => {
    if (!form.title.trim()) return
    setImageBusy(true)
    try {
      const url = await generateRecipeImage({ title: form.title, ingredients: form.ingredientsText.split('\n').filter(Boolean) })
      setForm((f) => ({ ...f, imageUrl: url }))
    } catch (e) {
      setFormError(e?.message || String(e))
    } finally {
      setImageBusy(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) { setFormError(isVi ? 'Vui lòng nhập tên món.' : 'Please enter a title.'); return }
    setFormError('')
    const saved = await saveRecipe(user?.uuid, {
      id: editingId || undefined,
      title: form.title,
      ingredients: form.ingredientsText.split('\n').map((s) => s.trim()).filter(Boolean),
      instructions: form.instructionsText.split('\n').map((s) => s.trim()).filter(Boolean),
      category: form.category,
      estimatedTime: form.estimatedTime === '' ? null : Number(form.estimatedTime),
      imageUrl: form.imageUrl,
      sourceUrl: form.sourceUrl,
      rating: Number(form.rating) || 0,
      createdAt: editingId ? recipes.find((r) => r.id === editingId)?.createdAt : undefined,
    })
    setRecipes((prev) => {
      const others = prev.filter((r) => r.id !== saved.id)
      return [saved, ...others]
    })
    setFormOpen(false)
    resetForm()
  }

  const confirmDelete = async () => {
    if (!deleteId) return
    await deleteRecipe(user?.uuid, deleteId)
    setRecipes((prev) => prev.filter((r) => r.id !== deleteId))
    if (viewingId === deleteId) setViewingId(null)
    setDeleteId(null)
  }

  const Stars = ({ value }) => (
    <span style={{ color: '#ffca28', letterSpacing: 1 }}>
      {'★'.repeat(Math.round(value || 0))}
      <span style={{ color: text3 }}>{'★'.repeat(5 - Math.round(value || 0))}</span>
    </span>
  )

  return (
    <div className="animate-fade">
      <section style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: accent, fontWeight: 700 }}>BỮA ĂN HEIRLOOM RECIPES</div>
        <h2 style={{ margin: '4px 0 6px' }}>🍲 {isVi ? 'Bữa ăn heirloom recipes' : 'Heirloom Recipes Meal Book'}</h2>
        <p style={{ color: text2, margin: 0 }}>
          {isVi
            ? 'Sổ công thức gia truyền của riêng bạn — tự thêm, để AI gợi ý món mới, hoặc dán link/công thức để AI nhập tự động.'
            : 'Your own heirloom recipe book — add manually, ask AI to suggest a dish, or paste a link/recipe text to auto-import.'}
        </p>
      </section>

      {/* Thanh công cụ: tìm kiếm + lọc danh mục + hành động */}
      <div style={{ ...panelCard, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <input
          style={{ ...inputStyle, flex: '1 1 200px', minWidth: 160 }}
          placeholder={isVi ? 'Tìm theo tên món hoặc nguyên liệu…' : 'Search by title or ingredient…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={{ ...inputStyle, width: 'auto' }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">{isVi ? 'Tất cả danh mục' : 'All categories'}</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{catLabels[c]}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button type="button" style={btn(accent)} onClick={openAddForm}>+ {isVi ? 'Thêm món' : 'Add recipe'}</button>
        <button type="button" style={btnGhost} onClick={() => { setAiOpen('generate'); setAiDetails(''); setAiError(''); setFormOpen(false) }}>✨ {isVi ? 'AI gợi ý món' : 'AI suggest'}</button>
        <button type="button" style={btnGhost} onClick={() => { setAiOpen('import'); setAiDetails(''); setAiError(''); setFormOpen(false) }}>🔗 {isVi ? 'Nhập từ link/văn bản' : 'Import from link/text'}</button>
      </div>

      {/* Khối AI: sinh món hoặc nhập món */}
      {aiOpen && (
        <div style={{ ...panelCard, marginBottom: 14, borderColor: 'rgba(0,229,255,0.35)' }}>
          {aiOpen === 'generate' ? (
            <>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>✨ {isVi ? 'AI gợi ý món mới' : 'AI recipe suggestion'}</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <select style={{ ...inputStyle, width: 'auto' }} value={aiCategory} onChange={(e) => setAiCategory(e.target.value)}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{catLabels[c]}</option>)}
                </select>
                <input
                  style={{ ...inputStyle, flex: '1 1 220px' }}
                  placeholder={isVi ? 'Mô tả thêm (tuỳ chọn): ví dụ "món chay, ít dầu mỡ"…' : 'Extra details (optional): e.g. "vegetarian, low oil"…'}
                  value={aiDetails}
                  onChange={(e) => setAiDetails(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" style={btn(accent)} disabled={aiBusy} onClick={handleAiGenerate}>{aiBusy ? (isVi ? 'Đang tạo…' : 'Generating…') : (isVi ? 'Tạo công thức' : 'Generate recipe')}</button>
                <button type="button" style={btnGhost} onClick={() => setAiOpen(false)}>{isVi ? 'Đóng' : 'Close'}</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>🔗 {isVi ? 'Nhập món từ link hoặc văn bản' : 'Import from link or text'}</div>
              <div style={{ color: text3, fontSize: 12.5, marginBottom: 8 }}>
                {isVi
                  ? 'AI không tự tải nội dung trang web — hãy dán kèm nội dung công thức (tên món, nguyên liệu, các bước) bên cạnh link để có kết quả chính xác nhất.'
                  : 'The AI cannot fetch web pages itself — paste the recipe text (title, ingredients, steps) along with the link for the most accurate result.'}
              </div>
              <textarea
                style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
                placeholder={isVi ? 'Dán link và/hoặc nội dung công thức vào đây…' : 'Paste the link and/or recipe text here…'}
                value={aiDetails}
                onChange={(e) => setAiDetails(e.target.value)}
              />
              {aiError && <div style={{ color: bad, fontSize: 13, marginTop: 6 }}>{aiError}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button type="button" style={btn(accent)} disabled={aiBusy} onClick={handleAiImport}>{aiBusy ? (isVi ? 'Đang nhập…' : 'Importing…') : (isVi ? 'Nhập món' : 'Import recipe')}</button>
                <button type="button" style={btnGhost} onClick={() => setAiOpen(false)}>{isVi ? 'Đóng' : 'Close'}</button>
              </div>
            </>
          )}
          {aiOpen === 'generate' && aiError && <div style={{ color: bad, fontSize: 13, marginTop: 6 }}>{aiError}</div>}
        </div>
      )}

      {/* Form thêm/sửa món */}
      {formOpen && (
        <form onSubmit={handleSubmit} style={{ ...panelCard, marginBottom: 14, borderColor: 'rgba(0,229,255,0.35)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{editingId ? (isVi ? '✏️ Sửa công thức' : '✏️ Edit recipe') : (isVi ? '+ Thêm công thức' : '+ New recipe')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <input style={inputStyle} placeholder={isVi ? 'Tên món' : 'Title'} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{catLabels[c]}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder={isVi ? 'Nguyên liệu (mỗi dòng 1 nguyên liệu)' : 'Ingredients (one per line)'} value={form.ingredientsText} onChange={(e) => setForm({ ...form, ingredientsText: e.target.value })} />
            <textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} placeholder={isVi ? 'Các bước nấu (mỗi dòng 1 bước)' : 'Instructions (one step per line)'} value={form.instructionsText} onChange={(e) => setForm({ ...form, instructionsText: e.target.value })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10, marginTop: 10 }}>
            <input style={inputStyle} type="number" min="0" placeholder={isVi ? 'Thời gian (phút)' : 'Time (minutes)'} value={form.estimatedTime} onChange={(e) => setForm({ ...form, estimatedTime: e.target.value })} />
            <select style={inputStyle} value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })}>
              {[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n === 0 ? (isVi ? 'Chưa đánh giá' : 'No rating') : '★'.repeat(n)}</option>)}
            </select>
            <input style={inputStyle} placeholder={isVi ? 'Nguồn (link, tuỳ chọn)' : 'Source URL (optional)'} value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <button type="button" style={btnGhost} disabled={imageBusy || !form.title.trim()} onClick={handleGenerateImage}>
              {imageBusy ? (isVi ? 'Đang vẽ ảnh…' : 'Generating image…') : (isVi ? '🖼️ AI vẽ ảnh minh hoạ' : '🖼️ AI generate photo')}
            </button>
            {form.imageUrl && <img src={form.imageUrl} alt="" style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, border: `1px solid ${border}` }} />}
          </div>
          {formError && <div style={{ color: bad, fontSize: 13, marginTop: 8 }}>{formError}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button type="submit" style={btn(accent)}>{isVi ? 'Lưu công thức' : 'Save recipe'}</button>
            <button type="button" style={btnGhost} onClick={() => { setFormOpen(false); resetForm() }}>{isVi ? 'Huỷ' : 'Cancel'}</button>
          </div>
        </form>
      )}

      {/* Danh sách công thức */}
      {loading ? (
        <div style={{ color: text2, padding: 20 }}>{isVi ? 'Đang tải sổ công thức…' : 'Loading recipe book…'}</div>
      ) : filtered.length === 0 ? (
        <div style={{ ...panelCard, color: text2, textAlign: 'center', padding: 30 }}>
          {recipes.length === 0
            ? (isVi ? 'Sổ công thức trống — hãy thêm món đầu tiên hoặc nhờ AI gợi ý!' : 'Your recipe book is empty — add your first dish or ask AI for a suggestion!')
            : (isVi ? 'Không tìm thấy món phù hợp.' : 'No matching recipes.')}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {filtered.map((r) => (
            <div key={r.id} style={{ ...panelCard, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 6 }} onClick={() => setViewingId(r.id)}>
              {r.imageUrl && <img src={r.imageUrl} alt="" style={{ width: '100%', height: 110, objectFit: 'cover', borderRadius: 8, marginBottom: 4 }} />}
              <div style={{ fontWeight: 700, color: text }}>{r.title}</div>
              <div style={{ fontSize: 12, color: text2 }}>{catLabels[r.category]}{r.estimatedTime ? ` · ${r.estimatedTime} ${isVi ? 'phút' : 'min'}` : ''}</div>
              <Stars value={r.rating} />
            </div>
          ))}
        </div>
      )}

      {/* Xem chi tiết công thức */}
      {viewingRecipe && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={() => setViewingId(null)}>
          <div style={{ ...panelCard, maxWidth: 560, width: '100%', maxHeight: '85vh', overflowY: 'auto', background: '#0a0f1a' }} onClick={(e) => e.stopPropagation()}>
            {viewingRecipe.imageUrl && <img src={viewingRecipe.imageUrl} alt="" style={{ width: '100%', height: 180, objectFit: 'cover', borderRadius: 10, marginBottom: 10 }} />}
            <h3 style={{ margin: '0 0 4px' }}>{viewingRecipe.title}</h3>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', color: text2, fontSize: 13, marginBottom: 10 }}>
              <span>{catLabels[viewingRecipe.category]}</span>
              {viewingRecipe.estimatedTime ? <span>· {viewingRecipe.estimatedTime} {isVi ? 'phút' : 'min'}</span> : null}
              <Stars value={viewingRecipe.rating} />
            </div>
            {viewingRecipe.sourceUrl && (
              <div style={{ fontSize: 12.5, marginBottom: 10 }}>
                <a href={viewingRecipe.sourceUrl} target="_blank" rel="noreferrer" style={{ color: accent }}>{viewingRecipe.sourceUrl}</a>
              </div>
            )}
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{isVi ? 'Nguyên liệu' : 'Ingredients'}</div>
            <ul style={{ margin: '0 0 14px', paddingLeft: 18, color: text2 }}>
              {viewingRecipe.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
            </ul>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{isVi ? 'Cách làm' : 'Instructions'}</div>
            <ol style={{ margin: 0, paddingLeft: 18, color: text2 }}>
              {viewingRecipe.instructions.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
            </ol>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="button" style={btn(accent)} onClick={() => openEditForm(viewingRecipe)}>{isVi ? 'Sửa' : 'Edit'}</button>
              <button type="button" style={{ ...btnGhost, color: bad, borderColor: bad }} onClick={() => setDeleteId(viewingRecipe.id)}>{isVi ? 'Xoá' : 'Delete'}</button>
              <div style={{ flex: 1 }} />
              <button type="button" style={btnGhost} onClick={() => setViewingId(null)}>{isVi ? 'Đóng' : 'Close'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Xác nhận xoá */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 210, padding: 16 }} onClick={() => setDeleteId(null)}>
          <div style={{ ...panelCard, maxWidth: 360, width: '100%', background: '#0a0f1a' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ marginBottom: 14 }}>{isVi ? 'Xoá công thức này khỏi sổ?' : 'Delete this recipe from your book?'}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={btnGhost} onClick={() => setDeleteId(null)}>{isVi ? 'Huỷ' : 'Cancel'}</button>
              <button type="button" style={btn(bad)} onClick={confirmDelete}>{isVi ? 'Xoá' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} style={{ marginTop: 20 }} />
    </div>
  )
}
