<template>
  <div class="os">
    <SettingsSidebar />

    <div class="os__main">
      <AppTopbar :show-floor-tabs="false" />

      <!-- 分類頁籤：平常是單純按鈕，進入「編輯分類順序」才能拖曳 -->
      <div class="os__tabs-row">
        <div class="os__tabs" ref="tabsRowRef">
          <div
            v-for="cat in menuStore.categories"
            :key="cat.id"
            :ref="el => setCategoryTabEl(cat.id, el)"
            class="os__tab"
            role="button"
            tabindex="0"
            :class="{
              'os__tab--active': cat.id === activeCategoryId,
              'os__tab--dragging': categoryDrag?.catId === cat.id,
              'os__tab--edit-mode': categoryEditMode,
            }"
            @pointerdown="categoryEditMode && onCategoryPointerDown(cat, $event)"
            @click="!categoryEditMode && (activeCategoryId = cat.id)"
            @keydown.enter="!categoryEditMode && (activeCategoryId = cat.id)"
          >
            <span class="os__tab-icon">{{ cat.icon }}</span>
            <span class="os__tab-label">{{ cat.label }}</span>
          </div>
        </div>

        <button
          class="os__edit-cat-btn"
          :class="{ 'os__edit-cat-btn--active': categoryEditMode }"
          @click="categoryEditMode = !categoryEditMode"
        >{{ categoryEditMode ? '✓ 完成排序' : '編輯分類順序' }}</button>
      </div>

      <p v-if="categoryEditMode" class="os__cat-edit-hint">拖曳分類調整順序</p>

      <div class="os__body">

        <!-- 已上架（可拖曳排序、拖到右側下架） -->
        <section class="os__published" ref="publishedZoneRef">
          <h3 class="os__section-title">商品<span class="os__section-title-light">排序</span></h3>
          <p class="os__hint">拖曳調整順序，拖到右側「待上架」即可下架</p>

          <div class="os__grid">
            <div
              v-for="(item, idx) in publishedItems"
              :key="item.id"
              :ref="el => setPublishedCardEl(item.id, el)"
              class="os__card"
              :class="{
                'os__card--dragging': dragState?.itemId === item.id,
                'os__card--drop-target': dragState && dragState.overZone === 'published' && dragState.dropIndex === idx && dragState.itemId !== item.id,
              }"
              @pointerdown="onCardPointerDown(item, 'published', $event)"
            >
              <span class="os__card-icon">{{ item.icon }}</span>
              <span class="os__card-name">{{ item.name }}</span>
              <span class="os__card-price">${{ item.price }}</span>
            </div>

            <p v-if="publishedItems.length === 0" class="os__empty">此分類尚無上架商品，從右側拖曳加入</p>
          </div>
        </section>

        <!-- 待上架 -->
        <aside
          class="os__unpublished"
          ref="unpublishedZoneRef"
          :class="{ 'os__unpublished--hover': dragState?.overZone === 'unpublished' }"
        >
          <h4 class="os__unpub-category">{{ activeCategoryLabel }}</h4>
          <p class="os__unpub-label">待上架</p>

          <div class="os__unpub-list">
            <div
              v-for="item in unpublishedItems"
              :key="item.id"
              class="os__unpub-card"
              :class="{ 'os__card--dragging': dragState?.itemId === item.id }"
              @pointerdown="onCardPointerDown(item, 'unpublished', $event)"
            >
              <span>{{ item.name }}</span>
              <span class="os__unpub-price">${{ item.price }}</span>
            </div>

            <p v-if="unpublishedItems.length === 0" class="os__empty-small">沒有待上架商品</p>
          </div>
        </aside>

      </div>

      <!-- 快速標籤：只能從「商品管理 → 標籤管理」建立的標籤裡挑選 + 調整順序 -->
      <section class="os__tags-section">
        <div class="os__tags-header">
          <h3 class="os__section-title">快速<span class="os__section-title-light">標籤</span></h3>
          <div class="os__tags-header-actions">
            <button
              class="os__edit-tags-btn"
              :class="{ 'os__edit-tags-btn--active': tagPickMode }"
              @click="togglePickMode"
            >{{ tagPickMode ? '✓ 完成選擇' : '選擇標籤' }}</button>
            <button
              class="os__edit-tags-btn"
              :class="{ 'os__edit-tags-btn--active': tagEditMode }"
              @click="toggleEditMode"
            >{{ tagEditMode ? '✓ 完成排序' : '編輯排序' }}</button>
          </div>
        </div>

        <p v-if="tagEditMode" class="os__tags-hint">拖曳調整標籤順序</p>
        <p v-else-if="tagPickMode" class="os__tags-hint">
          點擊切換是否顯示在點餐頁的快速標籤列（標籤本身要到「商品管理 → 標籤管理」新增或修改）
        </p>

        <div class="os__tags-list">
          <button
            v-for="tag in displayTags"
            :key="tag.id"
            :ref="el => setTagChipEl(tag.id, el)"
            class="os__tag-chip"
            :class="{
              'os__tag-chip--edit': tagEditMode,
              'os__tag-chip--dragging': tagDrag?.tagId === tag.id && tagDrag?.hasMoved,
              'os__tag-chip--off': tagPickMode && tag.isQuick === false,
            }"
            :style="{
              background: tagColorOf(tag).bg,
              color: tagColorOf(tag).text,
              borderColor: tagColorOf(tag).border ?? tagColorOf(tag).bg,
            }"
            @pointerdown="tagEditMode && onTagPointerDown(tag, $event)"
            @click="tagPickMode && tagStore.setQuick(tag.id, tag.isQuick === false)"
          >{{ tag.label }}</button>

          <p v-if="displayTags.length === 0" class="os__empty-small">
            {{ tagStore.tags.length === 0
              ? '尚未建立標籤，請到「商品管理 → 標籤管理」新增'
              : '目前沒有選取任何快速標籤，點「選擇標籤」挑選' }}
          </p>
        </div>
      </section>
    </div>

    <!-- 拖曳中的浮動小卡（商品） -->
    <Teleport to="body">
      <div v-if="dragState" class="os__ghost" :style="ghostStyle">
        <span>{{ dragState.icon }}</span>
        <span>{{ dragState.name }}</span>
      </div>
    </Teleport>

    <!-- 拖曳中的浮動小卡（分類） -->
    <Teleport to="body">
      <div v-if="categoryDrag?.hasMoved" class="os__ghost" :style="categoryGhostStyle">
        <span>{{ categoryDrag.icon }}</span>
        <span>{{ categoryDrag.label }}</span>
      </div>
    </Teleport>

    <!-- 拖曳中的浮動小卡（標籤） -->
    <Teleport to="body">
      <div
        v-if="tagDrag?.hasMoved"
        class="os__ghost"
        :style="{
          left: `${tagDrag.x}px`,
          top: `${tagDrag.y}px`,
          background: tagDragColor.bg,
          color: tagDragColor.text,
        }"
      >
        <span>{{ tagDrag.label }}</span>
      </div>
    </Teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import AppTopbar         from '@/components/layout/AppTopbar.vue'
