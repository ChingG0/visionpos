<template>
  <aside class="ocp">

    <!-- Header: 內用 / 外帶 切換 -->
    <div class="ocp__header">
      <div class="ocp__order-type">
        <button
          class="ocp__type-btn"
          :class="{ 'ocp__type-btn--active': orderType === 'dine-in' }"
          @click="emit('update:orderType', 'dine-in')"
        >內用</button>
        <button
          class="ocp__type-btn"
          :class="{ 'ocp__type-btn--active': orderType === 'takeout' }"
          @click="emit('update:orderType', 'takeout')"
        >外帶</button>
      </div>
      <button
        v-if="cartItems.length > 0"
        class="ocp__clear-btn"
        aria-label="清空購物車"
        @click="emit('clear')"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18"/>
          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
          <path d="M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2"/>
        </svg>
      </button>
    </div>

    <!-- 內用：已選桌號 -->
    <div v-if="orderType === 'dine-in'" class="ocp__table-row">
      <span v-if="tableName" class="ocp__table-chip">
        🍽 {{ tableName }}
        <button class="ocp__table-clear" aria-label="重選桌號" @click="emit('change-table')">×</button>
      </span>
      <button v-else class="ocp__table-pick-btn" @click="emit('change-table')">選擇桌號</button>
    </div>

    <!-- 外帶：客戶資訊（選填） -->
    <div v-if="orderType === 'takeout'" class="ocp__customer">
      <input
        class="ocp__customer-input"
        type="text"
        placeholder="訂購人姓名（選填）"
        :value="customerName"
        maxlength="20"
        @input="emit('update:customerName', $event.target.value)"
      />
      <input
        class="ocp__customer-input"
        type="tel"
        placeholder="電話（選填，自動存入會員）"
        :value="customerPhone"
        maxlength="15"
        @input="emit('update:customerPhone', $event.target.value)"
      />
    </div>

    <!-- 購物車列表 -->
    <div class="ocp__list">
      <p v-if="cartItems.length === 0" class="ocp__empty">點選左側餐點開始點餐</p>

      <div v-for="line in cartItems" :key="line.id" class="ocp__line">
        <span class="ocp__line-icon">{{ line.icon }}</span>

        <div class="ocp__line-info">
          <p class="ocp__line-name">{{ line.name }}</p>
          <p class="ocp__line-unit">${{ line.price.toFixed(2) }}</p>
        </div>

        <div class="ocp__line-qty">
          <button class="ocp__qty-btn" @click="emit('decrease', line.id)">−</button>
          <span class="ocp__qty-num">{{ line.qty }}</span>
          <button class="ocp__qty-btn" @click="emit('increase', line.id)">＋</button>
        </div>

        <span class="ocp__line-total">${{ (line.price * line.qty).toFixed(2) }}</span>

        <button class="ocp__line-remove" aria-label="移除" @click="emit('remove', line.id)">×</button>
      </div>

      <!-- 整單備註 / 標籤摘要 -->
      <div v-if="note || selectedTags.length > 0" class="ocp__note-block">
        <p v-if="note" class="ocp__note-text">📝 {{ note }}</p>
        <div v-if="selectedTags.length > 0" class="ocp__tag-list">
          <span
            v-for="tag in selectedTags"
            :key="tag.id"
            class="ocp__tag-pill"
            :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }"
          >{{ tag.label }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="ocp__footer">
      <div class="ocp__summary-row">
        <span>小計</span>
        <span>${{ subtotal.toFixed(2) }}</span>
      </div>
      <div v-if="surchargeAmount > 0" class="ocp__summary-row">
        <span>加價{{ surcharge?.reason ? `（${surcharge.reason}）` : '' }}</span>
        <span>+${{ surchargeAmount.toFixed(2) }}</span>
      </div>
      <div v-if="discountAmount > 0" class="ocp__summary-row ocp__summary-row--discount">
        <span>折扣{{ discountLabel }}</span>
        <span>−${{ discountAmount.toFixed(2) }}</span>
      </div>
      <div class="ocp__summary-row ocp__summary-row--total">
        <span>總計</span>
        <span>${{ total.toFixed(2) }}</span>
      </div>

      <button
        class="ocp__charge-btn"
        :disabled="cartItems.length === 0"
        @click="emit('charge')"
      >
        {{ orderType === 'dine-in' && !tableName ? '結帳（請先選桌號）' : `結帳　$${total.toFixed(0)}` }}
      </button>
    </div>

  </aside>
</template>

<script setup>
import { computed } from 'vue'
import { TAG_COLOR_MAP } from '@/constants/tagColors.js'

const props = defineProps({
  cartItems:     { type: Array,  required: true },
  note:          { type: String, default: '' },
  selectedTags:  { type: Array,  default: () => [] },
  surcharge:     { type: Object, default: null },
  discount:      { type: Object, default: null },
  orderType:     { type: String, default: 'dine-in' },
  tableName:     { type: String, default: '' },
  customerName:  { type: String, default: '' },
  customerPhone: { type: String, default: '' },
})

const emit = defineEmits([
  'increase', 'decrease', 'remove', 'clear', 'charge',
  'update:orderType', 'change-table',
  'update:customerName', 'update:customerPhone',
])

const subtotal = computed(() =>
  props.cartItems.reduce((sum, l) => sum + l.price * l.qty, 0)
)

const surchargeAmount = computed(() => props.surcharge?.amount ?? 0)

const discountAmount = computed(() => {
  if (!props.discount || !props.discount.value) return 0
  const base = subtotal.value + surchargeAmount.value
  if (props.discount.type === 'percent') {
    return Math.round(base * (props.discount.value / 100))
  }
  return Math.min(props.discount.value, base)
})

const discountLabel = computed(() => {
  if (!props.discount) return ''
  return props.discount.type === 'percent' ? `（${props.discount.value}%）` : ''
})

const total = computed(() =>
  Math.max(0, subtotal.value + surchargeAmount.value - discountAmount.value)
)

function tagColorOf(tag) {
  return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
}
</script>

<style scoped>
.ocp {
  width: 260px;
  background: #fff;
  border-left: 1px solid var(--color-border-base);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  overflow: hidden;
}

/* ── Header ── */
.ocp__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 10px;
  flex-shrink: 0;
}

