<template>
  <div class="tm">

    <div class="tm__action-row">
      <div>
        <h2 class="tm__title">標籤管理</h2>
        <p class="tm__hint">這裡建立的標籤可套用到指定商品；點餐時點該商品的空白處，備註視窗會優先顯示。</p>
      </div>
      <button class="tm__btn tm__btn--primary" @click="openCreate">新增標籤</button>
    </div>

    <div class="tm__table-wrap">
      <table class="tm__table">
        <thead>
          <tr>
            <th>標籤</th>
            <th>套用商品</th>
            <th class="tm__th-quick">快速標籤</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="tag in tagStore.tags" :key="tag.id">
            <td>
              <span
                class="tm__pill"
                :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }"
              >{{ tag.label }}</span>
            </td>
            <td class="tm__products-cell">
              <template v-if="productNames(tag.id).length">
                <span v-for="name in productNames(tag.id)" :key="name" class="tm__product-tag">{{ name }}</span>
              </template>
              <span v-else class="tm__none">未指定（所有商品的備註視窗都找得到）</span>
            </td>
            <td class="tm__th-quick">
              <button
                class="tm__quick-badge"
                :class="{ 'tm__quick-badge--off': tag.isQuick === false }"
                :title="tag.isQuick === false ? '點擊改為顯示在點餐頁快速標籤列' : '點擊改為不顯示在點餐頁快速標籤列'"
                @click="tagStore.setQuick(tag.id, tag.isQuick === false)"
              >{{ tag.isQuick === false ? '否' : '是' }}</button>
            </td>
            <td>
              <button class="tm__edit-btn" @click="openEdit(tag)">編輯</button>
            </td>
          </tr>
          <tr v-if="tagStore.tags.length === 0">
            <td colspan="4" class="tm__empty">尚未建立標籤，點「新增標籤」開始</td>
          </tr>
        </tbody>
      </table>
    </div>

    <TagFormModal
      v-if="showModal"
      :initial-data="editingTag"
      :show-product-picker="true"
      :categories="menuStore.categories"
      :items="menuStore.items"
      :initial-product-ids="editingTag ? menuStore.productIdsWithTag(editingTag.id) : []"
      @close="showModal = false"
      @submit="handleSubmit"
      @delete="handleDelete"
    />

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TagFormModal      from '@/components/settings/TagFormModal.vue'
import { useTagStore }   from '@/stores/tagStore.js'
import { useMenuStore }  from '@/stores/menuStore.js'
import { TAG_COLOR_MAP } from '@/constants/tagColors.js'

const tagStore  = useTagStore()
const menuStore = useMenuStore()

onMounted(() => {
  tagStore.init()
  menuStore.init()
})

function tagColorOf(tag) {
  return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
}

function productNames(tagId) {
  return menuStore.items.filter(i => (i.tagIds ?? []).includes(tagId)).map(i => i.name)
}

/* ── 新增 / 編輯 ── */
const showModal  = ref(false)
const editingTag = ref(null)

function openCreate() { editingTag.value = null; showModal.value = true }
function openEdit(tag) { editingTag.value = tag; showModal.value = true }

async function handleSubmit({ label, color, productIds }) {
  let tagId
  if (editingTag.value) {
    await tagStore.updateTag(editingTag.value.id, { label, color })
    tagId = editingTag.value.id
  } else {
    const newTag = await tagStore.addTag({ label, color })
    tagId = newTag?.id
  }
  if (tagId && productIds) await menuStore.setTagOnProducts(tagId, productIds)
  showModal.value = false
}

async function handleDelete() {
  if (!editingTag.value) return
  const tagId = editingTag.value.id
  await menuStore.removeTagFromAllProducts(tagId)   // 先清掉商品上的關聯，避免留下孤兒 id
  await tagStore.deleteTag(tagId)
  showModal.value = false
}
</script>

<style scoped>
.tm { padding: 14px 18px 18px; display: flex; flex-direction: column; height: 100%; overflow: hidden; }

.tm__action-row {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px; margin-bottom: 14px; flex-shrink: 0;
}
.tm__title { font-size: 16px; font-weight: 600; color: var(--color-text-primary); }
.tm__hint  { font-size: 11.5px; color: var(--color-text-muted); margin-top: 3px; }

.tm__btn {
  padding: 7px 16px; background: #fff;
  border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm);
  font-size: 13px; color: var(--color-text-primary); white-space: nowrap;
  transition: background 0.12s;
}
.tm__btn--primary {
  background: var(--color-bg-nav-active); border-color: #c07820;
  color: var(--color-text-nav-active); font-weight: 500;
}
.tm__btn--primary:hover { background: #dc9530; }

.tm__table-wrap { flex: 1; overflow-y: auto; }

.tm__table {
  width: 100%; border-collapse: collapse;
  background: #fff; border-radius: var(--radius-md); overflow: hidden;
}
.tm__table th {
  text-align: left; font-size: 12px; color: var(--color-text-secondary);
  font-weight: 500; padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-card);
  background: #faf5ec; position: sticky; top: 0;
}
.tm__table td {
  font-size: 13px; color: var(--color-text-primary);
  padding: 10px 12px; border-bottom: 1px solid #f0e8d8; vertical-align: top;
}

.tm__pill { font-size: 12.5px; font-weight: 500; padding: 4px 14px; border-radius: 999px; white-space: nowrap; }

.tm__products-cell { display: flex; flex-wrap: wrap; gap: 4px; }
.tm__product-tag {
  font-size: 11.5px; color: #7a6850; background: #f5f0e8;
  border: 1px solid #e8dcc8; padding: 2px 9px; border-radius: 999px;
}
.tm__none { font-size: 11.5px; color: var(--color-text-muted); }

.tm__th-quick { width: 90px; }
.tm__quick-badge {
  font-size: 11.5px; font-weight: 500;
  color: #2f7a3d; background: #e1f3e1;
  border: 1px solid #c8e8c8;
  padding: 3px 14px; border-radius: 999px;
  cursor: pointer; transition: background 0.12s;
}
.tm__quick-badge:hover { background: #d0ecd0; }
.tm__quick-badge--off {
  color: #8a7050; background: #f0e8d8; border-color: #d8ccb4;
}
.tm__quick-badge--off:hover { background: #e4d8c0; }

.tm__edit-btn {
  padding: 4px 14px; background: #f0e8d8;
  border: 1px solid var(--color-border-btn); border-radius: var(--radius-sm);
  font-size: 12px; color: var(--color-text-brand);
}
.tm__edit-btn:hover { background: #e0d0b8; }

.tm__empty { text-align: center; color: var(--color-text-muted); font-size: 12.5px; padding: 40px 0; }
</style>
