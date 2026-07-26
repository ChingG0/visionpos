// =============================================================================
// businessHoursStore.js — 營業時間 + 取單號重置時間
//
// segments 的格式：[{ open: '07:00', close: '15:00' }, ...]
// close 比 open 小代表跨夜（例 17:30-02:00 是隔天凌晨兩點打烊）。
// =============================================================================
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const WEEKDAYS = [
  { id: 1, label: '週一' },
  { id: 2, label: '週二' },
  { id: 3, label: '週三' },
  { id: 4, label: '週四' },
  { id: 5, label: '週五' },
  { id: 6, label: '週六' },
  { id: 0, label: '週日' },
]

export const useBusinessHoursStore = defineStore('businessHours', () => {
  // { [weekday]: [{ open, close }] }
  const hours   = ref({})
  const info    = ref({ pickupResetMode: 'auto', pickupResetTime: null })
  const loading = ref(false)
  let   loaded  = false

  function getStoreId() { return useAuthStore().store?.id ?? null }

  async function init(force = false) {
    if (loaded && !force) return
    const storeId = getStoreId()
    if (!storeId) return
    loading.value = true
    try {
      const [hRes, iRes] = await Promise.all([
        supabase.from('store_business_hours').select('weekday, segments').eq('store_id', storeId),
        supabase.from('store_info').select('pickup_reset_mode, pickup_reset_time').eq('store_id', storeId).maybeSingle(),
      ])
      const map = {}
      for (const row of hRes.data ?? []) map[row.weekday] = row.segments ?? []
      hours.value = map
      if (iRes.data) {
        info.value = {
          pickupResetMode: iRes.data.pickup_reset_mode ?? 'auto',
          pickupResetTime: iRes.data.pickup_reset_time ?? null,
        }
      }
      loaded = true
    } catch (e) {
      console.error('[businessHoursStore] 讀取失敗', e)
    } finally {
      loading.value = false
    }
  }

  function reset() { hours.value = {}; info.value = { pickupResetMode: 'auto', pickupResetTime: null }; loaded = false }

  function getSegments(weekday) { return hours.value[weekday] ?? [] }

  /** 儲存某一天的營業時段 */
  async function saveDay(weekday, segments) {
    const storeId = getStoreId()
    if (!storeId) return false
    const clean = (segments ?? []).filter(s => s.open && s.close)
    const { error } = await supabase
      .from('store_business_hours')
      .upsert(
        { store_id: storeId, weekday, segments: clean, updated_at: new Date().toISOString() },
        { onConflict: 'store_id,weekday' }
      )
    if (error) { console.error('[businessHoursStore] 儲存營業時間失敗', error); return false }
    hours.value = { ...hours.value, [weekday]: clean }
    return true
  }

  /** 把某一天的時段套用到其他天（省得一天一天填） */
  async function copyDayTo(fromWeekday, targetWeekdays) {
    const segments = getSegments(fromWeekday)
    const results = await Promise.all(targetWeekdays.map(d => saveDay(d, segments)))
    return results.every(Boolean)
  }

  async function saveResetSetting({ mode, time }) {
    const storeId = getStoreId()
    if (!storeId) return false
    const { error } = await supabase
      .from('store_info')
      .upsert(
        {
          store_id: storeId,
          pickup_reset_mode: mode,
          pickup_reset_time: mode === 'manual' ? (time || null) : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'store_id' }
      )
    if (error) { console.error('[businessHoursStore] 儲存重置設定失敗', error); return false }
    info.value = { pickupResetMode: mode, pickupResetTime: mode === 'manual' ? (time || null) : null }
    return true
  }

  /* ── 自動推算的重置時間：當日第一段開店時間往前推 1 小時 ──────────────────
   * 為什麼是「開店前」而不是「打烊後」：打烊時間可能跨夜（例如凌晨 2 點），
   * 在打烊後重置容易誤判日期；開店前 1 小時一定落在休息空檔，最不會出錯。 */
  function autoResetTimeFor(weekday) {
    const segs = getSegments(weekday)
    if (!segs.length) return null
    const firstOpen = segs
      .map(s => s.open)
      .filter(Boolean)
      .sort()[0]
    if (!firstOpen) return null
    const [h, m] = firstOpen.split(':').map(Number)
    const total  = ((h * 60 + m) - 60 + 1440) % 1440   // 往前一小時，跨過午夜就回到前一天
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
  }

  /** 畫面上顯示用：目前實際生效的重置時間 */
  const effectiveResetTime = computed(() => {
    if (info.value.pickupResetMode === 'manual') {
      return info.value.pickupResetTime ? info.value.pickupResetTime.slice(0, 5) : null
    }
    // 自動模式：取「有營業的那幾天」裡最早的一個推算值當代表
    const candidates = WEEKDAYS
      .map(d => autoResetTimeFor(d.id))
      .filter(Boolean)
      .sort()
    return candidates[0] ?? null
  })

  return {
    hours, info, loading,
    init, reset, getSegments, saveDay, copyDayTo, saveResetSetting,
    autoResetTimeFor, effectiveResetTime,
  }
})
