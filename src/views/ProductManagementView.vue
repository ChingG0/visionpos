<template>
  <div class="pm">
    <SettingsSidebar />

    <div class="pm__main">
      <AppTopbar :show-floor-tabs="false" title="" />

      <!-- Action row -->
      <div class="pm__action-row">
        <div class="pm__action-left">
          <button class="pm__btn pm__btn--primary" @click="openCreate">新增商品</button>
          <button
            class="pm__btn"
            :disabled="selectedIds.length === 0"
            @click="handleDuplicate"
          >複製商品</button>
        </div>
        <button class="pm__btn" @click="exportCsv">匯出商品</button>
      </div>

      <!-- Table -->
      <div class="pm__table-wrap">
        <table class="pm__table">
          <thead>
            <tr>
              <th class="pm__th-checkbox">
                <input type="checkbox" :checked="allChecked" @change="toggleAll($event.target.checked)" />
              </th>
              <th>商品編號</th>
              <th>商品名稱</th>
              <th>成本</th>
              <th>售價</th>
              <th>商品分類</th>
              <th>商品狀態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in sortedItems" :key="item.id">
              <td class="pm__th-checkbox">
                <input type="checkbox" :checked="selectedIds.includes(item.id)" @change="toggleOne(item.id)" />
              </td>
              <td>{{ item.code }}</td>
              <td class="pm__name-cell">
                <span class="pm__icon">{{ item.icon }}</span>{{ item.name }}
              </td>
              <td>${{ item.cost }}</td>
              <td>${{ item.price }}</td>
              <td>{{ menuStore.getCategoryLabel(item.categoryId) }}</td>
              <td>
                <button
                  class="pm__toggle"
                  :class="{ 'pm__toggle--on': item.status }"
                  :aria-label="item.status ? '下架' : '上架'"
                  @click="menuStore.setStatus(item.id, !item.status)"
                >
                  <span class="pm__toggle-knob" />
                </button>
              </td>
              <td>
                <button class="pm__edit-btn" @click="openEdit(item)">編輯</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <ProductFormModal
      v-if="showModal"
      :categories="menuStore.categories"
      :initial-data="editingItem"
      @close="showModal = false"
      @submit="handleSubmit"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SettingsSidebar  from '@/components/settings/SettingsSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import ProductFormModal  from '@/components/settings/ProductFormModal.vue'
import { useMenuStore }  from '@/stores/menuStore.js'

const menuStore = useMenuStore()

/* ── 表格排序：依商品編號 ── */
const sortedItems = computed(() =>
  [...menuStore.items].sort((a, b) => a.code.localeCompare(b.code))
)

/* ── 多選 ── */
const selectedIds = ref([])

const allChecked = computed(() =>
  sortedItems.value.length > 0 && selectedIds.value.length === sortedItems.value.length
)

function toggleAll(checked) {
  selectedIds.value = checked ? sortedItems.value.map(i => i.id) : []
}

function toggleOne(id) {
  const idx = selectedIds.value.indexOf(id)
  if (idx >= 0) selectedIds.value.splice(idx, 1)
  else selectedIds.value.push(id)
}

/* ── 新增 / 編輯 modal ── */
const showModal   = ref(false)
const editingItem = ref(null)

function openCreate() {
  editingItem.value = null
  showModal.value = true
}

function openEdit(item) {
  editingItem.value = item
  showModal.value = true
}

import { supabase } from '@/lib/supabase.js'

/* ── 儲存食材配方 ── */
async function saveRecipes(productId, recipes) {
  if (!productId) return
  // 先刪除舊的配方
  await supabase.from('product_ingredient_recipes').delete().eq('product_id', productId)
  // 插入新的配方（過濾空行）
  const rows = (recipes ?? [])
    .filter(r => r.ingredientId && r.qty > 0)
    .map(r => ({ product_id: productId, ingredient_id: r.ingredientId, qty_per_unit: r.qty }))
  if (rows.length > 0) {
    await supabase.from('product_ingredient_recipes').insert(rows)
  }
}

async function handleSubmit(data) {
  const { recipes, ...formData } = data
  if (editingItem.value) {
    menuStore.updateItem(editingItem.value.id, formData)
    await saveRecipes(editingItem.value.id, recipes)
  } else {
    const newItem = await menuStore.addItem(formData)
    await saveRecipes(newItem?.id, recipes)
  }
  showModal.value = false
}

/* ── 複製商品 ── */
function handleDuplicate() {
  if (selectedIds.value.length === 0) return
  menuStore.duplicateItems(selectedIds.value)
  selectedIds.value = []
}

/* ── 匯出 CSV ── */
function exportCsv() {
  const header = ['商品編號', '商品名稱', '成本', '售價', '商品分類', '商品狀態']
  const rows = sortedItems.value.map(i => [
    i.code, i.name, i.cost, i.price,
    menuStore.getCategoryLabel(i.categoryId),
    i.status ? '上架' : '下架',
  ])
  const csv = [header, ...rows].map(r => r.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `商品清單_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
.pm {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.pm__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--color-bg-map);
}

/* ── Action row ── */
.pm__action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  flex-shrink: 0;
}

.pm__action-left {
  display: flex;
  gap: 8px;
}

.pm__btn {
  padding: 7px 16px;
  background: #fff;
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-text-primary);
  transition: background 0.12s;
}

.pm__btn:hover:not(:disabled) { background: var(--color-bg-arrange-btn); }
.pm__btn:disabled { opacity: 0.45; cursor: not-allowed; }

.pm__btn--primary {
  background: var(--color-bg-nav-active);
  border-color: #c07820;
  color: var(--color-text-nav-active);
  font-weight: 500;
}

.pm__btn--primary:hover { background: #dc9530; }

/* ── Table ── */
.pm__table-wrap {
  flex: 1;
  overflow-y: auto;
  padding: 0 18px 18px;
}

.pm__table {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.pm__table th {
  text-align: left;
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 500;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border-card);
  background: #faf5ec;
  position: sticky;
  top: 0;
}

.pm__table td {
  font-size: 13px;
  color: var(--color-text-primary);
  padding: 10px 12px;
  border-bottom: 1px solid #f0e8d8;
}

.pm__th-checkbox { width: 36px; }

.pm__name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pm__icon { font-size: 16px; }

/* ── Toggle ── */
.pm__toggle {
  width: 38px;
  height: 22px;
  border-radius: var(--radius-full);
  background: #d8cdb5;
  position: relative;
  transition: background 0.15s;
}

.pm__toggle--on { background: #e8a038; }

.pm__toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
}

.pm__toggle--on .pm__toggle-knob { transform: translateX(16px); }

/* ── Edit button ── */
.pm__edit-btn {
  padding: 4px 14px;
  background: #f0e8d8;
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-brand);
}

.pm__edit-btn:hover { background: #e0d0b8; }
</style>