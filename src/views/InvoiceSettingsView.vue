<template>
  <div class="iv">
    <SettingsSidebar />
    <div class="iv__main">
      <AppTopbar :show-floor-tabs="false" />

      <div class="iv__content">
        <div class="iv__header">
          <h2>電子發票設定</h2>
          <button class="iv__save-btn" :disabled="saving" @click="handleSave">
            {{ saving ? '儲存中...' : '儲存修改' }}
          </button>
        </div>

        <div v-if="loading" class="iv__loading">載入中…</div>

        <template v-else>
          <!-- 啟用開關 -->
          <div class="iv__row iv__row--toggle">
            <label class="iv__toggle-label">
              <div class="iv__toggle" :class="{ 'iv__toggle--on': form.enabled }" @click="form.enabled = !form.enabled">
                <div class="iv__toggle-thumb" />
              </div>
              <span>啟用電子發票</span>
            </label>
          </div>

          <div class="iv__section">
            <!-- 公司資訊 -->
            <div class="iv__row">
              <div class="iv__label">公司登記名稱</div>
              <input v-model="form.company_name" class="iv__input" placeholder="請輸入公司登記名稱" />
            </div>
            <div class="iv__row">
              <div class="iv__label">公司統一編號</div>
              <input v-model="form.tax_id" class="iv__input" placeholder="請輸入公司統一編號" maxlength="8" />
            </div>
            <div class="iv__row">
              <div class="iv__label">稅別</div>
              <select v-model="form.tax_type" class="iv__select">
                <option value="taxable">應稅</option>
                <option value="zero">零稅率</option>
                <option value="exempt">免稅</option>
              </select>
            </div>
            <div class="iv__row">
              <div class="iv__label">稅率 (%)</div>
              <input v-model.number="form.tax_rate" class="iv__input" type="number" min="0" max="100" />
            </div>
          </div>

          <div class="iv__section">
            <!-- 加值中心 -->
            <div class="iv__row">
              <div class="iv__label">加值中心</div>
              <select v-model="form.provider" class="iv__select">
                <option value="ecpay">綠界</option>
                <option value="allpay">匯智</option>
                <option value="opay">歐付寶</option>
                <option value="unison">統一資訊</option>
              </select>
            </div>

            <!-- 綠界設定 -->
            <template v-if="form.provider === 'ecpay'">
              <div class="iv__row">
                <div class="iv__label">MerchantID</div>
                <input v-model="form.merchant_id" class="iv__input" placeholder="特店編號" />
              </div>
              <div class="iv__row">
                <div class="iv__label">HashKey</div>
                <input v-model="form.hash_key" class="iv__input" placeholder="HashKey" type="password" />
              </div>
              <div class="iv__row">
                <div class="iv__label">HashIV</div>
                <input v-model="form.hash_iv" class="iv__input" placeholder="HashIV" type="password" />
              </div>
            </template>

            <div class="iv__row">
              <div class="iv__label">發票 POS ID</div>
              <input v-model="form.pos_id" class="iv__input" placeholder="選填" />
            </div>
            <div class="iv__row">
              <div class="iv__label">剩餘發票號碼數</div>
              <div class="iv__value">
                {{ form.remain_count }}
                <button class="iv__remain-refresh" :disabled="remainSyncing" @click="handleSyncRemainCount">
                  {{ remainSyncing ? '查詢中...' : '重新查詢' }}
                </button>
                <span v-if="remainSyncError" class="iv__remain-error">{{ remainSyncError }}</span>
              </div>
            </div>
            <div class="iv__row">
              <div class="iv__label">環境</div>
              <label class="iv__toggle-label">
                <div class="iv__toggle iv__toggle--sm" :class="{ 'iv__toggle--on': form.is_test }" @click="form.is_test = !form.is_test">
                  <div class="iv__toggle-thumb" />
                </div>
                <span style="font-size:13px;color:#7a6850">{{ form.is_test ? '測試環境' : '正式環境' }}</span>
              </label>
            </div>
            <div class="iv__row">
              <div class="iv__label">混合稅率資格</div>
              <label class="iv__toggle-label">
                <div class="iv__toggle iv__toggle--sm" :class="{ 'iv__toggle--on': form.mixed_tax_approved }" @click="form.mixed_tax_approved = !form.mixed_tax_approved">
                  <div class="iv__toggle-thumb" />
                </div>
                <span style="font-size:13px;color:#7a6850">{{ form.mixed_tax_approved ? '已取得核可' : '尚未取得核可' }}</span>
              </label>
            </div>
            <p class="iv__mixed-tax-hint">
              ⚠️ 訂單同時包含應稅與免稅/零稅率商品時，須開立「混合稅率」發票(TaxType=9)，
              財政部規定這需要事先申請核可。請先跟綠界業務／財政部確認貴店已核准後，再打開這個開關；
              沒打開的話，遇到混合稅率訂單開票會直接被系統擋下，不會誤開一張沒有資格開的發票。
            </p>
          </div>

          <!-- 開機檢核 -->
          <div class="iv__boot-check">
            <div class="iv__boot-check-header">
              <span>開機檢核</span>
              <button class="iv__boot-check-btn" :disabled="bootChecking" @click="handleBootCheck">
                {{ bootChecking ? '檢核中...' : '重新檢核' }}
              </button>
            </div>
            <div v-if="bootResult" class="iv__boot-check-items">
              <div v-for="item in bootResult.items" :key="item.label" class="iv__boot-check-item">
                <span class="iv__boot-check-icon" :class="item.ok ? 'ok' : 'fail'">{{ item.ok ? '✓' : '✗' }}</span>
                <span class="iv__boot-check-label">{{ item.label }}</span>
                <span class="iv__boot-check-detail">{{ item.detail }}</span>
              </div>
            </div>
          </div>

          <!-- 測試提示 -->
          <div v-if="form.is_test" class="iv__test-notice">
            ⚠️ 目前為測試環境，開立的發票不具法律效力。確認所有設定正確後，請切換為正式環境。
          </div>

          <!-- 儲存成功提示 -->
          <div v-if="saved" class="iv__success">✓ 設定已儲存</div>
          <div v-if="saveError" class="iv__error">{{ saveError }}</div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useInvoiceBootCheck } from '@/composables/useInvoiceBootCheck.js'
