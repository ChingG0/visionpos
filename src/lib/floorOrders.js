import { supabase } from '@/lib/supabase.js'

/* ── 讀取全部樓層的 layout ── */
async function fetchAllLayouts() {
  const { data, error } = await supabase.from('floor_layouts').select('floor_id, items')
  if (error) { console.error('[floorOrders] 讀取座位圖失敗', error); return [] }
  return data ?? []
}

/* 在所有樓層中找到指定 item（String 比較避免 number/string 型別問題） */
async function findItemAcrossFloors(seatId) {
  const layouts = await fetchAllLayouts()
  for (const layout of layouts) {
    const items = layout.items ?? []
    const item  = items.find(i => String(i.id) === String(seatId))
    if (item) return { floorId: layout.floor_id, items, item }
  }
  console.warn('[floorOrders] 找不到座位', seatId)
  return null
}

/* 儲存指定樓層的 items */
async function saveFloorItems(floorId, items) {
  const { error } = await supabase.from('floor_layouts')
    .upsert({ floor_id: floorId, items, updated_at: new Date().toISOString() })
  if (error) console.error('[floorOrders] 儲存失敗', error)
}

/* ── 公開 API ── */

/* 供「選桌號」Modal 使用：列出所有樓層中有名稱的 item */
export async function fetchTables() {
  const layouts = await fetchAllLayouts()
  return layouts.flatMap(l => l.items ?? []).filter(i => i.name)
}

/* 送出訂單（稍後付款）→ 橙色（未結帳）*/
export async function markTableOrdered(seatId) {
  const result = await findItemAcrossFloors(seatId)
  if (!result) return false
  result.item.status = 'ordered'
  await saveFloorItems(result.floorId, result.items)
  return true
}

/* 送出訂單（已付款）→ 綠色（已結帳）*/
export async function markTablePaid(seatId) {
  const result = await findItemAcrossFloors(seatId)
  if (!result) return false
  result.item.status = 'paid'
  await saveFloorItems(result.floorId, result.items)
  return true
}

/* 帶位後批次標記多個座位（可跨樓層）*/
export async function markSeatsOrdered(seatIds) {
  if (!seatIds?.length) return false
  const layouts   = await fetchAllLayouts()
  const primaryId = seatIds[0]
  const dirty     = new Set()

  for (const id of seatIds) {
    for (const layout of layouts) {
      const item = (layout.items ?? []).find(i => String(i.id) === String(id))
      if (item) {
        item.status        = 'ordered'
        item.groupSeats    = seatIds
        item.primarySeatId = String(id) === String(primaryId) ? null : primaryId
        dirty.add(layout.floor_id)
        break
      }
    }
  }

  await Promise.all(
    [...dirty].map(fid => {
      const layout = layouts.find(l => l.floor_id === fid)
      return layout ? saveFloorItems(fid, layout.items) : Promise.resolve()
    })
  )
  return true
}

/* 完成結帳後重置座位（及同組所有座位）為空位 */
export async function resetSeatStatus(seatId) {
  const layouts = await fetchAllLayouts()

  /* 找出主座位的 groupSeats */
  let groupIds = [seatId]
  for (const layout of layouts) {
    const me = (layout.items ?? []).find(i => String(i.id) === String(seatId))
    if (me) { groupIds = me.groupSeats ?? [seatId]; break }
  }

  const dirty = new Set()
  for (const layout of layouts) {
    for (const item of (layout.items ?? [])) {
      if (groupIds.map(String).includes(String(item.id))) {
        item.status = 'empty'
        delete item.primarySeatId
        delete item.groupSeats
        dirty.add(layout.floor_id)
      }
    }
  }

  await Promise.all(
    [...dirty].map(fid => {
      const layout = layouts.find(l => l.floor_id === fid)
      return layout ? saveFloorItems(fid, layout.items) : Promise.resolve()
    })
  )
  return true
}