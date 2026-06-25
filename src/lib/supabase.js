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

// 建立 Supabase client，每次請求動態注入 x-store-id
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      get 'x-store-id'() { return getStoreId() ?? '' }
    }
  }
})