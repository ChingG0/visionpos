<template>
  <header class="topbar">

    <!-- Floor Tabs（內用頁用）或 Title（其他頁用） -->
    <div v-if="showFloorTabs" class="topbar__tabs">
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
    <div v-else-if="title" class="topbar__title">{{ title }}</div>
    <div v-else class="topbar__spacer" />

    <!-- 右側群組：user info + status pill 永遠固定在右邊 -->
    <div class="topbar__right">
      <div v-if="authStore.isLoggedIn" class="topbar__user">
        <span class="topbar__store-name">{{ authStore.store?.name }}</span>
        <span class="topbar__user-name">{{ authStore.user?.name }}</span>
        <!-- 錢櫃是 RJ11 接在出單機上，出單機沒連上就一定開不了，直接把按鈕停用 -->
        <button
          class="topbar__drawer-btn"
          :class="{ 'topbar__drawer-btn--ok': drawerFlash }"
          :disabled="!isPrinterOnline || openingDrawer"
          :title="isPrinterOnline ? '開啟錢櫃' : '出單機未連線，錢櫃無法開啟'"
          @click="handleOpenDrawer"
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2.5" y="7" width="19" height="11" rx="1.5"/>
            <line x1="2.5" y1="11.5" x2="21.5" y2="11.5"/>
            <line x1="9.5" y1="14.8" x2="14.5" y2="14.8"/>
          </svg>
          {{ drawerFlash ? '已開啟' : (openingDrawer ? '開啟中' : '錢櫃') }}
        </button>
        <button class="topbar__shift-btn" @click="shiftKind = 'shift'">交班</button>
        <!-- 關帳會結束整店的累計期間，沒有權限的收銀員不顯示 -->
        <button v-if="authStore.canCloseout" class="topbar__closeout-btn" @click="shiftKind = 'closeout'">關帳</button>
      </div>

      <!-- Status Pill -->
      <div class="topbar__status-pill">
      <button
        class="topbar__status-btn"
        :aria-label="isPrinterOnline ? '出單機已連線，點擊設定' : '出單機未連線，點擊設定'"
        @click="showPrinterSettings = true"
      >
        <svg
          class="topbar__status-icon"
          :class="isPrinterOnline ? 'topbar__status-icon--ok' : 'topbar__status-icon--bad'"
          viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
        >
          <polyline points="6 9 6 2 18 2 18 9"/>
          <path d="M6 18H4a2 2 0 01-2-2V9h20v7a2 2 0 01-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
      </button>

      <svg
        class="topbar__status-icon"
        :class="isOnline ? 'topbar__status-icon--ok' : 'topbar__status-icon--bad'"
        viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        :aria-label="isOnline ? 'WiFi 已連線' : 'WiFi 未連線'"
      >
        <path d="M1.5 8.5C4.5 5.5 8 4 12 4s7.5 1.5 10.5 4.5"/>
        <path d="M5 12c1.9-1.9 4.3-3 7-3s5.1 1.1 7 3"/>
        <path d="M8.5 15.5c.9-.9 2.2-1.5 3.5-1.5s2.6.6 3.5 1.5"/>
        <circle cx="12" cy="19" r=".5" fill="currentColor"/>
      </svg>

      <span class="topbar__datetime">{{ formattedDateTime }}</span>
      </div>
    </div><!-- /topbar__right -->

    <PrinterSettingsModal
      v-if="showPrinterSettings"
      @close="showPrinterSettings = false"
      @saved="pollPrinterStatus"
    />

    <!-- 交班 / 關帳：確認後都會登出，差別在關帳會結束累計期間 -->
    <ShiftModal
      v-if="shiftKind"
      :kind="shiftKind"
      @close="shiftKind = null"
      @done="handleShiftDone"
    />

  </header>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { checkPrinterStatus, openCashDrawer } from '@/lib/printer.js'
import PrinterSettingsModal from './PrinterSettingsModal.vue'
import ShiftModal           from './ShiftModal.vue'
import { useAuthStore } from '@/stores/authStore.js'

const router    = useRouter()
const authStore = useAuthStore()

const ROLE_LABELS = { owner: '老闆', manager: '主管', cashier: '收銀員' }

function handleLogout() {
  authStore.logout()
  router.replace({ name: 'Login' })
}

/* ── 開啟錢櫃 ─────────────────────────────────────────────────────────────
   錢櫃走出單機的 RJ11（DK）孔，沒有自己的網路，所以出單機離線時直接停用按鈕，
   免得店員一直按卻沒反應、以為錢櫃壞了。 */
const openingDrawer = ref(false)
const drawerFlash   = ref(false)

