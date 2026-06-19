import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

/* 外送訂單佇列：由 Supabase Edge Function 接收 Uber Eats webhook 後寫入，
   這裡只負責讀取與標記完成，不直接跟 Uber API 溝通 */
export const useDeliveryStore = defineStore('deliveryOrders', () => {

  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false
  let   channel = null   // Supabase Realtime 訂閱（外送需要即時推播，因為訂單是從後端寫入的）

  function fromDb(row) {
    return {
      id:              row.id,
      pickupNumber:    row.pickup_number,
      customerName:    row.customer_name,
      customerPhone:   row.customer_phone,
      deliveryAddress: row.delivery_address,
      items:           row.items ?? [],
      note:            row.note,
      subtotal:        row.subtotal,
      total:           row.total,
      status:          row.status,
      uberStatus:      row.uber_status,
      createdAt:       row.created_at,
    }
  }

  async function init() {
    if (loaded) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('delivery_orders')
        .select('*')
        .eq('status', 'pending')
        .order('created_at')
      if (err) throw err
      orders.value = data.map(fromDb)
      loaded = true

      /* ── Supabase Realtime：外送訂單是後端寫入的，前端不知道什麼時候來，
            要靠即時推播而不是輪詢，否則新訂單要重新整理才能看到 ── */
      channel = supabase
        .channel('delivery_orders_changes')
        .on('postgres_changes', {
          event:  'INSERT',
          schema: 'public',
          table:  'delivery_orders',
        }, (payload) => {
          /* 新訂單進來，直接加到本地佇列最前面 */
          orders.value.unshift(fromDb(payload.new))
        })
        .subscribe()

    } catch (e) {
      error.value = e.message
      console.error('[deliveryStore] 讀取外送訂單失敗', e)
    } finally {
      loading.value = false
    }
  }

  async function completeOrder(id) {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('delivery_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) console.error('[deliveryStore] 完成外送訂單失敗', err)
  }

  function dispose() {
    if (channel) { supabase.removeChannel(channel); channel = null }
  }

  return { orders, loading, error, init, completeOrder, dispose }
})