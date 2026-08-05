import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { logOrderChange, summarizeItemsDiff } from '@/lib/orderChangeLog.js'

/* 目前登入帳號的顯示標籤，跟 SeatOrderModal 的 currentStaffLabel 用同一套規則，
 * 寫進 order_change_logs.staff 讓「點餐紀錄」報表看得出是誰操作的。 */
function currentStaffLabel() {
  const u = useAuthStore().user
  if (!u) return null
  return u.username ? `${u.name}（${u.username}）` : (u.name ?? null)
}

export const useDineInStore = defineStore('dineInOrders', () => {
  const activeOrders = ref({})
  const loading      = ref(false)
  let   channel      = null

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) {
    return {
      id: row.id, seatId: row.seat_id, seatName: row.seat_name,
      items: row.items ?? [], tags: row.tags ?? [],
      note: row.note, surcharge: row.surcharge, discount: row.discount,
      subtotal: row.subtotal, total: row.total, status: row.status,
      paymentMethod: row.payment_method, paymentAmount: row.payment_amount,
      changeAmount: row.change_amount, createdAt: row.created_at,
      card4: row.card4, carrierNum: row.carrier_num, buyerTaxId: row.buyer_tax_id,
    }
  }

  function applyOrder(order) {
    if (!activeOrders.value[order.seatId]) activeOrders.value[order.seatId] = []
    const arr = activeOrders.value[order.seatId]
    const idx = arr.findIndex(o => o.id === order.id)
    if (idx >= 0) arr[idx] = order
    else arr.push(order)
  }

  function removeOrder(orderId, seatId) {
    const arr = (activeOrders.value[seatId] ?? []).filter(o => o.id !== orderId)
    if (arr.length === 0) delete activeOrders.value[seatId]
    else activeOrders.value[seatId] = arr
  }

  async function init() {
    const storeId = getStoreId()
    if (!storeId) return
    loading.value = true

    const { data, error } = await supabase
      .from('dine_in_orders')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('created_at')

    if (error) { console.error('[dineInStore] init 失敗', error); loading.value = false; return }

    const map = {}
    for (const row of data ?? []) {
      const order = fromDb(row)
      if (!map[order.seatId]) map[order.seatId] = []
      map[order.seatId].push(order)
    }
    activeOrders.value = map
    loading.value = false

    // ── Realtime 訂閱（多人即時同步）────────────────────────────────────────
    if (channel) supabase.removeChannel(channel)

    channel = supabase
      .channel(`dine_in_orders_${storeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'dine_in_orders',
        filter: `store_id=eq.${storeId}`,
      }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload

        if (eventType === 'INSERT') {
          const order = fromDb(newRow)
          if (order.status === 'active') applyOrder(order)
        }

        if (eventType === 'UPDATE') {
          const order = fromDb(newRow)
          if (order.status === 'active') {
            applyOrder(order)
          } else {
            // 完成或取消 → 從 activeOrders 移除
            removeOrder(order.id, order.seatId)
          }
        }

        if (eventType === 'DELETE') {
          const seatId = oldRow.seat_id
          const orderId = oldRow.id
          removeOrder(orderId, seatId)
        }
      })
      .subscribe()
  }

  function reset() {
    activeOrders.value = {}
    if (channel) { supabase.removeChannel(channel); channel = null }
  }

  async function addOrder({ seatId, seatName, items, tags, note, surcharge, discount, subtotal, total, paymentMethod, paymentAmount, changeAmount, card4, carrierNum, buyerTaxId }) {
    const storeId = getStoreId()
    const { data, error } = await supabase
      .from('dine_in_orders')
      .insert({
        store_id: storeId,
        seat_id: seatId, seat_name: seatName,
        items, tags, note, surcharge, discount, subtotal, total,
        payment_method: paymentMethod || null,
        payment_amount: paymentAmount ?? null,
        change_amount:  changeAmount  ?? null,
        card4:          card4      ?? null,
        carrier_num:    carrierNum ?? null,
        buyer_tax_id:   buyerTaxId ?? null,
        status: 'active',
      })
      .select().single()
    if (error) { console.error('[dineInStore] 新增失敗', error); return null }
    // Realtime 會自動更新 activeOrders，不需要手動 push
    return fromDb(data)
  }

  function getOrdersBySeatId(seatId) { return activeOrders.value[seatId] ?? [] }
  function getOrderBySeatId(seatId)  { return activeOrders.value[seatId]?.[0] ?? null }

  /** 完成一張或多張訂單（併單結帳時務必把整組已付款的訂單一次傳進來，
   *  不然併單裡除了目前這張，其他張會卡在 active 狀態，永遠不會進報表）。
   *  回傳 'last'：這桌已無其他 active 訂單；'more'：桌上還有其他未結的訂單。 */
  async function completeOrders(orderIds, seatId) {
    const ids = [...new Set(orderIds)]
    if (ids.length === 0) return 'last'
    const results = await Promise.all(ids.map(id =>
      supabase.from('dine_in_orders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id)
    ))
    const firstError = results.find(r => r.error)?.error
    if (firstError) console.error('[dineInStore] 完成失敗', firstError)

    // 不等 Realtime 回來，直接把本地快取同步移除，避免時間差
    for (const id of ids) removeOrder(id, seatId)

    const remaining = activeOrders.value[seatId] ?? []
    return remaining.length === 0 ? 'last' : 'more'
  }

  async function completeOrder(orderId, seatId) {
    return completeOrders([orderId], seatId)
  }

  /** 取消單一分單。回傳 'last'：這桌已無其他 active 訂單（可以把桌況重置成空位）；
   *  'more'：桌上還有其他未結的分單，桌況要維持原狀，不能因為刪掉其中一張就變空位。
   *  之前這裡固定回傳 'last'，導致刪除任何一張分單（不管桌上還有沒有其他分單）
   *  呼叫端都會把整桌重置成空位——多分單只剩其中幾張時會整桌憑空消失。 */
  async function cancelOrder(orderId, seatId, { reason, staff }) {
    // 取消前先留一份快照，寫進異動紀錄用（取消之後本地快取就沒有這筆了）
    const target = (activeOrders.value[seatId] ?? []).find(o => o.id === orderId)

    const { error } = await supabase
      .from('dine_in_orders')
      .update({ status: 'cancelled', completed_at: new Date().toISOString(), note: `[取消] 原因：${reason}　操作：${staff}` })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 取消失敗', error); return false }

    logOrderChange({
      storeId: getStoreId(), orderType: 'dine_in', orderId, seatName: target?.seatName,
      action: 'cancel', staff, reason,
      before: target ? { items: target.items, subtotal: target.subtotal, total: target.total } : null,
    })

    // 不等 Realtime 回來，直接把本地快取同步移除，避免時間差
    removeOrder(orderId, seatId)

    const remaining = activeOrders.value[seatId] ?? []
    return remaining.length === 0 ? 'last' : 'more'
  }

  /** 供呼叫端在還沒等到 Realtime 回來前，先把本地快取的訂單移除
   *  （例如併單時，被併入主單的其他訂單要立即從畫面上消失）。 */
  function removeOrderLocal(orderId, seatId) {
    removeOrder(orderId, seatId)
  }

  /** 直接把任意欄位 patch 進本地快取的某張訂單（camelCase key），
   *  不用等 Realtime 回來才看到最新內容（例如併單合併後的品項/金額）。 */
  function patchOrderLocal(seatId, orderId, patch) {
    const arr = activeOrders.value[seatId]
    if (!arr) return
    const idx = arr.findIndex(o => o.id === orderId)
    if (idx >= 0) arr[idx] = { ...arr[idx], ...patch }
  }

  /** 更新一張訂單的品項內容（例如工作站頁面標示「已出餐」）。
   *  只更新 items 欄位，不動其他金額/狀態；本地快取同步更新，收銀台等其他畫面
   *  若沒特別讀 served 欄位就完全不受影響。 */
  async function updateOrderItems(orderId, seatId, newItems) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ items: newItems })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 更新品項失敗', error); return false }
    patchOrderLocal(seatId, orderId, { items: newItems })
    return true
  }

  /** 修改訂單內容（品項/標籤/備註/加價/折扣/金額）。
   *  只給「還沒結帳」的訂單用，不動 status / 付款欄位。
   *  修改前的內容還留在本地快取裡（還沒 patch），拿來跟修改後比對寫進異動紀錄。 */
  async function updateOrderContent(orderId, seatId, { items, tags, note, surcharge, discount, subtotal, total }) {
    const before = (activeOrders.value[seatId] ?? []).find(o => o.id === orderId)

    const { error } = await supabase
      .from('dine_in_orders')
      .update({ items, tags, note, surcharge, discount, subtotal, total })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 修改訂單失敗', error); return false }
    patchOrderLocal(seatId, orderId, { items, tags, note, surcharge, discount, subtotal, total })

    logOrderChange({
      storeId: getStoreId(), orderType: 'dine_in', orderId, seatName: before?.seatName,
      action: 'edit', staff: currentStaffLabel(),
      summary: summarizeItemsDiff(before?.items, items),
      before: before ? { items: before.items, subtotal: before.subtotal, total: before.total } : null,
      after:  { items, subtotal, total },
    })

    return true
  }

  /** 稍後付款訂單，真正結帳前調整折扣（金額/百分比）；total 由呼叫端算好傳進來。 */
  async function updateOrderDiscount(orderId, seatId, discount, total) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ discount, total })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 更新折扣失敗', error); return false }
    patchOrderLocal(seatId, orderId, { discount, total })
    return true
  }

  function markOrdersPaid(seatId, orderIds, methodLabel, paymentAmount, changeAmount) {
    const idSet = new Set(orderIds.map(String))
    if (!activeOrders.value[seatId]) return
    activeOrders.value[seatId] = activeOrders.value[seatId].map(o =>
      idSet.has(String(o.id))
        ? { ...o, paymentMethod: methodLabel, paymentAmount, changeAmount }
        : o
    )
  }

  return {
    activeOrders, loading,
    init, reset, addOrder,
    getOrderBySeatId, getOrdersBySeatId,
    completeOrder, completeOrders, cancelOrder, markOrdersPaid, removeOrderLocal, patchOrderLocal, updateOrderItems, updateOrderDiscount, updateOrderContent,
  }
})