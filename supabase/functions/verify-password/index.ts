import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { compareSync, hashSync } from 'npm:bcryptjs'

const ALLOWED_ORIGINS = [
  'https://visionpos.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]

function getCorsHeaders(req: Request) {
  const origin  = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

const MAX_ATTEMPTS = 10
const LOCK_MINUTES = 10

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { storeCode, username, password } = await req.json()

    if (!storeCode || !username || !password) {
      return new Response(JSON.stringify({ error: '缺少必要欄位' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const identifier = `${storeCode.toLowerCase()}:${username.trim().toLowerCase()}`
    const ip = req.headers.get('x-forwarded-for') ?? 'unknown'

    await supabase.rpc('cleanup_login_attempts')

    const { count } = await supabase
      .from('login_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('failed_at', new Date(Date.now() - LOCK_MINUTES * 60 * 1000).toISOString())

    if ((count ?? 0) >= MAX_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: `登入失敗次數過多，請 ${LOCK_MINUTES} 分鐘後再試`
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: store } = await supabase
      .from('stores')
      .select('id, code, name')
      .or(`code.eq.${storeCode.toLowerCase()},store_code.eq.${storeCode.toUpperCase()}`)
      .single()

    if (!store) {
      await supabase.from('login_attempts').insert({ identifier, ip })
      return new Response(JSON.stringify({ error: '店家代碼不存在' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: superStaff } = await supabase
      .from('staff')
      .select('id, username, name, role, is_active, is_superadmin, password_hash, password_bcrypt')
      .eq('username', username.trim())
      .eq('is_superadmin', true)
      .maybeSingle()

    const { data: normalStaff } = await supabase
      .from('staff')
      .select('id, username, name, role, is_active, is_superadmin, password_hash, password_bcrypt')
      .eq('store_id', store.id)
      .eq('username', username.trim())
      .maybeSingle()

    const staffRecord = superStaff ?? normalStaff

    if (!staffRecord) {
      await supabase.from('login_attempts').insert({ identifier, ip })
      return new Response(JSON.stringify({ error: '帳號或密碼錯誤' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!staffRecord.is_active) {
      return new Response(JSON.stringify({ error: '此帳號已停用' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let passwordMatch = false
    if (staffRecord.password_bcrypt) {
      passwordMatch = compareSync(password, staffRecord.password_bcrypt)
    } else {
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
      const sha256Hash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
      passwordMatch = sha256Hash === staffRecord.password_hash

      if (passwordMatch) {
        const bcryptHash = hashSync(password, 10)
        await supabase.from('staff').update({ password_bcrypt: bcryptHash }).eq('id', staffRecord.id)
      }
    }

    if (!passwordMatch) {
      await supabase.from('login_attempts').insert({ identifier, ip })
      const remaining = MAX_ATTEMPTS - (count ?? 0) - 1
      return new Response(JSON.stringify({
        error: remaining > 0
          ? `帳號或密碼錯誤，還有 ${remaining} 次機會`
          : `登入失敗次數過多，請 ${LOCK_MINUTES} 分鐘後再試`
      }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    await supabase.from('login_attempts').delete().eq('identifier', identifier)

    return new Response(JSON.stringify({
      staff: {
        id: staffRecord.id, username: staffRecord.username,
        name: staffRecord.name, role: staffRecord.role,
        is_superadmin: staffRecord.is_superadmin,
      },
      store: { id: store.id, code: store.code, name: store.name }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[verify-password]', err)
    const corsHeaders = getCorsHeaders(req)
    return new Response(JSON.stringify({ error: '伺服器錯誤' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})