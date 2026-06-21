<template>
  <div class="new-order">

    <AppSidebar />

    <div class="new-order__main">
      <AppTopbar :show-floor-tabs="false" title="新訂單" />

      <div class="new-order__content">

        <!-- 左：菜單 -->
        <section class="new-order__menu">
          <MenuCategoryBar
            :categories="menuStore.categories"
            :active-category-id="activeCategoryId"
            :search="searchQuery"
            @select="activeCategoryId = $event"
            @update:search="searchQuery = $event"
          />
          <MenuItemGrid
            :items="filteredItems"
            :cart-qty-map="cartQtyMap"
            @add="handleAddItem"
          />
          <OrderQuickActions
            :tags="tagStore.tags"
            :selected-tag-ids="selectedTagIds"
            :note="note"
            :surcharge="surcharge"
            :discount="discount"
            @update:selected-tag-ids="selectedTagIds = $event"
            @update:note="note = $event"
            @update:surcharge="surcharge = $event"
            @update:discount="discount = $event"
          />
        </section>

        <!-- 右：購物車 -->
        <OrderCartPanel
          :cart-items="cartItems"
          :note="note"
          :selected-tags="selectedTagObjects"
          :surcharge="surcharge"
          :discount="discount"
          :order-type="orderType"
          :table-name="selectedTable?.name ?? ''"
          :customer-name="customerName"
          :customer-phone="customerPhone"
          @increase="increaseQty"
          @decrease="decreaseQty"
          @remove="removeItem"
          @clear="clearCart"
          @charge="handleCharge"
          @update:order-type="handleOrderTypeChange"
          @change-table="openTablePicker"
          @update:customer-name="customerName = $event"
          @update:customer-phone="customerPhone = $event"
        />

      </div>
    </div>

    <TablePickerModal
      v-if="showTablePicker"
      :tables="availableTables"
      :loading="loadingTables"
      @close="showTablePicker = false"
      @select="selectTable"
    />

    <PaymentModal
      v-if="showPaymentModal"
      :total="total"
      @close="showPaymentModal = false"
      @paid="handlePaymentConfirmed"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar          from '@/components/layout/AppSidebar.vue'
import AppTopbar            from '@/components/layout/AppTopbar.vue'
import MenuCategoryBar      from '@/components/order/MenuCategoryBar.vue'
import MenuItemGrid         from '@/components/order/MenuItemGrid.vue'
import OrderQuickActions    from '@/components/order/OrderQuickActions.vue'
import OrderCartPanel       from '@/components/order/OrderCartPanel.vue'
import TablePickerModal     from '@/components/order/TablePickerModal.vue'
import PaymentModal         from '@/components/order/PaymentModal.vue'
import { useMenuStore }     from '@/stores/menuStore.js'
import { useTagStore }      from '@/stores/tagStore.js'
import { useTakeoutStore }    from '@/stores/takeoutStore.js'
import { useInventoryStore }  from '@/stores/inventoryStore.js'
import { fetchTables, markTableOrdered, markTablePaid } from '@/lib/floorOrders.js'
import { printOrderReceipt, getNextPickupNumber } from '@/lib/printer.js'
import { useDineInStore } from '@/stores/dineInStore.js'

const menuStore    = useMenuStore()
const tagStore     = useTagStore()
const takeoutStore    = useTakeoutStore()
const inventoryStore  = useInventoryStore()
const dineInStore     = useDineInStore()

/* ── 分類 / 搜尋 ── */
const activeCategoryId = ref(menuStore.categories[0]?.id ?? '')
const searchQuery       = ref('')

/* 有搜尋字串時，搜尋全部「已上架」品項；否則依分類篩選「已上架」品項 */
const filteredItems = computed(() => {
  const q = searchQuery.value.trim()
  const list = q
    ? menuStore.items.filter(i => i.status && i.name.includes(q))
    : menuStore.items.filter(i => i.status && i.categoryId === activeCategoryId.value)

  /* publishAt 只會更新每個商品的 sortOrder 數值，不會搬動陣列本身的順序，
     所以這裡一定要自己依 sortOrder 排，才會跟「點餐設定」拖曳的結果一致 */
  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
})

