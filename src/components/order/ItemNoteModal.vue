<template>
  <Teleport to="body">
    <div class="inm-backdrop" @click.self="emit('close')">
      <div class="inm-panel">

        <div class="inm-header">
          <div class="inm-header-info">
            <span class="inm-icon">{{ line.icon }}</span>
            <div>
              <p class="inm-name">{{ line.name }}</p>
              <p class="inm-qty">x{{ line.qty }}　${{ (line.price * line.qty).toFixed(0) }}</p>
            </div>
          </div>
          <button class="inm-remove-btn" @click="emit('remove')">刪除</button>
        </div>

        <div class="inm-body">

          <!-- 常用標籤（後台商品設定的） -->
          <template v-if="preferredTags.length">
            <p class="inm-section-title">常用標籤</p>
            <div class="inm-tag-grid">
              <button
                v-for="tag in preferredTags" :key="tag.id"
                class="inm-tag"
                :class="{ 'inm-tag--active': isSelected(tag.id) }"
                :style="tagStyle(tag)"
                @click="toggleTag(tag)"
              >{{ tag.label }}</button>
            </div>
          </template>

          <!-- 其他標籤 -->
          <template v-if="otherTags.length">
            <p class="inm-section-title">{{ preferredTags.length ? '其他標籤' : '標籤' }}</p>
            <div class="inm-tag-grid">
              <button
                v-for="tag in otherTags" :key="tag.id"
                class="inm-tag"
                :class="{ 'inm-tag--active': isSelected(tag.id) }"
                :style="tagStyle(tag)"
                @click="toggleTag(tag)"
              >{{ tag.label }}</button>
            </div>
          </template>

          <p v-if="!allTags.length" class="inm-empty">尚未建立標籤，可到「點餐設定」新增</p>

          <!-- 手動輸入備註 -->
          <p class="inm-section-title">手動備註</p>
          <textarea
            v-model="draftNote"
            class="inm-textarea"
            rows="3"
            placeholder="例：少冰、不要辣、分開裝…"
            maxlength="60"
          />
        </div>

        <div class="inm-footer">
          <button class="inm-btn-cancel" @click="emit('close')">取消</button>
          <button class="inm-btn-confirm" @click="save">儲存</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { TAG_COLOR_MAP } from '@/constants/tagColors.js'

const props = defineProps({
  line:         { type: Object, required: true },   // 購物車的單一品項
  allTags:      { type: Array,  default: () => [] },
  preferredIds: { type: Array,  default: () => [] },// 後台商品設定的常用標籤 id
})

const emit = defineEmits(['close', 'save', 'remove'])

const draftTags = ref((props.line.tags ?? []).map(t => ({ ...t })))
const draftNote = ref(props.line.note ?? '')

const preferredTags = computed(() => props.allTags.filter(t => props.preferredIds.includes(t.id)))
const otherTags     = computed(() => props.allTags.filter(t => !props.preferredIds.includes(t.id)))

function tagStyle(tag) {
  const c = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
  return { background: c.bg, color: c.text }
}

function isSelected(id) { return draftTags.value.some(t => t.id === id) }

function toggleTag(tag) {
  draftTags.value = isSelected(tag.id)
    ? draftTags.value.filter(t => t.id !== tag.id)
    : [...draftTags.value, { id: tag.id, label: tag.label, color: tag.color }]
}

function save() {
  emit('save', { tags: draftTags.value, note: draftNote.value.trim() })
}
</script>

<style scoped>
.inm-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: flex-end;
  z-index: 9999;
}

/* 從購物車左邊跳出來（購物車固定 260px 寬） */
.inm-panel {
  margin-right: 268px;
  width: 380px; max-height: 88vh;
  background: #fff; border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  display: flex; flex-direction: column; overflow: hidden;
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.inm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px; border-bottom: 1px solid #ede5d0; flex-shrink: 0;
}
.inm-header-info { display: flex; align-items: center; gap: 10px; }
.inm-icon { font-size: 26px; }
.inm-name { font-size: 15px; font-weight: 600; color: #1a0800; }
.inm-qty  { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
.inm-remove-btn {
  padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
  color: #c03020; background: #fff0ee; border: 1px solid #f0c0b8;
}
.inm-remove-btn:hover { background: #fde0dc; }

.inm-body { flex: 1; overflow-y: auto; padding: 14px 16px; }

.inm-section-title {
  font-size: 12px; font-weight: 600; color: #5a4030;
  margin-bottom: 8px;
}
.inm-section-title:not(:first-child) { margin-top: 16px; }

.inm-tag-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.inm-tag {
  padding: 12px 6px; border-radius: 10px;
  font-size: 13.5px; font-weight: 500; line-height: 1.3;
  border: 2px solid transparent; opacity: 0.5;
  transition: opacity 0.12s, border-color 0.12s;
}
.inm-tag--active { opacity: 1; border-color: rgba(0, 0, 0, 0.35); }

.inm-empty { font-size: 12px; color: var(--color-text-muted); padding: 6px 0; }

.inm-textarea {
  width: 100%; padding: 9px 11px;
  border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13.5px; color: #1a0800; background: #faf5ec;
  outline: none; font-family: inherit; resize: none;
  transition: border-color 0.15s;
}
.inm-textarea:focus { border-color: #e8a038; }

.inm-footer {
  display: flex; gap: 8px; padding: 12px 16px;
  border-top: 1px solid #ede5d0; flex-shrink: 0;
}
.inm-btn-cancel {
  flex: 1; padding: 11px; border-radius: 10px; font-size: 13.5px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.inm-btn-cancel:hover { background: #e8dcc8; }
.inm-btn-confirm {
  flex: 2; padding: 11px; border-radius: 10px;
  font-size: 14px; font-weight: 600; color: #fff;
  background: #3a7a3a; border: none;
}
.inm-btn-confirm:hover { background: #2a6a2a; }
</style>
