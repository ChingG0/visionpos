<template>
  <div class="sr">

    <!-- 日期選擇列 -->
    <div class="sr__datebar">
      <div class="sr__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="sr__date-btn" :class="{ 'sr__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">{{ opt.label }}</button>
      </div>
      <div class="sr__date-custom">
        <input type="date" class="sr__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="sr__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <span v-if="loading" class="sr__loading">載入中...</span>
    </div>

    <!-- 列表 -->
    <div class="sr__card">
      <div class="sr__card-title">交班／關帳紀錄</div>

      <p v-if="!loading && records.length === 0" class="sr__empty">此期間沒有紀錄</p>

      <div v-else class="sr__list">
        <div v-for="rec in records" :key="rec.id" class="sr__item">

          <div class="sr__item-head" @click="toggle(rec.id)">
            <span class="sr__kind" :class="rec.kind === 'closeout' ? 'sr__kind--closeout' : 'sr__kind--shift'">
              {{ rec.kind === 'closeout' ? '關帳' : '交班' }}
            </span>
            <div class="sr__item-info">
              <span class="sr__item-staff">{{ rec.staff_name || '—' }}</span>
              <span class="sr__item-period">{{ periodLabel(rec) }}</span>
            </div>
            <div class="sr__item-figures">
              <span class="sr__item-count">{{ rec.order_count }} 筆</span>
              <span class="sr__item-revenue">${{ fmt(rec.total_revenue) }}</span>
            </div>
            <span class="sr__chevron" :class="{ 'sr__chevron--open': expanded === rec.id }">▾</span>
          </div>

          <div v-if="expanded === rec.id" class="sr__detail">
            <div class="sr__detail-col">
              <p class="sr__detail-title">付款方式</p>
              <div v-for="(amount, method) in (rec.payment_breakdown ?? {})" :key="method" class="sr__detail-row">
                <span>{{ method }}</span>
                <span>${{ fmt(amount) }}</span>
              </div>
              <p v-if="Object.keys(rec.payment_breakdown ?? {}).length === 0" class="sr__detail-empty">無</p>
            </div>

            <div class="sr__detail-col">
              <p class="sr__detail-title">現金結算</p>
              <div v-if="Number(rec.unpaid_amount) > 0" class="sr__detail-row sr__unpaid">
                <span>未收款 {{ rec.unpaid_count }} 筆</span>
                <span>${{ fmt(rec.unpaid_amount) }}</span>
              </div>
              <div class="sr__detail-row"><span>現金訂單</span><span>${{ fmt(rec.cash_orders) }}</span></div>
              <div class="sr__detail-row"><span>雜項收入</span><span class="sr__plus">+${{ fmt(rec.misc_income) }}</span></div>
              <div class="sr__detail-row"><span>雜項支出</span><span class="sr__minus">−${{ fmt(rec.misc_expense) }}</span></div>
              <div class="sr__detail-row sr__detail-row--total">
                <span>實收現金</span><span>${{ fmt(rec.cash_actual) }}</span>
              </div>
            </div>

            <div v-if="rec.note" class="sr__note">📝 {{ rec.note }}</div>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useShiftStore } from '@/stores/shiftStore.js'

const shiftStore = useShiftStore()

const records  = ref([])
const loading  = ref(false)
const expanded = ref(null)

const DATE_OPTS = [
  { key: 'today', label: '今日' }, { key: 'yesterday', label: '昨日' },
  { key: 'week',  label: '本週' }, { key: 'month',     label: '本月' },
]
const preset      = ref('today')
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

async function load() {
  loading.value = true
  records.value = await shiftStore.fetchRecords(customStart.value, customEnd.value)
  loading.value = false
}

function applyPreset(key) {
  preset.value = key
  const today = todayStr()
  if (key === 'today')     { customStart.value = today; customEnd.value = today }
  if (key === 'yesterday') { const y = offsetDay(-1); customStart.value = y; customEnd.value = y }
  if (key === 'week')  { customStart.value = offsetDay(1 - (new Date().getDay() || 7)); customEnd.value = today }
  if (key === 'month') { const d = new Date(); customStart.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`; customEnd.value = today }
  load()
}

function applyCustom() { preset.value = ''; load() }

onMounted(() => applyPreset('today'))

function toggle(id) { expanded.value = expanded.value === id ? null : id }

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('zh-TW') }

function periodLabel(rec) {
  const f = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ` +
           `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  return `${f(rec.period_start)} － ${f(rec.period_end)}`
}
</script>

<style scoped>
.sr { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

.sr__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sr__date-btns { display: flex; gap: 4px; }
.sr__date-btn {
  padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px;
  color: var(--color-text-secondary); background: #fff;
  border: 1px solid var(--color-border-btn); transition: all 0.12s;
}
.sr__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.sr__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.sr__date-input {
  padding: 4px 8px; border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none;
}
.sr__loading { font-size: 12px; color: var(--color-text-muted); }

.sr__card {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 14px 16px;
}
.sr__card-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 12px; }
.sr__empty { text-align: center; color: var(--color-text-muted); font-size: 13px; padding: 30px 0; }

.sr__list { display: flex; flex-direction: column; }
.sr__item { border-bottom: 1px solid #f5f0e8; }

.sr__item-head {
  display: grid; grid-template-columns: 56px 1fr auto 20px;
  gap: 12px; align-items: center; padding: 11px 0; cursor: pointer;
}
.sr__item-head:hover { background: #faf5ec; }

.sr__kind {
  font-size: 11.5px; font-weight: 600; text-align: center;
  padding: 3px 0; border-radius: 999px;
}
.sr__kind--shift    { color: #7a6850; background: #f0e8d8; }
.sr__kind--closeout { color: #8a6020; background: #fde8c0; }

.sr__item-staff  { font-size: 13.5px; color: var(--color-text-primary); }
.sr__item-period { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

.sr__item-figures { text-align: right; }
.sr__item-count   { display: block; font-size: 11px; color: var(--color-text-muted); }
.sr__item-revenue { font-size: 15px; font-weight: 600; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }

.sr__chevron { font-size: 11px; color: var(--color-text-muted); transition: transform 0.15s; }
.sr__chevron--open { transform: rotate(180deg); }

.sr__detail {
  display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
  padding: 12px 14px 14px; background: #faf5ec;
  border-radius: 10px; margin-bottom: 10px;
}
.sr__detail-col { display: flex; flex-direction: column; gap: 4px; }
.sr__detail-title { font-size: 11.5px; font-weight: 600; color: #5a4030; margin-bottom: 3px; }
.sr__detail-row {
  display: flex; justify-content: space-between;
  font-size: 12.5px; color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.sr__detail-row--total {
  padding-top: 5px; margin-top: 2px; border-top: 1px dashed #d8d0c0;
  font-weight: 600; color: var(--color-text-primary);
}
.sr__detail-empty { font-size: 12px; color: var(--color-text-muted); }
.sr__unpaid { color: #c07818; font-weight: 600; }
.sr__plus  { color: #2f7a3d; }
.sr__minus { color: #c0392b; }

.sr__note {
  grid-column: 1 / -1; font-size: 12px; color: var(--color-text-secondary);
  background: #fff; border-radius: 8px; padding: 7px 10px;
}
</style>
