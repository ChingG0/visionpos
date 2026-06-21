<template>
  <div class="da">

    <!-- 日期選擇列 -->
    <div class="da__datebar">
      <div class="da__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="da__date-btn" :class="{ 'da__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">
          {{ opt.label }}
        </button>
      </div>
      <div class="da__date-custom">
        <input type="date" class="da__date-input" v-model="customStart" @change="applyCustom" />
        <span class="da__date-sep">～</span>
        <input type="date" class="da__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <span v-if="reportsStore.loading" class="da__loading">載入中...</span>
    </div>

    <!-- KPI 卡片 -->
    <div class="da__kpis">
      <div class="da__kpi da__kpi--discount">
        <p class="da__kpi-label">總折扣金額</p>
        <p class="da__kpi-value">${{ fmtNum(totalDiscount) }}</p>
        <p class="da__kpi-sub">{{ discountedOrders.length }} 筆訂單有折扣</p>
      </div>
      <div class="da__kpi">
        <p class="da__kpi-label">折扣率</p>
        <p class="da__kpi-value">{{ discountRate }}%</p>
        <p class="da__kpi-sub">折扣額 / 小計</p>
      </div>
      <div class="da__kpi">
        <p class="da__kpi-label">平均每筆折扣</p>
        <p class="da__kpi-value">${{ fmtNum(avgDiscount) }}</p>
        <p class="da__kpi-sub">有折扣訂單平均</p>
      </div>
      <div class="da__kpi da__kpi--surcharge">
        <p class="da__kpi-label">總附加費</p>
        <p class="da__kpi-value">${{ fmtNum(totalSurcharge) }}</p>
        <p class="da__kpi-sub">{{ surchargeOrders.length }} 筆訂單有附加</p>
      </div>
      <div class="da__kpi">
        <p class="da__kpi-label">淨影響金額</p>
        <p class="da__kpi-value" :class="netImpact >= 0 ? 'da__kpi-value--pos' : 'da__kpi-value--neg'">
          {{ netImpact >= 0 ? '+' : '' }}${{ fmtNum(Math.abs(netImpact)) }}
        </p>
        <p class="da__kpi-sub">附加費 − 折扣</p>
      </div>
    </div>

    <div v-if="orders.length === 0" class="da__empty">此期間無訂單資料</div>

    <template v-else>

      <!-- 折扣有無比例 -->
      <div class="da__card">
        <div class="da__card-title">折扣訂單比例</div>
        <div class="da__pct-row">
          <div class="da__pct-label">
            <span class="da__dot da__dot--discount" />
            有折扣
            <strong>{{ discountedOrders.length }} 筆</strong>
            <span class="da__pct-text">{{ discountedPct }}%</span>
          </div>
          <div class="da__pct-track">
            <div class="da__pct-fill da__pct-fill--discount" :style="{ width: discountedPct + '%' }" />
            <div class="da__pct-fill da__pct-fill--none"     :style="{ width: (100 - discountedPct) + '%' }" />
          </div>
          <div class="da__pct-label">
            <span class="da__dot da__dot--none" />
            無折扣
            <strong>{{ noDiscountOrders.length }} 筆</strong>
            <span class="da__pct-text">{{ 100 - discountedPct }}%</span>
          </div>
        </div>
      </div>

      <!-- 折扣類型來源（依訂單類型） -->
      <div class="da__card">
        <div class="da__card-title">各類型折扣分布</div>
        <div class="da__type-table">
          <div class="da__type-row da__type-row--header">
            <span>類型</span><span>折扣筆數</span><span>折扣總額</span><span>平均折扣</span><span>附加費總額</span>
          </div>
          <div v-for="row in typeDiscountRows" :key="row.type" class="da__type-row">
            <span class="da__type-badge" :class="`da__type-badge--${row.typeKey}`">{{ row.type }}</span>
            <span>{{ row.count }} 筆</span>
            <span class="da__amount">${{ fmtNum(row.discount) }}</span>
            <span>${{ fmtNum(row.avg) }}</span>
            <span class="da__surcharge">${{ fmtNum(row.surcharge) }}</span>
          </div>
        </div>
      </div>

      <!-- 每日折扣趨勢 -->
      <div class="da__card">
        <div class="da__card-title">每日折扣金額</div>
        <div class="da__chart-wrap">
          <svg class="da__chart-svg" :viewBox="`0 0 ${svgW} ${svgH}`" preserveAspectRatio="none">
            <!-- 格線 -->
            <line v-for="tick in yTicks" :key="tick"
              :x1="PAD_L" :y1="yPos(tick)"
              :x2="svgW - PAD_R" :y2="yPos(tick)"
              stroke="#ede5d0" stroke-width="1" />
            <!-- 折扣柱（紅） -->
            <g v-for="(item, i) in chartData" :key="i">
              <rect
                v-if="item.discount > 0"
                :x="PAD_L + i * barStep + barGap"
                :y="yPos(item.discount)"
                :width="barW * 0.5"
                :height="innerH - innerH * (1 - item.discount / maxVal)"
                fill="#e85858" rx="2" />
              <!-- 附加費柱（綠） -->
              <rect
                v-if="item.surcharge > 0"
                :x="PAD_L + i * barStep + barGap + barW * 0.5"
                :y="yPos(item.surcharge)"
                :width="barW * 0.5"
                :height="innerH - innerH * (1 - item.surcharge / maxVal)"
                fill="#5a7a3a" rx="2" />
              <!-- X 軸 -->
              <text
                :x="PAD_L + i * barStep + barGap + barW / 2"
                :y="svgH - 2"
                text-anchor="middle" font-size="9" fill="#9a8868">
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
        <div class="da__legend">
          <span><span class="da__dot da__dot--discount" />折扣</span>
          <span><span class="da__dot da__dot--surcharge" />附加費</span>
        </div>
      </div>

    </template>
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
  const d = new Date(); d.setDate(d.getDate() + n)
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
    const d = new Date(); const dow = d.getDay() || 7
    customStart.value = offsetDay(1 - dow); customEnd.value = today
  }
  if (key === 'month') {
    const d = new Date()
    customStart.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    customEnd.value = today
  }
  reportsStore.fetchOrders(customStart.value, customEnd.value)
}
function applyCustom() { preset.value = ''; reportsStore.fetchOrders(customStart.value, customEnd.value) }
onMounted(() => applyPreset('today'))

