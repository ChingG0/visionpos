<template>
  <section class="floor-map">

    <!-- Header: legend (normal) / edit bar (edit mode) -->
    <div v-if="isEditing" class="floor-map__edit-bar">
      <span class="floor-map__edit-hint">{{ editHint }}</span>
      <button class="floor-map__finish-btn" @click="finishEditing">✓ 完成編輯</button>
    </div>
    <div v-else class="floor-map__legend">
      <span v-for="leg in LEGEND" :key="leg.label" class="floor-map__legend-item">
        <span class="floor-map__legend-dot" :style="{ background: leg.color }"/>
        {{ leg.label }}
      </span>
    </div>

    <!-- 選桌模式橫幅 -->
    <div v-if="arrangingId != null && !isEditing" class="floor-map__arrange-bar">
      <span class="floor-map__arrange-hint">
        {{ selectedArrangeItems.length > 0 ? `已選 ${selectedArrangeItems.length} 個桌椅` : '點擊地圖選取桌椅' }}
      </span>
      <div class="floor-map__arrange-actions">
        <button class="floor-map__arrange-cancel" @click="emit('cancel-arrange')">取消</button>
        <button
          class="floor-map__arrange-confirm"
          :disabled="selectedArrangeItems.length === 0"
          @click="confirmArrange"
        >確認入座</button>
      </div>
    </div>

    <!-- SVG Canvas -->
    <svg
      v-if="!isLayoutLoading"
      ref="svgRef"
      class="floor-map__svg"
      viewBox="0 0 285 330"
      preserveAspectRatio="xMidYMid meet"
      :style="{ cursor: arrangingId != null && !isEditing ? 'crosshair' : isAddMode ? 'crosshair' : 'default' }"
      @pointerdown="onCanvasDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <g v-for="item in floorItems" :key="item.id">
        <g :transform="`translate(${item.x},${item.y})`">

          <!-- Shape group: rotate + scale (shapes only, NO text) -->
          <g
            :transform="`rotate(${item.rotation}) scale(${item.scaleX}, ${item.scaleY})`"
            :style="{ cursor: isEditing ? 'move' : 'pointer' }"
            @pointerdown.stop="onItemDown(item, $event)"
          >
            <!-- Chair -->
            <template v-if="item.type === 'chair'">
              <rect x="-14" y="-14" width="28" height="28" rx="5"
                    :fill="statusColor(item.status)"/>
            </template>

            <!-- Square table -->
            <template v-else-if="item.type === 'square-table'">
              <rect x="-28" y="-22" width="56" height="44" rx="6"
                    fill="#d8cdb5" stroke="#bfaf95" stroke-width="0.8"/>
            </template>

            <!-- Round table -->
            <template v-else-if="item.type === 'round-table'">
              <circle cx="0" cy="0" r="24" fill="#d8cdb5" stroke="#bfaf95" stroke-width="0.8"/>
            </template>
          </g>

          <!-- Text: rotate only (no scale)
               直式時用 writing-mode:vertical-rl，字體不旋轉，由上到下排列 -->
          <text
            :transform="`rotate(${item.rotation})`"
            x="0" :y="isTextVertical(item) ? 0 : 4"
            text-anchor="middle"
            :font-size="textSize(item)"
            :fill="item.type === 'chair' ? '#fff' : '#5a4030'"
            font-family="Noto Sans TC,PingFang TC,sans-serif"
            :style="{
              pointerEvents:   'none',
              userSelect:      'none',
              writingMode:     isTextVertical(item) ? 'vertical-rl' : 'horizontal-tb',
              textOrientation: isTextVertical(item) ? 'upright'     : 'mixed',
            }"
          >{{ item.name }}</text>

          <!-- 選桌模式：選取高亮 -->
          <template v-if="arrangingId != null && !isEditing && selectedArrangeItems.includes(item.id)">
            <g :transform="`rotate(${item.rotation})`">
              <rect v-if="item.type !== 'round-table'"
                    :x="-hw(item)-5" :y="-hh(item)-5"
                    :width="hw(item)*2+10" :height="hh(item)*2+10"
                    rx="8" fill="rgba(46,120,46,0.12)"
                    stroke="#3a8a3a" stroke-width="2"/>
              <circle v-else cx="0" cy="0" :r="hh(item)+6"
                      fill="rgba(46,120,46,0.12)" stroke="#3a8a3a" stroke-width="2"/>
              <!-- ✓ 勾選圓點 -->
              <circle cx="0" :cy="-hh(item)-13" r="8"
                      fill="#3a8a3a" stroke="#fff" stroke-width="1.5"
                      style="pointer-events:none"/>
              <text x="0" :y="-hh(item)-9" text-anchor="middle"
                    font-size="11" fill="#fff"
                    style="pointer-events:none;user-select:none">✓</text>
            </g>
          </template>

          <!-- Edit handles: only rotate applied (not scale → fixed visual size) -->
          <template v-if="isEditing && selectedId === item.id">
            <g :transform="`rotate(${item.rotation})`">

              <!-- Dashed selection outline -->
              <rect v-if="item.type !== 'round-table'"
                    :x="-hw(item)-5" :y="-hh(item)-5"
                    :width="hw(item)*2+10" :height="hh(item)*2+10"
                    rx="8" fill="none"
                    stroke="#e8a038" stroke-width="1.5" stroke-dasharray="5 3"/>
              <circle v-else cx="0" cy="0" :r="hh(item)+6"
                      fill="none" stroke="#e8a038" stroke-width="1.5" stroke-dasharray="5 3"/>

              <!-- ↻ Rotate (top center, orange) -->
              <circle cx="0" :cy="-hh(item)-16" r="9"
                      fill="#e8a038" stroke="#fff" stroke-width="1.5"
                      style="cursor:crosshair"
                      @pointerdown.stop="onRotateDown(item, $event)"/>
              <text x="0" :y="-hh(item)-12" text-anchor="middle"
                    font-size="11" fill="#fff"
                    style="pointer-events:none;user-select:none">↻</text>

              <!-- × Delete (top-right, red) -->
              <circle :cx="hw(item)+14" :cy="-hh(item)-14" r="9"
                      fill="#c03020" stroke="#fff" stroke-width="1.5"
                      style="cursor:pointer"
                      @pointerdown.stop="deleteItem(item.id)"/>
              <text :x="hw(item)+14" :y="-hh(item)-10" text-anchor="middle"
                    font-size="14" fill="#fff"
                    style="pointer-events:none;user-select:none">×</text>

              <!-- ⤡ Scale (bottom-right, blue) -->
              <circle :cx="hw(item)+14" :cy="hh(item)+14" r="9"
                      fill="#4a8adc" stroke="#fff" stroke-width="1.5"
                      style="cursor:nwse-resize"
                      @pointerdown.stop="onScaleDown(item, $event)"/>
              <text :x="hw(item)+14" :y="hh(item)+18" text-anchor="middle"
                    font-size="11" fill="#fff"
                    style="pointer-events:none;user-select:none">⤡</text>

              <!-- ✎ Rename (bottom-left, green) -->
              <circle :cx="-hw(item)-14" :cy="hh(item)+14" r="9"
                      fill="#5a8a3a" stroke="#fff" stroke-width="1.5"
                      style="cursor:pointer"
                      @pointerdown.stop="openNameModal(item.id, item.type)"/>
              <text :x="-hw(item)-14" :y="hh(item)+18" text-anchor="middle"
                    font-size="11" fill="#fff"
                    style="pointer-events:none;user-select:none">✎</text>

              <!-- ⎘ Copy (top-left, teal) -->
              <circle :cx="-hw(item)-14" :cy="-hh(item)-14" r="9"
                      fill="#2a8a8a" stroke="#fff" stroke-width="1.5"
                      style="cursor:pointer"
                      @pointerdown.stop="copyItem(item.id)"/>
              <text :x="-hw(item)-14" :y="-hh(item)-10" text-anchor="middle"
                    font-size="12" fill="#fff"
                    style="pointer-events:none;user-select:none">⎘</text>

            </g>
          </template>

        </g>
      </g>
    </svg>

    <div v-else class="floor-map__svg-loading">載入座位圖中...</div>

    <!-- Normal mode: single edit button -->
    <div v-if="!isEditing" class="floor-map__actions">
      <button class="floor-map__action-btn" @click="enterEditing">編輯桌位</button>
    </div>

    <!-- Edit mode: 4-option toolbar (bottom-right) -->
    <div v-else class="floor-map__toolbar">
      <button
        v-for="t in TOOLS" :key="t.id"
        class="floor-map__tool-btn"
        :class="{ 'floor-map__tool-btn--active': activeTool === t.id }"
        @click="setTool(t.id)"
      >{{ t.label }}</button>
    </div>

    <!-- Name Modal: Teleport to body to escape overflow:hidden -->
    <Teleport to="body">
      <div v-if="showNameModal" class="nm-backdrop" @click.self="cancelName">
        <div class="nm-box" role="dialog" aria-modal="true">
          <p class="nm-title">{{ pendingType === 'chair' ? '座位命名' : '桌號命名' }}</p>
          <p class="nm-hint">小店→座位名（A1、B2）・大店→桌號（1號桌、VIP桌）</p>
          <input
            ref="nameInputRef"
            v-model="pendingName"
            class="nm-input"
            :placeholder="pendingType === 'chair' ? '例：A1、B2' : '例：1號桌、VIP桌'"
            maxlength="8"
            @keydown.enter="confirmName"
            @keydown.esc="cancelName"
          />
          <p v-if="nameError" class="nm-error">{{ nameError }}</p>
          <div class="nm-footer">
            <button class="nm-cancel" @click="cancelName">取消</button>
            <button class="nm-confirm" @click="confirmName">確認</button>
          </div>
        </div>
      </div>
    </Teleport>

  </section>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { supabase } from '@/lib/supabase.js'

