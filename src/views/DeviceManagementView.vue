<template>
  <div class="dv">
    <SettingsSidebar />
    <div class="dv__main">
      <AppTopbar :show-floor-tabs="false" title="設備管理" />
      <div class="dv__content">
        <PrinterSettingsPage v-if="currentPage === 'printer'" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SettingsSidebar    from '@/components/settings/SettingsSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import PrinterSettingsPage from '@/views/device/PrinterSettingsPage.vue'

const route = useRoute()
const currentPage = computed(() => route.query.page || 'printer')
</script>

<style scoped>
.dv { width: 100%; height: 100%; display: flex; overflow: hidden; }
.dv__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.dv__content { flex: 1; overflow-y: auto; background: var(--color-bg-map); }
</style>