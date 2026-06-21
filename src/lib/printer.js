import { StarWebPrintBuilder } from './starwebprnt/StarWebPrintBuilder.js'
import { StarWebPrintTrader }  from './starwebprnt/StarWebPrintTrader.js'
import { supabase }            from './supabase.js'
import { toBig5BinaryString }  from './big5.js'

/* ═══════════════════════════════════════════════
   IP 設定
═══════════════════════════════════════════════ */
const PRINTER_IP_KEY = 'visionpos:printerIp'

function parseIpFromUrl(url) {
  const m = url.match(/^https?:\/\/([^/]+)/)
  return m ? m[1] : url
}

const DEFAULT_PRINTER_IP = parseIpFromUrl(
  import.meta.env.VITE_PRINTER_URL || 'http://192.168.0.100/StarWebPRNT/SendMessage'
)

export function getPrinterIp()     { try { return localStorage.getItem(PRINTER_IP_KEY) || DEFAULT_PRINTER_IP } catch { return DEFAULT_PRINTER_IP } }
export function setPrinterIp(ip)   { try { localStorage.setItem(PRINTER_IP_KEY, ip.trim()) } catch(e) { console.error(e) } }
export function resetPrinterIp()   { try { localStorage.removeItem(PRINTER_IP_KEY) } catch(e) { console.error(e) } }

function getPrinterUrl(override) {
  return `http://${override || getPrinterIp()}/StarWebPRNT/SendMessage`
}

/* ═══════════════════════════════════════════════
   版型設定
═══════════════════════════════════════════════ */
const LAYOUT_KEY = 'visionpos:printerLayout'

export const DEFAULT_LAYOUT = {
  paperWidth:     '58',          // '58' | '80'
  totalScale:      1,            // 總計字體倍率（1-2）
  storeName:      '小滿湯拌滷',
  storeAddress:   '',
  storePhone:     '',
  thankYouLine1:  '感謝您的購買',
  thankYouLine2:  'THANK YOU',
  showQR:          false,
}

export function getPrinterLayout()      { try { const s = localStorage.getItem(LAYOUT_KEY); return s ? { ...DEFAULT_LAYOUT, ...JSON.parse(s) } : { ...DEFAULT_LAYOUT } } catch { return { ...DEFAULT_LAYOUT } } }
export function setPrinterLayout(lay)   { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(lay)) } catch(e) { console.error(e) } }
export function resetPrinterLayout()    { try { localStorage.removeItem(LAYOUT_KEY) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   Logo（Base64，單獨儲存避免太大）
═══════════════════════════════════════════════ */
const LOGO_KEY = 'visionpos:printerLogo'
const QR_KEY   = 'visionpos:printerQR'

export function getPrinterLogo()     { try { return localStorage.getItem(LOGO_KEY) || '' } catch { return '' } }
export function setPrinterLogo(b64)  { try { localStorage.setItem(LOGO_KEY, b64) } catch(e) { console.error(e) } }
export function removePrinterLogo()  { try { localStorage.removeItem(LOGO_KEY) } catch(e) { console.error(e) } }

export function getPrinterQR()       { try { return localStorage.getItem(QR_KEY) || '' } catch { return '' } }
export function setPrinterQR(b64)    { try { localStorage.setItem(QR_KEY, b64) } catch(e) { console.error(e) } }
export function removePrinterQR()    { try { localStorage.removeItem(QR_KEY) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   工具函式
═══════════════════════════════════════════════ */
function bigText(text) {
  return { data: toBig5BinaryString(text), binary: true }
}

/* 計算字串的「半字元寬」（中文=2, ASCII=1） */
function displayWidth(str) {
  return [...str].reduce((w, c) => w + (c.charCodeAt(0) > 0x7F ? 2 : 1), 0)
}

/* 填充到指定寬度：left 靠左、right 靠右，中間補空白 */
function padLine(left, right, totalW) {
  const spaces = Math.max(1, totalW - displayWidth(left) - displayWidth(right))
  return left + ' '.repeat(spaces) + right
}

/* 手動置中：左邊補空白（比 createAlignmentElement 可靠） */
function centerText(text, totalW) {
  const pad = Math.max(0, Math.floor((totalW - displayWidth(text)) / 2))
  return ' '.repeat(pad) + text
}

/* 品項依商品編號排序：英文字母 A→Z，同字母內數字 01→99 */
function sortByCode(items) {
  return [...items].sort((a, b) => {
    const ca = (a.code || '\uFFFF').toUpperCase()
    const cb = (b.code || '\uFFFF').toUpperCase()
    // 先比較英文字母前綴
    const prefA = ca.match(/^[A-Z]+/)?.[0] ?? ''
    const prefB = cb.match(/^[A-Z]+/)?.[0] ?? ''
    if (prefA !== prefB) return prefA.localeCompare(prefB)
    // 再比較數字部分
    const numA = parseInt(ca.match(/\d+/)?.[0] ?? '0', 10)
    const numB = parseInt(cb.match(/\d+/)?.[0] ?? '0', 10)
    return numA - numB
  })
}

/* 把 logo/QR base64 載入成 Canvas
   關鍵：回傳的 Canvas 寬度 = paperWidthDots（紙張全寬）
   圖片縮放後水平置中畫在 Canvas 上，送到印表機就會自動居中
   不依賴 createAlignmentElement 或 x 偏移，最可靠 */
async function loadImageCanvas(base64, paperWidthDots, maxHeightDots = 120) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = base64 })

  /* 依寬/高限制等比縮放 */
  const scaleW  = paperWidthDots / img.naturalWidth
  const scaleH  = maxHeightDots  / img.naturalHeight
  const scale   = Math.min(1, scaleW, scaleH)
  const imgW    = Math.max(1, Math.floor(img.naturalWidth  * scale))
  const imgH    = Math.max(1, Math.floor(img.naturalHeight * scale))

  /* Canvas = 紙張全寬 × 縮放後高度；圖片水平置中 */
  const canvas  = document.createElement('canvas')
  canvas.width  = paperWidthDots
  canvas.height = imgH
  const ctx     = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, Math.floor((paperWidthDots - imgW) / 2), 0, imgW, imgH)
  return canvas
}

