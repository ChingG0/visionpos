<template>
  <div class="up">

    <div class="up__datebar">
      <div class="up__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="up__date-btn" :class="{ 'up__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">{{ opt.label }}</button>
      </div>
      <div class="up__date-custom">
        <input type="date" class="up__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="up__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <span v-if="uber.loading" class="up__loading">載入中...</span>
    </div>

    <div class="up__kpis">
      <div class="up__kpi">
        <p class="up__kpi-label">品項種類</p>
        <p class="up__kpi-value">{{ products.length }}<span class="up__kpi-unit">種</span></p>
      </div>
      <div class="up__kpi">
        <p class="up__kpi-label">總銷售份數</p>
        <p class="up__kpi-value">{{ totalQty }}<span class="up__kpi-unit">份</span></p>
      </div>
      <div class="up__kpi">
        <p class="up__kpi-label">熱銷冠軍</p>
        <p class="up__kpi-value up__kpi-value--name">{{ topQty?.name || '—' }}</p>
        <p class="up__kpi-sub">{{ topQty?.qty ?? 0 }} 份</p>
      </div>
      <div class="up__kpi">
        <p class="up__kpi-label">最高銷售額</p>
        <p class="up__kpi-value up__kpi-value--name">{{ products[0]?.name || '—' }}</p>
        <p class="up__kpi-sub">${{ fmt(products[0]?.revenue ?? 0) }}</p>
      </div>
    </div>

    <div class="up__card">
      <h3 class="up__card-title">品項排行</h3>
      <div class="up__table-wrap">
        <table class="up__table">
          <thead>
            <tr>
              <th class="up__th--rank">#</th>
              <th class="up__th--left">品項</th>
              <th class="up__th--num">份數</th>
              <th class="up__th--num">銷售額</th>
              <th class="up__th--num">佔比</th>
              <th class="up__th--bar"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!products.length">
              <td colspan="6" class="up__empty">
                此期間沒有 Uber Eats 品項資料。請到「UberEats 營收」頁匯入對帳 CSV。
              </td>
            </tr>
            <tr v-for="(p, idx) in products" :key="p.name" class="up__tr">
              <td class="up__td-rank">{{ idx + 1 }}</td>
              <td>{{ p.name }}</td>
              <td class="up__td-num">{{ Math.round(p.qty) }}</td>
              <td class="up__td-num">${{ fmt(p.revenue) }}</td>
              <td class="up__td-num up__td-pct">{{ share(p.revenue) }}</td>
              <td class="up__td-bar">
                <div class="up__bar-track">
                  <div class="up__bar-fill" :style="{ width: barW(p.revenue) }" />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="up__note">
        ※ 只計入「已完成」訂單的品項。銷售額取自 Uber 對帳檔的品項金額（含加料與選項），
        不是單價乘以數量——那兩個數字在 Uber 的資料裡不相等。
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUberStore } from '@/stores/uberStore.js'

const uber = useUberStore()

const DATE_OPTS = [
  { key: 'month',     label: '本月' }, { key: 'lastmonth', label: '上月' },
  { key: 'quarter',   label: '近三月' }, { key: 'year',    label: '今年' },
]
const preset      = ref('month')
const customStart = ref(monthStart())
const customEnd   = ref(todayStr())

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
}

function applyPreset(key) {
  preset.value = key
  const d = new Date()
  const today = todayStr()
  if (key === 'month') { customStart.value = monthStart(); customEnd.value = today }
  if (key === 'lastmonth') {
    const last = new Date(d.getFullYear(), d.getMonth(), 0)
    const ym = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}`
    customStart.value = `${ym}-01`
    customEnd.value   = `${ym}-${String(last.getDate()).padStart(2,'0')}`
  }
  if (key === 'quarter') {
    const s = new Date(); s.setMonth(s.getMonth() - 2); s.setDate(1)
    customStart.value = `${s.getFullYear()}-${String(s.getMonth()+1).padStart(2,'0')}-01`
    customEnd.value = today
  }
  if (key === 'year') { customStart.value = `${d.getFullYear()}-01-01`; customEnd.value = today }
  reload()
}
function applyCustom() { preset.value = ''; reload() }
function reload() { uber.fetchRange(customStart.value, customEnd.value) }

onMounted(() => applyPreset('month'))

const products = computed(() => uber.products)
const totalQty = computed(() => Math.round(products.value.reduce((s, p) => s + p.qty, 0)))
const totalRev = computed(() => products.value.reduce((s, p) => s + p.revenue, 0))
const topQty   = computed(() => [...products.value].sort((a, b) => b.qty - a.qty)[0] ?? null)

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('zh-TW') }
function share(v) { return totalRev.value ? (v / totalRev.value * 100).toFixed(1) + '%' : '—' }
function barW(v) {
  const max = products.value[0]?.revenue ?? 0
  return max ? `${Math.max(2, v / max * 100)}%` : '0%'
}
</script>

<style scoped>
.up { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

.up__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.up__date-btns { display: flex; gap: 4px; }
.up__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); }
.up__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.up__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.up__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.up__date-input:focus { border-color: #e8a038; }
.up__loading { font-size: 12px; color: var(--color-text-muted); }

.up__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.up__kpi { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.up__kpi-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
.up__kpi-value { font-size: 22px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; }
.up__kpi-value--name { font-size: 16px; }
.up__kpi-unit { font-size: 13px; font-weight: 400; margin-left: 3px; }
.up__kpi-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 3px; }

.up__card { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.up__card-title { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 12px; }

.up__table-wrap { overflow: auto; max-height: 420px; }
.up__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.up__table th { text-align: right; padding: 8px 10px; font-size: 12px; font-weight: 500;
                color: var(--color-text-muted); background: #faf5ec; border-bottom: 1px solid #ede5d0;
                position: sticky; top: 0; z-index: 1; }
.up__th--left { text-align: left; }
.up__th--num  { text-align: right; }
.up__th--rank { width: 38px; text-align: center; }
.up__th--bar  { width: 120px; }
.up__tr:hover { background: #faf5ec; }
.up__tr td { padding: 8px 10px; border-bottom: 1px solid #f5f0e8; color: var(--color-text-primary); }
.up__td-rank { text-align: center; color: var(--color-text-muted); font-size: 12px; }
.up__td-num  { text-align: right; font-variant-numeric: tabular-nums; }
.up__td-pct  { color: var(--color-text-muted); font-size: 12px; }
.up__td-bar  { padding-right: 4px; }
.up__bar-track { height: 6px; background: #f0e8d8; border-radius: 99px; overflow: hidden; }
.up__bar-fill  { height: 100%; background: #e8a038; border-radius: 99px; }
.up__empty { padding: 30px; text-align: center; color: var(--color-text-muted); font-size: 12.5px; }
.up__note { font-size: 11.5px; color: var(--color-text-muted); margin-top: 10px; line-height: 1.7; }
</style>
