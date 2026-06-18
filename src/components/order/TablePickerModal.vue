<template>
  <Teleport to="body">
    <div class="tpm-backdrop" @click.self="emit('close')">
      <div class="tpm-box" role="dialog" aria-modal="true">

        <div class="tpm-header">
          <h2 class="tpm-title">選擇內用桌號</h2>
          <button class="tpm-close" aria-label="關閉" @click="emit('close')">×</button>
        </div>

        <div class="tpm-body">
          <p v-if="loading" class="tpm-loading">讀取座位圖中...</p>
          <p v-else-if="tables.length === 0" class="tpm-empty">目前沒有桌位資料</p>

          <div v-else class="tpm-grid">
            <button
              v-for="t in tables"
              :key="t.id"
              class="tpm-table"
              :style="{ borderColor: dotColor(t.status) }"
              @click="emit('select', t)"
            >
              <span class="tpm-dot" :style="{ background: dotColor(t.status) }" />
              {{ t.name }}
            </button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  tables:  { type: Array,   default: () => [] },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'select'])

const STATUS_DOT = {
  empty:   '#b0a890',
  ordered: '#c87d10',
  paid:    '#358050',
}

function dotColor(status) {
  return STATUS_DOT[status] ?? STATUS_DOT.empty
}
</script>

<style scoped>
.tpm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.tpm-box {
  background: #fff;
  border-radius: 16px;
  width: 380px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.tpm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #ede5d0;
}

.tpm-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
}

.tpm-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0e8d8;
  font-size: 16px;
  color: #7a6850;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tpm-close:hover { background: #e0d0b8; }

.tpm-body {
  padding: 16px 18px;
}

.tpm-loading,
.tpm-empty {
  text-align: center;
  color: #9a8868;
  font-size: 13px;
  padding: 30px 0;
}

.tpm-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.tpm-table {
  padding: 14px 6px;
  border: 1.5px solid #d8cdb5;
  border-radius: 10px;
  background: #faf5ec;
  font-size: 13px;
  font-weight: 500;
  color: #1a0800;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  transition: transform 0.1s;
}

.tpm-table:hover { transform: scale(1.04); }

.tpm-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
}
</style>