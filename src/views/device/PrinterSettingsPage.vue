<template>
  <div class="ps">

    <!-- ── 連線設定 ── -->
    <section class="ps__section">
      <h2 class="ps__section-title">🖨 連線設定</h2>
      <div class="ps__field">
        <label class="ps__label">印表機 IP 位址</label>
        <div class="ps__row">
          <input v-model="ip" class="ps__input" type="text" placeholder="192.168.0.100" @keydown.enter="testIp" />
          <button class="ps__btn-test" :disabled="testing" @click="testIp">
            {{ testing ? '測試中...' : '測試連線' }}
          </button>
        </div>
        <p v-if="ipStatus === true"  class="ps__hint ps__hint--ok">✓ 出單機已連線</p>
        <p v-if="ipStatus === false" class="ps__hint ps__hint--err">✗ 連線失敗，確認出單機是否開機且在同一個網路</p>
      </div>
      <div class="ps__field">
        <label class="ps__label">紙張寬度</label>
        <div class="ps__radio-row">
          <label class="ps__radio-label"><input type="radio" v-model="layout.paperWidth" value="58" /> 58mm</label>
          <label class="ps__radio-label"><input type="radio" v-model="layout.paperWidth" value="80" /> 80mm</label>
        </div>
      </div>
    </section>

    <!-- ── Logo ── -->
    <section class="ps__section">
      <h2 class="ps__section-title">🖼 Logo</h2>
      <p class="ps__section-hint">建議使用純黑白 PNG，寬度不超過 300px，印出效果較清晰</p>

      <!-- 目前 Logo 預覽 -->
      <div v-if="currentLogo" class="ps__logo-preview">
        <img :src="currentLogo" class="ps__logo-img" alt="目前 Logo" />
        <button class="ps__btn-remove" @click="removeLogo">移除 Logo</button>
      </div>
      <div v-else class="ps__logo-empty">尚未設定 Logo</div>

      <label class="ps__upload-btn">
        {{ currentLogo ? '更換 Logo' : '上傳 Logo' }}
        <input type="file" accept="image/*" class="ps__file-input" @change="handleLogoUpload" />
      </label>

      <!-- 首頁 URL -->
      <div class="ps__field" style="margin-top:14px">
        <label class="ps__label">🔗 首頁連結 URL</label>
        <input
          v-model="homepageUrl"
          class="ps__input"
          type="url"
          placeholder="https://your-restaurant.com"
        />
        <p class="ps__section-hint" style="margin-top:4px">點擊側邊欄 Logo 時開啟此連結</p>
      </div>
    </section>

    <!-- ── 店家資訊 ── -->
    <section class="ps__section">
      <h2 class="ps__section-title">🏪 店家資訊</h2>
      <p class="ps__section-hint">店名印在 Logo 下方（頁首），地址和電話印在感謝詞下方（頁尾）</p>
      <div class="ps__field">
        <label class="ps__label">店名</label>
        <input v-model="layout.storeName" class="ps__input" type="text" placeholder="小滿湯拌滷" />
      </div>
    </section>

    <!-- ── QR Code（自訂圖片） ── -->
    <section class="ps__section">
      <h2 class="ps__section-title">📱 QR Code（選填）</h2>
      <p class="ps__section-hint">上傳你自己的 QR Code 圖片（例如：LINE、Instagram、Google 評論連結），會印在頁尾感謝詞下方</p>

      <div v-if="currentQR" class="ps__logo-preview">
        <img :src="currentQR" style="max-height:50px; max-width:50px; object-fit:contain; border:1px solid #e8e0d0; border-radius:6px; padding:4px;" alt="QR Code" />
        <button class="ps__btn-remove" @click="removeQR">移除 QR Code</button>
      </div>
      <div v-else class="ps__logo-empty">尚未上傳 QR Code</div>

      <label class="ps__upload-btn">
        {{ currentQR ? '更換 QR Code' : '上傳 QR Code 圖片' }}
        <input type="file" accept="image/*" class="ps__file-input" @change="handleQRUpload" />
      </label>
    </section>

    <!-- ── 頁尾文字 + 地址電話 ── -->
    <section class="ps__section">
      <h2 class="ps__section-title">📝 頁尾</h2>
      <div class="ps__field">
        <label class="ps__label">感謝詞第一行</label>
        <input v-model="layout.thankYouLine1" class="ps__input" type="text" placeholder="感謝您的購買" />
      </div>
      <div class="ps__field">
        <label class="ps__label">感謝詞第二行</label>
        <input v-model="layout.thankYouLine2" class="ps__input" type="text" placeholder="THANK YOU" />
      </div>
      <div class="ps__field">
        <label class="ps__label">地址（選填）</label>
        <input v-model="layout.storeAddress" class="ps__input" type="text" placeholder="台中市..." />
      </div>
      <div class="ps__field">
        <label class="ps__label">電話（選填）</label>
        <input v-model="layout.storePhone" class="ps__input" type="text" placeholder="04-XXXXXXXX" />
      </div>
    </section>

    <!-- ── 虛擬預覽 ── -->
    <section class="ps__section">
      <h2 class="ps__section-title">👁 虛擬預覽</h2>
      <p class="ps__section-hint">僅供排版參考，實際列印效果依印表機字型而定</p>

      <div class="ps__receipt">
        <img v-if="currentLogo" :src="currentLogo" class="ps__receipt-logo" alt="logo" />

        <div class="ps__receipt-header">
          <span style="font-weight:700">外帶</span>
          <span style="font-weight:700">取單號:#01</span>
        </div>
        <div class="ps__receipt-line" style="font-size:10px;color:#888">週一 2026/12/31 16:02:36</div>
        <div class="ps__receipt-line" style="font-size:10px">品項數：3</div>

        <div class="ps__receipt-rule ps__receipt-rule--medium" />

        <div class="ps__receipt-item"><span>1. 舒肥雞腿</span><span>x1  $70</span></div>
        <div class="ps__receipt-item"><span>2. 高麗菜</span>  <span>x1  $25</span></div>
        <div class="ps__receipt-item"><span>3. 玉米筍</span>  <span>x1  $25</span></div>

        <div class="ps__receipt-rule ps__receipt-rule--thin" />
        <div class="ps__receipt-item"><span>小計</span><span>$120</span></div>
        <div class="ps__receipt-rule ps__receipt-rule--thin" />
        <div class="ps__receipt-item">
          <span style="font-weight:700">總計</span>
          <span style="font-weight:700">$120</span>
        </div>
        <div class="ps__receipt-rule ps__receipt-rule--medium" />

        <div v-if="layout.thankYouLine1" class="ps__receipt-center" style="font-size:10px">{{ layout.thankYouLine1 }}</div>
        <div v-if="layout.thankYouLine2" class="ps__receipt-center" style="font-size:10px">{{ layout.thankYouLine2 }}</div>
        <div v-if="layout.storeAddress"  class="ps__receipt-center" style="font-size:10px">{{ layout.storeAddress }}</div>
        <div v-if="layout.storePhone"    class="ps__receipt-center" style="font-size:10px">{{ layout.storePhone }}</div>
        <div v-if="currentQR" class="ps__receipt-center" style="margin-top:4px">
          <img :src="currentQR" style="max-height:50px; max-width:50px; object-fit:contain;" alt="QR" />
        </div>
      </div>
    </section>

    <!-- ── 操作按鈕 ── -->
    <div class="ps__actions">
      <button class="ps__btn-reset" @click="handleReset">還原預設值</button>
      <button class="ps__btn-save" @click="handleSave">
        {{ saved ? '✓ 已儲存' : '儲存設定' }}
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue'
import {
  getPrinterIp, setPrinterIp, resetPrinterIp,
  getPrinterLayout, setPrinterLayout, resetPrinterLayout,
  getPrinterLogo, setPrinterLogo, removePrinterLogo,
  getPrinterQR, setPrinterQR, removePrinterQR,
  getHomepageUrl, setHomepageUrl,
  checkPrinterStatus, DEFAULT_LAYOUT,
} from '@/lib/printer.js'

