<template>
  <Teleport to="body">
    <div class="pm-backdrop">
      <div class="pm-box">

        <!-- 頂部標題 -->
        <div class="pm-header">
          <button class="pm-back" @click="emit('close')">← 返回</button>
          <div class="pm-header-right">
            <!-- 載具/統編（只在發票啟用時顯示）-->
            <template v-if="invoiceEnabled">
              <div class="pm-carrier-wrap">
                <div class="pm-carrier-tabs">
                  <button
                    class="pm-carrier-tab"
                    :class="{ 'pm-carrier-tab--active': carrierMode === 'carrier' }"
                    @click="switchCarrierMode('carrier')"
                  >載具</button>
                  <button
                    class="pm-carrier-tab"
                    :class="{ 'pm-carrier-tab--active': carrierMode === 'taxid' }"
                    @click="switchCarrierMode('taxid')"
                  >統編</button>
                </div>
                <input
                  v-if="carrierMode === 'carrier'"
                  v-model="carrierNum"
                  class="pm-carrier-input"
                  :class="{ 'pm-carrier-input--invalid': carrierNum && !carrierValid }"
                  placeholder="/XXXXXXX"
                  maxlength="20"
                  @input="onCarrierInput"
                />
                <input
                  v-if="carrierMode === 'taxid'"
                  v-model="buyerTaxId"
                  class="pm-carrier-input"
                  placeholder="買方統編"
                  maxlength="8"
                  type="number"
                  @input="onTaxIdInput"
                />
              </div>
              <div v-if="carrierMode === 'carrier' && carrierNum && !carrierValid" class="pm-carrier-hint">
                格式錯誤：手機條碼須為「/」開頭共8碼，或自然人憑證為2位大寫字母+14位數字
              </div>
            </template>
            <!-- 交易明細開關：勾了才印逐項明細（有開發票的話會接在證明聯後面同一張紙）-->
            <button
              class="pm-detail-toggle"
              :class="{ 'pm-detail-toggle--on': printDetail }"
              :title="printDetail ? '結帳後會列印交易明細' : '結帳後不印交易明細'"
              @click="togglePrintDetail"
            >
              <span class="pm-detail-box">{{ printDetail ? '✓' : '' }}</span>
              印明細
            </button>
            <div class="pm-total-label">總計</div>
            <div class="pm-total">${{ total.toFixed(0) }}</div>
          </div>
        </div>

        <!-- 付款方式 Tab -->
        <div class="pm-tabs">
          <button v-for="m in METHODS" :key="m.key"
            class="pm-tab" :class="{ 'pm-tab--active': method === m.key }"
            @click="switchMethod(m.key)">
            <span class="pm-tab-icon">{{ m.icon }}</span>
            {{ m.label }}
          </button>
        </div>

        <!-- ── 現金 ── -->
        <template v-if="method === 'cash'">
          <div class="pm-cash">
            <div class="pm-display-area">
              <div class="pm-row">
                <span class="pm-display-label">收款金額</span>
                <div class="pm-display-amount" :class="{ 'pm-display-amount--empty': !enteredStr }">
                  ${{ enteredStr || '0' }}
                </div>
              </div>
              <div class="pm-row pm-row--change" v-if="enteredAmount > 0">
                <span class="pm-display-label">找零</span>
                <div class="pm-change" :class="{ 'pm-change--neg': change < 0 }">
                  {{ change < 0 ? `不足 $${Math.abs(change).toFixed(0)}` : `$${change.toFixed(0)}` }}
                </div>
              </div>
            </div>
            <div class="pm-quick">
              <button class="pm-quick-btn" @click="setQuick(total)">精確金額</button>
              <button v-for="q in quickAmounts" :key="q" class="pm-quick-btn" @click="setQuick(q)">
                ${{ q.toLocaleString() }}
              </button>
            </div>
            <div class="pm-keypad">
              <div class="pm-keypad-grid">
                <button v-for="k in KEYS" :key="k.v"
                  class="pm-key" :class="k.cls"
                  @click="pressKey(k.v)">
                  {{ k.label }}
                </button>
                <button class="pm-key pm-key--exact" @click="setQuick(total)">不找零<br>付款</button>
              </div>
            </div>
          </div>
          <div class="pm-action">
            <div v-if="allowDiscountEdit" class="pm-discount-row">
              <span class="pm-discount-status">{{ discountStatusLabel }}</span>
              <button class="pm-discount-edit-btn" @click="showDiscountEditor = true">✎ 折扣</button>
            </div>
            <button class="pm-confirm pm-confirm--cash"
              :disabled="change < 0 && enteredAmount > 0"
              @click="confirm">
              {{ enteredAmount === 0 ? `收款 $${total.toFixed(0)}` : `確認收款 $${enteredAmount.toFixed(0)}，找零 $${Math.max(0, change).toFixed(0)}` }}
            </button>
          </div>
        </template>

        <!-- ── 信用卡 ── -->
        <template v-else-if="method === 'card'">
          <div class="pm-card-area">
            <div class="pm-card-icon">💳</div>
            <p class="pm-card-hint">請於刷卡機完成刷卡，再按確認</p>
            <div class="pm-card-amount">${{ total.toFixed(0) }}</div>

            <div class="pm-card4-wrap">
              <div class="pm-card4-label">輸入信用卡後 4 碼</div>
              <input
                v-model="card4"
                class="pm-card4-input"
                placeholder="0000"
                maxlength="4"
                type="tel"
                inputmode="numeric"
                autofocus
              />
              <div v-if="card4Error" class="pm-card4-error">請輸入信用卡後 4 碼（4位數字）</div>
            </div>
          </div>
          <div class="pm-action">
            <div v-if="allowDiscountEdit" class="pm-discount-row">
              <span class="pm-discount-status">{{ discountStatusLabel }}</span>
              <button class="pm-discount-edit-btn" @click="showDiscountEditor = true">✎ 折扣</button>
            </div>
            <button class="pm-confirm" @click="confirmCard">
              ✓ 確認付款完成
            </button>
          </div>
        </template>

        <!-- ── LINE Pay ── -->
        <template v-else-if="method === 'linepay'">
          <div class="pm-card-area">
            <div class="pm-card-icon">📱</div>
            <p class="pm-card-hint">請客人開啟 LINE Pay 掃描 QR，再按確認</p>
            <div class="pm-card-amount">${{ total.toFixed(0) }}</div>
            <div class="pm-linepay-qr">
              <div class="pm-linepay-placeholder">
                <div class="pm-linepay-hint-sm">LINE Pay QR Code<br>（API 設定完成後自動產生）</div>
              </div>
            </div>
          </div>
          <div class="pm-action">
            <div v-if="allowDiscountEdit" class="pm-discount-row">
              <span class="pm-discount-status">{{ discountStatusLabel }}</span>
              <button class="pm-discount-edit-btn" @click="showDiscountEditor = true">✎ 折扣</button>
            </div>
            <button class="pm-confirm" @click="confirm">✓ 確認付款完成</button>
          </div>
        </template>

        <!-- ── 稍後付款 ── -->
        <template v-else-if="method === 'defer'">
          <div class="pm-card-area">
            <div class="pm-card-icon">🕐</div>
            <p class="pm-card-hint">訂單先送出，付款方式記為「稍後付款」</p>
            <div class="pm-card-amount pm-card-amount--defer">${{ total.toFixed(0) }}</div>
          </div>
          <div class="pm-action">
            <button class="pm-confirm pm-confirm--defer" @click="confirm">先送出，稍後付款</button>
          </div>
        </template>

        <!-- ── 人工輸入條碼/統編二次確認（檢測表項次7-(3)）──────────────────────────
             掃描槍輸入是瞬間完成（同一批 input 事件時間差極小），會直接放行；
             只有手動一個字一個字打的才會擋下來，要求店員再看一次確認無誤才送出。 -->
        <div v-if="pendingConfirmKind" class="pm-recheck-overlay">
          <div class="pm-recheck-box">
            <p class="pm-recheck-title">請再次確認{{ pendingConfirmKind === 'carrier' ? '手機條碼/自然人憑證' : '買方統編' }}</p>
            <p class="pm-recheck-value">{{ pendingConfirmKind === 'carrier' ? carrierNum : buyerTaxId }}</p>
            <p class="pm-recheck-hint">手動輸入的內容，請店員與客戶再確認一次是否正確</p>
            <div class="pm-recheck-actions">
              <button class="pm-recheck-btn pm-recheck-btn--edit" @click="cancelRecheck">重新輸入</button>
              <button class="pm-recheck-btn pm-recheck-btn--ok" @click="confirmRecheck">確認正確，送出</button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── 結帳前調整折扣（稍後付款訂單真正結帳時用）── -->
    <DiscountEditModal
      v-if="showDiscountEditor"
      :subtotal="subtotal"
      :surcharge-amount="surchargeAmount"
      :discount="localDiscount"
      @close="showDiscountEditor = false"
      @save="onDiscountSave"
    />
  </Teleport>
