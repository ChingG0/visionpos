// =============================================================================
// useInvoice.js — 電子發票開立/作廢
// visionpos/src/composables/useInvoice.js
// =============================================================================
import { supabase } from '@/lib/supabase.js'
import { printInvoiceReceipt, printTransactionDetail } from '@/lib/printer.js'

const EDGE_URL = import.meta.env.DEV
  ? '/functions/v1/ecpay-invoice'
  : 'https://axwsootizanehojafwnw.supabase.co/functions/v1/ecpay-invoice'

function getStoreId() {
  try {
    const raw = localStorage.getItem('visionpos_auth')
    const { s } = JSON.parse(raw ?? '{}')
    return s?.id ?? null
  } catch { return null }
}

async function callEdge(body) {
  const res = await fetch(EDGE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  })
  return res.json()
}

/* 發票設定幾乎不會變，但原本每次結帳都查一次資料庫，等於每筆訂單都多一趟往返。
 * 改成快取 5 分鐘，店家在後台改設定後最慢 5 分鐘生效，要立即生效可以呼叫
 * clearInvoiceEnabledCache()（發票設定頁儲存時會呼叫）。
 *
 * 除了 enabled，交易明細的抬頭跟機號也是從這張表來的，一起帶回來快取，
 * 才不會為了印一行店名又多查一次。 */
const SETTINGS_TTL = 5 * 60 * 1000
let settingsCache = { storeId: null, value: null, at: 0 }

export function clearInvoiceEnabledCache() {
  settingsCache = { storeId: null, value: null, at: 0 }
}

async function loadSettings() {
  const storeId = getStoreId()
  if (!storeId) return null

  const fresh = settingsCache.storeId === storeId
    && settingsCache.value !== null
    && (Date.now() - settingsCache.at) < SETTINGS_TTL
  if (fresh) return settingsCache.value

  const { data } = await supabase
    .from('invoice_settings')
    .select('enabled, company_name, pos_id')
    .eq('store_id', storeId)
    .maybeSingle()

  const value = {
    enabled:     data?.enabled === true,
    companyName: data?.company_name ?? '',
    posId:       data?.pos_id ?? '',
  }
  settingsCache = { storeId, value, at: Date.now() }
  return value
}

/** 把呼叫端給的訂單資料，補上店名/機號/發票欄位，組成 printer 要的交易明細 payload */
function toDetailPayload(detail, settings, invoice) {
  return {
    ...detail,
    companyName:   detail?.companyName || settings?.companyName || '',
    posId:         detail?.posId       || settings?.posId       || '',
    invoiceNumber: invoice?.invoiceNumber ?? null,
    salesAmount:   invoice?.salesAmount   ?? null,
    taxAmount:     invoice?.taxAmount     ?? null,
  }
}

