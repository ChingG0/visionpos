<template>
  <div class="mig">

    <!-- Header -->
    <div class="mig__header">
      <h3 class="mig__title">商品<span class="mig__title-light">選擇</span></h3>
    </div>

    <!-- Grid -->
    <div class="mig__grid">
      <button
        v-for="item in items"
        :key="item.id"
        class="mig__card"
        @click="emit('add', item)"
      >
        <span v-if="qtyOf(item) > 0" class="mig__qty-badge">×{{ qtyOf(item) }}</span>
        <span class="mig__icon">{{ item.icon }}</span>
        <span class="mig__name">{{ item.name }}</span>
        <span class="mig__price">${{ item.price }}</span>
      </button>

      <p v-if="items.length === 0" class="mig__empty">沒有符合的品項</p>
    </div>

  </div>
</template>

<script setup>
const props = defineProps({
  items:       { type: Array,  required: true },
  cartQtyMap:  { type: Object, default: () => ({}) },
})

const emit = defineEmits(['add'])

function qtyOf(item) {
  return props.cartQtyMap[item.id] ?? 0
}
</script>

<style scoped>
.mig {
  margin-top:10px;
  flex: 1;
  overflow-y: auto;
  padding-right: 4px;
}

.mig__header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.mig__title {
  font-size: 19px;
  font-weight: 500;
  color: var(--color-text-primary);
}

.mig__title-light {
  font-weight: 500;
  color: var(--color-text-primary);
}

/* ── Grid ── */
.mig__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.mig__card {
  position: relative;
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 14px 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  transition: border-color 0.12s, transform 0.08s;
}

.mig__card:hover {
  border-color: var(--color-border-btn);
}

.mig__card:active {
  transform: scale(0.96);
}

.mig__icon {
  font-size: 30px;
  line-height: 1;
  margin-bottom: 2px;
}

.mig__name {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-align: center;
}

.mig__price {
  font-size: 11.5px;
  color: var(--color-text-secondary);
}

.mig__qty-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  background: #3a7a3a;
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: var(--radius-full);
}

.mig__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 30px 0;
}
</style>