// @ts-nocheck
/**
 * VisionPOS — Uber Eats Webhook 接收端
 * 部署方式：supabase functions deploy uber-eats-webhook
 *
 * Supabase Dashboard → Edge Functions → Secrets 需要設定：
 *   UBER_CLIENT_ID       ← 從 Uber Developer Portal 取得
 *   UBER_CLIENT_SECRET   ← 從 Uber Developer Portal 取得
 *   UBER_WEBHOOK_SECRET  ← 同一個 client_secret，用來驗 X-Uber-Signature
 *
 * Uber Developer Dashboard → Webhooks → Primary Webhook URL 填入：
 *   https://<your-project>.supabase.co/functions/v1/uber-eats-webhook
 */

import { serve }        from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UBER_CLIENT_ID     = Deno.env.get('UBER_CLIENT_ID')     ?? ''
const UBER_CLIENT_SECRET = Deno.env.get('UBER_CLIENT_SECRET') ?? ''
const UBER_WEBHOOK_SECRET = Deno.env.get('UBER_WEBHOOK_SECRET') ?? UBER_CLIENT_SECRET

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

/* ── Uber OAuth2 Token（client credentials，每次取、不快取，夠簡單可靠） ── */
async function getToken(): Promise<string> {
  const res = await fetch('https://auth.uber.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     UBER_CLIENT_ID,
      client_secret: UBER_CLIENT_SECRET,
      grant_type:    'client_credentials',
      scope:         'eats.order',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`[uber] token 失敗: ${JSON.stringify(data)}`)
  return data.access_token
}

/* ── 抓完整訂單詳情 ── */
async function fetchOrder(orderId: string, token: string) {
  const res = await fetch(`https://api.uber.com/v2/eats/order/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`[uber] 取訂單失敗 ${res.status}`)
  return res.json()
}

/* ── 接單（必須在 11.5 分鐘內呼叫，否則自動取消） ── */
async function acceptOrder(orderId: string, token: string) {
  const res = await fetch(`https://api.uber.com/v2/eats/orders/${orderId}/accept_pos_order`, {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[uber] 接單失敗 ${orderId}:`, body)
  }
}

/* ── 驗 X-Uber-Signature（HMAC-SHA256） ── */
async function verifySignature(body: string, signature: string): Promise<boolean> {
  if (!UBER_WEBHOOK_SECRET || !signature) return false
  const enc     = new TextEncoder()
  const key     = await crypto.subtle.importKey('raw', enc.encode(UBER_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf  = await crypto.subtle.sign('HMAC', key, enc.encode(body))
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('')
  return expected === signature.toLowerCase()
}

/* ── 把 Uber 訂單格式轉成 VisionPOS 的品項格式 ── */
function normalizeItems(cart: any): Array<{ name: string; qty: number; price: number }> {
  if (!cart?.items) return []
  return cart.items.map((item: any) => ({
    name:  item.title ?? item.name ?? '（未知品項）',
    qty:   item.quantity ?? 1,
    price: Math.round((item.price?.unit_price?.amount ?? 0) / 100),  // Uber 用分（分 → 元）
  }))
}

/* ── 每日取單號 ── */
async function nextPickupNumber(): Promise<number | null> {
  const { data, error } = await supabase.rpc('next_pickup_number')
  if (error) { console.error('[pickup] 取號失敗', error); return null }
  return data
}

/* ── 主處理邏輯 ── */
serve(async (req) => {
  const rawBody  = await req.text()
  const sig      = req.headers.get('x-uber-signature') ?? ''
  const isValid  = await verifySignature(rawBody, sig)

  /* 驗簽失敗：回 401 讓 Uber 重試 */
  if (!isValid) {
    console.warn('[uber] 簽名驗證失敗，可能是非法來源')
    return new Response('Unauthorized', { status: 401 })
  }

  const event = JSON.parse(rawBody)
  console.log('[uber] webhook 收到:', event.event_type, event.meta?.resource_id)

  /* 目前只處理新訂單通知，其他類型直接回 200 */
  if (event.event_type !== 'orders.notification') {
    return new Response('OK', { status: 200 })
  }

  const orderId = event.meta?.resource_id
  if (!orderId) {
    console.error('[uber] 缺少 resource_id')
    return new Response('OK', { status: 200 })
  }

  try {
    const token = await getToken()

    /* 立刻接單，避免逾時取消 */
    await acceptOrder(orderId, token)

    /* 取完整訂單資料 */
    const order = await fetchOrder(orderId, token)

    const items    = normalizeItems(order.cart)
    const total    = Math.round((order.payment?.charges?.total?.amount ?? 0) / 100)
    const subtotal = Math.round((order.payment?.charges?.subtotal?.amount ?? 0) / 100)
    const pickup   = await nextPickupNumber()

    /* 存進 delivery_orders 表（若已存在就更新狀態） */
    const { error } = await supabase.from('delivery_orders').upsert({
      id:               orderId,
      pickup_number:    pickup,
      customer_name:    order.eater?.first_name ?? null,
      customer_phone:   order.eater?.phone_number ? `+${order.eater.phone_code}${order.eater.phone_number}` : null,
      delivery_address: order.delivery?.location?.address ?? null,
      items,
      note:             order.cart?.special_instructions ?? null,
      subtotal,
      total,
      status:           'pending',
      uber_status:      order.current_state ?? null,
      raw_payload:      order,
    })

    if (error) console.error('[uber] 存訂單失敗', error)
    else console.log(`[uber] 訂單 ${orderId} 接單完成，取單號 ${pickup}`)

  } catch (e) {
    console.error('[uber] 處理訂單失敗', e)
    /* 仍回 200，避免 Uber 持續重試造成重複接單 */
  }

  return new Response('OK', { status: 200 })
})