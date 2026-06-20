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

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppSidebar          from '@/components/layout/AppSidebar.vue'
import AppTopbar            from '@/components/layout/AppTopbar.vue'
import MenuCategoryBar      from '@/components/order/MenuCategoryBar.vue'
import MenuItemGrid         from '@/components/order/MenuItemGrid.vue'
import OrderQuickActions    from '@/components/order/OrderQuickActions.vue'
import OrderCartPanel       from '@/components/order/OrderCartPanel.vue'
import TablePickerModal     from '@/components/order/TablePickerModal.vue'
import { useMenuStore }     from '@/stores/menuStore.js'
import { useTagStore }      from '@/stores/tagStore.js'
import { useTakeoutStore }    from '@/stores/takeoutStore.js'
import { useInventoryStore }  from '@/stores/inventoryStore.js'
import { fetchTables, markTableOrdered } from '@/lib/floorOrders.js'
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
  cartItems.value = []
  selectedTagIds.value = []
  note.value = ''
  surcharge.value = null
  discount.value = null
  selectedTable.value = null
  customerName.value = ''
  customerPhone.value = ''
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

/* ── 送出訂單 ── */
async function handleCharge() {
  if (cartItems.value.length === 0) return

  if (orderType.value === 'dine-in' && !selectedTable.value) {
    openTablePicker()
    return
  }

  /* 先取得取單號，讓外帶佇列跟列印用同一個號碼 */
  const pickupNumber = await getNextPickupNumber()

  const orderPayload = {
    items:    cartItems.value,
    tags:     selectedTagObjects.value,
    note:     note.value,
    surcharge: surcharge.value,
    discount:  discount.value,
    subtotal:  subtotal.value,
    total:     total.value,
    pickupNumber,
  }

  if (orderType.value === 'takeout') {
    const order = await takeoutStore.addOrder({
      ...orderPayload,
      customerName:  customerName.value,
      customerPhone: customerPhone.value,
    })
    /* 背景扣庫存，不 await 避免拖慢結帳 */
    if (order?.id) inventoryStore.deductByOrder(order.id, cartItems.value)
  } else {
    /* 內用：標記座位狀態 + 存訂單到 dine_in_orders */
    await markTableOrdered(selectedTable.value.id)
    const order = await dineInStore.addOrder({
      seatId:   selectedTable.value.id,
      seatName: selectedTable.value.name,
      ...orderPayload,
    })
    if (order?.id) inventoryStore.deductByOrder(order.id, cartItems.value)
  }

  const printResult = await printOrderReceipt({
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
  if (!printResult.success) {
    alert('訂單已送出，但出單機列印失敗，請確認出單機是否開機並連上網路。')
  }

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