/* ── 購物車（之後可改 Pinia cartStore，目前先放本頁） ── */
const cartItems = ref([])
/* cart line: { id, menuItemId, code, name, price, qty, icon } */

function handleAddItem(item) {
  const existing = cartItems.value.find(l => l.menuItemId === item.id)
  if (existing) {
    existing.qty += 1
  } else {
    cartItems.value.push({
      id:         `${item.id}-${Date.now()}`,
      menuItemId: item.id,
      code:       item.code || '',   // 商品編號（A01, B02...），供列印排序用
      name:       item.name,
      price:      item.price,
      qty:        1,
      icon:       item.icon,
    })
  }
}

function increaseQty(lineId) {
  const line = cartItems.value.find(l => l.id === lineId)
  if (line) line.qty += 1
}

function decreaseQty(lineId) {
  const line = cartItems.value.find(l => l.id === lineId)
  if (!line) return
  line.qty -= 1
  if (line.qty <= 0) removeItem(lineId)
}

function removeItem(lineId) {
  cartItems.value = cartItems.value.filter(l => l.id !== lineId)
}

function clearCart() {
  cartItems.value      = []
  selectedTagIds.value = []
  note.value           = ''
  surcharge.value      = null
  discount.value       = null
  selectedTable.value  = null
  customerName.value   = ''
  customerPhone.value  = ''
  sessionStorage.removeItem(CART_KEY)
}

/* 商品格右上角數量徽章用：menuItemId → 總數量 */
const cartQtyMap = computed(() => {
  const map = {}
  for (const line of cartItems.value) {
    map[line.menuItemId] = (map[line.menuItemId] ?? 0) + line.qty
  }
  return map
})

/* ── 訂單層級附加資訊：標籤 / 備註 / 加價 / 折扣 ── */
const selectedTagIds = ref([])
const note            = ref('')
const surcharge        = ref(null)
const discount         = ref(null)

/* ── 外帶客戶資訊 ── */
const customerName  = ref('')
const customerPhone = ref('')

const selectedTagObjects = computed(() =>
  tagStore.tags.filter(t => selectedTagIds.value.includes(t.id))
)

/* ── 內用 / 外帶 ── */
const orderType      = ref('dine-in')
const selectedTable   = ref(null)

const route = useRoute()
const CART_KEY = 'visionpos:cart'

onMounted(async () => {
  /* 還原上次未送出的購物車 */
  const saved = sessionStorage.getItem(CART_KEY)
  if (saved && !route.query.seatId) {
    try {
      const d = JSON.parse(saved)
      if (d.items?.length) {
        cartItems.value     = d.items     ?? []
        orderType.value     = d.orderType ?? 'dine-in'
        selectedTable.value = d.seat      ?? null
        selectedTagIds.value= d.tags      ?? []
        note.value          = d.note      ?? ''
        surcharge.value     = d.surcharge ?? null
        discount.value      = d.discount  ?? null
        customerName.value  = d.customerName  ?? ''
        customerPhone.value = d.customerPhone ?? ''
      }
    } catch (e) { console.warn('[cart] 還原購物車失敗', e) }
  }

  /* 從內用頁「加單」跳轉過來時，帶有 seatId/seatName query */
  if (route.query.seatId && route.query.seatName) {
    orderType.value     = 'dine-in'
    selectedTable.value = { id: route.query.seatId, name: route.query.seatName }
  }

  await menuStore.init()
  await tagStore.init()
})

