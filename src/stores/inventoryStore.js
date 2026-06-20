import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

export const CATEGORIES = ['肉品', '蔬菜', '醬料', '湯底', '配料', '包材', '其他']
export const UNITS       = ['g', 'kg', 'ml', 'L', '根', '顆', '包', '份']

export const useInventoryStore = defineStore('inventory', () => {
  const ingredients = ref([])
  const loading     = ref(false)
  const error       = ref(null)

  function stockStatus(ing) {
    if (ing.current_stock < 0)                                  return { label: '負庫存',   color: '#c0392b', bg: '#fde2e2' }
    if (ing.current_stock === 0)                                return { label: '已用完',   color: '#7f8c8d', bg: '#f0f0f0' }
    if (ing.current_stock <= ing.alert_threshold)               return { label: '低於警戒', color: '#e07020', bg: '#fde8c0' }
    return                                                             { label: '正常',     color: '#2f7a3d', bg: '#e1f3e1' }
  }

  /* ── 讀取 ── */
  async function fetchIngredients() {
    loading.value = true
    const { data, error: err } = await supabase
      .from('ingredients').select('*').order('category').order('name')
    if (err) { error.value = err.message; console.error('[inventory]', err) }
    else     ingredients.value = data ?? []
    loading.value = false
  }

  /* ── 新增 / 編輯 ── */
  async function addIngredient(payload) {
    const { data, error: err } = await supabase
      .from('ingredients').insert(payload).select().single()
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

  /* ── 入庫 ── */
  async function restock(ingredientId, { qty, unitCost, totalCost, supplier, note, date }) {
    const ing = ingredients.value.find(x => x.id === ingredientId)
    if (!ing) return false
    const qtyBefore = ing.current_stock
    const qtyAfter  = qtyBefore + qty
    const uc = unitCost ?? (qty > 0 ? (totalCost / qty) : 0)
    /* 加權平均成本 */
    const newAvgCost = qtyAfter > 0
      ? ((qtyBefore * ing.avg_cost) + (qty * uc)) / qtyAfter
      : ing.avg_cost

    const ok = await updateIngredient(ingredientId, {
      current_stock:     qtyAfter,
      avg_cost:          newAvgCost,
      last_restock_date: date ?? new Date().toISOString().slice(0, 10),
      supplier:          supplier || ing.supplier,
    })
    if (!ok) return false

    await supabase.from('ingredient_stock_logs').insert({
      ingredient_id:  ingredientId,
      ingredient_name: ing.name,
      log_type:       'restock',
      qty_before:     qtyBefore,
      qty_change:     qty,
      qty_after:      qtyAfter,
      unit:           ing.unit,
      unit_cost:      uc,
      total_cost:     totalCost ?? (qty * uc),
      supplier,
      note,
      log_date:       date ? `${date}T00:00:00+08:00` : new Date().toISOString(),
    })
    return true
  }

  /* ── 盤點 ── */
  async function stocktake(ingredientId, { actualQty, staff, reason, note }) {
    const ing = ingredients.value.find(x => x.id === ingredientId)
    if (!ing) return false
    const qtyBefore = ing.current_stock
    const qtyChange = actualQty - qtyBefore

    const ok = await updateIngredient(ingredientId, { current_stock: actualQty })
    if (!ok) return false

    await supabase.from('ingredient_stock_logs').insert({
      ingredient_id:   ingredientId,
      ingredient_name: ing.name,
      log_type:        'stocktake',
      qty_before:      qtyBefore,
      qty_change:      qtyChange,
      qty_after:       actualQty,
      unit:            ing.unit,
      total_cost:      qtyChange * ing.avg_cost,
      staff,
      reason,
      note,
      log_date:        new Date().toISOString(),
    })
    return true
  }

  /* ── 銷售扣庫存（訂單完成後呼叫） ── */
  async function deductByOrder(orderId, items) {
    if (!items?.length) return
    const { data: recipes } = await supabase
      .from('product_ingredient_recipes')
      .select('*, ingredients(*)')
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
          .update({ current_stock: qtyAfter, updated_at: new Date().toISOString() })
          .eq('id', ing.id))
        updates.push(supabase.from('ingredient_stock_logs').insert({
          ingredient_id:   ing.id,
          ingredient_name: ing.name,
          log_type:        'deduct',
          qty_before:      qtyBefore,
          qty_change:      -deductQty,
          qty_after:       qtyAfter,
          unit:            ing.unit,
          total_cost:      -deductQty * ing.avg_cost,
          related_order_id: orderId,
          related_product: item.name,
          log_date:        new Date().toISOString(),
        }))
      }
    }
    await Promise.all(updates)
    await fetchIngredients()
  }

  return { ingredients, loading, error, stockStatus, fetchIngredients, addIngredient, updateIngredient, restock, stocktake, deductByOrder }
})