import { useInvoice } from '@/composables/useInvoice.js'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import { supabase }    from '@/lib/supabase.js'
import { useAuthStore } from '@/stores/authStore.js'

const authStore = useAuthStore()
const loading   = ref(true)
const saving    = ref(false)
const saved     = ref(false)
const saveError = ref('')
const remainSyncing   = ref(false)
const remainSyncError = ref('')

const form = ref({
  enabled:      false,
  company_name: '',
  tax_id:       '',
  tax_type:     'taxable',
  tax_rate:     5,
  provider:     'ecpay',
  merchant_id:  '2000132',
  hash_key:     'ejCk326UnaZWKisg',
  hash_iv:      'q9jcZX8Ib9LM8wYk',
  pos_id:       '',
  remain_count: 0,
  is_test:      true,
  mixed_tax_approved: false,
})

onMounted(async () => {
  const storeId = authStore.store?.id
  if (!storeId) { loading.value = false; return }

  const { data } = await supabase
    .from('invoice_settings')
    .select('*')
    .eq('store_id', storeId)
    .maybeSingle()

  if (data) {
    form.value = {
      enabled:      data.enabled,
      company_name: data.company_name ?? '',
      tax_id:       data.tax_id ?? '',
      tax_type:     data.tax_type ?? 'taxable',
      tax_rate:     data.tax_rate ?? 5,
      provider:     data.provider ?? 'ecpay',
      merchant_id:  data.merchant_id ?? '2000132',
      hash_key:     data.hash_key ?? 'ejCk326UnaZWKisg',
      hash_iv:      data.hash_iv ?? 'q9jcZX8Ib9LM8wYk',
      pos_id:       data.pos_id ?? '',
      remain_count: data.remain_count ?? 0,
      is_test:      data.is_test ?? true,
      mixed_tax_approved: data.mixed_tax_approved ?? false,
    }
  }
  loading.value = false

  // 進入頁面時自動跑一次開機檢核
  await handleBootCheck()
})

const { checking: bootChecking, result: bootResult, runBootCheck } = useInvoiceBootCheck()

async function handleBootCheck() {
  await runBootCheck()
}

const { syncRemainCount } = useInvoice()

async function handleSyncRemainCount() {
  remainSyncing.value   = true
  remainSyncError.value = ''
  const result = await syncRemainCount()
  if (result.ok) {
    form.value.remain_count = result.remainCount
  } else {
    remainSyncError.value = result.error || '查詢失敗'
  }
  remainSyncing.value = false
}

async function handleSave() {
  saving.value   = true
  saved.value    = false
  saveError.value = ''
  const storeId = authStore.store?.id
  if (!storeId) { saving.value = false; return }

  const { error } = await supabase
    .from('invoice_settings')
    .upsert({
      store_id:     storeId,
      ...form.value,
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'store_id' })

  if (error) {
    saveError.value = '儲存失敗：' + error.message
  } else {
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  }
  saving.value = false
}
</script>

