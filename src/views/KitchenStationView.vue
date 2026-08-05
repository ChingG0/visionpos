<template>
  <div class="ks">
    <AppSidebar />

    <div class="ks__main">
      <AppTopbar :show-floor-tabs="false" title="" />

      <!-- 頁面標題 + 檢視切換 -->
      <div class="ks__page-header">
        <div class="ks__page-header-left">
          <h2 class="ks__title">工作站</h2>
          <button
            class="ks__view-btn"
            :aria-label="isCompact ? '切換為展開檢視' : '切換為緊湊檢視'"
            @click="isCompact = !isCompact"
          >
            <svg v-if="isCompact" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="7.5" y="1" width="5" height="5" rx="1"/><rect x="14" y="1" width="5" height="5" rx="1"/>
              <rect x="1" y="7.5" width="5" height="5" rx="1"/><rect x="7.5" y="7.5" width="5" height="5" rx="1"/><rect x="14" y="7.5" width="5" height="5" rx="1"/>
              <rect x="1" y="14" width="5" height="5" rx="1"/><rect x="7.5" y="14" width="5" height="5" rx="1"/><rect x="14" y="14" width="5" height="5" rx="1"/>
            </svg>
            <svg v-else viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="1" y="1" width="8" height="8" rx="1.5"/><rect x="11" y="1" width="8" height="8" rx="1.5"/>
              <rect x="1" y="11" width="8" height="8" rx="1.5"/><rect x="11" y="11" width="8" height="8" rx="1.5"/>
            </svg>
          </button>
        </div>
        <span class="ks__count-badge">{{ isStationTab ? `${aggregateList.length} 項` : `${ticketList.length} 張` }}</span>
      </div>

      <div class="ks__tabs">
        <button
          v-for="tab in TABS" :key="tab.id"
          class="ks__tab"
          :class="{ 'ks__tab--active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >{{ tab.label }}</button>
      </div>

      <!-- 內容區 -->
      <div class="ks__body" :class="{ 'ks__body--h': !isCompact }">
        <p v-if="loading" class="ks__empty">載入中...</p>

        <!-- 工作站分頁：彙總各站尚未出餐的品項總數量（在「所有訂單/內用/外帶」標示已出餐時會自動扣除） -->
        <template v-else-if="isStationTab">
          <p v-if="aggregateList.length === 0" class="ks__empty">目前這個工作站沒有待處理的品項</p>
          <div v-else class="ks__grid" :class="isCompact ? 'ks__grid--compact' : 'ks__grid--h'">
            <div v-for="agg in aggregateList" :key="agg.menuItemId" class="ks__card ks__card--agg">
              <span class="ks__agg-name">{{ agg.name }}</span>
              <span class="ks__agg-qty">x{{ agg.qty }}</span>
            </div>
          </div>
        </template>

        <!-- 所有訂單/內用/外帶：依單顯示，全部品項都標示已出餐後該單自動隱藏（僅畫面隱藏，實際完成仍由前台結帳處理） -->
        <template v-else>
          <p v-if="ticketList.length === 0" class="ks__empty">目前沒有符合條件的訂單</p>
          <div v-else class="ks__grid" :class="isCompact ? 'ks__grid--compact' : 'ks__grid--h'">
            <div v-for="ticket in ticketList" :key="`${ticket.source}-${ticket.orderId}`" class="ks__card">

              <div class="ks__card-head">
                <span class="ks__card-label" :class="`ks__card-label--${ticket.source}`">{{ ticket.label }}</span>
                <div class="ks__card-head-right">
                  <span class="ks__card-elapsed" :class="{ 'ks__card-elapsed--warn': isLongWait(ticket.createdAt) }">
                    {{ elapsedTime(ticket.createdAt) }}
                  </span>
                  <button v-if="isUnpaidTicket(ticket)" class="ks__checkout-btn" @click.stop="goCheckout(ticket)">
                    結帳
                  </button>
                </div>
              </div>

              <div class="ks__items">
                <div
                  v-for="line in ticket.items" :key="line.id"
                  class="ks__item"
                  :class="{ 'ks__item--served': line.served }"
                  @click="toggleServed(ticket, line.id)"
                >
                  <div class="ks__item-main">
                    <span class="ks__item-name">{{ line.name }}</span>
                    <span class="ks__item-qty">x{{ line.qty }}</span>
                  </div>
                  <div v-if="line.tags?.length || line.note" class="ks__item-extras">
                    <span v-for="tag in line.tags" :key="tag.id" class="ks__item-tag">{{ tag.label }}</span>
                    <span v-if="line.note" class="ks__item-note">📝 {{ line.note }}</span>
                  </div>
                </div>
              </div>

              <div v-if="ticket.tags?.length || ticket.note" class="ks__card-footer">
                <div v-if="ticket.tags?.length" class="ks__card-tags">
                  <span
                    v-for="tag in ticket.tags" :key="tag.id"
                    class="ks__tag-pill"
                    :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }"
                  >{{ tag.label }}</span>
                </div>
                <div v-if="ticket.note" class="ks__card-note">📝 {{ ticket.note }}</div>
              </div>

            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar   from '@/components/layout/AppTopbar.vue'