.ocp__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

/* ── 內用 / 外帶 切換 ── */
.ocp__order-type {
  display: flex;
  gap: 4px;
  background: #f0e8d8;
  border-radius: var(--radius-sm);
  padding: 3px;
}

.ocp__type-btn {
  padding: 5px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: background 0.12s, color 0.12s;
}

.ocp__type-btn--active {
  background: #fff;
  color: var(--color-text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── 外帶客戶資訊 ── */
.ocp__customer {
  padding: 0 18px 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.ocp__customer-input {
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 12.5px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
}

.ocp__customer-input:focus { border-color: #e8a038; }
.ocp__table-row {
  padding: 0 18px 10px;
  flex-shrink: 0;
}

.ocp__table-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: #2f7a3d;
  background: #e1f3e1;
  padding: 5px 8px 5px 12px;
  border-radius: 999px;
}

.ocp__table-clear {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(0,0,0,0.08);
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ocp__table-pick-btn {
  font-size: 12.5px;
  color: #b8631f;
  background: #fde8d2;
  padding: 6px 14px;
  border-radius: 999px;
  font-weight: 500;
}

.ocp__table-pick-btn:hover { background: #fbdcb8; }

.ocp__clear-btn {
  width: 26px;
  height: 26px;
  border-radius: var(--radius-sm);
  background: #f0e8d8;
  color: #8a6850;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.ocp__clear-btn:hover {
  background: #e8d0b8;
}

/* ── List ── */
.ocp__list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ocp__empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12.5px;
  padding: 40px 0;
}

.ocp__line {
  display: grid;
  grid-template-columns: 32px 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 10px;
  row-gap: 4px;
  position: relative;
  padding-bottom: 10px;
  border-bottom: 1px solid #f0e8d8;
}

.ocp__line-icon {
  font-size: 22px;
  grid-row: 1 / 3;
  display: flex;
  align-items: center;
}

.ocp__line-info {
  grid-column: 2;
  grid-row: 1;
}

.ocp__line-name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.ocp__line-unit {
  font-size: 10.5px;
  color: var(--color-text-muted);
}

.ocp__line-total {
  grid-column: 3;
  grid-row: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  align-self: start;
}

.ocp__line-qty {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ocp__qty-btn {
  width: 18px;
  height: 18px;
  border-radius: var(--radius-full);
  background: #f0e8d8;
  color: #5a4030;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ocp__qty-btn:hover { background: #e0d0b8; }

.ocp__qty-num {
  font-size: 12px;
  color: var(--color-text-primary);
  min-width: 14px;
  text-align: center;
}

.ocp__line-remove {
  grid-column: 3;
  grid-row: 2;
  justify-self: end;
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  background: #f0e0e0;
  color: #c03020;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.ocp__line-remove:hover { background: #f0c0b8; }

/* ── 整單備註 / 標籤摘要 ── */
.ocp__note-block {
  padding-top: 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ocp__note-text {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: #faf5ec;
  padding: 6px 9px;
  border-radius: var(--radius-sm);
  line-height: 1.4;
}

.ocp__tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.ocp__tag-pill {
  font-size: 11px;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

/* ── Footer ── */
.ocp__footer {
  padding: 12px 18px 18px;
  border-top: 1px solid #ede5d0;
  flex-shrink: 0;
}

.ocp__summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.ocp__summary-row--discount {
  color: #c03020;
}

.ocp__summary-row--total {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px dashed #e0d5c0;
}

.ocp__charge-btn {
  width: 100%;
  margin-top: 14px;
  padding: 12px;
  background: #d94a5a;
  color: #fff;
  border-radius: var(--radius-lg);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.5px;
  transition: background 0.15s;
}

.ocp__charge-btn:hover:not(:disabled) {
  background: #c0394a;
}

.ocp__charge-btn:disabled {
  background: #d8c8c0;
  cursor: not-allowed;
}
</style>