<!--
  ⚠️ 目前沒有任何地方 import 這個檔案，這是刻意的，不是死碼。

  2026-11-13：方案與用量對店家全部隱藏（還沒開始收費，連達量都不通知）。
  做法是拿掉所有 import 而不是加開關——dist bundle 是公開的，只要有人 import
  就會被打包，裡面的價目表（月 300／半年 1200／年 2000）檢視原始碼就看得到。
  沒人 import 的模組 Vite 不會打包，所以檔案留著是乾淨的。

  要恢復：router/index.js 補回 import 與 settings/plan 路由，
  SettingsSidebar.vue 補回 PlanUsage 那筆 nav item 與 IconPlanUsage，
  AppTopbar.vue 補回用量提示 chip。git log 有完整的移除 commit。

  注意：這次只動前端。DB 權限沒收，`store_usage_current` 用 public key 仍讀得到，
  所以這是「店家介面上看不到」，不是「查不到」。
-->
<template>
  <div class="pu">
    <SettingsSidebar />

    <div class="pu__main">
      <AppTopbar :show-floor-tabs="false" title="方案與用量" />

      <div class="pu__content">

        <!-- ── 資料用量 ── -->
        <section class="pu__section">
          <div class="pu__section-head">
            <div>
              <h2 class="pu__section-title">📊 資料用量</h2>
              <p class="pu__section-hint">
                這家店累積的營運資料佔免費額度的比例。訂單、發票、庫存紀錄都會計入。
              </p>
            </div>
          </div>

          <div v-if="usage.loading && !usage.loaded" class="pu__loading">載入中...</div>

          <template v-else>
            <div class="pu__bar-row">
              <div class="pu__bar">
                <div
                  class="pu__bar-fill"
                  :class="{
                    'pu__bar-fill--warn': usage.percent >= 80 && usage.percent < 100,
                    'pu__bar-fill--full': usage.percent >= 100,
                  }"
                  :style="{ width: usage.percent + '%' }"
                />
              </div>
              <span
                class="pu__pct"
                :class="{
                  'pu__pct--warn': usage.percent >= 80 && usage.percent < 100,
                  'pu__pct--full': usage.percent >= 100,
                }"
              >{{ usage.percent }}%</span>
            </div>

            <p v-if="usage.percent >= 100" class="pu__notice pu__notice--full">
              已達免費額度上限。資料不會遺失，也不影響任何功能，我們會主動與您聯繫說明後續方案。
            </p>
            <p v-else-if="usage.percent >= 80" class="pu__notice pu__notice--warn">
              即將達到免費額度上限。
            </p>

            <p v-if="!usage.measuredOn" class="pu__stale">
              尚未產生用量紀錄。系統每天凌晨自動更新一次，剛開通的店家請隔天再查看。
            </p>
          </template>
        </section>

        <!-- ── 目前方案 ── -->
        <section class="pu__section">
          <div class="pu__section-head">
            <div>
              <h2 class="pu__section-title">💳 目前方案</h2>
              <p class="pu__section-hint">
                方案異動請洽客服，我們會提供電子合約與授權期間說明。
              </p>
            </div>
            <span class="pu__plan-badge" :class="`pu__plan-badge--${usage.plan}`">
              {{ PLAN_LABEL[usage.plan] ?? usage.plan }}
            </span>
          </div>

          <div class="pu__plans">
            <div
              v-for="p in PLANS" :key="p.key"
              class="pu__plan"
              :class="{ 'pu__plan--current': usage.plan === p.key }"
            >
              <div class="pu__plan-name">{{ p.label }}</div>
              <div class="pu__plan-price">{{ p.price }}</div>
              <div class="pu__plan-note">{{ p.note }}</div>
            </div>
          </div>
        </section>

      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import SettingsSidebar from '@/components/settings/SettingsSidebar.vue'