async function loadLayout(floor) {
  const { data, error } = await supabase
    .from('floor_layouts')
    .select('items')
    .eq('floor_id', floor)
    .maybeSingle()
  if (error) { console.error('[FloorMap] 讀取座位圖失敗', error); return null }
  return data?.items ?? null
}

async function saveLayout(floor, items) {
  const { error } = await supabase
    .from('floor_layouts')
    .upsert({ floor_id: floor, items, updated_at: new Date().toISOString() })
  if (error) console.error('[FloorMap] 儲存座位圖失敗', error)
}

const props = defineProps({
  arrangingId: { type: Number, default: null },
})

const emit = defineEmits(['finish-editing', 'seat-assigned', 'cancel-arrange'])

const svgRef      = ref(null)
const nameInputRef = ref(null)

/* ── Constants ── */
const LEGEND = [
  { label: '未點餐', color: 'var(--color-seat-empty)' },
  { label: '已點餐', color: 'var(--color-seat-ordered)' },
  { label: '已結帳', color: 'var(--color-seat-paid)' },
]

const TOOLS = [
  { id: 'chair',        label: '新增椅子' },
  { id: 'square-table', label: '新增方桌' },
  { id: 'round-table',  label: '新增圓桌' },
  { id: 'delete',       label: '刪除選取' },
]

