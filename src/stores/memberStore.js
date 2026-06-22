import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import * as XLSX from 'xlsx'
import { useAuthStore } from '@/stores/authStore.js'

export const useMemberStore = defineStore('members', () => {
  const members = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) {
    return {
      phone: row.phone, name: row.name,
      homePhone: row.home_phone ?? '', address: row.address ?? '',
      defaultGuests: row.default_guests, lastNote: row.last_note,
      visitCount: row.visit_count, createdAt: row.created_at,
      lastVisit: row.last_visit, arrivalHabits: row.arrival_habits ?? [],
      avgArrivalDiff: row.avg_arrival_diff ?? null,
      isBlacklisted: row.is_blacklisted ?? false,
      blacklistReason: row.blacklist_reason ?? '',
    }
  }

  function toDb(m) {
    return {
      phone: m.phone, name: m.name,
      home_phone: m.homePhone ?? '', address: m.address ?? '',
      default_guests: m.defaultGuests, last_note: m.lastNote,
      visit_count: m.visitCount, created_at: m.createdAt,
      last_visit: m.lastVisit, arrival_habits: m.arrivalHabits ?? [],
      avg_arrival_diff: m.avgArrivalDiff ?? null,
      is_blacklisted: m.isBlacklisted ?? false,
      blacklist_reason: m.blacklistReason ?? '',
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
      const { data, error: err } = await supabase
        .from('members').select('*').eq('store_id', storeId)
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

  function reset() { members.value = []; loaded = false }

  function findByPhone(phone) {
    const clean = phone.replace(/\D/g, '')
    return members.value.find(m => m.phone.replace(/\D/g, '') === clean) ?? null
  }

  async function upsertMember({ phone, name, homePhone, address, defaultGuests, lastNote }) {
    const cleanPhone = phone.replace(/\D/g, '')
    const existing   = members.value.find(m => m.phone === cleanPhone)
    const today      = new Date().toISOString().slice(0, 10)
    let record
    if (existing) {
      existing.name = name
      existing.homePhone     = homePhone     ?? existing.homePhone
      existing.address       = address       ?? existing.address
      existing.defaultGuests = defaultGuests ?? existing.defaultGuests
      existing.lastNote      = lastNote      ?? existing.lastNote
      existing.visitCount    = (existing.visitCount ?? 0) + 1
      existing.lastVisit     = today
      record = existing
    } else {
      record = {
        phone: cleanPhone, name,
        homePhone: homePhone ?? '', address: address ?? '',
        defaultGuests, lastNote, visitCount: 1, createdAt: today, lastVisit: today,
      }
      members.value.push(record)
    }
    const { error: err } = await supabase.from('members').upsert(toDb(record))
    if (err) console.error('[memberStore] 儲存會員失敗', err)
  }

  async function updateContact(phone, { homePhone, address }) {
    const cleanPhone = phone.replace(/\D/g, '')
    const m = members.value.find(x => x.phone.replace(/\D/g, '') === cleanPhone)
    if (!m) return false
    m.homePhone = homePhone ?? m.homePhone
    m.address   = address   ?? m.address
    const { error: err } = await supabase
      .from('members').update({ home_phone: m.homePhone, address: m.address }).eq('phone', cleanPhone)
    if (err) { console.error('[memberStore] 更新聯絡資料失敗', err); return false }
    return true
  }

  async function deleteMembers(phones) {
    if (!phones.length) return false
    const { error: err } = await supabase.from('members').delete().in('phone', phones)
    if (err) { console.error('[memberStore] 刪除會員失敗', err); return false }
    members.value = members.value.filter(m => !phones.includes(m.phone))
    loaded = members.value.length > 0
    return true
  }

  async function fetchMemberOrders(phone, dateFrom = null, dateTo = null) {
    const storeId = getStoreId()
    const clean = phone.replace(/\D/g, '')
    const applyDate = (q) => {
      if (dateFrom) q = q.gte('completed_at', `${dateFrom}T00:00:00`)
      if (dateTo)   q = q.lte('completed_at', `${dateTo}T23:59:59`)
      return q
    }
    const [t, d] = await Promise.all([
      applyDate(supabase.from('takeout_orders')
        .select('id, items, tags, total, completed_at, status')
        .eq('store_id', storeId).eq('customer_phone', clean).eq('status', 'done')
        .order('completed_at', { ascending: false }).limit(50)),
      applyDate(supabase.from('delivery_orders')
        .select('id, items, tags, total, completed_at, status')
        .eq('store_id', storeId).eq('customer_phone', clean).eq('status', 'done')
        .order('completed_at', { ascending: false }).limit(50)),
    ])
    const takeouts   = (t.data ?? []).map(o => ({ ...o, orderType: 'takeout' }))
    const deliveries = (d.data ?? []).map(o => ({ ...o, orderType: 'delivery' }))
    return [...takeouts, ...deliveries]
      .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
  }

  async function recordArrival(phone, { reservationDate, reservationTime, seatedAt }) {
    if (!phone || !reservationDate || !reservationTime) return
    const cleanPhone = phone.replace(/\D/g, '')
    const m = members.value.find(x => x.phone.replace(/\D/g,'') === cleanPhone)
    if (!m) return
    const [h, min] = reservationTime.split(':').map(Number)
    const resDate  = new Date(reservationDate)
    resDate.setHours(h, min, 0, 0)
    const diffMin = Math.round((seatedAt - resDate.getTime()) / 60000)
    const newHabit = { date: reservationDate, reservationTime, seatedAt: new Date(seatedAt).toISOString(), diffMinutes: diffMin }
    m.arrivalHabits = [...(m.arrivalHabits ?? []), newHabit].slice(-30)
    m.avgArrivalDiff = Math.round(m.arrivalHabits.reduce((s, h) => s + h.diffMinutes, 0) / m.arrivalHabits.length)
    const { error } = await supabase.from('members').upsert(toDb(m))
    if (error) console.error('[memberStore] 記錄到達習慣失敗', error)
  }

  async function setBlacklist(phone, isBlacklisted, reason = '') {
    const cleanPhone = phone.replace(/\D/g, '')
    const m = members.value.find(x => x.phone.replace(/\D/g,'') === cleanPhone)
    if (!m) return false
    m.isBlacklisted = isBlacklisted; m.blacklistReason = reason
    const { error } = await supabase.from('members').upsert(toDb(m))
    if (error) { console.error('[memberStore] 黑名單操作失敗', error); return false }
    return true
  }

  function exportExcel() {
    const rows = members.value.map(m => ({
      '姓名': m.name ?? '', '手機': m.phone ?? '', '家用電話': m.homePhone ?? '',
      '地址': m.address ?? '', '消費次數': m.visitCount ?? 0,
      '最後消費': m.lastVisit ?? '', '備註': m.lastNote ?? '',
      '黑名單': m.isBlacklisted ? '是' : '', '黑名單原因': m.blacklistReason ?? '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [{ wch:12 },{ wch:14 },{ wch:14 },{ wch:35 },{ wch:10 },{ wch:12 },{ wch:20 },{ wch:8 },{ wch:20 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '會員資料')
    const date = new Date().toLocaleDateString('zh-TW').replace(/\//g, '-')
    XLSX.writeFile(wb, `VisionPOS_會員資料_${date}.xlsx`)
  }

  return {
    members, loading, error,
    init, reset, findByPhone, upsertMember, updateContact,
    deleteMembers, fetchMemberOrders, recordArrival, setBlacklist, exportExcel,
  }
})