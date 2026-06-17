<template>
  <Teleport to="body">
    <div class="pfm-backdrop" @click.self="emit('close')">
      <div class="pfm-box" role="dialog" aria-modal="true">

        <div class="pfm-header">
          <h2 class="pfm-title">{{ isEdit ? '編輯商品' : '新增商品' }}</h2>
          <button class="pfm-close" aria-label="關閉" @click="emit('close')">×</button>
        </div>

        <div class="pfm-body">

          <div v-if="isEdit" class="pfm-field">
            <label class="pfm-label">商品編號</label>
            <input class="pfm-input" :value="form.code" disabled />
          </div>

          <div class="pfm-field">
            <label class="pfm-label">商品名稱 <span class="pfm-required">*</span></label>
            <input v-model="form.name" class="pfm-input" type="text" placeholder="例：舒肥雞腿" maxlength="20" />
          </div>

          <div class="pfm-field">
            <label class="pfm-label">商品分類 <span class="pfm-required">*</span></label>
            <select v-model="form.categoryId" class="pfm-input">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.label }}</option>
            </select>
          </div>

          <div class="pfm-row">
            <div class="pfm-field">
              <label class="pfm-label">成本</label>
              <input v-model.number="form.cost" class="pfm-input" type="number" min="0" />
            </div>
            <div class="pfm-field">
              <label class="pfm-label">售價 <span class="pfm-required">*</span></label>
              <input v-model.number="form.price" class="pfm-input" type="number" min="0" />
            </div>
          </div>

          <div class="pfm-field">
            <label class="pfm-label">圖示</label>
            <input v-model="form.icon" class="pfm-input pfm-input--icon" type="text" placeholder="貼上 emoji，例如 🍗" maxlength="4" />
          </div>

          <p v-if="errorMsg" class="pfm-error">{{ errorMsg }}</p>

        </div>

        <div class="pfm-footer">
          <button class="pfm-btn-cancel" @click="emit('close')">取消</button>
          <button class="pfm-btn-confirm" @click="submit">儲存</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref } from 'vue'

const props = defineProps({
  categories:   { type: Array,  required: true },
  initialData:  { type: Object, default: null },   // null = 新增模式
})

const emit = defineEmits(['close', 'submit'])

const isEdit = !!props.initialData
const errorMsg = ref('')

const form = reactive({
  code:       props.initialData?.code ?? '',
  name:       props.initialData?.name ?? '',
  categoryId: props.initialData?.categoryId ?? props.categories[0]?.id ?? '',
  cost:       props.initialData?.cost ?? 0,
  price:      props.initialData?.price ?? 0,
  icon:       props.initialData?.icon ?? '🍽️',
})

function submit() {
  errorMsg.value = ''
  if (!form.name.trim())   { errorMsg.value = '請輸入商品名稱'; return }
  if (!form.categoryId)    { errorMsg.value = '請選擇商品分類'; return }
  if (!form.price || form.price <= 0) { errorMsg.value = '請輸入售價'; return }

  emit('submit', {
    name:       form.name.trim(),
    categoryId: form.categoryId,
    cost:       Number(form.cost) || 0,
    price:      Number(form.price),
    icon:       form.icon.trim() || '🍽️',
  })
}
</script>

<style scoped>
.pfm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.pfm-box {
  background: #fff;
  border-radius: 16px;
  width: 340px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.pfm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #ede5d0;
}

.pfm-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
}

.pfm-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0e8d8;
  font-size: 16px;
  color: #7a6850;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.pfm-close:hover { background: #e0d0b8; }

.pfm-body {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.pfm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.pfm-row {
  display: flex;
  gap: 10px;
}

.pfm-label {
  font-size: 12px;
  font-weight: 500;
  color: #5a4030;
}

.pfm-required { color: #c03020; }

.pfm-input {
  padding: 7px 10px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 13px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  width: 100%;
  transition: border-color 0.15s;
}

.pfm-input:focus { border-color: #e8a038; }
.pfm-input:disabled { color: #9a8868; background: #f0ebe0; }

.pfm-input--icon { font-size: 18px; text-align: center; }

.pfm-error {
  font-size: 12px;
  color: #c03020;
  background: #fff0ee;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #f0c0b8;
}

.pfm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #ede5d0;
}

.pfm-btn-cancel {
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.pfm-btn-cancel:hover { background: #e8dcc8; }

.pfm-btn-confirm {
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  background: #3a7a3a;
  border: none;
  font-weight: 500;
}

.pfm-btn-confirm:hover { background: #2a6a2a; }
</style>