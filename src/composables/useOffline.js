// =============================================================================
// useOffline.js — 離線偵測
// visionpos/src/composables/useOffline.js
// =============================================================================
import { ref, onMounted, onUnmounted } from 'vue'

const isOffline  = ref(!navigator.onLine)
const showBanner = ref(false)
let   hideTimer  = null

export function useOffline() {
  function onOffline() {
    isOffline.value  = true
    showBanner.value = true
    if (hideTimer) clearTimeout(hideTimer)
  }

  function onOnline() {
    isOffline.value = false
    // 回線後顯示 3 秒「已恢復連線」再隱藏
    showBanner.value = true
    hideTimer = setTimeout(() => { showBanner.value = false }, 3000)
  }

  onMounted(() => {
    window.addEventListener('offline', onOffline)
    window.addEventListener('online',  onOnline)
  })

  onUnmounted(() => {
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online',  onOnline)
    if (hideTimer) clearTimeout(hideTimer)
  })

  return { isOffline, showBanner }
}