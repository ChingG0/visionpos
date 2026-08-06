// =============================================================================
// storeSettingsStore.js — 付款方式 / 發票啟用狀態
//
// 這幾個旗標決定結帳畫面要顯示哪些付款方式、要不要出現載具/統編欄位。
// 原本是在 PaymentModal 的 onMounted 才去查資料庫，導致每次按結帳都會先只
// 看到「現金／稍後付款」，等查詢回來信用卡和 LINE Pay 才跳出來。
//
// 改成登入後就先載好放在這裡，開啟結帳畫面時直接同步讀取，不會再有跳動。
// 設定頁存檔後會呼叫 init(true) 重新載入。
// =============================================================================
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useStoreSettingsStore = defineStore('storeSettings', () => {
  const cardEnabled        = ref(false)
  const linepayEnabled     = ref(false)
  const invoiceEnabled     = ref(false)
  const marketPriceEnabled = ref(false)
  const loaded             = ref(false)

  function getStoreId() { return useAuthStore().store?.id ?? null }

  async function init(force = false) {
    if (loaded.value && !force) return
    const storeId = getStoreId()
    if (!storeId) return
    try {
      const [payRes, invRes] = await Promise.all([
        supabase.from('payment_settings').select('card_enabled, linepay_enabled, market_price_enabled').eq('store_id', storeId).maybeSingle(),
        supabase.from('invoice_settings').select('enabled').eq('store_id', storeId).maybeSingle(),
      ])
      cardEnabled.value        = payRes.data?.card_enabled         ?? false
      linepayEnabled.value     = payRes.data?.linepay_enabled      ?? false
      marketPriceEnabled.value = payRes.data?.market_price_enabled ?? false
      invoiceEnabled.value     = invRes.data?.enabled              ?? false
      loaded.value = true
    } catch (e) {
      console.error('[storeSettingsStore] 讀取設定失敗', e)
    }
  }

  function reset() {
    cardEnabled.value        = false
    linepayEnabled.value     = false
    invoiceEnabled.value     = false
    marketPriceEnabled.value = false
    loaded.value             = false
  }

  return { cardEnabled, linepayEnabled, invoiceEnabled, marketPriceEnabled, loaded, init, reset }
})
