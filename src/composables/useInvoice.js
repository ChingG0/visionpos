// =============================================================================
// useInvoice.js — 電子發票開立/作廢
// visionpos/src/composables/useInvoice.js
// =============================================================================
import { supabase } from '@/lib/supabase.js'
import { printInvoiceReceipt } from '@/lib/printer.js'

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

export function useInvoice() {

  /** 檢查此店是否啟用發票 */
  async function isInvoiceEnabled() {
    const storeId = getStoreId()
    if (!storeId) return false
    const { data } = await supabase
      .from('invoice_settings').select('enabled').eq('store_id', storeId).maybeSingle()
    return data?.enabled === true
  }

  /**
   * 開立發票並列印證明聯
   * order: { id, orderType, items, total, buyerTaxId, carrierNum }
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
      const needPrint = !order.carrierNum || order.buyerTaxId
      if (needPrint) {
        await printInvoiceReceipt({
          ...result.invoice,
          items: order.items,
        })
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

  return { isInvoiceEnabled, issueInvoice, voidInvoice, syncRemainCount }
}