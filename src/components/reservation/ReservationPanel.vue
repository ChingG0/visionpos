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
        <button class="res-panel__add-btn" @click="showForm = true">新增訂位</button>
      </div>

      <!-- 選桌模式提示 -->
      <div v-if="arrangingId != null" class="res-panel__arranging-hint">
        <span>請在地圖上點選桌椅</span>
        <button class="res-panel__arranging-cancel" @click="emit('cancel-arrange')">取消</button>
      </div>

      <!-- Reservation List -->
      <div class="res-panel__list">
        <ReservationCard
          v-for="item in store.reservations"
          :key="item.id"
          :reservation="item"
          @cancel="store.cancelReservation($event)"
          @restore="store.restoreReservation($event)"
          @arrange="emit('request-arrange', $event)"
        />
      </div>

    </aside>
  </div>

  <!-- 新增訂位表單 -->
  <ReservationForm
    v-if="showForm"
    @close="showForm = false"
    @submit="handleFormSubmit"
  />
</template>

<script setup>
import { ref } from 'vue'
import ReservationCard from './ReservationCard.vue'
import ReservationForm from './ReservationForm.vue'
import { useReservationStore } from '@/stores/reservationStore.js'

defineProps({
  arrangingId: { type: Number, default: null },
})

const emit = defineEmits(['request-arrange', 'cancel-arrange'])

const store   = useReservationStore()
const showForm = ref(false)

function handleFormSubmit(data) {
  store.addReservation(data)
  showForm.value = false
}

/* 由 DineInView 呼叫 */
function seatReservation(reservationId, itemIds, itemNames) {
  store.seatReservation(reservationId, itemIds, itemNames)
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

/* ── Arranging hint ── */
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