// =============================================================================
// shiftStore.js — 交班 / 關帳
//
// 累計期間的定義：從「上一次關帳」到現在。
//   交班（shift）   ：檢視這段期間的累計、留下紀錄、登出，但不重置期間。
//   關帳（closeout）：同樣檢視與紀錄，但會把期間結束掉，下次從 0 開始累計。
//
// 所以同一個關帳期間內可以有很多次交班，每次交班看到的都是「這個班到目前
// 為止整間店的累計」，而不是單一個人的業績——這是店家對帳時要的數字。
// =============================================================================
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { useMiscStore } from '@/stores/miscStore.js'
import { isUnpaidOrder, paymentLabel } from '@/lib/orderPayment.js'

export const useShiftStore = defineStore('shifts', () => {
  const loading = ref(false)

  function getStoreId() { return useAuthStore().store?.id ?? null }

  /** 目前這個累計期間的起點：上一次關帳的結束時間；從來沒關過帳就回 null（代表全部） */
  async function getPeriodStart() {
    const storeId = getStoreId()
    if (!storeId) return null
    const { data, error } = await supabase
      .from('shift_records')
      .select('period_end')
      .eq('store_id', storeId)
      .eq('kind', 'closeout')
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) { console.error('[shiftStore] 讀取上次關帳時間失敗', error); return null }
    return data?.period_end ?? null
  }

  /** 結算目前累計期間的數字（不寫入，只計算，給交班/關帳畫面預覽用） */
  async function calculateSummary() {
    const storeId = getStoreId()
    if (!storeId) return null
    loading.value = true
    try {
      const periodStart = await getPeriodStart()
      const periodEnd   = new Date().toISOString()

      const applyRange = (q) => {
        let out = q.eq('store_id', storeId).eq('status', 'done').lte('completed_at', periodEnd)
        if (periodStart) out = out.gt('completed_at', periodStart)
        return out
      }

      const [t, d, di] = await Promise.all([
        applyRange(supabase.from('takeout_orders').select('total, payment_method, completed_at')),
        applyRange(supabase.from('delivery_orders').select('total, payment_method, completed_at')),
        applyRange(supabase.from('dine_in_orders').select('total, payment_method, completed_at')),
      ])

      const allOrders = [...(t.data ?? []), ...(d.data ?? []), ...(di.data ?? [])]

      // 「稍後付款」是已出餐但錢還沒收到（應收未收），不能算進營收。
      // 獨立列出來讓店員知道有多少款項要追，實際收款後 payment_method
      // 會變成現金/信用卡等，那時才會進營收。
      const unpaid = allOrders.filter(o => isUnpaidOrder(o))
      const orders = allOrders.filter(o => !isUnpaidOrder(o))

      const orderCount   = orders.length
      const totalRevenue = orders.reduce((s, o) => s + Number(o.total ?? 0), 0)

      const unpaidCount  = unpaid.length
      const unpaidAmount = unpaid.reduce((s, o) => s + Number(o.total ?? 0), 0)

      // 各付款方式加總。沒填付款方式的歸到「未記錄」，才不會憑空少一筆。
      const breakdown = {}
      for (const o of orders) {
        breakdown[paymentLabel(o)] = (breakdown[paymentLabel(o)] ?? 0) + Number(o.total ?? 0)
      }
      const cashOrders = breakdown['現金'] ?? 0

      // 雜項收支同樣只算這個期間內的
      const misc = await useMiscStore().sumRange(periodStart, periodEnd)

      return {
        periodStart, periodEnd,
        orderCount, totalRevenue,
        unpaidCount, unpaidAmount,
        breakdown,
        cashOrders,
        miscIncome:  misc.income,
        miscExpense: misc.expense,
        miscList:    misc.list,
        cashActual:  cashOrders + misc.income - misc.expense,
      }
    } catch (e) {
      console.error('[shiftStore] 結算失敗', e)
      return null
    } finally {
      loading.value = false
    }
  }

  /** 寫入一筆交班或關帳紀錄。kind: 'shift' | 'closeout' */
  async function saveRecord(kind, summary, note = '') {
    const storeId = getStoreId()
    if (!storeId || !summary) return false
    const user = useAuthStore().user
    const { error } = await supabase.from('shift_records').insert({
      store_id:          storeId,
      kind,
      staff_id:          user?.id ?? null,
      staff_name:        user?.name ?? '',
      // 從來沒關過帳的話，起點就用這次結算的最早時間點；沒有訂單就用結束時間
      period_start:      summary.periodStart ?? summary.periodEnd,
      period_end:        summary.periodEnd,
      order_count:       summary.orderCount,
      total_revenue:     summary.totalRevenue,
      unpaid_count:      summary.unpaidCount,
      unpaid_amount:     summary.unpaidAmount,
      payment_breakdown: summary.breakdown,
      cash_orders:       summary.cashOrders,
      misc_income:       summary.miscIncome,
      misc_expense:      summary.miscExpense,
      cash_actual:       summary.cashActual,
      note:              note || null,
    })
    if (error) { console.error('[shiftStore] 寫入交班紀錄失敗', error); return false }
    return true
  }

  /** 後台報表用：讀取交班/關帳歷史 */
  async function fetchRecords(startDate, endDate) {
    const storeId = getStoreId()
    if (!storeId) return []
    const s = `${startDate}T00:00:00+08:00`
    const e = `${endDate}T23:59:59+08:00`
    const { data, error } = await supabase
      .from('shift_records')
      .select('*')
      .eq('store_id', storeId)
      .gte('created_at', s)
      .lte('created_at', e)
      .order('created_at', { ascending: false })
    if (error) { console.error('[shiftStore] 讀取交班紀錄失敗', error); return [] }
    return data ?? []
  }

  return { loading, getPeriodStart, calculateSummary, saveRecord, fetchRecords }
})
