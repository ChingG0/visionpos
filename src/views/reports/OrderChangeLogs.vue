<template>
  <div class="ocl">

    <!-- 日期選擇列 -->
    <div class="ocl__datebar">
      <div class="ocl__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="ocl__date-btn" :class="{ 'ocl__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">{{ opt.label }}</button>
      </div>
      <div class="ocl__date-custom">
        <input type="date" class="ocl__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="ocl__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <div class="ocl__action-btns">
        <button v-for="opt in ACTION_OPTS" :key="opt.key"
          class="ocl__action-btn" :class="{ 'ocl__action-btn--active': actionFilter === opt.key }"
          @click="actionFilter = opt.key">{{ opt.label }}</button>
      </div>
      <span v-if="loading" class="ocl__loading">載入中...</span>
    </div>

    <!-- 列表 -->
    <div class="ocl__card">
      <div class="ocl__card-title">點餐紀錄（取消／修改訂單）</div>

      <p v-if="!loading && filtered.length === 0" class="ocl__empty">此期間沒有紀錄</p>

      <div v-else class="ocl__list">
        <div v-for="log in filtered" :key="log.id" class="ocl__item">

          <div class="ocl__item-head" @click="toggle(log.id)">
            <span class="ocl__action" :class="log.action === 'cancel' ? 'ocl__action--cancel' : 'ocl__action--edit'">
              {{ log.action === 'cancel' ? '取消' : '修改' }}
            </span>
            <div class="ocl__item-info">
              <span class="ocl__item-seat">{{ log.seat_name || orderTypeLabel(log.order_type) }}</span>
              <span class="ocl__item-sub">{{ log.action === 'cancel' ? (log.reason || '未填寫原因') : log.summary }}</span>
            </div>
            <div class="ocl__item-meta">
              <span class="ocl__item-staff">{{ log.staff || '—' }}</span>
              <span class="ocl__item-time">{{ timeLabel(log.created_at) }}</span>
            </div>
            <span class="ocl__chevron" :class="{ 'ocl__chevron--open': expanded === log.id }">▾</span>
          </div>

          <div v-if="expanded === log.id" class="ocl__detail">
            <div v-if="log.action === 'cancel'" class="ocl__detail-col">
              <p class="ocl__detail-title">取消原因</p>
              <p class="ocl__detail-text">{{ log.reason || '未填寫' }}</p>
              <template v-if="log.before?.items?.length">
                <p class="ocl__detail-title" style="margin-top:8px">取消時的品項</p>
                <div v-for="(line, i) in log.before.items" :key="i" class="ocl__detail-row">
                  <span>{{ line.name }} x{{ line.qty }}</span>
                  <span>${{ Math.round((line.price ?? 0) * (line.qty ?? 0)) }}</span>
                </div>
                <div class="ocl__detail-row ocl__detail-row--total">
                  <span>總計</span><span>${{ fmt(log.before.total) }}</span>
                </div>
              </template>
            </div>

            <div v-else class="ocl__detail-col">
              <p class="ocl__detail-title">修改摘要</p>
              <p class="ocl__detail-text">{{ log.summary || '—' }}</p>
              <div class="ocl__diff-grid">
                <div>
                  <p class="ocl__detail-title" style="margin-top:8px">修改前</p>
                  <div v-for="(line, i) in (log.before?.items ?? [])" :key="'b'+i" class="ocl__detail-row">
                    <span>{{ line.name }} x{{ line.qty }}</span>
                  </div>
                  <div class="ocl__detail-row ocl__detail-row--total">
                    <span>總計</span><span>${{ fmt(log.before?.total) }}</span>
                  </div>
                </div>
                <div>
                  <p class="ocl__detail-title" style="margin-top:8px">修改後</p>
                  <div v-for="(line, i) in (log.after?.items ?? [])" :key="'a'+i" class="ocl__detail-row">
                    <span>{{ line.name }} x{{ line.qty }}</span>
                  </div>
                  <div class="ocl__detail-row ocl__detail-row--total">
                    <span>總計</span><span>${{ fmt(log.after?.total) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useOrderChangeLogStore } from '@/stores/orderChangeLogStore.js'

const logStore = useOrderChangeLogStore()

const logs     = ref([])
const loading  = ref(false)
const expanded = ref(null)

const DATE_OPTS = [
  { key: 'today', label: '今日' }, { key: 'yesterday', label: '昨日' },
  { key: 'week',  label: '本週' }, { key: 'month',     label: '本月' },
]
const ACTION_OPTS = [
  { key: 'all',    label: '全部' },
  { key: 'cancel', label: '僅取消' },
  { key: 'edit',   label: '僅修改' },
]
const preset      = ref('today')
const actionFilter = ref('all')
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
  logs.value = await logStore.fetchLogs(customStart.value, customEnd.value)
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

const filtered = computed(() =>
  actionFilter.value === 'all' ? logs.value : logs.value.filter(l => l.action === actionFilter.value)
)

function toggle(id) { expanded.value = expanded.value === id ? null : id }

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('zh-TW') }

function orderTypeLabel(t) {
  return { dine_in: '內用', takeout: '外帶', delivery: '外送' }[t] ?? t
}

function timeLabel(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')} ` +
         `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
</script>

<style scoped>
.ocl { padding: 16px 20px; display: flex; flex-direction: column; gap: 16px; }

.ocl__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.ocl__date-btns { display: flex; gap: 4px; }
.ocl__date-btn {
  padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px;
  color: var(--color-text-secondary); background: #fff;
  border: 1px solid var(--color-border-btn); transition: all 0.12s;
}
.ocl__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.ocl__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.ocl__date-input {
  padding: 4px 8px; border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none;
}
.ocl__action-btns { display: flex; gap: 4px; margin-left: auto; }
.ocl__action-btn {
  padding: 5px 12px; border-radius: var(--radius-sm); font-size: 12.5px;
  color: var(--color-text-secondary); background: #fff;
  border: 1px solid var(--color-border-btn); transition: all 0.12s;
}
.ocl__action-btn--active { background: #7a6850; color: #fff; border-color: #7a6850; font-weight: 500; }
.ocl__loading { font-size: 12px; color: var(--color-text-muted); }

.ocl__card {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 14px 16px;
}
.ocl__card-title { font-size: 13px; font-weight: 500; color: var(--color-text-primary); margin-bottom: 12px; }
.ocl__empty { text-align: center; color: var(--color-text-muted); font-size: 13px; padding: 30px 0; }

.ocl__list { display: flex; flex-direction: column; }
.ocl__item { border-bottom: 1px solid #f5f0e8; }

.ocl__item-head {
  display: grid; grid-template-columns: 48px 1fr auto 20px;
  gap: 12px; align-items: center; padding: 11px 0; cursor: pointer;
}
.ocl__item-head:hover { background: #faf5ec; }

.ocl__action {
  font-size: 11.5px; font-weight: 600; text-align: center;
  padding: 3px 0; border-radius: 999px;
}
.ocl__action--cancel { color: #c0392b; background: #fff0ee; }
.ocl__action--edit    { color: #8a6020; background: #fde8c0; }

.ocl__item-seat { font-size: 13.5px; color: var(--color-text-primary); font-weight: 500; }
.ocl__item-sub  { display: block; font-size: 11.5px; color: var(--color-text-muted); margin-top: 2px; max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ocl__item-meta  { text-align: right; }
.ocl__item-staff { display: block; font-size: 12.5px; color: var(--color-text-secondary); }
.ocl__item-time  { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

.ocl__chevron { font-size: 11px; color: var(--color-text-muted); transition: transform 0.15s; }
.ocl__chevron--open { transform: rotate(180deg); }

.ocl__detail {
  padding: 12px 14px 14px; background: #faf5ec;
  border-radius: 10px; margin-bottom: 10px;
}
.ocl__detail-col { display: flex; flex-direction: column; gap: 3px; }
.ocl__detail-title { font-size: 11.5px; font-weight: 600; color: #5a4030; }
.ocl__detail-text  { font-size: 12.5px; color: var(--color-text-secondary); }
.ocl__detail-row {
  display: flex; justify-content: space-between;
  font-size: 12.5px; color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}
.ocl__detail-row--total {
  padding-top: 5px; margin-top: 2px; border-top: 1px dashed #d8d0c0;
  font-weight: 600; color: var(--color-text-primary);
}
.ocl__diff-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 4px; }
</style>
