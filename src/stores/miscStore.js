// =============================================================================
// miscStore.js — 雜項收支
//
// 店家零星的現金進出（例如臨時去買備品）。交班/關帳時：
//   實收現金 = 現金訂單總額 ＋ 雜項收入 − 雜項支出
// =============================================================================
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useMiscStore = defineStore('miscTransactions', () => {
  const items   = ref([])
  const loading = ref(false)

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) {
    return {
      id: row.id, kind: row.kind, amount: Number(row.amount),
      note: row.note, staffName: row.staff_name, createdAt: row.created_at,
    }
  }

  /** 讀取某段期間的雜項收支（不給範圍就抓最近 100 筆） */
  async function fetchRange(startISO = null, endISO = null) {
    const storeId = getStoreId()
    if (!storeId) return []
    loading.value = true
    try {
      let q = supabase
        .from('misc_transactions')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
      if (startISO) q = q.gte('created_at', startISO)
      if (endISO)   q = q.lte('created_at', endISO)
      else          q = q.limit(100)

      const { data, error } = await q
      if (error) throw error
      const list = (data ?? []).map(fromDb)
      items.value = list
      return list
    } catch (e) {
      console.error('[miscStore] 讀取雜項收支失敗', e)
      return []
    } finally {
      loading.value = false
    }
  }

  async function addTransaction({ kind, amount, note }) {
    const storeId = getStoreId()
    if (!storeId) return null
    const staffName = useAuthStore().user?.name ?? ''
    const { data, error } = await supabase
      .from('misc_transactions')
      .insert({ store_id: storeId, kind, amount, note: note || null, staff_name: staffName })
      .select().single()
    if (error) { console.error('[miscStore] 新增雜項收支失敗', error); return null }
    const row = fromDb(data)
    items.value.unshift(row)
    return row
  }

  async function deleteTransaction(id) {
    const storeId = getStoreId()
    const { error } = await supabase
      .from('misc_transactions').delete().eq('id', id).eq('store_id', storeId)
    if (error) { console.error('[miscStore] 刪除雜項收支失敗', error); return false }
    items.value = items.value.filter(i => i.id !== id)
    return true
  }

  /** 某段期間的收入/支出加總，交班結算用 */
  async function sumRange(startISO, endISO) {
    const list = await fetchRange(startISO, endISO)
    const income  = list.filter(i => i.kind === 'income').reduce((s, i) => s + i.amount, 0)
    const expense = list.filter(i => i.kind === 'expense').reduce((s, i) => s + i.amount, 0)
    return { income, expense, list }
  }

  function reset() { items.value = [] }

  return { items, loading, fetchRange, addTransaction, deleteTransaction, sumRange, reset }
})
