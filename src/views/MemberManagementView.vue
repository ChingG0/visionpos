<template>
  <div class="mm">
    <SettingsSidebar />

    <div class="mm__main">
      <AppTopbar :show-floor-tabs="false" title="會員管理" />

      <div class="mm__body">

        <!-- 左欄：會員列表 -->
        <div class="mm__left">
          <div class="mm__search-wrap">
            <input v-model="search" class="mm__search" type="text" placeholder="🔍 搜尋姓名或電話..." />
            <span class="mm__total">共 {{ filteredMembers.length }} 位</span>
          </div>

          <div class="mm__member-list">
            <p v-if="memberStore.loading" class="mm__empty">載入中...</p>
            <p v-else-if="filteredMembers.length === 0" class="mm__empty">找不到會員</p>

            <button v-for="m in filteredMembers" :key="m.phone"
              class="mm__member-item" :class="{ 'mm__member-item--active': selected?.phone === m.phone }"
              @click="selectMember(m)">
              <div class="mm__member-avatar">{{ (m.name || m.phone).charAt(0) }}</div>
              <div class="mm__member-info">
                <div class="mm__member-name">
                  <span v-if="m.isBlacklisted" class="mm__bl-dot">⚠</span>
                  {{ m.name || '—' }}
                </div>
                <div class="mm__member-phone">{{ m.phone }}</div>
              </div>
              <div class="mm__member-stats">
                <div class="mm__member-count">{{ m.visitCount ?? 0 }} 次</div>
                <div class="mm__member-last">{{ m.lastVisit || '' }}</div>
              </div>
            </button>
          </div>
        </div>

        <!-- 右欄：會員詳情 + 消費紀錄 -->
        <div class="mm__right">
          <template v-if="selected">

            <!-- 會員資訊 -->
            <div class="mm__profile" :class="{ 'mm__profile--blacklisted': selected.isBlacklisted }">
              <div class="mm__profile-avatar" :class="{ 'mm__profile-avatar--bl': selected.isBlacklisted }">
                {{ (selected.name || selected.phone).charAt(0) }}
              </div>
              <div class="mm__profile-info">
                <div class="mm__profile-name-row">
                  <p class="mm__profile-name">{{ selected.name || '（無姓名）' }}</p>
                  <span v-if="selected.isBlacklisted" class="mm__bl-badge">⚠ 黑名單</span>
                </div>
                <p class="mm__profile-phone">📞 {{ selected.phone }}</p>
                <p v-if="selected.lastNote" class="mm__profile-note">💬 {{ selected.lastNote }}</p>
                <!-- 到達習慣 -->
                <p v-if="selected.avgArrivalDiff != null" class="mm__arrival-stat"
                  :class="selected.avgArrivalDiff > 10 ? 'mm__arrival-late' : selected.avgArrivalDiff < -5 ? 'mm__arrival-early' : ''">
                  {{ arrivalText(selected.avgArrivalDiff) }}
                </p>
                <p v-if="selected.isBlacklisted && selected.blacklistReason" class="mm__bl-reason">
                  原因：{{ selected.blacklistReason }}
                </p>
              </div>
              <div class="mm__profile-right">
                <div class="mm__profile-kpis">
                  <div class="mm__kpi">
                    <span class="mm__kpi-val">{{ selected.visitCount ?? 0 }}</span>
                    <span class="mm__kpi-label">消費次數</span>
                  </div>
                  <div class="mm__kpi">
                    <span class="mm__kpi-val">${{ fmtNum(totalSpent) }}</span>
                    <span class="mm__kpi-label">累計消費</span>
                  </div>
                  <div class="mm__kpi">
                    <span class="mm__kpi-val">${{ fmtNum(avgSpent) }}</span>
                    <span class="mm__kpi-label">平均客單</span>
                  </div>
                </div>
                <!-- 黑名單操作 -->
                <div class="mm__bl-actions">
                  <button v-if="!selected.isBlacklisted" class="mm__btn-blacklist" @click="openBlacklist">
                    ⚠ 加入黑名單
                  </button>
                  <button v-else class="mm__btn-unblacklist" @click="unblacklist">
                    取消黑名單
                  </button>
                </div>
              </div>
            </div>

            <!-- ── 到達習慣 ── -->
            <div class="mm__tags-section">
              <div class="mm__section-header">
                <p class="mm__section-title">到達習慣</p>
                <span v-if="selected.avgArrivalDiff != null" class="mm__arrival-avg"
                  :class="selected.avgArrivalDiff > 10 ? 'mm__arrival-late' : selected.avgArrivalDiff < -5 ? 'mm__arrival-early' : 'mm__arrival-ok'">
                  {{ arrivalText(selected.avgArrivalDiff) }}
                </span>
              </div>
              <div v-if="selected.arrivalHabits?.length" class="mm__arrival-list">
                <div v-for="(h, i) in [...(selected.arrivalHabits)].reverse().slice(0, 8)" :key="i" class="mm__arrival-row">
                  <span class="mm__arrival-date">{{ h.date }}</span>
                  <span class="mm__arrival-restime">預約 {{ h.reservationTime }}</span>
                  <span class="mm__arrival-diff"
                    :class="h.diffMinutes > 10 ? 'mm__arrival-late' : h.diffMinutes < -5 ? 'mm__arrival-early' : 'mm__arrival-ok'">
                    {{ h.diffMinutes > 0 ? `遲到 ${h.diffMinutes} 分` : h.diffMinutes < 0 ? `提早 ${Math.abs(h.diffMinutes)} 分` : '準時' }}
                  </span>
                </div>
              </div>
              <p v-else class="mm__arrival-empty">尚無到達紀錄（帶位後自動記錄）</p>
            </div>

            <!-- 常點標籤 -->
            <div v-if="topTags.length" class="mm__tags-section">
              <p class="mm__section-title">常用口味</p>
              <div class="mm__tag-list">
                <span v-for="t in topTags" :key="t.label" class="mm__tag-item"
                  :style="{ background: tagBg(t), color: tagColor(t) }">
                  {{ t.label }} <span class="mm__tag-count">×{{ t.count }}</span>
                </span>
              </div>
            </div>

            <!-- 消費紀錄 -->
            <div class="mm__orders-section">
              <p class="mm__section-title">消費紀錄</p>
              <p v-if="ordersLoading" class="mm__empty">載入中...</p>
              <p v-else-if="orders.length === 0" class="mm__empty">尚無消費紀錄</p>
              <div v-else class="mm__order-list">
                <div v-for="o in orders" :key="o.id" class="mm__order-card">
                  <div class="mm__order-header">
                    <span class="mm__order-date">{{ fmtDateTime(o.completed_at) }}</span>
                    <span class="mm__order-type-badge" :class="`mm__order-type-badge--${o.orderType}`">
                      {{ o.orderType === 'takeout' ? '外帶' : '外送' }}
                    </span>
                    <span class="mm__order-total">${{ o.total }}</span>
                  </div>
                  <!-- 品項 -->
                  <div class="mm__order-items">
                    <span v-for="(item, i) in (o.items ?? []).slice(0,4)" :key="i" class="mm__order-item">
                      {{ item.name }}×{{ item.qty }}
                    </span>
                    <span v-if="(o.items?.length ?? 0) > 4" class="mm__order-item mm__order-item--more">
                      +{{ (o.items?.length ?? 0) - 4 }} 項
                    </span>
                  </div>
                  <!-- 標籤 -->
                  <div v-if="o.tags?.length" class="mm__order-tags">
                    <span v-for="t in o.tags" :key="t.id || t.label" class="mm__order-tag">
                      {{ t.label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </template>

          <!-- 未選擇 -->
          <div v-else class="mm__placeholder">
            <p class="mm__placeholder-icon">👤</p>
            <p>選擇左側會員查看詳情</p>
          </div>
        </div>

      </div>
    </div>

    <!-- 黑名單確認 Dialog -->
    <div v-if="showBlDialog" class="mm__overlay" @click.self="showBlDialog = false">
      <div class="mm__dialog">
        <p class="mm__dialog-title">⚠ 加入黑名單</p>
        <p class="mm__dialog-sub">{{ selected?.name }} {{ selected?.phone }}</p>
        <div class="mm__dialog-field">
          <label>原因 <span style="color:#c0392b">*</span></label>
          <input v-model="blReason" class="mm__dialog-input" type="text" placeholder="例：多次爽約、言行不當..." />
        </div>
        <div class="mm__dialog-footer">
          <button class="mm__btn-ghost" @click="showBlDialog = false">取消</button>
          <button class="mm__btn-danger" :disabled="!blReason.trim() || blLoading" @click="confirmBlacklist">
            {{ blLoading ? '處理中...' : '確認加入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import SettingsSidebar    from '@/components/settings/SettingsSidebar.vue'
import AppTopbar          from '@/components/layout/AppTopbar.vue'
import { useMemberStore } from '@/stores/memberStore.js'
import { TAG_COLOR_MAP }  from '@/constants/tagColors.js'
import { supabase }       from '@/lib/supabase.js'

const memberStore = useMemberStore()
memberStore.init()

const search   = ref('')
const selected = ref(null)

/* ── 搜尋篩選 ── */
const filteredMembers = computed(() => {
  const q = search.value.toLowerCase()
  return memberStore.members
    .filter(m => !q || m.name?.toLowerCase().includes(q) || m.phone?.includes(q))
    .sort((a, b) => (b.lastVisit ?? '').localeCompare(a.lastVisit ?? ''))
})

/* ── 選擇會員 → 載入消費紀錄 ── */
const orders        = ref([])
const ordersLoading = ref(false)

async function selectMember(m) {
  selected.value    = m
  orders.value      = []
  ordersLoading.value = true

  const clean = m.phone.replace(/\D/g, '')
  const [t, d] = await Promise.all([
    supabase.from('takeout_orders')
      .select('id, items, tags, total, completed_at, status')
      .eq('customer_phone', clean)
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(50),
    supabase.from('delivery_orders')
      .select('id, items, tags, total, completed_at, status')
      .eq('customer_phone', clean)
      .eq('status', 'done')
      .order('completed_at', { ascending: false })
      .limit(50),
  ])

  const takeoutOrders  = (t.data ?? []).map(o => ({ ...o, orderType: 'takeout'  }))
  const deliveryOrders = (d.data ?? []).map(o => ({ ...o, orderType: 'delivery' }))
  orders.value = [...takeoutOrders, ...deliveryOrders]
    .sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))

  ordersLoading.value = false
}

/* ── 統計 ── */
const totalSpent = computed(() => orders.value.reduce((s, o) => s + (o.total ?? 0), 0))
const avgSpent   = computed(() => orders.value.length ? Math.round(totalSpent.value / orders.value.length) : 0)

/* 常用標籤排行 */
const topTags = computed(() => {
  const map = {}
  for (const o of orders.value) {
    for (const tag of (o.tags ?? [])) {
      const key = tag.label ?? tag.id
      if (!map[key]) map[key] = { label: tag.label, color: tag.color, count: 0 }
      map[key].count++
    }
  }
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 8)
})

function tagBg(t)    { return TAG_COLOR_MAP[t.color]?.bg    ?? '#f0f0f0' }
function tagColor(t) { return TAG_COLOR_MAP[t.color]?.text  ?? '#555555' }

/* ── 黑名單 ── */
const showBlDialog = ref(false)
const blReason     = ref('')
const blLoading    = ref(false)

function openBlacklist() { blReason.value = ''; showBlDialog.value = true }

async function confirmBlacklist() {
  if (!selected.value || !blReason.value.trim()) return
  blLoading.value = true
  await memberStore.setBlacklist(selected.value.phone, true, blReason.value.trim())
  showBlDialog.value = false
  blLoading.value = false
}

async function unblacklist() {
  if (!selected.value) return
  await memberStore.setBlacklist(selected.value.phone, false, '')
}

/* ── 到達習慣文字 ── */
function arrivalText(avgDiff) {
  if (avgDiff == null) return ''
  const abs = Math.abs(Math.round(avgDiff))
  if (avgDiff < -5)  return `⏰ 通常提早 ${abs} 分鐘到達`
  if (avgDiff > 10)  return `⌛ 通常遲到 ${abs} 分鐘`
  return `⏱ 到達時間準時`
}
function fmtNum(n) { return (n ?? 0).toLocaleString('zh-TW') }
function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).replace(/\//g, '-')
}
</script>

