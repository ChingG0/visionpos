import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useMenuStore }        from '@/stores/menuStore.js'
import { useTagStore }         from '@/stores/tagStore.js'
import { useReservationStore } from '@/stores/reservationStore.js'
import { useMemberStore }      from '@/stores/memberStore.js'
import { useDineInStore }      from '@/stores/dineInStore.js'
import { useTakeoutStore }     from '@/stores/takeoutStore.js'
import { useDeliveryStore }    from '@/stores/deliveryStore.js'
import { useMiscStore }        from '@/stores/miscStore.js'
import { useBusinessHoursStore } from '@/stores/businessHoursStore.js'
import { useStoreSettingsStore } from '@/stores/storeSettingsStore.js'

const LS_KEY      = 'visionpos_auth'
const SESSION_TTL = 12 * 60 * 60 * 1000  // 12 小時

const EDGE_FUNCTION_URL = import.meta.env.DEV
  ? '/functions/v1/verify-password'
  : 'https://axwsootizanehojafwnw.supabase.co/functions/v1/verify-password'

export const useAuthStore = defineStore('auth', () => {
  const store   = ref(null)
  const user    = ref(null)
  const loading = ref(false)
  const error   = ref('')

  const isLoggedIn   = computed(() => !!store.value && !!user.value)
  const isOwner      = computed(() => user.value?.role === 'owner')
  const isManager    = computed(() => ['owner', 'manager'].includes(user.value?.role))
  const isSuperAdmin = computed(() => user.value?.is_superadmin === true)

  /* 關帳會結束整店的累計期間，影響範圍大，所以獨立成一個權限。
   * 老闆/主管/superadmin 一律有；收銀員要在員工管理個別開啟。 */
  const canCloseout = computed(() => {
    const u = user.value
    if (!u) return false
    if (u.is_superadmin) return true
    if (['owner', 'manager'].includes(u.role)) return true
    return u.can_closeout === true
  })

  function persist() {
    if (store.value && user.value) {
      localStorage.setItem(LS_KEY, JSON.stringify({
        s:         store.value,
        u:         user.value,
        expiresAt: Date.now() + SESSION_TTL,
      }))
    } else {
      localStorage.removeItem(LS_KEY)
    }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return
      const { s, u, expiresAt } = JSON.parse(raw)

      if (expiresAt && Date.now() > expiresAt) {
        localStorage.removeItem(LS_KEY)
        return
      }

      store.value = s
      user.value  = u
    } catch { /* ignore */ }
  }

  async function login(storeCode, username, password) {
    loading.value = true
    error.value   = ''
    try {
      const res = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ storeCode, username, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        error.value = data.error ?? '登入失敗'
        return false
      }

      store.value = data.store
      user.value  = data.staff
      persist()
      return true

    } catch (e) {
      error.value = '網路錯誤，請稍後再試'
      return false
    } finally {
      loading.value = false
    }
  }

  function logout() {
    useMenuStore().reset()
    useTagStore().reset()
    useReservationStore().reset()
    useMemberStore().reset()
    useDineInStore().reset()
    useTakeoutStore().reset()
    useDeliveryStore().reset()
    useMiscStore().reset()
    useBusinessHoursStore().reset()
    useStoreSettingsStore().reset()

    store.value = null
    user.value  = null
    persist()
  }

  async function fetchStaff() {
    if (!store.value) return []
    const { data, error: err } = await supabase
      .from('staff')
      .select('id, username, name, role, is_active, is_superadmin, can_closeout, created_at')
      .eq('store_id', store.value.id)
      .order('created_at')
    if (err) { return [] }
    return data ?? []
  }

  async function addStaff({ username, password, name, role, can_closeout }) {
    if (!store.value) return false
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    const hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

    const { error: err } = await supabase.from('staff').insert({
      store_id:      store.value.id,
      username:      username.trim(),
      password_hash: hash,
      name:          name.trim(),
      role,
      is_active:     true,
      is_superadmin: false,
      // 老闆/主管本來就有關帳權限，欄位只對收銀員有意義
      can_closeout:  role === 'cashier' ? !!can_closeout : true,
    })
    if (err) { return err.message }
    return true
  }

  async function updateStaff(id, payload) {
    const patch = {
      name:      payload.name?.trim(),
      role:      payload.role,
      is_active: payload.is_active,
      can_closeout: payload.role === 'cashier' ? !!payload.can_closeout : true,
    }
    if (payload.password) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload.password))
      patch.password_hash   = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      patch.password_bcrypt = null
    }
    const { error: err } = await supabase.from('staff').update(patch).eq('id', id)
    if (err) { return err.message }
    return true
  }

  async function deleteStaff(id) {
    const { error: err } = await supabase.from('staff').delete().eq('id', id)
    if (err) { return false }
    return true
  }

  return {
    store, user, loading, error,
    isLoggedIn, isOwner, isManager, isSuperAdmin, canCloseout,
    restore, login, logout,
    fetchStaff, addStaff, updateStaff, deleteStaff,
  }
})