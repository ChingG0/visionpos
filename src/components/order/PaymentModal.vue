<template>
  <Teleport to="body">
    <div class="pm-backdrop">
      <div class="pm-box">

        <!-- 頂部標題 -->
        <div class="pm-header">
          <button class="pm-back" @click="emit('close')">← 返回</button>
          <div class="pm-total-label">總計</div>
          <div class="pm-total">${{ total.toFixed(0) }}</div>
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

            <!-- 快速金額 -->
            <div class="pm-quick">
              <button class="pm-quick-btn" @click="setQuick(total)">精確金額</button>
              <button v-for="q in quickAmounts" :key="q" class="pm-quick-btn" @click="setQuick(q)">
                ${{ q.toLocaleString() }}
              </button>
            </div>

            <!-- 鍵盤 -->
            <div class="pm-keypad">
              <div class="pm-keypad-grid">
                <button v-for="k in KEYS" :key="k.v"
                  class="pm-key" :class="k.cls"
                  @click="pressKey(k.v)">
                  {{ k.label }}
                </button>
                <!-- 不找零 -->
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

        <!-- ── 信用卡 / LinePay ── -->
        <template v-else-if="method === 'card' || method === 'linepay'">
          <div class="pm-card-area">
            <div class="pm-card-icon">{{ method === 'card' ? '💳' : '📱' }}</div>
            <p class="pm-card-hint">
              {{ method === 'card' ? '請於刷卡機完成刷卡，再按確認' : '請客人開啟 LINE Pay 掃描 QR，再按確認' }}
            </p>
            <div class="pm-card-amount">${{ total.toFixed(0) }}</div>
          </div>
          <div class="pm-action">
            <button class="pm-confirm" @click="confirm">
              ✓ 確認付款完成
            </button>
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
            <button class="pm-confirm pm-confirm--defer" @click="confirm">
              先送出，稍後付款
            </button>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  total:      { type: Number,  required: true },
  allowDefer: { type: Boolean, default: true },   // 併單結帳時傳 false，禁止稍後付款
})

const emit = defineEmits(['close', 'paid'])

const ALL_METHODS = [
  { key: 'cash',    label: '現金',     icon: '💵' },
  { key: 'card',    label: '信用卡',   icon: '💳' },
  { key: 'linepay', label: 'LINE Pay', icon: '📱' },
  { key: 'defer',   label: '稍後付款', icon: '🕐' },
]

const METHODS = computed(() =>
  props.allowDefer ? ALL_METHODS : ALL_METHODS.filter(m => m.key !== 'defer')
)

const KEYS = [
  { v: '1',  label: '1' }, { v: '2', label: '2' }, { v: '3', label: '3' },
  { v: '4',  label: '4' }, { v: '5', label: '5' }, { v: '6', label: '6' },
  { v: '7',  label: '7' }, { v: '8', label: '8' }, { v: '9', label: '9' },
  { v: '+/-',label: '+/-',cls: 'pm-key--fn' },
  { v: '0',  label: '0' },
  { v: '.',  label: '.', cls: 'pm-key--fn' },
  { v: '←',  label: '←', cls: 'pm-key--fn' },
]

const method      = ref('cash')
const enteredStr  = ref('')

/* 快速金額選項：往上取整到 100 的倍數 */
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
}

function setQuick(amount) {
  enteredStr.value = String(Math.round(amount))
}

function pressKey(v) {
  if (v === '←') {
    enteredStr.value = enteredStr.value.slice(0, -1)
    return
  }
  if (v === '+/-') return
  if (v === '.' && enteredStr.value.includes('.')) return
  if (v === '.' && enteredStr.value === '') enteredStr.value = '0'
  if (enteredStr.value.length >= 10) return
  enteredStr.value += v
}

function confirm() {
  const amount   = enteredAmount.value || props.total
  const chg      = method.value === 'cash' ? Math.max(0, amount - props.total) : 0
  emit('paid', {
    method:       method.value,
    methodLabel:  METHODS.value.find(m => m.key === method.value)?.label ?? method.value,
    paymentAmount: amount,
    changeAmount:  chg,
  })
}
</script>

<style scoped>
.pm-backdrop {
  position: fixed; inset: 0; z-index: 9999;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
}

.pm-box {
  background: #1a1410; color: #fff;
  border-radius: 20px; width: 520px; max-height: 95vh;
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}

