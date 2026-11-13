// =============================================================================
// reservationTime.js — 訂位的「今天」與倒數計算
//
// 這裡存在的原因是兩個實際出過包的 bug：
//
// ① new Date().toISOString().slice(0, 10) 取的是 UTC 日期，不是台灣日期。
//    台灣是 UTC+8，所以凌晨 00:00–08:00 之間它會回傳「昨天」。宵夜店在那段
//    時間開的訂位會被存成昨天，早上 8 點 UTC 跳日之後就從清單上消失。
//    todayLocal() 用本地時間的年月日組字串，不經過 UTC。
//
// ② 倒數的文字以前是在「建立訂位的當下」算一次就寫進資料庫（time_label /
//    urgency 兩個欄位），之後永遠不更新，所以畫面上會看到「216小時後」這種
//    建立當時的化石數字。現在改成顯示時即時算，資料庫那兩個欄位仍然會寫，
//    但不再拿來顯示。
// =============================================================================

/** 把 Date 轉成本地時區的 YYYY-MM-DD。 */
export function localDateOf(d) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 本地時區的今天，格式 YYYY-MM-DD。不要用 toISOString()，那是 UTC。 */
export function todayLocal() {
  return localDateOf(new Date())
}

/** 這筆訂位該不該出現在「今日訂位」面板。
 *
 * 規則是店家定的：日曆換日不算數，要看開帳／關帳。
 *   · 時間還沒到的 —— 一律保留，不管有沒有關帳。
 *     （怕店員按錯關帳、或單純想先結帳，結果把晚點要來的客人弄不見。）
 *   · 時間已經過了 —— 要晚於「上次關帳」才留著。
 *     所以 23:30 的訂位在凌晨 00:05 還在面板上，等店家凌晨兩點關帳才收走。
 *   · 日期晚於今天的不進這個面板（那是未來的訂位，到預約管理頁看）。
 */
export function showsInTodayPanel(r, nowMs, todayStr, closeoutMs) {
  if (r.status !== 'waiting') return false
  if (r.date > todayStr) return false
  const dt = reservationDateTime(r.date, r.time)
  if (!dt) return false
  if (dt.getTime() > nowMs) return true
  return closeoutMs == null || dt.getTime() > closeoutMs
}

/** 把 date + time 兩個欄位組成本地時間的 Date。
 *  Postgres 的 time 欄位回來是 "18:30:00"，表單送出的是 "18:30"，兩種都要吃。 */
export function reservationDateTime(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const t = timeStr.length === 5 ? `${timeStr}:00` : timeStr
  const d = new Date(`${dateStr}T${t}`)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 即時算出要顯示的倒數文字與急迫度顏色。
 *  nowMs 可以傳入，讓呼叫端用自己的計時器驅動重算（也方便測試）。 */
export function reservationUrgency(dateStr, timeStr, nowMs = Date.now()) {
  const target = reservationDateTime(dateStr, timeStr)
  if (!target) return { label: '', urgency: 'blue' }

  const diffMin = Math.round((target.getTime() - nowMs) / 60000)

  // 已經過了預約時間。以前這裡會因為 Math.max(diffMin, 1) 顯示成「1分鐘後」，
  // 跟預約管理頁的「已超過 N 分鐘」對不起來，兩邊看同一筆會是不同的字。
  if (diffMin <= 0) {
    return { label: diffMin === 0 ? '現在到達' : `已超過 ${-diffMin} 分鐘`, urgency: 'red' }
  }

  if (diffMin <= 30)  return { label: `${diffMin}分鐘後`, urgency: 'red' }
  if (diffMin <= 90)  return { label: '1小時後',          urgency: 'orange' }
  if (diffMin <= 150) return { label: '2小時後',          urgency: 'orange' }

  // 超過一天的訂位講「幾小時後」沒有意義（曾經顯示過「216小時後」），改講天數。
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return { label: `${diffHour}小時後`, urgency: 'blue' }
  return { label: `${Math.round(diffHour / 24)}天後`, urgency: 'blue' }
}
