<template>
  <aside class="sidebar">

    <!-- Logo -->
    <div class="sidebar__logo">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-label="餐廳 Logo">
        <circle cx="18" cy="18" r="17" fill="#bf2820"/>
        <circle cx="18" cy="18" r="13" fill="none" stroke="#fff" stroke-width="1.2"/>
        <path d="M13 14 Q18 9 23 14 Q20 18 18 19 Q16 18 13 14Z" fill="#fff"/>
        <path d="M14 22 Q18 25 22 22" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
        <line x1="18" y1="19" x2="18" y2="22" stroke="#fff" stroke-width="1.2"/>
      </svg>
    </div>

    <!-- Nav Items -->
    <nav class="sidebar__nav">
      <button
        v-for="item in navItems"
        :key="item.id"
        class="sidebar__nav-item"
        :class="{ 'sidebar__nav-item--active': activeNav === item.id }"
        @click="navigate(item.id)"
      >
        <component :is="item.icon" class="sidebar__nav-icon" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="sidebar__spacer" />

    <!-- Settings -->
    <button class="sidebar__settings" @click="router.push({ name: 'ProductManagement' })">後台設定</button>

  </aside>
</template>

<script setup>
import { computed, defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route  = useRoute()
const router = useRouter()

const activeNav = computed(() => route.name)

function navigate(name) {
  router.push({ name })
}

/* ── Inline SVG icon components ── */

/* 新訂單：服務罩蓋（cloche）圖示 */
const IconNewOrder = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M3 13a9 9 0 0118 0' }),
    h('line', { x1: '2',  y1: '13', x2: '22', y2: '13' }),
    h('line', { x1: '3',  y1: '17', x2: '21', y2: '17' }),
    h('line', { x1: '12', y1: '3',  x2: '12', y2: '6'  }),
    h('circle', { cx: '12', cy: '2.3', r: '0.9', fill: 'currentColor', stroke: 'none' }),
  ])
})

/* 內用：刀叉圖示 */
const IconDineIn = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M6 2v8a2 2 0 002 2 2 2 0 002-2V2' }),
    h('line', { x1: '8', y1: '12', x2: '8', y2: '22' }),
    h('path', { d: 'M17 2c-2 2-3 5-3 8a3 3 0 003 3v9' }),
  ])
})

/* 外帶：提袋圖示 */
const IconTakeout = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('path', { d: 'M6 8h12l-1 13H7L6 8z' }),
    h('path', { d: 'M9 8V6a3 3 0 016 0v2' }),
    h('line', { x1: '6.5', y1: '12', x2: '17.5', y2: '12' }),
  ])
})

/* 外送：機車圖示 */
const IconDelivery = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('circle', { cx: '5.5', cy: '17.5', r: '2' }),
    h('circle', { cx: '18.5', cy: '17.5', r: '2' }),
    h('path', { d: 'M8 17.5h7.5' }),
    h('path', { d: 'M15.5 17.5V12l-3-6H9L6 12.5' }),
    h('path', { d: 'M15.5 7h3.5l2 5' }),
    h('path', { d: 'M13 17.5V14h6.5' }),
  ])
})

/* 預約：日曆圖示 */
const IconReservation = defineComponent({
  render: () => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    h('rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }),
    h('line', { x1: '16', y1: '2', x2: '16', y2: '6' }),
    h('line', { x1: '8',  y1: '2', x2: '8',  y2: '6' }),
    h('line', { x1: '3',  y1: '10', x2: '21', y2: '10' }),
    h('circle', { cx: '16', cy: '16', r: '2' }),
    h('line', { x1: '16', y1: '14', x2: '16', y2: '15.3' }),
  ])
})

/* id 要對應 router/index.js 裡的 route name */
const navItems = [
  { id: 'NewOrder',    label: '新訂單', icon: IconNewOrder },
  { id: 'DineIn',      label: '內用',   icon: IconDineIn },
  { id: 'Takeout',     label: '外帶',   icon: IconTakeout },
  { id: 'Delivery',    label: '外送',   icon: IconDelivery },
  { id: 'Reservation', label: '預約',   icon: IconReservation },
]
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  background: var(--color-bg-sidebar);
  border-right: 1px solid var(--color-border-base);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 14px 0 12px;
  flex-shrink: 0;
}

.sidebar__logo {
  width: 54px;
  height: 54px;
  background: var(--color-bg-card);
  border-radius: var(--radius-full);
  border: 1.5px solid var(--color-border-logo);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.sidebar__nav {
  width: 100%;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sidebar__nav-item {
  width: 100%;
  height: 70px;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: var(--fs-base);
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.sidebar__nav-item:hover:not(.sidebar__nav-item--active) {
  background: #e8dcc8;
}

.sidebar__nav-item--active {
  background: var(--color-bg-nav-active);
  color: var(--color-text-nav-active);
}

.sidebar__nav-icon {
  width: 24px;
  height: 24px;
}

.sidebar__spacer {
  flex: 1;
}

.sidebar__settings {
  width: 78px;
  height: 30px;
  background: var(--color-bg-settings);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: var(--color-text-brand);
}

.sidebar__settings:hover {
  background: #cfc0a4;
}
</style>