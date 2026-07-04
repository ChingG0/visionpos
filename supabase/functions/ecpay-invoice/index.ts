// =============================================================================
// Supabase Edge Function: ecpay-invoice (v3)
// 修改重點：開票成功後，額外呼叫綠界「查詢發票明細」(/B2CInvoice/GetIssue)，
// 取得綠界已用本店 AES 金鑰正確加密好的 PosBarCode / QRCode_Left / QRCode_Right，
// 直接存入 invoices 表 + 回傳給前端列印，取代先前「自己手動組碼、加密驗證資訊用
// 24 個 0 佔位」的作法（那個作法在財政部證明聯條碼檢測一定會被判定不合格）。
//
// 前提：綠界後台必須先設定「密碼種子(QRCode)」，且需向綠界申請「自行開發 POS
// 版型」權限，PosBarCode/QRCode_Left/QRCode_Right 才會有值。若尚未設定，
// GetIssue 仍會成功，但這三個欄位會是空字串——此時 qrCodeReady 會回傳 false，
// 前端印表機那邊會跳過條碼區塊、不印出不合規的假條碼。
//
// 部署到：supabase/functions/ecpay-invoice/index.ts
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-store-id',
}

async function importAesKey(key: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'AES-CBC' }, false, ['encrypt', 'decrypt'])
}

async function ecpayEncrypt(data: unknown, hashKey: string, hashIV: string): Promise<string> {
  const urlEncoded = encodeURIComponent(JSON.stringify(data))
  const key = await importAesKey(hashKey)
  const iv  = new TextEncoder().encode(hashIV)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, key, new TextEncoder().encode(urlEncoded))
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}

async function ecpayDecrypt(base64: string, hashKey: string, hashIV: string): Promise<unknown> {
  const key = await importAesKey(hashKey)
  const iv  = new TextEncoder().encode(hashIV)
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, key, bytes)
  const urlEncoded = new TextDecoder().decode(decrypted)
  // 綠界後端是用 PHP 風格的 urlencode：空白字元編碼成 "+"，不是 "%20"。
  // JS 的 decodeURIComponent 只認得 %XX，不會把 "+" 還原成空白，導致像
  // InvoiceDate 這種「日期 空白 時間」的欄位解出來變成「2026-07-04+15:01:01」，
  // 這種格式 new Date() 解不出來，會被字軌年期別檢核誤判為異常。
  // 正確做法（對稱於 PHP urldecode）：先把 "+" 換成空白，再做 %XX 解碼——
  // 這樣做也不會誤傷資料裡真的是 "+" 的字元，因為那些會被編碼成 "%2B"。
  return JSON.parse(decodeURIComponent(urlEncoded.replace(/\+/g, ' ')))
}

