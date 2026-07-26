<template>
  <Teleport to="body">
    <div class="tfm-backdrop" @click.self="emit('close')">
      <div class="tfm-box" :class="{ 'tfm-box--wide': showProductPicker }" role="dialog" aria-modal="true">

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

          <!-- 套用商品：點餐時點該商品的空白處，備註視窗會把這個標籤排在「常用標籤」 -->
          <div v-if="showProductPicker" class="tfm-field">
            <label class="tfm-label">
              套用到商品
              <span class="tfm-label-hint">點餐時這些商品的備註視窗會優先顯示這個標籤</span>
            </label>

            <div class="tfm-products">
              <div v-for="cat in categoriesWithItems" :key="cat.id" class="tfm-cat-block">
                <div class="tfm-cat-head">
                  <span class="tfm-cat-label">{{ cat.label }}</span>
                  <button type="button" class="tfm-cat-all" @click="toggleCategory(cat)">
                    {{ isCategoryAllSelected(cat) ? '取消全選' : '全選' }}
                  </button>
                </div>
                <div class="tfm-product-grid">
                  <label
                    v-for="item in cat.items" :key="item.id"
                    class="tfm-product-chip"
                    :class="{ 'tfm-product-chip--active': selectedProductIds.includes(item.id) }"
                  >
                    <input type="checkbox" :value="item.id" v-model="selectedProductIds" />
                    {{ item.name }}
                  </label>
                </div>
              </div>
              <p v-if="categoriesWithItems.length === 0" class="tfm-products-empty">尚未建立商品</p>
            </div>

            <p class="tfm-selected-count">已選 {{ selectedProductIds.length }} 項商品</p>
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
  // 套用商品選擇器（標籤管理頁才會傳，點餐設定不用）
  showProductPicker:  { type: Boolean, default: false },
  categories:         { type: Array,   default: () => [] },
  items:              { type: Array,   default: () => [] },
  initialProductIds:  { type: Array,   default: () => [] },
})

const emit = defineEmits(['close', 'submit', 'delete'])

const isEdit = !!props.initialData
const errorMsg = ref('')

const label = ref(props.initialData?.label ?? '')
const color = ref(props.initialData?.color ?? TAG_COLORS[0].id)

const previewColor = computed(() => TAG_COLOR_MAP[color.value] ?? TAG_COLOR_MAP.gray)

/* ── 套用商品 ── */
const selectedProductIds = ref([...props.initialProductIds])

const categoriesWithItems = computed(() =>
  props.categories
    .map(cat => ({
      ...cat,
      items: props.items
        .filter(i => i.categoryId === cat.id)
        .sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
    }))
    .filter(cat => cat.items.length > 0)
)

function isCategoryAllSelected(cat) {
  return cat.items.every(i => selectedProductIds.value.includes(i.id))
}

function toggleCategory(cat) {
  const ids = cat.items.map(i => i.id)
  selectedProductIds.value = isCategoryAllSelected(cat)
    ? selectedProductIds.value.filter(id => !ids.includes(id))
    : [...new Set([...selectedProductIds.value, ...ids])]
}

function submit() {
  errorMsg.value = ''
  if (!label.value.trim()) { errorMsg.value = '請輸入標籤文字'; return }
  emit('submit', {
    label: label.value.trim(),
    color: color.value,
    productIds: props.showProductPicker ? selectedProductIds.value : null,
  })
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

.tfm-box--wide { width: 460px; }

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

/* ── 套用商品 ── */
.tfm-label-hint { font-weight: 400; font-size: 10.5px; color: #9a8868; margin-left: 6px; }

.tfm-products {
  max-height: 220px; overflow-y: auto;
  border: 1.5px solid #e8dcc8; border-radius: 10px;
  padding: 10px 12px; background: #fdfaf5;
  display: flex; flex-direction: column; gap: 12px;
}

.tfm-cat-block { display: flex; flex-direction: column; gap: 6px; }
.tfm-cat-head  { display: flex; align-items: center; justify-content: space-between; }
.tfm-cat-label { font-size: 11.5px; font-weight: 600; color: #5a4030; }
.tfm-cat-all   { font-size: 11px; color: #c08020; background: none; border: none; padding: 0; }
.tfm-cat-all:hover { text-decoration: underline; }

.tfm-product-grid { display: flex; flex-wrap: wrap; gap: 6px; }
.tfm-product-chip {
  display: flex; align-items: center; gap: 5px;
  padding: 5px 10px; border-radius: 999px;
  font-size: 12px; color: #7a6850;
  background: #f0e8d8; border: 1px solid #c8b89a;
  cursor: pointer; transition: background 0.12s, color 0.12s, border-color 0.12s;
}
.tfm-product-chip input { margin: 0; }
.tfm-product-chip:hover { background: #e8dcc8; }
.tfm-product-chip--active {
  background: #fde8c0; color: #8a6020; border-color: #e8c888; font-weight: 500;
}

.tfm-products-empty { font-size: 11.5px; color: #9a8868; }
.tfm-selected-count { font-size: 11px; color: #9a8868; margin-top: 2px; }

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