/* ── IP ── */
const ip       = ref(getPrinterIp())
const testing  = ref(false)
const ipStatus = ref(null)

async function testIp() {
  testing.value = true
  ipStatus.value = null
  ipStatus.value = await checkPrinterStatus(ip.value.trim())
  testing.value = false
}

/* ── 版型 ── */
const layout = reactive({ ...getPrinterLayout() })

/* ── Logo ── */
const currentLogo  = ref('')
const homepageUrl  = ref('')
onMounted(() => { currentLogo.value = getPrinterLogo(); homepageUrl.value = getHomepageUrl() })

function handleLogoUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { currentLogo.value = e.target.result }
  reader.readAsDataURL(file)
}

function removeLogo() { currentLogo.value = '' }

/* ── QR Code ── */
const currentQR = ref('')
onMounted(() => { currentQR.value = getPrinterQR() })

function handleQRUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => { currentQR.value = e.target.result }
  reader.readAsDataURL(file)
}

function removeQR() { currentQR.value = '' }

/* ── 儲存 ── */
const saved = ref(false)

function handleSave() {
  setPrinterIp(ip.value.trim())
  setPrinterLayout({ ...layout })
  if (currentLogo.value) {
    try { setPrinterLogo(currentLogo.value) } catch {
      alert('Logo 檔案太大，建議使用小尺寸的 PNG 圖片（< 100KB）。'); return
    }
  } else {
    removePrinterLogo()
  }
  if (currentQR.value) {
    try { setPrinterQR(currentQR.value) } catch {
      alert('QR Code 圖片太大，請使用較小的圖片。'); return
    }
  } else {
    removePrinterQR()
  }
  setHomepageUrl(homepageUrl.value)
  saved.value = true
  setTimeout(() => { saved.value = false }, 2000)
}

