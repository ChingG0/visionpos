import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const useTakeoutStore = defineStore('takeoutOrders', () => {

  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function fromDb(row) {
    return {
      id:            row.id,
      pickupNumber:  row.pickup_number,
      customerName:  row.customer_name,
      customerPhone: row.customer_phone,
      items:         row.items ?? [],
      tags:          row.tags ?? [],
      note:          row.note,
      surcharge:     row.surcharge,
      discount:      row.discount,
      subtotal:      row.subtotal,
      total:         row.total,
      status:        row.status,
      createdAt:     row.created_at,
    }
  }

  async function init() {
    if (loaded) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('takeout_orders')
        .select('*')
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

  async function addOrder({ items, tags, note, surcharge, discount, subtotal, total, pickupNumber, customerName, customerPhone }) {
    const { data, error: err } = await supabase
      .from('takeout_orders')
      .insert({
        items, tags, note, surcharge, discount, subtotal, total,
        pickup_number:  pickupNumber ?? null,
        customer_name:  customerName  || null,
        customer_phone: customerPhone || null,
        status: 'pending',
      })
      .select()
      .single()
    if (err) { console.error('[takeoutStore] 新增外帶訂單失敗', err); return null }
    const newOrder = fromDb(data)
    orders.value.push(newOrder)
    return newOrder
  }

  /* 完成取餐：記錄 completed_at 供報表使用，然後從本地佇列移除 */
  async function completeOrder(id) {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id)
    if (err) console.error('[takeoutStore] 完成外帶訂單失敗', err)
  }

  return { orders, loading, error, init, addOrder, completeOrder }
})