import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const useMemberStore = defineStore('members', () => {

  const members = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function fromDb(row) {
    return {
      phone:          row.phone,
      name:           row.name,
      defaultGuests:  row.default_guests,
      lastNote:       row.last_note,
      visitCount:     row.visit_count,
      createdAt:      row.created_at,
      lastVisit:      row.last_visit,
      arrivalHabits:  row.arrival_habits  ?? [],
      avgArrivalDiff: row.avg_arrival_diff ?? null,
      isBlacklisted:  row.is_blacklisted  ?? false,
      blacklistReason:row.blacklist_reason ?? '',
    }
  }

  function toDb(m) {
    return {
      phone:            m.phone,
      name:             m.name,
      default_guests:   m.defaultGuests,
      last_note:        m.lastNote,
      visit_count:      m.visitCount,
      created_at:       m.createdAt,
      last_visit:       m.lastVisit,
      arrival_habits:   m.arrivalHabits  ?? [],
      avg_arrival_diff: m.avgArrivalDiff ?? null,
      is_blacklisted:   m.isBlacklisted  ?? false,
      blacklist_reason: m.blacklistReason ?? '',
    }
  }

  /* ── 讀取 ── */
  async function init() {
    if (loaded) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase.from('members').select('*')
      if (err) throw err
      members.value = data.map(fromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[memberStore] 讀取會員失敗', e)
    } finally {
      loading.value = false
    }
  }

  /* ── 用電話查詢（去除非數字後比對） ── */
  function findByPhone(phone) {
    const clean = phone.replace(/\D/g, '')
    return members.value.find(m => m.phone.replace(/\D/g, '') === clean) ?? null
  }

  /* ── 新增或更新會員（訂位確認後呼叫） ── */
  async function upsertMember({ phone, name, defaultGuests, lastNote }) {
    const cleanPhone = phone.replace(/\D/g, '')
    const existing    = members.value.find(m => m.phone === cleanPhone)
    const today        = new Date().toISOString().slice(0, 10)

    let record
    if (existing) {
      existing.name          = name
      existing.defaultGuests = defaultGuests
      existing.lastNote      = lastNote
      existing.visitCount    = (existing.visitCount ?? 0) + 1
      existing.lastVisit      = today
      record = existing
    } else {
      record = {
        phone: cleanPhone, name, defaultGuests, lastNote,
        visitCount: 1, createdAt: today, lastVisit: today,
      }
      members.value.push(record)
    }

    const { error: err } = await supabase.from('members').upsert(toDb(record))
    if (err) console.error('[memberStore] 儲存會員失敗', err)
  }

  /* ── 記錄到達時間習慣（預約帶位後呼叫）── */
  async function recordArrival(phone, { reservationDate, reservationTime, seatedAt }) {
    if (!phone || !reservationDate || !reservationTime) return
    const cleanPhone = phone.replace(/\D/g, '')
    const m = members.value.find(x => x.phone.replace(/\D/g,'') === cleanPhone)
    if (!m) return

    const [h, min] = reservationTime.split(':').map(Number)
    const resDate  = new Date(reservationDate)
    resDate.setHours(h, min, 0, 0)
    const diffMin = Math.round((seatedAt - resDate.getTime()) / 60000)

    const newHabit = {
      date: reservationDate,
      reservationTime,
      seatedAt: new Date(seatedAt).toISOString(),
      diffMinutes: diffMin,
    }
    m.arrivalHabits = [...(m.arrivalHabits ?? []), newHabit].slice(-30)
    m.avgArrivalDiff = Math.round(
      m.arrivalHabits.reduce((s, h) => s + h.diffMinutes, 0) / m.arrivalHabits.length
    )
    const { error } = await supabase.from('members').upsert(toDb(m))
    if (error) console.error('[memberStore] 記錄到達習慣失敗', error)
  }

  /* ── 設定/取消黑名單 ── */
  async function setBlacklist(phone, isBlacklisted, reason = '') {
    const cleanPhone = phone.replace(/\D/g, '')
    const m = members.value.find(x => x.phone.replace(/\D/g,'') === cleanPhone)
    if (!m) return false
    m.isBlacklisted   = isBlacklisted
    m.blacklistReason = reason
    const { error } = await supabase.from('members').upsert(toDb(m))
    if (error) { console.error('[memberStore] 黑名單操作失敗', error); return false }
    return true
  }

  return { members, loading, error, init, findByPhone, upsertMember, recordArrival, setBlacklist }
})