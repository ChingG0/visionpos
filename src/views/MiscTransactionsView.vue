<template>
  <div class="mt">
    <AppSidebar />

    <div class="mt__main">
      <AppTopbar :show-floor-tabs="false" title="" />

      <div class="mt__page-header">
        <div>
          <h2 class="mt__title">雜項收支</h2>
          <p class="mt__hint">記錄訂單以外的現金進出，交班/關帳時會從實收現金加減。</p>
        </div>
        <div class="mt__summary">
          <div class="mt__summary-item">
            <span class="mt__summary-label">本期收入</span>
            <span class="mt__summary-value mt__summary-value--plus">+${{ fmt(totalIncome) }}</span>
          </div>
          <div class="mt__summary-item">
            <span class="mt__summary-label">本期支出</span>
            <span class="mt__summary-value mt__summary-value--minus">−${{ fmt(totalExpense) }}</span>
          </div>
        </div>
      </div>

      <div class="mt__body">

        <!-- 新增 -->
        <section class="mt__form-card">
          <p class="mt__card-title">新增一筆</p>

          <div class="mt__kind-row">
            <button
              class="mt__kind-btn"
              :class="{ 'mt__kind-btn--active-expense': form.kind === 'expense' }"
              @click="form.kind = 'expense'"
            >支出</button>
            <button
              class="mt__kind-btn"
              :class="{ 'mt__kind-btn--active-income': form.kind === 'income' }"
              @click="form.kind = 'income'"
            >收入</button>
          </div>

          <label class="mt__label">金額</label>
          <input v-model.number="form.amount" class="mt__input" type="number" min="1" placeholder="0" @keyup.enter="submit" />

          <label class="mt__label">說明</label>
          <input v-model="form.note" class="mt__input" type="text" maxlength="30" placeholder="例：買醬油、找零補現金" @keyup.enter="submit" />

          <p v-if="errorMsg" class="mt__error">{{ errorMsg }}</p>

          <button class="mt__submit" :disabled="saving" @click="submit">
            {{ saving ? '儲存中...' : '新增' }}
          </button>
        </section>

        <!-- 列表 -->
        <section class="mt__list-card">
          <p class="mt__card-title">最近紀錄</p>

          <p v-if="miscStore.loading" class="mt__empty">載入中...</p>
          <p v-else-if="miscStore.items.length === 0" class="mt__empty">尚無紀錄</p>

          <div v-else class="mt__list">
            <div v-for="item in miscStore.items" :key="item.id" class="mt__item">
              <div class="mt__item-main">
                <span class="mt__item-note">{{ item.note || (item.kind === 'income' ? '收入' : '支出') }}</span>
                <span class="mt__item-meta">{{ formatTime(item.createdAt) }}　{{ item.staffName }}</span>
              </div>
              <span class="mt__item-amount" :class="item.kind === 'income' ? 'mt__amount--plus' : 'mt__amount--minus'">
                {{ item.kind === 'income' ? '+' : '−' }}${{ fmt(item.amount) }}
              </span>
              <button class="mt__item-del" title="刪除" @click="confirmDelete(item)">×</button>
            </div>
          </div>
        </section>

      </div>
    </div>

    <!-- 刪除確認 -->
    <Teleport to="body">
      <div v-if="deletingItem" class="mt-confirm-backdrop" @click.self="deletingItem = null">
        <div class="mt-confirm-box">
          <p class="mt-confirm-title">刪除這筆紀錄？</p>
          <p class="mt-confirm-detail">
            {{ deletingItem.note || (deletingItem.kind === 'income' ? '收入' : '支出') }}
            　{{ deletingItem.kind === 'income' ? '+' : '−' }}${{ fmt(deletingItem.amount) }}
          </p>
          <p class="mt-confirm-hint">刪除後交班/關帳的實收現金會跟著重新計算。</p>
          <div class="mt-confirm-actions">
            <button class="mt-confirm-cancel" @click="deletingItem = null">取消</button>
            <button class="mt-confirm-ok" @click="doDelete">確認刪除</button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import AppSidebar    from '@/components/layout/AppSidebar.vue'
import AppTopbar     from '@/components/layout/AppTopbar.vue'
import { useMiscStore }  from '@/stores/miscStore.js'
import { useShiftStore } from '@/stores/shiftStore.js'

const miscStore  = useMiscStore()
const shiftStore = useShiftStore()

const form = reactive({ kind: 'expense', amount: null, note: '' })
const saving   = ref(false)
const errorMsg = ref('')

/* 只顯示「這個關帳期間」的紀錄，跟交班畫面看到的數字一致 */
onMounted(async () => {
  const periodStart = await shiftStore.getPeriodStart()
  await miscStore.fetchRange(periodStart, new Date().toISOString())
})

const totalIncome  = computed(() =>
  miscStore.items.filter(i => i.kind === 'income').reduce((s, i) => s + i.amount, 0)
)
const totalExpense = computed(() =>
  miscStore.items.filter(i => i.kind === 'expense').reduce((s, i) => s + i.amount, 0)
)

