<template>
  <article
    class="rc"
    :class="[
      !isGray && `rc--${reservation.urgency}`,
      isGray && 'rc--gray',
    ]"
  >
    <!-- Cancel confirmation overlay -->
    <transition name="rc-fade">
      <div v-if="showConfirm" class="rc__overlay">
        <p class="rc__overlay-text">確定取消「{{ reservation.name }}」的訂位？</p>
        <div class="rc__overlay-btns">
          <button class="rc__overlay-keep" @click="showConfirm = false">保留</button>
          <button class="rc__overlay-do-cancel" @click="doCancel">確認取消</button>
        </div>
      </div>
    </transition>

    <!-- Top: name + phone + badge -->
    <div class="rc__top">
      <div class="rc__identity">
        <span class="rc__name">{{ reservation.name }}</span>
        <span class="rc__phone">{{ reservation.phone }}</span>
      </div>
      <span class="rc__badge" :class="`rc__badge--${badgeType}`">{{ badgeLabel }}</span>
    </div>

    <!-- Minus button -->
    <button
      class="rc__minus"
      :aria-label="isCancelled ? '恢復訂位' : '取消訂位'"
      @click="handleMinus"
    >–</button>

    <!-- Time -->
    <div class="rc__time">
      <span aria-hidden="true">⏰</span>
      {{ reservation.time }}
    </div>

    <!-- Footer -->
    <div class="rc__footer">
      <span class="rc__guests">{{ reservation.guests }}位</span>
      <button
        v-if="isWaiting"
        class="rc__arrange"
        @click="emit('arrange', reservation.id)"
      >安排座位</button>
      <div v-else-if="isSeated" class="rc__seated-footer">
        <span class="rc__seat-names">{{ seatNamesLabel }}</span>
        <span class="rc__elapsed">{{ elapsedLabel }}</span>
      </div>
      <span v-else-if="isCancelled" class="rc__restore-hint">按 – 可恢復</span>
    </div>
  </article>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  reservation: { type: Object, required: true },
})

const emit = defineEmits(['cancel', 'arrange', 'restore'])

/* ── Status ── */
const isWaiting   = computed(() => props.reservation.status === 'waiting')
const isSeated    = computed(() => props.reservation.status === 'seated')
const isCancelled = computed(() => props.reservation.status === 'cancelled')
const isGray      = computed(() => isSeated.value || isCancelled.value)

/* ── Badge ── */
const badgeLabel = computed(() => {
  if (isCancelled.value) return '已取消'
  if (isSeated.value)    return '用餐中'
  return props.reservation.timeLabel
})

const badgeType = computed(() => {
  if (isCancelled.value || isSeated.value) return 'gray'
  return props.reservation.urgency
})

/* ── Elapsed timer ── */
const elapsedSeconds = ref(0)
let timerHandle = null

function startTimer() {
  if (!props.reservation.seatedAt) return
  const tick = () => {
    elapsedSeconds.value = Math.floor((Date.now() - props.reservation.seatedAt) / 1000)
  }
  tick()
  timerHandle = setInterval(tick, 1000)
}

function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null }
}

watch(
  () => props.reservation.status,
  (status) => { status === 'seated' ? startTimer() : stopTimer() },
  { immediate: true },
)

onUnmounted(stopTimer)

const seatNamesLabel = computed(() => {
  const names = props.reservation.assignedItemNames
  if (!names || names.length === 0) return ''
  return names.join('、')
})

