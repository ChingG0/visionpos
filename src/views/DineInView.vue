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
          @seat-click="handleSeatClick"
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

    <!-- 座位訂單詳情彈窗 -->
    <SeatOrderModal
      v-if="clickedSeat"
      :seat="clickedSeat"
      @close="clickedSeat = null"
      @completed="handleOrderCompleted"
    />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppSidebar         from '@/components/layout/AppSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import FloorMap           from '@/components/floor/FloorMap.vue'
import ReservationPanel   from '@/components/reservation/ReservationPanel.vue'
import SeatOrderModal     from '@/components/floor/SeatOrderModal.vue'
import { useDineInStore } from '@/stores/dineInStore.js'

const dineInStore = useDineInStore()
onMounted(() => dineInStore.init())

const activeFloor         = ref('1F')
const arrangingId         = ref(null)
const floorMapRef         = ref(null)
const reservationPanelRef = ref(null)
const clickedSeat         = ref(null)   // { id, name, status, type }

/* ── 安排座位流程 ── */
function handleRequestArrange(reservationId) { arrangingId.value = reservationId }
function cancelArrange() { arrangingId.value = null }

function handleSeatAssigned({ reservationId, itemIds, itemNames }) {
  reservationPanelRef.value?.seatReservation(reservationId, itemIds, itemNames)
  itemIds.forEach(id => floorMapRef.value?.markItemSeated(id))
  arrangingId.value = null
}

/* ── 點擊已點餐座位 → 顯示訂單 ── */
function handleSeatClick(seat) {
  clickedSeat.value = seat
}

/* ── 完成結帳後，通知 FloorMap 重新讀取座位狀態 ── */
async function handleOrderCompleted(seatId) {
  clickedSeat.value = null
  /* FloorMap 下次進入頁面或重新整理時會看到更新後的狀態（Supabase 已寫入）
     如果要即時反映，可以呼叫 floorMapRef 的 loadLayout，但目前先以重整為主 */
  if (floorMapRef.value?.reloadLayout) {
    await floorMapRef.value.reloadLayout()
  }
}

function handleFinishEditing(items) { console.log('桌位已儲存', items) }
function handleAddReservation()     { console.log('新增訂位') }
</script>

<style scoped>
.dine-in { width: 100%; height: 100%; display: flex; overflow: hidden; }
.dine-in__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.dine-in__content { flex: 1; display: flex; overflow: hidden; }
</style>