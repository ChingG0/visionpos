<template>
  <div class="ro">

    <!-- 日期選擇列 -->
    <div class="ro__datebar">
      <div class="ro__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="ro__date-btn" :class="{ 'ro__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">
          {{ opt.label }}
        </button>
      </div>
      <div class="ro__date-custom">
        <input type="date" class="ro__date-input" v-model="customStart" @change="applyCustom" />
        <span class="ro__date-sep">～</span>
        <input type="date" class="ro__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <span v-if="reportsStore.loading" class="ro__loading">載入中...</span>
    </div>

    <!-- 指標卡片 -->
    <div class="ro__kpis">
      <div class="ro__kpi">
        <p class="ro__kpi-label">累計營業額</p>
        <p class="ro__kpi-value">${{ fmtNum(totalRevenue) }}</p>
        <p class="ro__kpi-sub">共 {{ orders.length }} 筆訂單</p>
      </div>
      <div class="ro__kpi">
        <p class="ro__kpi-label">平均客單價</p>
        <p class="ro__kpi-value">${{ fmtNum(avgOrderValue) }}</p>
        <p class="ro__kpi-sub">每筆平均</p>
      </div>
      <div class="ro__kpi">
        <p class="ro__kpi-label">外帶筆數</p>
        <p class="ro__kpi-value">{{ takeoutCount }}</p>
        <p class="ro__kpi-sub">${{ fmtNum(takeoutRevenue) }}</p>
      </div>
      <div class="ro__kpi">
        <p class="ro__kpi-label">內用筆數</p>
        <p class="ro__kpi-value">{{ dineInCount }}</p>
        <p class="ro__kpi-sub">${{ fmtNum(dineInRevenue) }}</p>
      </div>
      <div class="ro__kpi">
        <p class="ro__kpi-label">外送筆數</p>
        <p class="ro__kpi-value">{{ deliveryCount }}</p>
        <p class="ro__kpi-sub">${{ fmtNum(deliveryRevenue) }}</p>
      </div>
    </div>

    <!-- 每日營業額長條圖 -->
    <div class="ro__chart-card">
      <div class="ro__chart-title">每日營業額</div>
      <div v-if="orders.length === 0" class="ro__chart-empty">此期間無訂單資料</div>
      <div v-else class="ro__chart-wrap" ref="chartWrap">
        <svg class="ro__chart-svg"
          :viewBox="`0 0 ${svgW} ${svgH}`"
          preserveAspectRatio="none">

          <!-- Y 軸格線 -->
          <line v-for="tick in yTicks" :key="tick"
            :x1="PAD_L" :y1="yPos(tick)"
            :x2="svgW - PAD_R" :y2="yPos(tick)"
            stroke="#ede5d0" stroke-width="1"/>

          <!-- 柱子 -->
          <g v-for="(item, i) in chartData" :key="i">
            <rect
              :x="PAD_L + i * barStep + barGap"
              :y="yPos(item.total)"
              :width="barW"
              :height="innerH - innerH * (1 - item.total / maxTotal)"
              :fill="item.total > 0 ? '#e8a038' : '#f0e8d8'"
              rx="2"/>

            <!-- 金額標籤（只在有值的柱子顯示） -->
            <text v-if="item.total > 0"
              :x="PAD_L + i * barStep + barGap + barW / 2"
              :y="yPos(item.total) - 4"
              text-anchor="middle"
              font-size="9" fill="#8a6020">
              ${{ fmtShort(item.total) }}
            </text>

            <!-- X 軸日期標籤 -->
            <text
              :x="PAD_L + i * barStep + barGap + barW / 2"
              :y="svgH - 2"
              text-anchor="middle"
              font-size="9" fill="#9a8868">
              {{ item.label }}
            </text>
          </g>

          <!-- Y 軸刻度 -->
          <text v-for="tick in yTicks" :key="'l'+tick"
            :x="PAD_L - 3" :y="yPos(tick) + 3"
            text-anchor="end" font-size="8" fill="#9a8868">
            ${{ fmtShort(tick) }}
          </text>
        </svg>
      </div>
    </div>

    <!-- 外帶 / 外送 比例 -->
    <div v-if="orders.length > 0" class="ro__type-bar">
      <div class="ro__type-bar-label">
        <span class="ro__type-dot ro__type-dot--takeout" />外帶
        <strong>${{ fmtNum(takeoutRevenue) }}</strong>
        <span class="ro__type-pct">{{ takeoutPct }}%</span>
      </div>
      <div class="ro__type-track">
        <div class="ro__type-fill ro__type-fill--takeout"  :style="{ width: takeoutPct  + '%' }" />
        <div class="ro__type-fill ro__type-fill--dinein"   :style="{ width: dineInPct   + '%' }" />
        <div class="ro__type-fill ro__type-fill--delivery" :style="{ width: deliveryPct + '%' }" />
      </div>
      <div class="ro__type-bar-label">
        <span class="ro__type-dot ro__type-dot--dinein" />內用
        <strong>${{ fmtNum(dineInRevenue) }}</strong>
        <span class="ro__type-pct">{{ dineInPct }}%</span>
      </div>
      <div class="ro__type-bar-label">
        <span class="ro__type-dot ro__type-dot--delivery" />外送
        <strong>${{ fmtNum(deliveryRevenue) }}</strong>
        <span class="ro__type-pct">{{ deliveryPct }}%</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReportsStore } from '@/stores/reportsStore.js'

