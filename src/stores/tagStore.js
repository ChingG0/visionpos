import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'

/* 快速標籤（小辣、蔥花、全素…）：點餐設定可新增管理，點餐頁快速套用到訂單上 */
export const useTagStore = defineStore('tags', () => {

  const tags    = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function fromDb(row) {
    return { id: row.id, label: row.label, color: row.color, sortOrder: row.sort_order }
  }

  function toDb(t) {
    return { id: t.id, label: t.label, color: t.color, sort_order: t.sortOrder }
  }

  async function init() {
    if (loaded) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase.from('tags').select('*').order('sort_order')
      if (err) throw err
      tags.value = data.map(fromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[tagStore] 讀取標籤失敗', e)
    } finally {
      loading.value = false
    }
  }

  async function addTag({ label, color }) {
    const maxSort = tags.value.reduce((m, t) => Math.max(m, t.sortOrder ?? -1), -1)
    const newTag = {
      id: `tag${Date.now()}`,
      label,
      color,
      sortOrder: maxSort + 1,
    }
    tags.value.push(newTag)
    const { error: err } = await supabase.from('tags').upsert(toDb(newTag))
    if (err) console.error('[tagStore] 新增標籤失敗', err)
  }

  async function updateTag(id, data) {
    const tag = tags.value.find(t => t.id === id)
    if (!tag) return
    Object.assign(tag, data)
    const { error: err } = await supabase.from('tags').upsert(toDb(tag))
    if (err) console.error('[tagStore] 更新標籤失敗', err)
  }

  async function deleteTag(id) {
    tags.value = tags.value.filter(t => t.id !== id)
    const { error: err } = await supabase.from('tags').delete().eq('id', id)
    if (err) console.error('[tagStore] 刪除標籤失敗', err)
  }

  /* orderedIds：拖曳完之後的新順序（標籤 id 陣列） */
  async function reorderTags(orderedIds) {
    const reordered = orderedIds
      .map(id => tags.value.find(t => t.id === id))
      .filter(Boolean)
      .map((t, idx) => ({ ...t, sortOrder: idx }))

    tags.value = reordered

    const { error: err } = await supabase.from('tags').upsert(reordered.map(toDb))
    if (err) console.error('[tagStore] 儲存標籤排序失敗', err)
  }

  return { tags, loading, error, init, addTag, updateTag, deleteTag, reorderTags }
})