async function submit() {
  errorMsg.value = ''
  if (!form.amount || form.amount <= 0) { errorMsg.value = '請輸入大於 0 的金額'; return }
  saving.value = true
  const row = await miscStore.addTransaction({
    kind: form.kind, amount: Number(form.amount), note: form.note.trim(),
  })
  saving.value = false
  if (!row) { errorMsg.value = '儲存失敗，請稍後再試'; return }
  form.amount = null
  form.note   = ''
}

const deletingItem = ref(null)
function confirmDelete(item) { deletingItem.value = item }

async function doDelete() {
  if (!deletingItem.value) return
  await miscStore.deleteTransaction(deletingItem.value.id)
  deletingItem.value = null
}

function fmt(n) { return Math.round(Number(n) || 0).toLocaleString('zh-TW') }

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ` +
         `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<style scoped>
.mt { width: 100%; height: 100%; display: flex; overflow: hidden; }
.mt__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.mt__page-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; padding: 12px 20px 8px; flex-shrink: 0;
}
.mt__title { font-size: 20px; font-weight: 600; color: var(--color-text-primary); }
.mt__hint  { font-size: 11.5px; color: var(--color-text-muted); margin-top: 3px; }

.mt__summary { display: flex; gap: 10px; }
.mt__summary-item {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 8px 16px; text-align: right;
}
.mt__summary-label { display: block; font-size: 11px; color: var(--color-text-muted); }
.mt__summary-value { font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; }
.mt__summary-value--plus  { color: #2f7a3d; }
.mt__summary-value--minus { color: #c0392b; }

.mt__body {
  flex: 1; overflow-y: auto; padding: 8px 20px 20px;
  background: var(--color-bg-map);
  display: grid; grid-template-columns: 300px 1fr; gap: 16px; align-items: start;
}

.mt__form-card, .mt__list-card {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 14px 16px;
}
.mt__card-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 12px; }

.mt__kind-row { display: flex; gap: 8px; margin-bottom: 12px; }
.mt__kind-btn {
  flex: 1; padding: 9px 0; border-radius: 8px;
  font-size: 13px; color: #7a6850;
  background: #f0e8d8; border: 1.5px solid #c8b89a;
  transition: all 0.12s;
}
.mt__kind-btn--active-expense { background: #fff0ee; border-color: #f0c0b8; color: #c0392b; font-weight: 600; }
.mt__kind-btn--active-income  { background: #e8f3e8; border-color: #c8e8c8; color: #2f7a3d; font-weight: 600; }

.mt__label { display: block; font-size: 12px; color: #5a4030; margin: 10px 0 4px; }
.mt__input {
  width: 100%; padding: 8px 10px;
  border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13.5px; color: #1a0800; background: #faf5ec;
  outline: none; font-family: inherit;
}
.mt__input:focus { border-color: #e8a038; }

.mt__error {
  font-size: 12px; color: #c03020; background: #fff0ee;
  border: 1px solid #f0c0b8; border-radius: 8px;
  padding: 6px 10px; margin-top: 10px;
}

.mt__submit {
  width: 100%; margin-top: 14px; padding: 11px;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  color: #fff; background: #3a7a3a; border: none;
}
.mt__submit:hover:not(:disabled) { background: #2a6a2a; }
.mt__submit:disabled { opacity: 0.6; }

.mt__empty { text-align: center; color: var(--color-text-muted); font-size: 12.5px; padding: 30px 0; }

.mt__list { display: flex; flex-direction: column; }
.mt__item {
  display: grid; grid-template-columns: 1fr auto 24px;
  gap: 10px; align-items: center;
  padding: 9px 0; border-bottom: 1px solid #f5f0e8;
}
.mt__item-note { font-size: 13.5px; color: var(--color-text-primary); }
.mt__item-meta { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }
.mt__item-amount { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.mt__amount--plus  { color: #2f7a3d; }
.mt__amount--minus { color: #c0392b; }
.mt__item-del {
  width: 22px; height: 22px; border-radius: 50%;
  background: #f0e0e0; color: #c03020; font-size: 13px;
  display: flex; align-items: center; justify-content: center;
}
.mt__item-del:hover { background: #f0c0b8; }

/* 刪除確認 */
.mt-confirm-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.mt-confirm-box {
  background: #fff; border-radius: 16px; width: 320px; padding: 20px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}
.mt-confirm-title  { font-size: 15px; font-weight: 600; color: #c0392b; margin-bottom: 10px; }
.mt-confirm-detail { font-size: 13px; color: var(--color-text-primary); background: #faf5ec; border-radius: 8px; padding: 8px 10px; }
.mt-confirm-hint   { font-size: 11.5px; color: var(--color-text-muted); margin: 10px 0 12px; }
.mt-confirm-actions { display: flex; gap: 8px; }
.mt-confirm-cancel {
  flex: 1; padding: 10px; border-radius: 10px; font-size: 13px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.mt-confirm-ok {
  flex: 2; padding: 10px; border-radius: 10px;
  font-size: 14px; font-weight: 600; color: #fff;
  background: #c0392b; border: none;
}
.mt-confirm-ok:hover { background: #a93226; }
</style>
