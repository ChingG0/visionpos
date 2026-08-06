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
      isMarketPrice: row.is_market_price === true,  // 時價商品：不存單價，結帳時才輸入金額
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
      is_market_price: item.isMarketPrice === true,
      store_id: getStoreId(),
    }
  }

  /** 產生跨店不會撞號的 id。
   *  menu_items / categories 的主鍵目前只有 id 一欄（沒有跟 store_id 組成複合主鍵），
   *  舊的寫法 `i${Date.now()}` 只靠毫秒時間，兩家店在同一毫秒各自新增商品就會撞號、
   *  導致其中一家的資料寫不進去或蓋掉別人的。時價商品是「前台結帳當下即時新增」，
   *  多店同時新增的機率比後台建商品高得多，所以這裡把 store_id 前 8 碼一起放進 id，
   *  不同店家的 id 前綴天生就不同，加上亂數後實質上不可能相撞。 */
  function makeScopedId(prefix) {
    const storeTag = (getStoreId() ?? 'nostore').replace(/-/g, '').slice(0, 8)
    const rand     = Math.random().toString(36).slice(2, 8)
    return `${prefix}${storeTag}-${Date.now().toString(36)}-${rand}`
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
      id: makeScopedId('i'), code: nextCode(categoryId), categoryId,
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
        id: makeScopedId('i'),
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

  /* ── 時價商品 ─────────────────────────────────────────────────────────────
     秤重／時價結帳用：商品只存名稱，不存單價（每次秤出來的金額都不一樣）。
     店員在前台輸入商品名稱時即時搜尋既有的時價商品：
       選既有的 → 沿用同一個 id（報表才彙總得起來）
       打全新的 → 這時候才新增一筆商品
     金額與稅別屬於「這一筆交易」，只寫進訂單品項，不回寫到商品。 */

  const MARKET_CATEGORY_LABEL = '時價商品'

  /** 這家店的時價商品分類（沒有的話回傳 null）。 */
  function marketCategory() {
    return categories.value.find(c => c.label === MARKET_CATEGORY_LABEL) ?? null
  }

  /** 取得時價商品分類，沒有就自動建立（店家在付款設定打開「時價結帳」時呼叫）。
   *  addCategory 內部已經帶 store_id，不會跨店。 */
  async function ensureMarketCategory() {
    const existing = marketCategory()
    if (existing) return existing
    return await addCategory(MARKET_CATEGORY_LABEL)
  }

  /** 這家店已建立過的時價商品（items 本身就只裝目前登入店家的資料）。 */
  function marketPriceItems() {
    return items.value
      .filter(i => i.isMarketPrice)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  }

  /** 輸入時的即時搜尋：回傳名稱包含關鍵字的時價商品。 */
  function searchMarketPriceItems(query) {
    const q = (query ?? '').trim()
    if (!q) return marketPriceItems()
    return marketPriceItems().filter(i => i.name.includes(q))
  }

  /** 依名稱找出既有的時價商品（完全相同才算，避免「芭樂」誤配到「土芭樂」）。 */
  function findMarketPriceItemByName(name) {
    const trimmed = (name ?? '').trim()
    if (!trimmed) return null
    return marketPriceItems().find(i => i.name === trimmed) ?? null
  }

  /** 新增一筆時價商品（名稱已存在就直接回傳既有那筆，不會重複建立）。
   *  不存單價：price/cost 一律 0，實際金額每次結帳時輸入。 */
  async function addMarketPriceItem(name) {
    const storeId = getStoreId()
    const trimmed = (name ?? '').trim()
    if (!storeId || !trimmed) return null

    const existing = findMarketPriceItemByName(trimmed)
    if (existing) return existing

    const category = await ensureMarketCategory()
    if (!category) { console.error('[menuStore] 無法建立時價商品分類'); return null }

    const maxSort = items.value
      .filter(i => i.categoryId === category.id)
      .reduce((m, i) => Math.max(m, i.sortOrder ?? -1), -1)

    const newItem = {
      id: makeScopedId('mp'), code: '', categoryId: category.id,
      name: trimmed, cost: 0, price: 0, icon: '⚖️',
      status: true, sortOrder: maxSort + 1,
      taxType: 'exempt',   // 時價商品多為生鮮農產，預設免稅；實際稅別每次結帳時選
      stations: [], tagIds: [],
      isMarketPrice: true,
    }
    items.value.push(newItem)
    await persistItem(newItem)
    return newItem
  }

  /** 新增商品分類，回傳新分類 { id, label } 或 null */
  async function addCategory(label) {
    const storeId = getStoreId()
    const trimmed = label?.trim()
    if (!storeId || !trimmed) return null
    const maxSort = categories.value.length
    const newId = makeScopedId('cat')
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
    MARKET_CATEGORY_LABEL, marketCategory, ensureMarketCategory,
    marketPriceItems, searchMarketPriceItems, findMarketPriceItemByName, addMarketPriceItem,
  }
})