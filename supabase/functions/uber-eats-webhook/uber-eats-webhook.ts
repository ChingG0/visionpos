// =============================================================================
// Supabase Edge Function: uber-eats-webhook
// 部署到：supabase/functions/uber-eats-webhook/index.ts
// 接收 Uber Eats 訂單 Webhook，寫入 delivery_orders
// =============================================================================
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-uber-signature',
}

// Uber Eats 設定（申請到 API 後填入）
const UBER_CLIENT_ID     = Deno.env.get('UBER_CLIENT_ID')     ?? ''
const UBER_CLIENT_SECRET = Deno.env.get('UBER_CLIENT_SECRET') ?? ''
const UBER_STORE_ID      = Deno.env.get('UBER_STORE_ID')      ?? ''

// POS store_id（小滿湯拌滷）
// 之後多店可以用 UBER_STORE_ID 對應到 POS store_id
const POS_STORE_MAP: Record<string, string> = {
  [UBER_STORE_ID]: '5bf71f43-9552-4372-b83d-dc62502ad7f1',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const payload = JSON.parse(body)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const eventType = payload.event_type ?? payload.type

    // ── 新訂單 ────────────────────────────────────────────────────────────────
    if (eventType === 'eats.order.scheduled' || eventType === 'eats.order.notification') {
      const order    = payload.meta ?? payload.order ?? payload
      const uberOrderId = order.id ?? order.order_id
      const uberStoreId = order.store_id ?? UBER_STORE_ID
      const storeId     = POS_STORE_MAP[uberStoreId] ?? Object.values(POS_STORE_MAP)[0]

      // 解析品項
      const items = (order.cart?.items ?? order.items ?? []).map((item: Record<string, unknown>) => ({
        name:       item.title ?? item.name,
        qty:        item.quantity ?? 1,
        price:      (item.price?.unit_price?.amount ?? item.price ?? 0) / 100,
        menuItemId: item.external_data ?? item.id,
        code:       '',
        icon:       '🛵',
      }))

      const subtotal = items.reduce((s: number, i: { qty: number; price: number }) => s + i.qty * i.price, 0)

      const { error: insertErr } = await supabase
        .from('delivery_orders')
        .upsert({
          store_id:        storeId,
          uber_order_id:   uberOrderId,
          uber_store_id:   uberStoreId,
          uber_status:     'pending',
          uber_raw:        order,
          customer_name:   order.eater?.first_name
                           ? `${order.eater.first_name} ${order.eater.last_name ?? ''}`.trim()
                           : null,
          customer_phone:  order.eater?.phone_code
                           ? `${order.eater.phone_code}${order.eater.phone}` : null,
          delivery_address: order.delivery?.location?.address ?? null,
          items,
          subtotal,
          total:           subtotal,
          status:          'pending',
          pickup_number:   uberOrderId?.slice(-5).toUpperCase(),
          note:            order.special_instructions ?? null,
        }, { onConflict: 'uber_order_id' })

      if (insertErr) {
        console.error('[uber-webhook] 寫入失敗', insertErr)
        return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: corsHeaders })
      }
    }

    // ── 訂單取消 ──────────────────────────────────────────────────────────────
    if (eventType === 'eats.order.cancel') {
      const uberOrderId = payload.meta?.id ?? payload.order_id
      await supabase
        .from('delivery_orders')
        .update({ status: 'cancelled', uber_status: 'cancelled' })
        .eq('uber_order_id', uberOrderId)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[uber-webhook]', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: corsHeaders
    })
  }
})