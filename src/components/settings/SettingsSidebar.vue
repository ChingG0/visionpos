<template>
  <aside class="ss">

    <nav class="ss__nav">

      <!-- 營運報表：可展開的群組 -->
      <div class="ss__group">
        <button
          class="ss__nav-item"
          :class="{ 'ss__nav-item--active': route.name === 'Reports' }"
          @click="handleReportsClick"
        >
          <IconReports class="ss__nav-icon" />
          <span>營運報表</span>
        </button>

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
      <button
        v-for="item in otherNavItems"
        :key="item.id"
        class="ss__nav-item"
        :class="{ 'ss__nav-item--active': route.name === item.id }"
        @click="router.push({ name: item.id })"
      >
        <component :is="item.icon" class="ss__nav-icon" />
        <span>{{ item.label }}</span>
      </button>

    </nav>

    <div class="ss__spacer" />

    <button class="ss__back-btn" @click="router.push({ name: 'NewOrder' })">
      點餐頁
    </button>

  </aside>
</template>

<script setup>
import { ref, computed, watch, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route  = useRoute()
const router = useRouter()

/* ── 報表子分頁 ── */
const REPORT_PAGES = [
  { key: 'revenue',      label: '營收總覽' },
  { key: 'transactions', label: '交易紀錄' },
  { key: 'products',     label: '商品分析' },
  { key: 'tags',         label: '標籤分析' },
  { key: 'discounts',    label: '折扣分析',   soon: true },
  { key: 'customers',    label: '來客分析',   soon: true },
]

/* 展開/收折狀態：在報表頁面時預設展開 */
const reportsExpanded = ref(route.name === 'Reports')

watch(() => route.name, (name) => {
  if (name === 'Reports') reportsExpanded.value = true
}, { immediate: true })

function handleReportsClick() {
  if (route.name === 'Reports') {
    /* 已在報表頁面：切換展開/收折 */
    reportsExpanded.value = !reportsExpanded.value
  } else {
    /* 從其他頁面點入：展開並導航 */
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

/* ── Icons ── */
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

const otherNavItems = [
  { id: 'ProductManagement', label: '商品管理', icon: IconProducts },
  { id: 'OrderSettings',     label: '點餐設定', icon: IconOrderSettings },
  { id: 'Inventory',         label: '庫存管理', icon: IconInventory },
  { id: 'MemberManagement',  label: '會員管理', icon: IconMembers },
]
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

.ss__spacer { flex: 1; }

.ss__back-btn {
  width: 70px;
  height: 30px;
  background: var(--color-bg-settings);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: var(--fs-base);
  color: var(--color-text-brand);
}

.ss__back-btn:hover { background: #cfc0a4; }
</style>