<template>
  <Teleport to="body">
    <div class="som-backdrop" @click.self="emit('close')">
      <div class="som-box">

        <div class="som-header">
          <div class="som-header-left">
            <span class="som-seat-badge">{{ seat.name }}</span>
            <span class="som-time">{{ elapsedTime }}</span>
          </div>
          <button class="som-close" @click="emit('close')">×</button>
        </div>

        <!-- 載入中 -->
        <div v-if="loading" class="som-loading">載入中...</div>

        <!-- 找不到訂單 -->
        <div v-else-if="!order" class="som-empty">
          <p>找不到此座位的訂單</p>
          <p class="som-empty-hint">可能是較早前的訂單或從其他裝置建立的</p>
          <div class="som-footer">
            <button class="som-btn-reset" @click="handleReset">清空座位</button>
            <button class="som-btn-cancel" @click="emit('close')">關閉</button>
          </div>
        </div>

        <!-- 訂單詳情 -->
        <template v-else>
          <div class="som-body">
            <table class="som-table">
              <thead>
                <tr>
                  <th>品名</th>
                  <th class="som-th-num">數量</th>
                  <th class="som-th-num">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(line, i) in order.items" :key="i">
                  <td>{{ line.name }}</td>
                  <td class="som-td-num">{{ line.qty }}</td>
                  <td class="som-td-num">${{ (line.price * line.qty).toFixed(0) }}</td>
                </tr>
              </tbody>
            </table>

            <!-- 標籤 + 備註 -->
            <div v-if="order.tags?.length || order.note" class="som-extras">
              <div v-if="order.tags?.length" class="som-tags">
                <span v-for="tag in order.tags" :key="tag.id"
                  class="som-tag-pill"
                  :style="{ background: tagColorOf(tag).bg, color: tagColorOf(tag).text }">
                  {{ tag.label }}
                </span>
              </div>
              <p v-if="order.note" class="som-note">📝 {{ order.note }}</p>
            </div>
          </div>

          <div class="som-summary">
            <div class="som-row">
              <span>小計</span>
              <span>${{ order.subtotal?.toFixed(0) }}</span>
            </div>
            <div v-if="surchargeAmt > 0" class="som-row">
              <span>加價</span>
              <span>+${{ surchargeAmt.toFixed(0) }}</span>
            </div>
            <div v-if="discountAmt > 0" class="som-row som-row--discount">
              <span>折扣</span>
              <span>-${{ discountAmt.toFixed(0) }}</span>
            </div>
            <div class="som-row som-row--total">
              <span>總計</span>
              <span>${{ order.total?.toFixed(0) }}</span>
            </div>
          </div>

          <div class="som-footer">
            <button class="som-btn-cancel" @click="emit('close')">取消</button>
            <button class="som-btn-complete" :disabled="completing" @click="handleComplete">
              {{ completing ? '處理中...' : '✓ 完成結帳' }}
            </button>
          </div>
        </template>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDineInStore }   from '@/stores/dineInStore.js'
import { resetSeatStatus }  from '@/lib/floorOrders.js'
import { TAG_COLOR_MAP }    from '@/constants/tagColors.js'

const props = defineProps({
  seat: { type: Object, required: true },   // { id, name, status, type }
})

const emit = defineEmits(['close', 'completed'])

const dineInStore = useDineInStore()
const loading     = ref(true)
const completing  = ref(false)
const order       = ref(null)

onMounted(async () => {
  order.value = dineInStore.getOrderBySeatId(props.seat.id)
  loading.value = false
})

/* 等候計時 */
const elapsedTime = computed(() => {
  if (!order.value?.createdAt) return ''
  const diff    = Math.max(0, Math.floor((Date.now() - new Date(order.value.createdAt).getTime()) / 1000))
  const hours   = Math.floor(diff / 3600)
  const minutes = Math.floor((diff % 3600) / 60)
  return hours > 0 ? `${hours}h${String(minutes).padStart(2,'0')}m` : `${minutes} 分鐘`
})