import { useMenuStore }  from '@/stores/menuStore.js'
import { useTagStore }   from '@/stores/tagStore.js'
import { TAG_COLOR_MAP } from '@/constants/tagColors.js'

const menuStore = useMenuStore()
const tagStore  = useTagStore()

onMounted(() => {
  menuStore.init()
  tagStore.init()
})

function tagColorOf(tag) {
  return TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray
}

/* ── 快速標籤：選擇模式 / 排序模式 ─────────────────────────────────────────
   標籤本身的新增/改名/改色/刪除都移到「商品管理 → 標籤管理」，這裡只負責
   ① 選擇哪些標籤要出現在點餐頁的快速標籤列 ② 調整它們的順序。 */
const tagPickMode = ref(false)
const tagEditMode = ref(false)

// 選擇模式要看得到全部標籤（才能把沒選的加回來）；平常只顯示已選為快速標籤的
const displayTags = computed(() =>
  tagPickMode.value ? tagStore.tags : tagStore.tags.filter(t => t.isQuick !== false)
)

function togglePickMode() {
  tagPickMode.value = !tagPickMode.value
  if (tagPickMode.value) tagEditMode.value = false
}

function toggleEditMode() {
  tagEditMode.value = !tagEditMode.value
  if (tagEditMode.value) tagPickMode.value = false
}
const tagDrag      = ref(null)   // { tagId, label, color, startX, startY, x, y, dropIndex, hasMoved }
const tagChipEls   = new Map()   // tagId -> HTMLElement