import { useDineInStore }  from '@/stores/dineInStore.js'
import { useTakeoutStore } from '@/stores/takeoutStore.js'
import { useMenuStore }    from '@/stores/menuStore.js'
import { KITCHEN_STATIONS } from '@/constants/kitchenStations.js'
import { TAG_COLOR_MAP }    from '@/constants/tagColors.js'

const router       = useRouter()
const dineInStore  = useDineInStore()
const takeoutStore = useTakeoutStore()
const menuStore    = useMenuStore()

const loading = computed(() => dineInStore.loading || takeoutStore.loading)

// 內用訂單 store 只在進入內用頁時才會 init（有自己的 realtime 訂閱），
// 工作站頁面是獨立入口，所以要自己確保資料已載入。takeoutStore 已在 App.vue
// 全域 init 過，這裡呼叫 init() 也沒關係（內部有 loaded 旗標避免重複讀取）。
onMounted(() => {
  dineInStore.init()
  takeoutStore.init()
})

/* ── 分頁：所有訂單 / 內用 / 外帶 / 各工作站 ── */
const TABS = [
  { id: 'all',      label: '所有訂單' },
  { id: 'dine-in',  label: '內用' },
  { id: 'takeout',  label: '外帶' },
  ...KITCHEN_STATIONS,
]
const activeTab   = ref('all')
const isStationTab = computed(() => KITCHEN_STATIONS.some(s => s.id === activeTab.value))

/* ── 檢視模式：compact = 3x3 網格（多列往下捲），expanded = 3x1 單列（往右滑）── */
const isCompact = ref(true)

function tagColorOf(tag) {
  return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
}

/* 商品目前設定的工作站（依 menuItemId 查商品管理設定，即時反映最新設定） */
function itemStations(line) {
  return menuStore.items.find(i => i.id === line.menuItemId)?.stations ?? []
}

/* ── 內用 + 外帶目前進行中的訂單，合併成統一的「單」列表（品項保留完整，未依分頁篩選）── */
const allOrders = computed(() => {
  const list = []

  for (const seatId in dineInStore.activeOrders) {
    for (const order of dineInStore.activeOrders[seatId]) {
      list.push({
        source:        'dine-in',
        orderId:       order.id,
        seatId:        order.seatId,
        label:         `內用 ${order.seatName || order.seatId}`,
        createdAt:     order.createdAt,
        items:         order.items ?? [],
        tags:          order.tags  ?? [],
        note:          order.note  ?? '',
        paymentMethod: order.paymentMethod,
      })
    }
  }

  for (const order of takeoutStore.orders) {
    list.push({
      source:        'takeout',
      orderId:       order.id,
      label:         `外帶 ${order.pickupNumber != null ? '#' + String(order.pickupNumber).padStart(2, '0') : ''}`,
      createdAt:     order.createdAt,
      items:         order.items ?? [],
      tags:          order.tags  ?? [],
      note:          order.note  ?? '',
      paymentMethod: order.paymentMethod,
    })
  }

  // 點餐順序：依訂單成立時間排序
  return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
})

/* ── 所有訂單/內用/外帶：依單顯示；一張單所有品項都標示已出餐後，
 *    這張單就從工作站畫面消失（純畫面隱藏，前台/報表的訂單狀態完全不受影響，
 *    真正結束這張單還是要在前台結帳完成）。 ── */
