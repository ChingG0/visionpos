import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

/*
  目前資料來源：
  - takeout_orders（外帶，status='done' 表示已完成）
  - delivery_orders（外送，status='done' 表示已完成）
  - 內用訂單目前尚未建立獨立訂單表，未來加上後這裡一併補入
*/
export const useReportsStore = defineStore('reports', () => {
  const orders  = ref([])   // 合併後的已完成訂單
  const loading = ref(false)
  const error   = ref(null)

  /* 台灣時區 +08:00 的當天起訖 ISO 字串 */
  function toTWRangeISO(dateStr, isEnd) {
    return `${dateStr}T${isEnd ? '23:59:59' : '00:00:00'}+08:00`
  }

  async function fetchOrders(startDate, endDate) {
    loading.value = true
    error.value   = null
    orders.value  = []
    const s = toTWRangeISO(startDate, false)
    const e = toTWRangeISO(endDate,   true)
    try {
      const [t, d] = await Promise.all([
        supabase.from('takeout_orders')
          .select('id, pickup_number, customer_name, items, tags, note, surcharge, discount, subtotal, total, completed_at')
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),
        supabase.from('delivery_orders')
          .select('id, pickup_number, customer_name, delivery_address, items, note, subtotal, total, completed_at')
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),
      ])
      const takeout  = (t.data ?? []).map(r => ({ ...r, orderType: 'takeout',  typeLabel: '外帶' }))
      const delivery = (d.data ?? []).map(r => ({ ...r, orderType: 'delivery', typeLabel: '外送' }))
      orders.value = [...takeout, ...delivery]
        .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
    } catch (err) {
      error.value = err.message
      console.error('[reportsStore]', err)
    } finally {
      loading.value = false
    }
  }

  return { orders, loading, error, fetchOrders }
})