function handleReset() {
  resetPrinterIp()
  resetPrinterLayout()
  removePrinterLogo()
  removePrinterQR()
  ip.value = getPrinterIp()
  Object.assign(layout, DEFAULT_LAYOUT)
  currentLogo.value  = ''
  currentQR.value    = ''
  homepageUrl.value  = ''
  ipStatus.value     = null
}

watch(layout, () => { saved.value = false })
watch(ip,    () => { saved.value = false; ipStatus.value = null })
</script>

<style scoped>
.ps {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 660px;
}

.ps__section {
  background: #fff;
  border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md);
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ps__section-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.ps__section-hint  { font-size: 11.5px; color: var(--color-text-muted); margin-top: -6px; }

.ps__field { display: flex; flex-direction: column; gap: 5px; }
.ps__label { font-size: 12.5px; font-weight: 500; color: #5a4030; }

.ps__input {
  padding: 8px 10px;
  border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13.5px; color: #1a0800; background: #faf5ec;
  outline: none; width: 100%; font-family: inherit; transition: border-color 0.15s;
}
.ps__input:focus { border-color: #e8a038; }

.ps__row { display: flex; gap: 8px; }
.ps__row .ps__input { flex: 1; }

.ps__hint { font-size: 12px; }
.ps__hint--ok  { color: #2f7a3d; }
.ps__hint--err { color: #c0392b; }

.ps__radio-row { display: flex; gap: 20px; }
.ps__radio-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 13px; color: var(--color-text-primary); cursor: pointer;
}

/* Logo */
.ps__logo-preview { display: flex; align-items: center; gap: 14px; }
.ps__logo-img { max-width: 100px; max-height: 60px; object-fit: contain; border: 1px solid #e8e0d0; border-radius: 6px; padding: 4px; }
.ps__logo-empty { font-size: 12.5px; color: var(--color-text-muted); }

.ps__upload-btn {
  display: inline-block;
  padding: 8px 18px;
  background: #f0e8d8; color: #5a4030;
  border: 1px solid #c8b89a; border-radius: var(--radius-sm);
  font-size: 13px; cursor: pointer; transition: background 0.12s;
}
.ps__upload-btn:hover { background: #e8dcc8; }
.ps__file-input { display: none; }

.ps__btn-remove {
  padding: 5px 12px; border-radius: var(--radius-sm);
  font-size: 12.5px; color: #c0392b;
  background: #fff0ee; border: 1px solid #f0c0b8;
}
.ps__btn-remove:hover { background: #fde0dc; }

/* 字體倍率 */
.ps__scale-row {
  display: grid; grid-template-columns: 80px auto 1fr;
  align-items: center; gap: 12px;
}
.ps__scale-label { font-size: 13px; color: var(--color-text-secondary); }
.ps__scale-btns  { display: flex; gap: 5px; }
.ps__scale-btn {
  width: 36px; height: 28px; border-radius: var(--radius-sm);
  font-size: 12.5px; font-weight: 500;
  color: var(--color-text-secondary); background: #f0e8d8;
  border: 1.5px solid #c8b89a; transition: all 0.12s;
}
.ps__scale-btn--active { background: #e8a038; color: #fff; border-color: #e8a038; }
.ps__scale-preview { font-family: 'Noto Sans TC', monospace; color: var(--color-text-primary); }

/* 頁尾 */
.ps__checkbox-row { display: flex; align-items: center; }
.ps__checkbox-label {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; color: var(--color-text-primary); cursor: pointer;
}

/* 虛擬預覽 */
.ps__receipt {
  border: 1px solid #c8b89a; border-radius: 8px; padding: 14px;
  background: #fff; font-family: 'Courier New', monospace; font-size: 11px;
  max-width: 210px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex; flex-direction: column; gap: 2px;
}
.ps__receipt-logo    { max-width: 50px; margin: 0 auto 6px; display: block; }
.ps__receipt-header  { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 2px; }
.ps__receipt-line    { text-align: left; }
.ps__receipt-item    { display: flex; justify-content: space-between; font-size: 11px; }
.ps__receipt-center  { text-align: center; }
.ps__receipt-rule    { border: none; border-top: 1px solid; margin: 4px 0; }
.ps__receipt-rule--medium { border-color: #333; }
.ps__receipt-rule--thin   { border-color: #bbb; border-style: dashed; }
.ps__receipt-qr { text-align: center; font-size: 20px; color: #333; margin-top: 4px; }

/* 按鈕 */
.ps__actions { display: flex; gap: 10px; justify-content: flex-end; padding-bottom: 24px; }

.ps__btn-test {
  padding: 8px 16px; background: #f0e8d8;
  color: #5a4030; border: 1px solid #c8b89a;
  border-radius: var(--radius-sm); font-size: 13px; white-space: nowrap;
  transition: background 0.12s;
}
.ps__btn-test:hover:not(:disabled) { background: #e8dcc8; }
.ps__btn-test:disabled { opacity: 0.5; }

.ps__btn-reset {
  padding: 9px 22px; border-radius: var(--radius-sm); font-size: 13.5px;
  background: #fff; color: var(--color-text-secondary); border: 1px solid var(--color-border-btn);
}
.ps__btn-reset:hover { background: #f0e8d8; }

.ps__btn-save {
  padding: 9px 28px; border-radius: var(--radius-sm); font-size: 13.5px; font-weight: 500;
  background: #3a7a3a; color: #fff; border: none; transition: background 0.12s;
}
.ps__btn-save:hover { background: #2a6a2a; }
</style>