<template>
  <div class="ca">

    <!-- 日期選擇列 -->
    <div class="ca__datebar">
      <div class="ca__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="ca__date-btn" :class="{ 'ca__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">
          {{ opt.label }}
        </button>
      </div>
      <div class="ca__date-custom">
        <input type="date" class="ca__date-input" v-model="customStart" @change="applyCustom" />
        <span class="ca__date-sep">～</span>
        <input type="date" class="ca__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <span v-if="reportsStore.loading" class="ca__loading">載入中...</span>
    </div>

    <!-- KPI 卡片 -->
    <div class="ca__kpis">
      <div class="ca__kpi">
        <p class="ca__kpi-label">總來客數</p>
        <p class="ca__kpi-value">{{ fmtNum(orders.length) }}</p>
        <p class="ca__kpi-sub">{{ dateRangeLabel }}</p>
      </div>
      <div class="ca__kpi">
        <p class="ca__kpi-label">日均來客</p>
        <p class="ca__kpi-value">{{ avgPerDay }}</p>
        <p class="ca__kpi-sub">筆 / 天</p>
      </div>
      <div class="ca__kpi">
        <p class="ca__kpi-label">尖峰時段</p>
        <p class="ca__kpi-value">{{ peakHour }}</p>
        <p class="ca__kpi-sub">{{ peakHourCount }} 筆訂單</p>
      </div>
      <div class="ca__kpi">
        <p class="ca__kpi-label">最忙星期</p>
        <p class="ca__kpi-value">{{ peakDow }}</p>
        <p class="ca__kpi-sub">{{ peakDowCount }} 筆訂單</p>
      </div>
      <div class="ca__kpi">
        <p class="ca__kpi-label">平均客單</p>
        <p class="ca__kpi-value">${{ fmtNum(avgTotal) }}</p>
        <p class="ca__kpi-sub">每筆平均</p>
      </div>
    </div>

    <div v-if="orders.length === 0" class="ca__empty">此期間無訂單資料</div>

    <template v-else>

      <!-- 時段分布（24 小時） -->
      <div class="ca__card">
        <div class="ca__card-title">時段來客分布</div>
        <div class="ca__chart-wrap">
          <svg class="ca__chart-svg" viewBox="0 0 720 160" preserveAspectRatio="none">
            <!-- 格線 -->
            <line v-for="tick in hourYTicks" :key="tick"
              x1="36" :y1="hourYPos(tick)" x2="714" :y2="hourYPos(tick)"
              stroke="#ede5d0" stroke-width="1" />
            <!-- 柱子 -->
            <g v-for="(item, i) in hourData" :key="i">
              <rect
                :x="36 + i * 28.25 + 3"
                :y="hourYPos(item.count)"
                :width="22"
                :height="122 - 122 * (1 - item.count / maxHourCount)"
                :fill="item.count === maxHourCount ? '#e8a038' : '#f0d0a0'"
                rx="2" />
              <!-- 時間標籤（每 3 小時顯一次） -->
              <text v-if="i % 3 === 0"
                :x="36 + i * 28.25 + 14"
                y="155"
                text-anchor="middle" font-size="8.5" fill="#9a8868">
                {{ item.label }}
              </text>
            </g>
            <!-- Y 刻度 -->
            <text v-for="tick in hourYTicks" :key="'l'+tick"
              x="33" :y="hourYPos(tick) + 3"
              text-anchor="end" font-size="8" fill="#9a8868">
              {{ tick }}
            </text>
          </svg>
        </div>
        <div class="ca__chart-note">橘色為尖峰時段</div>
      </div>

      <!-- 星期分布 -->
      <div class="ca__card">
        <div class="ca__card-title">星期來客分布</div>
        <div class="ca__dow-bars">
          <div v-for="item in dowData" :key="item.label" class="ca__dow-row">
            <span class="ca__dow-label">{{ item.label }}</span>
            <div class="ca__dow-track">
              <div class="ca__dow-fill"
                :class="{ 'ca__dow-fill--peak': item.count === maxDowCount }"
                :style="{ width: maxDowCount > 0 ? (item.count / maxDowCount * 100) + '%' : '0%' }" />
            </div>
            <span class="ca__dow-count">{{ item.count }} 筆</span>
            <span class="ca__dow-rev">${{ fmtNum(item.revenue) }}</span>
          </div>
        </div>
      </div>

      <!-- 訂單類型 × 時段熱力行 -->
      <div class="ca__card">
        <div class="ca__card-title">訂單類型分布</div>
        <div class="ca__type-rows">
          <div v-for="row in typeRows" :key="row.typeKey" class="ca__type-row">
            <span class="ca__type-badge" :class="`ca__type-badge--${row.typeKey}`">{{ row.label }}</span>
            <div class="ca__type-track">
              <div class="ca__type-fill" :class="`ca__type-fill--${row.typeKey}`"
                :style="{ width: orders.length > 0 ? (row.count / orders.length * 100) + '%' : '0%' }" />
            </div>
            <span class="ca__type-count">{{ row.count }} 筆 ({{ row.pct }}%)</span>
            <span class="ca__type-rev">${{ fmtNum(row.revenue) }}</span>
            <span class="ca__type-avg">均 ${{ fmtNum(row.avg) }}</span>
          </div>
        </div>
      </div>

      <!-- 每日來客長條圖 -->
      <div class="ca__card">
        <div class="ca__card-title">每日來客數</div>
        <div class="ca__chart-wrap">
          <svg class="ca__chart-svg" :viewBox="`0 0 ${svgW} 160`" preserveAspectRatio="none">
            <line v-for="tick in dayYTicks" :key="tick"
              :x1="36" :y1="dayYPos(tick)" :x2="svgW - 8" :y2="dayYPos(tick)"
              stroke="#ede5d0" stroke-width="1" />
            <g v-for="(item, i) in dayData" :key="i">
              <rect
                :x="36 + i * barStep + barGap"
                :y="dayYPos(item.count)"
                :width="barW"
                :height="122 - 122 * (1 - item.count / maxDayCount)"
                :fill="item.count > 0 ? '#7db8e8' : '#e0ecf8'"
                rx="2" />
              <text v-if="item.count > 0"
                :x="36 + i * barStep + barGap + barW / 2"
                :y="dayYPos(item.count) - 3"
                text-anchor="middle" font-size="9" fill="#3a6080">
                {{ item.count }}
              </text>
              <text
                :x="36 + i * barStep + barGap + barW / 2"
                y="158"
                text-anchor="middle" font-size="9" fill="#9a8868">
                {{ item.label }}
              </text>
            </g>
            <text v-for="tick in dayYTicks" :key="'l'+tick"
              x="33" :y="dayYPos(tick) + 3"
              text-anchor="end" font-size="8" fill="#9a8868">
              {{ tick }}
            </text>
          </svg>
        </div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReportsStore } from '@/stores/reportsStore.js'

