<template>
  <div class="oqa">

    <!-- 快速標籤 -->
    <div class="oqa__tags">
      <button
        v-for="tag in tags"
        :key="tag.id"
        class="oqa__tag"
        :class="{ 'oqa__tag--active': selectedTagIds.includes(tag.id) }"
        :style="tagStyle(tag)"
        @click="toggleTag(tag.id)"
      >{{ tag.label }}</button>
      <p v-if="tags.length === 0" class="oqa__tags-empty">尚未建立標籤，可到「點餐設定」新增</p>
    </div>

    <!-- 備註 / 加價 / 折扣 -->
    <div class="oqa__actions">
      <button class="oqa__action-btn oqa__action-btn--note" @click="openNote">
        備註{{ note ? '（已填寫）' : '' }}
      </button>
      <button class="oqa__action-btn oqa__action-btn--surcharge" @click="openSurcharge">
        加價{{ surcharge?.amount ? `（+$${surcharge.amount}）` : '' }}
      </button>
      <button class="oqa__action-btn oqa__action-btn--discount" @click="openDiscount">
        折扣{{ discount?.value ? `（${discount.type === 'percent' ? discount.value + '%' : '$' + discount.value}）` : '' }}
      </button>
    </div>

    <!-- 備註 Modal -->
    <Teleport to="body">
      <div v-if="modal === 'note'" class="oqa-backdrop" @click.self="closeModal">
        <div class="oqa-box">
          <p class="oqa-box-title">訂單備註</p>
          <textarea
            v-model="noteDraft"
            class="oqa-textarea"
            rows="3"
            placeholder="例：客人趕時間、不要香菜…"
            maxlength="60"
          />
          <div class="oqa-box-footer">
            <button class="oqa-btn-cancel" @click="closeModal">取消</button>
            <button class="oqa-btn-confirm" @click="confirmNote">儲存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 加價 Modal -->
    <Teleport to="body">
      <div v-if="modal === 'surcharge'" class="oqa-backdrop" @click.self="closeModal">
        <div class="oqa-box">
          <p class="oqa-box-title">加價</p>
          <label class="oqa-field-label">金額</label>
          <input v-model.number="surchargeDraft.amount" class="oqa-input" type="number" min="0" placeholder="0" />
          <label class="oqa-field-label">原因（選填）</label>
          <input v-model="surchargeDraft.reason" class="oqa-input" type="text" placeholder="例：加肉、換大碗" maxlength="20" />
          <div class="oqa-box-footer">
            <button v-if="surcharge" class="oqa-btn-delete" @click="removeSurcharge">移除</button>
            <div class="oqa-box-footer-right">
              <button class="oqa-btn-cancel" @click="closeModal">取消</button>
              <button class="oqa-btn-confirm" @click="confirmSurcharge">儲存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 折扣 Modal -->
    <Teleport to="body">
      <div v-if="modal === 'discount'" class="oqa-backdrop" @click.self="closeModal">
        <div class="oqa-box">
          <p class="oqa-box-title">折扣</p>
          <div class="oqa-toggle-row">
            <button
              class="oqa-toggle-btn"
              :class="{ 'oqa-toggle-btn--active': discountDraft.type === 'percent' }"
              @click="discountDraft.type = 'percent'"
            >折扣 %</button>
            <button
              class="oqa-toggle-btn"
              :class="{ 'oqa-toggle-btn--active': discountDraft.type === 'amount' }"
              @click="discountDraft.type = 'amount'"
            >折扣金額</button>
          </div>
          <label class="oqa-field-label">{{ discountDraft.type === 'percent' ? '折扣百分比（%）' : '折扣金額（$）' }}</label>
          <input v-model.number="discountDraft.value" class="oqa-input" type="number" min="0" placeholder="0" />
          <div class="oqa-box-footer">
            <button v-if="discount" class="oqa-btn-delete" @click="removeDiscount">移除</button>
            <div class="oqa-box-footer-right">
              <button class="oqa-btn-cancel" @click="closeModal">取消</button>
              <button class="oqa-btn-confirm" @click="confirmDiscount">儲存</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { TAG_COLOR_MAP } from '@/constants/tagColors.js'

const props = defineProps({
  tags:          { type: Array,  default: () => [] },
  selectedTagIds:{ type: Array,  default: () => [] },
  note:          { type: String, default: '' },
  surcharge:     { type: Object, default: null },   // { amount, reason } | null
  discount:      { type: Object, default: null },   // { type, value } | null
})

const emit = defineEmits([
  'update:selectedTagIds',
  'update:note',
  'update:surcharge',
  'update:discount',
])

