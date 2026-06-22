import { StarWebPrintBuilder } from './starwebprnt/StarWebPrintBuilder.js'
import { StarWebPrintTrader }  from './starwebprnt/StarWebPrintTrader.js'
import { supabase }            from './supabase.js'
import { toBig5BinaryString }  from './big5.js'

/* ═══════════════════════════════════════════════
   店家 prefix：讓每家店的 localStorage 設定獨立存
═══════════════════════════════════════════════ */
function storePrefix() {
  try {
    const raw = localStorage.getItem('visionpos_auth')
    const { s } = JSON.parse(raw ?? '{}')
    return s?.code ? `visionpos:${s.code}` : 'visionpos'
  } catch { return 'visionpos' }
}

/* ═══════════════════════════════════════════════
   IP 設定
═══════════════════════════════════════════════ */
const PRINTER_IP_KEY = () => `${storePrefix()}:printerIp`

function parseIpFromUrl(url) {
  const m = url.match(/^https?:\/\/([^/]+)/)
  return m ? m[1] : url
}

const DEFAULT_PRINTER_IP = parseIpFromUrl(
  import.meta.env.VITE_PRINTER_URL || 'http://192.168.0.100/StarWebPRNT/SendMessage'
)

export function getPrinterIp()   { try { return localStorage.getItem(PRINTER_IP_KEY()) || DEFAULT_PRINTER_IP } catch { return DEFAULT_PRINTER_IP } }
export function setPrinterIp(ip) { try { localStorage.setItem(PRINTER_IP_KEY(), ip.trim()) } catch(e) { console.error(e) } }
export function resetPrinterIp() { try { localStorage.removeItem(PRINTER_IP_KEY()) } catch(e) { console.error(e) } }

function getPrinterUrl(override) {
  return `http://${override || getPrinterIp()}/StarWebPRNT/SendMessage`
}

/* ═══════════════════════════════════════════════
   版型設定
═══════════════════════════════════════════════ */
const LAYOUT_KEY = () => `${storePrefix()}:printerLayout`

export const DEFAULT_LAYOUT = {
  paperWidth:    '58',
  totalScale:     1,
  storeName:     '小滿湯拌滷',
  storeAddress:  '',
  storePhone:    '',
  thankYouLine1: '感謝您的購買',
  thankYouLine2: 'THANK YOU',
  showQR:         false,
}