</template>

<script setup>
import { discountAmountOf } from '@/lib/orderPayment.js'
import { ref, computed, onMounted } from 'vue'
import { useStoreSettingsStore } from '@/stores/storeSettingsStore.js'
import { openCashDrawer, getPrintDetailDefault, setPrintDetailDefault } from '@/lib/printer.js'
import DiscountEditModal from './DiscountEditModal.vue'

const props = defineProps({
  total:            { type: Number,  required: true },
  allowDefer:       { type: Boolean, default: true },
  // ── 結帳前調整折扣（目前只有內用「稍後結帳」單張結帳、外帶稍後付款結帳有開放）──
  allowDiscountEdit: { type: Boolean, default: false },
  subtotal:          { type: Number, default: 0 },
  surchargeAmount:   { type: Number, default: 0 },
  discount:          { type: Object, default: null },
})
const emit = defineEmits(['close', 'paid', 'update:discount'])

/* ── 結帳前調整折扣：本地即時預覽總計，儲存時往上通知呼叫端寫回 DB ── */
const localDiscount    = ref(props.discount)
const showDiscountEditor = ref(false)

const total = computed(() => {
  if (!props.allowDiscountEdit) return props.total
  const base = props.subtotal + props.surchargeAmount
  return Math.max(0, base - discountAmountOf(localDiscount.value, base))
})