const reportsStore = useReportsStore()
const orders = computed(() => reportsStore.orders)

/* ── 日期選擇 ── */
const DATE_OPTS = [
  { key: 'today',     label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: 'week',      label: '本週' },
  { key: 'month',     label: '本月' },
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

/* ── 指標計算 ── */
const totalRevenue   = computed(() => orders.value.reduce((s, o) => s + (o.total ?? 0), 0))
const avgOrderValue  = computed(() => orders.value.length ? Math.round(totalRevenue.value / orders.value.length) : 0)
const takeoutOrders  = computed(() => orders.value.filter(o => o.orderType === 'takeout'))
const deliveryOrders = computed(() => orders.value.filter(o => o.orderType === 'delivery'))
const dineInOrders   = computed(() => orders.value.filter(o => o.orderType === 'dine-in'))
const takeoutCount   = computed(() => takeoutOrders.value.length)
const deliveryCount  = computed(() => deliveryOrders.value.length)
const dineInCount    = computed(() => dineInOrders.value.length)
const takeoutRevenue  = computed(() => takeoutOrders.value.reduce((s, o) => s + (o.total ?? 0), 0))
const deliveryRevenue = computed(() => deliveryOrders.value.reduce((s, o) => s + (o.total ?? 0), 0))
const dineInRevenue   = computed(() => dineInOrders.value.reduce((s, o) => s + (o.total ?? 0), 0))
const takeoutPct  = computed(() => totalRevenue.value ? Math.round(takeoutRevenue.value  / totalRevenue.value * 100) : 0)
const dineInPct   = computed(() => totalRevenue.value ? Math.round(dineInRevenue.value   / totalRevenue.value * 100) : 0)
const deliveryPct = computed(() => totalRevenue.value ? Math.max(0, 100 - takeoutPct.value - dineInPct.value) : 0)

/* ── 每日長條圖資料 ── */
const chartData = computed(() => {
  const cur = new Date(customStart.value + 'T00:00:00')
  const fin = new Date(customEnd.value   + 'T00:00:00')
  const dayMap = {}
  for (const o of orders.value) {
    const key = new Date(o.completed_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    dayMap[key] = (dayMap[key] ?? 0) + (o.total ?? 0)
  }
  const result = []
  while (cur <= fin) {
    const key   = cur.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    const label = `${String(cur.getMonth()+1).padStart(2,'0')}/${String(cur.getDate()).padStart(2,'0')}`
    result.push({ key, label, total: dayMap[key] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
})

const maxTotal = computed(() => Math.max(...chartData.value.map(d => d.total), 1))

/* ── SVG 尺寸 ── */
const svgW    = computed(() => Math.max(chartData.value.length * 80, 480))
const svgH    = 200
const PAD_L   = 36
const PAD_R   = 8
const PAD_T   = 20
const PAD_B   = 18
const innerH  = computed(() => svgH - PAD_T - PAD_B)
const barStep = computed(() => (svgW.value - PAD_L - PAD_R) / Math.max(chartData.value.length, 1))
const barGap  = computed(() => barStep.value * 0.25)
const barW    = computed(() => Math.min(barStep.value - barGap.value * 2, 36))

function yPos(val) {
  return PAD_T + innerH.value * (1 - val / maxTotal.value)
}

const yTicks = computed(() => {
  const max = maxTotal.value
  if (max <= 0) return [0]
  const step = Math.ceil(max / 4 / 100) * 100 || 100
  return [0, step, step * 2, step * 3, step * 4].filter(t => t <= max + step)
})

/* ── 格式化數字 ── */
function fmtNum(n)   { return Math.round(n).toLocaleString('zh-TW') }
function fmtShort(n) {
  if (n >= 10000) return `${(n/1000).toFixed(0)}k`
  if (n >= 1000)  return `${(n/1000).toFixed(1)}k`
  return String(Math.round(n))
}
</script>

<style scoped>
.ro {
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ── 日期列 ── */
.ro__datebar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ro__date-btns {
  display: flex;
  gap: 4px;
}

.ro__date-btn {
  padding: 5px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-secondary);
  background: #fff;
  border: 1px solid var(--color-border-btn);
  transition: all 0.12s;
}

.ro__date-btn--active {
  background: #e8a038;
  color: #fff;
  border-color: #e8a038;
  font-weight: 500;
}

.ro__date-custom {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ro__date-input {
  padding: 4px 8px;
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  background: #fff;
  outline: none;
}

.ro__date-input:focus { border-color: #e8a038; }

.ro__date-sep { font-size: 13px; color: var(--color-text-muted); }

.ro__loading { font-size: 12px; color: var(--color-text-muted); }

/* ── 指標卡片 ── */
.ro__kpis {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
}

.ro__kpi {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.ro__kpi-label {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-bottom: 4px;
}

.ro__kpi-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
}

.ro__kpi-sub {
  font-size: 11.5px;
  color: var(--color-text-muted);
  margin-top: 2px;
}

/* ── 長條圖 ── */
.ro__chart-card {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 14px 16px;
}

.ro__chart-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 10px;
}

.ro__chart-empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 40px 0;
}

.ro__chart-wrap {
  overflow-x: auto;
  width: 100%;
}

.ro__chart-svg {
  display: block;
  width: 100%;
  height: 200px;
}

/* ── 比例條 ── */
.ro__type-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ro__type-bar-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  color: var(--color-text-secondary);
  white-space: nowrap;
  min-width: 110px;
}

.ro__type-dot {
  width: 9px; height: 9px; border-radius: 50%;
}

.ro__type-dot--takeout  { background: #e8a038; }
.ro__type-dot--dinein   { background: #5a7a3a; }
.ro__type-dot--delivery { background: #06c167; }

.ro__type-pct {
  color: var(--color-text-muted);
  font-size: 11px;
}

.ro__type-track {
  flex: 1;
  height: 10px;
  border-radius: 999px;
  background: #f0e8d8;
  overflow: hidden;
  display: flex;
}

.ro__type-fill--takeout  { background: #e8a038; transition: width 0.4s; }
.ro__type-fill--dinein   { background: #5a7a3a; transition: width 0.4s; }
.ro__type-fill--delivery { background: #06c167; transition: width 0.4s; }
</style>