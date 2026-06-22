import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useDineInStore = defineStore('dineInOrders', () => {
  const activeOrders = ref({})
  const loading      = ref(false)

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) {
    return {
      id: row.id, seatId: row.seat_id, seatName: row.seat_name,
      items: row.items ?? [], tags: row.tags ?? [],
      note: row.note, surcharge: row.surcharge, discount: row.discount,
      subtotal: row.subtotal, total: row.total, status: row.status,
      paymentMethod: row.payment_method, paymentAmount: row.payment_amount,
      changeAmount: row.change_amount, createdAt: row.created_at,
    }
  }

  async function init() {
    const storeId = getStoreId()
    if (!storeId) return
    const { data, error } = await supabase
      .from('dine_in_orders')
      .select('*')
      .eq('store_id', storeId)
      .eq('status', 'active')
      .order('created_at')
    if (error) { console.error('[dineInStore] init 失敗', error); return }
    const map = {}
    for (const row of data ?? []) {
      const order = fromDb(row)
      if (!map[order.seatId]) map[order.seatId] = []
      map[order.seatId].push(order)
    }
    activeOrders.value = map
  }

  function reset() { activeOrders.value = {} }

  async function addOrder({ seatId, seatName, items, tags, note, surcharge, discount, subtotal, total, paymentMethod, paymentAmount, changeAmount }) {
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
        status: 'active',
      })
      .select().single()
    if (error) { console.error('[dineInStore] 新增失敗', error); return null }
    const order = fromDb(data)
    if (!activeOrders.value[seatId]) activeOrders.value[seatId] = []
    activeOrders.value[seatId].push(order)
    return order
  }

  function getOrdersBySeatId(seatId) { return activeOrders.value[seatId] ?? [] }
  function getOrderBySeatId(seatId)  { return activeOrders.value[seatId]?.[0] ?? null }

  async function completeOrder(orderId, seatId) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 完成失敗', error); return false }
    const arr = (activeOrders.value[seatId] ?? []).filter(o => o.id !== orderId)
    if (arr.length === 0) { delete activeOrders.value[seatId]; return 'last' }
    activeOrders.value[seatId] = arr
    return 'more'
  }

  async function completeOrders(orderIds, seatId) {
    await Promise.all(orderIds.map(id =>
      supabase.from('dine_in_orders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id)
    ))
    const arr = (activeOrders.value[seatId] ?? []).filter(o => !orderIds.includes(o.id))
    if (arr.length === 0) { delete activeOrders.value[seatId]; return 'last' }
    activeOrders.value[seatId] = arr
    return 'more'
  }

  async function cancelOrder(orderId, seatId, { reason, staff }) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ status: 'cancelled', completed_at: new Date().toISOString(), note: `[取消] 原因：${reason}　操作：${staff}` })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 取消失敗', error); return false }
    const arr = (activeOrders.value[seatId] ?? []).filter(o => o.id !== orderId)
    if (arr.length === 0) { delete activeOrders.value[seatId]; return 'last' }
    activeOrders.value[seatId] = arr
    return 'more'
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

  return { activeOrders, loading, init, reset, addOrder, getOrderBySeatId, getOrdersBySeatId, completeOrder, completeOrders, cancelOrder, markOrdersPaid }
})