function tagStyle(tag) {
  const c = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
  return { background: c.bg, color: c.text, borderColor: c.border ?? c.bg }
}

function toggleTag(id) {
  const next = props.selectedTagIds.includes(id)
    ? props.selectedTagIds.filter(t => t !== id)
    : [...props.selectedTagIds, id]
  emit('update:selectedTagIds', next)
}

/* ── Modal 狀態：'note' | 'surcharge' | 'discount' | null ── */
const modal = ref(null)
function closeModal() { modal.value = null }

/* ── 備註 ── */
const noteDraft = ref('')
function openNote() { noteDraft.value = props.note; modal.value = 'note' }
function confirmNote() { emit('update:note', noteDraft.value.trim()); closeModal() }

/* ── 加價 ── */
const surchargeDraft = reactive({ amount: 0, reason: '' })
function openSurcharge() {
  surchargeDraft.amount = props.surcharge?.amount ?? 0
  surchargeDraft.reason = props.surcharge?.reason ?? ''
  modal.value = 'surcharge'
}
function confirmSurcharge() {
  if (!surchargeDraft.amount || surchargeDraft.amount <= 0) {
    emit('update:surcharge', null)
  } else {
    emit('update:surcharge', { amount: Number(surchargeDraft.amount), reason: surchargeDraft.reason.trim() })
  }
  closeModal()
}
function removeSurcharge() { emit('update:surcharge', null); closeModal() }

/* ── 折扣 ── */
const discountDraft = reactive({ type: 'percent', value: 0 })
function openDiscount() {
  discountDraft.type  = props.discount?.type ?? 'percent'
  discountDraft.value = props.discount?.value ?? 0
  modal.value = 'discount'
}
function confirmDiscount() {
  if (!discountDraft.value || discountDraft.value <= 0) {
    emit('update:discount', null)
  } else {
    emit('update:discount', { type: discountDraft.type, value: Number(discountDraft.value) })
  }
  closeModal()
}
function removeDiscount() { emit('update:discount', null); closeModal() }
</script>

<style scoped>
.oqa {
  flex-shrink: 0;
  padding: 10px 0 0;
  border-top: 1px solid #ede5d0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── 快速標籤 ── */
.oqa__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.oqa__tag {
  font-size: 12.5px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1.5px solid transparent;
  opacity: 0.55;
  transition: opacity 0.12s, transform 0.1s;
}

.oqa__tag--active {
  opacity: 1;
  transform: scale(1.04);
  box-shadow: 0 0 0 1.5px rgba(0,0,0,0.12) inset;
}

.oqa__tags-empty {
  font-size: 11.5px;
  color: var(--color-text-muted);
}

/* ── 動作按鈕 ── */
.oqa__actions {
  display: flex;
  gap: 8px;
}

.oqa__action-btn {
  flex: 1;
  padding: 9px 0;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: filter 0.12s;
}

.oqa__action-btn:hover { filter: brightness(0.97); }

.oqa__action-btn--note       { background: #fde3cc; color: #8a4a1a; }
.oqa__action-btn--surcharge  { background: #fdf0c2; color: #8a6a10; }
.oqa__action-btn--discount   { background: #fdf0c2; color: #8a6a10; }

/* ── Modal ── */
.oqa-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.oqa-box {
  background: #fff;
  border-radius: 14px;
  padding: 18px 20px;
  width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.oqa-box-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
  margin-bottom: 12px;
}

.oqa-field-label {
  display: block;
  font-size: 12px;
  color: #5a4030;
  margin: 10px 0 5px;
}

.oqa-input,
.oqa-textarea {
  width: 100%;
  padding: 8px 10px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 13px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
  resize: none;
}

.oqa-input:focus,
.oqa-textarea:focus { border-color: #e8a038; }

.oqa-toggle-row {
  display: flex;
  gap: 6px;
}

.oqa-toggle-btn {
  flex: 1;
  padding: 7px 0;
  border-radius: 8px;
  font-size: 12.5px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.oqa-toggle-btn--active {
  background: #3a7a3a;
  border-color: #2a6a2a;
  color: #fff;
  font-weight: 500;
}

.oqa-box-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.oqa-box-footer-right {
  display: flex;
  gap: 8px;
}

.oqa-btn-delete {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: #c03020;
  background: #fff0ee;
  border: 1px solid #f0c0b8;
}

.oqa-btn-delete:hover { background: #fde0dc; }

.oqa-btn-cancel {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.oqa-btn-cancel:hover { background: #e8dcc8; }

.oqa-btn-confirm {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  background: #3a7a3a;
  border: none;
  font-weight: 500;
}

.oqa-btn-confirm:hover { background: #2a6a2a; }
</style>