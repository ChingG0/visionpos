<template>
  <div class="ps">
    <SettingsSidebar />
    <div class="ps__main">
      <AppTopbar :show-floor-tabs="false" />
      <div class="ps__content">
        <div class="ps__header">
          <h2>付款設定</h2>
          <button class="ps__save-btn" :disabled="saving" @click="handleSave">
            {{ saving ? '儲存中...' : '儲存修改' }}
          </button>
        </div>

        <div v-if="loading" class="ps__loading">載入中…</div>

        <template v-else>
          <!-- 現金（固定啟用） -->
          <div class="ps__section">
            <div class="ps__row ps__row--toggle">
              <div class="ps__label-group">
                <div class="ps__method-name">💵 現金</div>
                <div class="ps__method-desc">固定啟用，無法關閉</div>
              </div>
              <div class="ps__toggle ps__toggle--on ps__toggle--disabled">
                <div class="ps__toggle-thumb" />
              </div>
            </div>
          </div>

          <!-- 信用卡 -->
          <div class="ps__section">
            <div class="ps__row ps__row--toggle">
              <div class="ps__label-group">
                <div class="ps__method-name">💳 信用卡</div>
                <div class="ps__method-desc">刷卡機付款，結帳時需輸入卡片後4碼</div>
              </div>
              <div class="ps__toggle" :class="{ 'ps__toggle--on': form.card_enabled }" @click="form.card_enabled = !form.card_enabled">
                <div class="ps__toggle-thumb" />
              </div>
            </div>
          </div>

          <!-- LINE Pay -->
          <div class="ps__section">
            <div class="ps__row ps__row--toggle">
              <div class="ps__label-group">
                <div class="ps__method-name">📱 LINE Pay</div>
                <div class="ps__method-desc">掃碼付款，需填入串接參數</div>
              </div>
              <div class="ps__toggle" :class="{ 'ps__toggle--on': form.linepay_enabled }" @click="form.linepay_enabled = !form.linepay_enabled">
                <div class="ps__toggle-thumb" />
              </div>
            </div>

            <template v-if="form.linepay_enabled">
              <div class="ps__divider" />
              <div class="ps__sub-title">串接參數</div>
              <div class="ps__row">
                <div class="ps__label">Channel ID</div>
                <input v-model="form.linepay_channel_id" class="ps__input" placeholder="請輸入 Channel ID" />
              </div>
              <div class="ps__row">
                <div class="ps__label">Channel Secret Key</div>
                <input v-model="form.linepay_channel_secret" class="ps__input" placeholder="請輸入 Channel Secret Key" type="password" />
              </div>
              <div class="ps__row">
                <div class="ps__label">Device Type</div>
                <input v-model="form.linepay_device_type" class="ps__input" placeholder="設備類型" />
              </div>
              <div class="ps__row">
                <div class="ps__label">Device Profile ID</div>
                <input v-model="form.linepay_device_profile_id" class="ps__input" placeholder="設備編號" />
              </div>
              <div class="ps__row">
                <div class="ps__label">環境</div>
                <label class="ps__toggle-label">
                  <div class="ps__toggle ps__toggle--sm" :class="{ 'ps__toggle--on': form.linepay_is_test }" @click="form.linepay_is_test = !form.linepay_is_test">
                    <div class="ps__toggle-thumb" />
                  </div>
                  <span class="ps__env-label">{{ form.linepay_is_test ? '測試環境 (Sandbox)' : '正式環境' }}</span>
                </label>
              </div>
              <div v-if="form.linepay_is_test" class="ps__test-notice">
                ⚠️ 測試環境不會實際扣款
              </div>
            </template>
          </div>

          <!-- 稍後付款（固定啟用） -->
          <div class="ps__section">
            <div class="ps__row ps__row--toggle">
              <div class="ps__label-group">
                <div class="ps__method-name">🕐 稍後付款</div>
                <div class="ps__method-desc">先送單，稍後再結帳</div>
              </div>
              <div class="ps__toggle ps__toggle--on ps__toggle--disabled">
                <div class="ps__toggle-thumb" />
              </div>
            </div>
          </div>

          <!-- 時價結帳 -->
          <div class="ps__section">
            <div class="ps__row ps__row--toggle">
              <div class="ps__label-group">
                <div class="ps__method-name">⚖️ 時價結帳</div>
                <div class="ps__method-desc">秤重商品用，結帳時輸入商品名稱與金額，不需事先建立單價</div>
              </div>
              <div class="ps__toggle" :class="{ 'ps__toggle--on': form.market_price_enabled }" @click="form.market_price_enabled = !form.market_price_enabled">
                <div class="ps__toggle-thumb" />
              </div>
            </div>
            <div v-if="form.market_price_enabled" class="ps__test-notice">
              儲存後，點餐頁會多出「時價商品」分類。第一次使用時系統會自動建立這個分類。
            </div>
          </div>

          <div v-if="saved" class="ps__success">✓ 設定已儲存</div>
          <div v-if="saveError" class="ps__error">{{ saveError }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import { supabase }    from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'
import { useStoreSettingsStore } from '@/stores/storeSettingsStore.js'
import { useMenuStore } from '@/stores/menuStore.js'

const authStore = useAuthStore()
const loading   = ref(true)
const saving    = ref(false)
const saved     = ref(false)
const saveError = ref('')

const form = ref({
  card_enabled:              false,
  linepay_enabled:           false,
  linepay_channel_id:        '',
  linepay_channel_secret:    '',
  linepay_device_type:       'POS',
  linepay_device_profile_id: '',
  linepay_is_test:           true,
  market_price_enabled:      false,
})

onMounted(async () => {
  const storeId = authStore.store?.id
  if (!storeId) { loading.value = false; return }
  const { data } = await supabase
    .from('payment_settings').select('*').eq('store_id', storeId).maybeSingle()
  if (data) Object.assign(form.value, data)
  loading.value = false
})

async function handleSave() {
  saving.value    = true
  saved.value     = false
  saveError.value = ''
  const storeId = authStore.store?.id
  const { error } = await supabase
    .from('payment_settings')
    .upsert({ store_id: storeId, ...form.value, updated_at: new Date().toISOString() }, { onConflict: 'store_id' })
  if (error) saveError.value = '儲存失敗：' + error.message
  else {
    // 結帳畫面是讀快取的，這裡改完要重新載入才會立刻反映
    await useStoreSettingsStore().init(true)
    // 打開時價結帳時順手把「時價商品」分類準備好，店員才不用自己去商品管理建一個。
    // ensureMarketCategory 內部會先檢查有沒有，重複儲存不會重複建立。
    if (form.value.market_price_enabled) {
      const menuStore = useMenuStore()
      await menuStore.init()
      await menuStore.ensureMarketCategory()
    }
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  }
  saving.value = false
}
</script>

<style scoped>
.ps { width: 100%; height: 100%; display: flex; overflow: hidden; }
.ps__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.ps__content { flex: 1; overflow-y: auto; padding: 24px 32px; background: var(--color-bg-map); }
.ps__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.ps__header h2 { font-size: 20px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.ps__save-btn { padding: 10px 24px; background: #c08020; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
.ps__save-btn:hover:not(:disabled) { background: #a06818; }
.ps__save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ps__loading { color: var(--color-text-muted); padding: 40px; text-align: center; }

.ps__section { background: #fff; border: 1px solid #e8dcc8; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
.ps__row { display: flex; align-items: center; padding: 16px 20px; border-bottom: 1px solid #f0e8d8; min-height: 56px; }
.ps__row:last-child { border-bottom: none; }
.ps__row--toggle { justify-content: space-between; }
.ps__label-group { display: flex; flex-direction: column; gap: 2px; }
.ps__method-name { font-size: 15px; font-weight: 600; color: var(--color-text-primary); }
.ps__method-desc { font-size: 12px; color: var(--color-text-muted); }
.ps__label { width: 180px; flex-shrink: 0; font-size: 14px; color: var(--color-text-secondary); }
.ps__input { flex: 1; border: none; outline: none; font-size: 15px; color: var(--color-text-primary); background: transparent; }
.ps__input::placeholder { color: #c0b8a8; }
.ps__divider { height: 1px; background: #f0e8d8; margin: 0 20px; }
.ps__sub-title { font-size: 11px; font-weight: 600; color: #a09080; text-transform: uppercase; letter-spacing: 0.05em; padding: 10px 20px 4px; }

.ps__toggle { width: 44px; height: 26px; border-radius: 13px; background: #d0c8b8; position: relative; transition: background 0.2s; flex-shrink: 0; cursor: pointer; }
.ps__toggle--on { background: #c08020; }
.ps__toggle--disabled { opacity: 0.6; cursor: not-allowed; pointer-events: none; }
.ps__toggle--sm { width: 36px; height: 22px; }
.ps__toggle-thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.ps__toggle--on .ps__toggle-thumb { transform: translateX(18px); }
.ps__toggle--sm .ps__toggle-thumb { width: 16px; height: 16px; }
.ps__toggle--on.ps__toggle--sm .ps__toggle-thumb { transform: translateX(14px); }
.ps__toggle-label { display: flex; align-items: center; gap: 10px; cursor: pointer; }
.ps__env-label { font-size: 13px; color: #7a6850; }
.ps__test-notice { background: #fff8e6; border-top: 1px solid #f0e8d8; padding: 10px 20px; font-size: 12px; color: #806010; }
.ps__success { color: #2a7a3a; background: #e8f8ec; border-radius: 8px; padding: 10px 16px; font-size: 13px; text-align: center; margin-top: 12px; }
.ps__error   { color: #c0392b; background: #fde8e8; border-radius: 8px; padding: 10px 16px; font-size: 13px; text-align: center; margin-top: 12px; }
</style>