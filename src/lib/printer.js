import { StarWebPrintBuilder } from './starwebprnt/StarWebPrintBuilder.js'
import { StarWebPrintTrader }  from './starwebprnt/StarWebPrintTrader.js'
import { supabase }            from './supabase.js'
import { toBig5BinaryString }  from './big5.js'
import { KITCHEN_STATIONS }    from '@/constants/kitchenStations.js'

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

function getStoreId() {
  try {
    const raw = localStorage.getItem('visionpos_auth')
    const { s } = JSON.parse(raw ?? '{}')
    return s?.id ?? null
  } catch { return null }
}

/* ═══════════════════════════════════════════════
   舊設定搬移

   多店隔離那次改動，把出單機設定的 localStorage 鍵從全域的
   `visionpos:xxx` 改成依店家區分的 `visionpos:{店家代碼}:xxx`，
   但沒有把舊資料搬過去——舊的值還躺在舊鍵裡，程式卻只讀新鍵，
   讀不到就退回寫死的預設值，等於所有裝置的出單機設定（IP、版型、
   Logo、QR、首頁連結）在那次改動後被靜默重置了。

   這裡在讀不到新鍵時自動去看舊鍵，找到就搬過來並清掉舊的，
   讓已經在用的裝置不用重新設定一次。
═══════════════════════════════════════════════ */
function readWithLegacyFallback(scopedKey, legacyKey) {
  try {
    const current = localStorage.getItem(scopedKey)
    if (current !== null) return current

    const legacy = localStorage.getItem(legacyKey)
    if (legacy === null) return null

    // 只有真的登入了（鍵有帶店家代碼）才搬移，否則會把舊值搬到未登入用的
    // 那個 fallback 鍵上，等於原地打轉、之後登入還是讀不到
    if (scopedKey !== legacyKey) {
      localStorage.setItem(scopedKey, legacy)
      localStorage.removeItem(legacyKey)
    }
    return legacy
  } catch { return null }
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

export function getPrinterIp()   { try { return readWithLegacyFallback(PRINTER_IP_KEY(), 'visionpos:printerIp') || DEFAULT_PRINTER_IP } catch { return DEFAULT_PRINTER_IP } }
export function setPrinterIp(ip) { try { localStorage.setItem(PRINTER_IP_KEY(), ip.trim()) } catch(e) { console.error(e) } }
export function resetPrinterIp() { try { localStorage.removeItem(PRINTER_IP_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   HTTPS 開關（每台裝置各自設定）

   出單機開了自簽憑證的 HTTPS 之後，只有「這台裝置已經手動信任過那張憑證」
   才能改用 https 連線——每台裝置信任的時間點不一樣（要各自去設定裡裝一次
   憑證），所以這個開關存在 localStorage，是裝置層級的設定，不是全店共用，
   不會因為某一台裝置切了 https，其他還沒裝憑證的裝置也被迫跟著切過去。
   預設維持 false（http），舊裝置/沒特別設定的裝置行為完全不受影響。
═══════════════════════════════════════════════ */
const USE_HTTPS_KEY = () => `${storePrefix()}:printerUseHttps`

export function getPrinterUseHttps()     { try { return localStorage.getItem(USE_HTTPS_KEY()) === '1' } catch { return false } }
export function setPrinterUseHttps(val)  { try { localStorage.setItem(USE_HTTPS_KEY(), val ? '1' : '0') } catch(e) { console.error(e) } }
export function resetPrinterUseHttps()   { try { localStorage.removeItem(USE_HTTPS_KEY()) } catch(e) { console.error(e) } }

/**
 * overrideIp / overrideHttps：設定頁「測試連線」用來試某個還沒儲存的組合，
 * 不傳就一律讀目前已儲存的設定——確保真正列印/開錢櫃一定是用「已確認可用」
 * 的那組設定，不會不小心印到還沒測試過的組合。
 */
function getPrinterUrl(overrideIp, overrideHttps) {
  const useHttps = overrideHttps !== undefined ? overrideHttps : getPrinterUseHttps()
  const scheme   = useHttps ? 'https' : 'http'
  return `${scheme}://${overrideIp || getPrinterIp()}/StarWebPRNT/SendMessage`
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

export function getPrinterLayout()    { try { const s = readWithLegacyFallback(LAYOUT_KEY(), 'visionpos:printerLayout'); return s ? { ...DEFAULT_LAYOUT, ...JSON.parse(s) } : { ...DEFAULT_LAYOUT } } catch { return { ...DEFAULT_LAYOUT } } }
export function setPrinterLayout(lay) { try { localStorage.setItem(LAYOUT_KEY(), JSON.stringify(lay)) } catch(e) { console.error(e) } }
export function resetPrinterLayout()  { try { localStorage.removeItem(LAYOUT_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   Logo（Base64，單獨儲存避免太大）
═══════════════════════════════════════════════ */
const LOGO_KEY = () => `${storePrefix()}:printerLogo`
const QR_KEY   = () => `${storePrefix()}:printerQR`

export function getPrinterLogo()     { try { return readWithLegacyFallback(LOGO_KEY(), 'visionpos:printerLogo') || '' } catch { return '' } }
export function setPrinterLogo(b64)  { try { localStorage.setItem(LOGO_KEY(), b64) } catch(e) { console.error(e) } }
export function removePrinterLogo()  { try { localStorage.removeItem(LOGO_KEY()) } catch(e) { console.error(e) } }

export function getPrinterQR()       { try { return readWithLegacyFallback(QR_KEY(), 'visionpos:printerQR') || '' } catch { return '' } }
export function setPrinterQR(b64)    { try { localStorage.setItem(QR_KEY(), b64) } catch(e) { console.error(e) } }
export function removePrinterQR()    { try { localStorage.removeItem(QR_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   首頁 URL（側邊欄 Logo 連結）
═══════════════════════════════════════════════ */
const HOMEPAGE_URL_KEY = () => `${storePrefix()}:homepageUrl`

export function getHomepageUrl()      { try { return readWithLegacyFallback(HOMEPAGE_URL_KEY(), 'visionpos:homepageUrl') || '' } catch { return '' } }
export function setHomepageUrl(url)   { try { localStorage.setItem(HOMEPAGE_URL_KEY(), url.trim()) } catch(e) { console.error(e) } }
export function removeHomepageUrl()   { try { localStorage.removeItem(HOMEPAGE_URL_KEY()) } catch(e) { console.error(e) } }

/* ═══════════════════════════════════════════════
   結帳時是否列印交易明細

   不是每個客人都要明細，所以做成結帳畫面上的開關；但同一家店的習慣通常固定
   （例如做生意對帳的店天天都要印），每次都要重勾很煩，這裡記住上次的選擇當
   下一次的預設值。跟其他出單機設定一樣是裝置層級、依店家分開存。
═══════════════════════════════════════════════ */
const PRINT_DETAIL_KEY = () => `${storePrefix()}:printTransactionDetail`

export function getPrintDetailDefault()  { try { return localStorage.getItem(PRINT_DETAIL_KEY()) === '1' } catch { return false } }
export function setPrintDetailDefault(v) { try { localStorage.setItem(PRINT_DETAIL_KEY(), v ? '1' : '0') } catch(e) { console.error(e) } }

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

/**
 * 支援 width/height 放大倍率的置中：放大後每個字元（含空格）視覺寬度會變成
 * scale 倍，所以要先把可用欄寬換算成「縮放前的虛擬欄寬」再置中，
 * 否則直接套用 centerText() 會因為空格也被放大而跑版。
 */
function centerTextScaled(text, totalW, scale = 1) {
  const virtualW = Math.floor(totalW / scale)
  const pad = Math.max(0, Math.floor((virtualW - displayWidth(text)) / 2))
  return ' '.repeat(pad) + text
}

/** 單品標籤 + 手輸備註，組成印在品名下方的那一行（沒有就回空字串）。
 *  時價商品如果有填重量，也印在這一行，方便客人跟店家事後對帳核對。 */
function itemExtraLine(line) {
  const parts = []
  if (line.weight && line.unit) parts.push(`${line.weight}${line.unit}`)
  if (line.tags?.length) parts.push(line.tags.map(t => t.label).join(' '))
  if (line.note)         parts.push(line.note)
  return parts.join('　')
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

/* Logo / QR 每次出單都要 decode base64 再畫進 canvas，那是主執行緒的工作，
 * 正好卡在按下結帳的那一瞬間。同一張圖同樣尺寸的結果直接快取起來重複用。 */
const canvasCache = new Map()

async function loadImageCanvas(base64, paperWidthDots, maxHeightDots = 120) {
  const cacheKey = `${paperWidthDots}x${maxHeightDots}:${base64.length}:${base64.slice(-64)}`
  const cached = canvasCache.get(cacheKey)
  if (cached) return cached

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
  canvasCache.set(cacheKey, canvas)
  return canvas
}

/** 後台換了 logo / QR 之後要清掉，不然還會印到舊的圖 */
export function clearPrinterImageCache() {
  canvasCache.clear()
}

/* ═══════════════════════════════════════════════
   Ping 狀態
═══════════════════════════════════════════════ */
export function checkPrinterStatus(testIp, testHttps) {
  return new Promise((resolve) => {
    try {
      const builder = new StarWebPrintBuilder()
      const request = builder.createInitializationElement()
      const trader  = new StarWebPrintTrader({ url: getPrinterUrl(testIp, testHttps), papertype: 'normal', timeout: 4000 })
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
  // next_pickup_number() 這個 DB function 本身有支援用 p_store_id 分店計算流水號，
  // 但如果呼叫時沒帶這個參數，它會退回一個寫死的預設 store_id，等於所有店家
  // 共用同一組計數器（取單號會被別家店的訂單插隊、跳號）。這裡一定要把目前登入
  // 的 store_id 傳進去，才能真的各店各自獨立計數。
  const storeId = getStoreId()
  const { data, error } = await supabase.rpc('next_pickup_number', { p_store_id: storeId })
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
    // 單品標籤／備註（例：少冰、不要辣），縮排印在品名下一行
    const lineExtra = itemExtraLine(line)
    if (lineExtra) req += builder.createTextElement(bigText(`   ${lineExtra}\n`))
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
function sendPrintRequest(request) {
  return new Promise((resolve) => {
    const trader = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 3000 })
    trader.onReceive = (resp) => resolve({ success: true,  response: resp })
    trader.onError   = (resp) => { console.warn('[printer] 出單失敗（無出單機模式）'); resolve({ success: false, error: resp }) }
    trader.sendMessage({ request })
  })
}

/* ═══════════════════════════════════════════════
   開啟錢櫃

   電子錢櫃是 RJ11 接在出單機背後的 DK（drawer kick）孔，本身不連網路，
   要透過出單機送一個脈衝訊號才會彈開。所以「出單機有連上」＝「錢櫃可以開」，
   出單機離線的話錢櫃也一定開不了，這時候要提示店員用鑰匙手動開。

   channel 1 = 第一個錢櫃孔（絕大多數只接一台就是 1）
   on/off   = 脈衝寬度（毫秒），200/200 是 Star 的建議值，太短可能推不動彈簧
═══════════════════════════════════════════════ */
export function openCashDrawer() {
  return new Promise((resolve) => {
    try {
      const builder = new StarWebPrintBuilder()
      const request = builder.createPeripheralElement({ channel: 1, on: 200, off: 200 })
      const trader  = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 4000 })
      trader.onReceive = (resp) => resolve({ success: true, response: resp })
      trader.onError   = (resp) => {
        console.warn('[printer] 開錢櫃失敗', resp)
        resolve({ success: false, error: resp })
      }
      trader.sendMessage({ request })
    } catch (e) {
      console.error('[printer] 開錢櫃指令組裝失敗', e)
      resolve({ success: false, error: e })
    }
  })
}

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
    const result = await sendPrintRequest(request)
    resolve(result)
  })
}

/* ═══════════════════════════════════════════════
   工作站分區出單設定（各店「此區不要印單」的開關）
═══════════════════════════════════════════════ */
/* 這個設定幾乎不會變，但每次結帳都查一次資料庫等於每筆訂單多一趟往返。
 * 快取 5 分鐘；在設定頁改動時會立刻清掉快取，不用等過期。 */
const STATION_TTL = 5 * 60 * 1000
let stationCache = { storeId: null, map: null, at: 0 }

export function clearStationPrintCache() {
  stationCache = { storeId: null, map: null, at: 0 }
}

export async function getStationPrintSettings() {
  const storeId = getStoreId()
  if (!storeId) return {}

  const fresh = stationCache.storeId === storeId
    && stationCache.map
    && (Date.now() - stationCache.at) < STATION_TTL
  if (fresh) return stationCache.map

  const { data, error } = await supabase
    .from('kitchen_station_settings')
    .select('station, print_enabled')
    .eq('store_id', storeId)
  if (error) { console.error('[printer] 讀取工作站出單設定失敗', error); return {} }
  const map = {}
  for (const row of data ?? []) map[row.station] = row.print_enabled
  stationCache = { storeId, map, at: Date.now() }
  return map
}

export async function setStationPrintEnabled(station, enabled) {
  const storeId = getStoreId()
  if (!storeId) return false
  const { error } = await supabase
    .from('kitchen_station_settings')
    .upsert({ store_id: storeId, station, print_enabled: enabled }, { onConflict: 'store_id,station' })
  if (error) { console.error('[printer] 儲存工作站出單設定失敗', error); return false }
  clearStationPrintCache()
  return true
}

/* ═══════════════════════════════════════════════
   工作站分區出單票（廚房票，只列品項，不列金額）
═══════════════════════════════════════════════ */
async function buildKitchenTicketRequest({ stationLabel, orderType, tableName, pickupNumber, items, tags, note }) {
  const layout  = getPrinterLayout()
  const LINE_W  = layout.paperWidth === '80' ? 46 : 30
  const DOT_W   = layout.paperWidth === '80' ? 576 : 384

  const builder = new StarWebPrintBuilder()
  let req = ''

  req += builder.createInitializationElement()
  req += builder.createTextElement({ codepage: 'big5' })

  const orderLabel = orderType === 'takeout' ? '外帶' : `內用${tableName ? '-' + tableName : ''}`
  const pickupStr  = pickupNumber != null ? `#${String(pickupNumber).padStart(2, '0')}` : ''
  const headerLine = pickupStr ? padLine(orderLabel, pickupStr, LINE_W) : orderLabel
  req += builder.createTextElement({ emphasis: true, ...bigText(headerLine + '\n') })

  if (stationLabel) {
    req += builder.createTextElement({ emphasis: true, ...bigText(`【${stationLabel}】\n`) })
  }

  const now  = new Date()
  const days = ['日', '一', '二', '三', '四', '五', '六']
  const dStr = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`
  const tStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
  req += builder.createTextElement(bigText(`週${days[now.getDay()]} ${dStr} ${tStr}\n`))
  req += builder.createRuledLineElement({ thickness: 'medium', width: DOT_W })

  if (tags?.length || note) {
    if (tags?.length) req += builder.createTextElement(bigText(`口味: ${tags.map(t => t.label).join(' ')}\n`))
    if (note)         req += builder.createTextElement(bigText(`備註: ${note}\n`))
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
  }

  const sortedItems = sortByCode(items)
  sortedItems.forEach((line, idx) => {
    req += builder.createTextElement({ emphasis: true, ...bigText(`${idx + 1}. ${line.name}  x${line.qty}\n`) })
    // 廚房票一定要看得到單品備註（少冰/不要辣之類），這是實際要照做的指示
    const lineExtra = itemExtraLine(line)
    if (lineExtra) req += builder.createTextElement({ emphasis: true, ...bigText(`   ${lineExtra}\n`) })
  })

  req += builder.createRuledLineElement({ thickness: 'medium', width: DOT_W })
  req += builder.createTextElement(bigText('\n'))
  req += builder.createAlignmentElement({ position: 'left' })
  req += builder.createCutPaperElement({ feed: true })

  return req
}

/**
 * 依商品目前設定的工作站，把同一張訂單的品項拆成多張廚房票分別列印：
 * - 一個品項若同時屬於多個工作站，每個工作站都會各自印一張（各區都要備料）
 * - 沒有設定任何工作站的品項，統一印在一張「未分類」票（一定會印，避免漏單）
 * - 該工作站若被設定「此區不要印單」，就跳過該站
 * menuItemsById：{ [menuItemId]: { stations: [...] } }，通常直接傳 menuStore.items 組出的 map
 */
export async function printKitchenTickets({ pickupNumber, orderType, tableName, items, tags, note, menuItemsById }) {
  if (!items?.length) return []

  const groups  = {}
  const general = []

  for (const line of items) {
    const stations = menuItemsById?.[line.menuItemId]?.stations ?? []
    if (!stations.length) { general.push(line); continue }
    for (const st of stations) {
      if (!groups[st]) groups[st] = []
      groups[st].push(line)
    }
  }

  // 沒有任何商品設定工作站的店家，直接不印任何分區票（維持原本只印一張收據的行為）
  const hasAnyStationTag = Object.keys(groups).length > 0
  if (!hasAnyStationTag) return []

  const stationSettings = await getStationPrintSettings()
  const results = []

  for (const station of KITCHEN_STATIONS) {
    const list = groups[station.id]
    if (!list?.length) continue
    if (stationSettings[station.id] === false) continue

    const request = await buildKitchenTicketRequest({
      stationLabel: station.label, orderType, tableName, pickupNumber,
      items: list, tags, note,
    })
    results.push(await sendPrintRequest(request))
  }

  if (general.length) {
    const request = await buildKitchenTicketRequest({
      stationLabel: '未分類', orderType, tableName, pickupNumber,
      items: general, tags, note,
    })
    results.push(await sendPrintRequest(request))
  }

  return results
}

export async function printUberReceipt(order) {
  return new Promise(async (resolve) => {
    const layout  = getPrinterLayout()
    const LINE_W  = layout.paperWidth === '80' ? 46 : 30
    const DOT_W   = layout.paperWidth === '80' ? 576 : 384

    const builder = new StarWebPrintBuilder()
    let req = ''

    req += builder.createInitializationElement()
    req += builder.createTextElement({ codepage: 'big5' })

    // ── 訂單編號大標題（反白）────────────────────────────────────────────────
    const orderId = order.uberOrderId?.slice(-5).toUpperCase() ?? order.id.slice(0, 5).toUpperCase()
    req += builder.createTextElement({ emphasis: true, invert: true, ...bigText(`  ${orderId}  \n`) })

    // ── 類型和時間 ────────────────────────────────────────────────────────────
    const now  = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    req += builder.createTextElement(bigText(padLine('外送', timeStr, LINE_W) + '\n'))

    // ── 出貨總件數 ────────────────────────────────────────────────────────────
    const totalQty = (order.items ?? []).reduce((s, i) => s + (i.qty ?? 1), 0)
    req += builder.createTextElement({ emphasis: true, invert: true, ...bigText(`  出貨商品總件數 ${totalQty}  \n`) })
    req += builder.createTextElement(bigText('\n'))

    // ── 訂單明細 ─────────────────────────────────────────────────────────────
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })
    req += builder.createTextElement(bigText('Uber Eats  訂單明細\n'))
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })

    // 訂單編號、時間
    req += builder.createTextElement(bigText(`訂單編號: ${orderId}    ${timeStr}\n`))
    if (order.createdAt) {
      const created = new Date(order.createdAt)
      const dateStr = `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}-${String(created.getDate()).padStart(2,'0')}T${String(created.getHours()).padStart(2,'0')}:${String(created.getMinutes()).padStart(2,'0')}:00`
      req += builder.createTextElement(bigText(`訂購時間: ${dateStr}\n`))
    }
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })

    // ── 品項清單 ─────────────────────────────────────────────────────────────
    req += builder.createTextElement(bigText('Uber Eats  出貨明細\n'))
    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })

    for (const item of (order.items ?? [])) {
      const qty  = item.qty ?? 1
      const name = item.name ?? ''
      req += builder.createTextElement(bigText(`□ ${qty} x ${name}\n`))
    }

    req += builder.createRuledLineElement({ thickness: 'thin', width: DOT_W })

    // ── 合計 ─────────────────────────────────────────────────────────────────
    req += builder.createTextElement({ emphasis: true, ...bigText(`合計: ${(order.total ?? 0).toFixed(0)}\n`) })

    req += builder.createTextElement(bigText('\n'))
    req += builder.createCutPaperElement({ feed: true })

    const trader = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 3000 })
    trader.onReceive = (resp) => resolve({ success: true, response: resp })
    trader.onError   = (resp) => { resolve({ success: false, error: resp }) }
    trader.sendMessage({ request: req })
  })
}
// =============================================================================
// 加到 printer.js 最後面 — 電子發票證明聯列印（財政部規格格式）
// 需要先安裝 QR 產生：檔案頂部不用加 import，用內建 canvas 畫 QR
// npm install qrcode  → 頂部加 import QRCode from 'qrcode'
// =============================================================================

/**
 * 穩定解析綠界回傳的日期格式（例如 "2026/07/03 21:07:41" 或 "2026-07-03"）
 * 直接用 new Date() 在部分瀏覽器（尤其 iPad Safari）對 "/" 格式解析不穩，
 * 所以改用正則手動拆解，避免出現 NaN。
 */
function parseEcpayDate(dateStr) {
  if (!dateStr) return new Date()
  const m = String(dateStr).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/)
  if (!m) return new Date()
  const [, y, mo, d, h = '0', mi = '0', s = '0'] = m
  return new Date(+y, +mo - 1, +d, +h, +mi, +s)
}

/**
 * 民國年期別：2026-07 → 115年07-08月
 */
function invoicePeriodLabel(dateStr) {
  const d = parseEcpayDate(dateStr)
  const rocYear = d.getFullYear() - 1911
  const month = d.getMonth() + 1
  const startM = month % 2 === 0 ? month - 1 : month
  const endM   = startM + 1
  return `${rocYear}年${String(startM).padStart(2, '0')}-${String(endM).padStart(2, '0')}月`
}

/**
 * 【已移除自行組碼邏輯】
 * 原本這裡自己手動組一維條碼 + 左右 QRCode 內容，其中「加密驗證資訊」24 碼是用
 * 0 佔位（假資料），財政部證明聯條碼檢測項次 (6)(7)(8) 一定會判定不合格。
 *
 * 正確做法：發票開立後，後端 edge function（ecpay-invoice）已改為呼叫綠界
 * 「查詢發票明細」(/B2CInvoice/GetIssue)，直接拿綠界用本店 AES 金鑰算好的
 * PosBarCode / QRCode_Left / QRCode_Right，透過 inv.posBarCode / inv.qrCodeLeft /
 * inv.qrCodeRight 傳進來，這裡只負責印，不再自己組碼或加密。
 *
 * 注意：這三個欄位必須綠界後台已設定「密碼種子(QRCode)」且已申請「自行開發 POS
 * 版型」權限才會有值；若尚未設定，inv.qrCodeReady 會是 false，下面會跳過條碼區塊
 * 並改印一行提醒文字，不印假條碼。
 */

/**
 * 列印電子發票證明聯
 * inv: { invoiceNumber, randomCode, invoiceDate, salesAmount, taxAmount,
 *        totalAmount, sellerTaxId, buyerTaxId, companyName, items,
 *        posBarCode, qrCodeLeft, qrCodeRight, qrCodeReady }
 *
 * posBarCode / qrCodeLeft / qrCodeRight 是綠界「查詢發票明細」(GetIssue) API
 * 回傳、已用本店 AES 金鑰加密好的合規條碼內容，直接印，不在這裡重算。
 * qrCodeReady 為 false 時代表綠界尚未設定密碼種子/POS 版型權限，不印條碼區塊。
 */
export async function printInvoiceReceipt(inv, opts = {}) {
  return new Promise(async (resolve) => {
    const layout = getPrinterLayout()
    const LINE_W = layout.paperWidth === '80' ? 46 : 30
    const DOT_W  = layout.paperWidth === '80' ? 576 : 384

    const builder = new StarWebPrintBuilder()
    let req = ''

    req += builder.createInitializationElement()
    req += builder.createTextElement({ codepage: 'big5' })
    // 注意：這裡不設定 alignment:center。跟結帳收據頁尾「感謝您的購買」用的是
    // 同一套「手動空格置中」技巧（centerText / padLine），印表機本身維持預設的
    // 左對齊狀態即可，兩者疊加才是先前 QRCode 與標題偏右的真正原因。

    // ── 店名（放大 1.5 倍效果：用 width:2,height:2，搭配縮放置中）───────────────
    const storeName = inv.companyName || layout.storeName || 'VisionPOS'
    req += builder.createTextElement({ emphasis: true, width: 2, height: 2, ...bigText(centerTextScaled(storeName, LINE_W, 2) + '\n') })

    // ── 電子發票證明聯 ────────────────────────────────────────────────────────
    req += builder.createTextElement({ emphasis: true, width: 2, height: 2, ...bigText(centerTextScaled('電子發票證明聯', LINE_W, 2) + '\n') })

    // ── 期別 + 發票號碼 ──────────────────────────────────────────────────────
    req += builder.createTextElement({ emphasis: true, width: 2, height: 2, ...bigText(centerTextScaled(invoicePeriodLabel(inv.invoiceDate), LINE_W, 2) + '\n') })
    const invNo = `${inv.invoiceNumber.slice(0, 2)}-${inv.invoiceNumber.slice(2)}`
    req += builder.createTextElement({ emphasis: true, width: 2, height: 2, ...bigText(centerTextScaled(invNo, LINE_W, 2) + '\n') })

    // ── 日期時間（用「列印當下」時間，不是綠界回傳的 invoiceDate）+ 格式代碼 ──────
    // 重要：出單機的字級放大是「持續狀態」，不是單一標籤屬性 —— 上面標題區用了
    // width:2,height:2 之後，如果後面的 <text> 沒有明確指定 width/height，
    // 機器會沿用上一個放大狀態繼續印，而不是自動回到預設值。
    // 所以這裡每一行都要明確寫 width:1,height:1 強制重設回正常大小。
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`
    const formatSuffix = inv.buyerTaxId ? '  格式 25' : ''
    req += builder.createTextElement({ width: 1, height: 1, ...bigText(dateStr + formatSuffix + '\n') })

    // ── 隨機碼 / 總計（左右並排）──────────────────────────────────────────────
    // TOTAL_OFFSET：總計往左移動的量（單位＝字元欄數）。
    // 這台出單機實際可列印寬度跟我們假設的 LINE_W 常數不完全一致，
    // 所以用這個數字直接試印調整，數字越大，總計越往左移。
    const TOTAL_OFFSET = 6
    req += builder.createTextElement({ width: 1, height: 1, ...bigText(padLine(`隨機碼:${inv.randomCode}`, `總計:${Math.round(inv.totalAmount)}`, LINE_W - TOTAL_OFFSET) + '\n') })

    // ── 賣方 / 買方（左右並排，無統編時只印賣方）────────────────────────────────
    const sellerStr = `賣方:${inv.sellerTaxId ?? ''}`
    const buyerStr  = inv.buyerTaxId ? `買方:${inv.buyerTaxId}` : ''
    req += builder.createTextElement({ width: 1, height: 1, ...bigText(padLine(sellerStr, buyerStr, LINE_W) + '\n') })

    // 賣方/買方跟一維條碼中間不再空一整行，兩者距離拉近，縮短整張證明聯長度

    // ── 條碼區塊：只有 inv.qrCodeReady === true（綠界 GetIssue 有回傳官方條碼內容）
    //    才印一維條碼 + 雙 QRCode，避免印出不合規的假條碼 ──────────────────────────
    if (inv.qrCodeReady && inv.posBarCode && inv.qrCodeLeft) {
      // ── 一維條碼（財政部規格：Code39，年期別5+字軌號碼10+隨機碼4，內容直接用
      //    綠界 GetIssue 回傳的 posBarCode，不自己組碼）─────────────────────────
      // 改用 jsbarcode 畫成點陣圖，透過 createBitImageElement 印，不用印表機內建的
      // <barcode symbology="Code39"> 指令——實測 Star mC-Print3 對 StarWebPRNT 的
      // Code39 指令沒有反應（不會報錯，但紙上完全印不出來），Code128 才印得出來；
      // 但財政部規格明定一維條碼必須是 Code39，不能為了印得出來改回 Code128，
      // 所以繞過印表機內建的條碼渲染引擎，自己畫成圖片印，兩邊都能滿足。
      try {
        const JsBarcode = (await import('jsbarcode')).default
        const rawCanvas = document.createElement('canvas')
        JsBarcode(rawCanvas, inv.posBarCode, {
          format:       'CODE39',
          width:        1,      // 最窄 bar 的像素寬度，故意設窄一點確保 58mm 紙也印得下
          height:       40,     // 財政部規格：條碼高度需 ≥ 0.5 公分，203dpi 下約 40 dots
          displayValue: false,  // 條碼下方不印文字，證明聯已經另外印隨機碼/發票號碼了
          margin:       0,
        })

        const barcodeCanvas = document.createElement('canvas')
        barcodeCanvas.width  = DOT_W
        // 高度固定用我們自己要的印刷高度，不受 rawCanvas 實際尺寸影響
        const printHeight = 50
        barcodeCanvas.height = printHeight
        const bctx = barcodeCanvas.getContext('2d')
        bctx.fillStyle = '#fff'
        bctx.fillRect(0, 0, barcodeCanvas.width, barcodeCanvas.height)

        // 寬度超過紙張可印範圍才縮小（保留左右各 10px 安全邊界），沒超過就用原始寬度、
        // 置中列印；高度一律固定在 printHeight，不會因為壓縮寬度而跟著變矮
        const maxW  = DOT_W - 20
        const destW = Math.min(rawCanvas.width, maxW)
        const startX = Math.floor((DOT_W - destW) / 2)
        bctx.drawImage(rawCanvas, startX, 0, destW, printHeight)

        req += builder.createBitImageElement({ context: bctx, x: 0, y: 0, width: barcodeCanvas.width, height: barcodeCanvas.height })
        req += builder.createTextElement(bigText('\n'))
      } catch (e) {
        console.warn('[printer] 條碼產生失敗，略過', e)
      }

      // ── 雙 QRCode（維持原尺寸，用跟 Logo 一樣「畫在整張紙寬 canvas 上再手動置中」的
      //    作法；內容直接用綠界回傳的 qrCodeLeft/qrCodeRight，內含正確加密驗證資訊）──
      try {
        const QRCode = (await import('qrcode')).default
        const size = 130
        const gap  = 24
        const qrOpts = { width: size, margin: 0 }
        const [leftUrl, rightUrl] = await Promise.all([
          QRCode.toDataURL(inv.qrCodeLeft, qrOpts),
          QRCode.toDataURL(inv.qrCodeRight || '**', qrOpts),
        ])

        // canvas 寬度 = 整張紙的可列印寬度（DOT_W），跟 logo 列印用的是同一套邏輯，
        // 因為 logo 已確認置中正確，代表 DOT_W 本身是準的；
        // 問題出在先前用 <alignment center> 交給印表機置中不可靠，改回手動算座標。
        const canvas = document.createElement('canvas')
        canvas.width  = DOT_W
        canvas.height = size
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const [imgL, imgR] = await Promise.all([leftUrl, rightUrl].map(u => new Promise((res, rej) => {
          const img = new Image()
          img.onload = () => res(img); img.onerror = rej; img.src = u
        })))

        const totalW = size * 2 + gap
        const startX = Math.floor((DOT_W - totalW) / 2)
        ctx.drawImage(imgL, startX, 0, size, size)
        ctx.drawImage(imgR, startX + size + gap, 0, size, size)

        req += builder.createBitImageElement({ context: ctx, x: 0, y: 0, width: canvas.width, height: canvas.height })
      } catch (e) {
        console.warn('[printer] QRCode 產生失敗，略過', e)
      }
    } else {
      // 綠界尚未設定密碼種子/POS 版型權限，GetIssue 沒有回傳合規條碼內容。
      // 印一行提醒文字讓店員知道這張證明聯目前缺條碼，而不是默默印出假條碼。
      console.warn('[printer] inv.qrCodeReady=false，本次證明聯不列印條碼區塊')
      req += builder.createTextElement({ width: 1, height: 1, ...bigText('※ 條碼尚未啟用，請洽系統管理員\n') })
    }

    // ── 有買方統編（B2B）才加印應稅銷售額/稅額 ──────────────────────────────────────
    // 一般消費者(B2C)發票維持原樣不印明細金額；買受人是營業人時，對方需要這兩個
    // 數字報稅/請款核對，所以額外印在 QRCode 下方；用小單位 feed（不是整行空白）
    // 稍微跟 QRCode 拉開一點點距離，不會明顯增加證明聯總長度，靠左印
    // （不用 padLine 左右平均分散）。
    if (inv.buyerTaxId) {
      req += builder.createFeedElement({ unit: 15 })
      req += builder.createTextElement({ width: 1, height: 1, ...bigText(`應稅銷售額:${Math.round(inv.salesAmount ?? 0)}　稅額:${Math.round(inv.taxAmount ?? 0)}\n`) })
    }

    // ── 交易明細：接在證明聯下面、同一張紙印，中間用虛線隔開，最後才一起裁紙 ──────
    // 證明聯上只有總額，客人要核對買了哪些東西就得靠這一段。店員在結帳畫面勾選才印。
    if (opts.transactionDetail) {
      try {
        req += buildTransactionDetailBlock(builder, {
          ...opts.transactionDetail,
          invoiceNumber: opts.transactionDetail.invoiceNumber ?? inv.invoiceNumber,
          companyName:   opts.transactionDetail.companyName   ?? inv.companyName,
          salesAmount:   opts.transactionDetail.salesAmount   ?? inv.salesAmount,
          taxAmount:     opts.transactionDetail.taxAmount     ?? inv.taxAmount,
        }, LINE_W)
      } catch (e) {
        // 明細組版失敗不能連累證明聯——那是法定憑證，一定要印出來
        console.warn('[printer] 交易明細組版失敗，只印證明聯', e)
      }
    }

    req += builder.createCutPaperElement({ feed: true })

    const trader = new StarWebPrintTrader({ url: getPrinterUrl(), papertype: 'normal', timeout: 3000 })
    trader.onReceive = (resp) => resolve({ success: true, response: resp })
    trader.onError   = (resp) => resolve({ success: false, error: resp })
    trader.sendMessage({ request: req })
  })
}
/* ═══════════════════════════════════════════════
   交易明細

   財政部的電子發票證明聯上只有總額，沒有逐項品名／數量／單價，
   客人要核對買了什麼、店家要對帳都看不出來。交易明細補的就是這一段：
   同一張紙、接在證明聯下面印，中間用虛線隔開，最後才一起裁紙。

   沒啟用發票的店家，或載具存雲端不印證明聯時，也可以單獨印這一張。
═══════════════════════════════════════════════ */

/** 稅別代碼：財政部證明聯／明細上的慣用標示（應稅 TX／免稅 FR／零稅率 ZR）*/
const TAX_CODE = { taxable: 'TX', exempt: 'FR', zero: 'ZR' }

/** 靠左填滿到指定顯示寬度（中文字算 2 格）*/
function padRight(text, width) {
  return text + ' '.repeat(Math.max(0, width - displayWidth(text)))
}

/** 靠右對齊到指定顯示寬度 */
function padLeft(text, width) {
  return ' '.repeat(Math.max(0, width - displayWidth(text))) + text
}

/** 明細表格的四欄欄寬，加起來剛好等於整行可印字元數 */
function detailColumns(LINE_W) {
  return LINE_W >= 46
    ? { name: 20, qty: 7, price: 8, amt: 11 }   // 80mm
    : { name: 10, qty: 5, price: 6, amt: 9  }   // 58mm
}

function detailTimeString(value) {
  const parsed = value ? new Date(value) : new Date()
  const d = isNaN(parsed.getTime()) ? new Date() : parsed
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 組出交易明細區塊（不含初始化與裁紙，方便接在證明聯後面或單獨印）
 *
 * detail: {
 *   companyName,        // 店名／抬頭，沒給就用出單機版型裡的店名
 *   storeAddress, storePhone,   // 沒給就用出單機版型設定；兩者皆空就整行不印
 *   posId,              // 機號（發票設定頁的 POS ID），沒有就只印交易時間
 *   invoiceNumber,      // 發票號碼，沒開發票就不印這行
 *   transactionTime,    // 這筆交易的時間（ISO 或 Date），不給就用列印當下
 *   items,              // 跟收據同一份 cart lines（含 code/taxType/tags/note/weight）
 *   subtotal, surchargeAmount, discountAmount, total,
 *   paymentLabel, paymentAmount, changeAmount,
 *   salesAmount, taxAmount,     // 有開發票才有；沒有就不印稅額區塊
 * }
 */
function buildTransactionDetailBlock(builder, detail, LINE_W) {
  const layout = getPrinterLayout()
  const cols   = detailColumns(LINE_W)
  const items  = detail.items ?? []

  // 出單機的放大倍率是「持續狀態」不是單次屬性，所以每一行都明確帶 width/height，
  // 否則會沿用上一行（例如標題的 2 倍）繼續印。
  const line = (str, opts = {}) =>
    builder.createTextElement({ width: 1, height: 1, ...opts, ...bigText(str) })

  const dashRule   = '-'.repeat(LINE_W) + '\n'
  const doubleRule = '='.repeat(LINE_W) + '\n'

  let req = ''

  // ── 跟上面的證明聯拉開距離，用虛線分隔兩個區塊 ──────────────────────────────
  req += builder.createFeedElement({ unit: 20 })
  req += line(dashRule)
  req += line(centerTextScaled('交易明細', LINE_W, 2) + '\n', { width: 2, height: 2, emphasis: true })
  req += line('\n')

  // ── 店家資訊 ─────────────────────────────────────────────────────────────
  // 地址／電話沒設定就整行不印。參考機種在沒資料時直接印出 "null"，那是它的 bug，
  // 不要照抄。
  const companyName = detail.companyName || layout.storeName || ''
  const address     = detail.storeAddress ?? layout.storeAddress
  const phone       = detail.storePhone   ?? layout.storePhone

  if (companyName) {
    req += line(`店名：${companyName}\n`)
    req += line(`抬頭：${companyName}\n`)
  }
  if (address) req += line(`地址：${address}\n`)
  if (phone)   req += line(`電話：${phone}\n`)

  // 機號 + 完整時間在 58mm（30 字元）上剛好會超過一行，硬印會被印表機折成很醜的
  // 兩段；放不下就自己拆成「機號」「時間」兩行，秒數不砍掉——證明聯上的時間要對得起來。
  const timeStr = detailTimeString(detail.transactionTime)
  if (detail.posId) {
    const posLine = `機號 ${detail.posId} ${timeStr}`
    if (displayWidth(posLine) <= LINE_W) {
      req += line(posLine + '\n')
    } else {
      req += line(`機號 ${detail.posId}\n`)
      req += line(timeStr + '\n')
    }
  } else {
    req += line(`交易時間：${timeStr}\n`)
  }
  if (detail.invoiceNumber) req += line(`發票號碼：${detail.invoiceNumber}\n`)

  // ── 品項表格 ─────────────────────────────────────────────────────────────
  req += line(doubleRule)
  req += line(
    padRight('品名', cols.name) + padLeft('數量', cols.qty) +
    padLeft('單價', cols.price) + padLeft('金額', cols.amt) + '\n'
  )
  req += line(dashRule)

  for (const item of sortByCode(items)) {
    const qty    = item.qty ?? 0
    const price  = Math.round(item.price ?? 0)
    const amount = Math.round(price * qty)
    const amtStr = `${amount}${TAX_CODE[item.taxType] ?? ''}`
    const name   = item.name ?? ''

    // 品名太長就自己占一行，數字欄下一行再對齊印，這樣欄位不會被擠歪、也不會截斷品名
    if (displayWidth(name) > cols.name) {
      req += line(name + '\n')
      req += line(padRight('', cols.name) + padLeft(String(qty), cols.qty) + padLeft(String(price), cols.price) + padLeft(amtStr, cols.amt) + '\n')
    } else {
      req += line(padRight(name, cols.name) + padLeft(String(qty), cols.qty) + padLeft(String(price), cols.price) + padLeft(amtStr, cols.amt) + '\n')
    }

    // 單品標籤／手輸備註／時價秤重，縮排印在品名下一行（跟結帳收據同一套）
    const extra = itemExtraLine(item)
    if (extra) req += line(`  ${extra}\n`)
  }

  // ── 小計／加價／折扣 ──────────────────────────────────────────────────────
  req += line(dashRule)
  const subtotal = Math.round(detail.subtotal ?? 0)
  req += line(
    padRight('共', 4) + padLeft(`${items.length}項`, cols.name - 4 + cols.qty) +
    padLeft('小計', cols.price) + padLeft(String(subtotal), cols.amt) + '\n'
  )

  const surcharge = Math.round(detail.surchargeAmount ?? 0)
  const discount  = Math.round(detail.discountAmount ?? 0)
  if (surcharge > 0) req += line(padLeft('加價：', LINE_W - cols.amt) + padLeft(`+${surcharge}`, cols.amt) + '\n')
  if (discount  > 0) req += line(padLeft('折扣：', LINE_W - cols.amt) + padLeft(`-${discount}`,  cols.amt) + '\n')

  // ── 收款／找零 ───────────────────────────────────────────────────────────
  if (detail.paymentLabel) {
    req += line(dashRule)
    req += line(padLeft(`${detail.paymentLabel}：`, LINE_W - cols.amt) + padLeft(String(Math.round(detail.paymentAmount ?? 0)), cols.amt) + '\n')
    req += line(padLeft('找零：', LINE_W - cols.amt) + padLeft(String(Math.round(detail.changeAmount ?? 0)), cols.amt) + '\n')
  }

  // ── 合計 ────────────────────────────────────────────────────────────────
  req += line(doubleRule)
  req += line(padLeft('合計：', LINE_W - cols.amt) + padLeft(String(Math.round(detail.total ?? 0)), cols.amt) + '\n', { emphasis: true })

  // ── 稅額（有開發票才印；沒發票就沒有應稅銷售額/稅額可言）──────────────────────
  if (detail.salesAmount != null || detail.taxAmount != null) {
    req += line('\n')
    req += line(padLeft('應稅銷售額', LINE_W - cols.amt) + padLeft(String(Math.round(detail.salesAmount ?? 0)), cols.amt) + '\n')
    req += line(padLeft('稅　　額',   LINE_W - cols.amt) + padLeft(String(Math.round(detail.taxAmount   ?? 0)), cols.amt) + '\n')
    req += line(padLeft('總　　計',   LINE_W - cols.amt) + padLeft(String(Math.round(detail.total       ?? 0)), cols.amt) + '\n')
  }

  req += line(dashRule)

  return req
}

/** 單獨列印一張交易明細（沒開發票、或載具存雲端不印證明聯時走這裡）*/
export function printTransactionDetail(detail) {
  return new Promise((resolve) => {
    try {
      const layout  = getPrinterLayout()
      const LINE_W  = layout.paperWidth === '80' ? 46 : 30
      const builder = new StarWebPrintBuilder()

      let req = ''
      req += builder.createInitializationElement()
      req += builder.createTextElement({ codepage: 'big5' })
      req += buildTransactionDetailBlock(builder, detail, LINE_W)
      req += builder.createCutPaperElement({ feed: true })

      sendPrintRequest(req).then(resolve)
    } catch (e) {
      console.warn('[printer] 交易明細組版失敗', e)
      resolve({ success: false, error: e })
    }
  })
}
