<template>
  <div class="pa">

    <!-- 日期選擇列 -->
    <div class="pa__datebar">
      <div class="pa__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="pa__date-btn" :class="{ 'pa__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">{{ opt.label }}</button>
      </div>
      <div class="pa__date-custom">
        <input type="date" class="pa__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="pa__date-input" v-model="customEnd"   @change="applyCustom" />
      </div>
      <span v-if="reportsStore.loading" class="pa__loading">載入中...</span>
    </div>

    <!-- 指標卡片 -->
    <div class="pa__kpis">
      <div class="pa__kpi">
        <p class="pa__kpi-label">品項種類</p>
        <p class="pa__kpi-value">{{ products.length }}<span class="pa__kpi-unit">種</span></p>
      </div>
      <div class="pa__kpi">
        <p class="pa__kpi-label">總銷售數量</p>
        <p class="pa__kpi-value">{{ totalQty }}<span class="pa__kpi-unit">份</span></p>
      </div>
      <div class="pa__kpi">
        <p class="pa__kpi-label">熱銷冠軍</p>
        <p class="pa__kpi-value pa__kpi-value--name">{{ topByQty?.name || '—' }}</p>
        <p class="pa__kpi-sub">{{ topByQty?.qty ?? 0 }} 份</p>
      </div>
      <div class="pa__kpi">
        <p class="pa__kpi-label">最高營收品項</p>
        <p class="pa__kpi-value pa__kpi-value--name">{{ topByRevenue?.name || '—' }}</p>
        <p class="pa__kpi-sub">${{ fmtNum(topByRevenue?.revenue ?? 0) }}</p>
      </div>
    </div>

    <!-- 熱銷排行橫條圖 -->
    <div class="pa__chart-card">
      <div class="pa__card-title">
        熱銷商品排行（前10）
        <div class="pa__sort-toggle">
          <button :class="{ active: sortBy === 'revenue' }" @click="sortBy = 'revenue'">依金額</button>
          <button :class="{ active: sortBy === 'qty' }"     @click="sortBy = 'qty'">依數量</button>
        </div>
      </div>
      <div v-if="reportsStore.paidOrders.length === 0" class="pa__empty">此期間無訂單資料</div>
      <div v-else-if="top10.length === 0"          class="pa__empty">無商品銷售資料</div>
      <div v-else class="pa__bars">
        <div v-for="(item, i) in top10" :key="item.name" class="pa__bar-row">
          <span class="pa__rank">{{ i + 1 }}</span>
          <span class="pa__item-name">{{ item.name }}</span>
          <div class="pa__bar-track">
            <div class="pa__bar-fill"
              :style="{ width: (barValue(item) / maxBarValue * 100) + '%' }" />
          </div>
          <span class="pa__bar-rev">${{ fmtNum(item.revenue) }}</span>
          <span class="pa__bar-qty">{{ item.qty }}份</span>
        </div>
      </div>
    </div>

    <!-- 完整品項表格 -->
    <div class="pa__table-card">
      <div class="pa__card-title">完整商品銷售明細</div>
      <div class="pa__table-wrap">
        <table class="pa__table">
          <thead>
            <tr>
              <th>排名</th>
              <th class="pa__th--left">品名</th>
              <th class="pa__th--num" @click="toggleSort('orderCount')" style="cursor:pointer">
                訂購筆數 {{ sortCol === 'orderCount' ? (sortDir > 0 ? '↓' : '↑') : '' }}
              </th>
              <th class="pa__th--num" @click="toggleSort('qty')" style="cursor:pointer">
                數量 {{ sortCol === 'qty' ? (sortDir > 0 ? '↓' : '↑') : '' }}
              </th>
              <th class="pa__th--num" @click="toggleSort('revenue')" style="cursor:pointer">
                銷售額 {{ sortCol === 'revenue' ? (sortDir > 0 ? '↓' : '↑') : '' }}
              </th>
              <th class="pa__th--num">佔比</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="products.length === 0">
              <td colspan="6" class="pa__empty">無資料</td>
            </tr>
            <tr v-for="(item, i) in sortedProducts" :key="item.name" class="pa__tr">
              <td class="pa__td-rank">{{ i + 1 }}</td>
              <td>{{ item.name }}</td>
              <td class="pa__td-num">{{ item.orderCount }}</td>
              <td class="pa__td-num">{{ item.qty }}</td>
              <td class="pa__td-num">${{ fmtNum(item.revenue) }}</td>
              <td class="pa__td-num">{{ pct(item.revenue) }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReportsStore } from '@/stores/reportsStore.js'

const reportsStore = useReportsStore()

/* ── 日期 ── */
const DATE_OPTS = [
  { key: 'today', label: '今日' }, { key: 'yesterday', label: '昨日' },
  { key: 'week',  label: '本週' }, { key: 'month',     label: '本月' },
]
const preset = ref('today')
const customStart = ref(todayStr())
const customEnd   = ref(todayStr())

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function offsetDay(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function applyPreset(key) {
  preset.value = key
  const today = todayStr()
  if (key === 'today')     { customStart.value = today; customEnd.value = today }
  if (key === 'yesterday') { const y = offsetDay(-1); customStart.value = y; customEnd.value = y }
  if (key === 'week')  { customStart.value = offsetDay(1 - (new Date().getDay() || 7)); customEnd.value = today }
  if (key === 'month') { const d = new Date(); customStart.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; customEnd.value = today }
  reportsStore.fetchOrders(customStart.value, customEnd.value)
}

function applyCustom() { preset.value = ''; reportsStore.fetchOrders(customStart.value, customEnd.value) }

onMounted(() => applyPreset('today'))

/* ── 商品彙總 ── */
const products = computed(() => {
  const map = {}
  // 排除「稍後付款」的未收款訂單，商品銷售額只算真的收到錢的
  for (const order of reportsStore.paidOrders) {
    for (const item of order.items ?? []) {
      if (!item.name) continue
      if (!map[item.name]) map[item.name] = { name: item.name, orderCount: 0, qty: 0, revenue: 0 }
      map[item.name].orderCount += 1
      map[item.name].qty        += (item.qty ?? 1)
      map[item.name].revenue    += (item.price ?? 0) * (item.qty ?? 1)
    }
  }
  return Object.values(map)
})

const totalRevenue = computed(() => products.value.reduce((s, p) => s + p.revenue, 0))
const totalQty     = computed(() => products.value.reduce((s, p) => s + p.qty,     0))
const topByQty     = computed(() => [...products.value].sort((a,b) => b.qty     - a.qty)[0])
const topByRevenue = computed(() => [...products.value].sort((a,b) => b.revenue - a.revenue)[0])

/* ── 排行榜 ── */
const sortBy = ref('revenue')  // 'revenue' | 'qty'

const top10 = computed(() =>
  [...products.value].sort((a,b) => b[sortBy.value] - a[sortBy.value]).slice(0, 10)
)

const maxBarValue = computed(() => Math.max(...top10.value.map(p => barValue(p)), 1))

function barValue(item) { return sortBy.value === 'revenue' ? item.revenue : item.qty }

/* ── 表格排序 ── */
const sortCol = ref('revenue')
const sortDir = ref(1)  // 1=desc, -1=asc

function toggleSort(col) {
  if (sortCol.value === col) sortDir.value *= -1
  else { sortCol.value = col; sortDir.value = 1 }
}

const sortedProducts = computed(() =>
  [...products.value].sort((a,b) => sortDir.value * (b[sortCol.value] - a[sortCol.value]))
)

/* ── 格式化 ── */
function fmtNum(n) { return Math.round(n ?? 0).toLocaleString('zh-TW') }
function pct(rev)  { return totalRevenue.value ? (rev / totalRevenue.value * 100).toFixed(1) : '0.0' }
</script>

<style scoped>
.pa { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

/* 日期列 */
.pa__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pa__date-btns { display: flex; gap: 4px; }
.pa__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); transition: all 0.12s; }
.pa__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.pa__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.pa__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.pa__date-input:focus { border-color: #e8a038; }
.pa__loading { font-size: 12px; color: var(--color-text-muted); }

/* 指標 */
.pa__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.pa__kpi { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.pa__kpi-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
.pa__kpi-value { font-size: 22px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.pa__kpi-value--name { font-size: 16px; }
.pa__kpi-unit { font-size: 13px; font-weight: 400; margin-left: 3px; }
.pa__kpi-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; }

/* 卡片共用 */
.pa__chart-card, .pa__table-card {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 14px 16px;
}
.pa__card-title {
  font-size: 13px; font-weight: 500; color: var(--color-text-primary);
  margin-bottom: 14px; display: flex; align-items: center; gap: 10px;
}
.pa__empty { text-align: center; color: var(--color-text-muted); font-size: 13px; padding: 30px 0; }

/* 排行榜切換 */
.pa__sort-toggle { display: flex; gap: 4px; margin-left: auto; }
.pa__sort-toggle button {
  padding: 3px 10px; border-radius: var(--radius-sm); font-size: 12px;
  color: var(--color-text-secondary); background: #f0e8d8;
  border: 1px solid var(--color-border-btn);
}
.pa__sort-toggle button.active { background: #e8a038; color: #fff; border-color: #e8a038; }

/* 橫條圖 */
.pa__bars { display: flex; flex-direction: column; gap: 8px; }
.pa__bar-row { display: grid; grid-template-columns: 22px 130px 1fr 70px 52px; align-items: center; gap: 8px; }
.pa__rank { font-size: 11px; color: var(--color-text-muted); text-align: center; font-weight: 600; }
.pa__item-name { font-size: 13px; color: var(--color-text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pa__bar-track { height: 14px; background: #f0e8d8; border-radius: 999px; overflow: hidden; }
.pa__bar-fill { height: 100%; background: #e8a038; border-radius: 999px; transition: width 0.4s; }
.pa__bar-rev { font-size: 12.5px; font-weight: 500; color: var(--color-text-primary); text-align: right; }
.pa__bar-qty { font-size: 11.5px; color: var(--color-text-muted); }

/* 表格 */
.pa__table-wrap { overflow: auto; max-height: 340px; }
.pa__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.pa__table th {
  text-align: right; padding: 8px 10px; font-size: 12px; font-weight: 500;
  color: var(--color-text-muted); background: #faf5ec; border-bottom: 1px solid #ede5d0;
  position: sticky; top: 0; z-index: 1; user-select: none;
}
.pa__th--left { text-align: left; }
.pa__th--num  { text-align: right; }
.pa__tr:hover { background: #faf5ec; }
.pa__tr td { padding: 8px 10px; border-bottom: 1px solid #f5f0e8; color: var(--color-text-primary); }
.pa__td-rank { text-align: center; color: var(--color-text-muted); font-size: 12px; }
.pa__td-num  { text-align: right; }
</style>