/* 購物車有內容時，自動存到 sessionStorage（切頁不會遺失） */
watch(
  [cartItems, orderType, selectedTable, selectedTagIds, note, surcharge, discount, customerName, customerPhone],
  () => {
    if (!cartItems.value.length) { sessionStorage.removeItem(CART_KEY); return }
    sessionStorage.setItem(CART_KEY, JSON.stringify({
      items:         cartItems.value,
      orderType:     orderType.value,
      seat:          selectedTable.value,
      tags:          selectedTagIds.value,
      note:          note.value,
      surcharge:     surcharge.value,
      discount:      discount.value,
      customerName:  customerName.value,
      customerPhone: customerPhone.value,
    }))
  },
  { deep: true }
)
const showTablePicker = ref(false)
const availableTables = ref([])
const loadingTables   = ref(false)

function handleOrderTypeChange(type) {
  orderType.value = type
  if (type === 'takeout') selectedTable.value = null
  if (type === 'dine-in') { customerName.value = ''; customerPhone.value = '' }
}

async function openTablePicker() {
  loadingTables.value = true
  showTablePicker.value = true
  availableTables.value = await fetchTables()
  loadingTables.value = false
}

function selectTable(table) {
  selectedTable.value = table
  showTablePicker.value = false
}

/* ── 金額計算 ── */
const subtotal = computed(() =>
  cartItems.value.reduce((s, l) => s + l.price * l.qty, 0)
)
const surchargeAmount = computed(() => surcharge.value?.amount ?? 0)
const discountAmount = computed(() => {
  if (!discount.value?.value) return 0
  const base = subtotal.value + surchargeAmount.value
  return discount.value.type === 'percent'
    ? Math.round(base * (discount.value.value / 100))
    : Math.min(discount.value.value, base)
})
const total = computed(() =>
  Math.max(0, subtotal.value + surchargeAmount.value - discountAmount.value)
)

/* ── 結帳流程 ── */
const showPaymentModal = ref(false)

/* Step 1：點結帳先驗證，再開付款 Modal */
function handleCharge() {
  if (cartItems.value.length === 0) return
  if (orderType.value === 'dine-in' && !selectedTable.value) { openTablePicker(); return }
  showPaymentModal.value = true
}

/* Step 2：付款 Modal 確認後才真正送出訂單 */
async function handlePaymentConfirmed({ method, methodLabel, paymentAmount, changeAmount }) {
  showPaymentModal.value = false

  const pickupNumber = await getNextPickupNumber()

  const paymentFields = {
    paymentMethod: methodLabel,
    paymentAmount,
    changeAmount,
  }

  const orderPayload = {
    items:     cartItems.value,
    tags:      selectedTagObjects.value,
    note:      note.value,
    surcharge: surcharge.value,
    discount:  discount.value,
    subtotal:  subtotal.value,
    total:     total.value,
    pickupNumber,
    ...paymentFields,
  }

  if (orderType.value === 'takeout') {
    const order = await takeoutStore.addOrder({
      ...orderPayload,
      customerName:  customerName.value,
      customerPhone: customerPhone.value,
    })
    if (order?.id) inventoryStore.deductByOrder(order.id, cartItems.value)
  } else {
    /* 稍後付款 → 橙色（未結帳）；其他付款方式 → 綠色（已結帳） */
    const isDefer = (method === 'defer')
    await (isDefer ? markTableOrdered : markTablePaid)(selectedTable.value.id)

    const order = await dineInStore.addOrder({
      seatId:   selectedTable.value.id,
      seatName: selectedTable.value.name,
      ...orderPayload,
    })
    if (order?.id) inventoryStore.deductByOrder(order.id, cartItems.value)
  }

  /* 列印：fire-and-forget，不 await，避免無出單機時卡 3 秒 */
  printOrderReceipt({
    pickupNumber,
    orderType: orderType.value,
    tableName: selectedTable.value?.name,
    items:     cartItems.value,
    tags:      selectedTagObjects.value,
    note:      note.value,
    subtotal:  subtotal.value,
    surchargeAmount: surchargeAmount.value,
    discountAmount:  discountAmount.value,
    total:     total.value,
  })

  clearCart()
}
</script>

<style scoped>
.new-order {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.new-order__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.new-order__content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.new-order__menu {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 18px 16px;
  overflow: hidden;
  min-width: 0;
  background: var(--color-bg-map);
}
</style>