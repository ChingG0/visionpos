<template>
  <aside class="ss">

    <nav class="ss__nav">
      <button
        v-for="item in navItems"
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
import { defineComponent, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route  = useRoute()
const router = useRouter()

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

const navItems = [
  { id: 'Reports',           label: '營運報表', icon: IconReports },
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
}

.ss__nav {
  width: 100%;
  padding: 0 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

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

.ss__spacer {
  flex: 1;
}

.ss__back-btn {
  width: 70px;
  height: 30px;
  background: var(--color-bg-settings);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: var(--fs-base);
  color: var(--color-text-brand);
}

.ss__back-btn:hover {
  background: #cfc0a4;
}
</style>