<style scoped>
.iv { width: 100%; height: 100%; display: flex; overflow: hidden; }
.iv__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.iv__content { flex: 1; overflow-y: auto; padding: 24px 32px; background: var(--color-bg-map); }
.iv__header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
.iv__header h2 { font-size: 20px; font-weight: 600; color: var(--color-text-primary); margin: 0; }
.iv__save-btn {
  padding: 10px 24px; background: #c08020; color: #fff;
  border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;
}
.iv__save-btn:hover:not(:disabled) { background: #a06818; }
.iv__save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.iv__loading { color: var(--color-text-muted); padding: 40px; text-align: center; }

.iv__row--toggle {
  background: #fff; border: 1px solid #e8dcc8; border-radius: 10px;
  padding: 16px 20px; margin-bottom: 12px;
}
.iv__toggle-label { display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 15px; font-weight: 500; color: var(--color-text-primary); }
.iv__toggle { width: 44px; height: 26px; border-radius: 13px; background: #d0c8b8; position: relative; transition: background 0.2s; flex-shrink: 0; cursor: pointer; }
.iv__toggle--on { background: #c08020; }
.iv__toggle--sm { width: 36px; height: 22px; }
.iv__toggle-thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
.iv__toggle--on .iv__toggle-thumb { transform: translateX(18px); }
.iv__toggle--sm .iv__toggle-thumb { width: 16px; height: 16px; top: 3px; left: 3px; }
.iv__toggle--on.iv__toggle--sm .iv__toggle-thumb { transform: translateX(14px); }

.iv__section { background: #fff; border: 1px solid #e8dcc8; border-radius: 10px; overflow: hidden; margin-bottom: 12px; }
.iv__row { display: flex; align-items: center; padding: 14px 20px; border-bottom: 1px solid #f0e8d8; min-height: 52px; }
.iv__row:last-child { border-bottom: none; }
.iv__label { width: 180px; flex-shrink: 0; font-size: 14px; color: var(--color-text-secondary); }
.iv__input { flex: 1; border: none; outline: none; font-size: 15px; color: var(--color-text-primary); background: transparent; }
.iv__input::placeholder { color: #c0b8a8; }
.iv__select { flex: 1; border: none; outline: none; font-size: 15px; color: var(--color-text-primary); background: transparent; cursor: pointer; }
.iv__value { flex: 1; font-size: 15px; color: var(--color-text-primary); }

.iv__boot-check {
  background: #fff; border: 1px solid #e8dcc8; border-radius: 10px;
  padding: 14px 20px; margin-bottom: 12px;
}
.iv__boot-check-header {
  display: flex; align-items: center; justify-content: space-between;
  font-size: 13px; font-weight: 600; color: var(--color-text-primary);
  margin-bottom: 8px;
}
.iv__boot-check-btn {
  font-size: 12px; padding: 4px 12px; border-radius: 6px;
  background: #f0e8d8; color: #7a6850; border: 1px solid #c8b89a;
}
.iv__boot-check-btn:hover:not(:disabled) { background: #e8dcc8; }
.iv__boot-check-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.iv__remain-refresh {
  font-size: 11.5px; padding: 3px 10px; border-radius: 6px; margin-left: 10px;
  background: #f0e8d8; color: #7a6850; border: 1px solid #c8b89a;
}
.iv__remain-refresh:hover:not(:disabled) { background: #e8dcc8; }
.iv__remain-refresh:disabled { opacity: 0.6; cursor: not-allowed; }
.iv__remain-error { font-size: 11.5px; color: #c0392b; margin-left: 8px; }
.iv__boot-check-items { display: flex; flex-direction: column; gap: 6px; }
.iv__boot-check-item { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
.iv__boot-check-icon { width: 16px; text-align: center; font-weight: 700; }
.iv__boot-check-icon.ok   { color: #2a7a3a; }
.iv__boot-check-icon.fail { color: #c0392b; }
.iv__boot-check-label  { min-width: 110px; color: var(--color-text-secondary); }
.iv__boot-check-detail { color: var(--color-text-muted); }

.iv__test-notice {
  background: #fff8e6; border: 1px solid #e8c840; border-radius: 10px;
  padding: 12px 16px; font-size: 13px; color: #806010; margin-bottom: 12px;
}
.iv__mixed-tax-hint {
  font-size: 11.5px; color: #8a6020; line-height: 1.6;
  padding: 8px 4px 0; margin: 0;
}
.iv__success { color: #2a7a3a; background: #e8f8ec; border-radius: 8px; padding: 10px 16px; font-size: 13px; text-align: center; }
.iv__error   { color: #c0392b; background: #fde8e8; border-radius: 8px; padding: 10px 16px; font-size: 13px; text-align: center; }
</style>