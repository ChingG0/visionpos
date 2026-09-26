<template>
  <Teleport to="body">
    <div class="uim-bg" @click.self="close">
      <div class="uim">
        <div class="uim__head">
          <h3>匯入 Uber Eats 對帳資料</h3>
          <button class="uim__close" @click="close">×</button>
        </div>

        <div class="uim__body">
          <!-- 步驟一：選檔 -->
          <template v-if="!preview">
            <ol class="uim__steps">
              <li>到 Uber Eats Manager 的「<b>報告</b>」頁</li>
              <li>建立或下載「<b>付款詳細資訊（商品級別）</b>」報表</li>
              <li>把下載的 CSV 拖到下面</li>
            </ol>
            <p class="uim__note">
              一定要是<b>商品級別</b>那一份。一般的「付款詳細資訊」沒有品項明細，商品分析會是空的。
            </p>

            <label
              class="uim__drop"
              :class="{ 'uim__drop--over': dragOver }"
              @dragover.prevent="dragOver = true"
              @dragleave.prevent="dragOver = false"
              @drop.prevent="onDrop"
            >
              <input type="file" accept=".csv,text/csv" class="uim__file" @change="onPick" />
              <span v-if="parsing">解析中…</span>
              <span v-else>把 CSV 拖到這裡，或<b>點擊選擇檔案</b></span>
            </label>
          </template>

          <!-- 步驟二：確認 -->
          <template v-else>
            <div class="uim__file-name">{{ preview.fileName }}</div>

            <p v-for="w in preview.warnings" :key="w" class="uim__warn">{{ w }}</p>

            <template v-if="s.count">
              <div class="uim__range">
                {{ s.dateFrom }} ～ {{ s.dateTo }}　共 <b>{{ s.count }}</b> 筆訂單、<b>{{ preview.items.length }}</b> 個品項
              </div>

              <div class="uim__figures">
                <div class="uim__fig"><span>銷售額</span><b>${{ fmt(s.gross) }}</b></div>
                <div class="uim__fig"><span>商品優惠</span><b class="neg">${{ fmt(s.discount) }}</b></div>
                <div class="uim__fig"><span>平台服務費</span><b class="neg">${{ fmt(s.platformFee) }}</b></div>
                <div class="uim__fig uim__fig--net"><span>實際入袋</span><b>${{ fmt(s.netPayout) }}</b></div>
              </div>

              <p v-if="preview.skipped.fees" class="uim__skip">
                已排除 {{ preview.skipped.fees }} 筆廣告費用／點數紀錄（那些不是訂單）
              </p>
              <p v-if="preview.skipped.invalid" class="uim__skip">
                有 {{ preview.skipped.invalid }} 列無法辨識而略過
              </p>

              <p class="uim__dedupe">
                同一筆訂單重複匯入會覆蓋既有資料，不會重複計算。日期區間重疊的檔案可以放心再匯一次。
              </p>
            </template>
          </template>

          <p v-if="error" class="uim__err">{{ error }}</p>
          <p v-if="done" class="uim__done">✓ 已匯入 {{ done.orders }} 筆訂單、{{ done.items }} 個品項</p>
        </div>

        <div class="uim__foot">
          <button v-if="preview && !done" class="uim__ghost" @click="reset">重新選擇</button>
          <button class="uim__ghost" @click="close">{{ done ? '完成' : '取消' }}</button>
          <button
            v-if="preview && !done"
            class="uim__primary"
            :disabled="!s.count || importing"
            @click="doImport"
          >{{ importing ? '匯入中…' : `匯入 ${s.count} 筆` }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useUberImport } from '@/composables/useUberImport.js'

const emit = defineEmits(['close', 'imported'])

const { parsing, importing, error, preview, parseFile, commit, reset } = useUberImport()
const dragOver = ref(false)
const done     = ref(null)

const s = computed(() => preview.value?.summary ?? { count: 0 })

function fmt(n) { return Math.round(n ?? 0).toLocaleString('zh-TW') }

function onPick(e) {
  const f = e.target.files?.[0]
  if (f) parseFile(f)
}
function onDrop(e) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) parseFile(f)
}