const STATUS_COLORS = {
  empty:   '#b0a890',
  ordered: '#c87d10',
  paid:    '#358050',
}

// Base half-width / half-height of each shape (before scale)
const BASE_HW = { chair: 14, 'square-table': 28, 'round-table': 24 }
const BASE_HH = { chair: 14, 'square-table': 22, 'round-table': 24 }

/* ── Helpers ── */
function statusColor(s) { return STATUS_COLORS[s] ?? STATUS_COLORS.empty }

// Scaled half-dimensions — used for handle positioning
function hw(item) { return (BASE_HW[item.type] ?? 18) * item.scaleX }
function hh(item) { return (BASE_HH[item.type] ?? 18) * item.scaleY }

// 文字大小：以最小維度縮放，最小值各型別獨立（椅 5.3 / 桌 6）
function textSize(item) {
  const base    = item.type === 'chair' ? 6 : 9
  const minSize = item.type === 'chair' ? 5.3 : 6
  return Math.max(minSize, +(base * Math.min(item.scaleX, item.scaleY)).toFixed(1))
}

// 直式判斷：用 rawSize（未鎖底的原始值）判斷，才不會被 Math.max 遮蔽
function isTextVertical(item) {
  const base      = item.type === 'chair' ? 6 : 9
  const threshold = item.type === 'chair' ? 5.3 : 6
  const rawSize   = base * Math.min(item.scaleX, item.scaleY)
  return rawSize < threshold
}

// 直式時改用 writing-mode:vertical-rl，textTransform 不再需要額外角度

/* ── Edit state ── */
const isEditing  = ref(false)
const activeTool = ref(null)   // 'chair' | 'square-table' | 'round-table' | null
const selectedId = ref(null)