/* ── 折扣統計 ── */
const discountedOrders  = computed(() => orders.value.filter(o => (o.discount ?? 0) > 0))
const noDiscountOrders  = computed(() => orders.value.filter(o => !((o.discount ?? 0) > 0)))
const surchargeOrders   = computed(() => orders.value.filter(o => (o.surcharge ?? 0) > 0))
const totalDiscount     = computed(() => orders.value.reduce((s, o) => s + (o.discount ?? 0), 0))
const totalSurcharge    = computed(() => orders.value.reduce((s, o) => s + (o.surcharge ?? 0), 0))
const totalSubtotal     = computed(() => orders.value.reduce((s, o) => s + (o.subtotal ?? 0), 0))
const netImpact         = computed(() => totalSurcharge.value - totalDiscount.value)
const discountRate      = computed(() => totalSubtotal.value > 0 ? (totalDiscount.value / totalSubtotal.value * 100).toFixed(1) : '0.0')
const avgDiscount       = computed(() => discountedOrders.value.length > 0 ? Math.round(totalDiscount.value / discountedOrders.value.length) : 0)
const discountedPct     = computed(() => orders.value.length > 0 ? Math.round(discountedOrders.value.length / orders.value.length * 100) : 0)

/* ── 各類型折扣 ── */
const typeDiscountRows = computed(() => {
  const types = [
    { typeKey: 'takeout',  type: '外帶',  orders: orders.value.filter(o => o.orderType === 'takeout')  },
    { typeKey: 'dine-in',  type: '內用',  orders: orders.value.filter(o => o.orderType === 'dine-in')  },
    { typeKey: 'delivery', type: '外送',  orders: orders.value.filter(o => o.orderType === 'delivery') },
  ]
  return types.map(t => {
    const withDiscount = t.orders.filter(o => (o.discount ?? 0) > 0)
    const discount  = t.orders.reduce((s, o) => s + (o.discount ?? 0), 0)
    const surcharge = t.orders.reduce((s, o) => s + (o.surcharge ?? 0), 0)
    return {
      typeKey: t.typeKey,
      type: t.type,
      count: withDiscount.length,
      discount,
      surcharge,
      avg: withDiscount.length > 0 ? Math.round(discount / withDiscount.length) : 0,
    }
  })
})

