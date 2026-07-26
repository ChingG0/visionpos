<template>
  <div class="ta">

    <!-- 日期選擇列 -->
    <div class="ta__datebar">
      <div class="ta__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="ta__date-btn" :class="{ 'ta__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">{{ opt.label }}</button>
      </div>
      <div class="ta__date-custom">
        <input type="date" class="ta__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="ta__date-input" v-model="customEnd"   @change="applyCustom" />
      </div>
      <span v-if="reportsStore.loading" class="ta__loading">載入中...</span>
    </div>

    <!-- 指標卡片 -->
    <div class="ta__kpis">
      <div class="ta__kpi">
        <p class="ta__kpi-label">外帶＋內用訂單總數</p>
        <p class="ta__kpi-value">{{ eligibleOrders.length }}<span class="ta__kpi-unit">筆</span></p>
      </div>
      <div class="ta__kpi">
        <p class="ta__kpi-label">有標籤的訂單</p>
        <p class="ta__kpi-value">{{ taggedOrders.length }}<span class="ta__kpi-unit">筆</span></p>
        <p class="ta__kpi-sub">{{ taggedPct }}%</p>
      </div>
      <div class="ta__kpi">
        <p class="ta__kpi-label">標籤使用總次數</p>
        <p class="ta__kpi-value">{{ totalTagUses }}<span class="ta__kpi-unit">次</span></p>
      </div>
      <div class="ta__kpi">
        <p class="ta__kpi-label">最常用標籤</p>
        <p class="ta__kpi-value ta__kpi-value--name">{{ topTag?.label || '—' }}</p>
        <p class="ta__kpi-sub">{{ topTag?.count ?? 0 }} 次</p>
      </div>
    </div>

    <!-- 標籤使用頻率橫條圖 -->
    <div class="ta__chart-card">
      <div class="ta__card-title">標籤使用頻率</div>
      <div v-if="taggedOrders.length === 0" class="ta__empty">
        此期間無帶有標籤的訂單
      </div>
      <div v-else class="ta__bars">
        <div v-for="tag in tagStats" :key="tag.label" class="ta__bar-row">
          <span class="ta__tag-pill" :style="{ background: colorOf(tag).bg, color: colorOf(tag).text }">
            {{ tag.label }}
          </span>
          <div class="ta__bar-track">
            <div class="ta__bar-fill"
              :style="{ width: (tag.count / maxTagCount * 100) + '%', background: colorOf(tag).text }" />
          </div>
          <span class="ta__bar-count">{{ tag.count }} 次</span>
          <span class="ta__bar-pct">{{ tagPct(tag.count) }}%</span>
        </div>
      </div>
    </div>

    <!-- 常見標籤組合 -->
    <div v-if="combos.length > 0" class="ta__combo-card">
      <div class="ta__card-title">常見標籤組合</div>
      <div class="ta__combos">
        <div v-for="combo in combos" :key="combo.key" class="ta__combo-row">
          <div class="ta__combo-tags">
            <span v-for="tag in combo.tags" :key="tag.label"
              class="ta__combo-tag"
              :style="{ background: colorOf(tag).bg, color: colorOf(tag).text }">
              {{ tag.label }}
            </span>
          </div>
          <span class="ta__combo-count">{{ combo.count }} 次</span>
        </div>
      </div>
    </div>

    <!-- 標籤細節表格 -->
    <div class="ta__table-card">
      <div class="ta__card-title">標籤明細</div>
      <p class="ta__note">※ 統計外帶、內用訂單的快速標籤；外送訂單標籤資料由 Uber Eats 提供，尚未整合</p>
      <table class="ta__table">
        <thead>
          <tr>
            <th>標籤</th>
            <th class="ta__th-num">使用次數</th>
            <th class="ta__th-num">佔有標籤訂單</th>
            <th class="ta__th-num">佔全部訂單</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="tagStats.length === 0">
            <td colspan="4" class="ta__empty">無資料</td>
          </tr>
          <tr v-for="tag in tagStats" :key="tag.label" class="ta__tr">
            <td>
              <span class="ta__tag-pill" :style="{ background: colorOf(tag).bg, color: colorOf(tag).text }">
                {{ tag.label }}
              </span>
            </td>
            <td class="ta__td-num">{{ tag.count }}</td>
            <td class="ta__td-num">
              {{ taggedOrders.length ? (tag.count / taggedOrders.length * 100).toFixed(1) : '0.0' }}%
            </td>
            <td class="ta__td-num">
              {{ eligibleOrders.length ? (tag.count / eligibleOrders.length * 100).toFixed(1) : '0.0' }}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReportsStore } from '@/stores/reportsStore.js'
import { TAG_COLOR_MAP }   from '@/constants/tagColors.js'

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

