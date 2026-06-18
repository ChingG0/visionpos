import { StarWebPrintBuilder } from './starwebprnt/StarWebPrintBuilder.js'
import { StarWebPrintTrader }  from './starwebprnt/StarWebPrintTrader.js'
import { supabase } from './supabase.js'

/*
  出單機設定（Star mC-Print3 / MCP31L，網路版）
  換印表機或換 IP，只要改 .env 的 VITE_PRINTER_URL，不用動程式碼。
  端點格式：http://<印表機IP>/StarWebPRNT/SendMessage
*/
const PRINTER_URL = import.meta.env.VITE_PRINTER_URL || 'http://192.168.0.100/StarWebPRNT/SendMessage'

/* 店家資訊：之後想做成後台可編輯設定的話，改成從 Supabase 讀即可，現在先寫死方便改 */
const STORE_INFO = {
  name:    '小滿湯拌滷',
  address: '',   // TODO: 填店址，要印在收據上的話這裡填
  phone:   '',   // TODO: 填電話
}

/* 80mm 出單機可印寬度，單位是點（dot），mC-Print3 標準值 */
const LINE_WIDTH_DOTS = 576

/* 跟後台拿今天的取單號（每天從 1 開始，原子遞增不會搶號） */
export async function getNextPickupNumber() {
  const { data, error } = await supabase.rpc('next_pickup_number')
  if (error) {
    console.error('[printer] 取得取單號失敗', error)
    return null
  }
  return data
}

/*
  檢查出單機是否連線：只送「初始化」這個不印紙、不切紙、不進紙的最小指令當 ping，
  收到回應就算連線正常。給畫面上的綠燈/紅燈用，輪詢用，逾時設短一點（4 秒）。
*/
export function checkPrinterStatus() {
  return new Promise((resolve) => {
    let request
    try {
      const builder = new StarWebPrintBuilder()
      request = builder.createInitializationElement()
    } catch (e) {
      resolve(false)
      return
    }

    const trader = new StarWebPrintTrader({ url: PRINTER_URL, papertype: 'normal', timeout: 4000 })
    trader.onReceive = () => resolve(true)
    trader.onError   = () => resolve(false)
    trader.sendMessage({ request })
  })
}

function buildReceiptRequest({
  pickupNumber, orderType, tableName,
  items, tags, note,
  subtotal, surchargeAmount, discountAmount, total,
}) {
  const builder = new StarWebPrintBuilder()
  let req = ''

  req += builder.createInitializationElement()
  /* 印表機記憶體設定已經是 Character Mode: T-Chinese，這裡指定 big5 編碼讓繁體中文正常印出 */
  req += builder.createTextElement({ codepage: 'big5' })

  /* 店名 */
  req += builder.createAlignmentElement({ position: 'center' })
  req += builder.createTextElement({ width: 2, height: 2, emphasis: true, data: `${STORE_INFO.name}\n` })
  if (STORE_INFO.address) req += builder.createTextElement({ data: `${STORE_INFO.address}\n` })
  if (STORE_INFO.phone)   req += builder.createTextElement({ data: `${STORE_INFO.phone}\n` })
  req += builder.createTextElement({ data: '\n' })

  /* 取單號 */
  if (pickupNumber != null) {
    req += builder.createTextElement({ width: 3, height: 3, emphasis: true, data: `取單號 ${pickupNumber}\n` })
  }
  req += builder.createAlignmentElement({ position: 'left' })
  req += builder.createTextElement({ data: '\n' })

  req += builder.createRuledLineElement({ thickness: 'medium', width: LINE_WIDTH_DOTS })

  /* 內用 / 外帶 + 品項數 */
  const typeLabel = orderType === 'takeout' ? '外帶' : `內用－${tableName || '未選桌'}`
  req += builder.createTextElement({ emphasis: true, data: `${typeLabel}\n` })
  req += builder.createTextElement({ data: `品項數：${items.length}\n` })

  req += builder.createRuledLineElement({ thickness: 'thin', width: LINE_WIDTH_DOTS })

  /* 品項列表（先求穩定可印出，不做精準靠右對齊——中文跟數字寬度不同，硬排容易跑版） */
  items.forEach((line, idx) => {
    const lineTotal = (line.price * line.qty).toFixed(0)
    req += builder.createTextElement({ data: `${idx + 1}. ${line.name} x${line.qty}　$${lineTotal}\n` })
  })

  if (tags?.length) {
    req += builder.createTextElement({ data: `標籤：${tags.map(t => t.label).join('、')}\n` })
  }
  if (note) {
    req += builder.createTextElement({ data: `備註：${note}\n` })
  }

  req += builder.createRuledLineElement({ thickness: 'thin', width: LINE_WIDTH_DOTS })

  req += builder.createTextElement({ data: `小計　　$${subtotal.toFixed(0)}\n` })
  if (surchargeAmount > 0) req += builder.createTextElement({ data: `加價　　+$${surchargeAmount.toFixed(0)}\n` })
  if (discountAmount > 0) req += builder.createTextElement({ data: `折扣　　−$${discountAmount.toFixed(0)}\n` })

  req += builder.createTextElement({ data: '\n' })
  req += builder.createTextElement({ width: 2, height: 2, emphasis: true, data: `總計 $${total.toFixed(0)}\n` })
  req += builder.createTextElement({ data: '\n' })

  req += builder.createAlignmentElement({ position: 'center' })
  req += builder.createTextElement({ data: `${new Date().toLocaleString('zh-TW', { hour12: false })}\n` })
  req += builder.createAlignmentElement({ position: 'left' })

  req += builder.createCutPaperElement({ feed: true })

  return req
}

/*
  送出列印。失敗不會擲出例外讓畫面卡住——出單機離線/沒插電是常態，
  訂單該照樣送出，列印失敗只記錄 log，不擋結帳流程。
  回傳 { success: boolean, error? }
*/
export function printOrderReceipt(orderData) {
  return new Promise((resolve) => {
    let request
    try {
      request = buildReceiptRequest(orderData)
    } catch (e) {
      console.error('[printer] 組版失敗', e)
      resolve({ success: false, error: e })
      return
    }

    const trader = new StarWebPrintTrader({ url: PRINTER_URL, papertype: 'normal', timeout: 10000 })

    trader.onReceive = (response) => {
      resolve({ success: true, response })
    }
    trader.onError = (response) => {
      console.error('[printer] 出單失敗', response)
      resolve({ success: false, error: response })
    }

    trader.sendMessage({ request })
  })
}