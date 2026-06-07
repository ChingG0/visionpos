<template>
  <header class="topbar">

    <!-- Floor Tabs -->
    <div class="topbar__tabs">
      <button
        v-for="floor in floors"
        :key="floor"
        class="topbar__tab"
        :class="{ 'topbar__tab--active': activeFloor === floor }"
        @click="emit('floor-change', floor)"
      >
        {{ floor }}
      </button>
    </div>

    <!-- Status Pill -->
    <div class="topbar__status-pill">
      <!-- Print -->
      <svg class="topbar__status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-label="列印">
        <polyline points="6 9 6 2 18 2 18 9"/>
        <path d="M6 18H4a2 2 0 01-2-2V9h20v7a2 2 0 01-2 2h-2"/>
        <rect x="6" y="14" width="12" height="8"/>
      </svg>

      <!-- WiFi -->
      <svg class="topbar__status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-label="WiFi">
        <path d="M1.5 8.5C4.5 5.5 8 4 12 4s7.5 1.5 10.5 4.5"/>
        <path d="M5 12c1.9-1.9 4.3-3 7-3s5.1 1.1 7 3"/>
        <path d="M8.5 15.5c.9-.9 2.2-1.5 3.5-1.5s2.6.6 3.5 1.5"/>
        <circle cx="12" cy="19" r=".5" fill="currentColor"/>
      </svg>

      <!-- Battery -->
      <svg class="topbar__status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-label="電池">
        <rect x="1" y="7" width="18" height="11" rx="2"/>
        <path d="M23 11v4"/>
        <rect x="3" y="9" width="10" height="7" rx="1" fill="currentColor"/>
      </svg>

      <span class="topbar__datetime">{{ formattedDateTime }}</span>
    </div>

  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

defineProps({
  activeFloor: {
    type: String,
    default: '1F',
  },
})

const emit = defineEmits(['floor-change'])

const floors = ['1F', '2F']

/* ── Live clock ── */
const now = ref(new Date())
let timer = null

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000 * 60)
})

onUnmounted(() => {
  clearInterval(timer)
})

const formattedDateTime = computed(() => {
  const d = now.value
  const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']
  const m = d.getMonth() + 1
  const day = d.getDate()
  const week = weekdays[d.getDay()]
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${m}月${day}日 ${week}  ${hh}:${mm}`
})
</script>

<style scoped>
.topbar {
  height: var(--topbar-height);
  background: var(--color-bg-topbar);
  border-bottom: 1px solid var(--color-border-base);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  flex-shrink: 0;
}

/* Tabs */
.topbar__tabs {
  display: flex;
  gap: 2px;
}

.topbar__tab {
  padding: 4px 16px;
  border-radius: var(--radius-sm);
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.topbar__tab--active {
  background: var(--color-bg-floor-tab-active);
  border: 1px solid var(--color-border-btn);
  color: var(--color-text-primary);
}

/* Status Pill */
.topbar__status-pill {
  background: var(--color-bg-status-pill);
  border: 1px solid var(--color-border-status-pill);
  border-radius: var(--radius-full);
  padding: 3px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar__status-icon {
  width: 15px;
  height: 15px;
  color: var(--color-text-brand);
}

.topbar__datetime {
  font-size: var(--fs-sm);
  color: var(--color-text-brand);
  white-space: nowrap;
}
</style>