const isAddMode = computed(
  () => isEditing.value && !!activeTool.value && activeTool.value !== 'delete'
)

const editHint = computed(() => {
  if (activeTool.value === 'chair')        return '點擊空白處新增椅子'
  if (activeTool.value === 'square-table') return '點擊空白處新增方桌'
  if (activeTool.value === 'round-table')  return '點擊空白處新增圓桌'
  if (selectedId.value != null)            return '拖曳移動・↻ 旋轉・⤡ 縮放'
  return '點選桌椅進行編輯'
})

/* ── Floor items ── */
let _uid = 30
const ACTIVE_FLOOR = '1F'   // 之後從 props/store 取得當前樓層

/* 預設座位圖：只在 Supabase 該樓層還沒有任何資料時（第一次使用）當起點 */
const DEFAULT_FLOOR_ITEMS = [
  // Right column: 大桌 1 + 座位
  { id:1,  type:'square-table', x:212, y:75,  rotation:0, scaleX:1.2, scaleY:1.2, name:'1號桌', status:'paid' },
  { id:2,  type:'chair',        x:175, y:32,  rotation:0, scaleX:1, scaleY:1,   name:'A1',   status:'paid' },
  { id:3,  type:'chair',        x:175, y:66,  rotation:0, scaleX:1, scaleY:1,   name:'A2',   status:'paid' },
  { id:4,  type:'chair',        x:175, y:110, rotation:0, scaleX:1, scaleY:1,   name:'A3',   status:'empty' },
  // Right column: 大桌 2 + 座位
  { id:5,  type:'square-table', x:212, y:228, rotation:0, scaleX:1.2, scaleY:1.2, name:'2號桌', status:'empty' },
  { id:6,  type:'chair',        x:175, y:177, rotation:0, scaleX:1, scaleY:1,   name:'A4',   status:'empty' },
  { id:7,  type:'chair',        x:175, y:212, rotation:0, scaleX:1, scaleY:1,   name:'A5',   status:'empty' },
  { id:8,  type:'chair',        x:175, y:246, rotation:0, scaleX:1, scaleY:1,   name:'A6',   status:'empty' },
  { id:9,  type:'chair',        x:175, y:280, rotation:0, scaleX:1, scaleY:1,   name:'A7',   status:'empty' },
  // Middle: 小桌 A + 座位
  { id:10, type:'square-table', x:126, y:196, rotation:0, scaleX:0.9, scaleY:0.9, name:'3號桌', status:'ordered' },
  { id:11, type:'chair',        x:118, y:163, rotation:0, scaleX:0.9, scaleY:0.9, name:'B1',   status:'ordered' },
  // Middle: 小桌 B + 座位
  { id:12, type:'square-table', x:126, y:272, rotation:0, scaleX:0.9, scaleY:0.9, name:'4號桌', status:'ordered' },
  { id:13, type:'chair',        x:118, y:239, rotation:0, scaleX:0.9, scaleY:0.9, name:'B2',   status:'ordered' },
  // Bottom: 大橫桌 + 座位
  { id:14, type:'square-table', x:80,  y:241, rotation:0, scaleX:1.8, scaleY:1.8, name:'5號桌', status:'empty' },
  { id:15, type:'chair',        x:38,  y:204, rotation:0, scaleX:1, scaleY:1,   name:'C1',   status:'empty' },
  { id:16, type:'chair',        x:62,  y:204, rotation:0, scaleX:1, scaleY:1,   name:'C2',   status:'empty' },
  { id:17, type:'chair',        x:86,  y:204, rotation:0, scaleX:1, scaleY:1,   name:'C3',   status:'empty' },
  { id:18, type:'chair',        x:110, y:204, rotation:0, scaleX:1, scaleY:1,   name:'C4',   status:'empty' },
  { id:19, type:'chair',        x:38,  y:278, rotation:0, scaleX:1, scaleY:1,   name:'C5',   status:'empty' },
  { id:20, type:'chair',        x:62,  y:278, rotation:0, scaleX:1, scaleY:1,   name:'C6',   status:'empty' },
  { id:21, type:'chair',        x:86,  y:278, rotation:0, scaleX:1, scaleY:1,   name:'C7',   status:'empty' },
  { id:22, type:'chair',        x:110, y:278, rotation:0, scaleX:1, scaleY:1,   name:'C8',   status:'empty' },
]

