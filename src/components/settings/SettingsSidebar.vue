<template>
  <aside class="ss">

    <nav class="ss__nav">

      <!-- 營運報表：可展開的群組 -->
      <div class="ss__group">
        <div v-if="canSeeReports" class="ss__group">
          <button
            class="ss__nav-item"
            :class="{ 'ss__nav-item--active': route.name === 'Reports' }"
            @click="handleReportsClick"
          >
            <IconReports class="ss__nav-icon" />
            <span>營運報表</span>
          </button>          
        </div>

        <!-- 展開的子分頁 -->
        <div v-if="reportsExpanded" class="ss__sub-nav">
          <button
            v-for="sub in REPORT_PAGES"
            :key="sub.key"
            class="ss__sub-item"
            :class="{
              'ss__sub-item--active': isActiveReportPage(sub.key),
              'ss__sub-item--soon':   sub.soon
            }"
            @click="!sub.soon && goReportPage(sub.key)"
          >
            {{ sub.label }}
          </button>
        </div>
      </div>

      <!-- 其他後台導覽 -->
      <template v-for="item in otherNavItems" :key="item.id">
        <!-- 商品管理：可展開 -->
        <div v-if="item.isProduct" class="ss__group">
          <button
            class="ss__nav-item"
            :class="{ 'ss__nav-item--active': route.name === 'ProductManagement' }"
            @click="handleProductClick"
          >
            <component :is="item.icon" class="ss__nav-icon" />
            <span>{{ item.label }}</span>
          </button>
          <div v-if="productExpanded" class="ss__sub-nav">
            <button
              v-for="sub in PRODUCT_PAGES"
              :key="sub.key"
              class="ss__sub-item"
              :class="{ 'ss__sub-item--active': isActiveProductPage(sub.key) }"
              @click="goProductPage(sub.key)"
            >{{ sub.label }}</button>
          </div>
        </div>
        <!-- 設備管理：可展開 -->
        <div v-else-if="item.isDevice" class="ss__group">
          <button
            class="ss__nav-item"
            :class="{ 'ss__nav-item--active': route.name === 'DeviceManagement' }"
            @click="handleDeviceClick"
          >
            <component :is="item.icon" class="ss__nav-icon" />
            <span>{{ item.label }}</span>
          </button>
          <div v-if="deviceExpanded" class="ss__sub-nav">
            <button
              v-for="sub in DEVICE_PAGES"
              :key="sub.key"
              class="ss__sub-item"
              :class="{ 'ss__sub-item--active': isActiveDevicePage(sub.key) }"
              @click="goDevicePage(sub.key)"
            >{{ sub.label }}</button>
          </div>
        </div>
        <!-- 一般項目 -->
        <button v-else
          class="ss__nav-item"
          :class="{ 'ss__nav-item--active': route.name === item.id }"
          @click="router.push({ name: item.id })"
        >
          <component :is="item.icon" class="ss__nav-icon" />
          <span>{{ item.label }}</span>
        </button>
      </template>

    </nav>

    <div class="ss__spacer" />

    <div class="ss__back-wrap">
      <button class="ss__back-btn" @click="router.push({ name: 'NewOrder' })">
        點餐頁
      </button>
    </div>

  </aside>
</template>

