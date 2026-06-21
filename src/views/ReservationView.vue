<template>
  <div class="rv">
    <AppSidebar />
    <div class="rv__main">
      <AppTopbar :show-floor-tabs="false" title="預約管理" />

      <div class="rv__body">

        <!-- 工具列 -->
        <div class="rv__toolbar">
          <input type="date" v-model="selectedDate" class="rv__date-picker" />
          <div class="rv__tabs">
            <button v-for="t in STATUS_TABS" :key="t.key"
              class="rv__tab" :class="{ 'rv__tab--active': activeTab === t.key }"
              @click="activeTab = t.key">
              {{ t.label }}
              <span v-if="counts[t.key]" class="rv__tab-badge">{{ counts[t.key] }}</span>
            </button>
          </div>
          <button class="rv__add-btn" @click="showForm = true">＋ 新增預約</button>
        </div>

        <!-- 預約列表 -->
        <div class="rv__list" v-if="filtered.length > 0">
          <div v-for="r in filtered" :key="r.id" class="rv__card">
            <div class="rv__card-header">
              <div class="rv__card-left">
                <span class="rv__card-time">{{ r.time }}</span>
                <!-- 等候中：顯示倒計時 -->
              <span v-if="r.status === 'waiting'"
                class="rv__status-badge" :class="urgencyClass(r.date, r.time)">
                {{ timeUntil(r.date, r.time) || '等候中' }}
              </span>
              <!-- 其他狀態 -->
              <span v-else class="rv__status-badge" :class="`rv__status-badge--${r.status}`">
                {{ STATUS_LABEL[r.status] }}
              </span>
              </div>
              <div class="rv__card-pax">{{ r.guests }} 位</div>
            </div>

            <div class="rv__card-body">
              <div class="rv__card-name">{{ r.name }}</div>
              <div v-if="r.phone" class="rv__card-phone">📞 {{ r.phone }}</div>
              <div v-if="r.note" class="rv__card-note">💬 {{ r.note }}</div>
            </div>

            <!-- 入座資訊（已安排後才顯示）-->
            <div v-if="r.status === 'seated' && r.assignedItemNames?.length" class="rv__card-seat">
              <span class="rv__seat-icon">💺</span>
              {{ r.assignedItemNames.join('、') }}
              <span class="rv__seat-time">{{ fmtTime(r.seatedAt) }} 入座</span>
            </div>

            <div class="rv__card-footer">
              <!-- 等候中 -->
              <template v-if="r.status === 'waiting'">
                <button class="rv__btn rv__btn--ghost" @click="store.cancelReservation(r.id)">取消</button>
              </template>
              <!-- 已取消 -->
              <template v-else-if="r.status === 'cancelled'">
                <button class="rv__btn rv__btn--ghost" @click="store.restoreReservation(r.id)">還原</button>
              </template>
              <!-- 已入座 -->
              <template v-else-if="r.status === 'seated'">
                <span class="rv__card-done">✓ 已安排入座</span>
              </template>
            </div>
          </div>
        </div>

        <!-- 空狀態 -->
        <div v-else class="rv__empty">
          <p class="rv__empty-icon">📅</p>
          <p>{{ selectedDate === todayStr ? '今日' : selectedDate }} 無{{ STATUS_LABEL[activeTab] ?? '' }}預約</p>
        </div>

      </div>
    </div>

    <!-- 新增預約 Form -->
    <ReservationForm v-if="showForm" @close="showForm = false" @submit="handleFormSubmit" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppSidebar          from '@/components/layout/AppSidebar.vue'
import AppTopbar            from '@/components/layout/AppTopbar.vue'
import ReservationForm      from '@/components/reservation/ReservationForm.vue'
import { useReservationStore } from '@/stores/reservationStore.js'

const store = useReservationStore()
onMounted(() => store.init())

const todayStr    = new Date().toISOString().slice(0, 10)
const selectedDate = ref(todayStr)
const activeTab    = ref('all')
const showForm     = ref(false)

/* 每分鐘更新一次，讓倒計時即時顯示 */
const now = ref(Date.now())
const timer = setInterval(() => { now.value = Date.now() }, 30000)
onUnmounted(() => clearInterval(timer))

/* 計算距離預約時間還有多久（或已超過多久）*/
function timeUntil(dateStr, timeStr) {
  if (!dateStr || !timeStr) return ''
  const target = new Date(`${dateStr}T${timeStr.length === 5 ? timeStr : timeStr + ':00'}`)
  const diff   = target.getTime() - now.value
  if (diff > 0) {
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 0) return `還有 ${h}h${String(m).padStart(2,'0')}m`
    if (m > 0) return `還有 ${m} 分鐘`
    return '即將到達'
  } else {
    const overdue = Math.floor(-diff / 60000)
    if (overdue === 0) return '現在到達'
    return `已超過 ${overdue} 分鐘`
  }
}