const discountStatusLabel = computed(() => {
  const d = localDiscount.value
  if (!d?.value) return '未設定折扣'
  return `折扣：${d.type === 'percent' ? d.value + '%' : '$' + d.value}`
})

function onDiscountSave(newDiscount) {
  localDiscount.value = newDiscount
  showDiscountEditor.value = false
  emit('update:discount', newDiscount)
}

// 付款方式與發票啟用狀態在登入時就載好了（storeSettingsStore），
// 這裡直接同步讀取，不用等查詢回來，付款方式按鈕不會再一顆一顆跳出來。
const settingsStore  = useStoreSettingsStore()
const cardEnabled    = computed(() => settingsStore.cardEnabled)
const linepayEnabled = computed(() => settingsStore.linepayEnabled)
const invoiceEnabled = computed(() => settingsStore.invoiceEnabled)

// 保險：萬一還沒載入過（例如重整後直接開結帳），補一次
onMounted(() => { settingsStore.init() })

const BASE_METHODS = [
  { key: 'cash',    label: '現金',     icon: '💵' },
  { key: 'card',    label: '信用卡',   icon: '💳' },
  { key: 'linepay', label: 'LINE Pay', icon: '📱' },
  { key: 'defer',   label: '稍後付款', icon: '🕐' },
]