async function handleOpenDrawer() {
  if (openingDrawer.value) return
  openingDrawer.value = true
  const result = await openCashDrawer()
  openingDrawer.value = false

  if (result.success) {
    drawerFlash.value = true
    setTimeout(() => { drawerFlash.value = false }, 1500)
  } else {
    alert('錢櫃開啟失敗。請確認出單機電源與網路是否正常、錢櫃的 RJ11 線是否插在出單機背後的 DK 孔。\n\n急用的話可以用鑰匙手動開啟。')
    pollPrinterStatus()   // 順便重新確認出單機狀態，讓右上角的圖示同步
  }
}

/* ── 交班 / 關帳 ─────────────────────────────────────────────────────────
   兩者都會登出。交班只是留下紀錄、換人接手，累計期間繼續；
   關帳會結束這個累計期間，下次登入營業額從 0 重新算。 */
const shiftKind = ref(null)   // null | 'shift' | 'closeout'

function handleShiftDone() {
  shiftKind.value = null
  handleLogout()
}

defineProps({
  activeFloor:    { type: String,  default: '1F' },
  showFloorTabs:  { type: Boolean, default: true },
  title:          { type: String,  default: '' },
})

const emit = defineEmits(['floor-change'])

const floors = ['1F', '2F']

const now = ref(new Date())
let timer = null

const showPrinterSettings = ref(false)

/* ── WiFi / 網路狀態：用瀏覽器原生事件，即時反應，不用輪詢 ── */
const isOnline = ref(navigator.onLine)
function updateOnlineStatus() { isOnline.value = navigator.onLine }

/* ── 出單機連線狀態：自適應輪詢（連線時 30s，離線時 90s）── */
const isPrinterOnline = ref(false)
let printerTimer = null

const POLL_ONLINE  = 30_000  // 確認連線後 30s 再確認
const POLL_OFFLINE = 90_000  // 離線時 90s 才重試，減少 console 錯誤

async function pollPrinterStatus() {
  clearTimeout(printerTimer)
  isPrinterOnline.value = await checkPrinterStatus()
  printerTimer = setTimeout(pollPrinterStatus, isPrinterOnline.value ? POLL_ONLINE : POLL_OFFLINE)
}

onMounted(() => {
  timer = setInterval(() => { now.value = new Date() }, 1000 * 60)

  window.addEventListener('online', updateOnlineStatus)
  window.addEventListener('offline', updateOnlineStatus)

  // 延遲 2s 再初始 poll，避免頁面一開啟就送出多次 POST
  printerTimer = setTimeout(pollPrinterStatus, 2000)
})

onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(printerTimer)
  window.removeEventListener('online', updateOnlineStatus)
  window.removeEventListener('offline', updateOnlineStatus)
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

.topbar__title {
  font-size: var(--fs-lg);
  font-weight: 500;
  color: var(--color-text-primary);
}

.topbar__spacer {
  flex: 1;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 10px;
}

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

.topbar__status-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  border-radius: var(--radius-sm);
  transition: background 0.12s;
}

.topbar__status-btn:hover {
  background: rgba(0, 0, 0, 0.06);
}

.topbar__status-icon--ok {
  color: #3a7a3a;
}

.topbar__status-icon--bad {
  color: #c0392b;
}

.topbar__datetime {
  font-size: var(--fs-sm);
  color: var(--color-text-brand);
  white-space: nowrap;
}

.topbar__user {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 10px;
}

.topbar__store-name {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.topbar__user-name {
  font-size: 13px;
  color: var(--color-text-primary);
}

.topbar__logout-btn {
  height: 24px;
  padding: 0 10px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-btn);
  background: var(--color-bg-settings);
  color: var(--color-text-brand);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.topbar__logout-btn:hover { background: #fde2e2; color: #c0392b; border-color: #f0c0b8; }

/* ── 開啟錢櫃 ── */
.topbar__drawer-btn {
  height: 24px;
  padding: 0 11px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-btn);
  background: var(--color-bg-settings);
  color: var(--color-text-brand);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.topbar__drawer-btn:hover:not(:disabled) { background: #e8dcc8; }
.topbar__drawer-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.topbar__drawer-btn--ok {
  background: #e1f3e1;
  border-color: #c8e8c8;
  color: #2f7a3d;
  font-weight: 600;
}

/* ── 交班 / 關帳 ── */
.topbar__shift-btn,
.topbar__closeout-btn {
  height: 24px;
  padding: 0 12px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s;
}
.topbar__shift-btn {
  border: 1px solid var(--color-border-btn);
  background: var(--color-bg-settings);
  color: var(--color-text-brand);
}
.topbar__shift-btn:hover { background: #e8dcc8; }
.topbar__closeout-btn {
  border: 1px solid #c8a86a;
  background: #fde8c0;
  color: #8a6020;
  font-weight: 600;
}
.topbar__closeout-btn:hover { background: #f8dca0; }
</style>