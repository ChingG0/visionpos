import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

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

  async function completeOrder(orderId, seatId) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 完成失敗', error); return false }
    // Realtime 會自動移除
    return 'last'
  }

  async function completeOrders(orderIds, seatId) {
    await Promise.all(orderIds.map(id =>
      supabase.from('dine_in_orders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id)
    ))
    return 'last'
  }

  async function cancelOrder(orderId, seatId, { reason, staff }) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ status: 'cancelled', completed_at: new Date().toISOString(), note: `[取消] 原因：${reason}　操作：${staff}` })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 取消失敗', error); return false }
    return 'last'
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
    completeOrder, completeOrders, cancelOrder, markOrdersPaid,
  }
})