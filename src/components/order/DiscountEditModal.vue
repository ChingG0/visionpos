<template>
  <Teleport to="body">
    <div class="dem-backdrop" @click.self="emit('close')">
      <div class="dem-box">
        <p class="dem-title">調整折扣</p>

        <div class="dem-toggle-row">
          <button
            class="dem-toggle-btn"
            :class="{ 'dem-toggle-btn--active': draft.type === 'percent' }"
            @click="draft.type = 'percent'"
          >折扣 %</button>
          <button
            class="dem-toggle-btn"
            :class="{ 'dem-toggle-btn--active': draft.type === 'amount' }"
            @click="draft.type = 'amount'"
          >折扣金額</button>
        </div>

        <label class="dem-field-label">{{ draft.type === 'percent' ? '折扣百分比（%）' : '折扣金額（$）' }}</label>
        <input v-model.number="draft.value" class="dem-input" type="number" min="0" placeholder="0" />

        <div class="dem-preview">
          <div class="dem-preview-row"><span>小計</span><span>${{ subtotal.toFixed(0) }}</span></div>
          <div v-if="surchargeAmount > 0" class="dem-preview-row"><span>加價</span><span>+${{ surchargeAmount.toFixed(0) }}</span></div>
          <div v-if="previewDiscountAmount > 0" class="dem-preview-row dem-preview-row--disc"><span>折扣</span><span>-${{ previewDiscountAmount.toFixed(0) }}</span></div>
          <div class="dem-preview-row dem-preview-row--total"><span>結帳金額</span><span>${{ previewTotal.toFixed(0) }}</span></div>
        </div>

        <div class="dem-footer">
          <button v-if="discount" class="dem-btn-delete" @click="removeDiscount">移除折扣</button>
          <div class="dem-footer-right">
            <button class="dem-btn-cancel" @click="emit('close')">取消</button>
            <button class="dem-btn-confirm" @click="confirmSave">儲存</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, computed } from 'vue'

const props = defineProps({
  subtotal:        { type: Number, required: true },
  surchargeAmount: { type: Number, default: 0 },
  discount:        { type: Object, default: null },   // { type, value } | null
})

const emit = defineEmits(['close', 'save'])

const draft = reactive({
  type:  props.discount?.type  ?? 'percent',
  value: props.discount?.value ?? 0,
})

const base = computed(() => props.subtotal + props.surchargeAmount)

const previewDiscountAmount = computed(() => {
  if (!draft.value || draft.value <= 0) return 0
  return draft.type === 'percent'
    ? Math.round(base.value * draft.value / 100)
    : Math.min(draft.value, base.value)
})

const previewTotal = computed(() => Math.max(0, base.value - previewDiscountAmount.value))

function confirmSave() {
  if (!draft.value || draft.value <= 0) {
    emit('save', null)
  } else {
    emit('save', { type: draft.type, value: Number(draft.value) })
  }
}

function removeDiscount() {
  emit('save', null)
}
</script>

<style scoped>
.dem-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45);
  display: flex; align-items: center; justify-content: center; z-index: 10001;
}
.dem-box {
  background: #fff; border-radius: 14px; padding: 18px 20px; width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}
.dem-title { font-size: 15px; font-weight: 500; color: #1a0800; margin-bottom: 12px; }

.dem-toggle-row { display: flex; gap: 6px; }
.dem-toggle-btn {
  flex: 1; padding: 7px 0; border-radius: 8px; font-size: 12.5px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.dem-toggle-btn--active { background: #3a7a3a; border-color: #2a6a2a; color: #fff; font-weight: 500; }

.dem-field-label { display: block; font-size: 12px; color: #5a4030; margin: 10px 0 5px; }
.dem-input {
  width: 100%; padding: 8px 10px; border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13px; color: #1a0800; background: #faf5ec; outline: none;
  font-family: inherit; transition: border-color 0.15s;
}
.dem-input:focus { border-color: #e8a038; }

.dem-preview {
  margin-top: 12px; padding: 8px 10px; border-radius: 8px; background: #faf5ec;
  display: flex; flex-direction: column; gap: 4px;
}
.dem-preview-row { display: flex; justify-content: space-between; font-size: 12.5px; color: var(--color-text-secondary); }
.dem-preview-row--disc { color: #c03020; }
.dem-preview-row--total { font-size: 14px; font-weight: 600; color: #1a0800; margin-top: 2px; padding-top: 5px; border-top: 1px dashed #e0d5c0; }

.dem-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; }
.dem-footer-right { display: flex; gap: 8px; }
.dem-btn-delete { padding: 7px 14px; border-radius: 8px; font-size: 13px; color: #c03020; background: #fff0ee; border: 1px solid #f0c0b8; }
.dem-btn-delete:hover { background: #fde0dc; }
.dem-btn-cancel { padding: 7px 16px; border-radius: 8px; font-size: 13px; color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a; }
.dem-btn-cancel:hover { background: #e8dcc8; }
.dem-btn-confirm { padding: 7px 16px; border-radius: 8px; font-size: 13px; color: #fff; background: #3a7a3a; border: none; font-weight: 500; }
.dem-btn-confirm:hover { background: #2a6a2a; }
</style>