import AppTopbar       from '@/components/layout/AppTopbar.vue'
import { useUsageStore } from '@/stores/usageStore.js'

const usage = useUsageStore()

const PLAN_LABEL = {
  starter:  '免費版',
  monthly:  '月繳',
  halfyear: '半年繳',
  yearly:   '年繳',
}

const PLANS = [
  { key: 'starter',  label: '免費版', price: '免費',      note: '額度用完前完整功能' },
  { key: 'monthly',  label: '月繳',   price: '$300 / 月', note: '' },
  { key: 'halfyear', label: '半年繳', price: '$1,200 / 半年', note: '約 $200 / 月' },
  { key: 'yearly',   label: '年繳',   price: '$2,000 / 年',   note: '約 $167 / 月' },
]

// force=true：這一頁就是專門來看用量的，每次進來都抓最新，不吃快取
onMounted(() => {
  usage.init(true)
  usage.loadDismissed()
})
</script>

<style scoped>
.pu { width: 100%; height: 100%; display: flex; overflow: hidden; }
.pu__main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.pu__content {
  flex: 1; overflow-y: auto; padding: 20px 24px;
  background: var(--color-bg-map);
  display: flex; flex-direction: column; gap: 16px; max-width: 760px;
}

.pu__section {
  background: #fff; border: 1px solid var(--color-border-card);
  border-radius: var(--radius-md); padding: 16px 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.pu__section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.pu__section-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); }
.pu__section-hint  { font-size: 11.5px; color: var(--color-text-muted); margin-top: 4px; line-height: 1.6; }
.pu__loading { font-size: 12.5px; color: var(--color-text-muted); }

/* ── 用量條 ── */
.pu__bar-row { display: flex; align-items: center; gap: 14px; }
.pu__bar {
  flex: 1; height: 10px; border-radius: 999px;
  background: #ede5d0; overflow: hidden;
}
.pu__bar-fill {
  height: 100%; border-radius: 999px; background: #e8a038;
  transition: width 0.4s ease;
}
.pu__bar-fill--warn { background: #d8892c; }
.pu__bar-fill--full { background: #c0392b; }

.pu__pct {
  font-size: 18px; font-weight: 700; color: var(--color-text-primary);
  min-width: 52px; text-align: right; font-variant-numeric: tabular-nums;
}
.pu__pct--warn { color: #8a5a10; }
.pu__pct--full { color: #c0392b; }

.pu__notice { font-size: 12px; line-height: 1.7; border-radius: var(--radius-sm); padding: 9px 12px; }
.pu__notice--warn { background: #fdf1de; color: #8a5a10; border: 1px solid #ecd6ac; }
.pu__notice--full { background: #fdeceb; color: #a5342a; border: 1px solid #f0c8c4; }
.pu__stale { font-size: 11.5px; color: var(--color-text-muted); line-height: 1.6; }

/* ── 方案 ── */
.pu__plan-badge {
  flex-shrink: 0; font-size: 11.5px; font-weight: 600; padding: 4px 10px;
  border-radius: 999px; background: #f0e8d8; color: #7a6850;
}
.pu__plan-badge--monthly,
.pu__plan-badge--halfyear,
.pu__plan-badge--yearly { background: #fde8c0; color: #8a6020; }

.pu__plans { display: flex; gap: 8px; flex-wrap: wrap; }
.pu__plan {
  flex: 1; min-width: 120px; padding: 11px 12px;
  border: 1.5px solid var(--color-border-card); border-radius: var(--radius-sm);
  background: #faf5ec;
}
.pu__plan--current { border-color: #e8a038; background: #fdf1de; }
.pu__plan-name  { font-size: 12px; color: var(--color-text-secondary); }
.pu__plan-price { font-size: 15px; font-weight: 700; color: var(--color-text-primary); margin-top: 3px; }
.pu__plan-note  { font-size: 10.5px; color: var(--color-text-muted); margin-top: 3px; min-height: 14px; }
</style>
