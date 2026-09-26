// =============================================================================
// useUberImport.js — Uber Eats 對帳 CSV 匯入
//
// Uber 的 Orders API 只開放給 POS 整合夥伴，單店商家申請不到，所以沒有即時同步。
// 報表也只能送到 Uber 自己的後台（沒有 Email／SFTP），因此只能人工下載再匯入。
//
// 匯入必須可以重複執行：店家一定會不小心匯入同一份檔案兩次，或匯入日期區間重疊
// 的兩份。訂單用 order_uuid upsert；品項先刪掉這批 workflow_id 的舊資料再插入，
// 兩者都不會造成重複計算。
// =============================================================================
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { parseUberPaymentCsv, summarize } from '@/lib/uberCsv.js'

/* 一次送太多列 PostgREST 會回 414/413，切塊送 */
const CHUNK = 300

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export function useUberImport() {
  const parsing  = ref(false)
  const importing = ref(false)
  const error    = ref('')
  const preview  = ref(null)   // { orders, items, skipped, warnings, summary, fileName }

  /** 讀檔＋解析，只在記憶體裡處理，還不寫資料庫 */
  async function parseFile(file) {
    parsing.value = true
    error.value   = ''
    preview.value = null
    try {
      const storeId = useAuthStore().store?.id
      if (!storeId) { error.value = '未登入'; return }

      const text   = await file.text()
      const result = parseUberPaymentCsv(text, storeId)

      preview.value = {
        ...result,
        summary:  summarize(result.orders),
        fileName: file.name,
      }
    } catch (e) {
      console.error('[uberImport] 解析失敗', e)
      error.value = '檔案讀取失敗，請確認是 Uber Eats 匯出的 CSV'
    } finally {
      parsing.value = false
    }
  }

  /** 把 preview 裡的資料寫進資料庫。回傳 { ok, orders, items } */
  async function commit() {
    if (!preview.value || importing.value) return { ok: false }
    const { orders, items } = preview.value
    if (!orders.length) { error.value = '沒有可匯入的訂單'; return { ok: false } }

    importing.value = true
    error.value     = ''
    try {
      // 訂單：同一筆再匯入就覆蓋（Uber 可能事後調整金額或狀態）
      for (const part of chunk(orders, CHUNK)) {
        const { error: err } = await supabase
          .from('uber_orders')
          .upsert(part, { onConflict: 'order_uuid' })
        if (err) throw err
      }

      // 品項沒有天然的唯一鍵（同一張單可能有兩筆同名品項），所以不能 upsert。
      // 改成先刪掉這批訂單的舊品項再插入——重複匯入的結果一樣，不會疊加。
      const workflowIds = [...new Set(orders.map(o => o.workflow_id))]
      for (const part of chunk(workflowIds, CHUNK)) {
        const { error: err } = await supabase
          .from('uber_order_items')
          .delete()
          .in('workflow_id', part)
        if (err) throw err
      }
      for (const part of chunk(items, CHUNK)) {
        const { error: err } = await supabase.from('uber_order_items').insert(part)
        if (err) throw err
      }

      return { ok: true, orders: orders.length, items: items.length }
    } catch (e) {
      console.error('[uberImport] 寫入失敗', e)
      error.value = e?.message ?? '匯入失敗，請稍後再試'
      return { ok: false }
    } finally {
      importing.value = false
    }
  }

  function reset() {
    preview.value = null
    error.value   = ''
  }

  return { parsing, importing, error, preview, parseFile, commit, reset }
}
