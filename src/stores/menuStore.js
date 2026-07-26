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
      stations: row.stations ?? [],   // 出餐工作站（可複選，例：['wok','drink']）
      tagIds:   row.tag_ids  ?? [],   // 這個商品的常用標籤（點餐時單品備註視窗會優先顯示）
    }
  }

  function itemToDb(item) {
    return {
      id: item.id, code: item.code, category_id: item.categoryId,
      name: item.name, cost: item.cost, price: item.price,
      icon: item.icon, status: item.status, sort_order: item.sortOrder,
      tax_type: item.taxType ?? 'taxable',
      stations: item.stations ?? [],
      tag_ids:  item.tagIds   ?? [],
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

  async function addItem({ name, categoryId, cost, price, icon, taxType, stations, tagIds }) {
    const maxSort = items.value
      .filter(i => i.categoryId === categoryId)
      .reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)
    const newItem = {
      id: `i${Date.now()}`, code: nextCode(categoryId), categoryId,
      name, cost: cost ?? 0, price: price ?? 0, icon: icon || '🍽️',
      status: true, sortOrder: maxSort + 1,
      taxType: taxType ?? 'taxable',
      stations: stations ?? [],
      tagIds:   tagIds   ?? [],
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

  /** 刪除商品（可多筆）。
   *  歷史訂單的品項是當下寫進 items jsonb 的快照，所以刪掉商品不會影響任何已成立的訂單或報表；
   *  這裡只需要一併清掉該商品的食材配方，避免留下孤兒資料。 */
  async function deleteItems(ids) {
    const storeId = getStoreId()
    if (!storeId || !ids?.length) return false

    const { error: recipeErr } = await supabase
      .from('product_ingredient_recipes').delete().in('product_id', ids)
    if (recipeErr) { console.error('[menuStore] 刪除食材配方失敗', recipeErr); return false }

    const { error: err } = await supabase
      .from('menu_items').delete().in('id', ids).eq('store_id', storeId)
    if (err) { console.error('[menuStore] 刪除商品失敗', err); return false }

    const idSet = new Set(ids)
    items.value = items.value.filter(i => !idSet.has(i.id))
    return true
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

  /** 把某個標籤套用到指定的商品上（標籤管理頁用）。
   *  productIds 之外的商品若原本有這個標籤，會一併被移除，
   *  等於「這個標籤現在只屬於這些商品」。 */
  async function setTagOnProducts(tagId, productIds) {
    const idSet   = new Set(productIds)
    const changed = []
    for (const item of items.value) {
      const has    = (item.tagIds ?? []).includes(tagId)
      const should = idSet.has(item.id)
      if (has === should) continue
      item.tagIds = should
        ? [...(item.tagIds ?? []), tagId]
        : (item.tagIds ?? []).filter(id => id !== tagId)
      changed.push(item)
    }
    await Promise.all(changed.map(persistItem))
  }

  /** 標籤被刪除時，把它從所有商品的常用標籤裡清掉，避免留下孤兒 id。 */
  async function removeTagFromAllProducts(tagId) {
    const changed = items.value.filter(i => (i.tagIds ?? []).includes(tagId))
    for (const item of changed) item.tagIds = item.tagIds.filter(id => id !== tagId)
    await Promise.all(changed.map(persistItem))
  }

  /** 目前掛著某個標籤的商品 id 清單。 */
  function productIdsWithTag(tagId) {
    return items.value.filter(i => (i.tagIds ?? []).includes(tagId)).map(i => i.id)
  }

  function getCategoryLabel(categoryId) {
    return categories.value.find(c => c.id === categoryId)?.label ?? categoryId
  }

  /** 新增商品分類，回傳新分類 { id, label } 或 null */
  async function addCategory(label) {
    const storeId = getStoreId()
    const trimmed = label?.trim()
    if (!storeId || !trimmed) return null
    const maxSort = categories.value.length
    const newId = `cat${Date.now()}`
    const { data, error: err } = await supabase
      .from('categories')
      .insert({ id: newId, label: trimmed, sort_order: maxSort, store_id: storeId })
      .select().single()
    if (err) { console.error('[menuStore] 新增分類失敗', err); return null }
    const newCat = { id: data.id, label: data.label, icon: data.icon }
    categories.value.push(newCat)
    return newCat
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
    init, reset, addItem, updateItem, duplicateItems, deleteItems,
    setStatus, unpublish, publishAt, getCategoryLabel, reorderCategories, addCategory,
    setTagOnProducts, removeTagFromAllProducts, productIdsWithTag,
  }
})