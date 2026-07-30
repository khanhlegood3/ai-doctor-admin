// src/components/CookingGuidePanel.jsx
//
// "Hướng Dẫn Nấu Ăn Ngon Và Khỏe Mạnh" — chuyển thể từ app demo Google AI
// Studio "Function Call Kitchen" (function-call-kitchen.zip). Bản gốc dùng
// Gemini function-calling (tools) gọi thẳng từ trình duyệt với API key lộ
// trong bundle. Dự án này không có Gemini key production và bị giới hạn 12
// Serverless Functions trên Vercel, nên "bộ não AI" được viết lại để gọi
// qua /api/groq-proxy sẵn có (xem src/components/cookingGuide/kitchenClient.js),
// nhưng vẫn giữ đúng lối chơi: chọn nguyên liệu + áp thao tác nấu → AI tạo
// ra món/nguyên liệu mới → phục vụ đơn hàng → AI thẩm định có khớp không.
//
// Mở từ mục "Kênh yêu thích" trong RSSPortalPanel (ô ngay dưới "Ăn Gì Hôm Nay").

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react'
import NavButtons from './NavButtons.jsx'
import {
  STARTING_INGREDIENTS,
  COOKING_ACTIONS,
  EXAMPLE_ORDERS,
  findAction,
} from './cookingGuide/kitchenConstants.js'
import { generateCombination, verifyServedDish, planAutoCook, generateMealTrayImage } from './cookingGuide/kitchenClient.js'

let uidCounter = 0
const nextId = (prefix) => `${prefix}-${Date.now()}-${uidCounter++}`

