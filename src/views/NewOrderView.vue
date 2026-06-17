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
        </section>

        <!-- 右：購物車 -->
        <OrderCartPanel
          :cart-items="cartItems"
          @increase="increaseQty"
          @decrease="decreaseQty"
          @remove="removeItem"
          @clear="clearCart"
          @charge="handleCharge"
        />

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import AppSidebar       from '@/components/layout/AppSidebar.vue'
import AppTopbar         from '@/components/layout/AppTopbar.vue'
import MenuCategoryBar   from '@/components/order/MenuCategoryBar.vue'
import MenuItemGrid      from '@/components/order/MenuItemGrid.vue'
import OrderCartPanel    from '@/components/order/OrderCartPanel.vue'
import { useMenuStore }  from '@/stores/menuStore.js'

const menuStore = useMenuStore()

/* ── 分類 / 搜尋 ── */
const activeCategoryId = ref(menuStore.categories[0]?.id ?? '')
const searchQuery       = ref('')

/* 有搜尋字串時，搜尋全部「已上架」品項；否則依分類篩選「已上架」品項 */
const filteredItems = computed(() => {
  const q = searchQuery.value.trim()
  if (q) {
    return menuStore.items.filter(i => i.status && i.name.includes(q))
  }
  return menuStore.items.filter(i => i.status && i.categoryId === activeCategoryId.value)
})

/* ── 購物車（之後可改 Pinia cartStore，目前先放本頁） ── */
const cartItems = ref([])
/* cart line: { id, menuItemId, name, price, qty, icon } */

function handleAddItem(item) {
  const existing = cartItems.value.find(l => l.menuItemId === item.id)
  if (existing) {
    existing.qty += 1
  } else {
    cartItems.value.push({
      id: `${item.id}-${Date.now()}`,
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      qty: 1,
      icon: item.icon,
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
}

/* 商品格右上角數量徽章用：menuItemId → 總數量 */
const cartQtyMap = computed(() => {
  const map = {}
  for (const line of cartItems.value) {
    map[line.menuItemId] = (map[line.menuItemId] ?? 0) + line.qty
  }
  return map
})

/* ── 送出訂單（之後接 Supabase：寫入 orders / order_items 表 + 觸發出單列印） ── */
function handleCharge() {
  console.log('送出訂單', {
    items: cartItems.value,
    total: cartItems.value.reduce((s, l) => s + l.price * l.qty, 0) + 10,
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