const floorItems      = ref([])         // 先空陣列，避免畫面先閃出預設座位圖再跳成儲存版
const isLayoutLoading = ref(true)       // 讀取 Supabase 座位圖中

/* 頁面載入時讀取儲存的座位圖 */
onMounted(async () => {
  const saved = await loadLayout(ACTIVE_FLOOR)
  if (saved && saved.length > 0) {
    floorItems.value = saved
    const maxId = Math.max(...saved.map(i => i.id), _uid)
    _uid = maxId + 1
  } else {
    /* Supabase 這個樓層還沒存過座位圖（第一次使用）→ 用預設座位圖當起點 */
    floorItems.value = DEFAULT_FLOOR_ITEMS
  }
  isLayoutLoading.value = false
})

/* ── Drag state ── */
const drag = ref(null)

/* ── 選桌模式：已選取的桌椅 ids ── */
const selectedArrangeItems = ref([])

watch(
  () => props.arrangingId,
  (val) => { if (val == null) selectedArrangeItems.value = [] },
)
/*
  drag = {
    mode: 'move' | 'rotate' | 'scale'
    itemId, pid (pointerId)
    move:   sx, sy, ix, iy
    rotate: cx, cy, startAngle, startRot
    scale:  cx, cy, rotation, startLocalX, startLocalY, startScaleX, startScaleY
  }
*/

/* ── Name modal state ── */
const showNameModal = ref(false)
const pendingName   = ref('')
const pendingType   = ref('chair')
const nameError     = ref('')
const modalItemId   = ref(null)
const isNewItem     = ref(false)

/* ── SVG coordinate conversion ── */
function svgPt(e) {
  const svg = svgRef.value
  const pt  = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  return pt.matrixTransform(svg.getScreenCTM().inverse())
}

/* ── Edit lifecycle ── */
function enterEditing() {
  isEditing.value  = true
  activeTool.value = null
  selectedId.value = null
}

async function finishEditing() {
  isEditing.value = false
  activeTool.value = null
  selectedId.value = null
  drag.value = null
  await saveLayout(ACTIVE_FLOOR, floorItems.value)
  emit('finish-editing', [...floorItems.value])
}

function setTool(id) {
  if (id === 'delete') {
    if (selectedId.value != null) deleteItem(selectedId.value)
    return
  }
  activeTool.value = (activeTool.value === id) ? null : id
}

/* ── CRUD ── */
function deleteItem(id) {
  floorItems.value = floorItems.value.filter(i => i.id !== id)
  if (selectedId.value === id) selectedId.value = null
}

// 複製物件：offset 30px 後立即要求命名（名稱不能重複）
function copyItem(id) {
  const src = floorItems.value.find(i => i.id === id)
  if (!src) return
  const newId = _uid++
  floorItems.value.push({
    ...src,
    id:     newId,
    x:      src.x + 30,
    y:      src.y + 30,
    name:   '',
  })
  selectedId.value = newId
  isNewItem.value  = true
  openNameModal(newId, src.type)
}

/* ── Canvas background click: add item ── */
function onCanvasDown(e) {
  if (!isEditing.value) return
  // Items use @pointerdown.stop, so this only fires for SVG background
  if (e.target !== svgRef.value) return

  selectedId.value = null
  if (!isAddMode.value) return

  const pt = svgPt(e)
  const id = _uid++
  floorItems.value.push({
    id, type: activeTool.value,
    x: pt.x, y: pt.y,
    rotation: 0, scaleX: 1, scaleY: 1,
    name: '', status: 'empty',
  })
  selectedId.value = id
  isNewItem.value  = true
  openNameModal(id, activeTool.value)
}

/* ── Item: move ── */
function onItemDown(item, e) {
  // 選桌模式：切換選取狀態（多選）
  if (props.arrangingId != null && !isEditing.value) {
    e.preventDefault()
    const list = selectedArrangeItems.value
    const idx  = list.indexOf(item.id)
    if (idx >= 0) list.splice(idx, 1)
    else          list.push(item.id)
    return
  }

  if (!isEditing.value) return
  e.preventDefault()
  selectedId.value = item.id

  if (activeTool.value === 'delete') { deleteItem(item.id); return }

  const pt = svgPt(e)
  drag.value = {
    mode: 'move', itemId: item.id, pid: e.pointerId,
    sx: pt.x, sy: pt.y, ix: item.x, iy: item.y,
  }
  svgRef.value.setPointerCapture(e.pointerId)
}

