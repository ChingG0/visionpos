<template>
  <div class="tk">
    <AppSidebar />

    <div class="tk__main">
      <AppTopbar :show-floor-tabs="false" title="" />

      <!-- 頁面標題列 -->
      <div class="tk__page-header">
        <div class="tk__page-header-left">
          <h2 class="tk__title">外帶訂單</h2>
          <button
            class="tk__view-btn"
            :aria-label="isCompact ? '切換為展開檢視' : '切換為緊湊檢視'"
            @click="isCompact = !isCompact"
          >
            <!-- compact → 3欄格線圖示 -->
            <svg v-if="isCompact" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="7.5" y="1" width="5" height="5" rx="1"/><rect x="14" y="1" width="5" height="5" rx="1"/>
              <rect x="1" y="7.5" width="5" height="5" rx="1"/><rect x="7.5" y="7.5" width="5" height="5" rx="1"/><rect x="14" y="7.5" width="5" height="5" rx="1"/>
              <rect x="1" y="14" width="5" height="5" rx="1"/><rect x="7.5" y="14" width="5" height="5" rx="1"/><rect x="14" y="14" width="5" height="5" rx="1"/>
            </svg>
            <!-- expanded → 2欄圖示 -->
            <svg v-else viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="1" y="1" width="8" height="8" rx="1.5"/><rect x="11" y="1" width="8" height="8" rx="1.5"/>
              <rect x="1" y="11" width="8" height="8" rx="1.5"/><rect x="11" y="11" width="8" height="8" rx="1.5"/>
            </svg>
          </button>
        </div>
        <span class="tk__pending-badge">待取餐 {{ takeoutStore.orders.length }} 單</span>
      </div>

      <!-- 訂單列表 -->
      <div class="tk__body" :class="{ 'tk__body--h': !isCompact }">
        <p v-if="takeoutStore.loading" class="tk__empty">載入中...</p>
        <p v-else-if="takeoutStore.orders.length === 0" class="tk__empty">目前沒有待取餐的外帶訂單</p>

        <div v-else class="tk__grid" :class="isCompact ? 'tk__grid--compact' : 'tk__grid--h'">
          <div
            v-for="(order, idx) in takeoutStore.orders"
            :key="order.id"
            class="tk__card"
          >
            <!-- 卡片頂部：序號、訂單資訊、完成按鈕 -->
            <div class="tk__card-head">
              <span class="tk__card-num">{{ String(idx + 1).padStart(2, '0') }}</span>

              <div class="tk__card-info">
                <div class="tk__card-id">訂單號：#{{ formatOrderId(order) }}</div>
                <div v-if="order.customerName"  class="tk__card-customer">訂購人：{{ order.customerName }}</div>
                <div v-if="order.customerPhone" class="tk__card-customer">電話：{{ order.customerPhone }}</div>
              </div>

              <button class="tk__done-btn" @click="confirmComplete(order)">
                完成<br>取餐
              </button>
            </div>

            <!-- 時間 + 金額 -->
            <div class="tk__card-sub">
              <span class="tk__card-elapsed">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="8" cy="8" r="6.5"/>
                  <path d="M8 4.5V8l2.5 2"/>
                </svg>
                {{ elapsedTime(order.createdAt) }}
              </span>
              <span class="tk__card-total">${{ order.total.toFixed(0) }}</span>
            </div>

            <!-- 品項表格 -->
            <div class="tk__items-wrap">
              <table class="tk__items">
                <thead>
                  <tr>
                    <th class="tk__items-name">品名</th>
                    <th class="tk__items-note">備註</th>
                    <th class="tk__items-qty">數量</th>
                    <th class="tk__items-price">金額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in order.items" :key="i">
                    <td>{{ line.name }}</td>
                    <td class="tk__items-note-cell">－</td>
                    <td>{{ line.qty }}</td>
                    <td>{{ (line.price * line.qty).toFixed(0) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- 標籤 + 備註：全部放在表格下方 -->
            <div v-if="order.tags?.length || order.note" class="tk__card-footer">
              <div v-if="order.tags?.length" class="tk__card-tags">
                <span
                  v-for="tag in order.tags"
                  :key="tag.id"
                  class="tk__tag-pill"
                  :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }"
                >{{ tag.label }}</span>
              </div>
              <div v-if="order.note" class="tk__card-note">📝 {{ order.note }}</div>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- 確認完成彈窗 -->
    <Teleport to="body">
      <div v-if="confirmingOrder" class="tk-confirm-backdrop" @click.self="confirmingOrder = null">
        <div class="tk-confirm-box">
          <p class="tk-confirm-title">確認完成取餐？</p>
          <div class="tk-confirm-body">
            <p class="tk-confirm-id">訂單 #{{ formatOrderId(confirmingOrder) }}</p>
            <p v-if="confirmingOrder.customerName">訂購人：{{ confirmingOrder.customerName }}</p>
            <p v-if="confirmingOrder.customerPhone">電話：{{ confirmingOrder.customerPhone }}</p>
            <p class="tk-confirm-total">合計 ${{ confirmingOrder.total.toFixed(0) }}</p>
          </div>
          <p v-if="confirmingOrder.customerPhone" class="tk-confirm-hint">
            電話 {{ confirmingOrder.customerPhone }} 將自動存入會員記錄
          </p>
          <div class="tk-confirm-actions">
            <button class="tk-confirm-cancel" @click="confirmingOrder = null">取消</button>
            <button class="tk-confirm-ok" :disabled="completing" @click="doComplete">
              {{ completing ? '處理中...' : '確認完成' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar   from '@/components/layout/AppTopbar.vue'
import { useTakeoutStore } from '@/stores/takeoutStore.js'
import { useMemberStore }  from '@/stores/memberStore.js'
import { TAG_COLOR_MAP }   from '@/constants/tagColors.js'

const takeoutStore = useTakeoutStore()
const memberStore  = useMemberStore()

function tagColorOf(tag) {
  return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
}

/* ── 檢視模式：compact = 3 欄，expanded = 2 欄 ── */
const isCompact = ref(true)

/* ── 確認彈窗 ── */
const confirmingOrder = ref(null)
const completing       = ref(false)

function confirmComplete(order) {
  confirmingOrder.value = order
}

async function doComplete() {
  const order = confirmingOrder.value
  if (!order || completing.value) return
  completing.value = true

  /* 如果有電話，自動存入會員（新會員建立，舊會員累加次數） */
  if (order.customerPhone) {
    await memberStore.upsertMember({
      phone: order.customerPhone,
      name:  order.customerName || '',
    })
  }

  await takeoutStore.completeOrder(order.id)
  completing.value = false
  confirmingOrder.value = null
}

/* ── 即時計時：每秒更新，讓「等候時間」動起來 ── */
const now = ref(Date.now())
let clockTimer = null
onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now() }, 1000 * 60) })
onUnmounted(() => { clearInterval(clockTimer) })

