<template>
  <Teleport to="body">
    <div class="rf-backdrop" @click.self="emit('close')">
      <div class="rf-box" role="dialog" aria-modal="true" aria-labelledby="rf-title">

        <!-- Header -->
        <div class="rf-header">
          <h2 id="rf-title" class="rf-title">新增訂位</h2>
          <button class="rf-close" aria-label="關閉" @click="emit('close')">×</button>
        </div>

        <!-- Form -->
        <div class="rf-body">

          <!-- 電話（第一個輸入，觸發自動帶入） -->
          <div class="rf-field">
            <label class="rf-label">電話 <span class="rf-required">*</span></label>
            <div class="rf-input-row">
              <input
                v-model="form.phone"
                class="rf-input"
                type="tel"
                placeholder="09xx-xxx-xxx"
                maxlength="12"
                @input="onPhoneInput"
              />
              <span v-if="memberFound" class="rf-member-tag">會員 ✓</span>
            </div>
            <p v-if="memberFound" class="rf-member-hint">
              已帶入「{{ memberFound.name }}」的資料
            </p>
          </div>

          <!-- 姓名 -->
          <div class="rf-field">
            <label class="rf-label">姓名 <span class="rf-required">*</span></label>
            <input
              v-model="form.name"
              class="rf-input"
              type="text"
              placeholder="王小姐"
              maxlength="20"
            />
          </div>

          <!-- 日期 + 時間（同排） -->
          <div class="rf-row">
            <div class="rf-field">
              <label class="rf-label">日期 <span class="rf-required">*</span></label>
              <input v-model="form.date" class="rf-input" type="date" />
            </div>
            <div class="rf-field">
              <label class="rf-label">時間 <span class="rf-required">*</span></label>
              <input v-model="form.time" class="rf-input" type="time" />
            </div>
          </div>

          <!-- 人數 -->
          <div class="rf-field rf-field--short">
            <label class="rf-label">人數 <span class="rf-required">*</span></label>
            <div class="rf-guests-row">
              <button class="rf-guests-btn" @click="changeGuests(-1)">−</button>
              <span class="rf-guests-num">{{ form.guests }}</span>
              <button class="rf-guests-btn" @click="changeGuests(1)">＋</button>
              <span class="rf-guests-unit">位</span>
            </div>
          </div>

          <!-- 備註 -->
          <div class="rf-field">
            <label class="rf-label">備註</label>
            <textarea
              v-model="form.note"
              class="rf-textarea"
              placeholder="過敏、生日、包廂需求…"
              rows="2"
            />
          </div>

          <!-- 錯誤訊息 -->
          <p v-if="errorMsg" class="rf-error">{{ errorMsg }}</p>

        </div>

        <!-- Footer -->
        <div class="rf-footer">
          <button class="rf-btn-cancel" @click="emit('close')">取消</button>
          <button class="rf-btn-confirm" @click="submit">確認新增</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useMemberStore } from '@/stores/memberStore.js'

const emit = defineEmits(['close', 'submit'])

const memberStore = useMemberStore()
const memberFound = ref(null)   // 找到的會員資料，null 表示未找到
const errorMsg    = ref('')

/* ── 預設表單值 ── */
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function defaultTime() {
  const d = new Date()
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0)
  return d.toTimeString().slice(0, 5)
}

const form = reactive({
  phone:  '',
  name:   '',
  date:   todayStr(),
  time:   defaultTime(),
  guests: 2,
  note:   '',
})

/* ── 人數調整 ── */
function changeGuests(delta) {
  form.guests = Math.min(50, Math.max(1, form.guests + delta))
}

/* ── 電話輸入：查詢會員並自動帶入 ── */
function onPhoneInput() {
  const clean = form.phone.replace(/\D/g, '')
  if (clean.length >= 10) {
    const member = memberStore.findByPhone(clean)
    if (member) {
      memberFound.value = member
      form.name   = member.name
      form.guests = member.defaultGuests || form.guests
    } else {
      memberFound.value = null
    }
  } else {
    memberFound.value = null
  }
}