<script setup>
import { ref, watch, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore.js'

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()

/* ── 報表子分頁 ── */
const REPORT_PAGES = [
  { key: 'revenue',      label: '營收總覽' },
  { key: 'transactions', label: '交易紀錄' },
  { key: 'products',     label: '商品分析' },
  { key: 'tags',         label: '標籤分析' },
  { key: 'discounts',    label: '折扣分析' },
  { key: 'customers',    label: '來客分析' },
  { key: 'shifts',       label: '交班紀錄' },
]

const reportsExpanded = ref(route.name === 'Reports')

watch(() => route.name, (name) => {
  if (name === 'Reports') reportsExpanded.value = true
}, { immediate: true })

const canSeeReports = computed(() =>
  ['owner', 'manager', 'superadmin'].includes(authStore.user?.role ?? '')
)

function handleReportsClick() {
  if (route.name === 'Reports') {
    reportsExpanded.value = !reportsExpanded.value
  } else {
    reportsExpanded.value = true
    router.push({ name: 'Reports', query: { page: 'revenue' } })
  }
}

function goReportPage(key) {
  router.push({ name: 'Reports', query: { page: key } })
}

function isActiveReportPage(key) {
  if (route.name !== 'Reports') return false
  const current = route.query.page || 'revenue'
  return current === key
}

/* ── 商品管理子分頁 ── */
const PRODUCT_PAGES = [
  { key: 'products', label: '商品總覽' },
  { key: 'tags',     label: '標籤管理' },
]

const productExpanded = ref(route.name === 'ProductManagement')

watch(() => route.name, (name) => {
  if (name === 'ProductManagement') productExpanded.value = true
}, { immediate: true })

function handleProductClick() {
  if (route.name === 'ProductManagement') {
    productExpanded.value = !productExpanded.value
  } else {
    productExpanded.value = true
    router.push({ name: 'ProductManagement', query: { page: 'products' } })
  }
}

function goProductPage(key) {
  router.push({ name: 'ProductManagement', query: { page: key } })
}

function isActiveProductPage(key) {
  return route.name === 'ProductManagement' && (route.query.page || 'products') === key
}

/* ── 設備管理子分頁 ── */
const DEVICE_PAGES = [
  { key: 'printer', label: '出單機設定' },
]

const deviceExpanded = ref(route.name === 'DeviceManagement')

watch(() => route.name, (name) => {
  if (name === 'DeviceManagement') deviceExpanded.value = true
}, { immediate: true })

function handleDeviceClick() {
  if (route.name === 'DeviceManagement') {
    deviceExpanded.value = !deviceExpanded.value
  } else {
    deviceExpanded.value = true
    router.push({ name: 'DeviceManagement', query: { page: 'printer' } })
  }
}

function goDevicePage(key) {
  router.push({ name: 'DeviceManagement', query: { page: key } })
}

function isActiveDevicePage(key) {
  return route.name === 'DeviceManagement' && (route.query.page || 'printer') === key
}

/* ── Icons ── */
const IconDevice = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('rect', { x: '2', y: '3', width: '20', height: '14', rx: '2' }),
    h('line', { x1: '8', y1: '21', x2: '16', y2: '21' }),
    h('line', { x1: '12', y1: '17', x2: '12', y2: '21' }),
  ])
})

const IconReports = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('line', { x1: '5',  y1: '20', x2: '5',  y2: '11' }),
    h('line', { x1: '12', y1: '20', x2: '12', y2: '5'  }),
    h('line', { x1: '19', y1: '20', x2: '19', y2: '14' }),
  ])
})

const IconProducts = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M20.5 7.3L12 12l-8.5-4.7M12 22V12M21 16.5V7.5a2 2 0 00-1-1.7l-7-4a2 2 0 00-2 0l-7 4a2 2 0 00-1 1.7v9a2 2 0 001 1.7l7 4a2 2 0 002 0l7-4a2 2 0 001-1.7z' }),
  ])
})

const IconOrderSettings = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('line', { x1: '4',  y1: '6',  x2: '20', y2: '6'  }),
    h('circle', { cx: '9',  cy: '6',  r: '2', fill: 'currentColor', stroke: 'none' }),
    h('line', { x1: '4',  y1: '12', x2: '20', y2: '12' }),
    h('circle', { cx: '15', cy: '12', r: '2', fill: 'currentColor', stroke: 'none' }),
    h('line', { x1: '4',  y1: '18', x2: '20', y2: '18' }),
    h('circle', { cx: '7',  cy: '18', r: '2', fill: 'currentColor', stroke: 'none' }),
  ])
})

const IconInventory = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('rect', { x: '3',  y: '3',  width: '8', height: '8', rx: '1.5' }),
    h('rect', { x: '13', y: '3',  width: '8', height: '8', rx: '1.5' }),
    h('rect', { x: '3',  y: '13', width: '8', height: '8', rx: '1.5' }),
    h('rect', { x: '13', y: '13', width: '8', height: '8', rx: '1.5' }),
  ])
})

const IconMembers = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '9', cy: '7', r: '3.2' }),
    h('path', { d: 'M3 20a6 6 0 0112 0' }),
    h('path', { d: 'M16 5.5a3.2 3.2 0 010 6.2' }),
    h('path', { d: 'M15 13.2c2.6.4 4.6 2.2 4.6 6.8' }),
  ])
})

