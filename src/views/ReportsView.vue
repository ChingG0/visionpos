<template>
  <div class="rv">
    <SettingsSidebar />

    <div class="rv__main">
      <AppTopbar :show-floor-tabs="false" title="營運報表" />

      <div class="rv__content">
        <RevenueOverview    v-if="currentPage === 'revenue'"      />
        <TransactionRecords v-if="currentPage === 'transactions'" />
        <ProductAnalysis    v-if="currentPage === 'products'"     />
        <TagAnalysis        v-if="currentPage === 'tags'"         />
        <DiscountAnalysis   v-if="currentPage === 'discounts'"    />
        <CustomerAnalysis   v-if="currentPage === 'customers'"    />
        <ShiftRecords       v-if="currentPage === 'shifts'"       />
        <OrderChangeLogs    v-if="currentPage === 'orderlogs'"    />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SettingsSidebar    from '@/components/settings/SettingsSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import RevenueOverview    from '@/views/reports/RevenueOverview.vue'
import TransactionRecords from '@/views/reports/TransactionRecords.vue'
import ShiftRecords       from '@/views/reports/ShiftRecords.vue'
import OrderChangeLogs    from '@/views/reports/OrderChangeLogs.vue'
import ProductAnalysis    from '@/views/reports/ProductAnalysis.vue'
import TagAnalysis        from '@/views/reports/TagAnalysis.vue'
import DiscountAnalysis   from '@/views/reports/DiscountAnalysis.vue'
import CustomerAnalysis   from '@/views/reports/CustomerAnalysis.vue'

const route = useRoute()
const currentPage = computed(() => route.query.page || 'revenue')
</script>

<style scoped>
.rv { width: 100%; height: 100%; display: flex; overflow: hidden; }
.rv__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.rv__content { flex: 1; overflow-y: auto; background: var(--color-bg-map); }
</style>