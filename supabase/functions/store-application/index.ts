// =============================================================================
// store-application — 公開的店家申請收件端點
//
// 申請頁是免登入的公開頁面，所以不讓前端拿 anon key 直接 insert：
// 那等於把寫入能力發到網路上，機器人幾分鐘就能灌爆一張表。走這支 function
// 才能做格式驗證與頻率限制，而且 store_applications 對 anon 完全關閉
// （RLS 開啟、零 policy），只有這裡用 service key 進得去。
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

/* 同一支電話 24 小時內最多 3 次、同一個 IP 最多 10 次。
 * 抓得鬆是故意的——真的有心要灌還是擋不住，這道只是讓隨手的濫用不划算，
 * 同時避免店家手殘連按被當成攻擊。 */
const MAX_PER_PHONE = 3
const MAX_PER_IP    = 10
const WINDOW_HOURS  = 24

const PHONE_RE = /^0\d{8,9}$/          // 市話 09xxxxxxxx / 0x-xxxxxxx，統一去掉符號後比對
const TAXID_RE = /^\d{8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(v: unknown, max: number): string {
  return String(v ?? '').trim().slice(0, max)
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  try {
    const body = await req.json()

    const storeName = clean(body.storeName, 60)
    const ownerName = clean(body.ownerName, 40)
    const phoneRaw  = clean(body.phone, 30)
    const phone     = phoneRaw.replace(/[\s()-]/g, '')
    const email     = clean(body.email, 120)
    const taxId     = clean(body.taxId, 8)
    const address   = clean(body.address, 200)
    const note      = clean(body.note, 500)
    const bizType   = clean(body.businessType, 30) || 'restaurant'

    if (!storeName || !ownerName || !phone) {
      return json({ error: '店名、聯絡人、電話為必填' }, 400)
    }
    if (!PHONE_RE.test(phone)) {
      return json({ error: '電話格式不正確' }, 400)
    }
    if (email && !EMAIL_RE.test(email)) {
      return json({ error: 'Email 格式不正確' }, 400)
    }
    if (taxId && !TAXID_RE.test(taxId)) {
      return json({ error: '統一編號須為 8 位數字' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString()

    const { count: phoneCount } = await supabase
      .from('store_applications')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone).gte('created_at', since)

    if ((phoneCount ?? 0) >= MAX_PER_PHONE) {
      return json({ error: '這支電話今天已經送出過申請，我們會盡快與您聯繫' }, 429)
    }

    if (ip) {
      const { count: ipCount } = await supabase
        .from('store_applications')
        .select('id', { count: 'exact', head: true })
        .eq('source_ip', ip).gte('created_at', since)
      if ((ipCount ?? 0) >= MAX_PER_IP) {
        return json({ error: '送出次數過多，請稍後再試' }, 429)
      }
    }

    const { error } = await supabase.from('store_applications').insert({
      store_name: storeName, owner_name: ownerName, phone,
      email: email || null, tax_id: taxId || null, address: address || null,
      business_type: bizType, note: note || null, source_ip: ip,
    })

    if (error) {
      console.error('[store-application] 寫入失敗', error)
      return json({ error: '送出失敗，請稍後再試' }, 500)
    }

    return json({ ok: true })
  } catch (e) {
    console.error('[store-application] 例外', e)
    return json({ error: '送出失敗，請稍後再試' }, 500)
  }
})
