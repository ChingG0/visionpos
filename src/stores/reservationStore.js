import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useReservationStore = defineStore('reservations', () => {
  const reservations = ref([])
  const loading      = ref(false)
  const error        = ref(null)
  let   loaded       = false

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

  async function init() {
    if (loaded) return
    const storeId = getStoreId()
    if (!storeId) return
    loading.value = true
    error.value   = null
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data, error: err } = await supabase
        .from('reservations')
        .select('*')
        .eq('store_id', storeId)
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

  function reset() { reservations.value = []; loaded = false }

  async function addReservation(data) {
    const today = new Date().toISOString().slice(0, 10)
    const newRes = {
      id: crypto.randomUUID(), date: today,
      seatedAt: null, assignedItemIds: [], assignedItemNames: [],
      ...data,
    }
    reservations.value.push(newRes)
    const { error: err } = await supabase.from('reservations').insert(toDb(newRes))
    if (err) console.error('[reservationStore] 新增訂位失敗', err)
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