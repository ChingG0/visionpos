// =============================================================================
// uberStore.js — Uber Eats 訂單與品項（由對帳 CSV 匯入的資料）
//
// 跟自家訂單分開放的原因：Uber 的「顧客付的金額」不等於「你拿到的金額」，實測
// 平台抽走約 39%。混進 reportsStore 的話，營收總覽的總額會高估實際入袋，而且
// 錯得很安靜。所以獨立成兩個報表 tab，數字各自表述。
// =============================================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useUberStore = defineStore('uber', () => {
  const orders  = ref([])
  const items   = ref([])
  const loading = ref(false)
  const error   = ref('')

  function getStoreId() { return useAuthStore().store?.id ?? null }

  /** startDate / endDate 是 yyyy-MM-dd。ordered_on 是 date 欄位，直接比就好，
   *  不用像自家訂單那樣處理時區（Uber 給的本來就是門市當地日期）。 */
  async function fetchRange(startDate, endDate) {
    const storeId = getStoreId()
    if (!storeId) return

    loading.value = true
    error.value   = ''
    try {
      const [o, i] = await Promise.all([
        supabase.from('uber_orders')
          .select('*')
          .eq('store_id', storeId)
          .gte('ordered_on', startDate).lte('ordered_on', endDate)
          .order('ordered_on'),
        supabase.from('uber_order_items')
          .select('*')
          .eq('store_id', storeId)
          .gte('ordered_on', startDate).lte('ordered_on', endDate),
      ])
      if (o.error) throw o.error
      if (i.error) throw i.error
      orders.value = o.data ?? []
      items.value  = i.data ?? []
    } catch (e) {
      console.error('[uberStore] 讀取失敗', e)
      error.value = e?.message ?? '讀取失敗'
      orders.value = []
      items.value  = []
    } finally {
      loading.value = false
    }
  }

  /* 取消／退款的單不算營收。Uber 的狀態字串是中文的「已完成」。 */
  const completed = computed(() => orders.value.filter(o => o.status === '已完成'))

  const sum = (list, k) => list.reduce((s, r) => s + Number(r[k] ?? 0), 0)

  const totals = computed(() => {
    const c = completed.value
    const gross = sum(c, 'gross_incl_tax')
    const net   = sum(c, 'net_payout')
    return {
      count:       c.length,
      gross,
      discount:    sum(c, 'item_discount'),
      marketing:   sum(c, 'marketing_adj'),
      orderTotal:  sum(c, 'order_total'),
      platformFee: sum(c, 'platform_fee'),
      net,
      // 實收佔銷售額的比例——這個數字最值得店家看，實測約 61%
      netRate:     gross ? (net / gross * 100) : 0,
      avgTicket:   c.length ? gross / c.length : 0,
      avgNet:      c.length ? net   / c.length : 0,
    }
  })

  /** 每日彙總，給長條圖用 */
  const daily = computed(() => {
    const map = {}
    for (const o of completed.value) {
      const d = o.ordered_on
      if (!map[d]) map[d] = { date: d, count: 0, gross: 0, net: 0 }
      map[d].count += 1
      map[d].gross += Number(o.gross_incl_tax ?? 0)
      map[d].net   += Number(o.net_payout ?? 0)
    }
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date))
  })

  /** 品項彙總。只算已完成訂單的品項。 */
  const products = computed(() => {
    const doneWf = new Set(completed.value.map(o => o.workflow_id))
    const map = {}
    for (const it of items.value) {
      if (!doneWf.has(it.workflow_id)) continue
      const k = it.item_name
      if (!map[k]) map[k] = { name: k, qty: 0, revenue: 0, orderCount: 0 }
      map[k].qty        += Number(it.qty ?? 0)
      // 一定要用 gross_incl_tax：加料的金額只在這欄，單價×數量會少算
      map[k].revenue    += Number(it.gross_incl_tax ?? 0)
      map[k].orderCount += 1
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue)
  })

  /** 最後一次匯入涵蓋到哪一天，提醒店家該補匯入了 */
  const latestOrderDate = computed(() =>
    orders.value.length ? orders.value[orders.value.length - 1].ordered_on : null
  )

  function reset() {
    orders.value = []
    items.value  = []
    error.value  = ''
  }

  return { orders, items, loading, error, completed, totals, daily, products, latestOrderDate, fetchRange, reset }
})