function elapsedTime(createdAt) {
  if (!createdAt) return '--:--'
  const diff = Math.max(0, Math.floor((now.value - new Date(createdAt).getTime()) / 1000))
  const hours   = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/* ── 訂單 ID 格式化 ── */
function formatOrderId(order) {
  if (order.pickupNumber && order.createdAt) {
    const d = new Date(order.createdAt)
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}${mm}${dd}${String(order.pickupNumber).padStart(2, '0')}`
  }
  return order.id.slice(0, 8).toUpperCase()
}
</script>

<style scoped>
.tk {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.tk__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 頁面標題列 ── */
.tk__page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px 8px;
  flex-shrink: 0;
}

.tk__page-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tk__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tk__view-btn {
  width: 30px;
  height: 30px;
  border-radius: var(--radius-sm);
  background: #f0e8d8;
  color: #7a6850;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.tk__view-btn:hover { background: #e8dcc8; }

.tk__pending-badge {
  font-size: 12.5px;
  font-weight: 500;
  color: #8a6020;
  background: #fde8c0;
  padding: 4px 12px;
  border-radius: var(--radius-full);
}

/* ── 列表區 ── */
.tk__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 16px;
  background: var(--color-bg-map);
}

/* 橫向模式：body 不能自己捲，要讓 grid 橫捲 */
.tk__body--h {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.tk__empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--fs-base);
  padding: 60px 0;
}

/* ── 3×2 緊湊格：所有卡片固定高度，多於 6 張往下捲 ── */
.tk__grid--compact {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-auto-rows: 300px;
  gap: 12px;
}

/* ── 橫向滑動：3 張同時可見，右滑看更多 ── */
.tk__grid--h {
  flex: 1;
  display: flex;
  flex-direction: row;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  padding-bottom: 4px;   /* 讓捲軸有空間顯示 */
}

.tk__grid--h .tk__card {
  flex: 0 0 calc(33.333% - 8px);
  min-width: 260px;
  height: 100%;
  scroll-snap-align: start;
}

/* ── 訂單卡片 ── */
.tk__card {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 12px 14px 10px;
  display: flex;
  flex-direction: column;
  gap: 0;
  overflow: hidden;
}

.tk__card-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  flex-shrink: 0;
}

.tk__card-num {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #3a3028;
  color: #fff;
  font-size: 13px;   /* +2 */
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}

.tk__card-info {
  flex: 1;
  min-width: 0;
}

.tk__card-id {
  font-size: 13.5px;   /* +2 */
  font-weight: 500;
  color: var(--color-text-primary);
}

.tk__card-customer {
  font-size: 13px;   /* +2 */
  color: var(--color-text-secondary);
  margin-top: 2px;
}

.tk__done-btn {
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #3a7a3a;
  color: #fff;
  font-size: 13px;   /* +2 */
  font-weight: 600;
  line-height: 1.3;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  transition: background 0.15s;
}

.tk__done-btn:hover { background: #2a6a2a; }

.tk__card-sub {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 0 5px;
  border-top: 1px dashed #ede5d0;
  border-bottom: 1px dashed #ede5d0;
  margin-top: 8px;
  flex-shrink: 0;
}

.tk__card-elapsed {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;   /* +2 */
  color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.tk__card-total {
  font-size: 16px;   /* +2 */
  font-weight: 600;
  color: var(--color-text-primary);
}

.tk__items-wrap {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  margin-top: 5px;
}

.tk__items {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;   /* +2 */
}

.tk__items th {
  text-align: left;
  color: var(--color-text-muted);
  font-weight: 500;
  font-size: 13.5px;   /* +2 */
  padding: 0 4px 4px 0;
  border-bottom: 1px solid #f0e8d8;
  white-space: nowrap;
  position: sticky;
  top: 0;
  background: #fff;
}

.tk__items td {
  color: var(--color-text-primary);
  padding: 4px 4px 4px 0;
  vertical-align: top;
}

.tk__items-name  { width: 48%; }
.tk__items-note  { width: 27%; }
.tk__items-qty   { width: 10%; text-align: right; }
.tk__items-price { width: 15%; text-align: right; }

.tk__items-note-cell { color: var(--color-text-muted); }

/* ── 標籤 + 備註：表格下方 ── */
.tk__card-footer {
  flex-shrink: 0;
  margin-top: 6px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.tk__card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.tk__tag-pill {
  font-size: 12.5px;   /* +2 */
  font-weight: 500;
  padding: 2px 9px;
  border-radius: 999px;
}

.tk__card-note {
  font-size: 14px;   /* +2 */
  color: var(--color-text-secondary);
  background: #faf5ec;
  padding: 5px 8px;
  border-radius: var(--radius-sm);
}

/* ── 確認彈窗 ── */
.tk-confirm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.tk-confirm-box {
  background: #fff;
  border-radius: 16px;
  width: 300px;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.tk-confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a0800;
  margin-bottom: 12px;
}

.tk-confirm-body {
  background: #faf5ec;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--color-text-primary);
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.tk-confirm-id {
  font-size: 11.5px;
  color: var(--color-text-secondary);
}

.tk-confirm-total {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-top: 4px;
}

.tk-confirm-hint {
  font-size: 11.5px;
  color: #2f7a3d;
  background: #e1f3e1;
  padding: 6px 10px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.tk-confirm-actions {
  display: flex;
  gap: 8px;
}

.tk-confirm-cancel {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.tk-confirm-cancel:hover { background: #e8dcc8; }

.tk-confirm-ok {
  flex: 2;
  padding: 10px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: #3a7a3a;
  border: none;
  transition: background 0.15s;
}

.tk-confirm-ok:hover:not(:disabled) { background: #2a6a2a; }
.tk-confirm-ok:disabled { opacity: 0.6; }
</style>