<template>
  <Teleport to="body">
    <div class="mpm-backdrop" @click.self="emit('close')">
      <div class="mpm-box">

        <div class="mpm-header">
          <span class="mpm-title">{{ presetItem ? presetItem.name : '時價商品' }}</span>
          <button class="mpm-close" @click="emit('close')">×</button>
        </div>

        <div class="mpm-body">

          <!-- 商品名稱：邊打邊搜尋既有的時價商品 -->
          <div v-if="!presetItem" class="mpm-field">
            <label class="mpm-label">商品名稱</label>
            <input
              ref="nameInputRef"
              v-model="name"
              class="mpm-input"
              type="text"
              placeholder="例：芭樂"
              autocomplete="off"
              @input="showSuggestions = true"
              @focus="showSuggestions = true"
            />

            <!-- 關聯建議：選既有的沿用同一筆商品，報表才彙總得起來 -->
            <div v-if="showSuggestions && suggestions.length" class="mpm-suggestions">
              <button
                v-for="s in suggestions" :key="s.id"
                class="mpm-suggestion"
                @click="pickSuggestion(s)"
              >
                <span class="mpm-suggestion-name">{{ s.name }}</span>
                <span class="mpm-suggestion-tag">已建立</span>
              </button>
            </div>
            <p v-else-if="name.trim() && !matchedExisting" class="mpm-new-hint">
              ✦ 這是新商品，確認後會建立「{{ name.trim() }}」
            </p>
          </div>

          <!-- 金額 -->
          <div class="mpm-field">
            <label class="mpm-label">金額</label>
            <div class="mpm-amount-wrap">
              <span class="mpm-amount-prefix">$</span>
              <input
                ref="amountInputRef"
                v-model="amountText"
                class="mpm-input mpm-input--amount"
                type="text"
                inputmode="numeric"
                placeholder="0"
                @keyup.enter="handleConfirm"
              />
            </div>
          </div>

          <!-- 重量／數量：選填，只做紀錄用，不參與金額計算 -->
          <div class="mpm-field">
            <label class="mpm-label">重量／數量<span class="mpm-optional">選填，僅供對帳紀錄</span></label>
            <div class="mpm-qty-row">
              <input
                v-model="weightText"
                class="mpm-input mpm-input--weight"
                type="text"
                inputmode="decimal"
                placeholder="例：1.5"
              />
              <div class="mpm-unit-btns">
                <button
                  v-for="u in UNIT_OPTIONS" :key="u"
                  class="mpm-unit-btn"
                  :class="{ 'mpm-unit-btn--active': unit === u }"
                  @click="unit = u"
                >{{ u }}</button>
              </div>
            </div>
          </div>

          <!-- 稅別：每筆都要選，預設免稅 -->
          <div class="mpm-field">
            <label class="mpm-label">稅別</label>
            <div class="mpm-tax-btns">
              <button
                v-for="opt in TAX_OPTIONS" :key="opt.value"
                class="mpm-tax-btn"
                :class="{ 'mpm-tax-btn--active': taxType === opt.value }"
                @click="taxType = opt.value"
              >{{ opt.label }}</button>
            </div>
          </div>

          <p v-if="errorMsg" class="mpm-error">{{ errorMsg }}</p>

        </div>

        <div class="mpm-footer">
          <button class="mpm-btn-ghost" @click="emit('close')">取消</button>
          <button class="mpm-btn-primary" :disabled="!canConfirm" @click="handleConfirm">
            加入購物車
          </button>
        </div>

      </div>
    </div>

    <!-- 金額異常提示：明顯偏離平常金額時再確認一次，擋掉多打一個零這種手誤 -->
    <div v-if="pendingConfirm" class="mpm-overlay" @click.self="pendingConfirm = false">
      <div class="mpm-dialog">
        <p class="mpm-dialog-title">確認金額</p>
        <p class="mpm-dialog-amount">${{ amount.toLocaleString('zh-TW') }}</p>
        <p class="mpm-dialog-sub">{{ finalName }}<template v-if="weightLabel">・{{ weightLabel }}</template>・{{ taxLabel }}</p>
        <p class="mpm-dialog-hint">這筆金額比平常高出不少，確認沒有多打一位數嗎？</p>
        <div class="mpm-dialog-footer">
          <button class="mpm-btn-ghost" @click="pendingConfirm = false">再檢查</button>
          <button class="mpm-btn-primary" @click="doConfirm">確認金額正確</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useMenuStore } from '@/stores/menuStore.js'