const METHODS = computed(() => {
  return BASE_METHODS.filter(m => {
    if (m.key === 'card'    && !cardEnabled.value)    return false
    if (m.key === 'linepay' && !linepayEnabled.value) return false
    if (m.key === 'defer'   && !props.allowDefer)     return false
    return true
  })
})

const KEYS = [
  { v: '1', label: '1' }, { v: '2', label: '2' }, { v: '3', label: '3' },
  { v: '4', label: '4' }, { v: '5', label: '5' }, { v: '6', label: '6' },
  { v: '7', label: '7' }, { v: '8', label: '8' }, { v: '9', label: '9' },
  { v: '+/-', label: '+/-', cls: 'pm-key--fn' },
  { v: '0', label: '0' },
  { v: '.', label: '.', cls: 'pm-key--fn' },
  { v: '←', label: '←', cls: 'pm-key--fn' },
]

const method      = ref('cash')
const enteredStr  = ref('')
const card4       = ref('')
const card4Error  = ref(false)

/* 是否列印交易明細。預設沿用這台裝置上次的選擇（店家習慣通常固定），
 * 店員可以針對這一筆改。稍後付款沒有實際收款，呼叫端不會印。 */
const printDetail = ref(getPrintDetailDefault())
function togglePrintDetail() {
  printDetail.value = !printDetail.value
  setPrintDetailDefault(printDetail.value)
}
const carrierMode = ref('')
const carrierNum  = ref('')
const buyerTaxId  = ref('')

// 財政部共通性載具格式規範：
// 手機條碼：/ 起始，共8碼，除首碼外只允許 0-9A-Z+-. 共39個合法字元
// 自然人憑證：2位大寫英文字母 + 14位數字
const MOBILE_BARCODE_RE = /^\/[0-9A-Z+\-.]{7}$/
const NATID_CERT_RE     = /^[A-Z]{2}\d{14}$/
const carrierValid = computed(() => {
  if (!carrierNum.value) return true
  return MOBILE_BARCODE_RE.test(carrierNum.value) || NATID_CERT_RE.test(carrierNum.value)
})

// ── 人工輸入二次確認（檢測表項次7-(3)：人工輸入應設計多次確認機制降低錯誤）─────────
// 判斷依據：掃描槍是瞬間把整串字元灌進輸入框，前後兩次 input 事件時間差極小；
// 人工一個字一個字打字，時間差明顯較大。用「第一個字 → 最後一個字」總耗時判斷，
// 低於門檻視為掃描（已經是機器讀取，不需要再人工二次確認），否則視為人工輸入，
// 送出前要求店員再看一次畫面上大字顯示的內容並明確按下確認。
const SCAN_MAX_DURATION_MS = 250
let carrierInputStart = 0
let taxIdInputStart   = 0
const carrierWasManual = ref(false)
const taxIdWasManual   = ref(false)

function onCarrierInput() {
  carrierNum.value = carrierNum.value.toUpperCase()
  const now = Date.now()
  if (!carrierNum.value) { carrierInputStart = 0; carrierWasManual.value = false; return }
  if (!carrierInputStart) carrierInputStart = now
  carrierWasManual.value = (now - carrierInputStart) > SCAN_MAX_DURATION_MS
}

function onTaxIdInput() {
  const now = Date.now()
  if (!buyerTaxId.value) { taxIdInputStart = 0; taxIdWasManual.value = false; return }
  if (!taxIdInputStart) taxIdInputStart = now
  taxIdWasManual.value = (now - taxIdInputStart) > SCAN_MAX_DURATION_MS
}

// pendingConfirmKind: null（不需要二次確認）| 'carrier' | 'taxid'
const pendingConfirmKind = ref(null)
const carrierRechecked   = ref(false)
const taxIdRechecked     = ref(false)
let resumeAfterRecheck = null

