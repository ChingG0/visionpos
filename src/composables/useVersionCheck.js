// =============================================================================
// useVersionCheck.js — 偵測新版本上線，通知並自動重新整理
// visionpos/src/composables/useVersionCheck.js
//
// 原理：build 時 vite.config.js 會把同一組版本號同時：
//   ① define 進這次跑在瀏覽器裡的程式碼（__APP_VERSION__，凍結在這個分頁載入當下）
//   ② 寫成一個獨立的靜態檔 /version.json（每次重新部署都會覆蓋成新的版本號）
// 前端定期去問 /version.json「現在最新版本是多少」，跟自己手上這個凍結的版本號比對，
// 不一樣就代表店家這台裝置還停在舊版本，該重新整理了。
// =============================================================================
import { ref, onUnmounted } from 'vue'

const CHECK_INTERVAL = 3 * 60 * 1000  // 每 3 分鐘檢查一次
const AUTO_RELOAD_DELAY = 6000        // 顯示通知後，幾秒內自動重新整理

export function useVersionCheck() {
  const updateAvailable = ref(false)
  const countdown       = ref(0)
  let timer         = null
  let countdownTimer = null

  async function checkVersion() {
    try {
      const res = await fetch(`/version.json?_=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { version } = await res.json()
      // __APP_VERSION__ 由 vite.config.js 的 define 注入，build 時就固定寫死在這份程式碼裡
      if (version && String(version) !== String(__APP_VERSION__)) {
        triggerUpdate()
      }
    } catch {
      // 離線或暫時連不到，安靜跳過，等下一輪再檢查
    }
  }

  function triggerUpdate() {
    if (updateAvailable.value) return  // 已經在倒數了，不要重複觸發
    updateAvailable.value = true
    if (timer) clearInterval(timer)

    countdown.value = Math.ceil(AUTO_RELOAD_DELAY / 1000)
    countdownTimer = setInterval(() => {
      countdown.value -= 1
      if (countdown.value <= 0) {
        clearInterval(countdownTimer)
        window.location.reload()
      }
    }, 1000)
  }

  function reloadNow() {
    window.location.reload()
  }

  function startVersionCheck() {
    checkVersion()
    timer = setInterval(checkVersion, CHECK_INTERVAL)
  }

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    if (countdownTimer) clearInterval(countdownTimer)
  })

  return { updateAvailable, countdown, startVersionCheck, reloadNow }
}
