<template>
  <div class="sm">
    <SettingsSidebar />

    <div class="sm__main">
      <AppTopbar :show-floor-tabs="false" title="員工管理" />

      <div class="sm__body">

        <!-- 左欄：員工列表 -->
        <div class="sm__left">
          <div class="sm__toolbar">
            <span class="sm__store-name">{{ authStore.store?.name }}</span>
            <button class="sm__btn-add" @click="openAdd">＋ 新增員工</button>
          </div>

          <div class="sm__list">
            <p v-if="listLoading" class="sm__empty">載入中...</p>
            <p v-else-if="!staffList.length" class="sm__empty">尚無員工資料</p>

            <button
              v-for="s in staffList"
              :key="s.id"
              class="sm__item"
              :class="{ 'sm__item--active': selected?.id === s.id, 'sm__item--inactive': !s.is_active }"
              @click="selected = s"
            >
              <div class="sm__item-avatar" :class="`sm__item-avatar--${s.role}`">
                {{ (s.name || s.username).charAt(0) }}
              </div>
              <div class="sm__item-info">
                <div class="sm__item-name">
                  {{ s.name || s.username }}
                  <span v-if="!s.is_active" class="sm__inactive-tag">停用</span>
                </div>
                <div class="sm__item-username">@{{ s.username }}</div>
              </div>
              <span class="sm__role-badge" :class="`sm__role-badge--${s.role}`">
                {{ ROLE_LABELS[s.role] }}
              </span>
            </button>
          </div>
        </div>

        <!-- 右欄：詳情 / 編輯 -->
        <div class="sm__right">
          <template v-if="selected">

            <!-- 員工資訊卡 -->
            <div class="sm__profile">
              <div class="sm__profile-avatar" :class="`sm__item-avatar--${selected.role}`">
                {{ (selected.name || selected.username).charAt(0) }}
              </div>
              <div class="sm__profile-info">
                <h2 class="sm__profile-name">{{ selected.name || selected.username }}</h2>
                <p class="sm__profile-username">@{{ selected.username }}</p>
                <p class="sm__profile-since">加入：{{ fmtDate(selected.created_at) }}</p>
              </div>
              <div class="sm__profile-right">
                <span class="sm__role-badge sm__role-badge--lg" :class="`sm__role-badge--${selected.role}`">
                  {{ ROLE_LABELS[selected.role] }}
                </span>
                <div class="sm__profile-actions">
                  <button class="sm__btn-edit" @click="openEdit(selected)">✏️ 編輯</button>
                  <button
                    v-if="authStore.isOwner && selected.id !== authStore.user?.id"
                    class="sm__btn-danger"
                    @click="confirmDelete(selected)"
                  >
                    🗑 刪除
                  </button>
                </div>
              </div>
            </div>

            <!-- 權限說明 -->
            <div class="sm__perm-card">
              <h3 class="sm__perm-title">權限範圍</h3>
              <div class="sm__perm-grid">
                <div v-for="perm in ROLE_PERMS[selected.role]" :key="perm.label" class="sm__perm-item">
                  <span class="sm__perm-icon">{{ perm.ok ? '✅' : '❌' }}</span>
                  <span class="sm__perm-label">{{ perm.label }}</span>
                </div>
              </div>
            </div>

          </template>

          <!-- 未選擇 -->
          <div v-else class="sm__placeholder">
            <p class="sm__placeholder-icon">👥</p>
            <p>選擇左側員工查看詳情</p>
            <p class="sm__placeholder-sub">老闆可在此管理所有員工帳號</p>
          </div>
        </div>

      </div>
    </div>

    <!-- 新增 / 編輯 Dialog -->
    <div v-if="showForm" class="sm__overlay" @click.self="showForm = false">
      <div class="sm__dialog">
        <h3 class="sm__dialog-title">{{ editTarget ? '編輯員工' : '新增員工' }}</h3>

        <div class="sm__form">
          <label class="sm__field">
            <span>顯示名稱</span>
            <input v-model="form.name" type="text" placeholder="王小明" />
          </label>
          <label class="sm__field">
            <span>帳號 <em>（不可改）</em></span>
            <input v-model="form.username" type="text" placeholder="ming" :disabled="!!editTarget" />
          </label>
          <label class="sm__field">
            <span>{{ editTarget ? '新密碼（留空不改）' : '密碼' }}</span>
            <input v-model="form.password" type="password" placeholder="••••••" />
          </label>
          <label class="sm__field">
            <span>角色</span>
            <select v-model="form.role">
              <option value="cashier">收銀員 — 點餐操作</option>
              <option value="manager">主管 — 含報表設定</option>
              <option value="owner">老闆 — 全部權限</option>
            </select>
          </label>
          <label v-if="editTarget" class="sm__field sm__field--toggle">
            <span>帳號狀態</span>
            <button
              class="sm__toggle"
              :class="{ 'sm__toggle--on': form.is_active }"
              @click="form.is_active = !form.is_active"
            >
              <span class="sm__toggle-knob" />
              <span class="sm__toggle-label">{{ form.is_active ? '啟用中' : '已停用' }}</span>
            </button>
          </label>
        </div>

        <p v-if="formError" class="sm__form-error">{{ formError }}</p>

        <div class="sm__dialog-footer">
          <button class="sm__btn-ghost" @click="showForm = false">取消</button>
          <button class="sm__btn-primary" :disabled="formLoading" @click="handleSave">
            {{ formLoading ? '儲存中...' : '儲存' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 刪除確認 -->
    <div v-if="deleteTarget" class="sm__overlay" @click.self="deleteTarget = null">
      <div class="sm__dialog sm__dialog--sm">
        <h3 class="sm__dialog-title sm__dialog-title--danger">刪除員工</h3>
        <p class="sm__dialog-body">確定刪除 <strong>{{ deleteTarget.name || deleteTarget.username }}</strong>？此操作無法復原。</p>
        <div class="sm__dialog-footer">
          <button class="sm__btn-ghost" @click="deleteTarget = null">取消</button>
          <button class="sm__btn-danger" :disabled="deleteLoading" @click="executeDelete">
            {{ deleteLoading ? '刪除中...' : '確認刪除' }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import { useAuthStore } from '@/stores/authStore.js'

const authStore = useAuthStore()

const ROLE_LABELS = { owner: '老闆', manager: '主管', cashier: '收銀員' }

const ROLE_PERMS = {
  owner: [
    { label: '點餐 / 外帶 / 外送', ok: true },
    { label: '訂位管理',           ok: true },
    { label: '會員管理',           ok: true },
    { label: '庫存管理',           ok: true },
    { label: '商品 / 設定管理',    ok: true },
    { label: '營運報表',           ok: true },
    { label: '員工管理',           ok: true },
  ],
  manager: [
    { label: '點餐 / 外帶 / 外送', ok: true },
    { label: '訂位管理',           ok: true },
    { label: '會員管理',           ok: true },
    { label: '庫存管理',           ok: true },
    { label: '商品 / 設定管理',    ok: true },
    { label: '營運報表',           ok: true },
    { label: '員工管理',           ok: false },
  ],
  cashier: [
    { label: '點餐 / 外帶 / 外送', ok: true },
    { label: '訂位管理',           ok: true },
    { label: '會員管理',           ok: false },
    { label: '庫存管理',           ok: false },
    { label: '商品 / 設定管理',    ok: false },
    { label: '營運報表',           ok: false },
    { label: '員工管理',           ok: false },
  ],
}

/* ── 列表 ── */
const staffList  = ref([])
const listLoading = ref(false)
const selected   = ref(null)

onMounted(async () => {
  listLoading.value = true
  staffList.value   = await authStore.fetchStaff()
  listLoading.value = false
})

/* ── 新增 / 編輯 ── */
const showForm    = ref(false)
const editTarget  = ref(null)
const formLoading = ref(false)
const formError   = ref('')
const form        = ref({ name: '', username: '', password: '', role: 'cashier', is_active: true })

function openAdd() {
  editTarget.value = null
  form.value = { name: '', username: '', password: '', role: 'cashier', is_active: true }
  formError.value = ''
  showForm.value = true
}

function openEdit(s) {
  editTarget.value = s
  form.value = { name: s.name, username: s.username, password: '', role: s.role, is_active: s.is_active }
  formError.value = ''
  showForm.value = true
}

async function handleSave() {
  formError.value = ''
  if (!form.value.name.trim())     { formError.value = '請填入顯示名稱'; return }
  if (!editTarget.value) {
    if (!form.value.username.trim()) { formError.value = '請填入帳號'; return }
    if (!form.value.password)        { formError.value = '請填入密碼'; return }
  }
  formLoading.value = true
  let result
  if (editTarget.value) {
    result = await authStore.updateStaff(editTarget.value.id, form.value)
  } else {
    result = await authStore.addStaff(form.value)
  }
  formLoading.value = false

  if (result === true) {
    showForm.value = false
    staffList.value = await authStore.fetchStaff()
    if (editTarget.value) {
      selected.value = staffList.value.find(s => s.id === editTarget.value.id) ?? null
    }
  } else {
    formError.value = result?.includes('unique') ? '此帳號已存在' : (result || '儲存失敗')
  }
}

/* ── 刪除 ── */
const deleteTarget  = ref(null)
const deleteLoading = ref(false)

function confirmDelete(s) { deleteTarget.value = s }

async function executeDelete() {
  deleteLoading.value = true
  const ok = await authStore.deleteStaff(deleteTarget.value.id)
  deleteLoading.value = false
  if (ok) {
    staffList.value = await authStore.fetchStaff()
    if (selected.value?.id === deleteTarget.value.id) selected.value = null
    deleteTarget.value = null
  }
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('zh-TW')
}
</script>

<style scoped>
.sm { width: 100%; height: 100%; display: flex; overflow: hidden; }
.sm__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.sm__body { flex: 1; display: flex; overflow: hidden; background: var(--color-bg-map); }

/* 左欄 */
.sm__left { width: 260px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #e8dcc8; background: #fff; }

.sm__toolbar { padding: 12px; border-bottom: 1px solid #ede5d0; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sm__store-name { font-size: 13px; font-weight: 600; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.sm__btn-add { padding: 6px 12px; border-radius: 8px; font-size: 12.5px; background: #e8a038; color: #fff; border: none; cursor: pointer; white-space: nowrap; flex-shrink: 0; }
.sm__btn-add:hover { background: #c88020; }

.sm__list { flex: 1; overflow-y: auto; }
.sm__empty { text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 13px; }

.sm__item {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-bottom: 1px solid #f5f0e8;
  text-align: left; background: none; cursor: pointer; transition: background .1s;
}
.sm__item:hover { background: #faf5ec; }
.sm__item--active { background: #fff8ee; border-left: 3px solid #e8a038; }
.sm__item--inactive { opacity: .5; }

.sm__item-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 15px; font-weight: 700; color: #fff; flex-shrink: 0;
}
.sm__item-avatar--owner   { background: #c0392b; }
.sm__item-avatar--manager { background: #2c7a4a; }
.sm__item-avatar--cashier { background: #e8a038; }
.sm__profile-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 22px; font-weight: 700; color: #fff; flex-shrink: 0;
}

.sm__item-info { flex: 1; min-width: 0; }
.sm__item-name { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); display: flex; align-items: center; gap: 5px; }
.sm__item-username { font-size: 11.5px; color: var(--color-text-muted); }
.sm__inactive-tag { font-size: 10.5px; background: #fee; color: #c0392b; border-radius: 4px; padding: 1px 5px; }

.sm__role-badge { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
.sm__role-badge--owner   { background: #fde2e2; color: #c0392b; }
.sm__role-badge--manager { background: #d8eed0; color: #2a6030; }
.sm__role-badge--cashier { background: #fde8c0; color: #8a6020; }
.sm__role-badge--lg { font-size: 13px; padding: 4px 14px; }

/* 右欄 */
.sm__right { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.sm__placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-muted); gap: 8px; }
.sm__placeholder-icon { font-size: 40px; }
.sm__placeholder-sub { font-size: 12.5px; }

/* Profile */
.sm__profile {
  background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md);
  padding: 16px; display: flex; align-items: flex-start; gap: 14px;
}
.sm__profile-info { flex: 1; }
.sm__profile-name { font-size: 18px; font-weight: 700; color: var(--color-text-primary); margin: 0 0 4px; }
.sm__profile-username { font-size: 13px; color: var(--color-text-muted); }
.sm__profile-since { font-size: 12px; color: var(--color-text-muted); margin-top: 2px; }
.sm__profile-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.sm__profile-actions { display: flex; gap: 6px; }
.sm__btn-edit { padding: 5px 12px; border-radius: 6px; font-size: 12px; background: #f0e8d8; color: #7a6850; border: 1px solid #c8b89a; cursor: pointer; }
.sm__btn-edit:hover { background: #e8dcc8; }
.sm__btn-danger { padding: 5px 12px; border-radius: 6px; font-size: 12px; background: #fde2e2; color: #c0392b; border: 1px solid #f0c0b8; cursor: pointer; }
.sm__btn-danger:hover { background: #fcc; }

/* 權限卡片 */
.sm__perm-card {
  background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md);
  padding: 14px 16px;
}
.sm__perm-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); margin: 0 0 12px; }
.sm__perm-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
.sm__perm-item { display: flex; align-items: center; gap: 7px; font-size: 13px; color: var(--color-text-secondary); }
.sm__perm-icon { font-size: 14px; }

/* Dialog / Form */
.sm__overlay { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.sm__dialog { background: #fff; border-radius: 14px; width: 360px; padding: 22px; box-shadow: 0 12px 40px rgba(0,0,0,.22); display: flex; flex-direction: column; gap: 14px; }
.sm__dialog--sm { width: 300px; }
.sm__dialog-title { font-size: 16px; font-weight: 700; color: var(--color-text-primary); margin: 0; }
.sm__dialog-title--danger { color: #c0392b; }
.sm__dialog-body { font-size: 13.5px; color: var(--color-text-secondary); line-height: 1.6; }
.sm__dialog-footer { display: flex; gap: 8px; margin-top: 4px; }

.sm__form { display: flex; flex-direction: column; gap: 10px; }
.sm__field { display: flex; flex-direction: column; gap: 4px; }
.sm__field--toggle { flex-direction: row; align-items: center; justify-content: space-between; }
.sm__field span { font-size: 12.5px; color: var(--color-text-muted); }
.sm__field em { font-style: normal; font-size: 11px; color: #bbb; }
.sm__field input, .sm__field select {
  padding: 8px 10px; border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13.5px; outline: none; background: #faf5ec; font-family: inherit;
}
.sm__field input:focus, .sm__field select:focus { border-color: #e8a038; }
.sm__field input:disabled { opacity: .5; cursor: not-allowed; background: #f0ece5; }

/* Toggle 開關 */
.sm__toggle {
  display: flex; align-items: center; gap: 8px;
  background: #e0d8c8; border: none; border-radius: 999px;
  padding: 4px 10px 4px 4px; cursor: pointer; transition: background .2s;
}
.sm__toggle--on { background: #5a9a40; }
.sm__toggle-knob {
  width: 20px; height: 20px; border-radius: 50%; background: #fff;
  box-shadow: 0 1px 4px rgba(0,0,0,.2); transition: transform .2s;
}
.sm__toggle--on .sm__toggle-knob { transform: translateX(0px); }
.sm__toggle-label { font-size: 12px; color: #fff; font-weight: 500; }
.sm__toggle:not(.sm__toggle--on) .sm__toggle-label { color: #888; }

.sm__form-error { font-size: 13px; color: #c0392b; background: #fde2e2; padding: 8px 12px; border-radius: 8px; }
.sm__btn-ghost { flex: 1; padding: 9px; border-radius: 9px; font-size: 13px; color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a; cursor: pointer; }
.sm__btn-ghost:hover { background: #e8dcc8; }
.sm__btn-primary { flex: 2; padding: 9px; border-radius: 9px; font-size: 14px; font-weight: 600; color: #fff; background: #e8a038; border: none; cursor: pointer; }
.sm__btn-primary:hover:not(:disabled) { background: #c88020; }
.sm__btn-primary:disabled { opacity: .5; cursor: not-allowed; }
</style>