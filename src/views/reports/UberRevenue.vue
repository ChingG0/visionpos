<template>
  <div class="ur">

    <!-- 日期選擇列 -->
    <div class="ur__datebar">
      <div class="ur__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="ur__date-btn" :class="{ 'ur__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">{{ opt.label }}</button>
      </div>
      <div class="ur__date-custom">
        <input type="date" class="ur__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="ur__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <span v-if="uber.loading" class="ur__loading">載入中...</span>
      <button class="ur__import-btn" @click="showImport = true">⬆ 匯入對帳資料</button>
    </div>

    <!-- 指標卡片 -->
    <div class="ur__kpis">
      <div class="ur__kpi">
        <p class="ur__kpi-label">訂單筆數</p>
        <p class="ur__kpi-value">{{ t.count }}<span class="ur__kpi-unit">筆</span></p>
        <p class="ur__kpi-sub">平均客單 ${{ fmt(t.avgTicket) }}</p>
      </div>
      <div class="ur__kpi">
        <p class="ur__kpi-label">銷售額</p>
        <p class="ur__kpi-value">${{ fmt(t.gross) }}</p>
        <p class="ur__kpi-sub">顧客實際付的金額</p>
      </div>
      <div class="ur__kpi">
        <p class="ur__kpi-label">平台服務費</p>
        <p class="ur__kpi-value ur__kpi-value--neg">${{ fmt(t.platformFee) }}</p>
        <p class="ur__kpi-sub">商品優惠另計 ${{ fmt(t.discount) }}</p>
      </div>
      <div class="ur__kpi ur__kpi--net">
        <p class="ur__kpi-label">實際入袋</p>
        <p class="ur__kpi-value">${{ fmt(t.net) }}</p>
        <p class="ur__kpi-sub">佔銷售額 {{ t.netRate.toFixed(1) }}%　平均 ${{ fmt(t.avgNet) }}／單</p>
      </div>
    </div>

    <!-- 金額拆解 -->
    <div v-if="t.count" class="ur__card">
      <h3 class="ur__card-title">金額拆解</h3>
      <div class="ur__break">
        <div class="ur__break-row">
          <span>銷售額（顧客付的）</span><b>${{ fmt(t.gross) }}</b><span class="ur__pct">100%</span>
        </div>
        <div class="ur__break-row ur__break-row--neg">
          <span>商品優惠（你出的折扣）</span><b>${{ fmt(t.discount) }}</b>
          <span class="ur__pct">{{ pct(t.discount) }}</span>
        </div>
        <div v-if="t.marketing" class="ur__break-row">
          <span>行銷調整</span><b>${{ fmt(t.marketing) }}</b><span class="ur__pct">{{ pct(t.marketing) }}</span>
        </div>
        <div class="ur__break-row ur__break-row--neg">
          <span>平台服務費</span><b>${{ fmt(t.platformFee) }}</b>
          <span class="ur__pct">{{ pct(t.platformFee) }}</span>
        </div>
        <div class="ur__break-row ur__break-row--total">
          <span>實際入袋</span><b>${{ fmt(t.net) }}</b>
          <span class="ur__pct">{{ t.netRate.toFixed(1) }}%</span>
        </div>
      </div>
    </div>

    <!-- 每日銷售額 -->
    <div class="ur__card">
      <h3 class="ur__card-title">每日銷售額</h3>
      <div v-if="!uber.daily.length" class="ur__empty">此期間沒有 Uber Eats 訂單資料</div>
      <div v-else class="ur__bars">
        <div v-for="d in uber.daily" :key="d.date" class="ur__bar-col" :title="`${d.date}　${d.count} 筆`">
          <div class="ur__bar-stack">
            <div class="ur__bar ur__bar--gross" :style="{ height: barH(d.gross) }" />
            <div class="ur__bar ur__bar--net"   :style="{ height: barH(d.net) }" />
          </div>
          <span class="ur__bar-label">{{ d.date.slice(5) }}</span>
        </div>
      </div>
      <div v-if="uber.daily.length" class="ur__legend">
        <span><i class="ur__dot ur__dot--gross" />銷售額</span>
        <span><i class="ur__dot ur__dot--net" />實際入袋</span>
      </div>
    </div>

    <!-- 訂單明細 -->
    <div class="ur__card">
      <h3 class="ur__card-title">訂單明細</h3>
      <div class="ur__table-wrap">
        <table class="ur__table">
          <thead>
            <tr>
              <th class="ur__th--left">日期</th>
              <th class="ur__th--left">訂單</th>
              <th class="ur__th--left">管道</th>
              <th class="ur__th--num">銷售額</th>
              <th class="ur__th--num">優惠</th>
              <th class="ur__th--num">服務費</th>
              <th class="ur__th--num">實收</th>
              <th class="ur__th--left">撥款日</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!uber.orders.length">
              <td colspan="8" class="ur__empty-cell">沒有資料。點右上角「匯入對帳資料」從 Uber Eats Manager 下載的 CSV 匯入。</td>
            </tr>
            <tr v-for="o in uber.orders" :key="o.order_uuid" class="ur__tr"
                :class="{ 'ur__tr--void': o.status !== '已完成' }">
              <td>{{ o.ordered_on }}</td>
              <td class="ur__mono">{{ o.order_ref }}</td>
              <td>{{ o.order_channel || '—' }}</td>
              <td class="ur__td-num">${{ fmt(o.gross_incl_tax) }}</td>
              <td class="ur__td-num ur__neg">{{ Number(o.item_discount) ? '$' + fmt(o.item_discount) : '—' }}</td>
              <td class="ur__td-num ur__neg">${{ fmt(o.platform_fee) }}</td>
              <td class="ur__td-num ur__td-net">${{ fmt(o.net_payout) }}</td>
              <td>{{ o.payout_date || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="ur__note">
        ※ 統計只計入「已完成」的訂單。金額皆為含稅。發票由店家自行開立，這些訂單不計入發票統計。
      </p>
    </div>

    <UberImportModal v-if="showImport" @close="showImport = false" @imported="reload" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useUberStore } from '@/stores/uberStore.js'
import UberImportModal from '@/components/reports/UberImportModal.vue'

const uber = useUberStore()
const showImport = ref(false)

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

/* Uber 的對帳資料是週期性匯入的，看「今日」通常是空的，所以預設區間比自家報表長 */
function applyPreset(key) {
  preset.value = key
  const d = new Date()
  const today = todayStr()
  if (key === 'month') { customStart.value = monthStart(); customEnd.value = today }
  if (key === 'lastmonth') {
    const y = d.getFullYear(), m = d.getMonth()          // 0-based，直接當上個月
    const last = new Date(y, m, 0)                        // 上個月最後一天
    customStart.value = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-01`
    customEnd.value   = `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`
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

const t = computed(() => uber.totals)

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('zh-TW') }
function pct(n) {
  const g = t.value.gross
  return g ? (Number(n) / g * 100).toFixed(1) + '%' : '—'
}

const maxBar = computed(() => Math.max(1, ...uber.daily.map(d => d.gross)))
function barH(v) { return `${Math.max(2, (Number(v) / maxBar.value) * 100)}%` }
</script>

<style scoped>
.ur { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

.ur__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ur__date-btns { display: flex; gap: 4px; }
.ur__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); }
.ur__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.ur__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.ur__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.ur__date-input:focus { border-color: #e8a038; }
.ur__loading { font-size: 12px; color: var(--color-text-muted); }
.ur__import-btn { margin-left: auto; padding: 6px 14px; border-radius: var(--radius-sm); font-size: 12.5px; font-weight: 500; color: #fff; background: #1a1410; border: none; }
.ur__import-btn:hover { background: #33291f; }

.ur__kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
.ur__kpi { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.ur__kpi--net { background: #fdf1de; border-color: #ecd6ac; }
.ur__kpi-label { font-size: 12px; color: var(--color-text-muted); margin-bottom: 4px; }
.ur__kpi-value { font-size: 22px; font-weight: 700; color: var(--color-text-primary); line-height: 1.2; font-variant-numeric: tabular-nums; }
.ur__kpi-value--neg { color: #c0392b; }
.ur__kpi--net .ur__kpi-value { color: #8a5a10; }
.ur__kpi-unit { font-size: 13px; font-weight: 400; margin-left: 3px; }
.ur__kpi-sub { font-size: 11.5px; color: var(--color-text-muted); margin-top: 3px; }

.ur__card { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; }
.ur__card-title { font-size: 13.5px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 12px; }
.ur__empty, .ur__empty-cell { padding: 30px; text-align: center; color: var(--color-text-muted); font-size: 12.5px; }

.ur__break { display: flex; flex-direction: column; }
.ur__break-row { display: grid; grid-template-columns: 1fr auto 62px; gap: 12px; align-items: center;
                 padding: 8px 0; font-size: 13px; border-bottom: 1px solid #f5f0e8; }
.ur__break-row span:first-child { color: var(--color-text-secondary); }
.ur__break-row b { font-variant-numeric: tabular-nums; color: var(--color-text-primary); }
.ur__break-row--neg b { color: #c0392b; }
.ur__break-row--total { border-bottom: none; border-top: 2px solid #ede5d0; margin-top: 2px; padding-top: 10px; }
.ur__break-row--total b { color: #8a5a10; font-size: 16px; font-weight: 700; }
.ur__pct { text-align: right; font-size: 11.5px; color: var(--color-text-muted); font-variant-numeric: tabular-nums; }

.ur__bars { display: flex; align-items: flex-end; gap: 6px; height: 150px; overflow-x: auto; padding-top: 4px; }
.ur__bar-col { flex: 1; min-width: 26px; display: flex; flex-direction: column; align-items: center; height: 100%; }
.ur__bar-stack { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; gap: 2px; }
.ur__bar { width: 46%; border-radius: 3px 3px 0 0; }
.ur__bar--gross { background: #e8c88a; }
.ur__bar--net   { background: #e8a038; }
.ur__bar-label { font-size: 10px; color: var(--color-text-muted); margin-top: 5px; white-space: nowrap; }
.ur__legend { display: flex; gap: 14px; font-size: 11.5px; color: var(--color-text-muted); margin-top: 10px; }
.ur__dot { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 5px; }
.ur__dot--gross { background: #e8c88a; }
.ur__dot--net   { background: #e8a038; }

.ur__table-wrap { overflow: auto; max-height: 360px; }
.ur__table { width: 100%; border-collapse: collapse; font-size: 13px; }
.ur__table th { text-align: right; padding: 8px 10px; font-size: 12px; font-weight: 500;
                color: var(--color-text-muted); background: #faf5ec; border-bottom: 1px solid #ede5d0;
                position: sticky; top: 0; z-index: 1; white-space: nowrap; }
.ur__th--left { text-align: left; }
.ur__th--num  { text-align: right; }
.ur__tr:hover { background: #faf5ec; }
.ur__tr td { padding: 8px 10px; border-bottom: 1px solid #f5f0e8; color: var(--color-text-primary); white-space: nowrap; }
.ur__tr--void { opacity: .45; }
.ur__td-num { text-align: right; font-variant-numeric: tabular-nums; }
.ur__td-net { font-weight: 600; color: #8a5a10; }
.ur__neg { color: #c0392b; }
.ur__mono { font-family: ui-monospace, monospace; font-size: 12px; color: var(--color-text-secondary); }
.ur__note { font-size: 11.5px; color: var(--color-text-muted); margin-top: 10px; line-height: 1.7; }
</style>