function setTagChipEl(id, el) {
  if (el) tagChipEls.set(id, el)
  else tagChipEls.delete(id)
}

const tagDragColor = computed(() => {
  if (!tagDrag.value) return TAG_COLOR_MAP.gray
  return TAG_COLOR_MAP[tagDrag.value.color] ?? TAG_COLOR_MAP.gray
})

function onTagPointerDown(tag, e) {
  tagDrag.value = {
    tagId: tag.id,
    label: tag.label,
    color: tag.color,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    dropIndex: null,
    hasMoved: false,
  }
  window.addEventListener('pointermove', onTagPointerMove)
  window.addEventListener('pointerup', onTagPointerUp)
}

function onTagPointerMove(e) {
  const d = tagDrag.value
  if (!d) return
  d.x = e.clientX
  d.y = e.clientY

  if (!d.hasMoved) {
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
    if (dist > DRAG_THRESHOLD) d.hasMoved = true
    else return
  }

  /* 標籤會換行排列，跟商品格一樣用 2D 最近距離決定插入位置 */
  let nearestIdx   = displayTags.value.length
  let nearestDist  = Infinity
  let insertBefore = true

  displayTags.value.forEach((tag, idx) => {
    if (tag.id === d.tagId) return
    const el = tagChipEls.get(tag.id)
    if (!el) return
    const r  = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
    if (dist < nearestDist) {
      nearestDist  = dist
      nearestIdx   = idx
      insertBefore = e.clientX < cx
    }
  })

  d.dropIndex = insertBefore ? nearestIdx : nearestIdx + 1
}

function onTagPointerUp() {
  const d = tagDrag.value
  window.removeEventListener('pointermove', onTagPointerMove)
  window.removeEventListener('pointerup', onTagPointerUp)
  if (!d) return

  try {
    if (d.hasMoved && d.dropIndex != null) {
      // 排序模式下畫面上只有快速標籤，先在這批裡面排好，
      // 沒被選為快速標籤的排在後面（它們不會出現在點餐頁，順序無所謂）。
      const shownIds  = displayTags.value.map(t => t.id).filter(id => id !== d.tagId)
      const clamped   = Math.max(0, Math.min(d.dropIndex, shownIds.length))
      shownIds.splice(clamped, 0, d.tagId)
      const hiddenIds = tagStore.tags.map(t => t.id).filter(id => !shownIds.includes(id))
      tagStore.reorderTags([...shownIds, ...hiddenIds])
    }
  } catch (err) {
    console.error('[OrderSettingsView] 標籤排序失敗', err)
  } finally {
    tagDrag.value = null
  }
}

const activeCategoryId = ref(menuStore.categories[0]?.id ?? '')
const activeCategoryLabel = computed(
  () => menuStore.categories.find(c => c.id === activeCategoryId.value)?.label ?? ''
)

const publishedItems = computed(() =>
  menuStore.items
    .filter(i => i.categoryId === activeCategoryId.value && i.status)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
)

const unpublishedItems = computed(() =>
  menuStore.items
    .filter(i => i.categoryId === activeCategoryId.value && !i.status)
    .sort((a, b) => a.code.localeCompare(b.code))
)