<style scoped>
.mm { width: 100%; height: 100%; display: flex; overflow: hidden; }
.mm__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.mm__body { flex: 1; display: flex; overflow: hidden; background: var(--color-bg-map); }

/* 左欄 */
.mm__left { width: 280px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #e8dcc8; background: #fff; }
.mm__search-wrap { padding: 12px; border-bottom: 1px solid #ede5d0; display: flex; align-items: center; gap: 8px; }
.mm__search { flex: 1; padding: 7px 10px; border: 1.5px solid #c8b89a; border-radius: var(--radius-sm); font-size: 12.5px; outline: none; background: #faf5ec; }
.mm__search:focus { border-color: #e8a038; }
.mm__total { font-size: 11.5px; color: var(--color-text-muted); white-space: nowrap; }
.mm__member-list { flex: 1; overflow-y: auto; }
.mm__empty { text-align: center; padding: 24px; color: var(--color-text-muted); font-size: 13px; }

.mm__member-item {
  width: 100%; display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-bottom: 1px solid #f5f0e8;
  text-align: left; background: none; transition: background 0.1s;
}
.mm__member-item:hover { background: #faf5ec; }
.mm__member-item--active { background: #fff8ee; border-left: 3px solid #e8a038; }

.mm__member-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  background: #e8a038; color: #fff; font-size: 15px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.mm__member-info { flex: 1; min-width: 0; }
.mm__member-name  { font-size: 13.5px; font-weight: 500; color: var(--color-text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mm__member-phone { font-size: 11.5px; color: var(--color-text-muted); }
.mm__member-stats { text-align: right; flex-shrink: 0; }
.mm__member-count { font-size: 12px; font-weight: 600; color: #c08020; }
.mm__member-last  { font-size: 11px; color: var(--color-text-muted); }

/* 右欄 */
.mm__right { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 16px; }
.mm__placeholder { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--color-text-muted); gap: 8px; }
.mm__placeholder-icon { font-size: 40px; }

/* 個人資料 */
.mm__profile {
  background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md);
  padding: 16px; display: flex; align-items: flex-start; gap: 14px;
}
.mm__profile--blacklisted { border-color: #f0c0b8; background: #fff8f8; }
.mm__profile-avatar {
  width: 52px; height: 52px; border-radius: 50%;
  background: #e8a038; color: #fff; font-size: 22px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.mm__profile-avatar--bl { background: #c0392b; }
.mm__profile-info { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.mm__profile-name-row { display: flex; align-items: center; gap: 8px; }
.mm__profile-name  { font-size: 16px; font-weight: 700; color: var(--color-text-primary); }
.mm__profile-phone { font-size: 13px; color: var(--color-text-secondary); }
.mm__profile-note  { font-size: 12px; color: var(--color-text-muted); }

.mm__bl-badge { font-size: 11px; font-weight: 600; background: #fde2e2; color: #c0392b; padding: 2px 9px; border-radius: 999px; }
.mm__bl-reason { font-size: 12px; color: #c0392b; }
.mm__bl-dot { color: #c0392b; font-size: 13px; }

.mm__arrival-late  { color: #c0392b; }
.mm__arrival-early { color: #2f7a3d; }
.mm__arrival-ok    { color: var(--color-text-secondary); }

.mm__section-header { display: flex; align-items: center; justify-content: space-between; }
.mm__arrival-avg    { font-size: 12.5px; font-weight: 500; }
.mm__arrival-empty  { font-size: 12.5px; color: var(--color-text-muted); }

.mm__arrival-list { display: flex; flex-direction: column; gap: 4px; }
.mm__arrival-row  {
  display: grid; grid-template-columns: 90px 90px 1fr;
  font-size: 12.5px; padding: 4px 0; border-bottom: 1px solid #f5f0e8; align-items: center;
}
.mm__arrival-date    { color: var(--color-text-muted); }
.mm__arrival-restime { color: var(--color-text-secondary); }
.mm__arrival-diff    { text-align: right; font-weight: 500; }

.mm__profile-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.mm__profile-kpis  { display: flex; gap: 16px; }
.mm__kpi { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.mm__kpi-val   { font-size: 17px; font-weight: 700; color: var(--color-text-primary); }
.mm__kpi-label { font-size: 11px; color: var(--color-text-muted); }

.mm__bl-actions { display: flex; gap: 6px; }
.mm__btn-blacklist  { padding: 5px 12px; border-radius: 6px; font-size: 12px; background: #fff0ee; color: #c0392b; border: 1px solid #f0c0b8; }
.mm__btn-blacklist:hover { background: #fde2e2; }
.mm__btn-unblacklist { padding: 5px 12px; border-radius: 6px; font-size: 12px; background: #f0e8d8; color: #7a6850; border: 1px solid #c8b89a; }
.mm__btn-unblacklist:hover { background: #e8dcc8; }

/* 標籤區 */
.mm__tags-section, .mm__orders-section { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
.mm__section-title { font-size: 13px; font-weight: 600; color: var(--color-text-primary); }
.mm__tag-list { display: flex; flex-wrap: wrap; gap: 6px; }
.mm__tag-item { font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 999px; display: flex; align-items: center; gap: 4px; }
.mm__tag-count { font-size: 11px; opacity: 0.75; }

/* 消費紀錄 */
.mm__order-list { display: flex; flex-direction: column; gap: 8px; }
.mm__order-card { padding: 10px 12px; background: #faf5ec; border-radius: 8px; border: 1px solid #ede5d0; display: flex; flex-direction: column; gap: 5px; }
.mm__order-header { display: flex; align-items: center; gap: 8px; }
.mm__order-date  { font-size: 12px; color: var(--color-text-muted); flex: 1; }
.mm__order-total { font-size: 14px; font-weight: 700; color: var(--color-text-primary); }

.mm__order-type-badge { font-size: 11px; padding: 1px 7px; border-radius: 999px; font-weight: 500; }
.mm__order-type-badge--takeout  { background: #fde8c0; color: #8a6020; }
.mm__order-type-badge--delivery { background: #d0f0e0; color: #1a6035; }

.mm__order-items { display: flex; flex-wrap: wrap; gap: 4px; }
.mm__order-item { font-size: 11.5px; color: var(--color-text-secondary); background: #fff; padding: 2px 7px; border-radius: 4px; border: 1px solid #e8e0d0; }
.mm__order-item--more { color: var(--color-text-muted); }
.mm__order-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.mm__order-tag  { font-size: 11px; background: #f0e8d8; color: #7a6030; padding: 1px 8px; border-radius: 999px; }

/* 黑名單 Dialog */
.mm__overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; }
.mm__dialog { background: #fff; border-radius: 14px; width: 320px; padding: 20px; box-shadow: 0 12px 40px rgba(0,0,0,0.22); display: flex; flex-direction: column; gap: 12px; }
.mm__dialog-title { font-size: 15px; font-weight: 700; color: #c0392b; }
.mm__dialog-sub   { font-size: 13px; color: var(--color-text-secondary); margin-top: -6px; }
.mm__dialog-field { display: flex; flex-direction: column; gap: 5px; }
.mm__dialog-field label { font-size: 12.5px; font-weight: 500; color: #5a4030; }
.mm__dialog-input { padding: 8px 10px; border: 1.5px solid #c8b89a; border-radius: 8px; font-size: 13px; background: #faf5ec; outline: none; font-family: inherit; }
.mm__dialog-input:focus { border-color: #c0392b; }
.mm__dialog-footer { display: flex; gap: 8px; }
.mm__btn-ghost  { flex: 1; padding: 9px; border-radius: 9px; font-size: 13px; color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a; }
.mm__btn-ghost:hover { background: #e8dcc8; }
.mm__btn-danger { flex: 2; padding: 9px; border-radius: 9px; font-size: 14px; font-weight: 600; color: #fff; background: #c0392b; border: none; }
.mm__btn-danger:hover:not(:disabled) { background: #a93226; }
.mm__btn-danger:disabled { opacity: 0.5; }
</style>