/* ── Rotate handle ── */
function onRotateDown(item, e) {
  e.preventDefault()
  const pt = svgPt(e)
  drag.value = {
    mode: 'rotate', itemId: item.id, pid: e.pointerId,
    cx: item.x, cy: item.y,
    startAngle: Math.atan2(pt.y - item.y, pt.x - item.x) * 180 / Math.PI,
    startRot: item.rotation,
  }
  svgRef.value.setPointerCapture(e.pointerId)
}

/* ── Scale handle (非等比：X 軸 / Y 軸各自獨立) ── */
function onScaleDown(item, e) {
  e.preventDefault()
  const pt  = svgPt(e)
  const dx  = pt.x - item.x
  const dy  = pt.y - item.y
  const rad = item.rotation * Math.PI / 180
  // 把 pointer 轉到物件本地座標系（消除旋轉影響）
  const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad)
  const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad)
  drag.value = {
    mode: 'scale', itemId: item.id, pid: e.pointerId,
    cx: item.x, cy: item.y,
    rotation:    item.rotation,
    startLocalX: Math.max(Math.abs(localX), 5),
    startLocalY: Math.max(Math.abs(localY), 5),
    startScaleX: item.scaleX,
    startScaleY: item.scaleY,
  }
  svgRef.value.setPointerCapture(e.pointerId)
}

/* ── Pointer move ── */
function onPointerMove(e) {
  const d = drag.value
  if (!d) return
  const pt   = svgPt(e)
  const item = floorItems.value.find(i => i.id === d.itemId)
  if (!item) return

  if (d.mode === 'move') {
    item.x = d.ix + (pt.x - d.sx)
    item.y = d.iy + (pt.y - d.sy)
  } else if (d.mode === 'rotate') {
    const a = Math.atan2(pt.y - d.cy, pt.x - d.cx) * 180 / Math.PI
    item.rotation = d.startRot + (a - d.startAngle)
  } else if (d.mode === 'scale') {
    const dx     = pt.x - d.cx
    const dy     = pt.y - d.cy
    const rad    = d.rotation * Math.PI / 180
    // pointer 轉本地座標（消除旋轉）
    const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad)
    const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad)
    item.scaleX  = Math.min(4, Math.max(0.35, d.startScaleX * (Math.abs(localX) / d.startLocalX)))
    item.scaleY  = Math.min(4, Math.max(0.35, d.startScaleY * (Math.abs(localY) / d.startLocalY)))
  }
}

/* ── Pointer up ── */
function onPointerUp() {
  if (!drag.value) return
  svgRef.value?.releasePointerCapture(drag.value.pid)
  drag.value = null
}

