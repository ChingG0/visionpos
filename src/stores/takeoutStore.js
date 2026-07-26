import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useTakeoutStore = defineStore('takeoutOrders', () => {
  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false
  let   channel = null

  function getStoreId() { return useAuthStore().store?.id ?? null }

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
    updateOrderItems, updateOrderDiscount, markOrderPaid,
  }
})