export function getPrinterLayout()    { try { const s = localStorage.getItem(LAYOUT_KEY()); return s ? { ...DEFAULT_LAYOUT, ...JSON.parse(s) } : { ...DEFAULT_LAYOUT } } catch { return { ...DEFAULT_LAYOUT } } }
export function setPrinterLayout(lay) { try { localStorage.setItem(LAYOUT_KEY(), JSON.stringify(lay)) } catch(e) { console.error(e) } }
export function resetPrinterLayout()  { try { localStorage.removeItem(LAYOUT_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   Logo（Base64，單獨儲存避免太大）
═══════════════════════════════════════════════ */
const LOGO_KEY = () => `${storePrefix()}:printerLogo`
const QR_KEY   = () => `${storePrefix()}:printerQR`

export function getPrinterLogo()     { try { return localStorage.getItem(LOGO_KEY()) || '' } catch { return '' } }
export function setPrinterLogo(b64)  { try { localStorage.setItem(LOGO_KEY(), b64) } catch(e) { console.error(e) } }
export function removePrinterLogo()  { try { localStorage.removeItem(LOGO_KEY()) } catch(e) { console.error(e) } }

export function getPrinterQR()       { try { return localStorage.getItem(QR_KEY()) || '' } catch { return '' } }
export function setPrinterQR(b64)    { try { localStorage.setItem(QR_KEY(), b64) } catch(e) { console.error(e) } }
export function removePrinterQR()    { try { localStorage.removeItem(QR_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   首頁 URL（側邊欄 Logo 連結）
═══════════════════════════════════════════════ */
const HOMEPAGE_URL_KEY = () => `${storePrefix()}:homepageUrl`

export function getHomepageUrl()      { try { return localStorage.getItem(HOMEPAGE_URL_KEY()) || '' } catch { return '' } }
export function setHomepageUrl(url)   { try { localStorage.setItem(HOMEPAGE_URL_KEY(), url.trim()) } catch(e) { console.error(e) } }
export function removeHomepageUrl()   { try { localStorage.removeItem(HOMEPAGE_URL_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   工具函式
═══════════════════════════════════════════════ */
function bigText(text) {
  return { data: toBig5BinaryString(text), binary: true }
}

function displayWidth(str) {
  return [...str].reduce((w, c) => w + (c.charCodeAt(0) > 0x7F ? 2 : 1), 0)
}

function padLine(left, right, totalW) {
  const spaces = Math.max(1, totalW - displayWidth(left) - displayWidth(right))
  return left + ' '.repeat(spaces) + right
}

function centerText(text, totalW) {
  const pad = Math.max(0, Math.floor((totalW - displayWidth(text)) / 2))
  return ' '.repeat(pad) + text
}

function sortByCode(items) {
  return [...items].sort((a, b) => {
    const ca = (a.code || '\uFFFF').toUpperCase()
    const cb = (b.code || '\uFFFF').toUpperCase()
    const prefA = ca.match(/^[A-Z]+/)?.[0] ?? ''
    const prefB = cb.match(/^[A-Z]+/)?.[0] ?? ''
    if (prefA !== prefB) return prefA.localeCompare(prefB)
    const numA = parseInt(ca.match(/\d+/)?.[0] ?? '0', 10)
    const numB = parseInt(cb.match(/\d+/)?.[0] ?? '0', 10)
    return numA - numB
  })
}

async function loadImageCanvas(base64, paperWidthDots, maxHeightDots = 120) {
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = base64 })
  const scaleW = paperWidthDots / img.naturalWidth
  const scaleH = maxHeightDots  / img.naturalHeight
  const scale  = Math.min(1, scaleW, scaleH)
  const imgW   = Math.max(1, Math.floor(img.naturalWidth  * scale))
  const imgH   = Math.max(1, Math.floor(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width  = paperWidthDots
  canvas.height = imgH
  const ctx = canvas.getContext('2d')
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
   組版
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

  if (logo) {
    try {
      const canvas = await loadImageCanvas(logo, DOT_W, 120)
      req += builder.createBitImageElement({ context: canvas.getContext('2d'), x: 0, y: 0, width: canvas.width, height: canvas.height })
      req += builder.createTextElement(bigText('\n'))
    } catch (e) { console.warn('[printer] logo 載入失敗，略過', e) }
  }

  const orderLabel = orderType === 'takeout' ? '外帶' : `內用${tableName ? '-' + tableName : ''}`
  const pickupStr  = pickupNumber != null ? `取單號:#${String(pickupNumber).padStart(2, '0')}` : ''
  const headerLine = pickupStr ? padLine(orderLabel, pickupStr, LINE_W) : orderLabel
  req += builder.createTextElement({ emphasis: true, ...bigText(headerLine + '\n') })

  const now  = new Date()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const dStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`
  const tStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
  req += builder.createTextElement(bigText(`週${days[now.getDay()]} ${dStr} ${tStr}\n`))
  req += builder.createTextElement(bigText(`品項數：${items.length}\n`))
  req += builder.createRuledLineElement({ thickness: 'medium', width: DOT_W })

  if (tags?.length || note) {
    if (tags?.length) req += builder.createTextElement(bigText(`口味: ${tags.map(t => t.label).join(' ')}\n`))
    if (note)         req += builder.createTextElement(bigText(`備註: ${note}\n`))
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  }

  const sortedItems = sortByCode(items)
  sortedItems.forEach((line, idx) => {
    const numAndName = `${idx + 1}. ${line.name}`
    const right      = `x${line.qty}  $${(line.price * line.qty).toFixed(0)}`
    req += builder.createTextElement(bigText(padLine(numAndName, right, LINE_W) + '\n'))
  })

  req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  req += builder.createTextElement(bigText(padLine('小計', `$${subtotal.toFixed(0)}`, LINE_W) + '\n'))

  if (discountAmount > 0 || surchargeAmount > 0) {
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
    if (surchargeAmount > 0) req += builder.createTextElement(bigText(padLine('加價', `+$${surchargeAmount.toFixed(0)}`, LINE_W) + '\n'))
    if (discountAmount  > 0) req += builder.createTextElement(bigText(padLine('折扣', `$${discountAmount.toFixed(0)}`,  LINE_W) + '\n'))
  }

  req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  req += builder.createTextElement({ emphasis: true, ...bigText(padLine('總計', `$${total.toFixed(0)}`, LINE_W) + '\n') })
  req += builder.createRuledLineElement({ thickness: 'medium', width: DOT_W })

  if (layout.thankYouLine1) req += builder.createTextElement(bigText(centerText(layout.thankYouLine1, LINE_W) + '\n'))
  if (layout.thankYouLine2) req += builder.createTextElement(bigText(centerText(layout.thankYouLine2, LINE_W) + '\n'))
  if (layout.storeAddress)  req += builder.createTextElement(bigText(centerText(layout.storeAddress,  LINE_W) + '\n'))
  if (layout.storePhone)    req += builder.createTextElement(bigText(centerText(layout.storePhone,    LINE_W) + '\n'))

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
    const trader = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 3000 })
    trader.onReceive = (resp) => resolve({ success: true,  response: resp })
    trader.onError   = (resp) => { console.warn('[printer] 出單失敗（無出單機模式）'); resolve({ success: false, error: resp }) }
    trader.sendMessage({ request })
  })
}