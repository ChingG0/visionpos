import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

/* 商品編號前綴對應分類 */
const CODE_PREFIX = {
  main:          'A',
  'seasonal-veg': 'B',
  'root-veg':     'C',
  mushroom:      'D',
  staple:        'E',
  braised:       'F',
}

export const useMenuStore = defineStore('menu', () => {

  const categories = ref([])
  const items       = ref([])
  const loading     = ref(false)
  const error       = ref(null)
  let   loaded      = false   // 避免重複 init()

  /* ── DB row(snake_case) → 前端物件(camelCase) ── */
  function itemFromDb(row) {
    return {
      id:         row.id,
      code:       row.code,
      categoryId: row.category_id,
      name:       row.name,
      cost:       row.cost,
      price:      row.price,
      icon:       row.icon,
      status:     row.status,
      sortOrder:  row.sort_order,
    }
  }

  function itemToDb(item) {
    return {
      id:          item.id,
      code:        item.code,
      category_id: item.categoryId,
      name:        item.name,
      cost:        item.cost,
      price:       item.price,
      icon:        item.icon,
      status:      item.status,
      sort_order:  item.sortOrder,
    }
  }

  /* ── 讀取（首次載入用） ── */
  async function init() {
    if (loaded) return
    loading.value = true
    error.value   = null
    try {
      const [catRes, itemRes] = await Promise.all([
        supabase.from('categories').select('*').order('sort_order'),
        supabase.from('menu_items').select('*').order('sort_order'),
      ])
      if (catRes.error)  throw catRes.error
      if (itemRes.error) throw itemRes.error

      categories.value = catRes.data.map(c => ({ id: c.id, label: c.label, icon: c.icon }))
      items.value       = itemRes.data.map(itemFromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[menuStore] 讀取商品資料失敗', e)
    } finally {
      loading.value = false
    }
  }

  /* ── 寫入單一品項（樂觀更新：畫面先變，背景同步資料庫） ── */
  async function persistItem(item) {
    const { error: err } = await supabase.from('menu_items').upsert(itemToDb(item))
    if (err) console.error('[menuStore] 儲存商品失敗', err)
  }

  /* ── 商品編號：依分類自動產生下一個編號 ── */
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

  /* ── 新增商品 ── */
  async function addItem({ name, categoryId, cost, price, icon }) {
    const maxSort = items.value
      .filter(i => i.categoryId === categoryId)
      .reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)

    const newItem = {
      id:    `i${Date.now()}`,
      code:  nextCode(categoryId),
      categoryId,
      name,
      cost:  cost  ?? 0,
      price: price ?? 0,
      icon:  icon  || '🍽️',
      status: true,
      sortOrder: maxSort + 1,
    }

    items.value.push(newItem)        // 畫面先更新
    await persistItem(newItem)        // 背景寫入 Supabase
  }

  /* ── 編輯商品 ── */
  async function updateItem(id, data) {
    const item = items.value.find(i => i.id === id)
    if (!item) return
    Object.assign(item, data)
    await persistItem(item)
  }

  /* ── 複製商品（多選）：複製後預設下架 ── */
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
        id:   `i${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        code: nextCode(src.categoryId),
        name: `${src.name}(複製)`,
        status: false,
        sortOrder: maxSort + 1,
      }
      items.value.push(dup)
      newItems.push(dup)
    }
    await Promise.all(newItems.map(persistItem))
  }

  /* ── 簡單切換上架狀態（商品管理表格用） ── */
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

  /* ── 下架（點餐設定拖拉頁用） ── */
  async function unpublish(id) {
    await setStatus(id, false)
  }

  /* ── 上架並插入到指定排序位置（拖拉頁用） ── */
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

    /* 整個分類排序都變了，全部同步回 Supabase */
    await Promise.all(list.map(persistItem))
  }

  function getCategoryLabel(categoryId) {
    return categories.value.find(c => c.id === categoryId)?.label ?? categoryId
  }

  /* ── 重新排序分類（點餐設定頁拖曳用） ── */
  async function reorderCategories(orderedIds) {
    const reordered = orderedIds
      .map(id => categories.value.find(c => c.id === id))
      .filter(Boolean)

    categories.value = reordered   // 畫面先更新

    const results = await Promise.all(
      reordered.map((cat, idx) =>
        supabase.from('categories').update({ sort_order: idx }).eq('id', cat.id)
      )
    )
    const firstError = results.find(r => r.error)?.error
    if (firstError) console.error('[menuStore] 儲存分類排序失敗', firstError)
  }

  return {
    categories,
    items,
    loading,
    error,
    init,
    addItem,
    updateItem,
    duplicateItems,
    setStatus,
    unpublish,
    publishAt,
    getCategoryLabel,
    reorderCategories,
  }
})