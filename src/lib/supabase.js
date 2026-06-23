import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = 'https://axwsootizanehojafwnw.supabase.co'
const supabaseAnonKey = 'sb_publishable_Z_0EYSQNUOUAofp00qSZiw_RB5_nMQI'

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] 缺少環境變數。請在專案根目錄建立 .env 檔案，' +
    '並填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY（可參考 .env.example）。'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)