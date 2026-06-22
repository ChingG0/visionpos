// =============================================================================
// useHeartbeat.js
// visionpos/src/composables/useHeartbeat.js
// =============================================================================
import { onUnmounted } from 'vue'
import { supabase } from '@/lib/supabase.js'

const INTERVAL = 2 * 60 * 1000  // 每 2 分鐘

function getDeviceId() {
  let id = localStorage.getItem('visionpos_device_id')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('visionpos_device_id', id)
  }
  return id
}

export function useHeartbeat() {
  let timer = null

  async function sendHeartbeat() {
    // 從 localStorage 取得目前登入的 store_id
    const raw = localStorage.getItem('visionpos_auth')
    if (!raw) return
    const { s } = JSON.parse(raw)
    if (!s?.id) return

    const deviceToken = getDeviceId()

    await supabase.from('store_devices').upsert(
      {
        store_id:       s.id,
        device_token:   deviceToken,
        device_name:    `POS-${deviceToken.slice(0, 8).toUpperCase()}`,
        device_type:    'pos',
        pos_version:    '1.0.0',
        last_online_at: new Date().toISOString(),
        status:         'active',
      },
      { onConflict: 'device_token' }
    )
    console.log('[Heartbeat] ✓', new Date().toLocaleTimeString('zh-TW'))
  }

  function startHeartbeat() {
    sendHeartbeat()
    timer = setInterval(sendHeartbeat, INTERVAL)
  }

  function stopHeartbeat() {
    if (timer) clearInterval(timer)
  }

  onUnmounted(stopHeartbeat)

  return { startHeartbeat, stopHeartbeat, sendHeartbeat }
}