const props = defineProps({
  // 從既有時價商品格子點進來時帶入；從「＋ 時價」進來則為 null（要自己輸入名稱）
  presetItem: { type: Object, default: null },
})
const emit = defineEmits(['close', 'confirm'])

const menuStore = useMenuStore()

const TAX_OPTIONS = [
  { value: 'exempt',  label: '免稅' },
  { value: 'taxable', label: '應稅' },
]

/* 重量／數量單位。純紀錄用途（對帳時可以回頭核對「這筆 270 元是幾斤」），
 * 不參與任何金額計算——金額還是店員直接輸入的那個數字。 */
const UNIT_OPTIONS = ['斤', '包', '顆', '盒', '克']

/* 上次用的單位記在瀏覽器，同一台機器下次打開直接沿用，
 * 賣水果的店九成都是秤斤，不用每次都重選。 */
const UNIT_LS_KEY = 'visionpos:market-price-unit'

/* 金額超過這個數字才跳二次確認。生鮮秤重單筆通常幾百元，
 * 設 2000 是為了擋「多打一個零」這種手誤，不是要限制金額上限。 */
const AMOUNT_WARN_THRESHOLD = 2000

const name            = ref('')
const amountText      = ref('')
const weightText      = ref('')
const unit            = ref(loadLastUnit())
const taxType         = ref('exempt')   // 每筆都要選，預設免稅
const showSuggestions = ref(false)
const errorMsg        = ref('')
const pendingConfirm  = ref(false)

function loadLastUnit() {
  try {
    const saved = localStorage.getItem(UNIT_LS_KEY)
    return UNIT_OPTIONS.includes(saved) ? saved : '斤'
  } catch { return '斤' }
}

const nameInputRef   = ref(null)
const amountInputRef = ref(null)

onMounted(async () => {
  await nextTick()
  // 從既有商品進來就直接聚焦金額，不用再打一次名稱
  if (props.presetItem) amountInputRef.value?.focus()
  else                  nameInputRef.value?.focus()
})

const suggestions = computed(() => {
  const q = name.value.trim()
  if (!q) return []
  // 已經完全輸入既有名稱時就不用再顯示建議（下方會顯示「已建立」狀態）
  return menuStore.searchMarketPriceItems(q).slice(0, 6)
})

const matchedExisting = computed(() =>
  menuStore.findMarketPriceItemByName(name.value)
)

