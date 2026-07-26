<template>
  <Teleport to="body">
    <div class="sm-backdrop" @click.self="emit('close')">
      <div class="sm-box">

        <div class="sm-header">
          <button class="sm-cancel" @click="emit('close')">取消</button>
          <div class="sm-title-wrap">
            <p class="sm-title">{{ isCloseout ? '關帳' : '交班' }}</p>
            <p v-if="summary" class="sm-period">{{ periodLabel }}</p>
          </div>
          <button class="sm-confirm" :disabled="!summary || saving" @click="handleConfirm">
            {{ saving ? '處理中...' : (isCloseout ? '確認關帳' : '確認交班') }}
          </button>
        </div>

        <div v-if="loading" class="sm-loading">結算中...</div>

        <div v-else-if="!summary" class="sm-loading">結算失敗，請關閉後再試一次</div>

        <div v-else class="sm-body">

          <div class="sm-group">
            <div class="sm-row">
              <div>
                <span class="sm-label">訂單數</span>
                <span class="sm-sub">上次關帳之後完成的訂單</span>
              </div>
              <span class="sm-value">{{ summary.orderCount }}</span>
            </div>
            <div class="sm-row">
              <span class="sm-label">營業額</span>
              <span class="sm-value sm-value--strong">${{ fmt(summary.totalRevenue) }}</span>
            </div>
            <div class="sm-row">
              <span class="sm-label">平均訂單金額</span>
              <span class="sm-value">${{ fmt(avgOrder) }}</span>
            </div>
          </div>

          <!-- 稍後付款：已出餐但錢還沒收，不算進上面的營業額 -->
          <div v-if="summary.unpaidCount > 0" class="sm-group sm-group--unpaid">
            <div class="sm-row">
              <div>
                <span class="sm-label">未收款（稍後付款）</span>
                <span class="sm-sub">{{ summary.unpaidCount }} 筆．未計入營業額，收款後才認列</span>
              </div>
              <span class="sm-value sm-value--warn">${{ fmt(summary.unpaidAmount) }}</span>
            </div>
          </div>

          <div class="sm-group">
            <p class="sm-group-title">付款方式</p>
            <div v-for="(amount, method) in summary.breakdown" :key="method" class="sm-row">
              <span class="sm-label">{{ method }}</span>
              <span class="sm-value">${{ fmt(amount) }}</span>
            </div>
            <p v-if="Object.keys(summary.breakdown).length === 0" class="sm-empty">此期間沒有訂單</p>
          </div>

          <div class="sm-group sm-group--cash">
            <p class="sm-group-title">現金結算</p>
            <div class="sm-row">
              <span class="sm-label">現金訂單</span>
              <span class="sm-value">${{ fmt(summary.cashOrders) }}</span>
            </div>
            <div class="sm-row">
              <span class="sm-label">雜項收入</span>
              <span class="sm-value sm-value--plus">+${{ fmt(summary.miscIncome) }}</span>
            </div>
            <div class="sm-row">
              <span class="sm-label">雜項支出</span>
              <span class="sm-value sm-value--minus">−${{ fmt(summary.miscExpense) }}</span>
            </div>
            <div class="sm-row sm-row--total">
              <span class="sm-label">實收現金</span>
              <span class="sm-value sm-value--strong">${{ fmt(summary.cashActual) }}</span>
            </div>
          </div>

          <div v-if="summary.miscList?.length" class="sm-group">
            <p class="sm-group-title">雜項明細</p>
            <div v-for="m in summary.miscList" :key="m.id" class="sm-misc-row">
              <span class="sm-misc-note">{{ m.note || (m.kind === 'income' ? '收入' : '支出') }}</span>
              <span class="sm-misc-staff">{{ m.staffName }}</span>
              <span :class="m.kind === 'income' ? 'sm-value--plus' : 'sm-value--minus'">
                {{ m.kind === 'income' ? '+' : '−' }}${{ fmt(m.amount) }}
              </span>
            </div>
          </div>

          <div class="sm-group">
            <p class="sm-group-title">備註（選填）</p>
            <textarea v-model="note" class="sm-note" rows="2" maxlength="100" placeholder="例：現金短少 20 元、交接給小美" />
          </div>

          <p class="sm-hint">
            {{ isCloseout
              ? '確認關帳後會登出，並結束這個累計期間。下次登入時營業額從 0 重新累計。'
              : '確認交班後會登出，但累計期間不會結束——下一位登入時看到的仍是同一段累計，要結算整天請用「關帳」。' }}
          </p>

        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useShiftStore } from '@/stores/shiftStore.js'

