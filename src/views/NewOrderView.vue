<template>
  <div class="new-order">

    <AppSidebar />

    <div class="new-order__main">
      <AppTopbar :show-floor-tabs="false" :title="editOrderId ? '修改訂單' : '新訂單'" />

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
            :tags="tagStore.quickTags"
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
          :edit-mode="!!editOrderId"
          @increase="increaseQty"
          @decrease="decreaseQty"
          @remove="removeItem"
          @edit-line="openLineEditor"
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

    <!-- 單品備註／標籤（點購物車品項空白處開啟）-->
    <ItemNoteModal
      v-if="editingLine"
      :line="editingLine"
      :all-tags="tagStore.tags"
      :preferred-ids="editingLinePreferredTagIds"
      @close="editingLine = null"
      @save="saveLineEdit"
      @remove="removeEditingLine"
    />

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppSidebar          from '@/components/layout/AppSidebar.vue'
import AppTopbar            from '@/components/layout/AppTopbar.vue'
import MenuCategoryBar      from '@/components/order/MenuCategoryBar.vue'
import MenuItemGrid         from '@/components/order/MenuItemGrid.vue'
import OrderQuickActions    from '@/components/order/OrderQuickActions.vue'
import OrderCartPanel       from '@/components/order/OrderCartPanel.vue'
import TablePickerModal     from '@/components/order/TablePickerModal.vue'
import PaymentModal         from '@/components/order/PaymentModal.vue'
import ItemNoteModal        from '@/components/order/ItemNoteModal.vue'
import { useMenuStore }     from '@/stores/menuStore.js'
import { useTagStore }      from '@/stores/tagStore.js'
import { useTakeoutStore }    from '@/stores/takeoutStore.js'
import { useInventoryStore }  from '@/stores/inventoryStore.js'
import { fetchTables, markTableOrdered, markTablePaid } from '@/lib/floorOrders.js'
import { printOrderReceipt, printKitchenTickets, getNextPickupNumber } from '@/lib/printer.js'
import { useDineInStore } from '@/stores/dineInStore.js'

const menuStore       = useMenuStore()
const tagStore        = useTagStore()
const takeoutStore    = useTakeoutStore()
const inventoryStore  = useInventoryStore()
const dineInStore     = useDineInStore()

/* ── 分類 / 搜尋 ── */
const activeCategoryId = ref('')
const searchQuery       = ref('')

/* 分類載入完成後自動選第一個 */
watch(() => menuStore.categories, (cats) => {
  if (cats.length > 0 && !activeCategoryId.value) {
    activeCategoryId.value = cats[0].id
  }
}, { immediate: true })

/* 有搜尋字串時，搜尋全部「已上架」品項；否則依分類篩選「已上架」品項 */
const filteredItems = computed(() => {
  const q = searchQuery.value.trim()
  const list = q
    ? menuStore.items.filter(i => i.status && i.name.includes(q))
    : menuStore.items.filter(i => i.status && i.categoryId === activeCategoryId.value)

  return [...list].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
})

/* ── 購物車 ── */
const cartItems = ref([])

