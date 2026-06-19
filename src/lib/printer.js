import { StarWebPrintBuilder } from './starwebprnt/StarWebPrintBuilder.js'
import { StarWebPrintTrader }  from './starwebprnt/StarWebPrintTrader.js'
import { supabase }            from './supabase.js'
import { toBig5BinaryString }  from './Big5.js'

/*
  出單機設定（Star mC-Print3 / MCP31L，網路版）
  預設值來自 .env 的 VITE_PRINTER_URL；如果使用者在「出單機設定」畫面手動填過 IP，
  存在這台裝置的 localStorage 裡，之後一律優先用使用者填的值——這樣現場換網路、
  印表機拿到新 IP，可以直接在畫面上改，不用回來改 .env 重新部署。
  端點格式固定：http://<印表機IP>/StarWebPRNT/SendMessage
*/
const PRINTER_IP_STORAGE_KEY = 'visionpos:printerIp'

function parseIpFromUrl(url) {
  const match = url.match(/^https?:\/\/([^/]+)/)
  return match ? match[1] : url
}

const DEFAULT_PRINTER_IP = parseIpFromUrl(
  import.meta.env.VITE_PRINTER_URL || 'http://192.168.0.100/StarWebPRNT/SendMessage'
)

export function getPrinterIp() {
  try {
    return localStorage.getItem(PRINTER_IP_STORAGE_KEY) || DEFAULT_PRINTER_IP
  } catch (e) {
    return DEFAULT_PRINTER_IP
  }
}

export function setPrinterIp(ip) {
  try {
    localStorage.setItem(PRINTER_IP_STORAGE_KEY, ip.trim())
  } catch (e) {
    console.error('[printer] 儲存印表機 IP 失敗', e)
  }
}

export function resetPrinterIp() {
  try {
    localStorage.removeItem(PRINTER_IP_STORAGE_KEY)
  } catch (e) {
    console.error('[printer] 重置印表機 IP 失敗', e)
  }
}

function getPrinterUrl(ipOverride) {
  const ip = ipOverride || getPrinterIp()
  return `http://${ip}/StarWebPRNT/SendMessage`
}

/* 店家資訊：之後想做成後台可編輯設定的話，改成從 Supabase 讀即可，現在先寫死方便改 */
const STORE_INFO = {
  name:    '小滿湯拌滷',
  address: '',   // TODO: 填店址，要印在收據上的話這裡填
  phone:   '',   // TODO: 填電話
}

/*
  可印寬度，單位是點（dot）。實際紙捲是 5.5cm，跟印表機自助測試單上顯示的
  「Printable Area: 72mm」（對應 80mm 紙捲）不一致——換紙寬要用 Star 官方的
  設定工具改記憶體開關才會真的生效，不是換捲紙就自動切換。這裡先用 58mm
  紙捲常見的 384 點，如果印出來這條線跑出紙外或留白太多，告訴我再調。
*/
const LINE_WIDTH_DOTS = 384

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
  testIp：在「出單機設定」畫面測試還沒儲存的 IP 時用，不傳的話就用目前已儲存/預設的 IP。
*/
export function checkPrinterStatus(testIp) {
  return new Promise((resolve) => {
    let request
    try {
      const builder = new StarWebPrintBuilder()
      request = builder.createInitializationElement()
    } catch (e) {
      resolve(false)
      return
    }

    const trader = new StarWebPrintTrader({ url: getPrinterUrl(testIp), papertype: 'normal', timeout: 4000 })
    trader.onReceive = () => resolve(true)
    trader.onError   = () => resolve(false)
    trader.sendMessage({ request })
  })
}

/*
  印表機的記憶體設定是 Character Mode: T-Chinese，內建字型是 Big5 雙位元組定址，
  不是 Unicode 字型。所以中文文字一定要先轉成真正的 Big5 位元組，透過 binary
  模式送出去——只靠 codepage 屬性貼標籤、底層仍送 UTF-8 位元組的話，印表機會
  用 Big5 的方式去解讀那些 UTF-8 位元組，印出來會是另一批字（之前遇到的亂碼）。
  這個函式把所有文字內容都統一走這條路，數字/英文混在中文裡也沒問題
  （Big5 在 0x00–0x7F 範圍跟 ASCII 相容）。
*/
function bigText(text) {
  return { data: toBig5BinaryString(text), binary: true }
}

function buildReceiptRequest({
  pickupNumber, orderType, tableName,
  items, tags, note,
  subtotal, surchargeAmount, discountAmount, total,
}) {
  const builder = new StarWebPrintBuilder()
  let req = ''

  req += builder.createInitializationElement()
  req += builder.createTextElement({ codepage: 'big5' })

  /* 店名 */
  req += builder.createAlignmentElement({ position: 'center' })
  req += builder.createTextElement({ width: 2, height: 2, emphasis: true, ...bigText(`${STORE_INFO.name}\n`) })
  if (STORE_INFO.address) req += builder.createTextElement(bigText(`${STORE_INFO.address}\n`))
  if (STORE_INFO.phone)   req += builder.createTextElement(bigText(`${STORE_INFO.phone}\n`))
  req += builder.createTextElement(bigText('\n'))

  /* 取單號 */
  if (pickupNumber != null) {
    req += builder.createTextElement({ width: 3, height: 3, emphasis: true, ...bigText(`取單號 ${pickupNumber}\n`) })
  }
  req += builder.createAlignmentElement({ position: 'left' })
  req += builder.createTextElement(bigText('\n'))

  req += builder.createRuledLineElement({ thickness: 'medium', width: LINE_WIDTH_DOTS })

  /* 內用 / 外帶 + 品項數 */
  const typeLabel = orderType === 'takeout' ? '外帶' : `內用－${tableName || '未選桌'}`
  req += builder.createTextElement({ emphasis: true, ...bigText(`${typeLabel}\n`) })
  req += builder.createTextElement(bigText(`品項數：${items.length}\n`))

  req += builder.createRuledLineElement({ thickness: 'thin', width: LINE_WIDTH_DOTS })

  /* 品項列表（先求穩定可印出，不做精準靠右對齊——中文跟數字寬度不同，硬排容易跑版） */
  items.forEach((line, idx) => {
    const lineTotal = (line.price * line.qty).toFixed(0)
    req += builder.createTextElement(bigText(`${idx + 1}. ${line.name} x${line.qty}　$${lineTotal}\n`))
  })

  if (tags?.length) {
    req += builder.createTextElement(bigText(`標籤：${tags.map(t => t.label).join('、')}\n`))
  }
  if (note) {
    req += builder.createTextElement(bigText(`備註：${note}\n`))
  }

  req += builder.createRuledLineElement({ thickness: 'thin', width: LINE_WIDTH_DOTS })

  req += builder.createTextElement(bigText(`小計　　$${subtotal.toFixed(0)}\n`))
  if (surchargeAmount > 0) req += builder.createTextElement(bigText(`加價　　+$${surchargeAmount.toFixed(0)}\n`))
  if (discountAmount > 0) req += builder.createTextElement(bigText(`折扣　　−$${discountAmount.toFixed(0)}\n`))

  req += builder.createTextElement(bigText('\n'))
  req += builder.createTextElement({ width: 2, height: 2, emphasis: true, ...bigText(`總計 $${total.toFixed(0)}\n`) })
  req += builder.createTextElement(bigText('\n'))

  req += builder.createAlignmentElement({ position: 'center' })
  req += builder.createTextElement(bigText(`${new Date().toLocaleString('zh-TW', { hour12: false })}\n`))
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

    const trader = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 10000 })

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