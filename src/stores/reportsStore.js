import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { isUnpaidOrder } from '@/lib/orderPayment.js'

export const useReportsStore = defineStore('reports', () => {
  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)

  // 「稍後付款」的訂單雖然已經出餐完成，但錢還沒收到，屬於應收未收，
  // 不能算進營收。等實際收款時 payment_method 會被改成現金/信用卡等，
  // 那時才會被算進來。交易紀錄頁仍然要看得到這些單（店家要追款），
  // 所以只在營收類報表改用 paidOrders。
  const paidOrders   = computed(() => orders.value.filter(o => !isUnpaidOrder(o)))
  const unpaidOrders = computed(() => orders.value.filter(o =>  isUnpaidOrder(o)))

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function toTWRangeISO(dateStr, isEnd) {
    return `${dateStr}T${isEnd ? '23:59:59' : '00:00:00'}+08:00`
  }

  async function fetchOrders(startDate, endDate) {
    const storeId = getStoreId()
    if (!storeId) return

    loading.value = true
    error.value   = null
    orders.value  = []
    const s = toTWRangeISO(startDate, false)
    const e = toTWRangeISO(endDate,   true)

    try {
      const [t, d, di] = await Promise.all([
        supabase.from('takeout_orders')
          .select('id, pickup_number, customer_name, items, tags, note, surcharge, discount, subtotal, total, completed_at, payment_method, payment_amount, change_amount, card4, carrier_num, buyer_tax_id')
          .eq('store_id', storeId)
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),

        supabase.from('delivery_orders')
          .select('id, pickup_number, customer_name, delivery_address, items, note, subtotal, total, completed_at, payment_method')
          .eq('store_id', storeId)
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),

        supabase.from('dine_in_orders')
          .select('id, seat_id, seat_name, items, tags, note, surcharge, discount, subtotal, total, completed_at, payment_method, payment_amount, change_amount, card4, carrier_num, buyer_tax_id')
          .eq('store_id', storeId)
          .eq('status', 'done')
          .gte('completed_at', s).lte('completed_at', e)
          .order('completed_at'),
      ])

      const takeout  = (t.data  ?? []).map(r => ({ ...r, orderType: 'takeout',  typeLabel: '外帶' }))
      const delivery = (d.data  ?? []).map(r => ({ ...r, orderType: 'delivery', typeLabel: '外送' }))
      const dineIn   = (di.data ?? []).map(r => ({
        ...r, orderType: 'dine-in', typeLabel: '內用',
        customer_name: r.seat_name,
      }))

      orders.value = [...takeout, ...delivery, ...dineIn]
        .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
    } catch (err) {
      error.value = err.message
    } finally {
      loading.value = false
    }
  }

  return { orders, paidOrders, unpaidOrders, loading, error, fetchOrders }
})