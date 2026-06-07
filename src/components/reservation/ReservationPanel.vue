<template>
  <div class="res-wrapper">

    <!-- 今日訂位 divider strip -->
    <div class="today-strip">
      <span class="today-strip__text">今日訂位</span>
      <span class="today-strip__arrow" aria-hidden="true">›</span>
    </div>

    <!-- 訂位面板 -->
    <aside class="res-panel">

      <!-- Header -->
      <div class="res-panel__header">
        <button class="res-panel__add-btn" @click="emit('add')">新增訂位</button>
      </div>

      <!-- 選桌模式提示 -->
      <div v-if="arrangingId != null" class="res-panel__arranging-hint">
        <span>請在地圖上點選桌椅</span>
        <button class="res-panel__arranging-cancel" @click="emit('cancel-arrange')">取消</button>
      </div>

      <!-- Reservation List -->
      <div class="res-panel__list">
        <ReservationCard
          v-for="item in reservations"
          :key="item.id"
          :reservation="item"
          @cancel="handleCancel"
          @restore="handleRestore"
          @arrange="handleArrange"
        />
      </div>

    </aside>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ReservationCard from './ReservationCard.vue'

defineProps({
  arrangingId: { type: Number, default: null },
})

const emit = defineEmits(['add', 'request-arrange', 'cancel-arrange'])

/* ── Reservations data（之後從 Supabase store 取得）── */
const reservations = ref([
  { id:1, name:'王小姐', phone:'0912345678', time:'18:00', timeLabel:'30分鐘後', urgency:'red',    guests:4, status:'waiting', seatedAt:null, assignedItemIds:[], assignedItemNames:[] },
  { id:2, name:'陳小姐', phone:'0912345678', time:'18:30', timeLabel:'1小時後',  urgency:'orange', guests:2, status:'waiting', seatedAt:null, assignedItemIds:[], assignedItemNames:[] },
  { id:3, name:'林先生', phone:'0912345678', time:'19:00', timeLabel:'1小時後',  urgency:'orange', guests:1, status:'waiting', seatedAt:null, assignedItemIds:[], assignedItemNames:[] },
  { id:4, name:'陳先生', phone:'0912345678', time:'19:00', timeLabel:'1小時後',  urgency:'orange', guests:2, status:'waiting', seatedAt:null, assignedItemIds:[], assignedItemNames:[] },
  { id:5, name:'孫先生', phone:'0912345678', time:'20:30', timeLabel:'2小時後',  urgency:'blue',   guests:2, status:'waiting', seatedAt:null, assignedItemIds:[], assignedItemNames:[] },
  { id:6, name:'何先生', phone:'0912345678', time:'21:00', timeLabel:'2.5小時後',urgency:'blue',   guests:1, status:'waiting', seatedAt:null, assignedItemIds:[], assignedItemNames:[] },
])

/* ── Handlers ── */
function handleCancel(id) {
  const r = reservations.value.find(r => r.id === id)
  if (!r || r.status !== 'waiting') return
  r.status = 'cancelled'
}

function handleRestore(id) {
  const r = reservations.value.find(r => r.id === id)
  if (!r || r.status !== 'cancelled') return
  r.status         = 'waiting'
  r.seatedAt       = null
  r.assignedItemIds = []
}

function handleArrange(id) {
  emit('request-arrange', id)
}

/* ── 被 DineInView 呼叫（confirm 入座）── */
function seatReservation(reservationId, itemIds, itemNames) {
  const r = reservations.value.find(r => r.id === reservationId)
  if (!r || r.status !== 'waiting') return
  r.status            = 'seated'
  r.seatedAt          = Date.now()
  r.assignedItemIds   = itemIds
  r.assignedItemNames = itemNames
}

defineExpose({ seatReservation })
</script>

<style scoped>
.res-wrapper {
  display: flex;
  flex-shrink: 0;
}

/* ── Today Strip ── */
.today-strip {
  width: var(--today-strip-width);
  background: var(--color-bg-today-strip);
  border-left: 1px solid var(--color-border-base);
  border-right: 1px solid var(--color-border-base);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.today-strip__text {
  writing-mode: vertical-rl;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--color-text-brand);
  letter-spacing: 3px;
  white-space: nowrap;
}

.today-strip__arrow {
  position: absolute;
  right: -9px;
  width: 9px;
  height: 28px;
  background: var(--color-border-base);
  border-radius: 0 5px 5px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  color: var(--color-text-secondary);
}

/* ── Panel ── */
.res-panel {
  width: var(--res-panel-width);
  background: var(--color-bg-panel);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.res-panel__header {
  padding: 6px 9px;
  border-bottom: 1px solid var(--color-border-base);
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.res-panel__add-btn {
  padding: 4px 9px;
  background: var(--color-bg-add-btn);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--color-text-primary);
  transition: background 0.12s;
}

.res-panel__add-btn:hover { background: var(--color-bg-arrange-btn); }

/* ── Arranging hint banner ── */
.res-panel__arranging-hint {
  padding: 6px 9px;
  background: #fff8e8;
  border-bottom: 1px solid #e8c878;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-sm);
  color: #7a5020;
  flex-shrink: 0;
}

.res-panel__arranging-cancel {
  padding: 2px 8px;
  background: #fff;
  border: 1px solid #c8a060;
  border-radius: var(--radius-xs);
  font-size: var(--fs-xs);
  color: #7a5020;
  transition: background 0.12s;
}

.res-panel__arranging-cancel:hover { background: #fff0d8; }

/* ── List ── */
.res-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.res-panel__list::-webkit-scrollbar { width: 2px; }
.res-panel__list::-webkit-scrollbar-thumb { background: #c0b090; border-radius: 2px; }
</style>