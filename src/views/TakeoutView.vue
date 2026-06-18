<template>
  <div class="tk">
    <AppSidebar />

    <div class="tk__main">
      <AppTopbar :show-floor-tabs="false" title="外帶訂單" />

      <div class="tk__body">
        <p v-if="takeoutStore.loading" class="tk__loading">載入中...</p>

        <p v-else-if="takeoutStore.orders.length === 0" class="tk__empty">
          目前沒有待取餐的外帶訂單
        </p>

        <div v-else class="tk__list">
          <div v-for="order in takeoutStore.orders" :key="order.id" class="tk__card">

            <div class="tk__card-header">
              <span class="tk__card-time">{{ formatTime(order.createdAt) }}</span>
              <span class="tk__card-total">${{ order.total.toFixed(0) }}</span>
            </div>

            <ul class="tk__card-items">
              <li v-for="(line, idx) in order.items" :key="idx">
                {{ line.name }} ×{{ line.qty }}
              </li>
            </ul>

            <div v-if="order.tags?.length" class="tk__card-tags">
              <span
                v-for="tag in order.tags"
                :key="tag.id"
                class="tk__tag-pill"
                :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }"
              >{{ tag.label }}</span>
            </div>

            <p v-if="order.note" class="tk__card-note">📝 {{ order.note }}</p>

            <button class="tk__done-btn" @click="takeoutStore.completeOrder(order.id)">
              ✓ 完成取餐
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppTopbar   from '@/components/layout/AppTopbar.vue'
import { useTakeoutStore } from '@/stores/takeoutStore.js'
import { TAG_COLOR_MAP }   from '@/constants/tagColors.js'

const takeoutStore = useTakeoutStore()

function tagColorOf(tag) {
  return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
</script>

<style scoped>
.tk {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.tk__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tk__body {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  background: var(--color-bg-map);
}

.tk__loading,
.tk__empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--fs-base);
  padding: 60px 0;
}

.tk__list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.tk__card {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tk__card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tk__card-time {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tk__card-total {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.tk__card-items {
  font-size: 13px;
  color: var(--color-text-primary);
  line-height: 1.6;
}

.tk__card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.tk__tag-pill {
  font-size: 10.5px;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  font-weight: 500;
}

.tk__card-note {
  font-size: 12px;
  color: var(--color-text-secondary);
  background: #faf5ec;
  padding: 6px 9px;
  border-radius: var(--radius-sm);
}

.tk__done-btn {
  margin-top: 4px;
  padding: 9px 0;
  background: #3a7a3a;
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 500;
  transition: background 0.15s;
}

.tk__done-btn:hover { background: #2a6a2a; }
</style>