/* ── 資料計算 ── */
// 標籤功能目前只有外帶、內用會用到（外送標籤資料由 Uber Eats 提供，尚未整合進來）
// 排除「稍後付款」的未收款訂單，標籤金額統計只算真的收到錢的
const eligibleOrders = computed(() => reportsStore.paidOrders.filter(o => o.orderType === 'takeout' || o.orderType === 'dine-in'))
const taggedOrders   = computed(() => eligibleOrders.value.filter(o => o.tags?.length > 0))
const taggedPct      = computed(() =>
  eligibleOrders.value.length ? (taggedOrders.value.length / eligibleOrders.value.length * 100).toFixed(1) : '0.0'
)

const tagStats = computed(() => {
  const map = {}
  for (const order of taggedOrders.value) {
    for (const tag of order.tags) {
      if (!map[tag.label]) map[tag.label] = { label: tag.label, color: tag.color, count: 0 }
      map[tag.label].count++
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count)
})

const totalTagUses = computed(() => tagStats.value.reduce((s, t) => s + t.count, 0))
const topTag       = computed(() => tagStats.value[0] ?? null)
const maxTagCount  = computed(() => Math.max(...tagStats.value.map(t => t.count), 1))

function tagPct(count) {
  return totalTagUses.value ? (count / totalTagUses.value * 100).toFixed(1) : '0.0'
}

/* ── 標籤組合：同一張訂單上同時出現的多個標籤 ── */
const combos = computed(() => {
  const map = {}
  for (const order of taggedOrders.value) {
    if ((order.tags?.length ?? 0) < 2) continue
    const sorted = [...order.tags].sort((a,b) => a.label.localeCompare(b.label))
    const key    = sorted.map(t => t.label).join('＋')
    if (!map[key]) map[key] = { key, tags: sorted, count: 0 }
    map[key].count++
  }
  return Object.values(map).sort((a,b) => b.count - a.count).slice(0, 5)
})

/* ── 顏色 ── */
function colorOf(tag) { return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray }
</script>

<style scoped>
.ta { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

/* 日期列 */
.ta__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ta__date-btns { display: flex; gap: 4px; }
.ta__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); transition: all 0.12s; }
.ta__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.ta__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.ta__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.ta__date-input:focus { border-color: #e8a038; }
.ta__loading { font-size: 12px; color: var(--color-text-muted); }

/* 指標 */
.ta__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.ta__kpi { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.ta__kpi-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
.ta__kpi-value { font-size: 22px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.ta__kpi-value--name { font-size: 16px; }
.ta__kpi-unit { font-size: 13px; font-weight: 400; margin-left: 3px; }
.ta__kpi-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; }

/* 卡片共用 */
.ta__chart-card, .ta__combo-card, .ta__table-card {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 14px 16px;
}
.ta__card-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 14px; }
.ta__empty {
  text-align: center; color: var(--color-text-muted); font-size: 13px;
  padding: 24px 0; display: flex; flex-direction: column; align-items: center; gap: 6px;
}
.ta__empty-hint { font-size: 11.5px; color: var(--color-text-muted); }

/* 橫條圖 */
.ta__bars { display: flex; flex-direction: column; gap: 10px; }
.ta__bar-row { display: grid; grid-template-columns: 80px 1fr 60px 52px; align-items: center; gap: 10px; }
.ta__tag-pill { display: inline-block; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.ta__bar-track { height: 12px; background: #f0e8d8; border-radius: 999px; overflow: hidden; }
.ta__bar-fill { height: 100%; border-radius: 999px; opacity: 0.7; transition: width 0.4s; }
.ta__bar-count { font-size: 12.5px; font-weight: 500; color: var(--color-text-primary); text-align: right; }
.ta__bar-pct { font-size: 11.5px; color: var(--color-text-muted); }

/* 組合 */
.ta__combos { display: flex; flex-direction: column; gap: 8px; }
.ta__combo-row { display: flex; align-items: center; gap: 10px; }
.ta__combo-tags { display: flex; flex-wrap: wrap; gap: 5px; flex: 1; }
.ta__combo-tag { display: inline-block; font-size: 11.5px; font-weight: 500; padding: 2px 9px; border-radius: 999px; }
.ta__combo-count { font-size: 12.5px; color: var(--color-text-secondary); white-space: nowrap; }

/* 表格 */
.ta__note { font-size: 11.5px; color: var(--color-text-muted); margin-bottom: 10px; }
.ta__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ta__table th { text-align: left; padding: 8px 10px; font-size: 12px; font-weight: 500; color: var(--color-text-muted); background: #faf5ec; border-bottom: 1px solid #ede5d0; }
.ta__th-num { text-align: right; }
.ta__tr:hover { background: #faf5ec; }
.ta__tr td { padding: 8px 10px; border-bottom: 1px solid #f5f0e8; color: var(--color-text-primary); }
.ta__td-num { text-align: right; }
</style>