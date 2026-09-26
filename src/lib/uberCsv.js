// =============================================================================
// uberCsv.js — 解析 Uber Eats「付款詳細資訊（商品級別）」報表
//
// 這份 CSV 的結構不直覺，實際驗證過的規則：
//
//  1. 一個檔案裡混了三種列
//       訂單列：「訂單 ID」有值（#7E765），帶所有金額欄位
//       品項列：「訂單 ID」是空的，只有「工作流程 ID」和「商品名稱」
//       費用列：兩個 ID 都空，靠「其他款項說明」帶廣告費用／點數
//     費用列不是訂單，必須排除，否則會多出一堆金額 0 的假訂單。
//
//  2. 品項靠「工作流程 ID」關聯訂單，不是「訂單 ID」——品項列的訂單 ID 是空的。
//
//  3. 單價 × 數量 ≠ 銷售額。加料與選項的金額折進「銷售額」，單價欄位不含。
//     實測 24 個品項有 9 個對不起來，一律用「銷售額」欄位。
//
//  4. 去重要用「訂單 UUID」。「訂單 ID」只有 5 碼（#7E765），不保證唯一。
//
//  5. 有兩種報表格式：商品級別只有一列表頭；訂單級別第一列是長敘述、第二列才是
//     欄位名。這裡自動判斷，兩種都吃得下。
//
//  6. 部分欄位名尾端有空白（「總金額 」「訂單完成時間 」），表頭一律 trim。
// =============================================================================

/** 標準 CSV 解析：處理引號包夾、欄內逗號、跳脫的雙引號、CRLF */
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, '')      // 去掉 BOM，否則第一個欄位名會對不到
  const rows = []
  let row = [], field = '', inQuotes = false

  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (inQuotes) {
      if (c === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++ }   // "" 代表一個字面的引號
        else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field); field = ''
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = ''
    } else if (c !== '\r') {
      field += c
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows.filter(r => r.some(cell => cell.trim() !== ''))
}

/** 兩種報表格式的表頭位置不同，用「有沒有出現訂單 ID 這個欄位名」來判斷 */
function findHeaderIndex(rows) {
  for (let i = 0; i < Math.min(3, rows.length); i++) {
    if (rows[i].some(c => c.trim() === '訂單 ID')) return i
  }
  return 0
}