/* ── 頂部 ── */
.pm-header {
  display: flex; align-items: center; gap: 12px;
  padding: 16px 20px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.pm-back {
  font-size: 13px; color: #aaa; padding: 6px 10px;
  border-radius: 8px; background: rgba(255,255,255,0.08);
  transition: background 0.12s;
}
.pm-back:hover { background: rgba(255,255,255,0.15); }

.pm-total-label { font-size: 13px; color: #888; margin-left: auto; }
.pm-total { font-size: 26px; font-weight: 700; color: #fff; }

/* ── Tabs ── */
.pm-tabs { display: flex; padding: 10px 12px 0; gap: 6px; }

.pm-tab {
  flex: 1; padding: 8px 4px; border-radius: 10px;
  font-size: 12.5px; color: #888;
  background: rgba(255,255,255,0.06);
  display: flex; flex-direction: column; align-items: center; gap: 3px;
  transition: all 0.15s;
}
.pm-tab--active {
  background: #e8a038; color: #fff; font-weight: 600;
}
.pm-tab:hover:not(.pm-tab--active) { background: rgba(255,255,255,0.12); }
.pm-tab-icon { font-size: 16px; }

/* ── 現金顯示 ── */
.pm-cash { flex: 1; display: flex; flex-direction: column; padding: 12px 16px; gap: 10px; }

.pm-display-area {
  background: rgba(255,255,255,0.06); border-radius: 12px;
  padding: 12px 16px; display: flex; flex-direction: column; gap: 8px;
}

.pm-row { display: flex; align-items: center; justify-content: space-between; }
.pm-row--change { border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; }

.pm-display-label { font-size: 13px; color: #888; }

.pm-display-amount {
  font-size: 28px; font-weight: 700; color: #fff;
  font-variant-numeric: tabular-nums;
}
.pm-display-amount--empty { color: #555; }

.pm-change     { font-size: 22px; font-weight: 700; color: #5a9; font-variant-numeric: tabular-nums; }
.pm-change--neg { color: #e06060; }

/* 快速金額 */
.pm-quick { display: flex; gap: 6px; }
.pm-quick-btn {
  flex: 1; padding: 8px 4px; border-radius: 8px;
  font-size: 12.5px; font-weight: 500; color: #ccc;
  background: rgba(255,255,255,0.1); transition: background 0.12s;
  white-space: nowrap;
}
.pm-quick-btn:hover { background: rgba(255,255,255,0.2); }

/* 鍵盤 */
.pm-keypad-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.pm-key {
  height: 56px; border-radius: 10px;
  font-size: 20px; font-weight: 500; color: #fff;
  background: rgba(255,255,255,0.12); transition: background 0.1s;
}
.pm-key:hover:not(:disabled) { background: rgba(255,255,255,0.22); }
.pm-key:active               { background: rgba(255,255,255,0.35); }

.pm-key--fn   { background: rgba(255,255,255,0.06); font-size: 16px; color: #ccc; }
.pm-key--exact {
  background: #2a6a5a; font-size: 13px; font-weight: 600; color: #fff;
  line-height: 1.3; grid-row: span 2; height: auto; padding: 10px 0;
}
.pm-key--exact:hover { background: #1a5a4a; }

/* ── 信用卡/LinePay 區 ── */
.pm-card-area {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 14px; padding: 32px 24px;
}
.pm-card-icon     { font-size: 52px; }
.pm-card-hint     { font-size: 14px; color: #aaa; text-align: center; max-width: 280px; }
.pm-card-amount   { font-size: 36px; font-weight: 700; color: #fff; }
.pm-card-amount--defer { color: #e8a038; }

/* ── 確認按鈕 ── */
.pm-action { padding: 10px 16px 16px; }

.pm-confirm {
  width: 100%; padding: 16px;
  border-radius: 12px; font-size: 15px; font-weight: 700; color: #fff;
  background: #3a7a3a; transition: background 0.15s;
}
.pm-confirm:hover:not(:disabled) { background: #2a6a2a; }
.pm-confirm:disabled { opacity: 0.4; cursor: not-allowed; }

.pm-confirm--cash  { background: #e8a038; }
.pm-confirm--cash:hover:not(:disabled) { background: #c88020; }

.pm-confirm--defer { background: #5a4a3a; }
.pm-confirm--defer:hover { background: #4a3a2a; }
</style>