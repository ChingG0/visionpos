<template>
  <div class="placeholder">
    <SettingsSidebar />
    <div class="placeholder__main">
      <AppTopbar :show-floor-tabs="false" title="庫存管理" />
      <div class="placeholder__body">
        <p class="placeholder__icon">📦</p>
        <p class="placeholder__text">庫存管理開發中</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import AppTopbar from '@/components/layout/AppTopbar.vue'
</script>

<style scoped>
.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.placeholder__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.placeholder__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: var(--color-bg-map);
}

.placeholder__icon {
  font-size: 48px;
}

.placeholder__text {
  font-size: var(--fs-lg);
  color: var(--color-text-secondary);
}
</style>