const reportsStore = useReportsStore()
// 排除「稍後付款」的未收款訂單，消費金額只算真的收到錢的
const orders = computed(() => reportsStore.paidOrders)

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

/* ── KPI ── */
const dateRangeLabel = computed(() =>
  customStart.value === customEnd.value ? customStart.value : `${customStart.value} ~ ${customEnd.value}`
)
const dayCount   = computed(() => {
  if (!customStart.value || !customEnd.value) return 1
  const diff = (new Date(customEnd.value) - new Date(customStart.value)) / 86400000
  return Math.max(diff + 1, 1)
})
const avgPerDay  = computed(() => Math.round(orders.value.length / dayCount.value))
const totalAmt   = computed(() => orders.value.reduce((s, o) => s + (o.total ?? 0), 0))
const avgTotal   = computed(() => orders.value.length > 0 ? Math.round(totalAmt.value / orders.value.length) : 0)

/* ── 時段分布 ── */
const hourData = computed(() => {
  const counts = Array(24).fill(0)
  for (const o of orders.value) {
    const h = new Date(o.completed_at).toLocaleString('en-US', { timeZone: 'Asia/Taipei', hour: 'numeric', hour12: false })
    const hr = parseInt(h) % 24
    counts[hr]++
  }
  return counts.map((count, i) => ({ label: `${i}:00`, count }))
})
const maxHourCount = computed(() => Math.max(...hourData.value.map(d => d.count), 1))
const peakHour     = computed(() => {
  const peak = hourData.value.reduce((best, d) => d.count > best.count ? d : best, { label: '-', count: 0 })
  return peak.label
})
const peakHourCount = computed(() => hourData.value.reduce((best, d) => d.count > best ? d.count : best, 0))

function hourYPos(val) { return 18 + 122 * (1 - val / maxHourCount.value) }
const hourYTicks = computed(() => {
  const max = maxHourCount.value
  if (max <= 0) return [0]
  const step = Math.ceil(max / 3) || 1
  return [0, step, step * 2, step * 3].filter(t => t <= max + 1)
})

/* ── 星期分布 ── */
const DOW_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const dowData = computed(() => {
  const counts   = Array(7).fill(0)
  const revenues = Array(7).fill(0)
  for (const o of orders.value) {
    const d = new Date(o.completed_at).toLocaleString('en-US', { timeZone: 'Asia/Taipei', weekday: 'short' })
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(d)
    if (dow >= 0) { counts[dow]++; revenues[dow] += (o.total ?? 0) }
  }
  return DOW_LABELS.map((label, i) => ({ label, count: counts[i], revenue: revenues[i] }))
})
const maxDowCount = computed(() => Math.max(...dowData.value.map(d => d.count), 1))
const peakDow     = computed(() => {
  const peak = dowData.value.reduce((best, d) => d.count > best.count ? d : best, { label: '-', count: 0 })
  return `週${peak.label}`
})
const peakDowCount = computed(() => Math.max(...dowData.value.map(d => d.count), 0))