/* ── 計算訂位急迫度 ── */
function calcUrgency(date, time) {
  const target  = new Date(`${date}T${time}`)
  const diffMin = Math.round((target - Date.now()) / 60000)
  if (diffMin <= 30)  return { timeLabel: `${Math.max(diffMin, 1)}分鐘後`, urgency: 'red' }
  if (diffMin <= 90)  return { timeLabel: '1小時後',                       urgency: 'orange' }
  if (diffMin <= 150) return { timeLabel: '2小時後',                       urgency: 'orange' }
  return { timeLabel: `${Math.round(diffMin / 60)}小時後`,                 urgency: 'blue' }
}

/* ── 送出 ── */
function submit() {
  errorMsg.value = ''

  if (!form.phone.trim()) { errorMsg.value = '請填寫電話'; return }
  if (!form.name.trim())  { errorMsg.value = '請填寫姓名'; return }
  if (!form.date)         { errorMsg.value = '請選擇日期'; return }
  if (!form.time)         { errorMsg.value = '請選擇時間'; return }

  const { timeLabel, urgency } = calcUrgency(form.date, form.time)

  /* 新增到會員名單 */
  memberStore.upsertMember({
    phone:         form.phone.replace(/\D/g, ''),
    name:          form.name.trim(),
    defaultGuests: form.guests,
    lastNote:      form.note.trim(),
  })

  emit('submit', {
    name:      form.name.trim(),
    phone:     form.phone.trim(),
    date:      form.date,
    time:      form.time,
    guests:    form.guests,
    note:      form.note.trim(),
    timeLabel,
    urgency,
    status:    'waiting',
    seatedAt:  null,
    assignedItemIds:   [],
    assignedItemNames: [],
  })
}
</script>

<style scoped>
/* ── Backdrop ── */
.rf-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* ── Dialog box ── */
.rf-box {
  background: #fff;
  border-radius: 16px;
  width: 340px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.rf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #ede5d0;
  flex-shrink: 0;
}

.rf-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
}

.rf-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0e8d8;
  border: none;
  font-size: 16px;
  color: #7a6850;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.rf-close:hover { background: #e0d0b8; }

/* ── Body ── */
.rf-body {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

/* ── Field ── */
.rf-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rf-row {
  display: flex;
  gap: 10px;
}

.rf-row .rf-field { flex: 1; }

.rf-label {
  font-size: 12px;
  font-weight: 500;
  color: #5a4030;
}

.rf-required { color: #c03020; }

.rf-input {
  padding: 7px 10px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 13px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  transition: border-color 0.15s;
  width: 100%;
}

.rf-input:focus { border-color: #e8a038; }

/* ── Phone row ── */
.rf-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rf-input-row .rf-input { flex: 1; }

.rf-member-tag {
  font-size: 11px;
  padding: 3px 8px;
  background: #e8f5e8;
  border: 1px solid #88c088;
  border-radius: 12px;
  color: #3a7a3a;
  white-space: nowrap;
  font-weight: 500;
}

.rf-member-hint {
  font-size: 11px;
  color: #3a7a3a;
  margin-top: 1px;
}

/* ── Guests ── */
.rf-guests-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rf-guests-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
  font-size: 16px;
  color: #5a4030;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.12s;
}

.rf-guests-btn:hover { background: #e0d0b8; }

.rf-guests-num {
  font-size: 18px;
  font-weight: 500;
  color: #1a0800;
  min-width: 28px;
  text-align: center;
}

.rf-guests-unit {
  font-size: 13px;
  color: #7a6850;
}

/* ── Textarea ── */
.rf-textarea {
  padding: 7px 10px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 13px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  resize: none;
  transition: border-color 0.15s;
}

.rf-textarea:focus { border-color: #e8a038; }

/* ── Error ── */
.rf-error {
  font-size: 12px;
  color: #c03020;
  background: #fff0ee;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #f0c0b8;
}

/* ── Footer ── */
.rf-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #ede5d0;
  flex-shrink: 0;
}

.rf-btn-cancel {
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
}

.rf-btn-cancel:hover { background: #e8dcc8; }

.rf-btn-confirm {
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  background: #3a7a3a;
  border: none;
  cursor: pointer;
  font-weight: 500;
  font-family: inherit;
  transition: background 0.15s;
}

.rf-btn-confirm:hover { background: #2a6a2a; }
</style>