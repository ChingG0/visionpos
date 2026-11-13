import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { logOrderChange, summarizeItemsDiff } from '@/lib/orderChangeLog.js'

export const useTakeoutStore = defineStore('takeoutOrders', () => {
  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false
  let   channel = null

  function getStoreId() { return useAuthStore().store?.id ?? null }

  /* 異動紀錄要記是誰操作的，跟內用那邊用同一套規則 */
  function currentStaffLabel() {
    const u = useAuthStore().user
    if (!u) return null
    return u.username ? `${u.name}（${u.username}）` : (u.name ?? null)
  }

  function fromDb(row) {
    return {
      id: row.id, pickupNumber: row.pickup_number,
      customerName: row.customer_name, customerPhone: row.customer_phone,
      items: row.items ?? [], tags: row.tags ?? [],
      note: row.note, surcharge: row.surcharge, discount: row.discount,
      subtotal: row.subtotal, total: row.total, status: row.status,
      createdAt: row.created_at,
      paymentMethod: row.payment_method, paymentAmount: row.payment_amount,
      changeAmount: row.change_amount, card4: row.card4,
      carrierNum: row.carrier_num, buyerTaxId: row.buyer_tax_id,
    }
  }

  async function init() {
    if (loaded) return
    const storeId = getStoreId()
    if (!storeId) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('takeout_orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .order('created_at')
      if (err) throw err
      orders.value = data.map(fromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[takeoutStore] 讀取外帶訂單失敗', e)
    } finally {
      loading.value = false
    }

    // ── Realtime 訂閱（工作站頁面等其他裝置需要即時看到新的外帶訂單/品項變化）──
    if (channel) supabase.removeChannel(channel)
    channel = supabase
      .channel(`takeout_orders_${storeId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'takeout_orders',
        filter: `store_id=eq.${storeId}`,
      }, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload

        if (eventType === 'INSERT') {
          const order = fromDb(newRow)
          if (order.status === 'pending' && !orders.value.some(o => o.id === order.id)) {
            orders.value.push(order)
          }
        }

        if (eventType === 'UPDATE') {
          const order = fromDb(newRow)
          const idx = orders.value.findIndex(o => o.id === order.id)
          if (order.status === 'pending') {
            if (idx >= 0) orders.value[idx] = order
            else orders.value.push(order)
          } else if (idx >= 0) {
            orders.value.splice(idx, 1)
          }
        }

        if (eventType === 'DELETE') {
          orders.value = orders.value.filter(o => o.id !== oldRow.id)
        }
      })
      .subscribe()
  }

  function reset() {
    orders.value = []
    loaded = false
    if (channel) { supabase.removeChannel(channel); channel = null }
  }

  async function addOrder({ items, tags, note, surcharge, discount, subtotal, total, pickupNumber, customerName, customerPhone, paymentMethod, paymentAmount, changeAmount,card4, carrierNum, buyerTaxId }) {
    const storeId = getStoreId()
    const { data, error: err } = await supabase
      .from('takeout_orders')
      .insert({
        store_id: storeId,
        items, tags, note, surcharge, discount, subtotal, total,
        pickup_number:  pickupNumber ?? null,
        customer_name:  customerName  || null,
        customer_phone: customerPhone || null,
        payment_method: paymentMethod || null,
        payment_amount: paymentAmount ?? null,
        change_amount:  changeAmount  ?? null,
        card4:        card4      ?? null,
        carrier_num:  carrierNum ?? null,
        buyer_tax_id: buyerTaxId ?? null,
        status: 'pending',
      })
      .select().single()
    if (err) { console.error('[takeoutStore] 新增外帶訂單失敗', err); return null }
    const newOrder = fromDb(data)
    orders.value.push(newOrder)
    return newOrder
  }

  async function completeOrder(id) {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) console.error('[takeoutStore] 完成外帶訂單失敗', err)
  }

  /** 更新一張外帶訂單的品項內容（例如工作站頁面標示「已出餐」）。 */
  async function updateOrderItems(id, newItems) {
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ items: newItems })
      .eq('id', id)
    if (err) { console.error('[takeoutStore] 更新品項失敗', err); return false }
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx >= 0) orders.value[idx] = { ...orders.value[idx], items: newItems }
    return true
  }

  /** 修改訂單內容（品項／標籤／備註／加價／折扣）。
   *  跟內用的 updateOrderContent same shape——外帶頁的「修改訂單」跳到點餐頁編輯後
   *  會呼叫這支。只動內容，不碰付款欄位、不重新開發票、不重印收據。 */
  async function updateOrderContent(id, { items, tags, note, surcharge, discount, subtotal, total }) {
    const before = orders.value.find(o => o.id === id)

    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ items, tags, note, surcharge, discount, subtotal, total })
      .eq('id', id)
    if (err) { console.error('[takeoutStore] 修改訂單失敗', err); return false }

    const idx = orders.value.findIndex(o => o.id === id)
    if (idx >= 0) orders.value[idx] = { ...orders.value[idx], items, tags, note, surcharge, discount, subtotal, total }

    logOrderChange({
      storeId: getStoreId(), orderType: 'takeout', orderId: id,
      seatName: before?.pickupNumber != null ? `#${String(before.pickupNumber).padStart(2, '0')}` : null,
      action: 'edit', staff: currentStaffLabel(),
      summary: summarizeItemsDiff(before?.items, items),
      before: before ? { items: before.items, subtotal: before.subtotal, total: before.total } : null,
      after:  { items, subtotal, total },
    })
    return true
  }

  /** 取消（刪除）一張還沒取餐的外帶訂單。
   *  跟內用一樣改成 status='cancelled' 而不是真的刪除——報表只抓 'done'，
   *  所以不會計入營業額，但紀錄留著可追查。 */
  async function cancelOrder(id, { reason, staff }) {
    const target = orders.value.find(o => o.id === id)

    const { error: err } = await supabase
      .from('takeout_orders')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        note: `[取消] 原因：${reason}　操作：${staff}`,
      })
      .eq('id', id)
    if (err) { console.error('[takeoutStore] 取消訂單失敗', err); return false }

    logOrderChange({
      storeId: getStoreId(), orderType: 'takeout', orderId: id,
      seatName: target?.pickupNumber != null ? `#${String(target.pickupNumber).padStart(2, '0')}` : null,
      action: 'cancel', staff, reason,
      before: target ? { items: target.items, subtotal: target.subtotal, total: target.total } : null,
    })

    // 不等 Realtime，直接從本地快取移除
    orders.value = orders.value.filter(o => o.id !== id)
    return true
  }

  /** 稍後付款訂單，真正結帳前調整折扣（金額/百分比）；total 由呼叫端算好傳進來。 */
  async function updateOrderDiscount(id, discount, total) {
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ discount, total })
      .eq('id', id)
    if (err) { console.error('[takeoutStore] 更新折扣失敗', err); return false }
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx >= 0) orders.value[idx] = { ...orders.value[idx], discount, total }
    return true
  }

  /** 稍後付款訂單，真正收到款項時寫入付款資訊（不影響 status，取餐完成仍由「完成取餐」處理）。 */
  async function markOrderPaid(id, { methodLabel, paymentAmount, changeAmount, card4, carrierNum, buyerTaxId }) {
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({
        payment_method: methodLabel,
        payment_amount: paymentAmount,
        change_amount:  changeAmount,
        card4:          card4      ?? null,
        carrier_num:    carrierNum ?? null,
        buyer_tax_id:   buyerTaxId ?? null,
      })
      .eq('id', id)
    if (err) { console.error('[takeoutStore] 更新付款資訊失敗', err); return false }
    const idx = orders.value.findIndex(o => o.id === id)
    if (idx >= 0) {
      orders.value[idx] = {
        ...orders.value[idx],
        paymentMethod: methodLabel, paymentAmount, changeAmount, card4, carrierNum, buyerTaxId,
      }
    }
    return true
  }

  return {
    orders, loading, error, init, reset, addOrder, completeOrder,
    updateOrderItems, updateOrderContent, cancelOrder, updateOrderDiscount, markOrderPaid,
  }
})