/* ── Name modal ── */
function openNameModal(id, type) {
  const item       = floorItems.value.find(i => i.id === id)
  modalItemId.value = id
  pendingType.value = type
  pendingName.value = item?.name ?? ''
  nameError.value   = ''
  showNameModal.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function confirmName() {
  const name = pendingName.value.trim()
  if (!name) { nameError.value = '請輸入名稱'; return }

  const isDuplicate = floorItems.value.some(
    i => i.id !== modalItemId.value && i.name === name
  )
  if (isDuplicate) { nameError.value = `「${name}」名稱重複，請換一個`; return }

  const item = floorItems.value.find(i => i.id === modalItemId.value)
  if (item) item.name = name

  showNameModal.value = false
  isNewItem.value     = false
  nameError.value     = ''
}

function cancelName() {
  // Remove the item if it was just created and not named
  if (isNewItem.value) deleteItem(modalItemId.value)
  showNameModal.value = false
  isNewItem.value     = false
  nameError.value     = ''
}

/* ── 確認入座（多選）── */
function confirmArrange() {
  if (selectedArrangeItems.value.length === 0) return
  const assigned = floorItems.value.filter(i => selectedArrangeItems.value.includes(i.id))
  emit('seat-assigned', {
    reservationId: props.arrangingId,
    itemIds:   assigned.map(i => i.id),
    itemNames: assigned.map(i => i.name),
  })
  selectedArrangeItems.value = []
}

/* ── 由 DineInView 呼叫：將桌椅標記為已入座 ── */
function markItemSeated(itemId) {
  const item = floorItems.value.find(i => i.id === itemId)
  if (item) item.status = 'ordered'
}

defineExpose({ markItemSeated })
</script>

<style scoped>
.floor-map {
  flex: 1;
  background: var(--color-bg-map);
  padding: 10px 6px 6px 10px;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ── Edit bar ── */
.floor-map__edit-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.floor-map__edit-hint {
  font-size: var(--fs-sm);
  color: var(--color-text-secondary);
}

.floor-map__finish-btn {
  padding: 4px 12px;
  background: #3a7a3a;
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: #fff;
  font-weight: 500;
  transition: background 0.15s;
}

.floor-map__finish-btn:hover {
  background: #2a6a2a;
}

/* ── Legend ── */
.floor-map__legend {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.floor-map__legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: var(--fs-sm);
  color: var(--color-text-secondary);
}

.floor-map__legend-dot {
  width: 9px;
  height: 9px;
  border-radius: var(--radius-full);
  display: inline-block;
  flex-shrink: 0;
}

/* ── SVG ── */
.floor-map__svg {
  flex: 1;
  display: block;
  width: 100%;
  min-height: 0;
}

.floor-map__svg-loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: var(--fs-sm);
}

/* ── Normal mode: single action button ── */
.floor-map__actions {
  position: absolute;
  bottom: 8px;
  right: 8px;
}

.floor-map__action-btn {
  padding: 4px 11px;
  background: var(--color-bg-map-btn);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  transition: background 0.12s;
}

.floor-map__action-btn:hover {
  background: var(--color-bg-arrange-btn);
}

/* ── 選桌模式橫幅 ── */
.floor-map__arrange-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 5px 8px;
  background: #fff8e8;
  border-bottom: 1px solid #e8c878;
  flex-shrink: 0;
}

.floor-map__arrange-hint {
  font-size: var(--fs-sm);
  color: #7a5020;
}

.floor-map__arrange-actions {
  display: flex;
  gap: 5px;
}

.floor-map__arrange-cancel {
  padding: 2px 10px;
  background: #fff;
  border: 1px solid #c8a060;
  border-radius: var(--radius-xs);
  font-size: var(--fs-xs);
  color: #7a5020;
  transition: background 0.12s;
}

.floor-map__arrange-cancel:hover { background: #fff0d8; }

.floor-map__arrange-confirm {
  padding: 2px 12px;
  background: #3a7a3a;
  border: none;
  border-radius: var(--radius-xs);
  font-size: var(--fs-xs);
  color: #fff;
  font-weight: 500;
  transition: background 0.15s;
}

.floor-map__arrange-confirm:hover:not(:disabled) { background: #2a6a2a; }

.floor-map__arrange-confirm:disabled {
  background: #a0b8a0;
  cursor: not-allowed;
}

/* ── Edit mode: 4-option toolbar ── */
.floor-map__toolbar {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.floor-map__tool-btn {
  padding: 4px 11px;
  background: var(--color-bg-map-btn);
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: var(--fs-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  text-align: left;
  transition: background 0.12s;
}

.floor-map__tool-btn:hover {
  background: var(--color-bg-arrange-btn);
}

.floor-map__tool-btn--active {
  background: var(--color-bg-nav-active);
  color: var(--color-text-nav-active);
  border-color: #c07820;
}
</style>

<!-- Global: name modal styles (Teleport escapes scoped) -->
<style>
.nm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.nm-box {
  background: #fff;
  border-radius: 14px;
  padding: 20px 24px;
  width: 300px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.nm-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
  margin-bottom: 6px;
}

.nm-hint {
  font-size: 11px;
  color: #9a8868;
  margin-bottom: 12px;
  line-height: 1.5;
}

.nm-input {
  width: 100%;
  padding: 8px 12px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 14px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  margin-bottom: 4px;
  transition: border-color 0.15s;
}

.nm-input:focus {
  border-color: #e8a038;
}

.nm-error {
  font-size: 11px;
  color: #c03020;
  margin-top: 2px;
  margin-bottom: 4px;
  min-height: 16px;
}

.nm-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.nm-cancel {
  padding: 6px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.12s;
}

.nm-cancel:hover {
  background: #e8dcc8;
}

.nm-confirm {
  padding: 6px 16px;
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

.nm-confirm:hover {
  background: #2a6a2a;
}
</style>