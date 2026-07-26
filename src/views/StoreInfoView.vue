<template>
  <div class="si">
    <SettingsSidebar />

    <div class="si__main">
      <AppTopbar :show-floor-tabs="false" title="店家資訊" />

      <div class="si__content">

        <!-- ── 營業時間 ── -->
        <section class="si__section">
          <div class="si__section-head">
            <div>
              <h2 class="si__section-title">🕒 營業時間</h2>
              <p class="si__section-hint">
                每天可以設定多個時段（例如午晚兩班）。打烊時間比開店時間早，代表跨夜營業——
                例如 17:30 － 02:00 是隔天凌晨兩點打烊。
              </p>
            </div>
            <span v-if="savedDay" class="si__saved-badge">✓ 已儲存</span>
          </div>

          <div v-if="bhStore.loading" class="si__loading">載入中...</div>

          <div v-else class="si__days">
            <div v-for="day in WEEKDAYS" :key="day.id" class="si__day">
              <div class="si__day-head">
                <span class="si__day-label">{{ day.label }}</span>
                <div class="si__day-actions">
                  <button v-if="drafts[day.id].length === 0" class="si__day-closed">公休</button>
                  <button class="si__day-add" @click="addSegment(day.id)">＋ 時段</button>
                  <button
                    v-if="drafts[day.id].length"
                    class="si__day-copy"
                    @click="copyToAll(day.id)"
                  >套用到全部</button>
                </div>
              </div>

              <div v-if="drafts[day.id].length === 0" class="si__day-empty">
                今天沒有營業時段（視為公休）
              </div>

              <div v-for="(seg, i) in drafts[day.id]" :key="i" class="si__seg">
                <input v-model="seg.open"  class="si__time" type="time" @change="saveDay(day.id)" />
                <span class="si__seg-dash">－</span>
                <input v-model="seg.close" class="si__time" type="time" @change="saveDay(day.id)" />
                <span v-if="isOvernight(seg)" class="si__overnight">跨夜</span>
                <button class="si__seg-del" @click="removeSegment(day.id, i)">×</button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── 取單號重置 ── -->
        <section class="si__section">
          <h2 class="si__section-title">🔢 取單號重置時間</h2>
          <p class="si__section-hint">
            取單號每天會歸零重新從 1 開始。重置一定要落在店休息的空檔，
            不然營業中會有客人拿到重複的號碼。
          </p>

          <div class="si__radio-group">
            <label class="si__radio">
              <input type="radio" value="auto" v-model="resetMode" @change="saveReset" />
              <div>
                <span class="si__radio-label">自動（建議）</span>
                <span class="si__radio-sub">依營業時間推算：當天第一段開店時間往前 1 小時</span>
              </div>
            </label>
            <label class="si__radio">
              <input type="radio" value="manual" v-model="resetMode" @change="saveReset" />
              <div>
                <span class="si__radio-label">手動指定</span>
                <span class="si__radio-sub">自己填一個固定時間，每天都在這個時間重置</span>
              </div>
            </label>
          </div>

          <div v-if="resetMode === 'manual'" class="si__field">
            <label class="si__label">重置時間</label>
            <input v-model="resetTime" class="si__time si__time--wide" type="time" @change="saveReset" />
          </div>

          <div class="si__preview">
            <p class="si__preview-title">實際生效的重置時間</p>
            <div v-if="resetMode === 'auto'" class="si__preview-list">
              <div v-for="day in WEEKDAYS" :key="day.id" class="si__preview-row">
                <span>{{ day.label }}</span>
                <span class="si__preview-time">
                  {{ bhStore.autoResetTimeFor(day.id) ?? '公休，不重置' }}
                </span>
              </div>
            </div>
            <p v-else class="si__preview-single">
              每天 {{ resetTime || '—' }}
            </p>
            <p v-if="conflictDays.length" class="si__warning">
              ⚠️ {{ conflictDays.join('、') }} 的重置時間落在營業時段內，
              營業中歸零會讓客人拿到重複號碼，建議改成自動或換一個時間。
            </p>
          </div>

          <span v-if="savedReset" class="si__saved-badge">✓ 已儲存</span>
        </section>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import { useBusinessHoursStore, WEEKDAYS } from '@/stores/businessHoursStore.js'

const bhStore = useBusinessHoursStore()

/* 每天的時段草稿。直接綁在畫面上，改完就存，不用另外按儲存鍵。 */
const drafts = reactive({})
for (const d of WEEKDAYS) drafts[d.id] = []

const resetMode = ref('auto')
const resetTime = ref('')

const savedDay   = ref(false)
const savedReset = ref(false)

onMounted(async () => {
  await bhStore.init(true)
  syncDrafts()
  resetMode.value = bhStore.info.pickupResetMode ?? 'auto'
  resetTime.value = (bhStore.info.pickupResetTime ?? '').slice(0, 5)
})

function syncDrafts() {
  for (const d of WEEKDAYS) {
    drafts[d.id] = (bhStore.getSegments(d.id) ?? []).map(s => ({ ...s }))
  }
}

function addSegment(weekday) {
  drafts[weekday].push({ open: '09:00', close: '18:00' })
  saveDay(weekday)
}

function removeSegment(weekday, idx) {
  drafts[weekday].splice(idx, 1)
  saveDay(weekday)
}

/** 打烊時間比開店早 → 跨夜營業 */
function isOvernight(seg) {
  if (!seg.open || !seg.close) return false
  return seg.close < seg.open
}