const props = defineProps({
  kind: { type: String, required: true },   // 'shift' | 'closeout'
})

const emit = defineEmits(['close', 'done'])

const shiftStore = useShiftStore()

const summary = ref(null)
const loading = ref(true)
const saving  = ref(false)
const note    = ref('')

const isCloseout = computed(() => props.kind === 'closeout')

const avgOrder = computed(() =>
  summary.value?.orderCount ? summary.value.totalRevenue / summary.value.orderCount : 0
)

const periodLabel = computed(() => {
  if (!summary.value) return ''
  const fmtTime = (iso) => {
    if (!iso) return '開始'
    const d = new Date(iso)
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ` +
           `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${fmtTime(summary.value.periodStart)} － ${fmtTime(summary.value.periodEnd)}`
})

onMounted(async () => {
  summary.value = await shiftStore.calculateSummary()
  loading.value = false
})

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('zh-TW') }

async function handleConfirm() {
  if (!summary.value || saving.value) return
  saving.value = true
  const ok = await shiftStore.saveRecord(props.kind, summary.value, note.value.trim())
  saving.value = false
  if (!ok) { alert('紀錄儲存失敗，請稍後再試。'); return }
  emit('done')
}
</script>

<style scoped>
.sm-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 10000;
}
.sm-box {
  background: #fff; border-radius: 16px;
  width: 460px; max-height: 90vh;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.sm-header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 10px; padding: 12px 16px;
  border-bottom: 1px solid #ede5d0; flex-shrink: 0;
}
.sm-title-wrap { text-align: center; flex: 1; }
.sm-title  { font-size: 15px; font-weight: 600; color: #1a0800; }
.sm-period { font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.sm-cancel {
  font-size: 13px; color: #7a6850; background: #f0e8d8;
  border: 1px solid #c8b89a; padding: 6px 14px; border-radius: 8px; white-space: nowrap;
}
.sm-cancel:hover { background: #e8dcc8; }
.sm-confirm {
  font-size: 13px; font-weight: 600; color: #fff; background: #3a7a3a;
  border: none; padding: 6px 14px; border-radius: 8px; white-space: nowrap;
}
.sm-confirm:hover:not(:disabled) { background: #2a6a2a; }
.sm-confirm:disabled { opacity: 0.5; }

.sm-loading { padding: 50px 0; text-align: center; color: var(--color-text-muted); font-size: 13px; }

.sm-body { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }

.sm-group {
  background: #faf5ec; border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 7px;
}
.sm-group--cash   { background: #f0f5ee; }
.sm-group--unpaid { background: #fff8ee; border: 1px solid #e8d090; }
.sm-value--warn   { color: #c07818; font-weight: 700; }
.sm-group-title { font-size: 11.5px; font-weight: 600; color: #5a4030; }

.sm-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.sm-row--total { padding-top: 7px; border-top: 1px dashed #d8d0c0; }
.sm-label { font-size: 13px; color: var(--color-text-primary); }
.sm-sub   { display: block; font-size: 10.5px; color: var(--color-text-muted); margin-top: 1px; }
.sm-value { font-size: 14px; color: var(--color-text-primary); font-variant-numeric: tabular-nums; }
.sm-value--strong { font-size: 17px; font-weight: 700; }
.sm-value--plus   { color: #2f7a3d; }
.sm-value--minus  { color: #c0392b; }
.sm-empty { font-size: 12px; color: var(--color-text-muted); }

.sm-misc-row {
  display: grid; grid-template-columns: 1fr auto auto;
  gap: 8px; align-items: center; font-size: 12.5px;
}
.sm-misc-note  { color: var(--color-text-primary); }
.sm-misc-staff { color: var(--color-text-muted); font-size: 11px; }

.sm-note {
  width: 100%; padding: 7px 9px;
  border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13px; background: #fff; outline: none;
  font-family: inherit; resize: none;
}
.sm-note:focus { border-color: #e8a038; }

.sm-hint {
  font-size: 11.5px; color: #8a6020; background: #fff8ee;
  border: 1px solid #e8d090; border-radius: 8px;
  padding: 8px 10px; line-height: 1.6;
}
</style>
