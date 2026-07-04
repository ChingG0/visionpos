// =============================================================================
// useInvoiceBootCheck.js — 開機檢核
// visionpos/src/composables/useInvoiceBootCheck.js
//
// 對應檢測表項次 3：開機檢核
// (1) 初次設定時：對時、確認賣方統編、發票字軌號碼檢核
// (2) 每次開啟系統時：對時、確認賣方統編、發票字軌及前次開立發票號碼檢核
// =============================================================================
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export function useInvoiceBootCheck() {
  const checking = ref(false)
  const result   = ref(null)  // { ok, items: [{ label, ok, detail }] }

  async function runBootCheck() {
    checking.value = true
    const storeId = useAuthStore().store?.id
    const items = []
    let overallOk = true

    // ── 1. 對時檢核：比對瀏覽器時間與 Supabase 伺服器時間，容許誤差 5 分鐘 ──────
    try {
      const localTime = Date.now()
      const { data: serverTimeRow } = await supabase.rpc('get_server_time').single()
      const serverTime = serverTimeRow ? new Date(serverTimeRow).getTime() : null

      if (serverTime) {
        const diffMinutes = Math.abs(localTime - serverTime) / 60000
        const ok = diffMinutes < 5
        if (!ok) overallOk = false
        items.push({
          label:  '系統時間校對',
          ok,
          detail: ok ? `時間誤差 ${diffMinutes.toFixed(1)} 分鐘內，正常` : `時間誤差 ${diffMinutes.toFixed(1)} 分鐘，請檢查裝置時間設定`,
        })
      } else {
        items.push({ label: '系統時間校對', ok: true, detail: '無法比對伺服器時間，跳過（不影響開票）' })
      }
    } catch {
      items.push({ label: '系統時間校對', ok: true, detail: '無法比對伺服器時間，跳過（不影響開票）' })
    }

    // ── 2. 賣方統編檢核 ────────────────────────────────────────────────────────
    const { data: settings } = await supabase
      .from('invoice_settings')
      .select('*')
      .eq('store_id', storeId)
      .maybeSingle()

    if (!settings || !settings.enabled) {
      items.push({ label: '電子發票功能', ok: true, detail: '此店家未啟用電子發票，略過相關檢核' })
    } else {
      const taxIdOk = /^\d{8}$/.test(settings.tax_id ?? '')
      if (!taxIdOk) overallOk = false
      items.push({
        label:  '賣方統一編號',
        ok:     taxIdOk,
        detail: taxIdOk ? `統編：${settings.tax_id}` : '統編格式錯誤或未設定（應為 8 碼數字）',
      })

      // ── 3. 發票字軌／API 憑證檢核（用一次輕量呼叫測試連線可用）────────────────
      const credOk = !!(settings.merchant_id && settings.hash_key && settings.hash_iv)
      if (!credOk) overallOk = false
      items.push({
        label:  '加值中心憑證設定',
        ok:     credOk,
        detail: credOk
          ? `${settings.provider === 'ecpay' ? '綠界' : settings.provider} · ${settings.is_test ? '測試環境' : '正式環境'}`
          : 'MerchantID / HashKey / HashIV 尚未完整設定',
      })

      // ── 5. 前次開立發票號碼顯示 + 格式檢核（項次 4-(1)：總長 10 碼，前2英後8數）─
      if (settings.last_invoice_number) {
        const formatOk = /^[A-Z]{2}\d{8}$/.test(settings.last_invoice_number)
        if (!formatOk) overallOk = false
        items.push({
          label:  '前次開立發票',
          ok:     formatOk,
          detail: formatOk
            ? `${settings.last_invoice_number}（${settings.last_invoice_at ? new Date(settings.last_invoice_at).toLocaleString('zh-TW') : ''}）`
            : `號碼格式異常：${settings.last_invoice_number}（應為前2碼英文+後8碼數字）`,
        })
      } else {
        items.push({ label: '前次開立發票', ok: true, detail: '尚無開票紀錄' })
      }
    }

    result.value = { ok: overallOk, items, checkedAt: new Date() }

    // 記錄本次檢核結果
    if (settings) {
      await supabase.from('invoice_settings').update({
        last_check_at:     new Date().toISOString(),
        last_check_result: overallOk ? 'ok' : 'warning',
      }).eq('store_id', storeId)
    }

    checking.value = false
    return result.value
  }

  return { checking, result, runBootCheck }
}