const ticketList = computed(() => {
  const tab = activeTab.value
  let list = allOrders.value

  if (tab === 'dine-in' || tab === 'takeout') {
    list = list.filter(t => t.source === tab)
  }

  return list.filter(t => t.items.some(line => !line.served))
})

/* ── 工作站分頁：彙總「這個工作站」目前還沒出餐的品項總數量，依品名分組。
 *    在所有訂單/內用/外帶標示已出餐後，這裡的總數會自動扣除對應的數量。 ── */
const aggregateList = computed(() => {
  const tab = activeTab.value
  if (!isStationTab.value) return []

  const map = {}
  for (const order of allOrders.value) {
    for (const line of order.items) {
      if (line.served) continue
      if (!itemStations(line).includes(tab)) continue
      if (!map[line.menuItemId]) map[line.menuItemId] = { menuItemId: line.menuItemId, name: line.name, qty: 0 }
      map[line.menuItemId].qty += line.qty
    }
  }
  return Object.values(map).sort((a, b) => b.qty - a.qty)
})

/* ── 結帳捷徑：只有還沒收錢（稍後付款/未付款）的單才需要，已經付過款的
 *    只是還沒出餐/取餐，這裡沒東西好結，不顯示按鈕。跳轉後前台頁面會自己
 *    帶著 openSeatId/openOrderId（外帶則是 openOrderId）直接開啟正確的那張單，
 *    真正的收款動作還是在 SeatOrderModal / TakeoutView 原本那套流程完成，
 *    這裡只負責導頁。 ── */
function isUnpaidTicket(ticket) {
  return !ticket.paymentMethod || ticket.paymentMethod === '稍後付款'
}

function goCheckout(ticket) {
  if (ticket.source === 'dine-in') {
    router.push({ name: 'DineIn', query: { openSeatId: ticket.seatId, openOrderId: ticket.orderId } })
  } else {
    router.push({ name: 'Takeout', query: { openOrderId: ticket.orderId } })
  }
}

/* ── 已出餐切換：只在工作站畫面內部使用，收銀台/報表都不需要理會這個欄位 ── */
async function toggleServed(ticket, lineId) {
  let fullItems
  if (ticket.source === 'dine-in') {
    const order = (dineInStore.activeOrders[ticket.seatId] ?? []).find(o => o.id === ticket.orderId)
    if (!order) return
    fullItems = order.items ?? []
  } else {
    const order = takeoutStore.orders.find(o => o.id === ticket.orderId)
    if (!order) return
    fullItems = order.items ?? []
  }

  const newItems = fullItems.map(line => line.id === lineId ? { ...line, served: !line.served } : line)

  if (ticket.source === 'dine-in') {
    await dineInStore.updateOrderItems(ticket.orderId, ticket.seatId, newItems)
  } else {
    await takeoutStore.updateOrderItems(ticket.orderId, newItems)
  }
}

/* ── 已過時間（HH:MM，跟外帶頁面同一套格式）── */
const now = ref(Date.now())
let clockTimer = null
onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now() }, 1000 * 30) })
onUnmounted(() => { clearInterval(clockTimer) })

function elapsedTime(createdAt) {
  if (!createdAt) return '--:--'
  const diff = Math.max(0, Math.floor((now.value - new Date(createdAt).getTime()) / 1000))
  const hours   = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function isLongWait(createdAt) {
  if (!createdAt) return false
  return (now.value - new Date(createdAt).getTime()) > 10 * 60 * 1000
}
</script>

<style scoped>
.ks { width: 100%; height: 100%; display: flex; overflow: hidden; }
.ks__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.ks__page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 20px 4px; flex-shrink: 0;
}
.ks__page-header-left { display: flex; align-items: center; gap: 10px; }
.ks__title { font-size: 20px; font-weight: 600; color: var(--color-text-primary); }
.ks__count-badge {
  font-size: 12.5px; font-weight: 500; color: #8a6020;
  background: #fde8c0; padding: 4px 12px; border-radius: var(--radius-full);
}