function needsRecheck() {
  if (carrierMode.value === 'carrier' && carrierNum.value && carrierWasManual.value && !carrierRechecked.value) return 'carrier'
  if (carrierMode.value === 'taxid'   && buyerTaxId.value && taxIdWasManual.value && !taxIdRechecked.value)     return 'taxid'
  return null
}

function cancelRecheck() {
  pendingConfirmKind.value = null
  resumeAfterRecheck = null
}

function confirmRecheck() {
  if (pendingConfirmKind.value === 'carrier') carrierRechecked.value = true
  if (pendingConfirmKind.value === 'taxid')   taxIdRechecked.value   = true
  pendingConfirmKind.value = null
  const resume = resumeAfterRecheck
  resumeAfterRecheck = null
  if (resume) resume()
}

const quickAmounts = computed(() => {
  const t = total.value
  const options = new Set()
  ;[100, 500, 1000].forEach(q => { if (q > t) options.add(q) })
  const ceil100 = Math.ceil(t / 100) * 100
  if (ceil100 !== t) options.add(ceil100)
  return [...options].sort((a, b) => a - b).slice(0, 4)
})

const enteredAmount = computed(() => parseFloat(enteredStr.value) || 0)
const change        = computed(() => enteredAmount.value - total.value)

function switchMethod(m) {
  method.value     = m
  enteredStr.value = ''
  card4.value      = ''
  card4Error.value = false
}

function switchCarrierMode(mode) {
  carrierMode.value = carrierMode.value === mode ? '' : mode
  carrierNum.value  = ''
  buyerTaxId.value  = ''
  carrierInputStart = 0
  taxIdInputStart   = 0
  carrierWasManual.value = false
  taxIdWasManual.value   = false
  carrierRechecked.value = false
  taxIdRechecked.value   = false
}

function setQuick(amount) { enteredStr.value = String(Math.round(amount)) }

function pressKey(v) {
  if (v === '←') { enteredStr.value = enteredStr.value.slice(0, -1); return }
  if (v === '+/-') return
  if (v === '.' && enteredStr.value.includes('.')) return
  if (v === '.' && enteredStr.value === '') enteredStr.value = '0'
  if (enteredStr.value.length >= 10) return
  enteredStr.value += v
}

function confirmCard() {
  if (!card4.value || card4.value.length !== 4 || !/^\d{4}$/.test(card4.value)) {
    card4Error.value = true; return
  }
  card4Error.value = false
  confirm()
}

function confirm() {
  if (carrierMode.value === 'carrier' && carrierNum.value && !carrierValid.value) return

  // 人工輸入的手機條碼/自然人憑證/統編，送出前先擋下來要求店員二次確認（項次7-(3)）
  const kind = needsRecheck()
  if (kind) {
    pendingConfirmKind.value = kind
    resumeAfterRecheck = () => doEmitPaid()
    return
  }
  doEmitPaid()
}

function doEmitPaid() {
  const amount = enteredAmount.value || total.value
  const chg    = method.value === 'cash' ? Math.max(0, amount - total.value) : 0

  // 現金結帳才彈錢櫃：店員按下收款時手已經在錢櫃上，要找零也要拿錢，
  // 讓它自己開比較順。信用卡／LINE Pay／稍後付款沒有現金進出，不用開。
  // 不 await、失敗也不擋結帳——錢櫃開不了頂多用鑰匙，不該讓訂單卡住。
  if (method.value === 'cash') {
    openCashDrawer().then(r => {
      if (!r.success) console.warn('[payment] 現金結帳時錢櫃未開啟，請確認出單機與 RJ11 接線')
    })
  }

  emit('paid', {
    method:        method.value,
    methodLabel:   METHODS.value.find(m => m.key === method.value)?.label ?? method.value,
    paymentAmount: amount,
    changeAmount:  chg,
    card4:         method.value === 'card' ? card4.value : null,
    carrierNum:    carrierMode.value === 'carrier' ? carrierNum.value : null,
    buyerTaxId:    carrierMode.value === 'taxid'   ? buyerTaxId.value : null,
    printDetail:   printDetail.value,
  })
}
</script>

