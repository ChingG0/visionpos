<template>
  <Teleport to="body">
    <div class="psm-backdrop" @click.self="emit('close')">
      <div class="psm-box" role="dialog" aria-modal="true">

        <div class="psm-header">
          <h2 class="psm-title">出單機設定</h2>
          <button class="psm-close" aria-label="關閉" @click="emit('close')">×</button>
        </div>

        <div class="psm-body">
          <label class="psm-label">印表機 IP 位址</label>
          <input
            v-model="ipDraft"
            class="psm-input"
            type="text"
            placeholder="192.168.0.100"
            @keydown.enter="testConnection"
          />
          <p class="psm-hint">
            換了路由器、或出去外面接別的網路時，去印表機自助測試單（按住 FEED 鍵列印）上看新的 IP，填在這裡。
          </p>

          <label class="psm-checkbox-label">
            <input type="checkbox" v-model="useHttpsDraft" />
            此裝置已信任出單機的憑證，改用 HTTPS 連線
          </label>

          <button class="psm-test-btn" :disabled="testing || !ipDraft.trim()" @click="testConnection">
            {{ testing ? '測試中...' : '測試連線' }}
          </button>
          <p v-if="testResult === true" class="psm-result psm-result--ok">✓ 連線成功</p>
          <p v-if="testResult === false" class="psm-result psm-result--bad">
            ✗ 連線失敗，確認印表機開機、跟這台裝置在同一個網路{{ useHttpsDraft ? '，或這台裝置尚未信任出單機的憑證' : '' }}
          </p>
        </div>

        <div class="psm-footer">
          <button class="psm-btn-reset" @click="resetDefault">還原預設值</button>
          <div class="psm-footer-right">
            <button class="psm-btn-cancel" @click="emit('close')">取消</button>
            <button class="psm-btn-confirm" :disabled="!ipDraft.trim()" @click="save">儲存</button>
          </div>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue'
import {
  getPrinterIp, setPrinterIp, resetPrinterIp,
  getPrinterUseHttps, setPrinterUseHttps, resetPrinterUseHttps,
  checkPrinterStatus,
} from '@/lib/printer.js'

const emit = defineEmits(['close', 'saved'])

const ipDraft       = ref(getPrinterIp())
const useHttpsDraft = ref(getPrinterUseHttps())
const testing       = ref(false)
const testResult    = ref(null)   // null | true | false

async function testConnection() {
  if (!ipDraft.value.trim()) return
  testing.value = true
  testResult.value = null
  testResult.value = await checkPrinterStatus(ipDraft.value.trim(), useHttpsDraft.value)
  testing.value = false
}

function save() {
  if (!ipDraft.value.trim()) return
  setPrinterIp(ipDraft.value.trim())
  setPrinterUseHttps(useHttpsDraft.value)
  emit('saved')
  emit('close')
}

function resetDefault() {
  resetPrinterIp()
  resetPrinterUseHttps()
  ipDraft.value = getPrinterIp()
  useHttpsDraft.value = getPrinterUseHttps()
  testResult.value = null
}
</script>

<style scoped>
.psm-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.psm-box {
  background: #fff;
  border-radius: 16px;
  width: 340px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  font-family: 'Noto Sans TC', 'PingFang TC', sans-serif;
}

.psm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid #ede5d0;
}

.psm-title {
  font-size: 15px;
  font-weight: 500;
  color: #1a0800;
}

.psm-close {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #f0e8d8;
  font-size: 16px;
  color: #7a6850;
  display: flex;
  align-items: center;
  justify-content: center;
}

.psm-close:hover { background: #e0d0b8; }

.psm-body {
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.psm-label {
  font-size: 12px;
  font-weight: 500;
  color: #5a4030;
}

.psm-input {
  padding: 8px 10px;
  border: 1.5px solid #c8b89a;
  border-radius: 8px;
  font-size: 14px;
  color: #1a0800;
  background: #faf5ec;
  outline: none;
  font-family: inherit;
  width: 100%;
  transition: border-color 0.15s;
}

.psm-input:focus { border-color: #e8a038; }

.psm-hint {
  font-size: 11.5px;
  color: #9a8868;
  line-height: 1.5;
}

.psm-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: #5a4030;
  cursor: pointer;
  margin-top: 4px;
}

.psm-test-btn {
  margin-top: 6px;
  padding: 8px 0;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
  border-radius: 8px;
  font-size: 13px;
  color: #5a4030;
  font-weight: 500;
}

.psm-test-btn:hover:not(:disabled) { background: #e8dcc8; }
.psm-test-btn:disabled { opacity: 0.5; }

.psm-result {
  font-size: 12.5px;
  font-weight: 500;
  padding: 6px 9px;
  border-radius: 8px;
}

.psm-result--ok {
  color: #2f7a3d;
  background: #e1f3e1;
}

.psm-result--bad {
  color: #c0392b;
  background: #fde2e2;
}

.psm-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 18px 16px;
  border-top: 1px solid #ede5d0;
}

.psm-footer-right {
  display: flex;
  gap: 8px;
}

.psm-btn-reset {
  padding: 7px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.psm-btn-reset:hover { background: #e8dcc8; }

.psm-btn-cancel {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #7a6850;
  background: #f0e8d8;
  border: 1px solid #c8b89a;
}

.psm-btn-cancel:hover { background: #e8dcc8; }

.psm-btn-confirm {
  padding: 7px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff;
  background: #3a7a3a;
  border: none;
  font-weight: 500;
}

.psm-btn-confirm:hover:not(:disabled) { background: #2a6a2a; }
.psm-btn-confirm:disabled { opacity: 0.5; }
</style>