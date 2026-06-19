import { supabase } from '@/lib/supabase.js'

const FLOOR_ID = '1F'

async function fetchFloorItems() {
  const { data, error } = await supabase
    .from('floor_layouts')
    .select('items')
    .eq('floor_id', FLOOR_ID)
    .maybeSingle()
  if (error) { console.error('[floorOrders] 讀取座位圖失敗', error); return [] }
  return data?.items ?? []
}

async function saveFloorItems(items) {
  const { error } = await supabase
    .from('floor_layouts')
    .upsert({ floor_id: FLOOR_ID, items, updated_at: new Date().toISOString() })
  if (error) console.error('[floorOrders] 儲存座位圖失敗', error)
}

/* 供點餐頁「選桌號」用：列出所有非空物件（含椅子跟桌子），附帶目前狀態 */
export async function fetchTables() {
  const items = await fetchFloorItems()
  return items.filter(i => i.name)   // 有名稱的都顯示（椅子 A1 跟桌子 1號桌 都有名稱）
}

/* 送出內用訂單後，把指定座位的狀態改成「已點餐」(paid=綠色) */
export async function markTableOrdered(seatId) {
  const items = await fetchFloorItems()
  const item  = items.find(i => i.id === seatId)
  if (!item) { console.error('[floorOrders] 找不到座位', seatId); return false }
  item.status = 'paid'
  await saveFloorItems(items)
  return true
}

/* 完成結帳後，把座位狀態重置為「空位」(empty=灰色) */
export async function resetSeatStatus(seatId) {
  const items = await fetchFloorItems()
  const item  = items.find(i => i.id === seatId)
  if (!item) { console.error('[floorOrders] 找不到座位', seatId); return false }
  item.status = 'empty'
  await saveFloorItems(items)
  return true
}