.ks__view-btn {
  width: 30px; height: 30px; border-radius: var(--radius-sm);
  background: #f0e8d8; color: #7a6850;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
}
.ks__view-btn:hover { background: #e8dcc8; }

.ks__tabs {
  display: flex; gap: 4px; padding: 8px 20px; flex-shrink: 0;
  overflow-x: auto;
}
.ks__tab {
  padding: 6px 16px; border-radius: var(--radius-sm);
  font-size: 13px; font-weight: 500; color: var(--color-text-secondary);
  background: #f0e8d8; border: 1px solid transparent; white-space: nowrap;
  transition: background 0.12s;
}
.ks__tab:hover:not(.ks__tab--active) { background: #e8dcc8; }
.ks__tab--active {
  background: var(--color-bg-floor-tab-active, #fde8c0);
  border-color: var(--color-border-btn, #e8c888);
  color: var(--color-text-primary);
}

.ks__body { flex: 1; overflow-y: auto; padding: 8px 16px 16px; background: var(--color-bg-map); }
.ks__body--h { overflow: hidden; display: flex; flex-direction: column; }
.ks__empty { text-align: center; color: var(--color-text-muted); font-size: var(--fs-base); padding: 60px 0; }

/* ── 3x3 緊湊網格：多列往下捲 ── */
.ks__grid--compact {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: min-content;
  gap: 12px;
  align-content: start;
}

/* ── 3x1 橫向：一列 3 張，往右滑看更多 ── */
.ks__grid--h {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: flex-start;
  scroll-snap-type: x mandatory;
  padding-bottom: 4px;
}
.ks__grid--h .ks__card {
  flex: 0 0 calc(33.333% - 8px);
  min-width: 220px;
  scroll-snap-align: start;
}

.ks__card {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 10px 12px; overflow: hidden;
}

.ks__card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding-bottom: 6px; border-bottom: 1px dashed #ede5d0; margin-bottom: 6px;
}
.ks__card-label { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.ks__card-label--takeout { color: #8a6020; }
.ks__card-head-right { display: flex; align-items: center; gap: 8px; }
.ks__card-elapsed { font-size: 12.5px; color: var(--color-text-secondary); font-variant-numeric: tabular-nums; }
.ks__card-elapsed--warn { color: #e07020; font-weight: 600; }
.ks__checkout-btn {
  font-size: 11.5px; font-weight: 600; color: #fff;
  background: #e07020; border: none;
  padding: 4px 11px; border-radius: 999px; white-space: nowrap;
}
.ks__checkout-btn:hover { background: #c06010; }

.ks__items { display: flex; flex-direction: column; gap: 4px; }
.ks__item {
  padding: 7px 9px; border-radius: 8px; background: #faf5ec;
  font-size: 14px; color: var(--color-text-primary); cursor: pointer;
  transition: background 0.15s, color 0.15s;
  user-select: none;
}
.ks__item:hover { background: #f0e8d8; }
.ks__item--served {
  background: #e1f3e1; color: #6a8a6a; text-decoration: line-through;
}
.ks__item-main { display: flex; align-items: center; justify-content: space-between; }
.ks__item-name { flex: 1; }
.ks__item-qty { flex-shrink: 0; font-weight: 600; margin-left: 8px; }

.ks__item-extras { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 4px; }
.ks__item-tag {
  font-size: 11.5px; font-weight: 600;
  color: #c0392b; background: #ffe8e4;
  padding: 1px 8px; border-radius: 999px;
}
.ks__item--served .ks__item-tag { color: #7a8a7a; background: #d8ecd8; }
.ks__item-note { font-size: 11.5px; color: var(--color-text-secondary); }

.ks__card-footer { margin-top: 6px; display: flex; flex-direction: column; gap: 5px; }
.ks__card-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.ks__tag-pill { font-size: 11.5px; font-weight: 500; padding: 2px 9px; border-radius: 999px; }
.ks__card-note {
  font-size: 12.5px; color: var(--color-text-secondary);
  background: #faf5ec; padding: 5px 8px; border-radius: var(--radius-sm);
}

/* ── 工作站彙總卡片 ── */
.ks__card--agg {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px;
}
.ks__agg-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.ks__agg-qty  { font-size: 18px; font-weight: 700; color: #8a6020; }
</style>
