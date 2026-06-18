import { supabase } from '@/lib/supabase.js'

/*
  讓「點餐頁」可以讀/寫「內用」的座位圖，不用整個重構 FloorMap.vue。
  FloorMap.vue 自己也是讀寫同一張 floor_layouts 表，
  兩邊都讀 Supabase 最新資料，離開頁面再回來就會看到彼此的更動。
*/

const FLOOR_ID = '1F'   // 之後如果有多樓層，這裡要改成可傳入參數

async function fetchFloorItems() {
  const { data, error } = await supabase
    .from('floor_layouts')
    .select('items')
    .eq('floor_id', FLOOR_ID)
    .maybeSingle()
  if (error) {
    console.error('[floorOrders] 讀取座位圖失敗', error)
    return []
  }
  return data?.items ?? []
}

/* 點餐頁「選桌號」用：列出所有桌子（不含椅子），附帶目前狀態方便顯示顏色 */
export async function fetchTables() {
  const items = await fetchFloorItems()
  return items.filter(i => i.type !== 'chair')
}

/* 送出內用訂單時呼叫：把指定桌號狀態改成「已點餐」(綠色) */
export async function markTableOrdered(tableId) {
  const items = await fetchFloorItems()
  const table = items.find(i => i.id === tableId)
  if (!table) {
    console.error('[floorOrders] 找不到桌號', tableId)
    return false
  }
  table.status = 'paid'   // 內部狀態值沿用 'paid'，代表「已點餐＝已結帳」

  const { error } = await supabase
    .from('floor_layouts')
    .upsert({ floor_id: FLOOR_ID, items, updated_at: new Date().toISOString() })
  if (error) {
    console.error('[floorOrders] 更新桌況失敗', error)
    return false
  }
  return true
}