/* ═══════════════════════════════════════════════
   Ping 狀態
═══════════════════════════════════════════════ */
export function checkPrinterStatus(testIp) {
  return new Promise((resolve) => {
    try {
      const builder = new StarWebPrintBuilder()
      const request = builder.createInitializationElement()
      const trader  = new StarWebPrintTrader({ url: getPrinterUrl(testIp), papertype: 'normal', timeout: 4000 })
      trader.onReceive = () => resolve(true)
      trader.onError   = () => resolve(false)
      trader.sendMessage({ request })
    } catch { resolve(false) }
  })
}

/* ═══════════════════════════════════════════════
   取單號
═══════════════════════════════════════════════ */
export async function getNextPickupNumber() {
  const { data, error } = await supabase.rpc('next_pickup_number')
  if (error) { console.error('[printer] 取號失敗', error); return null }
  return data
}

/* ═══════════════════════════════════════════════
   組版（async → 支援 logo 圖片載入）
═══════════════════════════════════════════════ */
async function buildReceiptRequest({
  pickupNumber, orderType, tableName,
  items, tags, note,
  subtotal, surchargeAmount, discountAmount, total,
}) {
  const layout  = getPrinterLayout()
  const logo    = getPrinterLogo()
  const qrImage = getPrinterQR()
  const LINE_W  = layout.paperWidth === '80' ? 46 : 30
  const DOT_W   = layout.paperWidth === '80' ? 576 : 384

  const builder = new StarWebPrintBuilder()
  let req = ''

  req += builder.createInitializationElement()
  req += builder.createTextElement({ codepage: 'big5' })

  /* ── Logo（Canvas 已是紙張全寬、圖片置中） ── */
  if (logo) {
    try {
      const canvas = await loadImageCanvas(logo, DOT_W, 120)
      req += builder.createBitImageElement({ context: canvas.getContext('2d'), x: 0, y: 0, width: canvas.width, height: canvas.height })
      req += builder.createTextElement(bigText('\n'))
    } catch (e) { console.warn('[printer] logo 載入失敗，略過', e) }
  }

  /* ── 外帶 / 內用　　取單號:#01 ── */
  const orderLabel = orderType === 'takeout' ? '外帶' : `內用${tableName ? '-' + tableName : ''}`
  const pickupStr  = pickupNumber != null ? `取單號:#${String(pickupNumber).padStart(2, '0')}` : ''
  const headerLine = pickupStr ? padLine(orderLabel, pickupStr, LINE_W) : orderLabel
  req += builder.createTextElement({ emphasis: true, ...bigText(headerLine + '\n') })

  /* ── 日期時間 ── */
  const now  = new Date()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const dStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`
  const tStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
  req += builder.createTextElement(bigText(`週${days[now.getDay()]} ${dStr} ${tStr}\n`))
  req += builder.createTextElement(bigText(`品項數：${items.length}\n`))

  req += builder.createRuledLineElement({ thickness: 'medium', width: DOT_W })

  /* ── 口味(標籤) + 備註：放在品項前面，做餐人員一眼看到 ── */
  if (tags?.length || note) {
    if (tags?.length) req += builder.createTextElement(bigText(`口味: ${tags.map(t => t.label).join(' ')}\n`))
    if (note)         req += builder.createTextElement(bigText(`備註: ${note}\n`))
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  }

  /* ── 品項（依商品編號 A→Z、01→99 排序） ── */
  const sortedItems = sortByCode(items)
  sortedItems.forEach((line, idx) => {
    const numAndName = `${idx + 1}. ${line.name}`
    const right      = `x${line.qty}  $${(line.price * line.qty).toFixed(0)}`
    req += builder.createTextElement(bigText(padLine(numAndName, right, LINE_W) + '\n'))
  })

  /* ── 小計 ── */
  req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  req += builder.createTextElement(bigText(padLine('小計', `$${subtotal.toFixed(0)}`, LINE_W) + '\n'))

  /* ── 折扣 / 加價（有才印） ── */
  if (discountAmount > 0 || surchargeAmount > 0) {
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
    if (surchargeAmount > 0) req += builder.createTextElement(bigText(padLine('加價', `+$${surchargeAmount.toFixed(0)}`, LINE_W) + '\n'))
    if (discountAmount  > 0) req += builder.createTextElement(bigText(padLine('折扣', `$${discountAmount.toFixed(0)}`,  LINE_W) + '\n'))
  }

  /* ── 總計 ── */
  req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  req += builder.createTextElement({ emphasis: true, ...bigText(padLine('總計', `$${total.toFixed(0)}`, LINE_W) + '\n') })
  req += builder.createRuledLineElement({ thickness: 'medium', width: DOT_W })

  /* ── 感謝詞 + 地址電話（手動置中，比 alignment element 可靠） ── */
  if (layout.thankYouLine1) req += builder.createTextElement(bigText(centerText(layout.thankYouLine1, LINE_W) + '\n'))
  if (layout.thankYouLine2) req += builder.createTextElement(bigText(centerText(layout.thankYouLine2, LINE_W) + '\n'))
  if (layout.storeAddress)  req += builder.createTextElement(bigText(centerText(layout.storeAddress,  LINE_W) + '\n'))
  if (layout.storePhone)    req += builder.createTextElement(bigText(centerText(layout.storePhone,    LINE_W) + '\n'))

  /* ── QR Code（使用者上傳的圖片，Canvas 全寬置中） ── */
  if (qrImage) {
    try {
      const qrCanvas = await loadImageCanvas(qrImage, DOT_W, 200)
      req += builder.createBitImageElement({ context: qrCanvas.getContext('2d'), x: 0, y: 0, width: qrCanvas.width, height: qrCanvas.height })
    } catch (e) { console.warn('[printer] QR 圖片載入失敗，略過', e) }
  }

  req += builder.createTextElement(bigText('\n'))
  req += builder.createAlignmentElement({ position: 'left' })
  req += builder.createCutPaperElement({ feed: true })

  return req
}

/* ═══════════════════════════════════════════════
   送出列印
═══════════════════════════════════════════════ */
export function printOrderReceipt(orderData) {
  return new Promise(async (resolve) => {
    let request
    try {
      request = await buildReceiptRequest(orderData)
    } catch (e) {
      console.warn('[printer] 組版失敗', e)
      resolve({ success: false, error: e })
      return
    }
    /* timeout 縮短到 3 秒，失敗靜默 resolve，不 alert */
    const trader = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 3000 })
    trader.onReceive = (resp) => resolve({ success: true,  response: resp })
    trader.onError   = (resp) => { console.warn('[printer] 出單失敗（無出單機模式）'); resolve({ success: false, error: resp }) }
    trader.sendMessage({ request })
  })
}