// =============================================================================
// orderPayment.js — 訂單付款狀態的共用判斷
//
// 「稍後付款」的訂單是已出餐但還沒收到錢（應收未收），不能算進營收。
// 等店員實際收款時，payment_method 會被改成現金／信用卡／LINE Pay，
// 那個時間點才會被認列為營收。
//
// 判斷邏輯集中在這裡，交班結算和各報表共用，避免兩邊算法不一致。
// =============================================================================

export const DEFERRED_LABEL = '稍後付款'

/** 這筆訂單是否還沒真正收到錢 */
export function isUnpaidOrder(order) {
  const method = order?.payment_method ?? order?.paymentMethod
  return method === DEFERRED_LABEL
}

/**
 * 折扣金額。百分比就照基數算，固定金額則以基數為上限（不能折超過應付金額）。
 *
 * 基數一律是「小計 + 加價」：加價本來就算在這筆消費裡，打折要連它一起折。
 * 這個公式原本在結帳、收據、報表各處抄了七份，其中交易紀錄頁那份漏掉加價，
 * 導致同時有加價又打百分比折扣的訂單，報表跟補印出來的折扣金額比實際少，
 * 紙上「小計＋加價－折扣」兌不回合計。集中在這裡，之後只會有一個版本。
 */
export function discountAmountOf(discount, base) {
  if (!discount?.value) return 0
  const b = base ?? 0
  return discount.type === 'percent'
    ? Math.round(b * discount.value / 100)
    : Math.min(discount.value, b)
}

/** 一張「已存進資料庫的訂單」實際的折扣金額 */
export function orderDiscountAmount(order) {
  return discountAmountOf(
    order?.discount,
    (order?.subtotal ?? 0) + (order?.surcharge?.amount ?? 0),
  )
}

/** 付款方式的顯示文字。沒填的歸到「未記錄」，才不會憑空少一筆對不起來。 */
export function paymentLabel(order) {
  const method = order?.payment_method ?? order?.paymentMethod
  return method || '未記錄'
}