const elapsedLabel = computed(() => {
  const s = elapsedSeconds.value
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}時${m % 60}分`
  if (m > 0) return `${m}分鐘`
  return '剛入座'
})

/* ── Cancel confirmation ── */
const showConfirm = ref(false)

function handleMinus() {
  if (isCancelled.value) {
    // 直接恢復，不需確認
    emit('restore', props.reservation.id)
  } else if (isWaiting.value) {
    // 顯示確認視窗
    showConfirm.value = true
  }
  // seated 狀態暫不處理（需後續結帳流程）
}

function doCancel() {
  showConfirm.value = false
  emit('cancel', props.reservation.id)
}
</script>

<style scoped>
.rc {
  border-radius: var(--radius-md);
  border-top:    1px solid var(--color-border-card);
  border-right:  1px solid var(--color-border-card);
  border-bottom: 1px solid var(--color-border-card);
  border-left:   3px solid var(--rc-accent, #b0b0b0);
  background:    var(--rc-bg, #fff);
  padding: 7px 9px;
  position: relative;
  overflow: hidden;
  transition: filter 0.25s;
}

.rc--red    { --rc-accent: #d94030; --rc-bg: #fff4f3; }
.rc--orange { --rc-accent: #c87010; --rc-bg: #fff8f0; }
.rc--blue   { --rc-accent: #3068c0; --rc-bg: #f2f5ff; }
.rc--gray   {
  --rc-accent: #a0a0a0;
  --rc-bg:     #f5f5f5;
  filter: grayscale(0.8) opacity(0.75);
}

/* ── Confirmation overlay ── */
.rc__overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 252, 246, 0.97);
  border-radius: inherit;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px;
  z-index: 2;
}

.rc__overlay-text {
  font-size: var(--fs-sm);
  color: var(--color-text-primary);
  font-weight: 500;
  text-align: center;
}

.rc__overlay-btns {
  display: flex;
  gap: 6px;
}

.rc__overlay-keep {
  padding: 4px 12px;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
  border-radius: var(--radius-xs);
  font-size: var(--fs-xs);
  color: #5a4030;
  transition: background 0.12s;
}

.rc__overlay-keep:hover { background: #e8dcc8; }

.rc__overlay-do-cancel {
  padding: 4px 12px;
  background: #c03020;
  border: none;
  border-radius: var(--radius-xs);
  font-size: var(--fs-xs);
  color: #fff;
  font-weight: 500;
  transition: background 0.12s;
}

.rc__overlay-do-cancel:hover { background: #a02010; }

/* ── Top row ── */
.rc__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 3px;
  padding-right: 16px;
}

.rc__identity {
  display: flex;
  align-items: baseline;
  gap: 3px;
  flex-wrap: wrap;
}

.rc__name  { font-size: var(--fs-base); font-weight: 500; color: var(--color-text-primary); }
.rc__phone { font-size: var(--fs-xs);   color: var(--color-text-muted); }

/* ── Badge ── */
.rc__badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: var(--radius-full);
  font-weight: 500;
  white-space: nowrap;
  color: #fff;
  flex-shrink: 0;
}

.rc__badge--red    { background: #c03020; }
.rc__badge--orange { background: #c07010; }
.rc__badge--blue   { background: #2860c0; }
.rc__badge--gray   { background: #909090; }

/* ── Minus ── */
.rc__minus {
  position: absolute;
  top: 6px;
  right: 7px;
  width: 13px;
  height: 13px;
  background: #e0d4c0;
  border-radius: var(--radius-full);
  font-size: 11px;
  color: #8a7860;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
  z-index: 1;
}

.rc__minus:hover { background: #c8b8a0; }

/* ── Time ── */
.rc__time {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: var(--fs-sm);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

/* ── Footer ── */
.rc__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.rc__guests { font-size: var(--fs-base); color: var(--color-text-primary); }

.rc__arrange {
  padding: 2px 8px;
  background: var(--color-bg-arrange-btn);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-xs);
  font-size: var(--fs-xs);
  color: var(--color-text-brand);
  transition: background 0.12s;
}

.rc__arrange:hover { background: #e8dcc8; }



.rc__restore-hint {
  font-size: 9px;
  color: #a0a0a0;
}

.rc__seated-footer {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 1px;
}

.rc__seat-names {
  font-size: 9px;
  color: #707070;
  letter-spacing: 0.5px;
}

.rc__elapsed {
  font-size: var(--fs-xs);
  color: #707070;
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: var(--radius-full);
}

/* ── Transition ── */
.rc-fade-enter-active,
.rc-fade-leave-active { transition: opacity 0.15s; }
.rc-fade-enter-from,
.rc-fade-leave-to { opacity: 0; }
</style>