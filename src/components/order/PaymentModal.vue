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
                  placeholder="/XXXXXXX"
                  maxlength="20"
                />
                <input
                  v-if="carrierMode === 'taxid'"
                  v-model="buyerTaxId"
                  class="pm-carrier-input"
                  placeholder="買方統編"
                  maxlength="8"
                  type="number"
                />
              </div>
            </template>
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

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

const props = defineProps({
  total:      { type: Number,  required: true },
  allowDefer: { type: Boolean, default: true },
})
const emit = defineEmits(['close', 'paid'])

const authStore = useAuthStore()

// 付款設定（從 DB 讀取）
const cardEnabled    = ref(false)
const linepayEnabled = ref(false)
const invoiceEnabled = ref(false)

onMounted(async () => {
  const storeId = authStore.store?.id
  if (!storeId) return

  const [payRes, invRes] = await Promise.all([
    supabase.from('payment_settings').select('card_enabled, linepay_enabled').eq('store_id', storeId).maybeSingle(),
    supabase.from('invoice_settings').select('enabled').eq('store_id', storeId).maybeSingle(),
  ])
  if (payRes.data) {
    cardEnabled.value    = payRes.data.card_enabled ?? false
    linepayEnabled.value = payRes.data.linepay_enabled ?? false
  }
  if (invRes.data) {
    invoiceEnabled.value = invRes.data.enabled ?? false
  }
})

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
const carrierMode = ref('')
const carrierNum  = ref('')
const buyerTaxId  = ref('')

const quickAmounts = computed(() => {
  const t = props.total
  const options = new Set()
  ;[100, 500, 1000].forEach(q => { if (q > t) options.add(q) })
  const ceil100 = Math.ceil(t / 100) * 100
  if (ceil100 !== t) options.add(ceil100)
  return [...options].sort((a, b) => a - b).slice(0, 4)
})

const enteredAmount = computed(() => parseFloat(enteredStr.value) || 0)
const change        = computed(() => enteredAmount.value - props.total)

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
  const amount = enteredAmount.value || props.total
  const chg    = method.value === 'cash' ? Math.max(0, amount - props.total) : 0
  emit('paid', {
    method:        method.value,
    methodLabel:   METHODS.value.find(m => m.key === method.value)?.label ?? method.value,
    paymentAmount: amount,
    changeAmount:  chg,
    card4:         method.value === 'card' ? card4.value : null,
    carrierNum:    carrierMode.value === 'carrier' ? carrierNum.value : null,
    buyerTaxId:    carrierMode.value === 'taxid'   ? buyerTaxId.value : null,
  })
}
</script>

<style scoped>
.pm-backdrop { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; }
.pm-box { background: #1a1410; color: #fff; border-radius: 20px; width: 520px; max-height: 95vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
.pm-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
.pm-back { font-size: 13px; color: #aaa; padding: 6px 10px; border-radius: 8px; background: rgba(255,255,255,0.08); }
.pm-back:hover { background: rgba(255,255,255,0.15); }
.pm-header-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
.pm-carrier-wrap { display: flex; align-items: center; gap: 6px; }
.pm-carrier-tabs { display: flex; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); }
.pm-carrier-tab { padding: 5px 10px; font-size: 11px; color: #888; background: rgba(255,255,255,0.05); }
.pm-carrier-tab--active { background: #e8a038; color: #fff; font-weight: 600; }
.pm-carrier-input { width: 130px; padding: 5px 10px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; font-size: 13px; }
.pm-carrier-input:focus { outline: none; border-color: #e8a038; }
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
.pm-confirm { width: 100%; padding: 16px; border-radius: 12px; font-size: 15px; font-weight: 700; color: #fff; background: #3a7a3a; transition: background 0.15s; }
.pm-confirm:hover:not(:disabled) { background: #2a6a2a; }
.pm-confirm:disabled { opacity: 0.4; cursor: not-allowed; }
.pm-confirm--cash { background: #e8a038; }
.pm-confirm--cash:hover:not(:disabled) { background: #c88020; }
.pm-confirm--defer { background: #5a4a3a; }
.pm-confirm--defer:hover { background: #4a3a2a; }
</style>