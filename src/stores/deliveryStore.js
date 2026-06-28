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
      id:              row.id,
      pickupNumber:    row.pickup_number,
      uberOrderId:     row.uber_order_id,
      uberStatus:      row.uber_status,
      customerName:    row.customer_name,
      customerPhone:   row.customer_phone,
      deliveryAddress: row.delivery_address,
      items:           row.items ?? [],
      note:            row.note,
      subtotal:        row.subtotal,
      total:           row.total,
      status:          row.status,
      createdAt:       row.created_at,
      source:          row.uber_order_id ? 'uber' : 'manual',
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

      // Realtime
      if (channel) supabase.removeChannel(channel)
      channel = supabase
        .channel(`delivery_orders_${storeId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'delivery_orders',
          filter: `store_id=eq.${storeId}`,
        }, (payload) => {
          // 避免重複
          if (!orders.value.find(o => o.id === payload.new.id)) {
            orders.value.unshift(fromDb(payload.new))
          }
        })
        .subscribe()

    } catch (e) {
      error.value = e.message
      console.error('[deliveryStore] 初始化失敗', e)
    } finally {
      loading.value = false
    }
  }

  function reset() {
    orders.value = []; loaded = false
    if (channel) { supabase.removeChannel(channel); channel = null }
  }

  // 完成訂單
  async function completeOrder(id) {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('delivery_orders')
      .update({ status: 'done', uber_status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) console.error('[deliveryStore] 完成失敗', err)
  }

  // 拒單
  async function rejectOrder(id, reason = '') {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('delivery_orders')
      .update({ status: 'cancelled', uber_status: 'rejected', rejected_reason: reason, completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) console.error('[deliveryStore] 拒單失敗', err)
  }

  // 手動新增 Uber 訂單（API 還沒串接時用）
  async function addManualOrder({ uberOrderId, customerName, customerPhone, deliveryAddress, items, total, note }) {
    const storeId = getStoreId()
    const { data, error: err } = await supabase
      .from('delivery_orders')
      .insert({
        store_id:        storeId,
        uber_order_id:   uberOrderId ?? null,
        uber_status:     'pending',
        customer_name:   customerName ?? null,
        customer_phone:  customerPhone ?? null,
        delivery_address: deliveryAddress ?? null,
        items:           items ?? [],
        subtotal:        total,
        total,
        status:          'pending',
        pickup_number:   uberOrderId?.slice(-5).toUpperCase() ?? null,
        note:            note ?? null,
      })
      .select().single()
    if (err) { console.error('[deliveryStore] 新增失敗', err); return null }
    return fromDb(data)
  }

  function dispose() {
    if (channel) { supabase.removeChannel(channel); channel = null }
  }

  return { orders, loading, error, init, reset, completeOrder, rejectOrder, addManualOrder, dispose }
})