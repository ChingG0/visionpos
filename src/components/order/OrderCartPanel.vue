<template>
  <aside class="ocp">

    <!-- Header -->
    <div class="ocp__header">
      <h3 class="ocp__title">Order <span class="ocp__title-light">Menu</span></h3>
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
    </div>

    <!-- Footer -->
    <div class="ocp__footer">
      <div class="ocp__summary-row">
        <span>Sub Total</span>
        <span>${{ subtotal.toFixed(2) }}</span>
      </div>
      <div class="ocp__summary-row">
        <span>餐盒費</span>
        <span>${{ containerFee.toFixed(2) }}</span>
      </div>
      <div class="ocp__summary-row ocp__summary-row--total">
        <span>Total</span>
        <span>${{ total.toFixed(2) }}</span>
      </div>

      <button
        class="ocp__charge-btn"
        :disabled="cartItems.length === 0"
        @click="emit('charge')"
      >
        送出訂單　${{ total.toFixed(2) }}
      </button>
    </div>

  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  cartItems: { type: Array, required: true },
})

const emit = defineEmits(['increase', 'decrease', 'remove', 'clear', 'charge'])

const subtotal = computed(() =>
  props.cartItems.reduce((sum, l) => sum + l.price * l.qty, 0)
)

/* 外帶餐盒費：有品項才收，固定 $10（之後可改設定） */
const containerFee = computed(() => (props.cartItems.length > 0 ? 10 : 0))

const total = computed(() => subtotal.value + containerFee.value)
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

.ocp__title-light {
  font-weight: 400;
  color: var(--color-text-secondary);
}

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