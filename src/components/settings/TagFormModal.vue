<template>
  <Teleport to="body">
    <div class="tfm-backdrop" @click.self="emit('close')">
      <div class="tfm-box" role="dialog" aria-modal="true">

        <div class="tfm-header">
          <h2 class="tfm-title">{{ isEdit ? '編輯標籤' : '新增標籤' }}</h2>
          <button class="tfm-close" aria-label="關閉" @click="emit('close')">×</button>
        </div>

        <div class="tfm-body">

          <div class="tfm-field">
            <label class="tfm-label">標籤文字 <span class="tfm-required">*</span></label>
            <input
              v-model="label"
              class="tfm-input"
              type="text"
              placeholder="例：小辣、蔥花、全素"
              maxlength="10"
              @keydown.enter="submit"
            />
          </div>

          <div class="tfm-field">
            <label class="tfm-label">顏色</label>
            <div class="tfm-colors">
              <button
                v-for="c in TAG_COLORS"
                :key="c.id"
                class="tfm-color-swatch"
                :class="{ 'tfm-color-swatch--active': color === c.id }"
                :style="{ background: c.bg, borderColor: c.border ?? c.bg }"
                @click="color = c.id"
              >
                <span v-if="color === c.id" class="tfm-color-check" :style="{ color: c.text }">✓</span>
              </button>
            </div>
          </div>

          <!-- 預覽 -->
          <div class="tfm-preview">
            <span class="tfm-preview-label">預覽：</span>
            <span
              class="tfm-preview-pill"
              :style="{ background: previewColor.bg, color: previewColor.text }"
            >{{ label || '標籤文字' }}</span>
          </div>

          <p v-if="errorMsg" class="tfm-error">{{ errorMsg }}</p>

        </div>

        <div class="tfm-footer">
          <button v-if="isEdit" class="tfm-btn-delete" @click="emit('delete')">刪除</button>
          <div class="tfm-footer-right">
            <button class="tfm-btn-cancel" @click="emit('close')">取消</button>
            <button class="tfm-btn-confirm" @click="submit">儲存</button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { TAG_COLORS, TAG_COLOR_MAP } from '@/constants/tagColors.js'

const props = defineProps({
  initialData: { type: Object, default: null },   // null = 新增模式
})

const emit = defineEmits(['close', 'submit', 'delete'])

const isEdit = !!props.initialData
const errorMsg = ref('')

const label = ref(props.initialData?.label ?? '')
const color = ref(props.initialData?.color ?? TAG_COLORS[0].id)

const previewColor = computed(() => TAG_COLOR_MAP[color.value] ?? TAG_COLOR_MAP.gray)

function submit() {
  errorMsg.value = ''
  if (!label.value.trim()) { errorMsg.value = '請輸入標籤文字'; return }
  emit('submit', { label: label.value.trim(), color: color.value })
}
</script>

<style scoped>
.tfm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.tfm-box {
  background: #fff;
  border-radius: 16px;
  width: 320px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.tfm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #ede5d0;
}

.tfm-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
}

.tfm-close {
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

.tfm-close:hover { background: #e0d0b8; }

.tfm-body {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tfm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tfm-label {
  font-size: 12px;
  font-weight: 500;
  color: #5a4030;
}

.tfm-required { color: #c03020; }

.tfm-input {
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

.tfm-input:focus { border-color: #e8a038; }

.tfm-colors {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.tfm-color-swatch {
  height: 36px;
  border-radius: 8px;
  border: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s;
}

.tfm-color-swatch--active {
  border-color: #8a6850;
  transform: scale(1.06);
}

.tfm-color-check {
  font-size: 14px;
  font-weight: 700;
}

.tfm-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 4px;
}

.tfm-preview-label {
  font-size: 12px;
  color: #9a8868;
}

.tfm-preview-pill {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 12px;
  border-radius: 999px;
}

.tfm-error {
  font-size: 12px;
  color: #c03020;
  background: #fff0ee;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #f0c0b8;
}

.tfm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #ede5d0;
}

.tfm-footer-right {
  display: flex;
  gap: 8px;
}

.tfm-btn-delete {
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: #c03020;
  background: #fff0ee;
  border: 1px solid #f0c0b8;
}

.tfm-btn-delete:hover { background: #fde0dc; }

.tfm-btn-cancel {
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.tfm-btn-cancel:hover { background: #e8dcc8; }

.tfm-btn-confirm {
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  background: #3a7a3a;
  border: none;
  font-weight: 500;
}

.tfm-btn-confirm:hover { background: #2a6a2a; }
</style>