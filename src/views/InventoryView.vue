<template>
  <div class="iv">
    <SettingsSidebar />

    <div class="iv__main">
      <AppTopbar :show-floor-tabs="false" title="庫存管理" />

      <div class="iv__body">

        <!-- ── 工具列 ── -->
        <div class="iv__toolbar">
          <input v-model="search" class="iv__search" type="text" placeholder="🔍 搜尋食材名稱..." />

          <select v-model="filterCategory" class="iv__select">
            <option value="">全部分類</option>
            <option v-for="c in store.categories" :key="c">{{ c }}</option>
          </select>

          <select v-model="filterStatus" class="iv__select">
            <option value="">全部狀態</option>
            <option value="normal">正常</option>
            <option value="low">低於警戒</option>
            <option value="empty">已用完</option>
            <option value="negative">負庫存</option>
          </select>

          <button class="iv__btn iv__btn--primary" @click="openAddModal">＋ 新增食材</button>
          <button class="iv__btn iv__btn--ghost" @click="exportCSV">匯出紀錄</button>
        </div>

        <!-- ── 統計卡片 ── -->
        <div class="iv__stats">
          <div class="iv__stat-card">
            <p class="iv__stat-label">總食材數</p>
            <p class="iv__stat-value">{{ store.ingredients.length }}</p>
          </div>
          <div class="iv__stat-card iv__stat-card--warn">
            <p class="iv__stat-label">低於警戒線</p>
            <p class="iv__stat-value">{{ lowCount }}</p>
          </div>
          <div class="iv__stat-card iv__stat-card--danger">
            <p class="iv__stat-label">負庫存</p>
            <p class="iv__stat-value">{{ negativeCount }}</p>
          </div>
          <div class="iv__stat-card">
            <p class="iv__stat-label">本月進貨金額</p>
            <p class="iv__stat-value">${{ fmtNum(monthlyRestockCost) }}</p>
          </div>
          <div class="iv__stat-card">
            <p class="iv__stat-label">本月盤點差異成本</p>
            <p class="iv__stat-value" :class="{ 'iv__stat-value--neg': monthlyStocktakeDiff < 0 }">
              {{ monthlyStocktakeDiff >= 0 ? '+' : '' }}${{ fmtNum(monthlyStocktakeDiff) }}
            </p>
          </div>
        </div>

        <!-- ── 表格 ── -->
        <div class="iv__table-wrap">
          <table class="iv__table">
            <thead>
              <tr>
                <th>食材名稱</th>
                <th>分類</th>
                <th class="iv__th--num">目前庫存</th>
                <th>單位</th>
                <th class="iv__th--num">警戒線</th>
                <th class="iv__th--num">平均成本</th>
                <th>狀態</th>
                <th>最近進貨</th>
                <th>供應商</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="store.loading">
                <td colspan="10" class="iv__td-empty">載入中...</td>
              </tr>
              <tr v-else-if="filtered.length === 0">
                <td colspan="10" class="iv__td-empty">沒有符合的食材</td>
              </tr>
              <tr v-for="ing in filtered" :key="ing.id" class="iv__tr">
                <td class="iv__td-name">{{ ing.name }}</td>
                <td><span class="iv__cat-badge">{{ ing.category }}</span></td>
                <td class="iv__td-num" :class="{ 'iv__td-negative': ing.current_stock < 0 }">
                  {{ fmtStock(ing.current_stock) }}
                </td>
                <td class="iv__td-unit">{{ ing.unit }}</td>
                <td class="iv__td-num">{{ fmtStock(ing.alert_threshold) }}</td>
                <td class="iv__td-num">${{ fmtNum(ing.avg_cost) }}/{{ ing.unit }}</td>
                <td>
                  <span class="iv__status-badge"
                    :style="{ color: store.stockStatus(ing).color, background: store.stockStatus(ing).bg }">
                    {{ store.stockStatus(ing).label }}
                  </span>
                </td>
                <td class="iv__td-date">{{ ing.last_restock_date || '—' }}</td>
                <td class="iv__td-supplier">{{ ing.supplier || '—' }}</td>
                <td>
                  <div class="iv__actions">
                    <button class="iv__action-btn iv__action-btn--green" @click="openRestockModal(ing)">入庫</button>
                    <button class="iv__action-btn iv__action-btn--blue"  @click="openStocktakeModal(ing)">盤點</button>
                    <button class="iv__action-btn"                        @click="openEditModal(ing)">編輯</button>
                    <button class="iv__action-btn iv__action-btn--ghost" @click="openLogsModal(ing)">紀錄</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ══════════════════════ 新增/編輯食材 Modal ══════════════════════ -->
    <Teleport to="body">
      <div v-if="showAddEdit" class="iv-modal-backdrop" @click.self="showAddEdit = false">
        <div class="iv-modal">
          <div class="iv-modal__header">
            <h2>{{ editTarget ? '編輯食材' : '新增食材' }}</h2>
            <button class="iv-modal__close" @click="showAddEdit = false">×</button>
          </div>
          <div class="iv-modal__body iv-modal__body--grid">
            <div class="iv-field">
              <label>食材名稱 <span class="req">*</span></label>
              <input v-model="form.name" class="iv-input" type="text" placeholder="例：雞胸肉" />
            </div>
            <div class="iv-field">
              <label>分類</label>
              <div class="iv-cat-row">
                <select v-model="form.category" class="iv-input">
                  <option v-for="c in store.categories" :key="c">{{ c }}</option>
                </select>
                <button type="button" class="iv-cat-add-btn" @click="showAddCat = !showAddCat">＋新增</button>
              </div>
              <div v-if="showAddCat" class="iv-cat-add-row">
                <input
                  v-model="newCatLabel" class="iv-input" type="text"
                  placeholder="新分類名稱" maxlength="10"
                  @keyup.enter="confirmAddCategory"
                />
                <button type="button" class="iv-cat-add-confirm" :disabled="!newCatLabel.trim() || addingCat" @click="confirmAddCategory">新增</button>
                <button type="button" class="iv-cat-add-cancel" @click="showAddCat = false; newCatLabel = ''">取消</button>
              </div>
            </div>
            <div class="iv-field">
              <label>單位</label>
              <div class="iv-cat-row">
                <select v-model="form.unit" class="iv-input">
                  <option v-for="u in store.units" :key="u">{{ u }}</option>
                </select>
                <button type="button" class="iv-cat-add-btn" @click="showAddUnit = !showAddUnit">＋新增</button>
              </div>
              <div v-if="showAddUnit" class="iv-cat-add-row">
                <input
                  v-model="newUnitLabel" class="iv-input" type="text"
                  placeholder="新單位名稱" maxlength="6"
                  @keyup.enter="confirmAddUnit"
                />
                <button type="button" class="iv-cat-add-confirm" :disabled="!newUnitLabel.trim() || addingUnit" @click="confirmAddUnit">新增</button>
                <button type="button" class="iv-cat-add-cancel" @click="showAddUnit = false; newUnitLabel = ''">取消</button>
              </div>
            </div>
            <div class="iv-field">
              <label>目前庫存</label>
              <input v-model.number="form.current_stock" class="iv-input" type="number" step="any" />
            </div>
            <div class="iv-field">
              <label>警戒線</label>
              <input v-model.number="form.alert_threshold" class="iv-input" type="number" step="any" />
            </div>
            <div class="iv-field">
              <label>平均成本（每{{ form.unit }}）</label>
              <input v-model.number="form.avg_cost" class="iv-input" type="number" step="any" />
            </div>
            <div class="iv-field">
              <label>供應商</label>
              <input v-model="form.supplier" class="iv-input" type="text" />
            </div>
            <div class="iv-field">
              <label>最近進貨日期</label>
              <input v-model="form.last_restock_date" class="iv-input" type="date" />
            </div>
          </div>
          <div class="iv-modal__footer">
            <button class="iv-btn iv-btn--ghost" @click="showAddEdit = false">取消</button>
            <button class="iv-btn iv-btn--primary" :disabled="!form.name.trim() || saving" @click="saveIngredient">
              {{ saving ? '儲存中...' : '儲存' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════ 入庫 Modal ══════════════════════ -->
    <Teleport to="body">
      <div v-if="showRestock" class="iv-modal-backdrop" @click.self="showRestock = false">
        <div class="iv-modal">
          <div class="iv-modal__header">
            <h2>入庫｜{{ restockTarget?.name }}</h2>
            <button class="iv-modal__close" @click="showRestock = false">×</button>
          </div>
          <div class="iv-modal__body iv-modal__body--grid">
            <div class="iv-field">
              <label>入庫數量 <span class="req">*</span></label>
              <div class="iv-input-unit">
                <input v-model.number="rForm.qty" class="iv-input" type="number" step="any" @input="onRestockQtyChange" />
                <span class="iv-unit-tag">{{ restockTarget?.unit }}</span>
              </div>
            </div>
            <div class="iv-field">
              <label>單價（每{{ restockTarget?.unit }}）</label>
              <input v-model.number="rForm.unitCost" class="iv-input" type="number" step="any" @input="onUnitCostChange" />
            </div>
            <div class="iv-field">
              <label>總金額</label>
              <input v-model.number="rForm.totalCost" class="iv-input" type="number" step="any" @input="onTotalCostChange" />
            </div>
            <div class="iv-field">
              <label>供應商</label>
              <input v-model="rForm.supplier" class="iv-input" type="text" :placeholder="restockTarget?.supplier || ''" />
            </div>
            <div class="iv-field">
              <label>入庫日期</label>
              <input v-model="rForm.date" class="iv-input" type="date" />
            </div>
            <div class="iv-field iv-field--full">
              <label>備註</label>
              <input v-model="rForm.note" class="iv-input" type="text" placeholder="選填..." />
            </div>
          </div>
          <div class="iv-modal__summary">
            入庫後庫存：{{ fmtStock((restockTarget?.current_stock ?? 0) + (rForm.qty || 0)) }} {{ restockTarget?.unit }}
          </div>
          <div class="iv-modal__footer">
            <button class="iv-btn iv-btn--ghost" @click="showRestock = false">取消</button>
            <button class="iv-btn iv-btn--primary" :disabled="!rForm.qty || saving" @click="saveRestock">
              {{ saving ? '處理中...' : '確認入庫' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════ 盤點 Modal ══════════════════════ -->
    <Teleport to="body">
      <div v-if="showStocktake" class="iv-modal-backdrop" @click.self="showStocktake = false">
        <div class="iv-modal">
          <div class="iv-modal__header">
            <h2>盤點｜{{ stocktakeTarget?.name }}</h2>
            <button class="iv-modal__close" @click="showStocktake = false">×</button>
          </div>
          <div class="iv-modal__body">
            <div class="iv-stocktake-row">
              <span class="iv-stocktake-label">系統理論庫存</span>
              <span class="iv-stocktake-val">{{ fmtStock(stocktakeTarget?.current_stock ?? 0) }} {{ stocktakeTarget?.unit }}</span>
            </div>
            <div class="iv-field iv-field--mt">
              <label>實際盤點數量 <span class="req">*</span></label>
              <div class="iv-input-unit">
                <input v-model.number="stForm.actualQty" class="iv-input" type="number" step="any" />
                <span class="iv-unit-tag">{{ stocktakeTarget?.unit }}</span>
              </div>
            </div>

            <div v-if="stForm.actualQty !== null && stForm.actualQty !== ''" class="iv-diff-row">
              <div class="iv-diff-item">
                <span class="iv-diff-label">差異數量</span>
                <span class="iv-diff-val" :class="stDiff < 0 ? 'neg' : 'pos'">
                  {{ stDiff >= 0 ? '+' : '' }}{{ fmtStock(stDiff) }} {{ stocktakeTarget?.unit }}
                </span>
              </div>
              <div class="iv-diff-item">
                <span class="iv-diff-label">差異成本</span>
                <span class="iv-diff-val" :class="stCostDiff < 0 ? 'neg' : 'pos'">
                  {{ stCostDiff >= 0 ? '+' : '' }}${{ fmtNum(stCostDiff) }}
                </span>
              </div>
            </div>

            <div class="iv-field iv-field--mt">
              <label>差異原因</label>
              <select v-model="stForm.reason" class="iv-input">
                <option value="">請選擇...</option>
                <option v-for="r in STOCKTAKE_REASONS" :key="r">{{ r }}</option>
              </select>
            </div>
            <div class="iv-field">
              <label>盤點人員</label>
              <input v-model="stForm.staff" class="iv-input" type="text" placeholder="請輸入人員帳號..." />
            </div>
            <div class="iv-field">
              <label>備註</label>
              <input v-model="stForm.note" class="iv-input" type="text" placeholder="選填..." />
            </div>
          </div>
          <div class="iv-modal__footer">
            <button class="iv-btn iv-btn--ghost" @click="showStocktake = false">取消</button>
            <button class="iv-btn iv-btn--primary"
              :disabled="stForm.actualQty === null || stForm.actualQty === '' || !stForm.staff.trim() || saving"
              @click="saveStocktake">
              {{ saving ? '處理中...' : '確認盤點' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══════════════════════ 紀錄 Modal ══════════════════════ -->
    <Teleport to="body">
      <div v-if="showLogs" class="iv-modal-backdrop" @click.self="showLogs = false">
        <div class="iv-modal iv-modal--wide">
          <div class="iv-modal__header">
            <h2>異動紀錄｜{{ logsTarget?.name }}</h2>
            <button class="iv-modal__close" @click="showLogs = false">×</button>
          </div>
          <div class="iv-logs-tabs">
            <button v-for="t in LOG_TABS" :key="t.key"
              class="iv-logs-tab" :class="{ active: logsTab === t.key }"
              @click="logsTab = t.key">{{ t.label }}</button>
          </div>
          <div class="iv-modal__body iv-modal__body--scroll">
            <p v-if="logsLoading" class="iv__td-empty">載入中...</p>
            <p v-else-if="filteredLogs.length === 0" class="iv__td-empty">無紀錄</p>
            <table v-else class="iv__table">
              <thead>
                <tr>
                  <th>日期時間</th>
                  <th>類型</th>
                  <th class="iv__th--num">變動前</th>
                  <th class="iv__th--num">變動量</th>
                  <th class="iv__th--num">變動後</th>
                  <th>關聯</th>
                  <th class="iv__th--num">成本影響</th>
                  <th>備註</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="log in filteredLogs" :key="log.id" class="iv__tr">
                  <td class="iv__td-date">{{ fmtDateTime(log.log_date) }}</td>
                  <td><span class="iv__log-type" :class="log.log_type">{{ logTypeLabel(log.log_type) }}</span></td>
                  <td class="iv__td-num">{{ fmtStock(log.qty_before) }}</td>
                  <td class="iv__td-num" :class="log.qty_change >= 0 ? 'iv__td-pos' : 'iv__td-negative'">
                    {{ log.qty_change >= 0 ? '+' : '' }}{{ fmtStock(log.qty_change) }}
                  </td>
                  <td class="iv__td-num">{{ fmtStock(log.qty_after) }}</td>
                  <td class="iv__td-supplier">{{ log.related_product || log.supplier || log.staff || '—' }}</td>
                  <td class="iv__td-num" :class="(log.total_cost ?? 0) < 0 ? 'iv__td-negative' : ''">
                    {{ (log.total_cost ?? 0) >= 0 ? '+' : '' }}${{ fmtNum(Math.abs(log.total_cost ?? 0)) }}
                  </td>
                  <td class="iv__td-supplier">{{ log.note || log.reason || '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="iv-modal__footer">
            <button class="iv-btn iv-btn--ghost" @click="showLogs = false">關閉</button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import SettingsSidebar  from '@/components/settings/SettingsSidebar.vue'
import AppTopbar        from '@/components/layout/AppTopbar.vue'
import { useInventoryStore } from '@/stores/inventoryStore.js'
import { supabase } from '@/lib/supabase.js'

const store = useInventoryStore()
onMounted(() => store.fetchIngredients())
onMounted(() => store.fetchCategories())
onMounted(() => store.fetchUnits())

const STOCKTAKE_REASONS = ['正常損耗', '忘記入庫', '忘記扣庫存', '報廢', '贈送', '其他']
const LOG_TABS = [
  { key: 'all',       label: '全部' },
  { key: 'restock',   label: '入庫' },
  { key: 'deduct',    label: '銷售扣庫' },
  { key: 'stocktake', label: '盤點' },
]

/* ── 篩選 ── */
const search         = ref('')
const filterCategory = ref('')
const filterStatus   = ref('')

const filtered = computed(() => {
  return store.ingredients.filter(ing => {
    if (search.value && !ing.name.includes(search.value)) return false
    if (filterCategory.value && ing.category !== filterCategory.value) return false
    if (filterStatus.value) {
      const s = store.stockStatus(ing).label
      const map = { normal: '正常', low: '低於警戒', empty: '已用完', negative: '負庫存' }
      if (s !== map[filterStatus.value]) return false
    }
    return true
  })
})

/* ── 統計 ── */
const lowCount      = computed(() => store.ingredients.filter(i => i.current_stock > 0 && i.current_stock <= i.alert_threshold).length)
const negativeCount = computed(() => store.ingredients.filter(i => i.current_stock < 0).length)

const monthlyRestockCost   = ref(0)
const monthlyStocktakeDiff = ref(0)

async function fetchMonthlyStats() {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const { data } = await supabase
    .from('ingredient_stock_logs')
    .select('log_type, total_cost')
    .gte('log_date', startOfMonth.toISOString())
  if (!data) return
  monthlyRestockCost.value   = data.filter(r => r.log_type === 'restock').reduce((s, r) => s + (r.total_cost ?? 0), 0)
  monthlyStocktakeDiff.value = data.filter(r => r.log_type === 'stocktake').reduce((s, r) => s + (r.total_cost ?? 0), 0)
}

onMounted(fetchMonthlyStats)

/* ── 新增/編輯 ── */
const showAddEdit = ref(false)
const editTarget  = ref(null)
const saving      = ref(false)
const form        = ref(defaultForm())

function defaultForm() {
  return {
    name: '', category: store.categories[0] ?? '其他', unit: store.units[0] ?? 'g',
    current_stock: 0, alert_threshold: 0, avg_cost: 0, supplier: '', last_restock_date: '',
  }
}

function openAddModal() {
  editTarget.value = null
  form.value = defaultForm()
  showAddCat.value = false
  newCatLabel.value = ''
  showAddUnit.value = false
  newUnitLabel.value = ''
  showAddEdit.value = true
}

/* ── 新增食材分類 ── */
const showAddCat  = ref(false)
const newCatLabel = ref('')
const addingCat   = ref(false)

async function confirmAddCategory() {
  const label = newCatLabel.value.trim()
  if (!label) return
  addingCat.value = true
  const ok = await store.addCategory(label)
  addingCat.value = false
  if (ok) {
    form.value.category = label
    newCatLabel.value = ''
    showAddCat.value = false
  }
}

/* ── 新增食材單位 ── */
const showAddUnit  = ref(false)
const newUnitLabel = ref('')
const addingUnit   = ref(false)

async function confirmAddUnit() {
  const label = newUnitLabel.value.trim()
  if (!label) return
  addingUnit.value = true
  const ok = await store.addUnit(label)
  addingUnit.value = false
  if (ok) {
    form.value.unit = label
    newUnitLabel.value = ''
    showAddUnit.value = false
  }
}

function openEditModal(ing) {
  editTarget.value = ing
  form.value = {
    name: ing.name, category: ing.category, unit: ing.unit,
    current_stock: ing.current_stock, alert_threshold: ing.alert_threshold,
    avg_cost: ing.avg_cost, supplier: ing.supplier || '', last_restock_date: ing.last_restock_date || '',
  }
  showAddCat.value = false
  newCatLabel.value = ''
  showAddUnit.value = false
  newUnitLabel.value = ''
  showAddEdit.value = true
}

async function saveIngredient() {
  if (!form.value.name.trim()) return
  saving.value = true
  if (editTarget.value) {
    await store.updateIngredient(editTarget.value.id, form.value)
  } else {
    await store.addIngredient(form.value)
  }
  saving.value = false
  showAddEdit.value = false
}

/* ── 入庫 ── */
const showRestock   = ref(false)
const restockTarget = ref(null)
const rForm         = ref({ qty: null, unitCost: null, totalCost: null, supplier: '', date: today(), note: '' })

function today() {
  return new Date().toISOString().slice(0, 10)
}

function openRestockModal(ing) {
  restockTarget.value = ing
  rForm.value = { qty: null, unitCost: ing.avg_cost || null, totalCost: null, supplier: ing.supplier || '', date: today(), note: '' }
  showRestock.value = true
}

function onRestockQtyChange()  { if (rForm.value.qty && rForm.value.unitCost) rForm.value.totalCost = +(rForm.value.qty * rForm.value.unitCost).toFixed(2) }
function onUnitCostChange()    { if (rForm.value.qty && rForm.value.unitCost) rForm.value.totalCost = +(rForm.value.qty * rForm.value.unitCost).toFixed(2) }
function onTotalCostChange()   { if (rForm.value.qty && rForm.value.totalCost) rForm.value.unitCost = +(rForm.value.totalCost / rForm.value.qty).toFixed(4) }

async function saveRestock() {
  if (!rForm.value.qty) return
  saving.value = true
  await store.restock(restockTarget.value.id, rForm.value)
  await fetchMonthlyStats()
  saving.value = false
  showRestock.value = false
}

/* ── 盤點 ── */
const showStocktake   = ref(false)
const stocktakeTarget = ref(null)
const stForm          = ref({ actualQty: null, staff: '', reason: '', note: '' })

const stDiff     = computed(() => (stForm.value.actualQty ?? 0) - (stocktakeTarget.value?.current_stock ?? 0))
const stCostDiff = computed(() => stDiff.value * (stocktakeTarget.value?.avg_cost ?? 0))

function openStocktakeModal(ing) {
  stocktakeTarget.value = ing
  stForm.value = { actualQty: null, staff: '', reason: '', note: '' }
  showStocktake.value = true
}

async function saveStocktake() {
  if (stForm.value.actualQty === null || !stForm.value.staff.trim()) return
  saving.value = true
  await store.stocktake(stocktakeTarget.value.id, stForm.value)
  await fetchMonthlyStats()
  saving.value = false
  showStocktake.value = false
}

/* ── 紀錄 ── */
const showLogs    = ref(false)
const logsTarget  = ref(null)
const logsTab     = ref('all')
const logsLoading = ref(false)
const logs        = ref([])

const filteredLogs = computed(() =>
  logsTab.value === 'all' ? logs.value : logs.value.filter(l => l.log_type === logsTab.value)
)

async function openLogsModal(ing) {
  logsTarget.value = ing
  logsTab.value    = 'all'
  showLogs.value   = true
  logsLoading.value = true
  const { data } = await supabase
    .from('ingredient_stock_logs')
    .select('*')
    .eq('ingredient_id', ing.id)
    .order('log_date', { ascending: false })
    .limit(200)
  logs.value = data ?? []
  logsLoading.value = false
}

function logTypeLabel(t) {
  return { restock: '入庫', deduct: '銷售扣庫', stocktake: '盤點' }[t] ?? t
}

/* ── 匯出 CSV ── */
function exportCSV() {
  const headers = ['食材名稱', '分類', '目前庫存', '單位', '警戒線', '平均成本', '狀態', '最近進貨', '供應商']
  const rows    = store.ingredients.map(i => [
    i.name, i.category, i.current_stock, i.unit, i.alert_threshold, i.avg_cost,
    store.stockStatus(i).label, i.last_restock_date ?? '', i.supplier ?? '',
  ])
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv)
  a.download = `庫存食材_${today()}.csv`
  a.click()
}

/* ── 格式化 ── */
function fmtNum(n)     { return Math.abs(n ?? 0) < 0.01 ? '0' : (n ?? 0).toLocaleString('zh-TW', { maximumFractionDigits: 2 }) }
function fmtStock(n)   { return n == null ? '—' : (+(n)).toLocaleString('zh-TW', { maximumFractionDigits: 2 }) }
function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\//g, '-')
}
</script>

<style scoped>
.iv { width: 100%; height: 100%; display: flex; overflow: hidden; }
.iv__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.iv__body { flex: 1; overflow-y: auto; padding: 14px 18px; background: var(--color-bg-map); display: flex; flex-direction: column; gap: 14px; }

/* ── 工具列 ── */
.iv__toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; flex-shrink: 0; }
.iv__search  { flex: 1; min-width: 180px; padding: 7px 10px; border: 1.5px solid #c8b89a; border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; }
.iv__search:focus { border-color: #e8a038; }
.iv__select  { padding: 7px 10px; border: 1.5px solid #c8b89a; border-radius: var(--radius-sm); font-size: 13px; background: #fff; outline: none; cursor: pointer; }
.iv__btn { padding: 7px 16px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 500; transition: all 0.12s; }
.iv__btn--primary { background: #e8a038; color: #fff; border: none; }
.iv__btn--primary:hover { background: #d08828; }
.iv__btn--ghost   { background: #fff; color: var(--color-text-secondary); border: 1px solid var(--color-border-btn); }
.iv__btn--ghost:hover { background: #f0e8d8; }

/* ── 統計卡片 ── */
.iv__stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; flex-shrink: 0; }
.iv__stat-card { background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); padding: 12px 14px; }
.iv__stat-card--warn   { border-left: 3px solid #e07020; }
.iv__stat-card--danger { border-left: 3px solid #c0392b; }
.iv__stat-label { font-size: 11.5px; color: var(--color-text-muted); margin-bottom: 4px; }
.iv__stat-value { font-size: 20px; font-weight: 700; color: var(--color-text-primary); }
.iv__stat-value--neg { color: #c0392b; }

/* ── 表格 ── */
.iv__table-wrap { flex: 1; background: #fff; border: 1px solid var(--color-border-card); border-radius: var(--radius-md); overflow: auto; min-height: 0; }
.iv__table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 900px; }
.iv__table th { text-align: left; padding: 10px 10px; font-size: 12px; font-weight: 500; color: var(--color-text-muted); background: #faf5ec; border-bottom: 1px solid #ede5d0; white-space: nowrap; position: sticky; top: 0; z-index: 1; }
.iv__th--num { text-align: right; }
.iv__tr:hover { background: #faf5ec; }
.iv__tr td { padding: 9px 10px; border-bottom: 1px solid #f5f0e8; color: var(--color-text-primary); vertical-align: middle; }
.iv__td-empty { text-align: center; padding: 40px; color: var(--color-text-muted); }
.iv__td-name { font-weight: 500; }
.iv__td-num { text-align: right; font-variant-numeric: tabular-nums; }
.iv__td-unit { color: var(--color-text-secondary); font-size: 12px; }
.iv__td-date { font-size: 12px; color: var(--color-text-secondary); white-space: nowrap; }
.iv__td-supplier { font-size: 12px; color: var(--color-text-secondary); max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iv__td-negative { color: #c0392b; font-weight: 600; }
.iv__td-pos      { color: #2f7a3d; }

.iv__cat-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: #f0e8d8; color: #7a6030;
}
.iv__status-badge {
  font-size: 11.5px; font-weight: 500; padding: 3px 10px; border-radius: 999px;
}
.iv__actions { display: flex; gap: 4px; }
.iv__action-btn {
  padding: 4px 9px; border-radius: var(--radius-sm); font-size: 11.5px;
  border: 1px solid #c8b89a; background: #f0e8d8; color: #5a4030;
  transition: background 0.12s; white-space: nowrap;
}
.iv__action-btn:hover       { background: #e8dcc8; }
.iv__action-btn--green { background: #e1f3e1; color: #2f7a3d; border-color: #a8d8a8; }
.iv__action-btn--green:hover { background: #c8e8c8; }
.iv__action-btn--blue  { background: #ddeeff; color: #1a5080; border-color: #88bbdd; }
.iv__action-btn--blue:hover  { background: #c4ddff; }
.iv__action-btn--ghost { background: #fff; color: var(--color-text-muted); border-color: #d8d0c0; }
.iv__action-btn--ghost:hover { background: #f5f0e8; }

/* ── Modal 共用 ── */
.iv-modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center; z-index: 9999;
}
.iv-modal {
  background: #fff; border-radius: 16px; width: 480px; max-height: 90vh;
  overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 12px 40px rgba(0,0,0,0.22);
}
.iv-modal--wide { width: 720px; }
.iv-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px 14px; border-bottom: 1px solid #ede5d0; flex-shrink: 0;
}
.iv-modal__header h2 { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.iv-modal__close {
  width: 26px; height: 26px; border-radius: 50%;
  background: #f0e8d8; font-size: 16px; color: #7a6850;
  display: flex; align-items: center; justify-content: center;
}
.iv-modal__close:hover { background: #e0d0b8; }
.iv-modal__body { padding: 16px 18px; overflow-y: auto; flex: 1; }
.iv-modal__body--grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.iv-modal__body--scroll { overflow-y: auto; max-height: 420px; padding: 0; }
.iv-modal__summary {
  padding: 10px 18px; background: #faf5ec;
  font-size: 12.5px; color: #7a6030; border-top: 1px solid #ede5d0; flex-shrink: 0;
}
.iv-modal__footer {
  display: flex; gap: 8px; justify-content: flex-end;
  padding: 12px 18px 16px; border-top: 1px solid #ede5d0; flex-shrink: 0;
}

.iv-field { display: flex; flex-direction: column; gap: 5px; }
.iv-field--full { grid-column: 1 / -1; }
.iv-field--mt { margin-top: 10px; }
.iv-field label { font-size: 12.5px; font-weight: 500; color: #5a4030; }

.iv-input {
  padding: 8px 10px; border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13.5px; color: #1a0800; background: #faf5ec;
  outline: none; font-family: inherit; transition: border-color 0.15s; width: 100%;
}
.iv-input:focus { border-color: #e8a038; }

.iv-input-unit { display: flex; gap: 6px; align-items: center; }
.iv-input-unit .iv-input { flex: 1; }
.iv-unit-tag { font-size: 13px; color: var(--color-text-muted); white-space: nowrap; }

.iv-btn { padding: 9px 22px; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 500; transition: all 0.12s; }
.iv-btn--primary { background: #e8a038; color: #fff; border: none; }
.iv-btn--primary:hover:not(:disabled) { background: #d08828; }
.iv-btn--primary:disabled { opacity: 0.5; }
.iv-btn--ghost { background: #fff; color: var(--color-text-secondary); border: 1px solid var(--color-border-btn); }
.iv-btn--ghost:hover { background: #f0e8d8; }

.req { color: #c0392b; }

/* ── 新增分類 ── */
.iv-cat-row { display: flex; gap: 6px; align-items: center; }
.iv-cat-row .iv-input { flex: 1; }
.iv-cat-add-btn {
  flex-shrink: 0; padding: 8px 10px; border-radius: 8px; font-size: 12px; font-weight: 500;
  color: #8a6020; background: #fde8c0; border: 1px solid #e8c888; white-space: nowrap;
}
.iv-cat-add-btn:hover { background: #f8dca0; }
.iv-cat-add-row { display: flex; gap: 6px; margin-top: 6px; }
.iv-cat-add-row .iv-input { flex: 1; padding: 6px 9px; font-size: 12.5px; }
.iv-cat-add-confirm {
  flex-shrink: 0; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
  color: #fff; background: #3a7a3a; border: none;
}
.iv-cat-add-confirm:disabled { opacity: 0.5; }
.iv-cat-add-cancel {
  flex-shrink: 0; padding: 6px 10px; border-radius: 8px; font-size: 12px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}

/* ── 盤點 ── */
.iv-stocktake-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #ede5d0; }
.iv-stocktake-label { font-size: 13px; color: var(--color-text-secondary); }
.iv-stocktake-val   { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }

.iv-diff-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0; padding: 10px; background: #faf5ec; border-radius: 8px; }
.iv-diff-item { display: flex; flex-direction: column; gap: 3px; }
.iv-diff-label { font-size: 11.5px; color: var(--color-text-muted); }
.iv-diff-val { font-size: 16px; font-weight: 700; }
.iv-diff-val.neg { color: #c0392b; }
.iv-diff-val.pos { color: #2f7a3d; }

/* ── 紀錄 Modal ── */
.iv-logs-tabs { display: flex; gap: 0; border-bottom: 1px solid #ede5d0; flex-shrink: 0; }
.iv-logs-tab {
  padding: 9px 18px; font-size: 13px; color: var(--color-text-secondary);
  border-bottom: 2px solid transparent; transition: all 0.12s;
}
.iv-logs-tab.active { color: #e8a038; border-bottom-color: #e8a038; font-weight: 500; }

.iv__log-type {
  font-size: 11px; font-weight: 500; padding: 2px 8px; border-radius: 999px;
}
.iv__log-type.restock   { background: #e1f3e1; color: #2f7a3d; }
.iv__log-type.deduct    { background: #fde2e2; color: #c0392b; }
.iv__log-type.stocktake { background: #ddeeff; color: #1a5080; }
</style>