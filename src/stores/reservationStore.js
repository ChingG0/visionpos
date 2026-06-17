import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const useReservationStore = defineStore('reservations', () => {

  const reservations = ref([])
  const loading       = ref(false)
  const error         = ref(null)
  let   loaded         = false

  /* ── DB row(snake_case) → 前端物件(camelCase) ── */
  function fromDb(row) {
    return {
      id:                row.id,
      name:              row.name,
      phone:             row.phone,
      date:              row.date,
      time:              row.time,
      guests:            row.guests,
      note:              row.note,
      timeLabel:         row.time_label,
      urgency:           row.urgency,
      status:            row.status,
      seatedAt:          row.seated_at ? new Date(row.seated_at).getTime() : null,
      assignedItemIds:   row.assigned_item_ids   ?? [],
      assignedItemNames: row.assigned_item_names ?? [],
    }
  }

  function toDb(r) {
    return {
      id:                  r.id,
      name:                r.name,
      phone:               r.phone,
      date:                r.date,
      time:                r.time,
      guests:              r.guests,
      note:                r.note,
      time_label:          r.timeLabel,
      urgency:             r.urgency,
      status:              r.status,
      seated_at:           r.seatedAt ? new Date(r.seatedAt).toISOString() : null,
      assigned_item_ids:   r.assignedItemIds   ?? [],
      assigned_item_names: r.assignedItemNames ?? [],
    }
  }

  /* ── 讀取今天的訂位 ── */
  async function init() {
    if (loaded) return
    loading.value = true
    error.value   = null
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error: err } = await supabase
        .from('reservations')
        .select('*')
        .eq('date', today)
        .order('time')
      if (err) throw err
      reservations.value = data.map(fromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[reservationStore] 讀取訂位失敗', e)
    } finally {
      loading.value = false
    }
  }

  /* ── 新增訂位：client 端先產生 uuid，可立即樂觀更新畫面 ── */
  async function addReservation(data) {
    const today = new Date().toISOString().slice(0, 10)
    const newRes = {
      id: crypto.randomUUID(),
      date: today,
      seatedAt: null,
      assignedItemIds: [],
      assignedItemNames: [],
      ...data,
    }

    reservations.value.push(newRes)

    const { error: err } = await supabase.from('reservations').insert(toDb(newRes))
    if (err) console.error('[reservationStore] 新增訂位失敗', err)
  }

  /* ── 取消訂位 ── */
  async function cancelReservation(id) {
    const r = reservations.value.find(r => r.id === id)
    if (!r || r.status !== 'waiting') return
    r.status = 'cancelled'

    const { error: err } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', id)
    if (err) console.error('[reservationStore] 取消訂位失敗', err)
  }

  /* ── 恢復訂位 ── */
  async function restoreReservation(id) {
    const r = reservations.value.find(r => r.id === id)
    if (!r || r.status !== 'cancelled') return
    r.status            = 'waiting'
    r.seatedAt           = null
    r.assignedItemIds    = []
    r.assignedItemNames  = []

    const { error: err } = await supabase
      .from('reservations')
      .update({
        status: 'waiting',
        seated_at: null,
        assigned_item_ids: [],
        assigned_item_names: [],
      })
      .eq('id', id)
    if (err) console.error('[reservationStore] 恢復訂位失敗', err)
  }

  /* ── 確認入座 ── */
  async function seatReservation(reservationId, itemIds, itemNames) {
    const r = reservations.value.find(r => r.id === reservationId)
    if (!r || r.status !== 'waiting') return
    r.status            = 'seated'
    r.seatedAt          = Date.now()
    r.assignedItemIds   = itemIds
    r.assignedItemNames = itemNames

    const { error: err } = await supabase
      .from('reservations')
      .update({
        status: 'seated',
        seated_at: new Date(r.seatedAt).toISOString(),
        assigned_item_ids: itemIds,
        assigned_item_names: itemNames,
      })
      .eq('id', reservationId)
    if (err) console.error('[reservationStore] 確認入座失敗', err)
  }

  return {
    reservations,
    loading,
    error,
    init,
    addReservation,
    cancelReservation,
    restoreReservation,
    seatReservation,
  }
})