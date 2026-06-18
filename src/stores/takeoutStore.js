import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

/* 外帶訂單佇列：點餐頁送出外帶單後進這裡，外帶頁負責叫號/完成 */
export const useTakeoutStore = defineStore('takeoutOrders', () => {

  const orders  = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function fromDb(row) {
    return {
      id:        row.id,
      items:     row.items ?? [],
      tags:      row.tags ?? [],
      note:      row.note,
      surcharge: row.surcharge,
      discount:  row.discount,
      subtotal:  row.subtotal,
      total:     row.total,
      status:    row.status,
      createdAt: row.created_at,
    }
  }

  /* 只讀取還在等待中的外帶單（已完成的不需要顯示在佇列） */
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

  /* 點餐頁送出外帶單時呼叫 */
  async function addOrder({ items, tags, note, surcharge, discount, subtotal, total }) {
    const { data, error: err } = await supabase
      .from('takeout_orders')
      .insert({ items, tags, note, surcharge, discount, subtotal, total, status: 'pending' })
      .select()
      .single()
    if (err) { console.error('[takeoutStore] 新增外帶訂單失敗', err); return null }
    const newOrder = fromDb(data)
    orders.value.push(newOrder)
    return newOrder
  }

  /* 外帶頁按「完成」時呼叫 */
  async function completeOrder(id) {
    orders.value = orders.value.filter(o => o.id !== id)
    const { error: err } = await supabase
      .from('takeout_orders')
      .update({ status: 'done' })
      .eq('id', id)
    if (err) console.error('[takeoutStore] 完成外帶訂單失敗', err)
  }

  return { orders, loading, error, init, addOrder, completeOrder }
})