function urgencyClass(dateStr, timeStr) {
  const target = new Date(`${dateStr}T${timeStr}`)
  const diff   = target.getTime() - now.value
  if (diff < 0) return 'rv__status-badge--overdue'
  if (diff < 30 * 60000) return 'rv__status-badge--soon'
  return 'rv__status-badge--waiting'
}

const STATUS_TABS = [
  { key: 'all',       label: '全部' },
  { key: 'waiting',   label: '等候' },
  { key: 'seated',    label: '已入座' },
  { key: 'cancelled', label: '已取消' },
]

const STATUS_LABEL = {
  waiting:   '等候中',
  seated:    '已入座',
  cancelled: '已取消',
}

/* 選定日期的預約（依時間排序）*/
const dayReservations = computed(() =>
  store.reservations
    .filter(r => r.date === selectedDate.value)
    .sort((a, b) => a.time.localeCompare(b.time))
)

/* 依 tab 篩選 */
const filtered = computed(() =>
  activeTab.value === 'all'
    ? dayReservations.value
    : dayReservations.value.filter(r => r.status === activeTab.value)
)

/* 各 tab 計數 */
const counts = computed(() => {
  const c = { waiting: 0, seated: 0, cancelled: 0 }
  for (const r of dayReservations.value) {
    if (r.status in c) c[r.status]++
  }
  return c
})

function fmtTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function handleFormSubmit(data) {
  store.addReservation({ ...data, date: selectedDate.value })
  showForm.value = false
}
</script>

<style scoped>
.rv { width: 100%; height: 100%; display: flex; overflow: hidden; }
.rv__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.rv__body { flex: 1; overflow-y: auto; padding: 14px 18px; background: var(--color-bg-map); display: flex; flex-direction: column; gap: 12px; }

/* 工具列 */
.rv__toolbar { display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }
.rv__date-picker { padding: 7px 10px; border: 1.5px solid #c8b89a; border-radius: var(--radius-sm); font-size: 13px; background: #fff; color: #1a0800; outline: none; }
.rv__date-picker:focus { border-color: #e8a038; }
.rv__tabs { display: flex; gap: 4px; background: #f0e8d8; padding: 3px; border-radius: var(--radius-sm); }
.rv__tab { padding: 5px 14px; border-radius: calc(var(--radius-sm) - 2px); font-size: 13px; color: var(--color-text-secondary); transition: all 0.12s; display: flex; align-items: center; gap: 5px; }
.rv__tab--active { background: #fff; color: var(--color-text-primary); font-weight: 500; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
.rv__tab-badge { font-size: 11px; background: #e8a038; color: #fff; border-radius: 999px; padding: 0 6px; font-weight: 600; }
.rv__add-btn { margin-left: auto; padding: 7px 18px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; background: #e8a038; color: #fff; border: none; }
.rv__add-btn:hover { background: #d08828; }

/* 卡片 */
.rv__list { display: flex; flex-direction: column; gap: 10px; }
.rv__card { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 8px; }
.rv__card-header { display: flex; align-items: center; justify-content: space-between; }
.rv__card-left { display: flex; align-items: center; gap: 8px; }
.rv__card-time { font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
.rv__card-pax { font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }

.rv__status-badge { font-size: 11.5px; font-weight: 500; padding: 2px 9px; border-radius: 999px; }
.rv__status-badge--waiting   { background: #fde8c0; color: #8a6020; }
.rv__status-badge--soon      { background: #fde8c0; color: #e07020; font-weight: 600; }
.rv__status-badge--overdue   { background: #fde2e2; color: #c0392b; font-weight: 600; }
.rv__status-badge--seated    { background: #e8f3e8; color: #2f7a3d; }
.rv__status-badge--cancelled { background: #f0f0f0; color: #888; }

.rv__card-body { display: flex; flex-direction: column; gap: 3px; }
.rv__card-name  { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.rv__card-phone { font-size: 12.5px; color: var(--color-text-secondary); }
.rv__card-note  { font-size: 12px; color: var(--color-text-muted); }

.rv__card-seat { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #2f7a3d; background: #e8f3e8; padding: 5px 10px; border-radius: 6px; }
.rv__seat-time  { font-size: 11px; color: var(--color-text-muted); margin-left: 6px; }

.rv__card-footer { display: flex; justify-content: flex-end; gap: 6px; padding-top: 4px; border-top: 1px solid #f5f0e8; }
.rv__btn { padding: 6px 14px; border-radius: var(--radius-sm); font-size: 12.5px; }
.rv__btn--ghost { color: var(--color-text-secondary); background: #f0e8d8; border: 1px solid #c8b89a; }
.rv__btn--ghost:hover { background: #e8dcc8; }
.rv__card-done { font-size: 12px; color: #2f7a3d; }

.rv__empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; color: var(--color-text-muted); }
.rv__empty-icon { font-size: 40px; }
</style>