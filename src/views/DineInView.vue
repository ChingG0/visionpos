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
          :active-floor="activeFloor"
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
      @add-order="handleAddOrder"
    />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter }          from 'vue-router'
import AppSidebar         from '@/components/layout/AppSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import FloorMap           from '@/components/floor/FloorMap.vue'
import ReservationPanel   from '@/components/reservation/ReservationPanel.vue'
import SeatOrderModal     from '@/components/floor/SeatOrderModal.vue'
import { useDineInStore } from '@/stores/dineInStore.js'
import { markSeatsOrdered, fetchTables } from '@/lib/floorOrders.js'

const router      = useRouter()
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

async function handleSeatAssigned({ reservationId, itemIds, itemNames }) {
  /* 1. 更新訂位狀態 */
  reservationPanelRef.value?.seatReservation(reservationId, itemIds, itemNames)
  /* 2. 本地 FloorMap 即時更新 */
  itemIds.forEach(id => floorMapRef.value?.markItemSeated(id))
  /* 3. 持久化到 Supabase（避免切頁後座位變灰色）*/
  await markSeatsOrdered(itemIds)
  arrangingId.value = null
}

/* ── 點擊座位：若是「非主座位」，轉向主座位的訂單 ── */
async function handleSeatClick(seat) {
  /* seat 物件來自 FloorMap，可能帶有 primarySeatId（非主座位時） */
  if (seat.primarySeatId) {
    /* 找到真正的主座位資料 */
    const allItems = await fetchTables()
    const primary  = allItems.find(i => i.id === seat.primarySeatId)
    if (primary) { clickedSeat.value = primary; return }
  }
  clickedSeat.value = seat
}

/* ── 完成結帳後，通知 FloorMap 重新讀取座位狀態 ── */
async function handleOrderCompleted() {
  clickedSeat.value = null
  /* FloorMap 下次進入頁面或重新整理時會看到更新後的狀態（Supabase 已寫入）
     如果要即時反映，可以呼叫 floorMapRef 的 loadLayout，但目前先以重整為主 */
  if (floorMapRef.value?.reloadLayout) {
    await floorMapRef.value.reloadLayout()
  }
}

/* ── 加單：關閉彈窗後帶著座位資訊跳轉到新訂單 ── */
function handleAddOrder(seat) {
  clickedSeat.value = null
  router.push({ name: 'NewOrder', query: { seatId: seat.id, seatName: seat.name } })
}
function handleAddReservation()     { console.log('新增訂位') }
</script>

<style scoped>
.dine-in { width: 100%; height: 100%; display: flex; overflow: hidden; }
.dine-in__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.dine-in__content { flex: 1; display: flex; overflow: hidden; }
</style>