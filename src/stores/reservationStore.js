import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { todayLocal, localDateOf } from '@/lib/reservationTime.js'
import { useShiftStore } from '@/stores/shiftStore.js'

export const useReservationStore = defineStore('reservations', () => {
  const reservations = ref([])
  const loading      = ref(false)
  const error        = ref(null)
  // 記住「載入時的那一天」而不是單純的布林值：iPad 整天不重開，跨過午夜之後
  // loaded 還是 true 的話，隔天的訂位永遠載不進來。
  let   loadedFor    = null
  // 同一次載入會有三個地方呼叫 init（App 的登入初始化、登入 watcher、預約頁的
  // onMounted）。loadedFor 要等 await 回來才設得上，擋不住並行，所以另外記住
  // 進行中的那個 promise，讓後到的呼叫共用同一次查詢。
  let   inFlight     = null

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) {
    return {
      id: row.id, name: row.name, phone: row.phone,
      date: row.date, time: row.time, guests: row.guests,
      note: row.note, timeLabel: row.time_label, urgency: row.urgency,
      status: row.status,
      seatedAt: row.seated_at ? new Date(row.seated_at).getTime() : null,
      assignedItemIds: row.assigned_item_ids ?? [],
      assignedItemNames: row.assigned_item_names ?? [],
    }
  }

  function toDb(r) {
    return {
      id: r.id, name: r.name, phone: r.phone,
      date: r.date, time: r.time, guests: r.guests,
      note: r.note, time_label: r.timeLabel, urgency: r.urgency,
      status: r.status,
      seated_at: r.seatedAt ? new Date(r.seatedAt).toISOString() : null,
      assigned_item_ids: r.assignedItemIds ?? [],
      assigned_item_names: r.assignedItemNames ?? [],
      store_id: getStoreId(),
    }
  }

  /* 載入今天與今天以後的所有訂位。
   *
   * 以前這裡是 .eq('date', today)——只抓今天。但表單允許訂未來日期，新增時又是
   * 樂觀更新（先 push 進本地陣列再寫 DB），所以未來日期的訂位當下看得到、
   * 一重新整理就全部不見。店家回報的「自動更新會把訂位洗掉」就是這個：資料
   * 一直好好地在資料庫裡，只是再也沒被讀回來。自動更新只是最常見的觸發點，
   * 手動重整、關掉 App 再開也一樣。
   *
   * 沒有設上限，因為店家明確說「接多久以後的訂位都可以，不要限當天」。
   * 訂位筆數本來就小，全抓未來的量級沒有問題。
   *
   * 注意：過去日期不會載入，所以預約管理頁的日期選擇器選到昨天以前會是空的。
   * 這是原本就有的行為（以前連今天以外都沒有），不是這次改動造成的。
   */
  async function init(force = false) {
    const today = todayLocal()
    if (!force && loadedFor === today) return
    if (inFlight) return inFlight
    const storeId = getStoreId()
    if (!storeId) return
    inFlight = doLoad(today, storeId).finally(() => { inFlight = null })
    return inFlight
  }

  /* 要載到多早。
   *
   * 不能只從今天起算：跨午夜營業的店，凌晨看面板時昨晚 23:30 那筆還要在，
   * 但它的日期已經是「昨天」了，不先載進來就無從顯示。所以下界取「上次關帳
   * 那一天」——關帳之前的訂位對店家來說已經是結過的帳，不需要再出現。
   *
   * 兩個保險：從來沒關過帳就用今天（維持原本行為）；關帳隔太久（例如忘了關）
   * 也最多往前 7 天，免得一次撈進幾個月的歷史。 */
  const MAX_BACKFILL_DAYS = 7

  async function loadSince(today) {
    const closeout = await useShiftStore().loadPeriodStart()
    if (!closeout) return today
    const floor = new Date()
    floor.setDate(floor.getDate() - MAX_BACKFILL_DAYS)
    const floorStr = localDateOf(floor)
    const closeoutStr = localDateOf(new Date(closeout))
    return closeoutStr < floorStr ? floorStr : closeoutStr
  }

  async function doLoad(today, storeId) {
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('reservations')
        .select('*')
        .eq('store_id', storeId)
        .gte('date', await loadSince(today))
        .order('date')
        .order('time')
      if (err) throw err
      reservations.value = data.map(fromDb)
      loadedFor = today
    } catch (e) {
      error.value = e.message
      console.error('[reservationStore] 讀取訂位失敗', e)
    } finally {
      loading.value = false
    }
  }

  function reset() { reservations.value = []; loadedFor = null }

  async function addReservation(data) {
    // 表單一定會帶 date（送出前有檢查），這個預設值只是防呆。
    const today = todayLocal()
    const newRes = {
      id: crypto.randomUUID(), date: today,
      seatedAt: null, assignedItemIds: [], assignedItemNames: [],
      ...data,
    }
    // 樂觀更新：先放上畫面，再寫資料庫。但失敗時一定要收回來——以前這裡只有
    // console.error，卡片會一直留在畫面上，店員以為訂位存好了，其實資料庫裡
    // 根本沒有，重新整理就消失。那是真的會掉單，而且完全沒有徵兆。
    reservations.value.push(newRes)
    const { error: err } = await supabase.from('reservations').insert(toDb(newRes))
    if (err) {
      console.error('[reservationStore] 新增訂位失敗', err)
      reservations.value = reservations.value.filter(r => r.id !== newRes.id)
      return false
    }
    return true
  }

  async function cancelReservation(id) {
    const r = reservations.value.find(r => r.id === id)
    if (!r || r.status !== 'waiting') return
    r.status = 'cancelled'
    const { error: err } = await supabase
      .from('reservations').update({ status: 'cancelled' }).eq('id', id)
    if (err) console.error('[reservationStore] 取消訂位失敗', err)
  }

  async function restoreReservation(id) {
    const r = reservations.value.find(r => r.id === id)
    if (!r || r.status !== 'cancelled') return
    r.status = 'waiting'; r.seatedAt = null
    r.assignedItemIds = []; r.assignedItemNames = []
    const { error: err } = await supabase
      .from('reservations')
      .update({ status: 'waiting', seated_at: null, assigned_item_ids: [], assigned_item_names: [] })
      .eq('id', id)
    if (err) console.error('[reservationStore] 恢復訂位失敗', err)
  }

  async function seatReservation(reservationId, itemIds, itemNames) {
    const r = reservations.value.find(r => r.id === reservationId)
    if (!r || r.status !== 'waiting') return
    r.status = 'seated'; r.seatedAt = Date.now()
    r.assignedItemIds = itemIds; r.assignedItemNames = itemNames
    if (r.phone && r.date && r.time) {
      const { useMemberStore } = await import('@/stores/memberStore.js')
      const mStore = useMemberStore()
      mStore.recordArrival(r.phone, {
        reservationDate: r.date, reservationTime: r.time, seatedAt: r.seatedAt,
      })
    }
    const { error: err } = await supabase
      .from('reservations')
      .update({
        status: 'seated', seated_at: new Date(r.seatedAt).toISOString(),
        assigned_item_ids: itemIds, assigned_item_names: itemNames,
      })
      .eq('id', reservationId)
    if (err) console.error('[reservationStore] 確認入座失敗', err)
  }

  return { reservations, loading, error, init, reset, addReservation, cancelReservation, restoreReservation, seatReservation }
})