function handleAddItem(item) {
  // 只跟「沒有單品標籤/備註」的那一行合併數量；已經寫過備註的那一行要保持獨立，
  // 不然同一個商品點兩份、其中一份要少冰時，備註會被硬套用到兩份上。
  const existing = cartItems.value.find(
    l => l.menuItemId === item.id && !l.tags?.length && !l.note
  )
  if (existing) {
    existing.qty += 1
  } else {
    cartItems.value.push({
      id:         `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      menuItemId: item.id,
      code:       item.code || '',
      name:       item.name,
      price:      item.price,
      qty:        1,
      icon:       item.icon,
      taxType:    item.taxType ?? 'taxable', // 應稅/免稅/零稅率，開電子發票時用來判斷是否混合稅率
      tags:       [],   // 單品標籤（例：少冰、不要辣）
      note:       '',   // 單品手輸備註
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

const cartQtyMap = computed(() => {
  const map = {}
  for (const line of cartItems.value) {
    map[line.menuItemId] = (map[line.menuItemId] ?? 0) + line.qty
  }
  return map
})

/* ── 單品備註／標籤（點購物車品項空白處開啟）── */
const editingLine = ref(null)

const editingLinePreferredTagIds = computed(() =>
  menuStore.items.find(i => i.id === editingLine.value?.menuItemId)?.tagIds ?? []
)

function openLineEditor(lineId) {
  editingLine.value = cartItems.value.find(l => l.id === lineId) ?? null
}

function saveLineEdit({ tags, note }) {
  const line = cartItems.value.find(l => l.id === editingLine.value?.id)
  if (line) { line.tags = tags; line.note = note }
  editingLine.value = null
}

function removeEditingLine() {
  if (editingLine.value) removeItem(editingLine.value.id)
  editingLine.value = null
}

/* 供工作站分區出單使用：menuItemId → 商品資料（含 stations 設定） */
const menuItemsById = computed(() => {
  const map = {}
  for (const item of menuStore.items) map[item.id] = item
  return map
})

/* ── 訂單層級附加資訊 ── */
const selectedTagIds = ref([])
const note           = ref('')
const surcharge      = ref(null)
const discount       = ref(null)

/* ── 外帶客戶資訊 ── */
const customerName  = ref('')
const customerPhone = ref('')

const selectedTagObjects = computed(() =>
  tagStore.tags.filter(t => selectedTagIds.value.includes(t.id))
)

/* ── 內用 / 外帶 ── */
const orderType     = ref('dine-in')
const selectedTable = ref(null)

const route  = useRoute()
const router = useRouter()
const CART_KEY = 'visionpos:cart'

/* ── 修改既有訂單模式 ──────────────────────────────────────────────────────
   從內用頁的「修改訂單」進來時，網址會帶 editOrderId。這個模式下：
   ① 進頁面時把那張訂單的品項/標籤/備註/加價/折扣載進購物車
   ② 右下角按鈕從「結帳」變成「儲存修改」，存檔後直接回內用頁，不會產生新訂單、不收款
   ③ 不寫入 sessionStorage 購物車草稿（避免污染下一張新訂單） */
const editOrderId   = ref(route.query.editOrderId ?? null)
const originalItems = ref([])   // 存檔時用來算庫存差額
const savingEdit    = ref(false)

onMounted(async () => {
  /* 還原上次未送出的購物車（修改模式不還原，要載入的是那張既有訂單）*/
  const saved = sessionStorage.getItem(CART_KEY)
  if (saved && !route.query.seatId && !editOrderId.value) {
    try {
      const d = JSON.parse(saved)
      if (d.items?.length) {
        cartItems.value      = d.items        ?? []
        orderType.value      = d.orderType    ?? 'dine-in'
        selectedTable.value  = d.seat         ?? null
        selectedTagIds.value = d.tags         ?? []
        note.value           = d.note         ?? ''
        surcharge.value      = d.surcharge    ?? null
        discount.value       = d.discount     ?? null
        customerName.value   = d.customerName  ?? ''
        customerPhone.value  = d.customerPhone ?? ''
      }
    } catch (e) { console.warn('[cart] 還原購物車失敗', e) }
  }

  /* 從內用頁「加單」跳轉過來時 */
  if (route.query.seatId && route.query.seatName) {
    orderType.value     = 'dine-in'
    selectedTable.value = { id: route.query.seatId, name: route.query.seatName }
  }

  await menuStore.init()
  await tagStore.init()

  if (menuStore.categories.length > 0 && !activeCategoryId.value) {
    activeCategoryId.value = menuStore.categories[0].id
  }

  /* 修改模式：把既有訂單的內容載進購物車 */
  if (editOrderId.value) {
    await dineInStore.init()
    const order = dineInStore
      .getOrdersBySeatId(route.query.seatId)
      .find(o => String(o.id) === String(editOrderId.value))
    if (order) {
      cartItems.value      = (order.items ?? []).map(l => ({ ...l }))
      originalItems.value  = (order.items ?? []).map(l => ({ ...l }))
      selectedTagIds.value = (order.tags ?? []).map(t => t.id)
      note.value           = order.note      ?? ''
      surcharge.value      = order.surcharge ?? null
      discount.value       = order.discount  ?? null
    } else {
      alert('找不到這張訂單，可能已在其他裝置結帳或取消。')
      router.replace({ name: 'DineIn' })
    }
  }
})

/* 購物車自動存 sessionStorage */
watch(
  [cartItems, orderType, selectedTable, selectedTagIds, note, surcharge, discount, customerName, customerPhone],
  () => {
    if (editOrderId.value) return   // 修改既有訂單時不寫草稿，避免污染下一張新訂單
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
// 重號檢核（項次 1）：防止 iPad 觸控連點/事件重複觸發，同一次結帳只允許處理一次，
// 避免同一張訂單被送出兩次、對應開立兩張發票。搭配 showPaymentModal 立刻設 false
// （讓 PaymentModal 的按鈕從畫面上消失）雙重防護。
const isProcessingPayment = ref(false)

function handleCharge() {
  if (cartItems.value.length === 0) return
  if (editOrderId.value) { saveEditedOrder(); return }
  if (orderType.value === 'dine-in' && !selectedTable.value) { openTablePicker(); return }
  showPaymentModal.value = true
}

/* ── 儲存修改後的訂單 ────────────────────────────────────────────────────
   只更新訂單內容，不碰付款欄位、不重新開發票、不重印收據（要補印可在訂單彈窗按列印）。
   庫存用「差額」處理：比對修改前後每個商品的數量，只把多出/少掉的部分扣回或補回，
   不會重複扣掉原本已經扣過的量。 */
async function saveEditedOrder() {
  if (savingEdit.value) return
  savingEdit.value = true
  try {
    const ok = await dineInStore.updateOrderContent(editOrderId.value, route.query.seatId, {
      items:     cartItems.value,
      tags:      selectedTagObjects.value,
      note:      note.value,
      surcharge: surcharge.value,
      discount:  discount.value,
      subtotal:  subtotal.value,
      total:     total.value,
    })
    if (!ok) { alert('儲存失敗，請稍後再試。'); return }

    /* 庫存差額：新數量 − 原數量，只送有變動的品項 */
    const qtyBefore = {}
    for (const l of originalItems.value) qtyBefore[l.menuItemId] = (qtyBefore[l.menuItemId] ?? 0) + l.qty
    const deltaItems = []
    const seen = new Set()
    for (const l of cartItems.value) {
      if (seen.has(l.menuItemId)) continue
      seen.add(l.menuItemId)
      const newQty = cartItems.value.filter(x => x.menuItemId === l.menuItemId).reduce((s, x) => s + x.qty, 0)
      const delta  = newQty - (qtyBefore[l.menuItemId] ?? 0)
      if (delta !== 0) deltaItems.push({ ...l, qty: delta })
    }
    for (const [menuItemId, oldQty] of Object.entries(qtyBefore)) {
      if (seen.has(menuItemId)) continue
      const removed = originalItems.value.find(l => l.menuItemId === menuItemId)
      if (removed) deltaItems.push({ ...removed, qty: -oldQty })   // 整個品項被移除，全數補回庫存
    }
    if (deltaItems.length) await inventoryStore.deductByOrder(editOrderId.value, deltaItems)

    clearCart()
    router.replace({ name: 'DineIn' })
  } finally {
    savingEdit.value = false
  }
}

async function handlePaymentConfirmed({ method, methodLabel, paymentAmount, changeAmount, card4, carrierNum, buyerTaxId }) {
  if (isProcessingPayment.value) return
  isProcessingPayment.value = true
  showPaymentModal.value = false

  try {
    await handlePaymentConfirmedInner({ method, methodLabel, paymentAmount, changeAmount, card4, carrierNum, buyerTaxId })
  } finally {
    isProcessingPayment.value = false
  }
}

async function handlePaymentConfirmedInner({ method, methodLabel, paymentAmount, changeAmount, card4, carrierNum, buyerTaxId }) {
  const pickupNumber = await getNextPickupNumber()

  const paymentFields = {
    paymentMethod: methodLabel,
    paymentAmount,
    changeAmount,
    card4:      card4      ?? null,
    carrierNum: carrierNum ?? null,
    buyerTaxId: buyerTaxId ?? null,
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

  let savedOrder = null

  if (orderType.value === 'takeout') {
    savedOrder = await takeoutStore.addOrder({
      ...orderPayload,
      customerName:  customerName.value,
      customerPhone: customerPhone.value,
    })
    if (savedOrder?.id) inventoryStore.deductByOrder(savedOrder.id, cartItems.value)
  } else {
    const isDefer = (method === 'defer')
    await (isDefer ? markTableOrdered : markTablePaid)(selectedTable.value.id)

    savedOrder = await dineInStore.addOrder({
      seatId:   selectedTable.value.id,
      seatName: selectedTable.value.name,
      ...orderPayload,
    })
    if (savedOrder?.id) inventoryStore.deductByOrder(savedOrder.id, cartItems.value)
  }

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

  // 工作站分區出單：只有商品管理裡有設定「出餐工作站」的店家才會額外印分區廚房票，
  // 沒有設定的店家維持原本只印一張收據，不受影響。
  printKitchenTickets({
    pickupNumber,
    orderType: orderType.value,
    tableName: selectedTable.value?.name,
    items:     cartItems.value,
    tags:      selectedTagObjects.value,
    note:      note.value,
    menuItemsById: menuItemsById.value,
  })

  // 電子發票（有啟用才開，稍後付款不開票）
  if (method !== 'defer' && savedOrder?.id) {
    const { useInvoice } = await import('@/composables/useInvoice.js')
    const { isInvoiceEnabled, issueInvoice } = useInvoice()
    if (await isInvoiceEnabled()) {
      // fire-and-forget，不阻擋結帳流程；若綠界條碼尚未就緒只在 console 提醒，不彈窗打斷結帳
      issueInvoice({
        id:        savedOrder.id,
        orderType: orderType.value === 'takeout' ? 'takeout' : 'dine_in',
        items:     cartItems.value,
        total:     total.value,
        buyerTaxId,
        carrierNum,
      }).then(res => {
        if (res?.warning) console.warn('[invoice]', res.warning)
      })
    }
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