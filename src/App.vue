<template>
  <div class="ipad-frame">

    <Transition name="banner">
      <div v-if="showBanner" class="offline-banner" :class="{ 'offline-banner--online': !isOffline }">
        <span v-if="isOffline">⚠️ 網路已斷線，部分功能可能無法使用</span>
        <span v-else>✓ 網路已恢復連線</span>
      </div>
    </Transition>

    <Transition name="loading-fade">
      <div v-if="isLoading && authStore.isLoggedIn" class="app-loading">
        <div class="app-loading__bg" />
        <div class="app-loading__card">
          <div class="app-loading__logo">
            <img v-if="logoSrc" :src="logoSrc" class="app-loading__logo-img" alt="Logo" />
            <svg v-else width="52" height="52" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="17" fill="#bf2820"/>
              <circle cx="18" cy="18" r="13" fill="none" stroke="#fff" stroke-width="1.2"/>
              <path d="M13 14 Q18 9 23 14 Q20 18 18 19 Q16 18 13 14Z" fill="#fff"/>
              <path d="M14 22 Q18 25 22 22" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
              <line x1="18" y1="19" x2="18" y2="22" stroke="#fff" stroke-width="1.2"/>
            </svg>
          </div>
          <p class="app-loading__store">{{ authStore.store?.name || 'VisionPOS' }}</p>
          <div class="app-loading__spinner-wrap">
            <svg class="app-loading__spinner" viewBox="0 0 44 44">
              <circle class="app-loading__spinner-track" cx="22" cy="22" r="18" fill="none" stroke-width="3.5" />
              <circle class="app-loading__spinner-arc" cx="22" cy="22" r="18" fill="none" stroke-width="3.5"
                stroke-linecap="round" stroke-dasharray="113" stroke-dashoffset="80" />
            </svg>
          </div>
          <p class="app-loading__hint">載入資料中，請稍候...</p>
        </div>
      </div>
    </Transition>

    <RouterView v-show="!isLoading || !authStore.isLoggedIn" />
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useMenuStore }        from '@/stores/menuStore.js'
import { useReservationStore } from '@/stores/reservationStore.js'
import { useMemberStore }      from '@/stores/memberStore.js'
import { useTagStore }         from '@/stores/tagStore.js'
import { useTakeoutStore }     from '@/stores/takeoutStore.js'
import { useAuthStore }        from '@/stores/authStore.js'
import { getPrinterLogo }      from '@/lib/printer.js'
import { useHeartbeat }        from '@/composables/useHeartbeat.js'
import { useOffline }          from '@/composables/useOffline.js'

const menuStore        = useMenuStore()
const reservationStore = useReservationStore()
const memberStore      = useMemberStore()
const tagStore         = useTagStore()
const takeoutStore     = useTakeoutStore()
const authStore        = useAuthStore()
const { startHeartbeat } = useHeartbeat()
const { isOffline, showBanner } = useOffline()

const logoSrc   = ref('')
const isLoading = computed(() =>
  authStore.isLoggedIn && (menuStore.loading || reservationStore.loading)
)

onMounted(() => {
  authStore.restore()
  logoSrc.value = getPrinterLogo()

  if (authStore.isLoggedIn) {
    menuStore.init()
    reservationStore.init()
    memberStore.init()
    tagStore.init()
    takeoutStore.init()
    startHeartbeat()  // 登入後才開始 heartbeat
  }
})
</script>

<style>
@import '@/assets/main.css';

.ipad-frame {
  width: 100vw;
  height: 100dvh;          /* 動態視窗高度，自動排除網址列 */
  max-width: none;
  aspect-ratio: unset;
  border-radius: 0;
  border: none;
  display: flex;
  overflow: hidden;
  position: relative;
  flex-direction: column;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

.offline-banner {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 99999;
  padding: 10px 20px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  background: #c0392b;
  color: #fff;
  letter-spacing: 0.3px;
}
.offline-banner--online { background: #27ae60; }
.banner-enter-active, .banner-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.banner-enter-from, .banner-leave-to { transform: translateY(-100%); opacity: 0; }

.app-loading {
  position: absolute; inset: 0; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
}
.app-loading__bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 25% 30%, #e8d0a0 0%, transparent 55%),
    radial-gradient(ellipse at 75% 70%, #d4b87a 0%, transparent 50%),
    #e8dcc8;
}
.app-loading__card {
  position: relative; z-index: 1;
  display: flex; flex-direction: column; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.72); backdrop-filter: blur(12px);
  border-radius: 20px; padding: 32px 48px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.12); min-width: 200px;
}
.app-loading__logo { display: flex; align-items: center; justify-content: center; }
.app-loading__logo-img { max-width: 72px; max-height: 72px; object-fit: contain; display: block; }
.app-loading__store { font-size: 18px; font-weight: 700; color: #3a2010; letter-spacing: 0.5px; }
.app-loading__spinner-wrap { width: 44px; height: 44px; margin: 4px 0; }
.app-loading__spinner { width: 44px; height: 44px; animation: spin 1.2s linear infinite; }
.app-loading__spinner-track { stroke: #e0d0b8; }
.app-loading__spinner-arc { stroke: #c08020; animation: arc-dash 1.2s ease-in-out infinite; transform-origin: 22px 22px; }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes arc-dash { 0% { stroke-dashoffset: 100; } 50% { stroke-dashoffset: 20; } 100% { stroke-dashoffset: 100; } }
.app-loading__hint { font-size: 12px; color: #8a7050; letter-spacing: 0.3px; }
.loading-fade-leave-active { transition: opacity 0.4s ease; }
.loading-fade-leave-to { opacity: 0; }
</style>