<style scoped>
.pm-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; }
.pm-box { position: relative; background: #1a1410; color: #fff; border-radius: 20px; width: 520px; max-height: 95vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.pm-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.pm-back { font-size: 13px; color: #aaa; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.08); }
.pm-back:hover { background: rgba(255,255,255,0.15); }
.pm-header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.pm-carrier-wrap { display: flex; align-items: center; gap: 6px; }
.pm-carrier-tabs { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); }
.pm-carrier-tab { padding: 5px 10px; font-size: 11px; color: #888; background: rgba(255,255,255,0.05); }
.pm-carrier-tab--active { background: #e8a038; color: #fff; font-weight: 600; }
.pm-carrier-input { width: 130px; padding: 5px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 13px; }
.pm-carrier-input:focus { outline: none; border-color: #e8a038; }
.pm-carrier-input--invalid { border-color: #e06060; }
.pm-carrier-hint { width: 100%; font-size: 11px; color: #e06060; text-align: right; }
.pm-detail-toggle { display: flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; font-size: 12px; color: #aaa; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); }
.pm-detail-toggle:hover { background: rgba(255,255,255,0.12); }
.pm-detail-toggle--on { color: #fff; border-color: #e8a038; background: rgba(232,160,56,0.18); }
.pm-detail-box { width: 15px; height: 15px; border-radius: 4px; border: 1.5px solid rgba(255,255,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 11px; line-height: 1; }
.pm-detail-toggle--on .pm-detail-box { background: #e8a038; border-color: #e8a038; color: #fff; }
.pm-total-label { font-size: 13px; color: #888; }
.pm-total { font-size: 26px; font-weight: 700; color: #fff; }
.pm-tabs { display: flex; padding: 10px 12px 0; gap: 6px; }
.pm-tab { flex: 1; padding: 8px 4px; border-radius: 10px; font-size: 12.5px; color: #888; background: rgba(255,255,255,0.06); display: flex; flex-direction: column; align-items: center; gap: 3px; transition: all 0.15s; }
.pm-tab--active { background: #e8a038; color: #fff; font-weight: 600; }
.pm-tab:hover:not(.pm-tab--active) { background: rgba(255,255,255,0.12); }
.pm-tab-icon { font-size: 16px; }
.pm-cash { flex: 1; display: flex; flex-direction: column; padding: 12px 16px; gap: 10px; }
.pm-display-area { background: rgba(255,255,255,0.06); border-radius: 12px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.pm-row { display: flex; align-items: center; justify-content: space-between; }
.pm-row--change { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; }
.pm-display-label { font-size: 13px; color: #888; }
.pm-display-amount { font-size: 28px; font-weight: 700; color: #fff; font-variant-numeric: tabular-nums; }
.pm-display-amount--empty { color: #555; }
.pm-change { font-size: 22px; font-weight: 700; color: #5a9; font-variant-numeric: tabular-nums; }
.pm-change--neg { color: #e06060; }
.pm-quick { display: flex; gap: 6px; }
.pm-quick-btn { flex: 1; padding: 8px 4px; border-radius: 8px; font-size: 12.5px; font-weight: 500; color: #ccc; background: rgba(255,255,255,0.1); white-space: nowrap; }
.pm-quick-btn:hover { background: rgba(255,255,255,0.2); }
.pm-keypad-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
.pm-key { height: 56px; border-radius: 10px; font-size: 20px; font-weight: 500; color: #fff; background: rgba(255,255,255,0.12); transition: background 0.1s; }
.pm-key:hover:not(:disabled) { background: rgba(255,255,255,0.22); }
.pm-key--fn { background: rgba(255,255,255,0.06); font-size: 16px; color: #ccc; }
.pm-key--exact { background: #2a6a5a; font-size: 13px; font-weight: 600; line-height: 1.3; grid-row: span 2; height: auto; padding: 10px 0; }
.pm-key--exact:hover { background: #1a5a4a; }
.pm-card-area { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 20px 24px; }
.pm-card-icon { font-size: 48px; }
.pm-card-hint { font-size: 14px; color: #aaa; text-align: center; }
.pm-card-amount { font-size: 36px; font-weight: 700; color: #fff; }
.pm-card-amount--defer { color: #e8a038; }

/* 信用卡後4碼 — 只顯示輸入的數字 */
.pm-card4-wrap { background: rgba(255,255,255,0.06); border-radius: 12px; padding: 16px 24px; width: 100%; max-width: 300px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.pm-card4-label { font-size: 13px; color: #888; }
.pm-card4-input {
  width: 120px; padding: 12px 16px;
  background: rgba(255,255,255,0.1);
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 10px; color: #fff;
  font-size: 28px; font-family: monospace;
  text-align: center; letter-spacing: 8px;
}
.pm-card4-input:focus { outline: none; border-color: #e8a038; }
.pm-card4-error { font-size: 12px; color: #e06060; }

.pm-linepay-qr { background: rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; min-width: 200px; display: flex; align-items: center; justify-content: center; }
.pm-linepay-placeholder { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.pm-linepay-hint-sm { font-size: 12px; color: #666; text-align: center; line-height: 1.8; }

.pm-action { padding: 10px 16px 16px; }
.pm-discount-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; margin-bottom: 10px;
  background: rgba(255,255,255,0.06); border-radius: 10px;
}
.pm-discount-status { font-size: 13px; color: #ccc; }
.pm-discount-edit-btn {
  font-size: 12.5px; font-weight: 600; color: #1a0800;
  background: #e8a038; border: none; padding: 6px 14px; border-radius: 999px;
}
.pm-discount-edit-btn:hover { background: #d89028; }
.pm-confirm { width: 100%; padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 700; color: #fff; background: #3a7a3a; transition: background 0.15s; }
.pm-confirm:hover:not(:disabled) { background: #2a6a2a; }
.pm-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.pm-confirm--cash { background: #e8a038; }
.pm-confirm--cash:hover:not(:disabled) { background: #c88020; }
.pm-confirm--defer { background: #5a4a3a; }
.pm-confirm--defer:hover { background: #4a3a2a; }

.pm-recheck-overlay {
  position: absolute; inset: 0; z-index: 10;
  background: rgba(10, 8, 6, 0.92);
  display: flex; align-items: center; justify-content: center;
  padding: 24px;
}
.pm-recheck-box {
  width: 100%; max-width: 380px;
  background: #241c14; border: 1px solid rgba(255,255,255,0.15);
  border-radius: 16px; padding: 28px 24px;
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  text-align: center;
}
.pm-recheck-title { font-size: 14px; color: #ccc; font-weight: 600; }
.pm-recheck-value { font-size: 30px; font-weight: 700; color: #e8a038; letter-spacing: 1px; word-break: break-all; }
.pm-recheck-hint { font-size: 12px; color: #999; margin-bottom: 8px; }
.pm-recheck-actions { display: flex; gap: 10px; width: 100%; }
.pm-recheck-btn { flex: 1; padding: 14px; border-radius: 10px; font-size: 14px; font-weight: 700; }
.pm-recheck-btn--edit { background: rgba(255,255,255,0.1); color: #ccc; }
.pm-recheck-btn--edit:hover { background: rgba(255,255,255,0.18); }
.pm-recheck-btn--ok { background: #3a7a3a; color: #fff; }
.pm-recheck-btn--ok:hover { background: #2a6a2a; }
</style>