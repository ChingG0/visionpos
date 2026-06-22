import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'

const LS_KEY = 'visionpos_auth'

/* SHA-256 雜湊（Web Crypto API） */
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export const useAuthStore = defineStore('auth', () => {
  const store   = ref(null)   // { id, code, name }
  const user    = ref(null)   // { id, username, name, role, is_superadmin }
  const loading = ref(false)
  const error   = ref('')

  const isLoggedIn    = computed(() => !!store.value && !!user.value)
  const isOwner       = computed(() => user.value?.role === 'owner')
  const isManager     = computed(() => ['owner', 'manager'].includes(user.value?.role))
  const isSuperAdmin  = computed(() => user.value?.is_superadmin === true)

  function restore() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const { s, u } = JSON.parse(raw)
      store.value = s
      user.value  = u
    } catch { /* ignore */ }
  }

  function persist() {
    if (store.value && user.value) {
      localStorage.setItem(LS_KEY, JSON.stringify({ s: store.value, u: user.value }))
    } else {
      localStorage.removeItem(LS_KEY)
    }
  }

  async function login(storeCode, username, password) {
    loading.value = true
    error.value   = ''
    try {
      /* 1. 查店家 */
      const { data: storeData, error: sErr } = await supabase
        .from('stores')
        .select('id, code, name')
        .eq('code', storeCode.trim())
        .single()
      if (sErr || !storeData) { error.value = '店家代碼不正確'; return false }

      /* 2. 雜湊密碼 */
      const hash = await sha256(password)

      /* 3. 先查 superadmin（不限 store_id，可登入所有店家）*/
      const { data: superStaff } = await supabase
        .from('staff')
        .select('id, username, name, role, is_active, is_superadmin')
        .eq('username', username.trim())
        .eq('password_hash', hash)
        .eq('is_superadmin', true)
        .maybeSingle()

      if (superStaff) {
        if (!superStaff.is_active) { error.value = '此帳號已停用'; return false }
        store.value = { id: storeData.id, code: storeData.code, name: storeData.name }
        user.value  = {
          id: superStaff.id, username: superStaff.username,
          name: superStaff.name, role: superStaff.role,
          is_superadmin: true,
        }
        persist()
        return true
      }

      /* 4. 一般員工：限同一家店 */
      const { data: staffData, error: uErr } = await supabase
        .from('staff')
        .select('id, username, name, role, is_active, is_superadmin')
        .eq('store_id', storeData.id)
        .eq('username', username.trim())
        .eq('password_hash', hash)
        .single()

      if (uErr || !staffData)   { error.value = '帳號或密碼錯誤'; return false }
      if (!staffData.is_active) { error.value = '此帳號已停用';   return false }

      store.value = { id: storeData.id, code: storeData.code, name: storeData.name }
      user.value  = {
        id: staffData.id, username: staffData.username,
        name: staffData.name, role: staffData.role,
        is_superadmin: false,
      }
      persist()
      return true
    } catch (e) {
      error.value = '登入失敗，請稍後再試'
      console.error('[authStore] login', e)
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    store.value = null
    user.value  = null
    persist()
  }

  async function fetchStaff() {
    if (!store.value) return []
    const { data, error: err } = await supabase
      .from('staff')
      .select('id, username, name, role, is_active, is_superadmin, created_at')
      .eq('store_id', store.value.id)
      .order('created_at')
    if (err) { console.error('[authStore] fetchStaff', err); return [] }
    return data ?? []
  }

  async function addStaff({ username, password, name, role }) {
    if (!store.value) return false
    const hash = await sha256(password)
    const { error: err } = await supabase.from('staff').insert({
      store_id:      store.value.id,
      username:      username.trim(),
      password_hash: hash,
      name:          name.trim(),
      role,
      is_active:     true,
      is_superadmin: false,
    })
    if (err) { console.error('[authStore] addStaff', err); return err.message }
    return true
  }

  async function updateStaff(id, payload) {
    const patch = {
      name:      payload.name?.trim(),
      role:      payload.role,
      is_active: payload.is_active,
    }
    if (payload.password) patch.password_hash = await sha256(payload.password)
    const { error: err } = await supabase.from('staff').update(patch).eq('id', id)
    if (err) { console.error('[authStore] updateStaff', err); return err.message }
    return true
  }

  async function deleteStaff(id) {
    const { error: err } = await supabase.from('staff').delete().eq('id', id)
    if (err) { console.error('[authStore] deleteStaff', err); return false }
    return true
  }

  return {
    store, user, loading, error,
    isLoggedIn, isOwner, isManager, isSuperAdmin,
    restore, login, logout,
    fetchStaff, addStaff, updateStaff, deleteStaff,
  }
})