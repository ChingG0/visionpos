// =============================================================================
// ⚠️ 目前沒有任何地方 import 這個檔案，這是刻意的，不是死碼。
//    2026-11-13 方案與用量對店家全部隱藏，原因與恢復方式見 PlanUsageView.vue 開頭。
// =============================================================================

// =============================================================================
// usageStore.js — 資料用量
//
// 只取百分比，不取 MB。store_usage_current 這個視圖本身有 bytes_total，
// 但刻意不 select 它——店家端不顯示實際容量，那資料就不該進到瀏覽器裡，
// 免得哪天有人從 devtools 或某個新元件不小心把它印出來。
//
// 百分比的意義是「離要付費還有多遠」，由資料庫那支視圖同時考慮資料量與
// 時間（取較大者，再被 2 個月保底壓住），這裡拿到的就是最終值。
// =============================================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

/* 提示「今天不再顯示」記在這台裝置。跟出單機設定同一套店家前綴慣例，
 * 換店登入不會互相影響。 */
function hintKey() {
  const code = useAuthStore().store?.code ?? 'unknown'
  return `visionpos:${code}:usageHintDismissedOn`
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const useUsageStore = defineStore('usage', () => {
  const percent      = ref(0)
  const needsPayment = ref(false)
  const plan         = ref('starter')
  const measuredOn   = ref(null)      // 快照日期，null = 排程還沒跑過
  const loaded       = ref(false)
  const loading      = ref(false)

  // 手動關掉提示的日期，用 ref 讓畫面能即時反應（localStorage 本身不是響應式）
  const dismissedOn  = ref('')

  function getStoreId() { return useAuthStore().store?.id ?? null }

  async function init(force = false) {
    if (loaded.value && !force) return
    const storeId = getStoreId()
    if (!storeId) return

    loading.value = true
    try {
      const { data, error } = await supabase
        .from('store_usage_current')
        .select('percent, needs_payment, plan, measured_on')
        .eq('store_id', storeId)
        .maybeSingle()
      if (error) throw error

      percent.value      = data?.percent ?? 0
      needsPayment.value = data?.needs_payment ?? false
      plan.value         = data?.plan ?? 'starter'
      measuredOn.value   = data?.measured_on ?? null
      loaded.value       = true
    } catch (e) {
      // 讀不到用量不該影響任何營業功能，靜默失敗、維持 0%
      console.error('[usageStore] 讀取用量失敗', e)
    } finally {
      loading.value = false
    }
  }

  function loadDismissed() {
    try { dismissedOn.value = localStorage.getItem(hintKey()) ?? '' } catch { dismissedOn.value = '' }
  }

  function dismissToday() {
    const today = todayStr()
    dismissedOn.value = today
    try { localStorage.setItem(hintKey(), today) } catch (e) { console.error(e) }
  }

  const isFree = computed(() => (plan.value ?? 'starter') === 'starter')

  /* 到量之後不給關——那是要收錢的時候，不能讓它被關掉一整天。
   * 沒到量的提示可以關，關掉當天不再出現，隔天重新跳。 */
  const canDismiss = computed(() => percent.value < 100)

  /* 80% 以下只在設定頁看得到，不佔用 topbar。
   * 尖峰時段一直掛在店員眼前的東西，兩個月就會被學會無視。 */
  const showTopbarHint = computed(() => {
    if (!isFree.value) return false
    if (percent.value < 80) return false
    if (!canDismiss.value) return true
    return dismissedOn.value !== todayStr()
  })

  function reset() {
    percent.value = 0
    needsPayment.value = false
    plan.value = 'starter'
    measuredOn.value = null
    loaded.value = false
    dismissedOn.value = ''
  }

  return {
    percent, needsPayment, plan, measuredOn, loaded, loading,
    isFree, canDismiss, showTopbarHint,
    init, reset, loadDismissed, dismissToday,
  }
})
