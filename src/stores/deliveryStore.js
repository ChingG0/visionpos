import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useDeliveryStore = defineStore('deliveryOrders', () => {
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
      deliveryAddress: row.delivery_address,
      items: row.items ?? [], note: row.note,
      subtotal: row.subtotal, total: row.total,
      status: row.status, uberStatus: row.uber_status,
      createdAt: row.created_at,
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
        .from('delivery_orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .order('created_at')
      if (err) throw err
      orders.value = data.map(fromDb)
      loaded = true

      // Realtime：只訂閱自己店的外送訂單
      channel = supabase
        .channel(`delivery_orders_${storeId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'delivery_orders',
          filter: `store_id=eq.${storeId}`,
        }, (payload) => {
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

  function reset() {
    orders.value = []; loaded = false
    if (channel) { supabase.removeChannel(channel); channel = null }
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

  return { orders, loading, error, init, reset, completeOrder, dispose }
})