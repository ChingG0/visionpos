<template>
  <div class="dk">
    <AppSidebar />

    <div class="dk__main">
      <AppTopbar :show-floor-tabs="false" title="" />

      <div class="dk__page-header">
        <div class="dk__page-header-left">
          <h2 class="dk__title">外送訂單</h2>
          <span class="dk__source-badge">Uber Eats</span>
          <button class="dk__view-btn" @click="isCompact = !isCompact">
            <svg v-if="isCompact" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="1" y="1" width="5" height="5" rx="1"/><rect x="7.5" y="1" width="5" height="5" rx="1"/><rect x="14" y="1" width="5" height="5" rx="1"/>
              <rect x="1" y="7.5" width="5" height="5" rx="1"/><rect x="7.5" y="7.5" width="5" height="5" rx="1"/><rect x="14" y="7.5" width="5" height="5" rx="1"/>
              <rect x="1" y="14" width="5" height="5" rx="1"/><rect x="7.5" y="14" width="5" height="5" rx="1"/><rect x="14" y="14" width="5" height="5" rx="1"/>
            </svg>
            <svg v-else viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6">
              <rect x="1" y="1" width="8" height="8" rx="1.5"/><rect x="11" y="1" width="8" height="8" rx="1.5"/>
              <rect x="1" y="11" width="8" height="8" rx="1.5"/><rect x="11" y="11" width="8" height="8" rx="1.5"/>
            </svg>
          </button>
        </div>
        <span class="dk__pending-badge">待配送 {{ deliveryStore.orders.length }} 單</span>
      </div>

      <div class="dk__body" :class="{ 'dk__body--h': !isCompact }">
        <p v-if="deliveryStore.loading" class="dk__empty">載入中...</p>
        <p v-else-if="deliveryStore.orders.length === 0" class="dk__empty">
          目前沒有待配送的外送訂單
          <span class="dk__empty-hint">（Uber Eats 新訂單進來會自動顯示，不需要重新整理）</span>
        </p>

        <div v-else class="dk__grid" :class="isCompact ? 'dk__grid--compact' : 'dk__grid--h'">
          <div v-for="(order, idx) in deliveryStore.orders" :key="order.id" class="dk__card">

            <div class="dk__card-head">
              <span class="dk__card-num">{{ String(idx + 1).padStart(2, '0') }}</span>

              <div class="dk__card-info">
                <div class="dk__card-id">訂單號：#{{ formatOrderId(order) }}</div>
                <div v-if="order.customerName"    class="dk__card-customer">訂購人：{{ order.customerName }}</div>
                <div v-if="order.deliveryAddress" class="dk__card-customer dk__card-address">
                  📍 {{ order.deliveryAddress }}
                </div>
              </div>

              <div class="dk__card-actions">
                <button class="dk__done-btn" @click="confirmComplete(order)">
                  確認<br>完成
                </button>
                <button class="dk__print-btn" :disabled="printingId === order.id" @click="handlePrint(order)" title="補印收據">
                  <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 7V2h10v5"/><path d="M5 14H2V7h16v7h-3"/><path d="M5 14v4h10v-4"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="dk__card-sub">
              <span class="dk__card-elapsed">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="8" cy="8" r="6.5"/>
                  <path d="M8 4.5V8l2.5 2"/>
                </svg>
                {{ elapsedTime(order.createdAt) }}
              </span>
              <span class="dk__card-total">${{ order.total?.toFixed(0) ?? '—' }}</span>
            </div>

            <div class="dk__items-wrap">
              <table class="dk__items">
                <thead>
                  <tr>
                    <th class="dk__items-name">品名</th>
                    <th class="dk__items-qty">數量</th>
                    <th class="dk__items-price">金額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(line, i) in order.items" :key="i">
                    <td>{{ line.name }}</td>
                    <td>{{ line.qty }}</td>
                    <td>{{ (line.price * line.qty).toFixed(0) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="order.note" class="dk__card-footer">
              <div class="dk__card-note">📝 {{ order.note }}</div>
            </div>

          </div>
        </div>
      </div>
    </div>

    <!-- 確認完成彈窗 -->
    <Teleport to="body">
      <div v-if="confirmingOrder" class="dk-confirm-backdrop" @click.self="confirmingOrder = null">
        <div class="dk-confirm-box">
          <p class="dk-confirm-title">確認完成外送？</p>
          <div class="dk-confirm-body">
            <p class="dk-confirm-id">訂單 #{{ formatOrderId(confirmingOrder) }}</p>
            <p v-if="confirmingOrder.customerName">訂購人：{{ confirmingOrder.customerName }}</p>
            <p v-if="confirmingOrder.deliveryAddress" class="dk-confirm-address">📍 {{ confirmingOrder.deliveryAddress }}</p>
            <p class="dk-confirm-total">合計 ${{ confirmingOrder.total?.toFixed(0) }}</p>
          </div>
          <div class="dk-confirm-actions">
            <button class="dk-confirm-cancel" @click="confirmingOrder = null">取消</button>
            <button class="dk-confirm-ok" :disabled="completing" @click="doComplete">
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
import AppSidebar     from '@/components/layout/AppSidebar.vue'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import { useDeliveryStore } from '@/stores/deliveryStore.js'
import { printOrderReceipt } from '@/lib/printer.js'

const deliveryStore = useDeliveryStore()

/* ── 補印 ── */
const printingId = ref(null)

async function handlePrint(order) {
  if (printingId.value) return
  printingId.value = order.id
  const result = await printOrderReceipt({
    pickupNumber: order.pickupNumber,
    orderType:    'delivery',
    items:        order.items ?? [],
    tags:         [],
    note:         order.note  ?? '',
    subtotal:     order.subtotal ?? 0,
    surchargeAmount: 0,
    discountAmount:  0,
    total:        order.total ?? 0,
  })
  if (!result.success) alert('補印失敗，確認出單機是否開機並連上網路。')
  printingId.value = null
}

onMounted(()  => deliveryStore.init())
onUnmounted(() => deliveryStore.dispose())  // 清除 Realtime 訂閱

const isCompact = ref(true)
const confirmingOrder = ref(null)
const completing       = ref(false)

function confirmComplete(order) { confirmingOrder.value = order }

async function doComplete() {
  const order = confirmingOrder.value
  if (!order || completing.value) return
  completing.value = true
  await deliveryStore.completeOrder(order.id)
  completing.value = false
  confirmingOrder.value = null
}

const now = ref(Date.now())
let clockTimer = null
onMounted(() => { clockTimer = setInterval(() => { now.value = Date.now() }, 1000 * 60) })
onUnmounted(() => { clearInterval(clockTimer) })

function elapsedTime(createdAt) {
  if (!createdAt) return '--:--'
  const diff    = Math.max(0, Math.floor((now.value - new Date(createdAt).getTime()) / 1000))
  const hours   = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatOrderId(order) {
  if (order.pickupNumber && order.createdAt) {
    const d  = new Date(order.createdAt)
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}${mm}${dd}${String(order.pickupNumber).padStart(2, '0')}`
  }
  return order.id.slice(0, 8).toUpperCase()
}
</script>

<style scoped>
.dk { width: 100%; height: 100%; display: flex; overflow: hidden; }

.dk__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.dk__page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px 8px;
  flex-shrink: 0;
}

.dk__page-header-left { display: flex; align-items: center; gap: 10px; }

.dk__title { font-size: 20px; font-weight: 600; color: var(--color-text-primary); }

.dk__source-badge {
  font-size: 11px;
  font-weight: 500;
  color: #fff;
  background: #06c167;   /* Uber Eats 綠 */
  padding: 3px 9px;
  border-radius: var(--radius-full);
}

.dk__view-btn {
  width: 30px; height: 30px;
  border-radius: var(--radius-sm);
  background: #f0e8d8; color: #7a6850;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
}
.dk__view-btn:hover { background: #e8dcc8; }

.dk__pending-badge {
  font-size: 12.5px; font-weight: 500;
  color: #1a6035; background: #d0f0e0;
  padding: 4px 12px; border-radius: var(--radius-full);
}

.dk__body {
  flex: 1; overflow-y: auto;
  padding: 8px 16px 16px;
  background: var(--color-bg-map);
}

.dk__body--h { overflow: hidden; display: flex; flex-direction: column; }

.dk__empty {
  text-align: center; color: var(--color-text-muted);
  font-size: var(--fs-base); padding: 60px 0;
  display: flex; flex-direction: column; gap: 8px; align-items: center;
}

.dk__empty-hint { font-size: 12px; color: var(--color-text-muted); }

.dk__grid { display: grid; gap: 12px; }
.dk__grid--compact { grid-template-columns: repeat(3, 1fr); grid-auto-rows: 300px; }
.dk__grid--h {
  flex: 1; display: flex; flex-direction: row; gap: 12px;
  overflow-x: auto; overflow-y: hidden;
  scroll-snap-type: x mandatory; padding-bottom: 4px;
}
.dk__grid--h .dk__card {
  flex: 0 0 calc(33.333% - 8px); min-width: 260px;
  height: 100%; scroll-snap-align: start;
}

.dk__card {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 12px 14px 10px;
  display: flex; flex-direction: column; gap: 0; overflow: hidden;
}

.dk__card-head { display: flex; align-items: flex-start; gap: 10px; flex-shrink: 0; }

.dk__card-num {
  flex-shrink: 0; width: 28px; height: 28px; border-radius: 50%;
  background: #1a5c38; color: #fff; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; margin-top: 2px;
}

.dk__card-info { flex: 1; min-width: 0; }

.dk__card-id { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); }

.dk__card-customer { font-size: 13px; color: var(--color-text-secondary); margin-top: 2px; }

.dk__card-address {
  font-size: 11.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.dk__card-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
}

.dk__done-btn {
  flex-shrink: 0; width: 52px; height: 52px; border-radius: 50%;
  background: #06c167; color: #fff; font-size: 13px; font-weight: 600;
  line-height: 1.3; display: flex; align-items: center;
  justify-content: center; text-align: center; transition: background 0.15s;
}
.dk__done-btn:hover { background: #04a857; }

.dk__print-btn {
  width: 30px; height: 30px; border-radius: 50%;
  background: #f0e8d8; color: #7a6850; border: 1px solid #c8b89a;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
}
.dk__print-btn:hover:not(:disabled) { background: #e8dcc8; }
.dk__print-btn:disabled { opacity: 0.5; }

.dk__card-sub {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 0 5px;
  border-top: 1px dashed #ede5d0; border-bottom: 1px dashed #ede5d0;
  margin-top: 8px; flex-shrink: 0;
}

.dk__card-elapsed {
  display: flex; align-items: center; gap: 4px;
  font-size: 14px; color: var(--color-text-secondary);
  font-variant-numeric: tabular-nums;
}

.dk__card-total { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }

.dk__items-wrap { flex: 1; overflow-y: auto; min-height: 0; margin-top: 5px; }

.dk__items { width: 100%; border-collapse: collapse; font-size: 15px; }

.dk__items th {
  text-align: left; color: var(--color-text-muted); font-weight: 500; font-size: 13.5px;
  padding: 0 4px 4px 0; border-bottom: 1px solid #f0e8d8; white-space: nowrap;
  position: sticky; top: 0; background: #fff;
}

.dk__items td { color: var(--color-text-primary); padding: 4px 4px 4px 0; vertical-align: top; }

.dk__items-name  { width: 60%; }
.dk__items-qty   { width: 15%; text-align: right; }
.dk__items-price { width: 25%; text-align: right; }

.dk__card-footer { flex-shrink: 0; margin-top: 6px; }

.dk__card-note {
  font-size: 14px; color: var(--color-text-secondary);
  background: #faf5ec; padding: 5px 8px; border-radius: var(--radius-sm);
}

/* ── 確認彈窗 ── */
.dk-confirm-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.dk-confirm-box {
  background: #fff; border-radius: 16px; width: 300px;
  padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  font-family: 'Noto Sans TC','PingFang TC',sans-serif;
}
.dk-confirm-title { font-size: 16px; font-weight: 600; color: #1a0800; margin-bottom: 12px; }
.dk-confirm-body {
  background: #f0faf4; border-radius: 10px; padding: 10px 12px;
  font-size: 13px; color: var(--color-text-primary);
  display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;
}
.dk-confirm-id { font-size: 11.5px; color: var(--color-text-secondary); }
.dk-confirm-address { font-size: 12px; color: var(--color-text-secondary); }
.dk-confirm-total { font-size: 15px; font-weight: 600; margin-top: 4px; }
.dk-confirm-actions { display: flex; gap: 8px; }
.dk-confirm-cancel {
  flex: 1; padding: 10px; border-radius: 10px; font-size: 13px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.dk-confirm-cancel:hover { background: #e8dcc8; }
.dk-confirm-ok {
  flex: 2; padding: 10px; border-radius: 10px;
  font-size: 14px; font-weight: 600; color: #fff; background: #06c167; border: none;
}
.dk-confirm-ok:hover:not(:disabled) { background: #04a857; }
.dk-confirm-ok:disabled { opacity: 0.6; }
</style>