function toNumber(v) {
  const n = parseFloat(String(v ?? '').replace(/[, ]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** 2026/8/7 → 2026-08-07。空值回 null。 */
function toDate(v) {
  const s = String(v ?? '').trim()
  if (!s) return null
  const m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (!m) return null
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

function toTimestamp(v) {
  const s = String(v ?? '').trim()
  return s ? s.replace(' ', 'T') : null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 解析成 { orders, items, skipped, warnings }
 * orders / items 的欄位名對應資料表，可直接送進 Supabase。
 */
export function parseUberPaymentCsv(text, storeId) {
  const rows = parseCsv(text)
  if (rows.length < 2) return { orders: [], items: [], skipped: { fees: 0, invalid: 0 }, warnings: ['檔案是空的或格式不正確'] }

  const hi      = findHeaderIndex(rows)
  const header  = rows[hi].map(h => h.trim())
  const dataRows = rows.slice(hi + 1).map(r => {
    const o = {}
    header.forEach((h, i) => { o[h] = r[i] ?? '' })
    return o
  })

  const warnings = []
  const need = ['訂單 ID', '工作流程 ID', '訂單 UUID', '商品名稱', '銷售額（含加值型營業稅）']
  const missing = need.filter(k => !header.includes(k))
  if (missing.length) {
    return { orders: [], items: [], skipped: { fees: 0, invalid: 0 },
             warnings: [`這份檔案缺少必要欄位：${missing.join('、')}。請確認匯出的是「付款詳細資訊（商品級別）」報表。`] }
  }

  const orders = []
  const items  = []
  const wfToUuid = new Map()
  let fees = 0, invalid = 0

  // 先掃訂單列，建立 工作流程ID → 訂單UUID 的對照，品項才能掛上去
  for (const r of dataRows) {
    const ref = (r['訂單 ID'] || '').trim()
    if (!ref) continue

    const orderUuid = (r['訂單 UUID'] || '').trim()
    const workflow  = (r['工作流程 ID'] || '').trim()
    const orderedOn = toDate(r['訂單日期'])

    if (!UUID_RE.test(orderUuid) || !UUID_RE.test(workflow) || !orderedOn) { invalid++; continue }

    wfToUuid.set(workflow, orderUuid)
    orders.push({
      order_uuid:     orderUuid,
      store_id:       storeId,
      workflow_id:    workflow,
      order_ref:      ref,
      ordered_on:     orderedOn,
      accepted_at:    (r['接受訂單時間'] || '').trim() || null,
      completed_at:   toTimestamp(r['訂單完成時間']),
      dining_mode:    (r['用餐模式'] || '').trim() || null,
      order_channel:  (r['訂單管道'] || '').trim() || null,
      membership:     (r['顧客 Uber 會員狀態'] || '').trim() || null,
      currency:       (r['貨幣代碼'] || 'TWD').trim() || 'TWD',
      gross_incl_tax: toNumber(r['銷售額（含加值型營業稅）']),
      item_discount:  toNumber(r['商品優惠（含加值型營業稅）']),
      marketing_adj:  toNumber(r['行銷調整（含加值型營業稅）']),
      order_total:    toNumber(r['訂單總額 (含加值型營業稅)']),
      platform_fee:   toNumber(r['折扣後的平台服務費（含加值型營業稅）']),
      net_payout:     toNumber(r['總金額']),
      payout_date:    toDate(r['付款日期']),
      status:         (r['訂單狀態'] || '').trim() || null,
    })
  }

  // 再掃品項列與費用列
  for (const r of dataRows) {
    if ((r['訂單 ID'] || '').trim()) continue          // 訂單列，上面處理過了

    const name = (r['商品名稱'] || '').trim()
    if (!name) {
      // 沒有商品名稱又沒有訂單 ID：廣告費用／點數之類的帳務列，不是訂單
      if ((r['其他款項說明'] || '').trim()) fees++
      else invalid++
      continue
    }

    const workflow = (r['工作流程 ID'] || '').trim()
    const orderUuid = wfToUuid.get(workflow)
    if (!orderUuid) {
      // 品項找不到對應的訂單列——通常是日期區間切在訂單中間，下次匯入涵蓋到就會補上
      invalid++
      continue
    }

    items.push({
      store_id:       storeId,
      workflow_id:    workflow,
      order_uuid:     orderUuid,
      ordered_on:     toDate(r['訂單日期']),
      item_name:      name,
      qty:            toNumber(r['最終數量']),
      unit_price:     toNumber(r['單價']),
      // 一定要用銷售額，不能用 單價×數量——加料的金額只在這一欄裡
      gross_incl_tax: toNumber(r['銷售額（含加值型營業稅）']),
    })
  }

  if (!orders.length) warnings.push('這份檔案裡沒有任何訂單，可能選錯報表類型或日期區間內沒有單。')
  if (!items.length && orders.length) {
    warnings.push('只有訂單、沒有品項資料。商品分析需要「付款詳細資訊（商品級別）」報表，一般的「付款詳細資訊」沒有品項明細。')
  }

  return { orders, items, skipped: { fees, invalid }, warnings }
}

/** 匯入前的摘要，給使用者確認用 */
export function summarize(orders) {
  const sum = k => orders.reduce((s, o) => s + (o[k] ?? 0), 0)
  const dates = orders.map(o => o.ordered_on).filter(Boolean).sort()
  return {
    count:       orders.length,
    dateFrom:    dates[0] ?? null,
    dateTo:      dates[dates.length - 1] ?? null,
    gross:       sum('gross_incl_tax'),
    discount:    sum('item_discount'),
    platformFee: sum('platform_fee'),
    netPayout:   sum('net_payout'),
  }
}
