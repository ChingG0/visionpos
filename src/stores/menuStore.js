import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

const CODE_PREFIX = {
  main: 'A', 'seasonal-veg': 'B', 'root-veg': 'C',
  mushroom: 'D', staple: 'E', braised: 'F',
}

export const useMenuStore = defineStore('menu', () => {
  const categories = ref([])
  const items      = ref([])
  const loading    = ref(false)
  const error      = ref(null)
  let   loaded     = false

  function getStoreId() {
    return useAuthStore().store?.id ?? null
  }

  function itemFromDb(row) {
    return {
      id: row.id, code: row.code, categoryId: row.category_id,
      name: row.name, cost: row.cost, price: row.price,
      icon: row.icon, status: row.status, sortOrder: row.sort_order,
      taxType: row.tax_type ?? 'taxable',
    }
  }

  function itemToDb(item) {
    return {
      id: item.id, code: item.code, category_id: item.categoryId,
      name: item.name, cost: item.cost, price: item.price,
      icon: item.icon, status: item.status, sort_order: item.sortOrder,
      tax_type: item.taxType ?? 'taxable',
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
      const [catRes, itemRes] = await Promise.all([
        supabase.from('categories').select('*').eq('store_id', storeId).order('sort_order'),
        supabase.from('menu_items').select('*').eq('store_id', storeId).order('sort_order'),
      ])
      if (catRes.error)  throw catRes.error
      if (itemRes.error) throw itemRes.error
      categories.value = catRes.data.map(c => ({ id: c.id, label: c.label, icon: c.icon }))
      items.value      = itemRes.data.map(itemFromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[menuStore] 讀取商品資料失敗', e)
    } finally {
      loading.value = false
    }
  }

  // 重置（切換店家時用）
  function reset() { categories.value = []; items.value = []; loaded = false }

  async function persistItem(item) {
    const { error: err } = await supabase.from('menu_items').upsert(itemToDb(item))
    if (err) console.error('[menuStore] 儲存商品失敗', err)
  }

  function nextCode(categoryId) {
    const prefix = CODE_PREFIX[categoryId] ?? 'X'
    const maxNum = items.value
      .filter(i => i.categoryId === categoryId)
      .reduce((max, i) => {
        const num = parseInt((i.code ?? '').slice(1), 10)
        return Number.isNaN(num) ? max : Math.max(max, num)
      }, 0)
    return `${prefix}${String(maxNum + 1).padStart(2, '0')}`
  }

  async function addItem({ name, categoryId, cost, price, icon, taxType }) {
    const maxSort = items.value
      .filter(i => i.categoryId === categoryId)
      .reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)
    const newItem = {
      id: `i${Date.now()}`, code: nextCode(categoryId), categoryId,
      name, cost: cost ?? 0, price: price ?? 0, icon: icon || '🍽️',
      status: true, sortOrder: maxSort + 1,
      taxType: taxType ?? 'taxable',
    }
    items.value.push(newItem)
    await persistItem(newItem)
    return newItem
  }

  async function updateItem(id, data) {
    const item = items.value.find(i => i.id === id)
    if (!item) return
    Object.assign(item, data)
    await persistItem(item)
  }

  async function duplicateItems(ids) {
    const newItems = []
    for (const id of ids) {
      const src = items.value.find(i => i.id === id)
      if (!src) continue
      const maxSort = items.value
        .filter(i => i.categoryId === src.categoryId)
        .reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)
      const dup = {
        ...src,
        id: `i${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code: nextCode(src.categoryId),
        name: `${src.name}(複製)`,
        status: false, sortOrder: maxSort + 1,
      }
      items.value.push(dup)
      newItems.push(dup)
    }
    await Promise.all(newItems.map(persistItem))
  }

  async function setStatus(id, status) {
    const item = items.value.find(i => i.id === id)
    if (!item) return
    if (status && !item.status) {
      const maxSort = items.value
        .filter(i => i.categoryId === item.categoryId && i.status && i.id !== id)
        .reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)
      item.sortOrder = maxSort + 1
    }
    item.status = status
    await persistItem(item)
  }

  async function unpublish(id) { await setStatus(id, false) }

  async function publishAt(id, categoryId, targetIndex) {
    const item = items.value.find(i => i.id === id)
    if (!item) return
    item.status = true
    const list = items.value
      .filter(i => i.categoryId === categoryId && i.status && i.id !== id)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    const clamped = Math.max(0, Math.min(targetIndex, list.length))
    list.splice(clamped, 0, item)
    list.forEach((it, idx) => { it.sortOrder = idx })
    await Promise.all(list.map(persistItem))
  }

  function getCategoryLabel(categoryId) {
    return categories.value.find(c => c.id === categoryId)?.label ?? categoryId
  }

  async function reorderCategories(orderedIds) {
    const storeId = getStoreId()
    const reordered = orderedIds
      .map(id => categories.value.find(c => c.id === id))
      .filter(Boolean)
    categories.value = reordered
    const results = await Promise.all(
      reordered.map((cat, idx) =>
        supabase.from('categories').update({ sort_order: idx }).eq('id', cat.id).eq('store_id', storeId)
      )
    )
    const firstError = results.find(r => r.error)?.error
    if (firstError) console.error('[menuStore] 儲存分類排序失敗', firstError)
  }

  return {
    categories, items, loading, error,
    init, reset, addItem, updateItem, duplicateItems,
    setStatus, unpublish, publishAt, getCategoryLabel, reorderCategories,
  }
})