async function saveDay(weekday) {
  const ok = await bhStore.saveDay(weekday, drafts[weekday])
  if (ok) flash(savedDay)
}

async function copyToAll(weekday) {
  const targets = WEEKDAYS.map(d => d.id).filter(id => id !== weekday)
  const ok = await bhStore.copyDayTo(weekday, targets)
  if (ok) { syncDrafts(); flash(savedDay) }
}

async function saveReset() {
  const ok = await bhStore.saveResetSetting({ mode: resetMode.value, time: resetTime.value })
  if (ok) flash(savedReset)
}

function flash(flagRef) {
  flagRef.value = true
  setTimeout(() => { flagRef.value = false }, 2000)
}

/* ── 手動模式的防呆：檢查重置時間有沒有卡在營業時段裡 ── */
const conflictDays = computed(() => {
  if (resetMode.value !== 'manual' || !resetTime.value) return []
  return WEEKDAYS
    .filter(day => (drafts[day.id] ?? []).some(seg => withinSegment(resetTime.value, seg)))
    .map(day => day.label)
})

function withinSegment(time, seg) {
  if (!seg.open || !seg.close) return false
  if (seg.close < seg.open) {
    // 跨夜：例如 17:30-02:00，落在 17:30 之後或 02:00 之前都算營業中
    return time >= seg.open || time <= seg.close
  }
  return time >= seg.open && time <= seg.close
}

watch(resetMode, () => { savedReset.value = false })
</script>

<style scoped>
.si { width: 100%; height: 100%; display: flex; overflow: hidden; }
.si__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.si__content {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  background: var(--color-bg-map);
  display: flex; flex-direction: column; gap: 16px; max-width: 760px;
}

.si__section {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 16px 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.si__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.si__section-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.si__section-hint  { font-size: 11.5px; color: var(--color-text-muted); margin-top: 4px; line-height: 1.6; }

.si__loading { font-size: 12.5px; color: var(--color-text-muted); }

.si__saved-badge {
  align-self: flex-start;
  font-size: 11.5px; font-weight: 500; color: #2f7a3d;
  background: #e1f3e1; padding: 3px 10px; border-radius: 999px; white-space: nowrap;
}

/* ── 每天 ── */
.si__days { display: flex; flex-direction: column; gap: 8px; }
.si__day {
  border: 1px solid #ede5d0; border-radius: 10px;
  padding: 10px 12px; background: #fdfaf5;
}
.si__day-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.si__day-label { font-size: 13px; font-weight: 600; color: #5a4030; }
.si__day-actions { display: flex; align-items: center; gap: 6px; }
.si__day-closed {
  font-size: 11px; color: #9a8868; background: #f0e8d8;
  border: 1px solid #ddd0b8; padding: 2px 10px; border-radius: 999px; cursor: default;
}
.si__day-add, .si__day-copy {
  font-size: 11.5px; color: #8a6020; background: #fde8c0;
  border: 1px solid #e8c888; padding: 3px 10px; border-radius: 999px;
}
.si__day-add:hover, .si__day-copy:hover { background: #f8dca0; }

.si__day-empty { font-size: 11.5px; color: var(--color-text-muted); padding: 2px 0; }

.si__seg { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.si__seg-dash { color: var(--color-text-muted); font-size: 13px; }
.si__time {
  padding: 6px 9px; border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13px; color: #1a0800; background: #fff;
  outline: none; font-family: inherit;
}
.si__time:focus { border-color: #e8a038; }
.si__time--wide { width: 160px; }

.si__overnight {
  font-size: 10.5px; font-weight: 500; color: #8a6020;
  background: #fde8c0; padding: 2px 8px; border-radius: 999px;
}

.si__seg-del {
  width: 22px; height: 22px; border-radius: 50%;
  background: #f0e0e0; color: #c03020; font-size: 13px;
  display: flex; align-items: center; justify-content: center; margin-left: auto;
}
.si__seg-del:hover { background: #f0c0b8; }

/* ── 重置設定 ── */
.si__radio-group { display: flex; flex-direction: column; gap: 8px; }
.si__radio {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 10px 12px; border-radius: 10px;
  background: #faf5ec; border: 1.5px solid #ede5d0; cursor: pointer;
}
.si__radio:hover { background: #f5efe2; }
.si__radio input { margin-top: 2px; }
.si__radio-label { display: block; font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
.si__radio-sub   { display: block; font-size: 11px; color: var(--color-text-muted); margin-top: 2px; }

.si__field { display: flex; flex-direction: column; gap: 5px; }
.si__label { font-size: 12px; font-weight: 500; color: #5a4030; }

.si__preview {
  background: #faf5ec; border-radius: 10px; padding: 10px 12px;
  display: flex; flex-direction: column; gap: 6px;
}
.si__preview-title { font-size: 11.5px; font-weight: 600; color: #5a4030; }
.si__preview-list  { display: flex; flex-direction: column; gap: 3px; }
.si__preview-row {
  display: flex; justify-content: space-between;
  font-size: 12.5px; color: var(--color-text-secondary);
}
.si__preview-time { font-variant-numeric: tabular-nums; color: var(--color-text-primary); }
.si__preview-single { font-size: 13px; color: var(--color-text-primary); }

.si__warning {
  font-size: 11.5px; color: #8a6020; background: #fff8ee;
  border: 1px solid #e8d090; border-radius: 8px;
  padding: 7px 10px; line-height: 1.6; margin-top: 4px;
}
</style>
