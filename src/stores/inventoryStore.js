import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const DEFAULT_CATEGORIES = ['肉品', '蔬菜', '醬料', '湯底', '配料', '包材', '其他']
export const DEFAULT_UNITS      = ['g', 'kg', 'ml', 'L', '根', '顆', '包', '份']

export const useInventoryStore = defineStore('inventory', () => {
  const ingredients = ref([])
  const categories  = ref([])   // 食材分類（字串陣列），從 ingredient_categories 表讀取
  const units       = ref([])   // 食材單位（字串陣列），從 ingredient_units 表讀取
  const loading     = ref(false)
  const error       = ref(null)

  function getStoreId() { return useAuthStore().store?.id ?? null }

  /** 讀取食材分類；首次使用（表內尚無資料）自動補上預設分類 */
  async function fetchCategories() {
    const storeId = getStoreId()
    if (!storeId) return
    const { data, error: err } = await supabase
      .from('ingredient_categories').select('*').eq('store_id', storeId).order('sort_order')
    if (err) { console.error('[inventory] 讀取分類失敗', err); return }

    if (!data || data.length === 0) {
      const rows = DEFAULT_CATEGORIES.map((label, i) => ({ store_id: storeId, label, sort_order: i }))
      const { data: inserted, error: insErr } = await supabase
        .from('ingredient_categories').insert(rows).select()
      if (insErr) { console.error('[inventory] 建立預設分類失敗', insErr); categories.value = [...DEFAULT_CATEGORIES]; return }
      categories.value = (inserted ?? []).sort((a, b) => a.sort_order - b.sort_order).map(c => c.label)
    } else {
      categories.value = data.map(c => c.label)
    }
  }

  /** 新增一個食材分類，回傳是否成功 */
  async function addCategory(label) {
    const storeId = getStoreId()
    const trimmed = label?.trim()
    if (!storeId || !trimmed) return false
    if (categories.value.includes(trimmed)) return true
    const { error: err } = await supabase
      .from('ingredient_categories')
      .insert({ store_id: storeId, label: trimmed, sort_order: categories.value.length })
    if (err) { console.error('[inventory] 新增分類失敗', err); return false }
    categories.value.push(trimmed)
    return true
  }

  /** 讀取食材單位；首次使用（表內尚無資料）自動補上預設單位 */
  async function fetchUnits() {
    const storeId = getStoreId()
    if (!storeId) return
    const { data, error: err } = await supabase
      .from('ingredient_units').select('*').eq('store_id', storeId).order('sort_order')
    if (err) { console.error('[inventory] 讀取單位失敗', err); return }

    if (!data || data.length === 0) {
      const rows = DEFAULT_UNITS.map((label, i) => ({ store_id: storeId, label, sort_order: i }))
      const { data: inserted, error: insErr } = await supabase
        .from('ingredient_units').insert(rows).select()
      if (insErr) { console.error('[inventory] 建立預設單位失敗', insErr); units.value = [...DEFAULT_UNITS]; return }
      units.value = (inserted ?? []).sort((a, b) => a.sort_order - b.sort_order).map(u => u.label)
    } else {
      units.value = data.map(u => u.label)
    }
  }

  /** 新增一個食材單位，回傳是否成功 */
  async function addUnit(label) {
    const storeId = getStoreId()
    const trimmed = label?.trim()
    if (!storeId || !trimmed) return false
    if (units.value.includes(trimmed)) return true
    const { error: err } = await supabase
      .from('ingredient_units')
      .insert({ store_id: storeId, label: trimmed, sort_order: units.value.length })
    if (err) { console.error('[inventory] 新增單位失敗', err); return false }
    units.value.push(trimmed)
    return true
  }

  function stockStatus(ing) {
    if (ing.current_stock < 0)                      return { label: '負庫存',   color: '#c0392b', bg: '#fde2e2' }
    if (ing.current_stock === 0)                    return { label: '已用完',   color: '#7f8c8d', bg: '#f0f0f0' }
    if (ing.current_stock <= ing.alert_threshold)   return { label: '低於警戒', color: '#e07020', bg: '#fde8c0' }
    return                                                 { label: '正常',     color: '#2f7a3d', bg: '#e1f3e1' }
  }

  async function fetchIngredients() {
    const storeId = getStoreId()
    if (!storeId) return
    loading.value = true
    const { data, error: err } = await supabase
      .from('ingredients').select('*').eq('store_id', storeId).order('category').order('name')
    if (err) { error.value = err.message; console.error('[inventory]', err) }
    else     ingredients.value = data ?? []
    loading.value = false
  }

  async function addIngredient(payload) {
    const storeId = getStoreId()
    const { data, error: err } = await supabase
      .from('ingredients').insert({ ...payload, store_id: storeId }).select().single()
    if (err) { console.error(err); return null }
    ingredients.value.push(data)
    return data
  }

  async function updateIngredient(id, payload) {
    const { data, error: err } = await supabase
      .from('ingredients')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id).select().single()
    if (err) { console.error(err); return false }
    const i = ingredients.value.findIndex(x => x.id === id)
    if (i >= 0) ingredients.value[i] = data
    return true
  }

  async function restock(ingredientId, { qty, unitCost, totalCost, supplier, note, date }) {
    const ing = ingredients.value.find(x => x.id === ingredientId)
    if (!ing) return false
    const qtyBefore = ing.current_stock
    const qtyAfter  = qtyBefore + qty
    const uc = unitCost ?? (qty > 0 ? (totalCost / qty) : 0)
    const newAvgCost = qtyAfter > 0
      ? ((qtyBefore * ing.avg_cost) + (qty * uc)) / qtyAfter
      : ing.avg_cost
    const ok = await updateIngredient(ingredientId, {
      current_stock: qtyAfter, avg_cost: newAvgCost,
      last_restock_date: date ?? new Date().toISOString().slice(0, 10),
      supplier: supplier || ing.supplier,
    })
    if (!ok) return false
    await supabase.from('ingredient_stock_logs').insert({
      ingredient_id: ingredientId, ingredient_name: ing.name,
      log_type: 'restock', qty_before: qtyBefore, qty_change: qty, qty_after: qtyAfter,
      unit: ing.unit, unit_cost: uc, total_cost: totalCost ?? (qty * uc),
      supplier, note, log_date: date ? `${date}T00:00:00+08:00` : new Date().toISOString(),
    })
    return true
  }

  async function stocktake(ingredientId, { actualQty, staff, reason, note }) {
    const ing = ingredients.value.find(x => x.id === ingredientId)
    if (!ing) return false
    const qtyBefore = ing.current_stock
    const qtyChange = actualQty - qtyBefore
    const ok = await updateIngredient(ingredientId, { current_stock: actualQty })
    if (!ok) return false
    await supabase.from('ingredient_stock_logs').insert({
      ingredient_id: ingredientId, ingredient_name: ing.name,
      log_type: 'stocktake', qty_before: qtyBefore, qty_change: qtyChange, qty_after: actualQty,
      unit: ing.unit, total_cost: qtyChange * ing.avg_cost,
      staff, reason, note, log_date: new Date().toISOString(),
    })
    return true
  }

  /** 依訂單扣料。
   *  refresh：扣完要不要重抓整張食材表。結帳流程用不到（點餐頁不顯示庫存），
   *  每筆訂單都重抓等於白白多一趟往返，所以預設不抓；庫存頁自己會在開啟時讀取。 */
  async function deductByOrder(orderId, items, { refresh = false } = {}) {
    if (!items?.length) return
    const { data: recipes } = await supabase
      .from('product_ingredient_recipes').select('*, ingredients(*)')
      .in('product_id', items.map(i => i.menuItemId).filter(Boolean))
    if (!recipes?.length) return
    const updates = []
    for (const item of items) {
      const itemRecipes = recipes.filter(r => r.product_id === item.menuItemId)
      for (const recipe of itemRecipes) {
        const deductQty = recipe.qty_per_unit * (item.qty ?? 1)
        const ing       = recipe.ingredients
        const qtyBefore = ing.current_stock
        const qtyAfter  = qtyBefore - deductQty
        updates.push(supabase.from('ingredients')
          .update({ current_stock: qtyAfter, updated_at: new Date().toISOString() }).eq('id', ing.id))
        updates.push(supabase.from('ingredient_stock_logs').insert({
          ingredient_id: ing.id, ingredient_name: ing.name,
          log_type: 'deduct', qty_before: qtyBefore, qty_change: -deductQty, qty_after: qtyAfter,
          unit: ing.unit, total_cost: -deductQty * ing.avg_cost,
          related_order_id: orderId, related_product: item.name, log_date: new Date().toISOString(),
        }))
      }
    }
    await Promise.all(updates)
    if (refresh) await fetchIngredients()
  }

  return {
    ingredients, categories, units, loading, error, stockStatus,
    fetchIngredients, addIngredient, updateIngredient, restock, stocktake, deductByOrder,
    fetchCategories, addCategory, fetchUnits, addUnit,
  }
})