async function doImport() {
  const r = await commit()
  // 成功才標記完成；失敗時保留預覽與錯誤訊息，讓店家看得到原因並重試
  if (r.ok) { done.value = r; emit('imported') }
}

function close() { emit('close') }
</script>

<style scoped>
.uim-bg { position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,.5);
          display: flex; align-items: center; justify-content: center; padding: 20px; }
.uim { background: #fff; border-radius: var(--radius-md); width: 100%; max-width: 480px;
       max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 18px 50px rgba(0,0,0,.25); }
.uim__head { display: flex; align-items: center; justify-content: space-between;
             padding: 15px 18px; border-bottom: 1px solid var(--color-border-card); }
.uim__head h3 { font-size: 15px; font-weight: 700; color: var(--color-text-primary); }
.uim__close { font-size: 22px; color: var(--color-text-muted); line-height: 1; padding: 0 4px; }
.uim__body { padding: 16px 18px; overflow-y: auto; flex: 1; }

.uim__steps { margin: 0 0 10px 16px; font-size: 12.5px; color: var(--color-text-secondary); line-height: 2; }
.uim__steps b { color: var(--color-text-primary); }
.uim__note { font-size: 11.5px; color: #8a5a10; background: #fdf1de; border: 1px solid #ecd6ac;
             border-radius: var(--radius-sm); padding: 8px 11px; line-height: 1.7; margin-bottom: 14px; }

.uim__drop { display: flex; align-items: center; justify-content: center; text-align: center;
             height: 110px; border: 2px dashed #c8b89a; border-radius: var(--radius-sm);
             background: #faf5ec; color: var(--color-text-secondary); font-size: 13px; cursor: pointer; }
.uim__drop:hover, .uim__drop--over { border-color: #e8a038; background: #fdf1de; }
.uim__drop b { color: #8a5a10; }
.uim__file { display: none; }

.uim__file-name { font-size: 12px; color: var(--color-text-muted); margin-bottom: 10px; word-break: break-all; }
.uim__range { font-size: 13px; color: var(--color-text-primary); margin-bottom: 12px; }
.uim__range b { color: #8a5a10; }

.uim__figures { display: flex; flex-direction: column; gap: 1px; background: var(--color-border-card);
                border: 1px solid var(--color-border-card); border-radius: var(--radius-sm); overflow: hidden; }
.uim__fig { display: flex; justify-content: space-between; align-items: center;
            background: #fff; padding: 9px 12px; font-size: 13px; }
.uim__fig span { color: var(--color-text-secondary); }
.uim__fig b { font-variant-numeric: tabular-nums; color: var(--color-text-primary); }
.uim__fig b.neg { color: #c0392b; }
.uim__fig--net { background: #fdf1de; }
.uim__fig--net b { color: #8a5a10; font-size: 15px; }

.uim__skip   { font-size: 11.5px; color: var(--color-text-muted); margin-top: 8px; line-height: 1.6; }
.uim__dedupe { font-size: 11.5px; color: var(--color-text-muted); margin-top: 10px; line-height: 1.7;
               border-top: 1px solid var(--color-border-card); padding-top: 10px; }
.uim__warn { font-size: 12px; color: #8a5a10; background: #fdf1de; border: 1px solid #ecd6ac;
             border-radius: var(--radius-sm); padding: 8px 11px; line-height: 1.7; margin-bottom: 10px; }
.uim__err  { font-size: 12px; color: #a5342a; background: #fdeceb; border: 1px solid #f0c8c4;
             border-radius: var(--radius-sm); padding: 8px 11px; margin-top: 10px; }
.uim__done { font-size: 13px; color: #2f7a3d; background: #e8f3ea; border: 1px solid #c3e2cc;
             border-radius: var(--radius-sm); padding: 9px 11px; margin-top: 10px; }

.uim__foot { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px;
             border-top: 1px solid var(--color-border-card); }
.uim__ghost { padding: 8px 16px; border-radius: var(--radius-sm); font-size: 13px;
              color: var(--color-text-secondary); background: #f0e8d8; border: 1px solid #c8b89a; }
.uim__primary { padding: 8px 18px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600;
                color: #fff; background: #e8a038; border: none; }
.uim__primary:hover:not(:disabled) { background: #d8902c; }
.uim__primary:disabled { opacity: .45; cursor: not-allowed; }
</style>