const amount = computed(() => {
  const n = parseInt(String(amountText.value).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
})

const finalName = computed(() =>
  props.presetItem ? props.presetItem.name : name.value.trim()
)

/* 選填欄位：沒填就是 null，不會在收據/報表上顯示任何東西。
 * 允許小數（1.5 斤），但不接受 0 或負數。 */
const weight = computed(() => {
  const n = parseFloat(String(weightText.value).replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
})

const weightLabel = computed(() =>
  weight.value ? `${weight.value}${unit.value}` : ''
)

const taxLabel = computed(() =>
  TAX_OPTIONS.find(o => o.value === taxType.value)?.label ?? ''
)

const canConfirm = computed(() => !!finalName.value && amount.value > 0)

function pickSuggestion(item) {
  name.value = item.name
  showSuggestions.value = false
  amountInputRef.value?.focus()
}

function handleConfirm() {
  errorMsg.value = ''
  if (!finalName.value) { errorMsg.value = '請輸入商品名稱'; return }
  if (amount.value <= 0) { errorMsg.value = '請輸入金額'; return }

  if (amount.value >= AMOUNT_WARN_THRESHOLD) { pendingConfirm.value = true; return }
  doConfirm()
}

async function doConfirm() {
  pendingConfirm.value = false

  // 既有商品沿用原本的 id（報表才彙總得起來）；全新名稱這時候才建立一筆商品。
  // addMarketPriceItem 內部會再檢查一次名稱是否已存在，不會重複建立。
  const item = props.presetItem ?? await menuStore.addMarketPriceItem(finalName.value)
  if (!item) { errorMsg.value = '建立商品失敗，請稍後再試'; return }

  try { localStorage.setItem(UNIT_LS_KEY, unit.value) } catch { /* 無痕模式等情況忽略 */ }

  emit('confirm', {
    item,
    price:   amount.value,
    taxType: taxType.value,
    weight:  weight.value,                       // 沒填就是 null
    unit:    weight.value ? unit.value : null,   // 沒填重量時單位也不留
  })
}
</script>

<style scoped>
.mpm-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.mpm-box {
  background: #fff; border-radius: 16px; width: 340px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  font-family: 'Noto Sans TC','PingFang TC',sans-serif;
  display: flex; flex-direction: column;
}

.mpm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 12px; border-bottom: 1px solid #ede5d0;
}
.mpm-title { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.mpm-close {
  width: 26px; height: 26px; border-radius: 50%; background: #f0e8d8;
  font-size: 16px; color: #7a6850; display: flex; align-items: center; justify-content: center;
}
.mpm-close:hover { background: #e0d0b8; }

.mpm-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
.mpm-field { display: flex; flex-direction: column; gap: 5px; position: relative; }
.mpm-label { font-size: 12px; font-weight: 500; color: #5a4030; }
.mpm-input {
  padding: 9px 11px; border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 14px; background: #faf5ec; outline: none; font-family: inherit;
  color: var(--color-text-primary); width: 100%;
}
.mpm-input:focus { border-color: #e8a038; }

.mpm-amount-wrap { display: flex; align-items: center; gap: 6px; }
.mpm-amount-prefix { font-size: 18px; font-weight: 600; color: #7a6850; }
.mpm-input--amount { font-size: 20px; font-weight: 600; letter-spacing: 0.02em; }

/* 關聯建議 */
.mpm-suggestions {
  display: flex; flex-direction: column;
  border: 1px solid #ede5d0; border-radius: 8px; overflow: hidden;
  background: #fff; max-height: 168px; overflow-y: auto;
}
.mpm-suggestion {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 11px; font-size: 13.5px; text-align: left;
  color: var(--color-text-primary); background: #fff;
  border-bottom: 1px solid #faf5ec;
}
.mpm-suggestion:last-child { border-bottom: none; }
.mpm-suggestion:hover { background: #fff8ee; }
.mpm-suggestion-tag { font-size: 11px; color: #a89880; }
.mpm-new-hint { font-size: 11.5px; color: #2f7a3d; }

/* 重量／數量 */
.mpm-optional { font-size: 10.5px; font-weight: 400; color: #a89880; margin-left: 6px; }
.mpm-qty-row { display: flex; gap: 6px; align-items: center; }
.mpm-input--weight { width: 74px; flex-shrink: 0; text-align: center; }
.mpm-unit-btns { display: flex; gap: 4px; flex: 1; }
.mpm-unit-btn {
  flex: 1; padding: 8px 0; border-radius: 7px; font-size: 12.5px;
  color: #7a6850; background: #f0e8d8; border: 1.5px solid transparent;
}
.mpm-unit-btn--active {
  background: #fde8c0; color: #8a6020; border-color: #e8c888; font-weight: 600;
}

/* 稅別 */
.mpm-tax-btns { display: flex; gap: 6px; }
.mpm-tax-btn {
  flex: 1; padding: 9px 0; border-radius: 8px; font-size: 13.5px;
  color: #7a6850; background: #f0e8d8; border: 1.5px solid transparent;
}
.mpm-tax-btn--active {
  background: #fde8c0; color: #8a6020; border-color: #e8c888; font-weight: 600;
}

.mpm-error { font-size: 12px; color: #c0392b; }

.mpm-footer {
  padding: 12px 16px 14px; border-top: 1px solid #ede5d0;
  display: flex; gap: 8px;
}
.mpm-btn-ghost {
  flex: 1; padding: 10px; border-radius: 10px; font-size: 13.5px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.mpm-btn-ghost:hover { background: #e8dcc8; }
.mpm-btn-primary {
  flex: 2; padding: 10px; border-radius: 10px; font-size: 14px; font-weight: 600;
  color: #fff; background: #e8a038; border: none;
}
.mpm-btn-primary:hover:not(:disabled) { background: #d0891f; }
.mpm-btn-primary:disabled { opacity: 0.5; }

/* 金額二次確認 */
.mpm-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center; z-index: 10000;
}
.mpm-dialog {
  background: #fff; border-radius: 16px; width: 290px; padding: 18px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.25);
  display: flex; flex-direction: column; gap: 6px; text-align: center;
  font-family: 'Noto Sans TC','PingFang TC',sans-serif;
}
.mpm-dialog-title  { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.mpm-dialog-amount { font-size: 30px; font-weight: 700; color: #e07020; }
.mpm-dialog-sub    { font-size: 12.5px; color: var(--color-text-secondary); }
.mpm-dialog-hint {
  font-size: 11.5px; color: #806010; background: #fff8e6;
  border-radius: 8px; padding: 7px 10px; margin-top: 4px;
}
.mpm-dialog-footer { display: flex; gap: 7px; margin-top: 8px; }
</style>