export default function CookingGuidePanel({ onNext, nextLabel, onPrev, prevLabel, onBack }) {
  const surface = 'rgba(255,255,255,0.035)'
  const border  = 'rgba(255,255,255,0.09)'
  const text    = '#e8f0f8'
  const text2   = 'rgba(232,240,248,0.55)'
  const text3   = 'rgba(232,240,248,0.35)'
  const accent  = '#00e5ff'
  const good    = '#22c55e'
  const bad     = '#ef4444'

  const panelCard = { background: surface, border: `1px solid ${border}`, borderRadius: 14, padding: 14 }

  const [inventory, setInventory] = useState(() => STARTING_INGREDIENTS.map(i => ({ ...i, id: nextId('ing') })))
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [orders, setOrders] = useState(() => EXAMPLE_ORDERS.map(o => ({ ...o })))
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [timeline, setTimeline] = useState([
    { id: nextId('tl'), text: 'Chào bếp trưởng! Chọn một đơn hàng bên dưới để bắt đầu, rồi kết hợp nguyên liệu + thao tác nấu để tạo ra món ăn nhé.' },
  ])
  const [busyAction, setBusyAction] = useState(null) // tên action đang chờ AI
  const [autoCooking, setAutoCooking] = useState(false)
  const [showAddOrder, setShowAddOrder] = useState(false)
  const [newOrderName, setNewOrderName] = useState('')
  const [showServeBox, setShowServeBox] = useState(false)
  const [serveChoiceId, setServeChoiceId] = useState('')
  // Ảnh "mâm cơm" xem full-size khi bấm vào thumbnail trong thẻ đơn hàng.
  const [previewImage, setPreviewImage] = useState(null) // { url, title } | null

  const timelineRef = useRef(null)
  useEffect(() => {
    if (timelineRef.current) timelineRef.current.scrollTop = timelineRef.current.scrollHeight
  }, [timeline])

  const activeOrder = orders.find(o => o.id === activeOrderId) || null
  const isBusy = busyAction !== null || autoCooking

  const pushTimeline = useCallback((entry) => {
    setTimeline(prev => [...prev, { id: nextId('tl'), ...entry }])
  }, [])

  const toggleIngredient = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])

  const startOrder = useCallback((orderId) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'in_progress' } : o))
    setActiveOrderId(orderId)
    setSelectedIds(new Set())
    const order = orders.find(o => o.id === orderId)
    pushTimeline({ text: `🔔 Bắt đầu nấu đơn hàng: ${order?.emoji || ''} ${order?.name || ''}` })
  }, [orders, pushTimeline])

  const addOrder = useCallback((name) => {
    const order = { id: nextId('order'), name, emoji: '🍽️', difficulty: 'custom', status: 'not_started' }
    setOrders(prev => [...prev, order])
    setNewOrderName('')
    setShowAddOrder(false)
  }, [])

  // Vẽ ảnh "mâm cơm" cho 1 đơn hàng vừa phục vụ THÀNH CÔNG — chạy nền
  // (không await ở nơi gọi), tự cập nhật trạng thái loading/ready/error vào
  // đúng order đó qua orderId (tránh dùng closure `activeOrder` cũ vì hàm
  // này chạy sau khi state đã đổi).
  const generatePlatingImage = useCallback((orderId, dishLabel) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, plating: { status: 'loading', note: 'Đang vẽ mâm cơm...' } } : o))
    generateMealTrayImage(
      { dishName: dishLabel },
      (attempt, maxRetries) => {
        setOrders(prev => prev.map(o => o.id === orderId
          ? { ...o, plating: { status: 'loading', note: `Ảnh đang bận, tự thử lại (${attempt}/${maxRetries})...` } }
          : o))
      }
    )
      .then((url) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, plating: { status: 'ready', url } } : o))
      })
      .catch((e) => {
        console.error('[cookingGuide] Vẽ ảnh mâm cơm thất bại:', e?.message || e)
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, plating: { status: 'error' } } : o))
      })
  }, [])

  // Thực thi 1 thao tác nấu lên các nguyên liệu đã chọn — dùng chung cho cả
  // thao tác thủ công lẫn kế hoạch tự nấu của AI.
  const executeAction = useCallback(async (action, ingredientLabels) => {
    const result = await generateCombination(action, ingredientLabels)
    const newItem = { id: nextId('ing'), name: null, label: result.name, emoji: result.emoji }
    setInventory(prev => [...prev, newItem])
    pushTimeline({ action: action.label, ingredients: ingredientLabels, result })
    return newItem
  }, [pushTimeline])

  const handleActionClick = useCallback(async (action) => {
    if (!activeOrder || isBusy) return
    if (action.name === 'pass') {
      const ok = window.confirm(`Bỏ qua đơn "${activeOrder.name}"? Đơn sẽ được đánh dấu là chưa hoàn thành.`)
      if (!ok) return
      setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, status: 'failed' } : o))
      pushTimeline({ text: `🏳️ Đã bỏ qua đơn hàng: ${activeOrder.name}` })
      setActiveOrderId(null)
      setSelectedIds(new Set())
      return
    }
    if (action.name === 'serve') {
      setShowServeBox(true)
      return
    }
    const selectedItems = inventory.filter(i => selectedIds.has(i.id))
    if (selectedItems.length === 0) {
      pushTimeline({ text: `⚠️ Hãy chọn ít nhất 1 nguyên liệu trước khi ${action.label.toLowerCase()}.` })
      return
    }
    setBusyAction(action.name)
    try {
      await executeAction(action, selectedItems.map(i => i.label))
      setSelectedIds(new Set())
    } catch (e) {
      pushTimeline({ text: `❌ Lỗi khi ${action.label.toLowerCase()}: ${e.message}` })
    } finally {
      setBusyAction(null)
    }
  }, [activeOrder, isBusy, inventory, selectedIds, executeAction, pushTimeline])

  const submitServe = useCallback(async () => {
    if (!activeOrder || !serveChoiceId) return
    const item = inventory.find(i => i.id === serveChoiceId)
    if (!item) return
    setBusyAction('serve')
    setShowServeBox(false)
    try {
      const verdict = await verifyServedDish(activeOrder.name, item.label)
      if (verdict.matches) {
        setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, status: 'completed', servedDish: item.label } : o))
        pushTimeline({ text: `✅ Phục vụ "${item.emoji} ${item.label}" — Đạt! ${verdict.explanation}` })
        setActiveOrderId(null)
        generatePlatingImage(activeOrder.id, item.label)
      } else {
        setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, servedDish: item.label } : o))
        pushTimeline({ text: `❌ Phục vụ "${item.emoji} ${item.label}" — Chưa khớp với "${activeOrder.name}". ${verdict.explanation}` })
      }
    } catch (e) {
      pushTimeline({ text: `❌ Lỗi khi thẩm định món ăn: ${e.message}` })
    } finally {
      setBusyAction(null)
      setServeChoiceId('')
    }
  }, [activeOrder, serveChoiceId, inventory, pushTimeline, generatePlatingImage])

  const handleAutoCook = useCallback(async () => {
    if (!activeOrder || isBusy) return
    setAutoCooking(true)
    pushTimeline({ text: `🤖 Nhờ AI lên kế hoạch nấu "${activeOrder.name}"...` })
    try {
      const plan = await planAutoCook({
        orderName: activeOrder.name,
        inventoryLabels: inventory.map(i => i.label),
        actionOptions: COOKING_ACTIONS.filter(a => a.name !== 'serve' && a.name !== 'pass').map(a => `${a.label} (${a.name})`),
      })
      if (plan.steps.length === 0) {
        pushTimeline({ text: '⚠️ AI không lập được kế hoạch cụ thể, bạn thử tự nấu thủ công nhé.' })
        return
      }
      let lastItem = null
      for (const step of plan.steps) {
        const action = findAction(step.action)
        if (!action) continue
        const ingLabels = step.ingredients.length > 0 ? step.ingredients : [inventory[0]?.label].filter(Boolean)
        try {
          // eslint-disable-next-line no-await-in-loop
          lastItem = await executeAction(action, ingLabels)
        } catch (e) {
          pushTimeline({ text: `❌ Bước "${action.label}" gặp lỗi: ${e.message}` })
        }
      }
      if (lastItem) {
        pushTimeline({ text: `🤖 AI đề xuất phục vụ: "${lastItem.emoji} ${lastItem.label}"` })
        try {
          const verdict = await verifyServedDish(activeOrder.name, lastItem.label)
          if (verdict.matches) {
            setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, status: 'completed', servedDish: lastItem.label } : o))
            pushTimeline({ text: `✅ Phục vụ "${lastItem.emoji} ${lastItem.label}" — Đạt! ${verdict.explanation}` })
            setActiveOrderId(null)
            generatePlatingImage(activeOrder.id, lastItem.label)
          } else {
            setOrders(prev => prev.map(o => o.id === activeOrder.id ? { ...o, servedDish: lastItem.label } : o))
            pushTimeline({ text: `❌ "${lastItem.emoji} ${lastItem.label}" chưa khớp với "${activeOrder.name}". ${verdict.explanation}` })
          }
        } catch (e) {
          pushTimeline({ text: `❌ Lỗi khi thẩm định món ăn: ${e.message}` })
        }
      }
    } catch (e) {
      pushTimeline({ text: `❌ Lỗi khi lập kế hoạch tự nấu: ${e.message}` })
    } finally {
      setAutoCooking(false)
    }
  }, [activeOrder, isBusy, inventory, executeAction, pushTimeline, generatePlatingImage])

  const statusLabel = (status) => ({
    completed: '✅ Hoàn thành',
    failed: '❌ Chưa xong',
    in_progress: '🔄 Đang nấu',
    not_started: 'Chưa bắt đầu',
  }[status] || status)

  const difficultyColor = (d) => ({
    easy: good, intermediate: '#f59e0b', difficult: bad, custom: accent,
  }[d] || text3)

  const derivedInventory = useMemo(() => inventory.filter(i => !i.name), [inventory])

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '4px 2px' }}>
      <style>{`
        @keyframes cookingGuideSpin { to { transform: rotate(360deg); } }
        .cg-ing-tile, .cg-action-tile { transition: all .15s; cursor: pointer; }
        .cg-ing-tile:hover, .cg-action-tile:hover { transform: translateY(-2px); }
        .cg-ing-tile:disabled, .cg-action-tile:disabled { cursor: not-allowed; opacity: 0.45; transform: none; }
        .cg-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
        .cg-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); borderRadius: 6px; }
        @media (max-width: 760px) {
          .cg-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            style={{ background: 'transparent', border: `1px solid ${border}`, color: text2, borderRadius: 10, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}
          >
            ← Quay lại
          </button>
        )}
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: text }}>
          🍲 Hướng Dẫn Nấu Ăn Ngon Và Khỏe Mạnh
        </h2>
      </div>
      <p style={{ margin: '4px 2px 16px', fontSize: 13, color: text2, lineHeight: 1.6 }}>
        Chọn một đơn hàng, kết hợp nguyên liệu với thao tác nấu để tạo ra món ăn — AI sẽ tự sáng tạo kết quả
        và thẩm định xem món bạn phục vụ có đúng yêu cầu không. Có thể để AI tự lên kế hoạch nấu giúp bạn.
      </p>

      {/* Đơn hàng */}
      <div style={{ ...panelCard, marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
          📋 Đơn hàng
        </div>
        <div className="cg-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {orders.map(order => {
            const isActive = order.id === activeOrderId
            return (
              <div
                key={order.id}
                style={{
                  width: 140, flexShrink: 0, borderRadius: 12, padding: 12, textAlign: 'center',
                  background: isActive ? 'rgba(0,229,255,0.08)' : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${isActive ? accent : border}`,
                }}
              >
                {order.difficulty && (
                  <div style={{ fontSize: 9, fontWeight: 800, color: difficultyColor(order.difficulty), textTransform: 'uppercase', marginBottom: 4 }}>
                    {order.difficulty}
                  </div>
                )}
                <div style={{ fontSize: 28 }}>{order.emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: text, margin: '4px 0' }}>{order.name}</div>

                {order.status === 'completed' && order.plating?.status === 'loading' && (
                  <div style={{ fontSize: 10, color: accent, margin: '2px 0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <span style={{ display: 'inline-block', animation: 'cookingGuideSpin 1s linear infinite' }}>⏳</span>
                    <span>{order.plating.note || 'Đang vẽ mâm cơm...'}</span>
                  </div>
                )}
                {order.status === 'completed' && order.plating?.status === 'ready' && (
                  <button
                    type="button"
                    onClick={() => setPreviewImage({ url: order.plating.url, title: order.servedDish || order.name })}
                    title="Xem ảnh mâm cơm cỡ lớn"
                    style={{
                      display: 'block', width: '100%', height: 70, margin: '2px 0 6px', padding: 0,
                      border: `1px solid ${border}`, borderRadius: 8, overflow: 'hidden', cursor: 'zoom-in', background: 'none',
                    }}
                  >
                    <img
                      src={order.plating.url}
                      alt={`Mâm cơm: ${order.servedDish || order.name}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </button>
                )}
                {order.status === 'completed' && order.plating?.status === 'error' && (
                  <div style={{ fontSize: 10, color: text3, margin: '2px 0 6px' }}>🖼️ Không tạo được ảnh minh hoạ.</div>
                )}

                <div style={{ fontSize: 11, color: text3, marginBottom: 8 }}>{statusLabel(order.status)}</div>
                {order.status === 'not_started' && (
                  <button
                    type="button"
                    onClick={() => startOrder(order.id)}
                    disabled={isBusy || (activeOrderId && activeOrderId !== order.id)}
                    style={{ width: '100%', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: accent, color: '#04060f' }}
                  >
                    Bắt đầu
                  </button>
                )}
                {isActive && (
                  <button
                    type="button"
                    onClick={handleAutoCook}
                    disabled={isBusy}
                    style={{ width: '100%', border: `1px solid ${accent}`, borderRadius: 8, padding: '6px 0', fontSize: 11, fontWeight: 700, cursor: 'pointer', background: 'transparent', color: accent, marginTop: 4 }}
                  >
                    {autoCooking ? '🤖 Đang nấu...' : '🤖 Nhờ AI tự nấu'}
                  </button>
                )}
              </div>
            )
          })}

          {/* Thêm đơn mới */}
          <div style={{ width: 140, flexShrink: 0, borderRadius: 12, padding: 12, textAlign: 'center', border: `1px dashed ${border}` }}>
            {!showAddOrder ? (
              <button
                type="button"
                onClick={() => setShowAddOrder(true)}
                style={{ background: 'transparent', border: 'none', color: text2, cursor: 'pointer', width: '100%', height: '100%', minHeight: 90 }}
              >
                <div style={{ fontSize: 24 }}>➕</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Thêm đơn mới</div>
              </button>
            ) : (
              <div>
                <input
                  autoFocus
                  value={newOrderName}
                  onChange={(e) => setNewOrderName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && newOrderName.trim()) addOrder(newOrderName.trim()) }}
                  placeholder="Tên món..."
                  style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', borderRadius: 8, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.25)', color: text, fontSize: 12, marginBottom: 6 }}
                />
                <button
                  type="button"
                  disabled={!newOrderName.trim()}
                  onClick={() => addOrder(newOrderName.trim())}
                  style={{ width: '100%', border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: accent, color: '#04060f' }}
                >
                  Thêm
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 14 }} className="cg-grid">
        {/* Trái: nguyên liệu + thao tác */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={panelCard}>
            <div style={{ fontSize: 11, fontWeight: 800, color: text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              🧺 Nguyên liệu {derivedInventory.length > 0 && <span style={{ color: accent }}>· {derivedInventory.length} món tự tạo</span>}
            </div>
            <div className="cg-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 230, overflowY: 'auto' }}>
              {inventory.map(ing => {
                const isSelected = selectedIds.has(ing.id)
                return (
                  <button
                    key={ing.id}
                    className="cg-ing-tile"
                    type="button"
                    onClick={() => toggleIngredient(ing.id)}
                    disabled={!activeOrder || isBusy}
                    title={ing.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999,
                      background: isSelected ? 'rgba(0,229,255,0.16)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isSelected ? accent : border}`, color: text, fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{ing.emoji}</span>
                    <span>{ing.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={panelCard}>
            <div style={{ fontSize: 11, fontWeight: 800, color: text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
              🔧 Thao tác nấu {selectedIds.size > 0 && <span style={{ color: accent }}>· đã chọn {selectedIds.size} nguyên liệu</span>}
            </div>
            <div className="cg-scroll" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 230, overflowY: 'auto' }}>
              {COOKING_ACTIONS.map(action => {
                const isSpecial = action.name === 'serve' || action.name === 'pass'
                const disabled = !activeOrder || isBusy || (!isSpecial && selectedIds.size === 0)
                const isRunning = busyAction === action.name
                return (
                  <button
                    key={action.name}
                    className="cg-action-tile"
                    type="button"
                    onClick={() => handleActionClick(action)}
                    disabled={disabled}
                    title={action.label}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 999,
                      background: action.name === 'pass' ? 'rgba(239,68,68,0.08)' : action.name === 'serve' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${action.name === 'pass' ? bad : action.name === 'serve' ? good : border}`,
                      color: text, fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 15, display: 'inline-block', animation: isRunning ? 'cookingGuideSpin 1s linear infinite' : 'none' }}>
                      {isRunning ? '⏳' : action.emoji}
                    </span>
                    <span>{action.label}</span>
                  </button>
                )
              })}
            </div>

            {showServeBox && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 10, border: `1px solid ${good}`, background: 'rgba(34,197,94,0.06)' }}>
                <div style={{ fontSize: 12, color: text2, marginBottom: 6 }}>Chọn món trong kho để phục vụ đơn "{activeOrder?.name}":</div>
                <select
                  value={serveChoiceId}
                  onChange={(e) => setServeChoiceId(e.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: text, fontSize: 12, marginBottom: 8 }}
                >
                  <option value="">— chọn món —</option>
                  {inventory.map(i => (
                    <option key={i.id} value={i.id}>{i.emoji} {i.label}</option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={submitServe} disabled={!serveChoiceId || isBusy}
                    style={{ flex: 1, border: 'none', borderRadius: 8, padding: '6px 0', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: good, color: '#04060f' }}>
                    ✅ Phục vụ
                  </button>
                  <button type="button" onClick={() => setShowServeBox(false)}
                    style={{ flex: 1, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 0', fontSize: 12, cursor: 'pointer', background: 'transparent', color: text2 }}>
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Phải: nhật ký nấu ăn */}
        <div style={{ ...panelCard, display: 'flex', flexDirection: 'column', maxHeight: 490 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: text2, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
            📖 Nhật ký bếp
          </div>
          <div ref={timelineRef} className="cg-scroll" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {timeline.map(entry => (
              <div key={entry.id} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                {entry.text && <div style={{ color: text2 }}>{entry.text}</div>}
                {entry.action && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ color: accent, fontWeight: 700 }}>
                      {entry.action}({entry.ingredients?.join(', ')})
                    </div>
                    <div style={{ color: text, marginTop: 2 }}>
                      ↳ <span style={{ fontSize: 15 }}>{entry.result?.emoji}</span> {entry.result?.name}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p style={{ margin: '14px 2px 0', fontSize: 10, color: text3 }}>
        Chuyển thể từ demo "Function Call Kitchen" (Google AI Studio) — phần AI ở đây chạy qua máy chủ đề xuất món ăn
        có sẵn của dự án (không cần cấu hình thêm), thay cho Gemini function-calling gốc. Ảnh "mâm cơm" minh hoạ dùng
        chung hạ tầng sinh ảnh của tính năng "Tạo Game bằng Avatar của Tôi".
      </p>

      <NavButtons onNext={onNext} nextLabel={nextLabel} onPrev={onPrev} prevLabel={prevLabel} style={{ marginTop: 24 }} />

      {previewImage && (
        <div
          role="presentation"
          onClick={() => setPreviewImage(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(4,6,15,0.86)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-label={`Mâm cơm: ${previewImage.title}`}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 'min(92vw, 560px)', width: '100%' }}
          >
            <img
              src={previewImage.url}
              alt={`Mâm cơm: ${previewImage.title}`}
              style={{ width: '100%', height: 'auto', borderRadius: 14, border: `1px solid ${border}`, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', display: 'block' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <div style={{ color: text, fontSize: 13, fontWeight: 700 }}>🍽️ {previewImage.title}</div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                style={{ border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: text2 }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
