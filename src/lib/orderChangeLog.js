import { supabase } from '@/lib/supabase.js'

/* ── 訂單異動紀錄（取消 / 修改） ─────────────────────────────────────────────
 * 給「營運報表 → 點餐紀錄」查詢用。fire-and-forget 風格：寫入失敗只印
 * console.error，不阻擋原本的取消/修改流程（跟出單機、發票的做法一致）。 */
export async function logOrderChange({
  storeId, orderType = 'dine_in', orderId, seatName,
  action, staff, reason, summary, before, after,
}) {
  if (!storeId || !orderId) return
  try {
    const { error } = await supabase.from('order_change_logs').insert({
      store_id:   storeId,
      order_type: orderType,
      order_id:   String(orderId),
      seat_name:  seatName ?? null,
      action,
      staff:      staff ?? null,
      reason:     reason ?? null,
      summary:    summary ?? null,
      before:     before ?? null,
      after:      after  ?? null,
    })
    if (error) console.error('[orderChangeLog] 寫入失敗', error)
  } catch (e) {
    console.error('[orderChangeLog] 寫入失敗', e)
  }
}

/* 比對修改前後的品項，產生人類可讀的摘要文字，例：
 * "舒肥雞腿 x2→x1；新增 珍珠奶茶 x1；移除 薯條 x1"
 * 同一個 menuItemId 在陣列中可能有多筆（不同備註/標籤），數量要先加總再比對。 */
export function summarizeItemsDiff(beforeItems = [], afterItems = []) {
  const keyOf = (l) => l.menuItemId ?? l.id ?? l.name

  function toMap(list) {
    const map = new Map()
    for (const l of list ?? []) {
      const k = keyOf(l)
      const prev = map.get(k)
      map.set(k, { name: l.name, qty: (prev?.qty ?? 0) + (l.qty ?? 0) })
    }
    return map
  }

  const beforeMap = toMap(beforeItems)
  const afterMap  = toMap(afterItems)
  const allKeys   = new Set([...beforeMap.keys(), ...afterMap.keys()])

  const parts = []
  for (const k of allKeys) {
    const b = beforeMap.get(k)
    const a = afterMap.get(k)
    if (b && !a)                parts.push(`移除 ${b.name} x${b.qty}`)
    else if (!b && a)           parts.push(`新增 ${a.name} x${a.qty}`)
    else if (b.qty !== a.qty)   parts.push(`${a.name} x${b.qty}→x${a.qty}`)
  }
  return parts.length ? parts.join('；') : '品項無變動（可能只改了標籤/備註/加價/折扣）'
}
