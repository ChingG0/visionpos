<template>
  <div class="dine-in">
    <AppSidebar />

    <div class="dine-in__main">
      <AppTopbar
        :active-floor="activeFloor"
        @floor-change="activeFloor = $event"
      />

      <div class="dine-in__content">
        <FloorMap
          ref="floorMapRef"
          :arranging-id="arrangingId"
          @finish-editing="handleFinishEditing"
          @seat-assigned="handleSeatAssigned"
          @cancel-arrange="cancelArrange"
        />

        <ReservationPanel
          ref="reservationPanelRef"
          :arranging-id="arrangingId"
          @add="handleAddReservation"
          @request-arrange="handleRequestArrange"
          @cancel-arrange="cancelArrange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AppSidebar      from '@/components/layout/AppSidebar.vue'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import FloorMap        from '@/components/floor/FloorMap.vue'
import ReservationPanel from '@/components/reservation/ReservationPanel.vue'

const activeFloor         = ref('1F')
const arrangingId         = ref(null)   // 正在安排入座的訂位 id
const floorMapRef         = ref(null)
const reservationPanelRef = ref(null)

/* ── 安排座位流程 ── */
function handleRequestArrange(reservationId) {
  arrangingId.value = reservationId
}

function cancelArrange() {
  arrangingId.value = null
}

function handleSeatAssigned({ reservationId, itemIds, itemNames }) {
  reservationPanelRef.value?.seatReservation(reservationId, itemIds, itemNames)
  itemIds.forEach(id => floorMapRef.value?.markItemSeated(id))
  arrangingId.value = null
}

/* ── 其他 ── */
function handleFinishEditing(items) {
  console.log('桌位已儲存', items)
}

function handleAddReservation() {
  console.log('新增訂位')
}
</script>

<style scoped>
.dine-in {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.dine-in__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.dine-in__content {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>