export function useInvoice() {

  /** 檢查此店是否啟用發票 */
  async function isInvoiceEnabled() {
    return (await loadSettings())?.enabled === true
  }

  /**
   * 開立發票並列印證明聯
   * order: { id, orderType, items, total, buyerTaxId, carrierNum,
   *          printDetail?, detail? }
   *
   * printDetail 為 true 時，交易明細會接在證明聯後面同一張紙印出來；
   * 如果這張發票存雲端不印證明聯（有載具、無統編），明細就單獨印一張。
   * 回傳 { ok, invoice } 或 { ok: false, error }
   */
  async function issueInvoice(order) {
    const storeId = getStoreId()
    if (!storeId) return { ok: false, error: '未登入' }

    try {
      const result = await callEdge({
        action:    'issue',
        storeId,
        orderId:   order.id,
        orderType: order.orderType,
        items:     order.items,
        total:     Math.round(order.total),
        buyerTaxId: order.buyerTaxId || null,
        carrierNum: order.carrierNum || null,
      })

      if (!result.ok) {
        console.error('[invoice] 開票失敗', result.error)
        return { ok: false, error: result.error }
      }

      // 有載具且無統編 → 存雲端不列印；否則列印證明聯
      const needPrint  = !order.carrierNum || order.buyerTaxId
      const wantDetail = order.printDetail === true
      const detail     = wantDetail
        ? toDetailPayload(order.detail ?? {}, await loadSettings(), result.invoice)
        : null

      if (needPrint) {
        // 明細跟著證明聯走，同一張紙一次印完，中間只隔一條虛線
        await printInvoiceReceipt({
          ...result.invoice,
          items: order.items,
        }, detail ? { transactionDetail: detail } : {})
      } else if (detail) {
        // 證明聯存雲端不印，但店員仍要明細 → 單獨印一張（上面仍有發票號碼可對帳）
        await printTransactionDetail(detail)
      }

      // result.invoice.qrCodeReady === false 代表綠界尚未設定密碼種子/POS 版型權限，
      // 條碼區塊沒印出來；這裡把 warning 往上傳，方便呼叫端（例如結帳流程）記錄或提醒。
      if (result.warning) console.warn('[invoice]', result.warning)

      return { ok: true, invoice: result.invoice, warning: result.warning }
    } catch (e) {
      console.error('[invoice] 開票異常', e)
      return { ok: false, error: '開票失敗，請至交易紀錄補開' }
    }
  }

  /** 作廢發票（呼叫綠界 API + 更新 DB）*/
  async function voidInvoice(invoiceId, reason) {
    const storeId = getStoreId()
    const result = await callEdge({ action: 'void', storeId, invoiceId, voidReason: reason })
    return result.ok === true
      ? { ok: true }
      : { ok: false, error: result.error ?? '作廢失敗' }
  }

  /** 查詢綠界字軌剩餘量並寫回 invoice_settings.remain_count */
  async function syncRemainCount() {
    const storeId = getStoreId()
    if (!storeId) return { ok: false, error: '未登入' }
    const result = await callEdge({ action: 'sync_remain_count', storeId })
    return result.ok === true
      ? { ok: true, remainCount: result.remainCount }
      : { ok: false, error: result.error ?? '查詢失敗' }
  }

  /**
   * 結帳完成後的憑證輸出，四個結帳入口（新單、內用單張/併單、外帶稍後付款）共用。
   *
   *   有啟用發票 → 開票，交易明細接在證明聯後面
   *   沒啟用發票 → 沒有票可開，勾了印明細就單獨印一張（沒有發票號碼跟稅額欄）
   *
   * 整段都是 fire-and-forget 的性質：印不出來不該讓訂單卡住，所以錯誤只記 console。
   */
  async function finalizeCheckout({ id, orderType, items, total, buyerTaxId, carrierNum, printDetail, detail }) {
    if (!id) return { ok: false, error: '缺少訂單編號' }

    const wantDetail = printDetail === true
    let settings     = null
    let detailDone   = false

    /* 明細單獨印一張（沒有發票號碼與稅額區）。開票失敗或這家店沒啟用發票時用。 */
    async function printDetailAlone() {
      if (detailDone) return
      detailDone = true
      await printTransactionDetail(toDetailPayload(detail ?? {}, settings, null))
    }

    try {
      settings = await loadSettings()

      if (!settings?.enabled) {
        if (wantDetail) await printDetailAlone()
        return { ok: true, invoiceSkipped: true }
      }

      const res = await issueInvoice({
        id, orderType, items, total, buyerTaxId, carrierNum, printDetail, detail,
      })
      if (res?.warning) console.warn('[invoice]', res.warning)

      // 開票失敗時 issueInvoice 會提早 return，交易明細也跟著沒印。但明細只是這筆
      // 訂單的品項清單，跟發票開不開得成無關——客人正站在櫃台等這張單，該印還是要
      // 印給他，只是上面不會有發票號碼跟稅額那一段。發票之後再到交易紀錄補開。
      if (!res?.ok && wantDetail) await printDetailAlone()

      return res
    } catch (e) {
      console.error('[invoice] 結帳憑證處理失敗', e)
      // 同上：整段掛掉也不該讓客人連明細都拿不到
      if (wantDetail) {
        try { await printDetailAlone() } catch (err) { console.error('[invoice] 明細列印失敗', err) }
      }
      return { ok: false, error: '結帳憑證處理失敗' }
    }
  }

  return { isInvoiceEnabled, issueInvoice, finalizeCheckout, voidInvoice, syncRemainCount }
}