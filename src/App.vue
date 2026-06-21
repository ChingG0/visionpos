<template>
  <div class="ipad-frame">
    <div v-if="isLoading" class="app-loading">
      <p>載入中...</p>
    </div>
    <RouterView v-else />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useMenuStore }        from '@/stores/menuStore.js'
import { useReservationStore } from '@/stores/reservationStore.js'
import { useMemberStore }      from '@/stores/memberStore.js'
import { useTagStore }         from '@/stores/tagStore.js'
import { useTakeoutStore }     from '@/stores/takeoutStore.js'
import { useAuthStore }        from '@/stores/authStore.js'

const menuStore        = useMenuStore()
const reservationStore = useReservationStore()
const memberStore      = useMemberStore()
const tagStore         = useTagStore()
const takeoutStore     = useTakeoutStore()
const authStore        = useAuthStore()

const isLoading = computed(() => menuStore.loading || reservationStore.loading)

onMounted(() => {
  /* 還原登入狀態（從 localStorage） */
  authStore.restore()

  /* 只有登入後才需要初始化業務資料 */
  if (authStore.isLoggedIn) {
    menuStore.init()
    reservationStore.init()
    memberStore.init()
    tagStore.init()
    takeoutStore.init()
  }
})
</script>

<style>
@import '@/assets/main.css';

.ipad-frame {
  width: 100%;
  max-width: 1024px;
  aspect-ratio: 4 / 3;
  background: var(--color-bg-app);
  border-radius: var(--radius-xl);
  border: 2px solid var(--color-border-base);
  display: flex;
  overflow: hidden;
}

.app-loading {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: var(--fs-lg);
}
</style>