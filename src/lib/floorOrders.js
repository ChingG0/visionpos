import { supabase } from '@/lib/supabase.js'

function getStoreId() {
  try {
    const raw = localStorage.getItem('visionpos_auth')
    const { s } = JSON.parse(raw ?? '{}')
    return s?.id ?? null
  } catch { return null }
}

/* ── 讀取目前店家的所有樓層 layout ── */
async function fetchAllLayouts() {
  const storeId = getStoreId()
  if (!storeId) return []
  const { data, error } = await supabase
    .from('floor_layouts')
    .select('floor_id, items')
    .eq('store_id', storeId)
  if (error) { console.error('[floorOrders] 讀取座位圖失敗', error); return [] }
  return data ?? []
}

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

async function saveFloorItems(floorId, items) {
  const storeId = getStoreId()
  const { error } = await supabase
    .from('floor_layouts')
    .upsert(
      { floor_id: floorId, items, store_id: storeId, updated_at: new Date().toISOString() },
      { onConflict: 'store_id,floor_id' }
    )
  if (error) console.error('[floorOrders] 儲存失敗', error)
}

export async function fetchTables() {
  const layouts = await fetchAllLayouts()
  return layouts.flatMap(l => l.items ?? []).filter(i => i.name)
}

export async function markTableOrdered(seatId) {
  const result = await findItemAcrossFloors(seatId)
  if (!result) return false
  result.item.status = 'ordered'
  await saveFloorItems(result.floorId, result.items)
  return true
}

export async function markTablePaid(seatId) {
  const result = await findItemAcrossFloors(seatId)
  if (!result) return false
  result.item.status = 'paid'
  await saveFloorItems(result.floorId, result.items)
  return true
}

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

export async function resetSeatStatus(seatId) {
  const layouts = await fetchAllLayouts()

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