import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

/* 「營運報表 → 點餐紀錄」讀取用。寫入的地方在 dineInStore.cancelOrder /
 * updateOrderContent（透過 src/lib/orderChangeLog.js 的 logOrderChange）。 */
export const useOrderChangeLogStore = defineStore('orderChangeLogs', () => {
  function getStoreId() { return useAuthStore().store?.id ?? null }

  async function fetchLogs(startDate, endDate) {
    const storeId = getStoreId()
    if (!storeId) return []
    const s = `${startDate}T00:00:00+08:00`
    const e = `${endDate}T23:59:59+08:00`
    const { data, error } = await supabase
      .from('order_change_logs')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', s)
      .lte('created_at', e)
      .order('created_at', { ascending: false })
    if (error) { console.error('[orderChangeLogStore] 讀取失敗', error); return [] }
    return data ?? []
  }

  return { fetchLogs }
})