/* ── 訂單類型 ── */
const typeRows = computed(() => {
  const types = [
    { typeKey: 'takeout',  label: '外帶' },
    { typeKey: 'dine-in',  label: '內用' },
    { typeKey: 'delivery', label: '外送' },
  ]
  return types.map(t => {
    const list = orders.value.filter(o => o.orderType === t.typeKey)
    const revenue = list.reduce((s, o) => s + (o.total ?? 0), 0)
    const pct = orders.value.length > 0 ? Math.round(list.length / orders.value.length * 100) : 0
    return { ...t, count: list.length, revenue, pct, avg: list.length > 0 ? Math.round(revenue / list.length) : 0 }
  })
})

/* ── 每日來客 ── */
const dayData = computed(() => {
  const cur = new Date(customStart.value + 'T00:00:00')
  const fin = new Date(customEnd.value   + 'T00:00:00')
  const dayMap = {}
  for (const o of orders.value) {
    const key = new Date(o.completed_at).toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    dayMap[key] = (dayMap[key] ?? 0) + 1
  }
  const result = []
  while (cur <= fin) {
    const key   = cur.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })
    const label = `${String(cur.getMonth()+1).padStart(2,'0')}/${String(cur.getDate()).padStart(2,'0')}`
    result.push({ key, label, count: dayMap[key] ?? 0 })
    cur.setDate(cur.getDate() + 1)
  }
  return result
})
const maxDayCount = computed(() => Math.max(...dayData.value.map(d => d.count), 1))
const svgW    = computed(() => Math.max(dayData.value.length * 80, 480))
const barStep = computed(() => (svgW.value - 44) / Math.max(dayData.value.length, 1))
const barGap  = computed(() => barStep.value * 0.25)
const barW    = computed(() => Math.min(barStep.value - barGap.value * 2, 36))
function dayYPos(val) { return 18 + 122 * (1 - val / maxDayCount.value) }
const dayYTicks = computed(() => {
  const max = maxDayCount.value
  if (max <= 0) return [0]
  const step = Math.ceil(max / 3) || 1
  return [0, step, step * 2, step * 3].filter(t => t <= max + 1)
})

function fmtNum(n) { return Math.round(n ?? 0).toLocaleString('zh-TW') }
</script>

<style scoped>
.ca { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

/* 日期列 */
.ca__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ca__date-btns { display: flex; gap: 4px; }
.ca__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); transition: all 0.12s; }
.ca__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.ca__date-custom { display: flex; align-items: center; gap: 6px; }
.ca__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.ca__date-input:focus { border-color: #e8a038; }
.ca__date-sep { font-size: 13px; color: var(--color-text-muted); }
.ca__loading { font-size: 12px; color: var(--color-text-muted); }

/* KPI */
.ca__kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.ca__kpi { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.ca__kpi-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
.ca__kpi-value { font-size: 22px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.ca__kpi-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; }

/* 卡片 */
.ca__card { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.ca__card-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
.ca__chart-wrap { overflow-x: auto; width: 100%; }
.ca__chart-svg { display: block; width: 100%; height: 160px; }
.ca__chart-note { font-size: 11.5px; color: var(--color-text-muted); text-align: right; }

/* 星期 */
.ca__dow-bars { display: flex; flex-direction: column; gap: 7px; }
.ca__dow-row { display: flex; align-items: center; gap: 10px; }
.ca__dow-label { width: 24px; font-size: 13px; font-weight: 500; color: var(--color-text-secondary); text-align: center; }
.ca__dow-track { flex: 1; height: 14px; background: #f5f0e8; border-radius: 999px; overflow: hidden; }
.ca__dow-fill { height: 100%; background: #c8d8e8; border-radius: 999px; transition: width 0.4s; }
.ca__dow-fill--peak { background: #e8a038; }
.ca__dow-count { width: 50px; text-align: right; font-size: 12.5px; color: var(--color-text-secondary); }
.ca__dow-rev   { width: 70px; text-align: right; font-size: 12.5px; color: var(--color-text-muted); }

/* 訂單類型 */
.ca__type-rows { display: flex; flex-direction: column; gap: 10px; }
.ca__type-row  { display: flex; align-items: center; gap: 10px; }
.ca__type-badge { font-size: 12px; font-weight: 500; padding: 3px 12px; border-radius: 999px; white-space: nowrap; }
.ca__type-badge--takeout  { background: #fde8c0; color: #8a6020; }
.ca__type-badge--dine-in  { background: #d8eed0; color: #2a6030; }
.ca__type-badge--delivery { background: #d0f0e0; color: #1a6035; }
.ca__type-track { flex: 1; height: 12px; background: #f5f0e8; border-radius: 999px; overflow: hidden; }
.ca__type-fill { height: 100%; border-radius: 999px; transition: width 0.4s; }
.ca__type-fill--takeout  { background: #e8a038; }
.ca__type-fill--dine-in  { background: #5a9a40; }
.ca__type-fill--delivery { background: #06c167; }
.ca__type-count { width: 80px; text-align: right; font-size: 12.5px; color: var(--color-text-secondary); }
.ca__type-rev   { width: 70px; text-align: right; font-size: 12.5px; color: var(--color-text-muted); }
.ca__type-avg   { width: 60px; text-align: right; font-size: 11.5px; color: var(--color-text-muted); }

.ca__empty { text-align: center; color: var(--color-text-muted); padding: 60px; font-size: 14px; }
</style>