/* ── DOM refs for hit-testing ── */
const publishedZoneRef   = ref(null)
const unpublishedZoneRef = ref(null)
const publishedCardEls   = new Map()   // itemId -> HTMLElement（不需響應式）

function setPublishedCardEl(id, el) {
  if (el) publishedCardEls.set(id, el)
  else publishedCardEls.delete(id)
}

/* ── 拖曳狀態 ── */
const dragState = ref(null)
/*
  { itemId, name, icon, sourceList, x, y, overZone, dropIndex }
*/

const ghostStyle = computed(() => {
  if (!dragState.value) return {}
  return {
    left: `${dragState.value.x}px`,
    top:  `${dragState.value.y}px`,
  }
})

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

function onCardPointerDown(item, sourceList, e) {
  e.preventDefault()
  dragState.value = {
    itemId: item.id,
    name:   item.name,
    icon:   item.icon,
    sourceList,
    x: e.clientX,
    y: e.clientY,
    overZone: sourceList,
    dropIndex: null,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e) {
  if (!dragState.value) return
  dragState.value.x = e.clientX
  dragState.value.y = e.clientY

  const rightRect = unpublishedZoneRef.value?.getBoundingClientRect()
  const leftRect   = publishedZoneRef.value?.getBoundingClientRect()

  if (rightRect && pointInRect(e.clientX, e.clientY, rightRect)) {
    dragState.value.overZone  = 'unpublished'
    dragState.value.dropIndex = null
    return
  }

  if (leftRect && pointInRect(e.clientX, e.clientY, leftRect)) {
    dragState.value.overZone = 'published'

    let nearestIdx  = publishedItems.value.length
    let nearestDist = Infinity
    let insertBefore = true

    publishedItems.value.forEach((it, idx) => {
      if (it.id === dragState.value.itemId) return
      const el = publishedCardEls.get(it.id)
      if (!el) return
      const r  = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const dist = Math.hypot(e.clientX - cx, e.clientY - cy)
      if (dist < nearestDist) {
        nearestDist  = dist
        nearestIdx   = idx
        insertBefore = e.clientX < cx
      }
    })

    dragState.value.dropIndex = insertBefore ? nearestIdx : nearestIdx + 1
    return
  }

  /* 不在任何 zone 內：維持上一次的 overZone，不更新 */
}

function onPointerUp() {
  const d = dragState.value
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  if (!d) return

  if (d.overZone === 'unpublished') {
    menuStore.unpublish(d.itemId)
  } else if (d.overZone === 'published') {
    const targetIdx = d.dropIndex ?? publishedItems.value.length
    menuStore.publishAt(d.itemId, activeCategoryId.value, targetIdx)
  }

  dragState.value = null
}

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointermove', onCategoryPointerMove)
  window.removeEventListener('pointerup', onCategoryPointerUp)
  window.removeEventListener('pointermove', onTagPointerMove)
  window.removeEventListener('pointerup', onTagPointerUp)
})

/* ════════════════════════════════════════════
   分類頁籤拖曳排序（單排，只需判斷插入位置）
   ════════════════════════════════════════════ */

const tabsRowRef    = ref(null)
const categoryTabEls = new Map()   // categoryId -> HTMLElement

function setCategoryTabEl(id, el) {
  if (el) categoryTabEls.set(id, el)
  else categoryTabEls.delete(id)
}

const categoryDrag = ref(null)
/* { catId, icon, label, startX, startY, x, y, dropIndex, hasMoved } */

const categoryEditMode = ref(false)   // 進入這個模式才能拖曳分類，平常分類純粹是按鈕

const DRAG_THRESHOLD = 6   // px，超過才算「拖曳」，否則視為點擊選取分類

const categoryGhostStyle = computed(() => {
  if (!categoryDrag.value) return {}
  return {
    left: `${categoryDrag.value.x}px`,
    top:  `${categoryDrag.value.y}px`,
  }
})