/* 金額計算 */
const surchargeAmt = computed(() => order.value?.surcharge?.amount ?? 0)
const discountAmt  = computed(() => {
  const d = order.value?.discount
  if (!d?.value) return 0
  const base = order.value.subtotal + surchargeAmt.value
  return d.type === 'percent' ? Math.round(base * d.value / 100) : Math.min(d.value, base)
})

function tagColorOf(tag) { return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray }

/* 完成結帳 */
async function handleComplete() {
  if (!order.value || completing.value) return
  completing.value = true
  const ok = await dineInStore.completeOrder(order.value.id, props.seat.id)
  if (ok) {
    await resetSeatStatus(props.seat.id)
    emit('completed', props.seat.id)
    emit('close')
  }
  completing.value = false
}

/* 只重置座位狀態（找不到訂單資料時用） */
async function handleReset() {
  await resetSeatStatus(props.seat.id)
  emit('completed', props.seat.id)
  emit('close')
}
</script>

<style scoped>
.som-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}

.som-box {
  background: #fff; border-radius: 16px;
  width: 340px; max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  font-family: 'Noto Sans TC','PingFang TC',sans-serif;
  display: flex; flex-direction: column;
}

.som-header {
  display: flex; align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #ede5d0;
  flex-shrink: 0;
}

.som-header-left { display: flex; align-items: center; gap: 10px; }

.som-seat-badge {
  font-size: 15px; font-weight: 600;
  color: #1a0800;
  background: #fde8c0; padding: 4px 12px;
  border-radius: 999px;
}

.som-time { font-size: 12px; color: var(--color-text-muted); }

.som-close {
  width: 26px; height: 26px; border-radius: 50%;
  background: #f0e8d8; font-size: 16px; color: #7a6850;
  display: flex; align-items: center; justify-content: center;
}
.som-close:hover { background: #e0d0b8; }

.som-loading, .som-empty {
  padding: 32px 16px; text-align: center;
  color: var(--color-text-muted); font-size: 13px;
}
.som-empty-hint { font-size: 11.5px; margin-top: 6px; }

.som-body { padding: 12px 16px; flex: 1; overflow-y: auto; }

.som-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.som-table th {
  text-align: left; padding: 6px 8px 6px 0;
  font-size: 12px; color: var(--color-text-muted);
  border-bottom: 1px solid #f0e8d8;
}
.som-th-num { text-align: right; }
.som-table td { padding: 8px 8px 8px 0; border-bottom: 1px solid #faf5ec; color: #1a0800; }
.som-td-num { text-align: right; }

.som-extras { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
.som-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.som-tag-pill {
  font-size: 12px; font-weight: 500;
  padding: 3px 10px; border-radius: 999px;
}
.som-note {
  font-size: 12.5px; color: var(--color-text-secondary);
  background: #faf5ec; padding: 6px 9px; border-radius: var(--radius-sm);
}

.som-summary {
  padding: 10px 16px;
  border-top: 1px solid #ede5d0;
  display: flex; flex-direction: column; gap: 6px;
  flex-shrink: 0;
}
.som-row {
  display: flex; justify-content: space-between;
  font-size: 13px; color: var(--color-text-secondary);
}
.som-row--discount { color: #c0392b; }
.som-row--total {
  font-size: 15px; font-weight: 600;
  color: #1a0800;
  padding-top: 6px;
  border-top: 1px dashed #e0d5c0;
}

.som-footer {
  padding: 12px 16px 14px;
  border-top: 1px solid #ede5d0;
  display: flex; gap: 8px;
  flex-shrink: 0;
}

.som-btn-cancel {
  flex: 1; padding: 10px;
  border-radius: 10px; font-size: 13px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.som-btn-cancel:hover { background: #e8dcc8; }

.som-btn-complete {
  flex: 2; padding: 10px;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  color: #fff; background: #2f7a3d; border: none;
  transition: background 0.15s;
}
.som-btn-complete:hover:not(:disabled) { background: #236030; }
.som-btn-complete:disabled { opacity: 0.6; }

.som-btn-reset {
  flex: 1; padding: 10px;
  border-radius: 10px; font-size: 13px;
  color: #c0392b; background: #fff0ee; border: 1px solid #f0c0b8;
}
.som-btn-reset:hover { background: #fde0dc; }
</style>