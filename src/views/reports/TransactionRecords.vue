<template>
  <div class="tr">

    <!-- 日期選擇列 -->
    <div class="tr__datebar">
      <div class="tr__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="tr__date-btn" :class="{ 'tr__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">
          {{ opt.label }}
        </button>
      </div>
      <div class="tr__date-custom">
        <input type="date" class="tr__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="tr__date-input" v-model="customEnd"   @change="applyCustom" />
      </div>
      <!-- 類型篩選 -->
      <div class="tr__type-filter">
        <button v-for="opt in TYPE_OPTS" :key="opt.key"
          class="tr__type-btn" :class="{ 'tr__type-btn--active': typeFilter === opt.key }"
          @click="typeFilter = opt.key">
          {{ opt.label }}
        </button>
      </div>
      <span v-if="reportsStore.loading" class="tr__loading">載入中...</span>
    </div>

    <!-- 摘要列 -->
    <div class="tr__summary">
      <span>共 <strong>{{ filtered.length }}</strong> 筆</span>
      <span>合計 <strong>${{ fmtNum(sumTotal) }}</strong></span>
    </div>

    <!-- 交易表格 -->
    <div class="tr__table-wrap">
      <table class="tr__table">
        <thead>
          <tr>
            <th class="tr__th">完成時間</th>
            <th class="tr__th">類型</th>
            <th class="tr__th">訂單號</th>
            <th class="tr__th">訂購人</th>
            <th class="tr__th tr__th--wide">品項摘要</th>
            <th class="tr__th tr__th--num">小計</th>
            <th class="tr__th tr__th--num">折扣</th>
            <th class="tr__th tr__th--num">總計</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="reportsStore.loading">
            <td colspan="8" class="tr__empty">載入中...</td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td colspan="8" class="tr__empty">此期間無交易紀錄</td>
          </tr>
          <template v-else>
            <tr v-for="order in filtered" :key="order.id" class="tr__row">
              <td class="tr__td tr__td--time">{{ fmtTime(order.completed_at) }}</td>
              <td class="tr__td">
                <span class="tr__type-badge"
                  :class="order.orderType === 'takeout' ? 'tr__type-badge--takeout' : 'tr__type-badge--delivery'">
                  {{ order.typeLabel }}
                </span>
              </td>
              <td class="tr__td tr__td--id">
                #{{ formatOrderId(order) }}
              </td>
              <td class="tr__td">{{ order.customer_name || '—' }}</td>
              <td class="tr__td tr__td--items">{{ summarizeItems(order.items) }}</td>
              <td class="tr__td tr__td--num">${{ fmtNum(order.subtotal) }}</td>
              <td class="tr__td tr__td--num tr__td--discount">
                {{ discountAmount(order) > 0 ? `-$${fmtNum(discountAmount(order))}` : '—' }}
              </td>
              <td class="tr__td tr__td--num tr__td--total">${{ fmtNum(order.total) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p class="tr__note">※ 目前記錄外帶與外送已完成訂單，內用訂單表建立後會一併顯示</p>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReportsStore } from '@/stores/reportsStore.js'

const reportsStore = useReportsStore()

const DATE_OPTS = [
  { key: 'today',     label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: 'week',      label: '本週' },
  { key: 'month',     label: '本月' },
]

const TYPE_OPTS = [
  { key: 'all',      label: '全部' },
  { key: 'takeout',  label: '外帶' },
  { key: 'dine-in',  label: '內用' },
  { key: 'delivery', label: '外送' },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function offsetDay(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const preset      = ref('today')
const customStart = ref(todayStr())
const customEnd   = ref(todayStr())
const typeFilter  = ref('all')

function applyPreset(key) {
  preset.value = key
  const today = todayStr()
  if (key === 'today')     { customStart.value = today; customEnd.value = today }
  if (key === 'yesterday') { const y = offsetDay(-1); customStart.value = y; customEnd.value = y }
  if (key === 'week') {
    const d = new Date()
    const dow = d.getDay() || 7
    customStart.value = offsetDay(1 - dow)
    customEnd.value   = today
  }
  if (key === 'month') {
    const d = new Date()
    customStart.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    customEnd.value   = today
  }
  reportsStore.fetchOrders(customStart.value, customEnd.value)
}

function applyCustom() {
  preset.value = ''
  reportsStore.fetchOrders(customStart.value, customEnd.value)
}

onMounted(() => applyPreset('today'))

/* ── 篩選 ── */
const filtered = computed(() => {
  if (typeFilter.value === 'all') return reportsStore.orders
  return reportsStore.orders.filter(o => o.orderType === typeFilter.value)
})

const sumTotal = computed(() => filtered.value.reduce((s, o) => s + (o.total ?? 0), 0))

/* ── 格式化 ── */
function fmtNum(n) { return Math.round(n ?? 0).toLocaleString('zh-TW') }

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(/\//g, '-')
}

function formatOrderId(order) {
  if (order.pickup_number && order.completed_at) {
    const d  = new Date(order.completed_at)
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}${mm}${dd}${String(order.pickup_number).padStart(2, '0')}`
  }
  return order.id.slice(0, 8).toUpperCase()
}

function summarizeItems(items) {
  if (!items?.length) return '—'
  return items.map(i => `${i.name}×${i.qty}`).join('、')
}

function discountAmount(order) {
  if (!order.discount?.value) return 0
  const base = order.subtotal ?? 0
  if (order.discount.type === 'percent') return Math.round(base * order.discount.value / 100)
  return Math.min(order.discount.value, base)
}
</script>

<style scoped>
.tr {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

/* ── 日期列 ── */
.tr__datebar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tr__date-btns { display: flex; gap: 4px; }

.tr__date-btn {
  padding: 5px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  background: #fff;
  border: 1px solid var(--color-border-btn);
  transition: all 0.12s;
}

.tr__date-btn--active {
  background: #e8a038;
  color: #fff;
  border-color: #e8a038;
  font-weight: 500;
}

.tr__date-custom {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-muted);
}

.tr__date-input {
  padding: 4px 8px;
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  background: #fff;
  outline: none;
}

.tr__date-input:focus { border-color: #e8a038; }

.tr__type-filter {
  display: flex;
  gap: 4px;
  margin-left: 8px;
}

.tr__type-btn {
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  color: var(--color-text-secondary);
  background: #fff;
  border: 1px solid var(--color-border-btn);
  transition: all 0.12s;
}

.tr__type-btn--active {
  background: var(--color-text-primary);
  color: #fff;
  border-color: var(--color-text-primary);
  font-weight: 500;
}

.tr__loading { font-size: 12px; color: var(--color-text-muted); }

/* ── 摘要 ── */
.tr__summary {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.tr__summary strong { color: var(--color-text-primary); }

/* ── 表格 ── */
.tr__table-wrap {
  flex: 1;
  overflow: auto;
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
}

.tr__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 700px;
}

.tr__th {
  text-align: left;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-muted);
  background: #faf5ec;
  border-bottom: 1px solid #ede5d0;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;
}

.tr__th--num   { text-align: right; }
.tr__th--wide  { min-width: 200px; }

.tr__row:hover { background: #faf5ec; }

.tr__td {
  padding: 9px 12px;
  border-bottom: 1px solid #f5f0e8;
  color: var(--color-text-primary);
  vertical-align: middle;
}

.tr__td--time    { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
.tr__td--id      { font-size: 11.5px; color: var(--color-text-secondary); white-space: nowrap; }
.tr__td--items   { font-size: 12px; color: var(--color-text-secondary); max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tr__td--num     { text-align: right; font-size: 13px; }
.tr__td--discount{ color: #c0392b; }
.tr__td--total   { font-weight: 600; }

.tr__empty {
  text-align: center;
  padding: 40px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.tr__type-badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
}

.tr__type-badge--takeout  { background: #fde8c0; color: #8a6020; }
.tr__type-badge--delivery { background: #d0f0e0; color: #1a6035; }

.tr__note {
  font-size: 11.5px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>