function onCategoryPointerDown(cat, e) {
  categoryDrag.value = {
    catId: cat.id,
    icon:  cat.icon,
    label: cat.label,
    startX: e.clientX,
    startY: e.clientY,
    x: e.clientX,
    y: e.clientY,
    dropIndex: null,
    hasMoved: false,
  }
  window.addEventListener('pointermove', onCategoryPointerMove)
  window.addEventListener('pointerup', onCategoryPointerUp)
}

function onCategoryPointerMove(e) {
  const d = categoryDrag.value
  if (!d) return
  d.x = e.clientX
  d.y = e.clientY

  if (!d.hasMoved) {
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY)
    if (dist > DRAG_THRESHOLD) d.hasMoved = true
    else return
  }

  /* 單排只需比較 X 軸，找最近的頁籤決定插入前/後 */
  let nearestIdx   = menuStore.categories.length
  let nearestDist  = Infinity
  let insertBefore = true

  menuStore.categories.forEach((cat, idx) => {
    if (cat.id === d.catId) return
    const el = categoryTabEls.get(cat.id)
    if (!el) return
    const r  = el.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const dist = Math.abs(e.clientX - cx)
    if (dist < nearestDist) {
      nearestDist  = dist
      nearestIdx   = idx
      insertBefore = e.clientX < cx
    }
  })

  d.dropIndex = insertBefore ? nearestIdx : nearestIdx + 1
}

function onCategoryPointerUp() {
  const d = categoryDrag.value
  window.removeEventListener('pointermove', onCategoryPointerMove)
  window.removeEventListener('pointerup', onCategoryPointerUp)
  if (!d) return

  try {
    if (d.hasMoved && d.dropIndex != null) {
      /* 真的拖曳：重新排序分類 */
      const ids = menuStore.categories.map(c => c.id).filter(id => id !== d.catId)
      const clamped = Math.max(0, Math.min(d.dropIndex, ids.length))
      ids.splice(clamped, 0, d.catId)
      menuStore.reorderCategories(ids)
    }
    /* 移動距離很小（沒有 hasMoved）：純點擊，編輯模式下不做事 */
  } catch (err) {
    console.error('[OrderSettingsView] 分類排序失敗', err)
  } finally {
    /* 不管成功失敗都要清掉，避免拖曳狀態卡住、浮動小卡黏在畫面上 */
    categoryDrag.value = null
  }
}
</script>

<style scoped>
.os {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.os__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Tabs row：分類頁籤（可橫向滑動）+ 編輯按鈕 ── */
.os__tabs-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 18px 0;
  flex-shrink: 0;
}

.os__tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  flex: 1;
  min-width: 0;
}

.os__tab {
  flex-shrink: 0;
  width: 68px;
  height: 60px;
  border-radius: var(--radius-md);
  background: #fff;
  border: 1.5px solid var(--color-border-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  transition: border-color 0.15s, background 0.15s, border-style 0.15s;
}

/* 只有在編輯模式才允許拖曳手感與觸控行為 */
.os__tab--edit-mode {
  cursor: grab;
  touch-action: none;
  border-style: dashed;
}

.os__tab--dragging {
  opacity: 0.35;
}

.os__tab:hover:not(.os__tab--active) { border-color: var(--color-border-btn); }

.os__tab--active {
  background: var(--color-bg-nav-active);
  border-color: #c07820;
}

.os__tab-icon { font-size: 18px; line-height: 1; }

.os__tab-label {
  font-size: 10.5px;
  color: var(--color-text-secondary);
}

.os__tab--active .os__tab-label {
  color: var(--color-text-nav-active);
  font-weight: 500;
}

/* ── 編輯分類順序按鈕 ── */
.os__edit-cat-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  background: #fff;
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-primary);
  white-space: nowrap;
  transition: background 0.12s;
}

.os__edit-cat-btn:hover { background: var(--color-bg-arrange-btn); }