const IconStaff = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '12', cy: '8', r: '3.5' }),
    h('path', { d: 'M5 20a7 7 0 0114 0' }),
    h('path', { d: 'M18 3v4' }),
    h('path', { d: 'M16 5h4' }),
  ])
})

const IconInvoice = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
    h('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
    h('polyline', { points: '14 2 14 8 20 8' }),
    h('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
    h('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
  ])
})

const IconLinePay = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', width: 16, height: 16, fill: 'none', stroke: 'currentColor', strokeWidth: 2 }, [
    h('rect', { x: '5', y: '2', width: '14', height: '20', rx: '2' }),
    h('line', { x1: '12', y1: '18', x2: '12', y2: '18.01' }),
  ])
})

/* 店家資訊：店面＋時鐘 */
const IconStoreInfo = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M3 9l2-5h14l2 5' }),
    h('path', { d: 'M4 9v11h16V9' }),
    h('circle', { cx: '12', cy: '14', r: '3.2' }),
    h('path', { d: 'M12 12.6V14l1 1' }),
  ])
})

import { computed } from 'vue'

const ALL_NAV_ITEMS = [
  { id: 'ProductManagement', label: '商品管理', icon: IconProducts,      roles: ['owner', 'manager', 'superadmin'], isProduct: true },
  { id: 'OrderSettings',     label: '點餐設定', icon: IconOrderSettings, roles: ['owner', 'manager', 'superadmin', 'cashier'] },
  { id: 'Inventory',         label: '庫存管理', icon: IconInventory,     roles: ['owner', 'manager', 'superadmin'] },
  { id: 'MemberManagement',  label: '會員管理', icon: IconMembers,       roles: ['owner', 'manager', 'superadmin'] },
  { id: 'StaffManagement',   label: '員工管理', icon: IconStaff,         roles: ['owner', 'manager', 'superadmin'] },
  { id: 'DeviceManagement',  label: '設備管理', icon: IconDevice,        roles: ['owner', 'manager', 'superadmin', 'cashier'], isDevice: true },
  { id: 'InvoiceSettings',   label: '電子發票',   icon: IconInvoice,       roles: ['owner', 'manager', 'superadmin'] },
  { id: 'PaymentSettings', label: '付款設定', icon: IconLinePay, roles: ['owner', 'manager', 'superadmin'] },
  { id: 'StoreInfo',       label: '店家資訊', icon: IconStoreInfo, roles: ['owner', 'manager', 'superadmin'] },
]

const otherNavItems = computed(() => {
  const role = authStore.user?.role ?? ''
  return ALL_NAV_ITEMS.filter(item => item.roles.includes(role))
})
</script>

<style scoped>
.ss {
  width: var(--sidebar-width);
  background: var(--color-bg-sidebar);
  border-right: 1px solid var(--color-border-base);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0 12px;
  flex-shrink: 0;
  overflow-y: auto;
}

.ss__nav {
  width: 100%;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ss__group {
  display: flex;
  flex-direction: column;
}

/* ── 主項目（圖示+文字） ── */
.ss__nav-item {
  width: 100%;
  height: 64px;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.ss__nav-item:hover:not(.ss__nav-item--active) {
  background: #e8dcc8;
}

.ss__nav-item--active {
  background: var(--color-bg-nav-active);
  color: var(--color-text-nav-active);
}

.ss__nav-icon {
  width: 22px;
  height: 22px;
}

/* ── 子分頁列表（展開時出現） ── */
.ss__sub-nav {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 2px 4px 6px;
}

.ss__sub-item {
  width: 100%;
  padding: 7px 10px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  text-align: left;
  color: var(--color-text-secondary);
  transition: background 0.12s, color 0.12s;
  white-space: nowrap;
}

.ss__sub-item:hover:not(.ss__sub-item--soon):not(.ss__sub-item--active) {
  background: #e8dcc8;
  color: var(--color-text-primary);
}

.ss__sub-item--active {
  background: #fde8c0;
  color: #8a6020;
  font-weight: 500;
}

.ss__sub-item--soon {
  color: #c0b090;
  cursor: default;
  font-size: 11px;
}

.ss__spacer { flex: 1; min-height: 0; }

.ss__back-wrap {
  padding: 8px 10px;
  flex-shrink: 0;
}

.ss__back-btn {
  width: 78px;
  height: 30px;
  background: var(--color-bg-settings);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text-brand);
}
.ss__back-btn:hover { background: #cfc0a4; }
</style>