// responseEncrypted：大部分 API 回傳的 Data 都是 AES 加密過的 JSON 字串，要解密；
// 但「查詢特定多筆發票」(GetIssueList) 文件明講其回傳 Data「此為未加密過JSON格式的資料」，
// 是唯一的例外，這裡直接 JSON.parse 即可，不能再丟去 AES 解密（否則會 base64 decode 失敗）。
async function callEcpay(endpoint: string, payload: unknown, settings: {
  merchant_id: string; hash_key: string; hash_iv: string; is_test: boolean
}, responseEncrypted = true) {
  const base = settings.is_test ? 'https://einvoice-stage.ecpay.com.tw' : 'https://einvoice.ecpay.com.tw'
  const encryptedData = await ecpayEncrypt(payload, settings.hash_key, settings.hash_iv)
  const res = await fetch(`${base}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      MerchantID: settings.merchant_id,
      RqHeader:   { Timestamp: Math.floor(Date.now() / 1000) },
      Data:       encryptedData,
    }),
  })
  const json = await res.json()
  if (json.TransCode !== 1) throw new Error(`綠界通訊失敗: ${json.TransMsg ?? 'unknown'}`)
  if (!responseEncrypted) {
    // ECPay 這裡的 Data 有時候是 JSON 字串、有時候 fetch 已經幫忙解析成物件了，兩種都接
    return (typeof json.Data === 'string' ? JSON.parse(json.Data) : json.Data) as Record<string, unknown>
  }
  return await ecpayDecrypt(json.Data, settings.hash_key, settings.hash_iv) as Record<string, unknown>
}

// ── 查詢發票明細，取得官方一維/二維條碼內容 ────────────────────────────────────
// 綠界會回傳 PosBarCode / QRCode_Left / QRCode_Right，這三個欄位已經是
// 「用本店在綠界設定的 AES 金鑰」加密好的合規內容，不需要（也不應該）自己重算。
// 若綠界尚未開通密碼種子/POS 版型權限，這三個欄位會是空字串，此時視為未就緒。
async function fetchOfficialBarcodes(relateNumber: string, settings: {
  merchant_id: string; hash_key: string; hash_iv: string; is_test: boolean
}): Promise<{ ready: boolean; posBarCode: string; qrCodeLeft: string; qrCodeRight: string }> {
  try {
    const result = await callEcpay('/B2CInvoice/GetIssue', {
      MerchantID:   settings.merchant_id,
      RelateNumber: relateNumber,
    }, settings)

    if (result.RtnCode !== 1) {
      console.warn('[ecpay-invoice] GetIssue 查詢失敗，本次不列印條碼區塊', result.RtnMsg)
      return { ready: false, posBarCode: '', qrCodeLeft: '', qrCodeRight: '' }
    }

    const posBarCode  = String(result.PosBarCode ?? '')
    const qrCodeLeft  = String(result.QRCode_Left ?? '')
    const qrCodeRight = String(result.QRCode_Right ?? '')
    const ready = Boolean(posBarCode && qrCodeLeft)

    if (!ready) {
      console.warn('[ecpay-invoice] GetIssue 未回傳條碼內容，請確認綠界後台是否已設定「密碼種子(QRCode)」並已申請「自行開發 POS 版型」權限')
    }

    return { ready, posBarCode, qrCodeLeft, qrCodeRight }
  } catch (e) {
    console.error('[ecpay-invoice] GetIssue 呼叫異常', e)
    return { ready: false, posBarCode: '', qrCodeLeft: '', qrCodeRight: '' }
  }
}

// ── 混合稅率支援 ──────────────────────────────────────────────────────────────
// 商品的 taxType（'taxable'應稅/'exempt'免稅/'zero'零稅率）換成 ECPay 的
// ItemTaxType 代碼：1應稅 2零稅率 3免稅。缺欄位（例如舊訂單沒有這個欄位）一律當應稅。
function itemTaxCode(taxType: unknown): '1' | '2' | '3' {
  if (taxType === 'exempt') return '3'
  if (taxType === 'zero')   return '2'
  return '1'
}

/**
 * 依訂單內所有商品的課稅別，決定這張發票要用的 TaxType：
 * - 全部同一種 → 就用那一種（1應稅/2零稅率/3免稅）
 * - 應稅 + (免稅 或 零稅率) 混合 → 9（混合稅率，須經財政部/綠界核可）
 * - 免稅 + 零稅率 混合（沒有應稅）→ 財政部規格不允許這個組合同時開立，直接擋下
 * - 沒有商品資料（理論上不會發生）→ 退回店家 invoice_settings.tax_type 的預設值
 */
function resolveInvoiceTax(items: Record<string, unknown>[], settings: { tax_type?: string }): { taxType: '1' | '2' | '3' | '9'; mixed: boolean } {
  const codes = new Set((items ?? []).map(it => itemTaxCode((it as Record<string, unknown>).taxType)))

  if (codes.size === 0) {
    const fallback = settings.tax_type === 'zero' ? '2' : settings.tax_type === 'exempt' ? '3' : '1'
    return { taxType: fallback, mixed: false }
  }
  if (codes.size === 1) {
    return { taxType: [...codes][0] as '1' | '2' | '3', mixed: false }
  }
  if (codes.has('2') && codes.has('3')) {
    throw new Error('訂單內同時包含「免稅」與「零稅率」商品，這個組合不允許開立在同一張發票，請分開結帳')
  }
  return { taxType: '9', mixed: true }
}

/**
 * 依課稅別分別計算未稅金額(銷售額)/稅額：
 * - 應稅部分：從含稅金額拆出稅額（沿用店家設定的稅率）
 * - 免稅/零稅率部分：金額全額算銷售額，不拆稅（稅額為 0）
 * - 單一稅別發票也走同一套邏輯（应稅發票=只有應稅部分；免稅/零稅率發票=只有非應稅部分）
 */
function calcSalesAndTax(items: Record<string, unknown>[], total: number, taxRate: number) {
  const taxableTotal = (items ?? [])
    .filter(it => itemTaxCode((it as Record<string, unknown>).taxType) === '1')
    .reduce((s, it) => s + (Number((it as Record<string, unknown>).price) || 0) * (Number((it as Record<string, unknown>).qty) || 1), 0)

  // items 加總跟前端傳來的 total 理論上要一致；萬一有折扣/加價差異，非應稅部分用差額回推，
  // 確保 taxableSales + taxAmount + nonTaxableAmount 加總後還是等於 total（不會兜不起來）。
  const nonTaxableTotal = Math.max(0, total - taxableTotal)

  const taxableSales = Math.round(taxableTotal / (1 + taxRate))
  const taxAmount     = taxableTotal - taxableSales
  const salesAmount   = taxableSales + nonTaxableTotal
  return { salesAmount, taxAmount }
}

/**
 * 剩餘發票字軌號碼數：呼叫綠界「查詢字軌」(GetInvoiceWordSetting) 取得目前
 * 「使用中」字軌的起訖範圍(InvoiceStart/InvoiceEnd)跟目前已用到的號碼(InvoiceNo)，
 * 算出還剩幾號可以開，寫回 invoice_settings.remain_count（畫面上「剩餘發票號碼數」
 * 之前一直是靜態 0，沒有任何地方真的去問綠界，這裡補上）。
 */
async function syncRemainCount(settings: {
  store_id: string; merchant_id: string; hash_key: string; hash_iv: string; is_test: boolean
}, supabase: ReturnType<typeof createClient>) {
  const now = new Date()
  const rocYear = String(now.getFullYear() - 1911)

  const result = await callEcpay('/B2CInvoice/GetInvoiceWordSetting', {
    MerchantID:      settings.merchant_id,
    InvoiceYear:     rocYear,
    InvoiceTerm:     0, // 0=全部期別，一次抓今年所有字軌，不用自己算現在是第幾期
    UseStatus:       0, // 0=全部狀態，抓回來後自己篩「使用中」
    InvoiceCategory: 1, // B2C
  }, settings)

  if (result.RtnCode !== 1) {
    throw new Error(`GetInvoiceWordSetting 失敗: ${result.RtnMsg}`)
  }

  const rawInfo = result.InvoiceInfo
  // 綠界文件的範例格式不太一致，可能是單一物件、也可能是陣列，這裡兩種都接
  const infoList: Record<string, unknown>[] = Array.isArray(rawInfo)
    ? rawInfo as Record<string, unknown>[]
    : (rawInfo ? [rawInfo as Record<string, unknown>] : [])

  // UseStatus: 2 = 使用中，才是目前真的能拿來開票、需要看剩餘量的字軌
  const activeTracks = infoList.filter(t => Number(t.UseStatus) === 2)

  const remainCount = activeTracks.reduce((sum, t) => {
    const end = parseInt(String(t.InvoiceEnd ?? '0'), 10)
    const used = parseInt(String(t.InvoiceNo ?? t.InvoiceStart ?? '0'), 10)
    const remain = Math.max(0, end - used)
    return sum + (Number.isFinite(remain) ? remain : 0)
  }, 0)

  await supabase.from('invoice_settings').update({ remain_count: remainCount }).eq('store_id', settings.store_id)
  return { remainCount, activeTrackCount: activeTracks.length }
}

// ── 寫入異常紀錄前先查是否已有「未解決」的同一筆紀錄，避免每天排程重複灌一樣的 alert ──
async function insertAlertIfNew(supabase: ReturnType<typeof createClient>, alert: {
  store_id: string; invoice_number: string; kind: string; detail: unknown
}) {
  const { data: existing } = await supabase
    .from('invoice_reconcile_alerts')
    .select('id')
    .eq('store_id', alert.store_id)
    .eq('invoice_number', alert.invoice_number)
    .eq('kind', alert.kind)
    .eq('resolved', false)
    .maybeSingle()
  if (existing) return
  await supabase.from('invoice_reconcile_alerts').insert(alert)
}

/**
 * 漏傳檢核 + 備份對照（單一店家）：
 * 1. 呼叫綠界「查詢特定多筆發票」(GetIssueList) 抓最近 N 天這家店開立的發票，
 *    綠界會回報每張發票的上傳狀態(IIS_Upload_Status)/上傳後接收狀態(IIS_Turnkey_Status)。
 * 2. 把這些狀態同步寫回本地 invoices 表（欄位註記）。
 * 3. 開立超過 48 小時仍未成功上傳 → 寫一筆 missing_upload 異常紀錄（漏傳）。
 * 4. 綠界端查得到、但本地 invoices 表找不到對應紀錄 → 寫一筆 missing_in_local_db
 *    異常紀錄（這其實同時也是「備份」機制的一環：本地資料庫萬一漏寫，這裡能抓回來）。
 *
 * 注意：這裡不會、也不能「強制重新上傳」——綠界文件沒有提供讓特店觸發重新上傳的
 * API，上傳/重試本來就是綠界加值中心 48 小時內自行處理的責任。我們能做、也在做的
 * 是每日檢核 + 標記 + 產生異常紀錄，讓店家能在真的逾時未上傳時及早發現、聯絡綠界。
 */
async function checkStoreUploads(settings: {
  store_id: string; merchant_id: string; hash_key: string; hash_iv: string; is_test: boolean
}, supabase: ReturnType<typeof createClient>) {
  const now = new Date()
  const endDate = now.toISOString().slice(0, 10)
  const beginDate = new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString().slice(0, 10)

  // ── 分頁抓綠界這段期間的完整發票清單 ──────────────────────────────────────────
  const remoteByNumber = new Map<string, Record<string, unknown>>()
  const numPerPage = 100
  let page = 1
  let totalCount = Infinity
  while ((page - 1) * numPerPage < totalCount) {
    const result = await callEcpay('/B2CInvoice/GetIssueList', {
      MerchantID:  settings.merchant_id,
      BeginDate:   beginDate,
      EndDate:     endDate,
      NumPerPage:  numPerPage,
      ShowingPage: page,
      DataType:    1,
    }, settings, false)
    if (result.RtnCode !== 1) throw new Error(`GetIssueList 失敗: ${result.RtnMsg}`)
    totalCount = Number(result.TotalCount ?? 0)
    for (const inv of (result.InvoiceData as Record<string, unknown>[] ?? [])) {
      remoteByNumber.set(String(inv.IIS_Number), inv)
    }
    page++
    if (page > 50) break // 安全上限：正常情況 10 天內不可能有 5000 張以上，避免萬一失控無窮迴圈
  }

  // ── 撈本地這段期間、非作廢的發票 ──────────────────────────────────────────────
  const { data: localInvoices } = await supabase
    .from('invoices')
    .select('id, invoice_number, invoice_date, status')
    .eq('store_id', settings.store_id)
    .gte('invoice_date', beginDate)
    .neq('status', 'void')

  const localNumbers = new Set((localInvoices ?? []).map(i => i.invoice_number))

  let updatedCount = 0
  let missingUploadCount = 0
  let missingInDbCount = 0

  // ── 正向比對：本地每張發票，同步綠界回報的上傳狀態 + 判定是否漏傳 ──────────────
  for (const local of localInvoices ?? []) {
    const remote = remoteByNumber.get(local.invoice_number)
    if (!remote) continue // 這次查詢範圍內綠界沒回報，可能日期邊界差異，不誤判為異常

    const uploadStatus = remote.IIS_Upload_Status === '1'
      ? 'uploaded'
      : (remote.IIS_Turnkey_Status === 'E' ? 'upload_failed' : 'not_uploaded')

    await supabase.from('invoices').update({
      upload_status:      uploadStatus,
      turnkey_status:     remote.IIS_Turnkey_Status || null,
      upload_checked_at:  now.toISOString(),
    }).eq('id', local.id)
    updatedCount++

    const issuedAt = new Date(local.invoice_date)
    const hoursSinceIssued = (now.getTime() - issuedAt.getTime()) / 3_600_000
    if (uploadStatus !== 'uploaded' && hoursSinceIssued > 48) {
      missingUploadCount++
      await insertAlertIfNew(supabase, {
        store_id: settings.store_id,
        invoice_number: local.invoice_number,
        kind: 'missing_upload',
        detail: {
          uploadStatus, turnkeyStatus: remote.IIS_Turnkey_Status,
          invoiceDate: local.invoice_date, hoursSinceIssued: Math.round(hoursSinceIssued),
        },
      })
    }
  }

  // ── 反向比對（備份對照）：綠界端有、本地 invoices 表查無 ─────────────────────
  for (const [invoiceNumber, remote] of remoteByNumber) {
    if (localNumbers.has(invoiceNumber)) continue
    missingInDbCount++
    await insertAlertIfNew(supabase, {
      store_id: settings.store_id,
      invoice_number: invoiceNumber,
      kind: 'missing_in_local_db',
      detail: {
        relateNumber: remote.IIS_Relate_Number,
        createDate:   remote.IIS_Create_Date,
        salesAmount:  remote.IIS_Sales_Amount,
      },
    })
  }

  return {
    checkedCount: (localInvoices ?? []).length,
    remoteTotal:  remoteByNumber.size,
    updatedCount, missingUploadCount, missingInDbCount,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { action, storeId, orderId, orderType, items, total, buyerTaxId, carrierNum, invoiceId, voidReason } = await req.json()

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ═══ 漏傳檢核 + 備份對照（項次：漏傳自動上傳機制 / 備份機制）═══════════════════
    // 這個 action 是給每日排程（pg_cron）呼叫的，不是給前端結帳流程呼叫，
    // 所以不吃單一 storeId 的 invoice_settings 檢查，而是自己迴圈跑過所有啟用發票的店。
    // 沒帶 storeId 就檢查全部店；有帶 storeId 只檢查那一家（方便手動測試單店）。
    if (action === 'check_uploads') {
      let settingsQuery = supabase.from('invoice_settings').select('*').eq('enabled', true)
      if (storeId) settingsQuery = settingsQuery.eq('store_id', storeId)
      const { data: allSettings } = await settingsQuery

      const summary = []
      for (const s of allSettings ?? []) {
        try {
          const r = await checkStoreUploads(s, supabase)
          let remainInfo: Record<string, unknown> = {}
          try {
            remainInfo = await syncRemainCount(s, supabase)
          } catch (e) {
            console.error('[ecpay-invoice] syncRemainCount 店家處理失敗', s.store_id, e)
            remainInfo = { remainCountError: String((e as Error)?.message ?? e) }
          }
          summary.push({ storeId: s.store_id, ...r, ...remainInfo })
        } catch (e) {
          console.error('[ecpay-invoice] check_uploads 店家處理失敗', s.store_id, e)
          summary.push({ storeId: s.store_id, error: String((e as Error)?.message ?? e) })
        }
      }

      return new Response(JSON.stringify({ ok: true, summary }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ═══ 剩餘字軌號碼數（手動立即查詢，例如發票設定頁按「重新整理」用）═══════════════
    if (action === 'sync_remain_count') {
      const { data: oneSettings } = await supabase.from('invoice_settings').select('*').eq('store_id', storeId).maybeSingle()
      if (!oneSettings) {
        return new Response(JSON.stringify({ error: '找不到這家店的發票設定' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      try {
        const r = await syncRemainCount(oneSettings, supabase)
        return new Response(JSON.stringify({ ok: true, ...r }), {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
    }

    const { data: settings } = await supabase.from('invoice_settings').select('*').eq('store_id', storeId).single()

    if (!settings?.enabled) {
      return new Response(JSON.stringify({ error: '此店家未啟用電子發票' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ═══ 開立發票 ═══════════════════════════════════════════════════════════
    if (action === 'issue') {
      // ── 重號檢核（項次 1/4）：同一張訂單只能有一張 issued 狀態的發票 ──────────────
      // 防連點、防網路逾時重送、防系統中斷後前端自動重試造成同一筆訂單重複開票。
      // 這是呼叫綠界 Issue 之前的第一道防線；DB 也另外加了 partial unique index
      // 當最後一道防線（見 migration: invoices_order_id_active_unique）。
      const { data: existingInvoice } = await supabase
        .from('invoices')
        .select('id, invoice_number, random_code, invoice_date, sales_amount, tax_amount, total_amount, buyer_tax_id, seller_tax_id, company_name, pos_bar_code, qr_code_left, qr_code_right, qr_code_ready')
        .eq('order_id', orderId)
        .eq('status', 'issued')
        .maybeSingle()

      if (existingInvoice) {
        console.warn('[ecpay-invoice] order_id 已有 issued 發票，直接回傳既有發票，不重新開票', orderId)
        return new Response(JSON.stringify({
          ok: true,
          invoice: {
            id:            existingInvoice.id,
            invoiceNumber: existingInvoice.invoice_number,
            randomCode:    existingInvoice.random_code,
            invoiceDate:   existingInvoice.invoice_date,
            salesAmount:   existingInvoice.sales_amount,
            taxAmount:     existingInvoice.tax_amount,
            totalAmount:   existingInvoice.total_amount,
            sellerTaxId:   existingInvoice.seller_tax_id,
            buyerTaxId:    existingInvoice.buyer_tax_id,
            companyName:   existingInvoice.company_name,
            posBarCode:    existingInvoice.pos_bar_code,
            qrCodeLeft:    existingInvoice.qr_code_left,
            qrCodeRight:   existingInvoice.qr_code_right,
            qrCodeReady:   existingInvoice.qr_code_ready,
          },
          warning: '此訂單先前已開立過發票，本次直接沿用既有發票（重號防護）',
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const taxRate = (settings.tax_rate ?? 5) / 100

      // ── 混合稅率判定（項次：混合稅率支援）─────────────────────────────────────
      // 依訂單內每個商品的 taxType 決定這張發票的 TaxType；同時含應稅+免稅/零稅率
      // 就是混合稅率(9)，必須先在發票設定確認已取得財政部/綠界核可才能開，
      // 否則直接擋下，避免開出一張沒有資格開立的混稅發票。
      let resolvedTax
      try {
        resolvedTax = resolveInvoiceTax(items ?? [], settings)
      } catch (e) {
        return new Response(JSON.stringify({ error: (e as Error).message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      if (resolvedTax.mixed && !settings.mixed_tax_approved) {
        return new Response(JSON.stringify({
          error: '此訂單同時包含應稅與免稅/零稅率商品，須開立混合稅率發票（TaxType=9），但店家尚未在發票設定確認已取得財政部/綠界核可，已中止開票。請先完成申請並在發票設定頁勾選「已取得混合稅率核可」，或將免稅/零稅率商品分開結帳。'
        }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { salesAmount, taxAmount } = calcSalesAndTax(items ?? [], total, taxRate)
      // RelateNumber 改為由 orderId 衍生的固定值（而非每次呼叫都隨機產生），
      // 讓同一張訂單無論重試幾次都送出同一組 RelateNumber，
      // 一來符合綠界規定的「唯一值」語意（一張訂單終身只用一個），
      // 二來配合上面的既有發票檢查，若真的重試也能追蹤回同一張訂單。
      const relateNumber = `VP${String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 40)}`

      let carrierType = ''
      if (carrierNum) {
        if (/^\/[0-9A-Z+\-.]{7}$/.test(carrierNum))    carrierType = '3'
        else if (/^[A-Z]{2}\d{14}$/.test(carrierNum))  carrierType = '2'
        else {
          return new Response(JSON.stringify({ error: '載具格式錯誤' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
      }

      const payload = {
        MerchantID:         settings.merchant_id,
        RelateNumber:       relateNumber,
        CustomerIdentifier: buyerTaxId ?? '',
        CustomerName:       '一般客戶',
        CustomerAddr:       '－',
        CustomerPhone:      '',
        CustomerEmail:      'noreply@example.com',
        Print:              (buyerTaxId || !carrierNum) ? '1' : '0',
        Donation:           '0',
        LoveCode:           '',
        CarrierType:        carrierType,
        CarrierNum:         carrierType ? carrierNum : '',
        TaxType:            resolvedTax.taxType,
        SalesAmount:        total,
        InvType:            '07',
        vat:                '1',
        Items: (items ?? []).map((it: Record<string, unknown>, i: number) => ({
          ItemSeq:    i + 1,
          ItemName:   String(it.name ?? '').slice(0, 100),
          ItemCount:  it.qty ?? 1,
          ItemWord:   '份',
          ItemPrice:  it.price ?? 0,
          ItemTaxType: itemTaxCode(it.taxType),
          ItemAmount: (Number(it.price) || 0) * (Number(it.qty) || 1),
        })),
      }

      const result = await callEcpay('/B2CInvoice/Issue', payload, settings)

      if (result.RtnCode !== 1) {
        return new Response(JSON.stringify({ error: `開票失敗: ${result.RtnMsg}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ── 發票號碼格式檢核（項次 4-(1)）：總長度 10 碼，前 2 碼英文、後 8 碼數字 ──
      // 綠界異常時理論上不該回傳格式錯誤的號碼，但仍在自己系統這端做一次防呆，
      // 一旦格式不符，視為異常直接擋下，不寫入資料庫也不列印，避免產生錯誤發票紀錄。
      const invoiceNoValid = /^[A-Z]{2}\d{8}$/.test(result.InvoiceNo ?? '')
      if (!invoiceNoValid) {
        console.error('[ecpay-invoice] 發票號碼格式異常', result.InvoiceNo)
        return new Response(JSON.stringify({
          error: `發票號碼格式異常（收到：${result.InvoiceNo}），已中止本次開票，請聯絡系統管理員`
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ── 隨機碼格式檢核（項次 6）：須為 4 碼數字 ──────────────────────────────
      const randomCodeValid = /^\d{4}$/.test(result.RandomNumber ?? '')
      if (!randomCodeValid) {
        console.error('[ecpay-invoice] 隨機碼格式異常', result.RandomNumber)
        return new Response(JSON.stringify({
          error: `隨機碼格式異常（收到：${result.RandomNumber}），已中止本次開票，請聯絡系統管理員`
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // ── 字軌年期別一致性檢核（項次 5）：開票日期換算的期別須為
      //    年(3碼)+單月(2碼)，例如 115 年 07 月開票 → 應為「11507」開頭的期別區間 ──
      // 用正則直接抓年/月，不要依賴 new Date() 解析字串——綠界回傳的日期格式偶爾會有
      // 分隔符號差異（例如空白被還原成別的字元），new Date() 對非標準格式很容易直接
      // 解析失敗變成 Invalid Date（getFullYear() 會是 NaN），這裡改成跟 printer.js 的
      // parseEcpayDate 同一套、容錯度更高的正則解法，只抓年月，不管時間部分。
      const dateMatch = String(result.InvoiceDate ?? '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
      const rocYearCheck    = dateMatch ? Number(dateMatch[1]) - 1911 : NaN
      const monthCheck      = dateMatch ? Number(dateMatch[2]) : NaN
      const startMonthCheck = monthCheck % 2 === 0 ? monthCheck - 1 : monthCheck
      const periodValid = rocYearCheck >= 100 && rocYearCheck <= 999 && startMonthCheck >= 1 && startMonthCheck <= 11
      if (!periodValid) {
        console.error('[ecpay-invoice] 字軌期別異常', { rocYearCheck, startMonthCheck, invoiceDate: result.InvoiceDate })
        return new Response(JSON.stringify({
          error: `字軌期別異常（開票日期：${result.InvoiceDate}），已中止本次開票，請聯絡系統管理員`
        }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 記錄本次隨機碼，供之後定期查核「不以既定順序重覆出現」時比對用
      const { data: recentRandomCodes } = await supabase
        .from('invoices')
        .select('random_code')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(50)
      const isDuplicateRecent = (recentRandomCodes ?? []).some(r => r.random_code === result.RandomNumber)
      if (isDuplicateRecent) {
        // 50 碼隨機碼在近期重複機率極低，重複只做警告記錄，不中止開票（正常亂數本來就有機率重複）
        console.warn('[ecpay-invoice] 隨機碼與近期重複（屬正常亂數機率範圍內）', result.RandomNumber)
      }

      // ── 取得財政部規格要求的官方一維/二維條碼內容（項次 6/7/8）─────────────────
      // 必須用 relateNumber 查，因為此時 invoices 表還沒 insert，還沒有 invoice id。
      const { ready: qrCodeReady, posBarCode, qrCodeLeft, qrCodeRight } = await fetchOfficialBarcodes(relateNumber, settings)

      // 存入 invoices 表 — seller_tax_id / company_name 快照存入，
      // 不依賴日後查 invoice_settings（設定可能被改掉），確保補印永遠印得出完整內容；
      // pos_bar_code / qr_code_left / qr_code_right 同樣快照存入，補印不必重打 GetIssue。
      const { data: invoice, error: insertError } = await supabase
        .from('invoices')
        .insert({
          store_id:       storeId,
          order_id:       orderId,
          order_type:     orderType,
          invoice_number: result.InvoiceNo,
          random_code:    result.RandomNumber,
          invoice_date:   (result.InvoiceDate as string)?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
          sales_amount:   salesAmount,
          tax_amount:     taxAmount,
          total_amount:   total,
          buyer_tax_id:   buyerTaxId ?? null,
          carrier_type:   carrierType || null,
          carrier_num:    carrierNum ?? null,
          seller_tax_id:  settings.tax_id,
          company_name:   settings.company_name,
          items,
          status:         'issued',
          ecpay_response: result,
          pos_bar_code:   posBarCode || null,
          qr_code_left:   qrCodeLeft || null,
          qr_code_right:  qrCodeRight || null,
          qr_code_ready:  qrCodeReady,
        })
        .select().single()

      // ── 重號檢核最後一道防線 ──────────────────────────────────────────────────
      // 極低機率的競態：兩個請求都通過了上面的「既有發票」檢查，才幾乎同時 insert，
      // DB 的 partial unique index (invoices_order_id_active_unique) 會讓其中一個
      // insert 失敗（Postgres unique_violation, code 23505）。這種情況代表綠界那邊
      // 已經真的核發了一組新發票號碼（無法收回），但我們只認資料庫裡「先寫入的那筆」
      // 為正式紀錄，避免同一張訂單在自己系統裡出現兩筆 issued 發票。
      if (insertError) {
        if (insertError.code === '23505') {
          console.error('[ecpay-invoice] insert 撞到重號防護 unique constraint，改查既有發票回傳', insertError)
          const { data: winner } = await supabase
            .from('invoices')
            .select('id, invoice_number, random_code, invoice_date, sales_amount, tax_amount, total_amount, buyer_tax_id, seller_tax_id, company_name, pos_bar_code, qr_code_left, qr_code_right, qr_code_ready')
            .eq('order_id', orderId)
            .eq('status', 'issued')
            .maybeSingle()

          return new Response(JSON.stringify({
            ok: true,
            invoice: winner ? {
              id:            winner.id,
              invoiceNumber: winner.invoice_number,
              randomCode:    winner.random_code,
              invoiceDate:   winner.invoice_date,
              salesAmount:   winner.sales_amount,
              taxAmount:     winner.tax_amount,
              totalAmount:   winner.total_amount,
              sellerTaxId:   winner.seller_tax_id,
              buyerTaxId:    winner.buyer_tax_id,
              companyName:   winner.company_name,
              posBarCode:    winner.pos_bar_code,
              qrCodeLeft:    winner.qr_code_left,
              qrCodeRight:   winner.qr_code_right,
              qrCodeReady:   winner.qr_code_ready,
            } : null,
            warning: '偵測到同一訂單重複開票的競態情形，已改用先寫入資料庫的那筆發票（重號防護觸發，請留意本次綠界端可能多核發了一組未使用的發票號碼）',
          }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
        console.error('[ecpay-invoice] 寫入 invoices 失敗', insertError)
        return new Response(JSON.stringify({ error: `發票已開立（${result.InvoiceNo}）但寫入紀錄失敗，請聯絡系統管理員` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      // 記錄前次開立發票號碼，供下次開機檢核比對用
      await supabase.from('invoice_settings').update({
        last_invoice_number: result.InvoiceNo,
        last_invoice_at:      new Date().toISOString(),
      }).eq('store_id', storeId)

      return new Response(JSON.stringify({
        ok: true,
        invoice: {
          id:            invoice?.id,
          invoiceNumber: result.InvoiceNo,
          randomCode:    result.RandomNumber,
          invoiceDate:   result.InvoiceDate,
          salesAmount, taxAmount, totalAmount: total,
          sellerTaxId:   settings.tax_id,
          buyerTaxId:    buyerTaxId ?? null,
          companyName:   settings.company_name,
          posBarCode, qrCodeLeft, qrCodeRight, qrCodeReady,
        },
        warning: qrCodeReady ? undefined
          : '尚未取得綠界官方條碼內容（請確認已在綠界後台設定「密碼種子(QRCode)」並已申請「自行開發 POS 版型」權限），本次證明聯不會列印一維/二維條碼',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ═══ 作廢發票 ═══════════════════════════════════════════════════════════
    if (action === 'void') {
      const { data: invoice } = await supabase.from('invoices').select('*').eq('id', invoiceId).single()

      if (!invoice) {
        return new Response(JSON.stringify({ error: '找不到發票' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const payload = {
        MerchantID:  settings.merchant_id,
        InvoiceNo:   invoice.invoice_number,
        InvoiceDate: invoice.invoice_date,
        Reason:      (voidReason ?? '作廢').slice(0, 20),
      }

      const result = await callEcpay('/B2CInvoice/Invalid', payload, settings)

      if (result.RtnCode !== 1) {
        return new Response(JSON.stringify({ error: `作廢失敗: ${result.RtnMsg}` }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      await supabase.from('invoices').update({
        status: 'void', void_reason: voidReason, void_at: new Date().toISOString(),
      }).eq('id', invoiceId)

      return new Response(JSON.stringify({ ok: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({ error: '未知 action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[ecpay-invoice]', err)
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
