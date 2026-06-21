import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const useDineInStore = defineStore('dineInOrders', () => {

  /* key = seat_id, value = order[]（支援同桌多張單）*/
  const activeOrders = ref({})
  const loading      = ref(false)

  function fromDb(row) {
    return {
      id:            row.id,
      seatId:        row.seat_id,
      seatName:      row.seat_name,
      items:         row.items      ?? [],
      tags:          row.tags       ?? [],
      note:          row.note,
      surcharge:     row.surcharge,
      discount:      row.discount,
      subtotal:      row.subtotal,
      total:         row.total,
      status:        row.status,
      paymentMethod: row.payment_method,
      paymentAmount: row.payment_amount,
      changeAmount:  row.change_amount,
      createdAt:     row.created_at,
    }
  }

  /* 啟動時載入所有 active 訂單，支援同桌多張 */
  async function init() {
    const { data, error } = await supabase
      .from('dine_in_orders')
      .select('*')
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

  /* 新增訂單（同桌可以有多張） */
  async function addOrder({ seatId, seatName, items, tags, note, surcharge, discount, subtotal, total, paymentMethod, paymentAmount, changeAmount }) {
    const { data, error } = await supabase
      .from('dine_in_orders')
      .insert({
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

  /* 取得同桌所有 active 訂單 */
  function getOrdersBySeatId(seatId) { return activeOrders.value[seatId] ?? [] }

  /* 相容舊介面，取第一筆 */
  function getOrderBySeatId(seatId)  { return activeOrders.value[seatId]?.[0] ?? null }

  /* 完成單張訂單 → 回傳 'last'(座位可清空) 或 'more'(仍有其他單) */
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

  /* 合併結帳：一次完成多張訂單 */
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

  /* 取消訂單 */
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

  return { activeOrders, loading, init, addOrder, getOrderBySeatId, getOrdersBySeatId, completeOrder, completeOrders, cancelOrder }
})