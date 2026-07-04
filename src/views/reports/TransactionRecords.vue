<template>
  <div class="tr">

    <!-- 日期選擇列 -->
    <div class="tr__datebar">
      <div class="tr__date-btns">
        <button v-for="opt in DATE_OPTS" :key="opt.key"
          class="tr__date-btn" :class="{ 'tr__date-btn--active': preset === opt.key }"
          @click="applyPreset(opt.key)">
          {{ opt.label }}
        </button>
      </div>
      <div class="tr__date-custom">
        <input type="date" class="tr__date-input" v-model="customStart" @change="applyCustom" />
        <span>～</span>
        <input type="date" class="tr__date-input" v-model="customEnd" @change="applyCustom" />
      </div>
      <div class="tr__type-filter">
        <button v-for="opt in TYPE_OPTS" :key="opt.key"
          class="tr__type-btn" :class="{ 'tr__type-btn--active': typeFilter === opt.key }"
          @click="typeFilter = opt.key">
          {{ opt.label }}
        </button>
      </div>
      <span v-if="reportsStore.loading" class="tr__loading">載入中...</span>
    </div>

    <!-- 摘要列 -->
    <div class="tr__summary">
      <span>共 <strong>{{ filtered.length }}</strong> 筆</span>
      <span>合計 <strong>${{ fmtNum(sumTotal) }}</strong></span>
    </div>

    <!-- 交易表格 -->
    <div class="tr__table-wrap">
      <table class="tr__table">
        <thead>
          <tr>
            <th class="tr__th">完成時間</th>
            <th class="tr__th">類型</th>
            <th class="tr__th">訂單號</th>
            <th class="tr__th">訂購人</th>
            <th class="tr__th tr__th--wide">品項摘要</th>
            <th class="tr__th tr__th--num">小計</th>
            <th class="tr__th tr__th--num">折扣</th>
            <th class="tr__th tr__th--num">總計</th>
            <th class="tr__th">付款方式</th>
            <th class="tr__th">後4碼</th>
            <th class="tr__th">載具/統編</th>
            <th class="tr__th">發票號碼</th>
            <th class="tr__th">隨機碼</th>
            <th class="tr__th">作廢</th>
            <th class="tr__th">補印</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="reportsStore.loading">
            <td colspan="15" class="tr__empty">載入中...</td>
          </tr>
          <tr v-else-if="filtered.length === 0">
            <td colspan="15" class="tr__empty">此期間無交易紀錄</td>
          </tr>
          <template v-else>
            <tr v-for="order in filtered" :key="order.id" class="tr__row">
              <td class="tr__td tr__td--time">{{ fmtTime(order.completed_at) }}</td>
              <td class="tr__td">
                <span class="tr__type-badge"
                  :class="{
                    'tr__type-badge--takeout':  order.orderType === 'takeout',
                    'tr__type-badge--dinein':   order.orderType === 'dine-in',
                    'tr__type-badge--delivery': order.orderType === 'delivery',
                  }">
                  {{ order.typeLabel }}
                </span>
              </td>
              <td class="tr__td tr__td--id">#{{ formatOrderId(order) }}</td>
              <td class="tr__td">{{ order.customer_name || '—' }}</td>
              <td class="tr__td tr__td--items">{{ summarizeItems(order.items) }}</td>
              <td class="tr__td tr__td--num">${{ fmtNum(order.subtotal) }}</td>
              <td class="tr__td tr__td--num tr__td--discount">
                {{ discountAmount(order) > 0 ? `-$${fmtNum(discountAmount(order))}` : '—' }}
              </td>
              <td class="tr__td tr__td--num tr__td--total">${{ fmtNum(order.total) }}</td>
              <td class="tr__td">
                <span v-if="order.payment_method" class="tr__pay-badge">{{ order.payment_method }}</span>
                <span v-else class="tr__td--muted">—</span>
              </td>
              <!-- 後4碼 -->
              <td class="tr__td tr__td--mono">
                {{ order.card4 ? `${order.card4}` : '—' }}
              </td>
              <!-- 載具/統編 -->
              <td class="tr__td tr__td--mono">
                <span v-if="order.carrier_num" class="tr__carrier-badge">{{ order.carrier_num }}</span>
                <span v-else-if="order.buyer_tax_id" class="tr__taxid-badge">統{{ order.buyer_tax_id }}</span>
                <span v-else class="tr__td--muted">—</span>
              </td>
              <!-- 發票號碼 -->
              <td class="tr__td tr__td--mono">
                <span v-if="invoiceMap[order.id]?.invoice_number" class="tr__invoice-num">
                  {{ invoiceMap[order.id].invoice_number }}
                </span>
                <span v-else class="tr__td--muted">—</span>
              </td>
              <!-- 隨機碼 -->
              <td class="tr__td tr__td--mono">
                {{ invoiceMap[order.id]?.random_code || '—' }}
              </td>
              <!-- 作廢 -->
              <td class="tr__td">
                <template v-if="invoiceMap[order.id]">
                  <span v-if="invoiceMap[order.id].status === 'void'" class="tr__void-badge">已作廢</span>
                  <button v-else class="tr__void-btn" @click="confirmVoid(order, invoiceMap[order.id])">作廢</button>
                </template>
                <span v-else class="tr__td--muted">—</span>
              </td>
              <!-- 補印 -->
              <td class="tr__td">
                <button
                  v-if="invoiceMap[order.id] && invoiceMap[order.id].status !== 'void'"
                  class="tr__reprint-btn"
                  :disabled="reprintingId === order.id"
                  @click="handleReprint(order, invoiceMap[order.id])"
                >
                  {{ reprintingId === order.id ? '列印中...' : '補印' }}
                </button>
                <span v-else class="tr__td--muted">—</span>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p class="tr__note">※ 記錄外帶、內用、外送已完成訂單</p>

    <!-- 作廢確認 Modal -->
    <Teleport to="body">
      <div v-if="voidingInvoice" class="tr__void-modal-bg" @click.self="voidingInvoice = null">
        <div class="tr__void-modal">
          <h3>確認作廢發票</h3>
          <div class="tr__void-info">
            <div>發票號碼：<strong>{{ voidingInvoice.invoice_number }}</strong></div>
            <div>訂單：<strong>#{{ formatOrderId(voidingOrder) }}</strong></div>
            <div>金額：<strong>${{ fmtNum(voidingOrder?.total) }}</strong></div>
          </div>
          <div class="tr__void-reason-wrap">
            <label>作廢原因 <span class="tr__void-required">*</span></label>
            <select v-model="voidReason" class="tr__void-select">
              <option value="">請選擇原因</option>
              <option value="錯誤開立">錯誤開立</option>
              <option value="顧客要求">顧客要求</option>
              <option value="訂單取消">訂單取消</option>
              <option value="金額錯誤">金額錯誤</option>
              <option value="其他">其他</option>
            </select>
            <input v-if="voidReason === '其他'" v-model="voidReasonOther" class="tr__void-input" placeholder="請輸入原因" />
          </div>
          <div class="tr__void-actions">
            <button class="tr__void-cancel" @click="voidingInvoice = null">取消</button>
            <button class="tr__void-confirm" :disabled="!voidReason || voiding" @click="doVoid">
              {{ voiding ? '作廢中...' : '確認作廢' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useReportsStore } from '@/stores/reportsStore.js'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { printInvoiceReceipt } from '@/lib/printer.js'

const reportsStore = useReportsStore()
const authStore    = useAuthStore()

const DATE_OPTS = [
  { key: 'today',     label: '今日' },
  { key: 'yesterday', label: '昨日' },
  { key: 'week',      label: '本週' },
  { key: 'month',     label: '本月' },
]

const TYPE_OPTS = [
  { key: 'all',      label: '全部' },
  { key: 'takeout',  label: '外帶' },
  { key: 'dine-in',  label: '內用' },
  { key: 'delivery', label: '外送' },
]

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function offsetDay(n) {
  const d = new Date(); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

const preset      = ref('today')
const customStart = ref(todayStr())
const customEnd   = ref(todayStr())
const typeFilter  = ref('all')

// 發票對照表 { order_id: invoice }
const invoiceMap = ref({})

async function fetchInvoices(start, end) {
  const storeId = authStore.store?.id
  if (!storeId) return
  const { data } = await supabase
    .from('invoices')
    .select('id, order_id, invoice_number, random_code, status, void_reason, total_amount, sales_amount, tax_amount, invoice_date, buyer_tax_id, seller_tax_id, company_name, items, pos_bar_code, qr_code_left, qr_code_right, qr_code_ready')
    .eq('store_id', storeId)
    .gte('invoice_date', start)
    .lte('invoice_date', end)
  const map = {}
  for (const inv of data ?? []) { map[inv.order_id] = inv }
  invoiceMap.value = map
}

function applyPreset(key) {
  preset.value = key
  const today = todayStr()
  if (key === 'today')     { customStart.value = today; customEnd.value = today }
  if (key === 'yesterday') { const y = offsetDay(-1); customStart.value = y; customEnd.value = y }
  if (key === 'week') {
    const d = new Date(); const dow = d.getDay() || 7
    customStart.value = offsetDay(1 - dow); customEnd.value = today
  }
  if (key === 'month') {
    const d = new Date()
    customStart.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`
    customEnd.value = today
  }
  reportsStore.fetchOrders(customStart.value, customEnd.value)
  fetchInvoices(customStart.value, customEnd.value)
}

function applyCustom() {
  preset.value = ''
  reportsStore.fetchOrders(customStart.value, customEnd.value)
  fetchInvoices(customStart.value, customEnd.value)
}

onMounted(() => applyPreset('today'))

const filtered = computed(() => {
  if (typeFilter.value === 'all') return reportsStore.orders
  return reportsStore.orders.filter(o => o.orderType === typeFilter.value)
})

const sumTotal = computed(() => filtered.value.reduce((s, o) => s + (o.total ?? 0), 0))

function fmtNum(n) { return Math.round(n ?? 0).toLocaleString('zh-TW') }

function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(/\//g, '-')
}

function formatOrderId(order) {
  if (order?.pickup_number && order?.completed_at) {
    const d  = new Date(order.completed_at)
    const yy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${yy}${mm}${dd}${String(order.pickup_number).padStart(2, '0')}`
  }
  return (order?.id ?? '').slice(0, 8).toUpperCase()
}

function summarizeItems(items) {
  if (!items?.length) return '—'
  return items.map(i => `${i.name}×${i.qty}`).join('、')
}

function discountAmount(order) {
  if (!order.discount?.value) return 0
  const base = order.subtotal ?? 0
  if (order.discount.type === 'percent') return Math.round(base * order.discount.value / 100)
  return Math.min(order.discount.value, base)
}

// ── 補印 ──────────────────────────────────────────────────────────────────────
const reprintingId = ref(null)

async function handleReprint(order, invoice) {
  if (reprintingId.value) return
  reprintingId.value = order.id

  const result = await printInvoiceReceipt({
    invoiceNumber: invoice.invoice_number,
    randomCode:    invoice.random_code,
    invoiceDate:   invoice.invoice_date,
    salesAmount:   invoice.sales_amount,
    taxAmount:     invoice.tax_amount,
    totalAmount:   invoice.total_amount,
    sellerTaxId:   invoice.seller_tax_id,
    buyerTaxId:    invoice.buyer_tax_id,
    companyName:   invoice.company_name,
    items:         invoice.items,
    posBarCode:    invoice.pos_bar_code,
    qrCodeLeft:    invoice.qr_code_left,
    qrCodeRight:   invoice.qr_code_right,
    qrCodeReady:   invoice.qr_code_ready,
  })

  if (!result.success) alert('補印失敗，請確認出單機連線。')
  reprintingId.value = null
}

// ── 作廢 ──────────────────────────────────────────────────────────────────────
const voidingInvoice  = ref(null)
const voidingOrder    = ref(null)
const voidReason      = ref('')
const voidReasonOther = ref('')
const voiding         = ref(false)

function confirmVoid(order, invoice) {
  voidingOrder.value   = order
  voidingInvoice.value = invoice
  voidReason.value     = ''
  voidReasonOther.value = ''
}

import { useInvoice } from '@/composables/useInvoice.js'
const { voidInvoice } = useInvoice()

async function doVoid() {
  if (!voidReason.value || voiding.value) return
  voiding.value = true
  const reason = voidReason.value === '其他' ? voidReasonOther.value : voidReason.value

  const result = await voidInvoice(voidingInvoice.value.id, reason)
  if (result.ok) {
    const orderId = voidingInvoice.value.order_id
    if (invoiceMap.value[orderId]) invoiceMap.value[orderId].status = 'void'
  } else {
    alert(result.error)
  }
  voiding.value = false
  voidingInvoice.value = null
  voidingOrder.value = null
}
</script>

<style scoped>
.tr { padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; height: 100%; }
.tr__datebar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }
.tr__date-btns { display: flex; gap: 4px; }
.tr__date-btn { padding: 5px 14px; border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); transition: all 0.12s; }
.tr__date-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; font-weight: 500; }
.tr__date-custom { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--color-text-muted); }
.tr__date-input { padding: 4px 8px; border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-primary); background: #fff; outline: none; }
.tr__date-input:focus { border-color: #e8a038; }
.tr__type-filter { display: flex; gap: 4px; margin-left: 8px; }
.tr__type-btn { padding: 5px 12px; border-radius: var(--radius-sm); font-size: 12.5px; color: var(--color-text-secondary); background: #fff; border: 1px solid var(--color-border-btn); }
.tr__type-btn--active { background: var(--color-text-primary); color: #fff; border-color: var(--color-text-primary); font-weight: 500; }
.tr__loading { font-size: 12px; color: var(--color-text-muted); }
.tr__summary { display: flex; gap: 16px; font-size: 13px; color: var(--color-text-secondary); flex-shrink: 0; }
.tr__summary strong { color: var(--color-text-primary); }
.tr__table-wrap { flex: 1; overflow: auto; background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); }
.tr__table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 1100px; }
.tr__th { text-align: left; padding: 10px 10px; font-size: 11.5px; font-weight: 500; color: var(--color-text-muted); background: #faf5ec; border-bottom: 1px solid #ede5d0; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
.tr__th--num  { text-align: right; }
.tr__th--wide { min-width: 180px; }
.tr__row:hover { background: #faf5ec; }
.tr__td { padding: 9px 10px; border-bottom: 1px solid #f5f0e8; color: var(--color-text-primary); vertical-align: middle; white-space: nowrap; }
.tr__td--time    { font-size: 12px; color: var(--color-text-secondary); }
.tr__td--id      { font-size: 11.5px; color: var(--color-text-secondary); }
.tr__td--items   { font-size: 12px; color: var(--color-text-secondary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
.tr__td--num     { text-align: right; }
.tr__td--discount{ color: #c0392b; }
.tr__td--total   { font-weight: 600; }
.tr__td--mono    { font-family: monospace; font-size: 12px; color: var(--color-text-secondary); }
.tr__td--muted   { color: var(--color-text-muted); }
.tr__empty { text-align: center; padding: 40px; color: var(--color-text-muted); font-size: 13px; }
.tr__type-badge { display: inline-block; padding: 2px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 500; }
.tr__type-badge--takeout  { background: #fde8c0; color: #8a6020; }
.tr__type-badge--dinein   { background: #e8f3e8; color: #3a6a3a; }
.tr__type-badge--delivery { background: #d0f0e0; color: #1a6035; }
.tr__pay-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #eef4ff; color: #1a5080; font-weight: 500; }
.tr__carrier-badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #e8f0fe; color: #1a56b0; font-family: monospace; }
.tr__taxid-badge  { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #fde8c0; color: #8a6020; font-family: monospace; }
.tr__invoice-num  { font-size: 12px; color: #2a6a3a; font-family: monospace; font-weight: 600; }
.tr__void-badge  { font-size: 11px; padding: 2px 8px; border-radius: 4px; background: #f5e8e8; color: #c0392b; }
.tr__void-btn    { font-size: 11px; padding: 3px 10px; border-radius: 6px; background: #fde8e8; color: #c0392b; border: 1px solid #f5c6c6; cursor: pointer; }
.tr__reprint-btn { font-size: 11px; padding: 3px 10px; border-radius: 6px; background: #eef4ff; color: #1a5080; border: 1px solid #c6d6f5; cursor: pointer; }
.tr__reprint-btn:hover:not(:disabled) { background: #dce8fb; }
.tr__reprint-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tr__void-btn:hover { background: #fbd5d5; }
.tr__note { font-size: 11.5px; color: var(--color-text-muted); flex-shrink: 0; }

/* 作廢 Modal */
.tr__void-modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.tr__void-modal { background: #fff; border-radius: 16px; width: 360px; padding: 24px; box-shadow: 0 12px 40px rgba(0,0,0,0.2); }
.tr__void-modal h3 { font-size: 17px; font-weight: 600; color: #c0392b; margin: 0 0 16px; }
.tr__void-info { background: #faf5ec; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--color-text-primary); display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
.tr__void-reason-wrap { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
.tr__void-reason-wrap label { font-size: 13px; color: var(--color-text-secondary); }
.tr__void-required { color: #c0392b; }
.tr__void-select { padding: 10px 12px; border: 1px solid #e8dcc8; border-radius: 8px; font-size: 14px; background: #fff; }
.tr__void-input  { padding: 10px 12px; border: 1px solid #e8dcc8; border-radius: 8px; font-size: 14px; }
.tr__void-actions { display: flex; gap: 10px; }
.tr__void-cancel  { flex: 1; padding: 10px; border-radius: 10px; font-size: 13px; color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a; cursor: pointer; }
.tr__void-confirm { flex: 2; padding: 10px; border-radius: 10px; font-size: 14px; font-weight: 600; color: #fff; background: #c0392b; border: none; cursor: pointer; }
.tr__void-confirm:disabled { opacity: 0.5; cursor: not-allowed; }
.tr__void-confirm:hover:not(:disabled) { background: #a0301f; }
</style>