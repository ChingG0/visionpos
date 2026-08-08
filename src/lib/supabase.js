// =============================================================================
// src/lib/supabase.js
// 每個請求自動帶上 x-store-id header，配合 RLS policy
// =============================================================================
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = 'https://axwsootizanehojafwnw.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_Z_0EYSQNUOUAofp00qSZiw_RB5_nMQI'

// 取得目前登入的 store_id
function getStoreId() {
  try {
    const raw = localStorage.getItem('visionpos_auth')
    const { s } = JSON.parse(raw ?? '{}')
    return s?.id ?? null
  } catch { return null }
}

/*
  ⚠ 這裡不能用 global.headers 搭配 getter 來動態帶 store_id。

  supabase-js 在「建立 client 的當下」就會把 headers 物件展開複製一份，展開會
  觸發 getter、把結果固化成一個字串存起來，之後每個請求都用那個舊值，getter
  再也不會被呼叫。結果就是 header 永遠停留在「網頁載入那一刻」的店家，而不是
  「目前登入」的店家。實際造成過的災情：
    - 新店家第一次登入（沒重新整理）→ header 是空的 → 所有寫入被 RLS 擋掉
    - 同一個分頁換店登入 → 寫入還帶著上一家店的 id，有寫錯店的風險

  改成自訂 fetch，在每個請求真正送出前才讀 localStorage 注入 header，
  這樣不管什麼時候登入、換店，都一定拿到當下正確的值。
*/
function fetchWithStoreId(input, init = {}) {
  const headers = new Headers(init.headers ?? {})
  headers.set('x-store-id', getStoreId() ?? '')
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { fetch: fetchWithStoreId },
})
