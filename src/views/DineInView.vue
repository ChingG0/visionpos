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
      :focus-order-id="focusOrderId"
      @close="clickedSeat = null; focusOrderId = null"
      @completed="handleOrderCompleted"
      @payment-done="handlePaymentDone"
      @add-order="handleAddOrder"
      @edit-order="handleEditOrder"
    />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppSidebar         from '@/components/layout/AppSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import FloorMap           from '@/components/floor/FloorMap.vue'
import ReservationPanel   from '@/components/reservation/ReservationPanel.vue'
import SeatOrderModal     from '@/components/floor/SeatOrderModal.vue'
import { useDineInStore } from '@/stores/dineInStore.js'
import { markSeatsOrdered, fetchTables, findItemAcrossFloors } from '@/lib/floorOrders.js'

const router      = useRouter()
const route       = useRoute()
const dineInStore = useDineInStore()

const activeFloor         = ref('1F')
const arrangingId         = ref(null)
const floorMapRef         = ref(null)
const reservationPanelRef = ref(null)
const clickedSeat         = ref(null)   // { id, name, status, type }
const focusOrderId        = ref(null)

/* 從工作站「結帳」按鈕跳轉過來：網址帶 openSeatId（＋可選 openOrderId 指定分單）。
 * 要先等訂單資料載完，SeatOrderModal 開起來才讀得到內容，不然會顯示「找不到訂單」。 */
onMounted(async () => {
  const initPromise = dineInStore.init()
  const seatId = route.query.openSeatId
  if (seatId) {
    await initPromise
    const found = await findItemAcrossFloors(seatId)
    if (found) {
      activeFloor.value  = found.floorId
      clickedSeat.value  = found.item
      focusOrderId.value = route.query.openOrderId ?? null
    } else {
      alert('找不到這個座位，可能已被移除或清空。')
    }
    router.replace({ name: 'DineIn' })
  }
})

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
  /* 空位：直接跳新訂單並帶入座位號 */
  if (!seat.status || seat.status === 'empty') {
    if (seat.name) {
      router.push({ name: 'NewOrder', query: { seatId: seat.id, seatName: seat.name } })
    }
    return
  }

  /* seat 物件來自 FloorMap，可能帶有 primarySeatId（非主座位時） */
  if (seat.primarySeatId) {
    const allItems = await fetchTables()
    const primary  = allItems.find(i => i.id === seat.primarySeatId)
    if (primary) { clickedSeat.value = primary; return }
  }
  clickedSeat.value = seat
}

/* ── 付款後：刷新 FloorMap 顏色（橘→綠），但不關閉 modal ── */
async function handlePaymentDone() {
  if (floorMapRef.value?.reloadLayout) {
    await floorMapRef.value.reloadLayout()
  }
}

/* ── 完成訂單後：清桌 + 關閉 modal ── */
async function handleOrderCompleted() {
  clickedSeat.value = null
  if (floorMapRef.value?.reloadLayout) {
    await floorMapRef.value.reloadLayout()
  }
}

/* ── 加單：關閉彈窗後帶著座位資訊跳轉到新訂單 ── */
function handleAddOrder(seat) {
  clickedSeat.value = null
  router.push({ name: 'NewOrder', query: { seatId: seat.id, seatName: seat.name } })
}
/* ── 修改訂單：帶著訂單 id 跳到點餐頁的修改模式 ── */
function handleEditOrder({ seat, orderId }) {
  clickedSeat.value = null
  router.push({ name: 'NewOrder', query: { seatId: seat.id, seatName: seat.name, editOrderId: orderId } })
}

function handleAddReservation()     { console.log('新增訂位') }

/* ── 編輯桌位完成後，重新讀取 layout ── */
async function handleFinishEditing() {
  if (floorMapRef.value?.reloadLayout) {
    await floorMapRef.value.reloadLayout()
  }
}
</script>

<style scoped>
.dine-in { width: 100%; height: 100%; display: flex; overflow: hidden; }
.dine-in__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
.dine-in__content { flex: 1; display: flex; overflow: hidden; }
</style>