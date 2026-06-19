import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const useDineInStore = defineStore('dineInOrders', () => {

  /* key = seat_id, value = order object（同一個座位同時只會有一筆 active 訂單） */
  const activeOrders = ref({})
  const loading      = ref(false)

  function fromDb(row) {
    return {
      id:        row.id,
      seatId:    row.seat_id,
      seatName:  row.seat_name,
      items:     row.items ?? [],
      tags:      row.tags  ?? [],
      note:      row.note,
      surcharge: row.surcharge,
      discount:  row.discount,
      subtotal:  row.subtotal,
      total:     row.total,
      status:    row.status,
      createdAt: row.created_at,
    }
  }

  /* 啟動時把所有 active 的內用訂單載入，讓座位圖可以查 */
  async function init() {
    const { data, error } = await supabase
      .from('dine_in_orders')
      .select('*')
      .eq('status', 'active')
    if (error) { console.error('[dineInStore] init 失敗', error); return }
    const map = {}
    for (const row of data) map[row.seat_id] = fromDb(row)
    activeOrders.value = map
  }

  /* 點餐頁送出內用訂單時呼叫 */
  async function addOrder({ seatId, seatName, items, tags, note, surcharge, discount, subtotal, total }) {
    const { data, error } = await supabase
      .from('dine_in_orders')
      .insert({ seat_id: seatId, seat_name: seatName, items, tags, note, surcharge, discount, subtotal, total, status: 'active' })
      .select().single()
    if (error) { console.error('[dineInStore] 新增失敗', error); return null }
    const order = fromDb(data)
    activeOrders.value[seatId] = order
    return order
  }

  /* 取得某個座位的 active 訂單（供座位圖點擊查詢用） */
  function getOrderBySeatId(seatId) {
    return activeOrders.value[seatId] ?? null
  }

  /* 完成結帳：標記 done、記錄 completed_at、從本地移除 */
  async function completeOrder(orderId, seatId) {
    const { error } = await supabase
      .from('dine_in_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', orderId)
    if (error) { console.error('[dineInStore] 完成失敗', error); return false }
    delete activeOrders.value[seatId]
    return true
  }

  return { activeOrders, loading, init, addOrder, getOrderBySeatId, completeOrder }
})