.os__edit-cat-btn--active {
  background: #3a7a3a;
  border-color: #2a6a2a;
  color: #fff;
  font-weight: 500;
}

.os__edit-cat-btn--active:hover { background: #2a6a2a; }

.os__cat-edit-hint {
  font-size: 11px;
  color: var(--color-text-muted);
  padding: 6px 18px 0;
}

/* ── Body ── */
.os__body {
  flex: 1;
  display: flex;
  overflow: hidden;
  padding: 14px 18px 18px;
  gap: 16px;
}

/* ── Published zone ── */
.os__published {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-width: 0;
}

.os__section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.os__section-title-light {
  font-weight: 400;
  color: var(--color-text-secondary);
}

.os__hint {
  font-size: 11.5px;
  color: var(--color-text-muted);
  margin-bottom: 12px;
}

.os__grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  align-content: start;
}

.os__card {
  position: relative;
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 14px 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  cursor: grab;
  touch-action: none;
  user-select: none;
  transition: border-color 0.12s;
}

.os__card--dragging {
  opacity: 0.35;
}

.os__card--drop-target {
  border-color: #3a8a3a;
  border-width: 2px;
}

.os__card-icon { font-size: 28px; }

.os__card-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-align: center;
}

.os__card-price {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.os__empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12.5px;
  padding: 30px 0;
}

/* ── Unpublished zone ── */
.os__unpublished {
  width: 180px;
  flex-shrink: 0;
  background: #f0e8d8;
  border: 1.5px dashed var(--color-border-btn);
  border-radius: var(--radius-md);
  padding: 12px;
  overflow-y: auto;
  transition: background 0.15s, border-color 0.15s;
}

.os__unpublished--hover {
  background: #fde8c8;
  border-color: #e8a038;
}

.os__unpub-category {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.os__unpub-label {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-bottom: 10px;
}

.os__unpub-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.os__unpub-card {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--color-text-primary);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.os__unpub-price {
  font-size: 11px;
  color: var(--color-text-secondary);
}

.os__empty-small {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 11.5px;
  padding: 16px 0;
}

/* ── Floating ghost ── */
.os__ghost {
  position: fixed;
  transform: translate(-50%, -50%);
  background: #fff;
  border: 1.5px solid #e8a038;
  border-radius: var(--radius-md);
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--color-text-primary);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.18);
  pointer-events: none;
  z-index: 9999;
}

/* ── 快速標籤管理 ── */
.os__tags-section {
  flex-shrink: 0;
  border-top: 1px solid #ede5d0;
  padding: 12px 18px 16px;
  max-height: 130px;
  overflow-y: auto;
}

.os__tags-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.os__tags-header-actions {
  display: flex;
  gap: 8px;
}

.os__edit-tags-btn {
  padding: 5px 12px;
  background: #fff;
  border: 1px solid var(--color-border-btn);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--color-text-primary);
  transition: background 0.12s;
}

.os__edit-tags-btn:hover { background: var(--color-bg-arrange-btn); }

.os__edit-tags-btn--active {
  background: #3a7a3a;
  border-color: #2a6a2a;
  color: #fff;
  font-weight: 500;
}
.os__edit-tags-btn--active:hover { background: #2a6a2a; }

.os__tags-hint {
  font-size: 11.5px;
  color: var(--color-text-muted);
  margin-bottom: 8px;
}

.os__tags-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.os__tag-chip {
  font-size: 12.5px;
  font-weight: 500;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1.5px solid transparent;
  transition: transform 0.1s;
}

.os__tag-chip:hover {
  transform: scale(1.04);
}

.os__tag-chip--edit {
  cursor: grab;
}

.os__tag-chip--dragging {
  opacity: 0.35;
}

/* 選擇模式下，沒被選為快速標籤的顯示成淡淡的、加上虛線框 */
.os__tag-chip--off {
  opacity: 0.4;
  border-style: dashed;
  border-color: #b0a088 !important;
}
</style>