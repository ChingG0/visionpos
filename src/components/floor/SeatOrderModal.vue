<template>
  <Teleport to="body">
    <div class="som-backdrop" @click.self="emit('close')">
      <div class="som-box">

        <!-- ── Header ── -->
        <div class="som-header">
          <div class="som-header-left">
            <span class="som-seat-badge">{{ seat.name }}</span>
            <span class="som-time">{{ elapsedTime }}</span>
          </div>
          <div class="som-header-right">
            <button
              v-if="currentOrder && !currentIsPaid"
              class="som-icon-btn som-icon-btn--danger"
              @click="showCancelModal = true"
              title="取消訂單"
            >
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 5.5h14"/><path d="M15.5 5.5l-1 11.5h-9L4.5 5.5"/><path d="M7.5 5.5V3.5h5v2"/>
              </svg>
            </button>
            <button v-if="currentOrder" class="som-icon-btn" :disabled="printing" @click="handlePrint" title="補印">
              <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 7V2h10v5"/><path d="M5 14H2V7h16v7h-3"/><path d="M5 14v4h10v-4"/>
              </svg>
            </button>
            <button class="som-close" @click="emit('close')">×</button>
          </div>
        </div>

        <!-- ── 載入中 ── -->
        <div v-if="loading" class="som-empty">載入中...</div>

        <!-- ── 無訂單 ── -->
        <div v-else-if="orders.length === 0" class="som-empty">
          <p>找不到此座位的訂單</p>
          <p class="som-empty-hint">可能已從其他裝置刪除</p>
          <div class="som-footer">
            <button class="som-btn-red" @click="handleReset">清空座位</button>
            <button class="som-btn-ghost" @click="emit('close')">關閉</button>
          </div>
        </div>

        <!-- ── 訂單詳情 ── -->
        <template v-else>

          <!-- 付款狀態條 -->
          <div class="som-status-bar" :class="currentIsPaid ? 'som-status-bar--paid' : 'som-status-bar--unpaid'">
            <span>{{ currentIsPaid ? `✓ 已付款：${currentOrder.paymentMethod}` : '⏳ 未結帳' }}</span>
            <button v-if="orders.length === 1" class="som-add-order-link" @click="handleAddOrder">＋ 加單</button>
          </div>

          <!-- 多單標籤列 -->
          <div v-if="orders.length > 1" class="som-tabs">
            <button v-for="(o, i) in orders" :key="o.id"
              class="som-tab" :class="{ 'som-tab--active': activeIdx === i }"
              @click="activeIdx = i">
              <span class="som-tab-merge" v-if="mergeMode">
                <input type="checkbox" :checked="mergeSet.has(o.id)"
                  @change="toggleMerge(o.id)" @click.stop />
              </span>
              第{{ i + 1 }}單
              <span class="som-tab-price">${{ o.total?.toFixed(0) }}</span>
            </button>
            <button class="som-tab som-tab--add" @click="handleAddOrder">＋</button>
          </div>

          <!-- 品項清單 -->
          <div class="som-body">
            <table class="som-table">
              <thead>
                <tr>
                  <th>品名</th>
                  <th class="som-th-num">數量</th>
                  <th class="som-th-num">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, i) in currentOrder.items" :key="i">
                  <td>
                    {{ line.name }}
                    <span v-if="lineExtraText(line)" class="som-line-extra">{{ lineExtraText(line) }}</span>
                  </td>
                  <td class="som-td-num">{{ line.qty }}</td>
                  <td class="som-td-num">${{ (line.price * line.qty).toFixed(0) }}</td>
                </tr>
              </tbody>
            </table>
            <div v-if="currentOrder.tags?.length || currentOrder.note" class="som-extras">
              <div v-if="currentOrder.tags?.length" class="som-tags">
                <span v-for="tag in currentOrder.tags" :key="tag.id" class="som-tag-pill"
                  :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }">
                  {{ tag.label }}
                </span>
              </div>
              <p v-if="currentOrder.note" class="som-note">📝 {{ currentOrder.note }}</p>
            </div>
          </div>

          <!-- 金額小計 -->
          <div class="som-summary">
            <div class="som-row"><span>小計</span><span>${{ currentOrder.subtotal?.toFixed(0) }}</span></div>
            <div v-if="currentSurcharge > 0" class="som-row"><span>加價</span><span>+${{ currentSurcharge.toFixed(0) }}</span></div>
            <div v-if="currentDiscount > 0" class="som-row som-row--disc"><span>折扣</span><span>-${{ currentDiscount.toFixed(0) }}</span></div>
            <div class="som-row som-row--total"><span>總計</span><span>${{ currentOrder.total?.toFixed(0) }}</span></div>
          </div>

          <!-- 底部操作 -->
          <div class="som-footer">

            <!-- ✅ 已付款：取消訂單 → 完成訂單（清桌） -->
            <button v-if="currentIsPaid"
              class="som-btn-complete" style="flex:1"
              :disabled="completing" @click="completeCurrent">
              {{ completing ? '處理中...' : '✓ 完成訂單' }}
            </button>

            <!-- 未付款：正常操作列 -->
            <template v-else>
              <!-- 修改目前這張單的內容（跳到點餐頁的修改模式） -->
              <button class="som-btn-edit" @click="handleEditOrder">✎ 修改訂單</button>

              <!-- 併單模式開關（2張以上才有） -->
              <button v-if="orders.length > 1 && !mergeMode" class="som-btn-merge" @click="startMerge">
                ☰ 併單
              </button>
              <button v-if="mergeMode" class="som-btn-ghost" @click="cancelMerge">取消併單</button>

              <!-- 結帳按鈕 -->
              <template v-if="mergeMode && mergeSet.size > 0">
                <button class="som-btn-checkout" @click="showMergePayment = true">
                  💳 併單結帳 ${{ mergeTotal.toFixed(0) }}
                </button>
              </template>
              <template v-else>
                <button class="som-btn-checkout" :disabled="completing" @click="showPaymentModal = true">
                  💳 結帳
                </button>
              </template>
            </template>

          </div>
        </template>

      </div>
    </div>

    <!-- ── 取消訂單確認 ── -->
    <div v-if="showCancelModal" class="som-overlay" @click.self="showCancelModal = false">
      <div class="som-dialog">
        <p class="som-dialog-title">確認取消訂單？</p>
        <p class="som-dialog-sub">{{ seat.name }}・第{{ activeIdx + 1 }}單</p>
        <div class="som-field">
          <label>取消原因（選填）</label>
          <input v-model="cancelReason" class="som-input" type="text" placeholder="例：客人臨時離開..." @keyup.enter="handleCancelConfirm" />
        </div>
        <p class="som-staff-note">操作人員：{{ currentStaffLabel }}（自動記錄）</p>
        <div class="som-dialog-footer">
          <button class="som-btn-ghost" @click="showCancelModal = false">返回</button>
          <button class="som-btn-danger" :disabled="cancelling" @click="handleCancelConfirm">
            {{ cancelling ? '處理中...' : '確認取消' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── 單張結帳 PaymentModal（這裡結的本來就是「稍後付款」訂單，不該再選一次稍後付款；
         結帳前可以在這個畫面裡直接調整折扣）── -->
    <PaymentModal
      v-if="showPaymentModal"
      :total="currentOrder?.total ?? 0"
      :allow-defer="false"
      :allow-discount-edit="true"
      :subtotal="currentOrder?.subtotal ?? 0"
      :surcharge-amount="currentSurcharge"
      :discount="currentOrder?.discount ?? null"
      @close="showPaymentModal = false"
      @update:discount="handleSaveDiscount"
      @paid="handlePaymentAndComplete"
    />

    <!-- ── 併單結帳 PaymentModal（不允許稍後付款） ── -->
    <PaymentModal
      v-if="showMergePayment"
      :total="mergeTotal"
      :allow-defer="false"
      @close="showMergePayment = false"
      @paid="handleMergePaymentAndComplete"
    />

  </Teleport>
</template>

<script setup>
import { discountAmountOf, orderDiscountAmount } from '@/lib/orderPayment.js'
import { ref, computed, onMounted } from 'vue'
import { useDineInStore }    from '@/stores/dineInStore.js'
import { useAuthStore }      from '@/stores/authStore.js'
import { resetSeatStatus, markTablePaid } from '@/lib/floorOrders.js'
import { TAG_COLOR_MAP }     from '@/constants/tagColors.js'
import { printOrderReceipt } from '@/lib/printer.js'
import { supabase }          from '@/lib/supabase.js'
import PaymentModal          from '@/components/order/PaymentModal.vue'

const props = defineProps({
  seat: { type: Object, required: true },
  // 從工作站「結帳」按鈕跳轉過來時，指定要直接開到哪一張分單（同桌可能有多張）
  focusOrderId: { type: [String, Number], default: null },
})
const emit  = defineEmits(['close', 'completed', 'add-order', 'payment-done', 'edit-order'])

const dineInStore = useDineInStore()
const loading     = ref(true)
const completing  = ref(false)
const printing    = ref(false)

/* ── 訂單列表（同桌可多張） ── */
const orders    = ref([])
const activeIdx = ref(0)

onMounted(() => {
  orders.value    = [...dineInStore.getOrdersBySeatId(props.seat.id)]
  const focusIdx  = props.focusOrderId != null
    ? orders.value.findIndex(o => String(o.id) === String(props.focusOrderId))
    : -1
  activeIdx.value = focusIdx >= 0 ? focusIdx : 0
  loading.value   = false
})

const currentOrder  = computed(() => orders.value[activeIdx.value] ?? null)
const currentIsPaid = computed(() => {
  // 同時支援 camelCase（store 映射後）與 snake_case（直接從 DB 來的欄位）
  const m = currentOrder.value?.paymentMethod ?? currentOrder.value?.payment_method
  return !!m && m !== '稍後付款'
})

/* ── 金額計算 ── */
const currentSurcharge = computed(() => currentOrder.value?.surcharge?.amount ?? 0)
const currentDiscount  = computed(() =>
  discountAmountOf(currentOrder.value?.discount, (currentOrder.value?.subtotal ?? 0) + currentSurcharge.value)
)

/* ── 等候時間 ── */
const elapsedTime = computed(() => {
  const t = currentOrder.value?.createdAt ?? orders.value[0]?.createdAt
  if (!t) return ''
  const diff    = Math.max(0, Math.floor((Date.now() - new Date(t).getTime()) / 1000))
  const hours   = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  return hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}m` : `${minutes} 分鐘`
})

function tagColorOf(tag) { return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray }

/* 單品標籤 + 手輸備註，印在品名下方一行 */
function lineExtraText(line) {
  const parts = []
  if (line.tags?.length) parts.push(line.tags.map(t => t.label).join('、'))
  if (line.note)         parts.push(line.note)
  return parts.join('　')
}

/* ── 加單（通知 DineInView 切換到新訂單模式） ── */
function handleAddOrder() {
  emit('add-order', props.seat)
}

/* ── 修改訂單：帶著這張訂單的 id 跳到點餐頁的「修改模式」，
 *    在那邊可以加/刪品項、改標籤備註，存檔後回到內用頁。 ── */
function handleEditOrder() {
  if (!currentOrder.value) return
  emit('edit-order', { seat: props.seat, orderId: currentOrder.value.id })
}

/* ── 完成結帳（已付款）──────────────────────────────────────────────────
   併單結帳時，整組訂單會一起被標記付款，但畫面上只會顯示「目前這張」的
   完成按鈕；如果這裡只完成 currentOrder，其他併單的訂單會永遠卡在 active
   狀態，既不會進報表、金額也就對不起來。改成：把「所有已付款」的訂單
   一次全部完成，非目前這張但同樣已付款的（併單/分次結帳都算）也一起結掉。 */
async function completeCurrent() {
  if (!currentOrder.value || completing.value) return
  completing.value = true

  const paidOrders = orders.value.filter(o => {
    const m = o.paymentMethod ?? o.payment_method
    return !!m && m !== '稍後付款'
  })
  const idsToComplete = paidOrders.length > 0
    ? paidOrders.map(o => o.id)
    : [currentOrder.value.id]

  const result = await dineInStore.completeOrders(idsToComplete, props.seat.id)
  if (result === 'last') {
    await resetSeatStatus(props.seat.id)
    emit('completed', props.seat.id)
    emit('close')
  } else {
    orders.value = orders.value.filter(o => !idsToComplete.includes(o.id))
    activeIdx.value = Math.min(activeIdx.value, Math.max(orders.value.length - 1, 0))
  }
  completing.value = false
}

/* ── 稍後付款訂單，結帳前可先在 PaymentModal 內調整折扣（%或金額）── */
async function handleSaveDiscount(newDiscount) {
  if (!currentOrder.value) return
  const base = (currentOrder.value.subtotal ?? 0) + currentSurcharge.value
  const discountAmount = discountAmountOf(newDiscount, base)
  const newTotal = Math.max(0, base - discountAmount)
  await dineInStore.updateOrderDiscount(currentOrder.value.id, props.seat.id, newDiscount, newTotal)
  orders.value = [...dineInStore.getOrdersBySeatId(props.seat.id)]
}

/* ── 稍後付款 → 開 PaymentModal → 結帳 ── */
const showPaymentModal = ref(false)

async function handlePaymentAndComplete({ methodLabel, paymentAmount, changeAmount, carrierNum, buyerTaxId, printDetail }) {
  // 重號檢核（項次 1）：防連點，處理中直接擋掉第二次觸發
  if (completing.value) return
  showPaymentModal.value = false
  if (!currentOrder.value) return
  completing.value = true

  // 先抓成區域變數：下面幾步會刷新 orders / currentOrder，之後再讀就不是這張單了
  const order    = currentOrder.value
  const orderId  = order.id
  const items    = order.items
  const total    = order.total
  const subtotal = order.subtotal
  const surcharge = order.surcharge?.amount ?? 0
  const discount  = orderDiscountAmount(order)

  // ① 只寫入付款資訊，不結束訂單
  await supabase.from('dine_in_orders').update({
    payment_method: methodLabel, payment_amount: paymentAmount, change_amount: changeAmount,
  }).eq('id', orderId)

  // ② 同步更新 dineInStore 快取（關掉重開 modal 也能讀到正確狀態）
  dineInStore.markOrdersPaid(props.seat.id, [orderId], methodLabel, paymentAmount, changeAmount)

  // ③ 更新 local 訂單，讓畫面立即反應
  orders.value = [...dineInStore.getOrdersBySeatId(props.seat.id)]

  // ④ 座位圖從橘色 → 綠色（已付款）
  await markTablePaid(props.seat.id)

  // ⑤ 通知 DineInView 刷新 FloorMap
  emit('payment-done', props.seat.id)

  // ⑥ 電子發票 + 交易明細（稍後付款訂單在這個「真正付款」的時間點才開票／印明細）
  await settleReceipts({
    orderId, items, total, carrierNum, buyerTaxId, printDetail,
    detail: {
      items, subtotal, total,
      surchargeAmount: surcharge,
      discountAmount:  discount,
      paymentLabel:    methodLabel,
      paymentAmount,
      changeAmount,
    },
  })

  completing.value = false
}

/* ── 稍後付款訂單真正結帳時的憑證輸出（單張 / 併單共用）────────────────────────
   NewOrderView 的即時付款流程在訂單建立當下就開票；「稍後付款」訂單當初建立時
   刻意不開票（金額/品項可能還會變），所以要在這裡、真正收到錢的這一刻才開票，
   並讓店員在這個 PaymentModal 上重新輸入統編/載具。交易明細同理——要等收款方式
   跟找零確定才有東西可印（跟 NewOrderView 用同一套 useInvoice.finalizeCheckout，
   同樣是 fire-and-forget，不阻擋結帳流程）。 */
async function settleReceipts({ orderId, items, total, carrierNum, buyerTaxId, printDetail, detail }) {
  if (!orderId) return
  try {
    const { useInvoice } = await import('@/composables/useInvoice.js')
    const { finalizeCheckout } = useInvoice()
    await finalizeCheckout({
      id:        orderId,
      orderType: 'dine_in',
      items,
      total,
      buyerTaxId,
      carrierNum,
      printDetail,
      detail,
    })
  } catch (e) {
    console.error('[invoice] 稍後付款結帳開票失敗', e)
  }
}

/* ── 併單 ── */
const mergeMode       = ref(false)
const mergeSet        = ref(new Set())
const showMergePayment = ref(false)

const mergeTotal = computed(() => {
  return orders.value
    .filter(o => mergeSet.value.has(o.id))
    .reduce((s, o) => s + (o.total ?? 0), 0)
})

function startMerge() {
  mergeMode.value = true
  mergeSet.value  = new Set(orders.value.map(o => o.id))  // 預設全選
}

function cancelMerge() {
  mergeMode.value = false
  mergeSet.value  = new Set()
}

function toggleMerge(orderId) {
  const s = new Set(mergeSet.value)
  s.has(orderId) ? s.delete(orderId) : s.add(orderId)
  mergeSet.value = s
}

async function handleMergePaymentAndComplete({ methodLabel, paymentAmount, changeAmount, carrierNum, buyerTaxId, printDetail }) {
  // 重號檢核（項次 1）：防連點，處理中直接擋掉第二次觸發
  if (completing.value) return
  showMergePayment.value = false
  completing.value = true
  const ids = [...mergeSet.value]

  // 併單只開「一張」發票，用第一筆訂單的 id 當作發票對應的 order_id（後端用它做重號防護的
  // 冪等 key）。以前的做法是把付款資訊分別寫回每一張被併的訂單，DB 裡還是 N 筆各自獨立的
  // 紀錄，結果報表會顯示 N 筆、金額被拆散、品項也各自分開——併單結帳照理應該是「一筆」交易。
  // 現在改成：把所有被併訂單的品項/金額合併寫進第一筆（mergedOrderId），其餘的直接標記為
  // 「已併入」（status='cancelled'），這樣報表只會出現合併後的那一筆，時間也統一是這次結帳
  // 的時間，不會再是被併訂單各自原本建立的時間。
  const mergedOrderId  = ids[0]
  const mergedOrders   = orders.value.filter(o => ids.includes(o.id))
  const otherIds       = ids.filter(id => id !== mergedOrderId)
  const mergedItems    = mergedOrders.flatMap(o => o.items ?? [])
  const mergedSubtotal = mergedOrders.reduce((s, o) => s + (o.subtotal ?? 0), 0)
  const mergedTotal    = mergeTotal.value
  const mergedNote     = mergedOrders.map(o => o.note).filter(Boolean).join('；') || null
  const mergedTags     = Array.from(
    new Map(mergedOrders.flatMap(o => o.tags ?? []).map(t => [t.id ?? t.label, t])).values()
  )
  // 加價/折扣也要一起併，不然合併後只留下第一張的加價/折扣，其他被併訂單原本自己的
  // 折扣就會憑空消失——報表上「小計－折扣＋加價」會兌不上「總計」。作法：把每張被併
  // 訂單自己的加價/折扣金額（用跟其他報表一樣的公式算出實際金額）加總，存成 amount 型態。
  const mergedSurcharge = mergedOrders.reduce((s, o) => s + (o.surcharge?.amount ?? 0), 0)
  const mergedDiscount  = mergedOrders.reduce((s, o) => s + orderDiscountAmount(o), 0)
  const now = new Date().toISOString()

  // ① 把合併後的完整資料寫進主單（品項、金額、付款資訊、結帳時間一次到位）
  await supabase.from('dine_in_orders').update({
    items: mergedItems, subtotal: mergedSubtotal, total: mergedTotal,
    tags: mergedTags, note: mergedNote,
    surcharge: mergedSurcharge > 0 ? { amount: mergedSurcharge } : null,
    discount:  mergedDiscount  > 0 ? { type: 'amount', value: mergedDiscount } : null,
    payment_method: methodLabel, payment_amount: paymentAmount, change_amount: changeAmount,
    completed_at: now,
  }).eq('id', mergedOrderId)

  // ② 其餘被併的訂單標記為已併入，不會再出現在報表（reportsStore 只抓 status='done'）
  if (otherIds.length > 0) {
    await Promise.all(otherIds.map(id =>
      supabase.from('dine_in_orders').update({
        status: 'cancelled', completed_at: now,
        note: `[併入 ${formatSeatOrderLabel(mergedOrderId)}]`,
      }).eq('id', id)
    ))
  }

  // ③ 同步更新 dineInStore 快取（關掉重開 modal 也能讀到正確狀態，不用等 Realtime）
  dineInStore.patchOrderLocal(props.seat.id, mergedOrderId, {
    items: mergedItems, subtotal: mergedSubtotal, total: mergedTotal,
    tags: mergedTags, note: mergedNote,
    surcharge: mergedSurcharge > 0 ? { amount: mergedSurcharge } : null,
    discount:  mergedDiscount  > 0 ? { type: 'amount', value: mergedDiscount } : null,
  })
  dineInStore.markOrdersPaid(props.seat.id, [mergedOrderId], methodLabel, paymentAmount, changeAmount)
  for (const id of otherIds) dineInStore.removeOrderLocal(id, props.seat.id)

  // ④ 更新 local 訂單，讓畫面立即反應（只留下合併後的主單）
  orders.value = [...dineInStore.getOrdersBySeatId(props.seat.id)]
  activeIdx.value = 0
  cancelMerge()

  // ⑤ 座位圖橘色 → 綠色
  await markTablePaid(props.seat.id)
  emit('payment-done', props.seat.id)

  // ⑥ 電子發票：併單只開一張，金額/品項用合併後的資料；交易明細同樣印合併後的
  await settleReceipts({
    orderId: mergedOrderId, items: mergedItems, total: mergedTotal,
    carrierNum, buyerTaxId, printDetail,
    detail: {
      items:           mergedItems,
      subtotal:        mergedSubtotal,
      surchargeAmount: mergedSurcharge,
      discountAmount:  mergedDiscount,
      total:           mergedTotal,
      paymentLabel:    methodLabel,
      paymentAmount,
      changeAmount,
    },
  })

  completing.value = false
}

/* 併入紀錄用的簡短標籤（純顯示用，不影響邏輯） */
function formatSeatOrderLabel(orderId) {
  return `#${String(orderId).slice(0, 8).toUpperCase()}`
}

/* ── 補印（靜默） ── */
async function handlePrint() {
  if (!currentOrder.value || printing.value) return
  printing.value = true
  const o = currentOrder.value
  const surchargeAmount = o.surcharge?.amount ?? 0
  const discountAmount = orderDiscountAmount(o)
  await printOrderReceipt({
    pickupNumber: null, orderType: 'dine-in', tableName: props.seat.name,
    items: o.items ?? [], tags: o.tags ?? [], note: o.note ?? '',
    subtotal: o.subtotal ?? 0, surchargeAmount, discountAmount, total: o.total ?? 0,
  })
  printing.value = false
}

/* ── 取消訂單 ─────────────────────────────────────────────────────────────
   原因改成選填（現場忙的時候硬要打字反而讓店員亂填），
   操作人員直接用目前登入的帳號，不用手動輸入也不會被冒名。 */
const showCancelModal = ref(false)
const cancelReason    = ref('')
const cancelling      = ref(false)

const currentStaffLabel = computed(() => {
  const u = useAuthStore().user
  if (!u) return '—'
  return u.username ? `${u.name}（${u.username}）` : (u.name ?? '—')
})

async function handleCancelConfirm() {
  if (!currentOrder.value || cancelling.value) return
  cancelling.value = true
  const result = await dineInStore.cancelOrder(currentOrder.value.id, props.seat.id, {
    reason: cancelReason.value.trim() || '未填寫',
    staff:  currentStaffLabel.value,
  })
  if (result === 'last') { await resetSeatStatus(props.seat.id); emit('completed', props.seat.id); emit('close') }
  else { orders.value = [...dineInStore.getOrdersBySeatId(props.seat.id)]; activeIdx.value = Math.min(activeIdx.value, orders.value.length - 1) }
  cancelling.value = false
  showCancelModal.value = false
  cancelReason.value = ''
}

/* ── 清空座位（找不到訂單時） ── */
async function handleReset() {
  await resetSeatStatus(props.seat.id)
  emit('completed', props.seat.id)
  emit('close')
}
</script>

<style scoped>
.som-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.som-box {
  background: #fff; border-radius: 16px; width: 340px; max-height: 88vh;
  overflow-y: auto; box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  font-family: 'Noto Sans TC','PingFang TC',sans-serif;
  display: flex; flex-direction: column;
}

/* Header */
.som-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 10px; border-bottom: 1px solid #ede5d0; flex-shrink: 0; }
.som-header-left  { display: flex; align-items: center; gap: 10px; }
.som-header-right { display: flex; align-items: center; gap: 5px; }
.som-seat-badge { font-size: 14px; font-weight: 700; background: #fde8c0; color: #7a4010; padding: 3px 12px; border-radius: 999px; }
.som-time       { font-size: 12px; color: var(--color-text-muted); }
.som-icon-btn {
  width: 28px; height: 28px; border-radius: 50%;
  background: #f0e8d8; color: #7a6850; border: 1px solid #c8b89a;
  display: flex; align-items: center; justify-content: center; transition: background 0.12s;
}
.som-icon-btn:hover:not(:disabled) { background: #e8dcc8; }
.som-icon-btn:disabled { opacity: 0.5; }
.som-icon-btn--danger { background: #fff0ee; color: #c0392b; border-color: #f0c0b8; }
.som-icon-btn--danger:hover:not(:disabled) { background: #fde0dc; }
.som-close { width: 26px; height: 26px; border-radius: 50%; background: #f0e8d8; font-size: 16px; color: #7a6850; display: flex; align-items: center; justify-content: center; }
.som-close:hover { background: #e0d0b8; }

/* 狀態條 */
.som-status-bar { display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; font-size: 12px; font-weight: 500; flex-shrink: 0; }
.som-status-bar--paid   { background: #e8f3e8; color: #2f7a3d; border-bottom: 1px solid #c8e8c8; }
.som-status-bar--unpaid { background: #fff8ee; color: #e07020; border-bottom: 1px solid #f0d8a0; }
.som-add-order-link { font-size: 12px; font-weight: 600; color: #e8a038; background: none; border: none; cursor: pointer; padding: 0; }
.som-add-order-link:hover { color: #c88020; }

/* 多單標籤 */
.som-tabs { display: flex; padding: 6px 10px 0; gap: 4px; border-bottom: 1px solid #ede5d0; flex-shrink: 0; overflow-x: auto; }
.som-tab {
  display: flex; align-items: center; gap: 5px;
  padding: 6px 10px; border-radius: 8px 8px 0 0; font-size: 12px; white-space: nowrap;
  color: var(--color-text-muted); background: #f5f0e8; border: 1px solid #ede5d0; border-bottom: none;
  transition: all 0.12s;
}
.som-tab--active { background: #fff; color: var(--color-text-primary); font-weight: 600; border-color: #c8b89a; }
.som-tab--add { background: none; border-style: dashed; color: #e8a038; }
.som-tab--add:hover { background: #fff8ee; }
.som-tab-price { font-size: 11px; color: var(--color-text-muted); }
.som-tab--active .som-tab-price { color: #c08020; }
.som-tab-merge { display: flex; align-items: center; }

/* 品項 */
.som-empty { padding: 28px 14px; text-align: center; color: var(--color-text-muted); font-size: 13px; }
.som-empty-hint { font-size: 11.5px; margin-top: 5px; }
.som-body { padding: 10px 14px; flex: 1; overflow-y: auto; }
.som-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
.som-table th { text-align: left; padding: 5px 6px 5px 0; font-size: 11.5px; color: var(--color-text-muted); border-bottom: 1px solid #f0e8d8; }
.som-th-num { text-align: right; }
.som-table td { padding: 7px 6px 7px 0; border-bottom: 1px solid #faf5ec; color: #1a0800; }
.som-td-num { text-align: right; }
.som-line-extra { display: block; font-size: 11px; color: #c0392b; margin-top: 2px; }
.som-extras { margin-top: 9px; display: flex; flex-direction: column; gap: 5px; }
.som-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.som-tag-pill { font-size: 11.5px; font-weight: 500; padding: 2px 9px; border-radius: 999px; }
.som-note { font-size: 12px; color: var(--color-text-secondary); background: #faf5ec; padding: 5px 8px; border-radius: 6px; }

/* 金額 */
.som-summary { padding: 9px 14px; border-top: 1px solid #ede5d0; display: flex; flex-direction: column; gap: 5px; flex-shrink: 0; }
.som-row { display: flex; justify-content: space-between; font-size: 13px; color: var(--color-text-secondary); }
.som-row--disc  { color: #c0392b; }
.som-row--total { font-size: 15px; font-weight: 700; color: #1a0800; padding-top: 5px; border-top: 1px dashed #e0d5c0; }

/* 底部按鈕 */
.som-footer { padding: 10px 14px 13px; border-top: 1px solid #ede5d0; display: flex; gap: 6px; flex-shrink: 0; }

.som-btn-red    { flex: 1; padding: 9px 6px; border-radius: 10px; font-size: 12.5px; color: #c0392b; background: #fff0ee; border: 1px solid #f0c0b8; }
.som-btn-red:hover { background: #fde0dc; }
.som-btn-ghost  { flex: 1; padding: 9px 6px; border-radius: 10px; font-size: 12.5px; color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a; }
.som-btn-ghost:hover { background: #e8dcc8; }
.som-btn-merge  { flex: 1; padding: 9px 6px; border-radius: 10px; font-size: 12.5px; color: #5a6830; background: #f0f3e8; border: 1px solid #c0c8a0; }
.som-btn-merge:hover { background: #e4eccc; }
.som-btn-edit   { flex: 1; padding: 9px 6px; border-radius: 10px; font-size: 12.5px; color: #8a6020; background: #fde8c0; border: 1px solid #e8c888; white-space: nowrap; }
.som-btn-edit:hover { background: #f8dca0; }
.som-btn-complete { flex: 2; padding: 9px 6px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: #fff; background: #2f7a3d; border: none; }
.som-btn-complete:hover:not(:disabled) { background: #236030; }
.som-btn-complete:disabled { opacity: 0.55; }
.som-btn-checkout { flex: 2; padding: 9px 6px; border-radius: 10px; font-size: 13.5px; font-weight: 600; color: #fff; background: #e07020; border: none; }
.som-btn-checkout:hover:not(:disabled) { background: #c06010; }
.som-btn-checkout:disabled { opacity: 0.55; }

/* 對話框 */
.som-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; }
.som-dialog { background: #fff; border-radius: 16px; width: 300px; padding: 18px; box-shadow: 0 12px 40px rgba(0,0,0,0.25); display: flex; flex-direction: column; gap: 12px; font-family: 'Noto Sans TC','PingFang TC',sans-serif; }
.som-dialog-title { font-size: 15px; font-weight: 700; color: #c0392b; }
.som-dialog-sub   { font-size: 12px; color: var(--color-text-secondary); margin-top: -6px; }
.som-field        { display: flex; flex-direction: column; gap: 4px; }
.som-field label  { font-size: 12px; font-weight: 500; color: #5a4030; }
.req { color: #c0392b; }
.som-staff-note {
  font-size: 11.5px; color: var(--color-text-secondary);
  background: #faf5ec; border-radius: 8px; padding: 6px 10px;
}
.som-input { padding: 7px 9px; border: 1.5px solid #c8b89a; border-radius: 8px; font-size: 13px; background: #faf5ec; outline: none; font-family: inherit; }
.som-input:focus { border-color: #c0392b; }
.som-dialog-footer { display: flex; gap: 7px; }
.som-btn-danger { flex: 2; padding: 9px; border-radius: 9px; font-size: 13.5px; font-weight: 600; color: #fff; background: #c0392b; border: none; }
.som-btn-danger:hover:not(:disabled) { background: #a93226; }
.som-btn-danger:disabled { opacity: 0.5; }
</style>