import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const useReportsStore = defineStore('reports', () => {
  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)

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
      const [t, d, di] = await Promise.all([
        /* 外帶 */
        supabase.from('takeout_orders')
          .select('id, pickup_number, customer_name, items, tags, note, surcharge, discount, subtotal, total, completed_at')
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),

        /* 外送 */
        supabase.from('delivery_orders')
          .select('id, pickup_number, customer_name, delivery_address, items, note, subtotal, total, completed_at')
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),

        /* 內用 */
        supabase.from('dine_in_orders')
          .select('id, seat_id, seat_name, items, tags, note, surcharge, discount, subtotal, total, completed_at')
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),
      ])

      const takeout  = (t.data  ?? []).map(r => ({ ...r, orderType: 'takeout',  typeLabel: '外帶' }))
      const delivery = (d.data  ?? []).map(r => ({ ...r, orderType: 'delivery', typeLabel: '外送' }))
      const dineIn   = (di.data ?? []).map(r => ({
        ...r,
        orderType:     'dine-in',
        typeLabel:     '內用',
        customer_name: r.seat_name,   // 座位名稱當作「客人」欄顯示
      }))

      orders.value = [...takeout, ...delivery, ...dineIn]
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