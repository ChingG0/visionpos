<template>
  <div class="mcb">

    <!-- 標題 + 搜尋 -->
    <div class="mcb__row">
      <h2 class="mcb__title">商品<span class="mcb__title-light">分類</span></h2>
      <div class="mcb__search">
        <svg class="mcb__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7"/>
          <line x1="21" y1="21" x2="16.5" y2="16.5"/>
        </svg>
        <input
          class="mcb__search-input"
          type="text"
          placeholder="搜尋餐點、配料…"
          :value="search"
          @input="emit('update:search', $event.target.value)"
        />
      </div>
    </div>

    <!-- 分類頁籤 -->
    <div class="mcb__tabs">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="mcb__tab"
        :class="{ 'mcb__tab--active': cat.id === activeCategoryId }"
        @click="emit('select', cat.id)"
      >
        <span class="mcb__tab-icon">{{ cat.icon }}</span>
        <span class="mcb__tab-label">{{ cat.label }}</span>
      </button>
    </div>

  </div>
</template>

<script setup>
defineProps({
  categories:       { type: Array,  required: true },
  activeCategoryId:  { type: String, default: '' },
  search:            { type: String, default: '' },
})

const emit = defineEmits(['select', 'update:search'])
</script>

<style scoped>
.mcb {
  flex-shrink: 0;
}

.mcb__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.mcb__title {
  font-size: 19px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.mcb__title-light {
  font-weight: 400;
  color: var(--color-text-secondary);
}

.mcb__search {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-full);
  padding: 6px 14px;
  width: 230px;
}

.mcb__search-icon {
  width: 15px;
  height: 15px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.mcb__search-input {
  border: none;
  outline: none;
  font-size: 12.5px;
  color: var(--color-text-primary);
  background: transparent;
  width: 100%;
  font-family: inherit;
}

.mcb__search-input::placeholder {
  color: var(--color-text-muted);
}

/* ── Tabs ── */
.mcb__tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.mcb__tab {
  flex-shrink: 0;
  width: 68px;
  height: 64px;
  border-radius: var(--radius-md);
  background: #fff;
  border: 1.5px solid var(--color-border-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  transition: border-color 0.15s, background 0.15s;
}

.mcb__tab:hover:not(.mcb__tab--active) {
  border-color: var(--color-border-btn);
}

.mcb__tab--active {
  background: var(--color-bg-nav-active);
  border-color: #c07820;
}

.mcb__tab-icon {
  font-size: 20px;
  line-height: 1;
}

.mcb__tab-label {
  font-size: 10.5px;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.mcb__tab--active .mcb__tab-label {
  color: var(--color-text-nav-active);
  font-weight: 500;
}
</style>