/* ── 每日圖表 ── */
const chartData = computed(() => {
  const cur = new Date(customStart.value + 'T00:00:00')
  const fin = new Date(customEnd.value   + 'T00:00:00')
  const dayMap = {}
  for (const o of orders.value) {
    const key = new Date(o.completed_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    if (!dayMap[key]) dayMap[key] = { discount: 0, surcharge: 0 }
    dayMap[key].discount  += (o.discount  ?? 0)
    dayMap[key].surcharge += (o.surcharge ?? 0)
  }
  const result = []
  while (cur <= fin) {
    const key   = cur.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    const label = `${String(cur.getMonth()+1).padStart(2,'0')}/${String(cur.getDate()).padStart(2,'0')}`
    result.push({ key, label, discount: dayMap[key]?.discount ?? 0, surcharge: dayMap[key]?.surcharge ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
})

const maxVal  = computed(() => Math.max(...chartData.value.flatMap(d => [d.discount, d.surcharge]), 1))
const svgW    = computed(() => Math.max(chartData.value.length * 80, 480))
const svgH    = 180
const PAD_L   = 36; const PAD_R = 8; const PAD_T = 20; const PAD_B = 18
const innerH  = computed(() => svgH - PAD_T - PAD_B)
const barStep = computed(() => (svgW.value - PAD_L - PAD_R) / Math.max(chartData.value.length, 1))
const barGap  = computed(() => barStep.value * 0.25)
const barW    = computed(() => Math.min(barStep.value - barGap.value * 2, 36))
function yPos(val) { return PAD_T + innerH.value * (1 - val / maxVal.value) }
const yTicks  = computed(() => {
  const max = maxVal.value
  if (max <= 0) return [0]
  const step = Math.ceil(max / 3 / 50) * 50 || 50
  return [0, step, step * 2, step * 3].filter(t => t <= max + step)
})

function fmtNum(n)   { return Math.round(n ?? 0).toLocaleString('zh-TW') }
function fmtShort(n) {
  if (n >= 10000) return `${(n/1000).toFixed(0)}k`
  if (n >= 1000)  return `${(n/1000).toFixed(1)}k`
  return String(Math.round(n))
}
</script>

<style scoped>
.da { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

/* 日期列 */
.da__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.da__date-btns { display: flex; gap: 4px; }
.da__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); transition: all 0.12s; }
.da__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.da__date-custom { display: flex; align-items: center; gap: 6px; }
.da__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.da__date-input:focus { border-color: #e8a038; }
.da__date-sep { font-size: 13px; color: var(--color-text-muted); }
.da__loading { font-size: 12px; color: var(--color-text-muted); }

/* KPI */
.da__kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.da__kpi { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.da__kpi--discount { border-left: 3px solid #e85858; }
.da__kpi--surcharge { border-left: 3px solid #5a7a3a; }
.da__kpi-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
.da__kpi-value { font-size: 22px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.da__kpi-value--pos { color: #5a7a3a; }
.da__kpi-value--neg { color: #e85858; }
.da__kpi-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; }

/* 卡片 */
.da__card { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.da__card-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }

/* 比例條 */
.da__pct-row { display: flex; align-items: center; gap: 12px; }
.da__pct-label { display: flex; align-items: center; gap: 5px; font-size: 12.5px; color: var(--color-text-secondary); white-space: nowrap; min-width: 120px; }
.da__pct-track { flex: 1; height: 10px; border-radius: 999px; overflow: hidden; display: flex; background: #f0e8d8; }
.da__pct-fill--discount { background: #e85858; transition: width 0.4s; }
.da__pct-fill--none     { background: #e0d8c8; transition: width 0.4s; }
.da__pct-text { font-size: 11.5px; color: var(--color-text-muted); }

/* 類型表格 */
.da__type-table { display: flex; flex-direction: column; gap: 0; }
.da__type-row { display: grid; grid-template-columns: 70px 80px 100px 100px 100px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #f5f0e8; font-size: 13px; color: var(--color-text-secondary); }
.da__type-row--header { font-size: 11.5px; color: var(--color-text-muted); padding: 4px 10px; background: #faf5ec; border-radius: 6px; }
.da__type-badge { font-size: 11.5px; font-weight: 500; padding: 2px 9px; border-radius: 999px; text-align: center; }
.da__type-badge--takeout  { background: #fde8c0; color: #8a6020; }
.da__type-badge--dine-in  { background: #d8eed0; color: #2a6030; }
.da__type-badge--delivery { background: #d0f0e0; color: #1a6035; }
.da__amount   { color: #e85858; font-weight: 600; }
.da__surcharge { color: #5a7a3a; font-weight: 600; }

/* 圖表 */
.da__chart-wrap { overflow-x: auto; width: 100%; }
.da__chart-svg { display: block; width: 100%; height: 180px; }
.da__legend { display: flex; gap: 16px; justify-content: flex-end; font-size: 12px; color: var(--color-text-muted); }
.da__legend span { display: flex; align-items: center; gap: 5px; }

/* 點 */
.da__dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.da__dot--discount  { background: #e85858; }
.da__dot--surcharge { background: #5a7a3a; }
.da__dot--none      { background: #e0d8c8; }

.da__empty { text-align: center; color: var(--color-text-muted); padding: 60px; font-size: 14px; }
</style>