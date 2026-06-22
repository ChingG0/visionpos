import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useTakeoutStore = defineStore('takeoutOrders', () => {
  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) {
    return {
      id: row.id, pickupNumber: row.pickup_number,
      customerName: row.customer_name, customerPhone: row.customer_phone,
      items: row.items ?? [], tags: row.tags ?? [],
      note: row.note, surcharge: row.surcharge, discount: row.discount,
      subtotal: row.subtotal, total: row.total, status: row.status,
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
        .from('takeout_orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('status', 'pending')
        .order('created_at')
      if (err) throw err
      orders.value = data.map(fromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[takeoutStore] 讀取外帶訂單失敗', e)
    } finally {
      loading.value = false
    }
  }

  function reset() { orders.value = []; loaded = false }

  async function addOrder({ items, tags, note, surcharge, discount, subtotal, total, pickupNumber, customerName, customerPhone, paymentMethod, paymentAmount, changeAmount }) {
    const storeId = getStoreId()
    const { data, error: err } = await supabase
      .from('takeout_orders')
      .insert({
        store_id: storeId,
        items, tags, note, surcharge, discount, subtotal, total,
        pickup_number:  pickupNumber ?? null,
        customer_name:  customerName  || null,
        customer_phone: customerPhone || null,
        payment_method: paymentMethod || null,
        payment_amount: paymentAmount ?? null,
        change_amount:  changeAmount  ?? null,
        status: 'pending',
      })
      .select().single()
    if (err) { console.error('[takeoutStore] 新增外帶訂單失敗', err); return null }
    const newOrder = fromDb(data)
    orders.value.push(newOrder)
    return newOrder
  }

  async function completeOrder(id) {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) console.error('[takeoutStore] 完成外帶訂單失敗', err)
  }

  return { orders, loading, error, init, reset, addOrder, completeOrder }
})