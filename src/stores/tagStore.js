import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

export const useTagStore = defineStore('tags', () => {
  const tags    = ref([])
  const loading = ref(false)
  const error   = ref(null)
  let   loaded  = false

  function getStoreId() { return useAuthStore().store?.id ?? null }

  function fromDb(row) { return { id: row.id, label: row.label, color: row.color, sortOrder: row.sort_order } }
  function toDb(t)     { return { id: t.id, label: t.label, color: t.color, sort_order: t.sortOrder, store_id: getStoreId() } }

  async function init() {
    if (loaded) return
    const storeId = getStoreId()
    if (!storeId) return
    loading.value = true
    error.value   = null
    try {
      const { data, error: err } = await supabase
        .from('tags').select('*').eq('store_id', storeId).order('sort_order')
      if (err) throw err
      tags.value = data.map(fromDb)
      loaded = true
    } catch (e) {
      error.value = e.message
      console.error('[tagStore]', e)
    } finally {
      loading.value = false
    }
  }

  function reset() { tags.value = []; loaded = false }

  async function addTag({ label, color }) {
    const storeId = getStoreId()
    const maxSort = tags.value.reduce((m, t) => Math.max(m, t.sortOrder ?? -1), -1)
    const newTag  = { id: `t${Date.now()}`, label, color, sortOrder: maxSort + 1 }
    tags.value.push(newTag)
    const { error: err } = await supabase.from('tags').insert(toDb(newTag))
    if (err) console.error('[tagStore] addTag', err)
    return newTag
  }

  async function updateTag(id, data) {
    const tag = tags.value.find(t => t.id === id)
    if (!tag) return
    Object.assign(tag, data)
    const { error: err } = await supabase.from('tags').update(toDb(tag)).eq('id', id)
    if (err) console.error('[tagStore] updateTag', err)
  }

  async function deleteTag(id) {
    tags.value = tags.value.filter(t => t.id !== id)
    const { error: err } = await supabase.from('tags').delete().eq('id', id)
    if (err) console.error('[tagStore] deleteTag', err)
  }

  async function reorderTags(orderedIds) {
    const storeId = getStoreId()
    const reordered = orderedIds.map(id => tags.value.find(t => t.id === id)).filter(Boolean)
    tags.value = reordered
    await Promise.all(
      reordered.map((t, idx) =>
        supabase.from('tags').update({ sort_order: idx }).eq('id', t.id).eq('store_id', storeId)
      )
    )
  }

  return { tags, loading, error, init, reset, addTag, updateTag, deleteTag, reorderTags }
})