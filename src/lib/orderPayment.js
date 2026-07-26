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

/** 付款方式的顯示文字。沒填的歸到「未記錄」，才不會憑空少一筆對不起來。 */
export function paymentLabel(order) {
  const method = order?.payment_method ?? order?.paymentMethod
  return method || '未記錄'
}
