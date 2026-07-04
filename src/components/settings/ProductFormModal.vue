<template>
  <Teleport to="body">
    <div class="pfm-backdrop" @click.self="emit('close')">
      <div class="pfm-box" role="dialog" aria-modal="true">

        <div class="pfm-header">
          <h2 class="pfm-title">{{ isEdit ? '編輯商品' : '新增商品' }}</h2>
          <button class="pfm-close" aria-label="關閉" @click="emit('close')">×</button>
        </div>

        <div class="pfm-body">

          <div v-if="isEdit" class="pfm-field">
            <label class="pfm-label">商品編號</label>
            <input class="pfm-input" :value="form.code" disabled />
          </div>

          <div class="pfm-field">
            <label class="pfm-label">商品名稱 <span class="pfm-required">*</span></label>
            <input v-model="form.name" class="pfm-input" type="text" placeholder="例：舒肥雞腿" maxlength="20" />
          </div>

          <div class="pfm-field">
            <label class="pfm-label">商品分類 <span class="pfm-required">*</span></label>
            <select v-model="form.categoryId" class="pfm-input">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.label }}</option>
            </select>
          </div>

          <div class="pfm-row">
            <div class="pfm-field">
              <label class="pfm-label">
                成本
                <span v-if="hasRecipes" class="pfm-auto-badge">自動計算</span>
              </label>
              <input
                :value="hasRecipes ? calculatedCost.toFixed(2) : form.cost"
                @input="!hasRecipes && (form.cost = $event.target.value)"
                class="pfm-input"
                :class="{ 'pfm-input--auto': hasRecipes }"
                type="number" min="0"
                :readonly="hasRecipes"
              />
            </div>
            <div class="pfm-field">
              <label class="pfm-label">售價 <span class="pfm-required">*</span></label>
              <input v-model.number="form.price" class="pfm-input" type="number" min="0" />
            </div>
          </div>

          <div class="pfm-field">
            <label class="pfm-label">圖示</label>
            <input v-model="form.icon" class="pfm-input pfm-input--icon" type="text" placeholder="貼上 emoji，例如 🍗" maxlength="4" />
          </div>

          <div class="pfm-field">
            <label class="pfm-label">
              課稅別
              <span class="pfm-tax-hint">影響電子發票開立方式</span>
            </label>
            <select v-model="form.taxType" class="pfm-input">
              <option value="taxable">應稅（預設）</option>
              <option value="exempt">免稅</option>
              <option value="zero">零稅率</option>
            </select>
            <p v-if="form.taxType !== 'taxable'" class="pfm-tax-warning">
              ⚠️ 訂單裡若同時有應稅跟{{ form.taxType === 'exempt' ? '免稅' : '零稅率' }}商品，會開立「混合稅率」發票，
              須事先在發票設定頁確認已取得財政部/綠界核可，否則開票會被擋下。
            </p>
          </div>

          <!-- ── 使用食材（庫存扣料） ── -->
          <div class="pfm-recipe">
            <div class="pfm-recipe-header">
              <span class="pfm-recipe-title">使用食材（庫存扣料）</span>
              <span class="pfm-recipe-hint">賣出 1 份時從庫存扣除</span>
            </div>

            <div v-if="recipeLoading" class="pfm-recipe-loading">載入中...</div>

            <template v-else>
              <div v-for="(row, i) in recipes" :key="i" class="pfm-recipe-row">
                <select v-model="row.ingredientId" class="pfm-input pfm-recipe-select" @change="onIngredientSelect(i)">
                  <option value="">選擇食材...</option>
                  <option v-for="ing in ingredientOptions" :key="ing.id" :value="ing.id">
                    {{ ing.name }}（{{ ing.unit }}）
                  </option>
                </select>

                <input
                  v-model.number="row.qty"
                  class="pfm-input pfm-recipe-qty"
                  type="number" min="0" step="any"
                  :placeholder="getIngredient(row.ingredientId)?.unit || '用量'"
                />

                <span class="pfm-recipe-unit">{{ getIngredient(row.ingredientId)?.unit || '' }}</span>

                <span class="pfm-recipe-cost">
                  {{ row.ingredientId && row.qty ? `$${rowCost(row).toFixed(2)}` : '' }}
                </span>

                <button class="pfm-recipe-del" @click="recipes.splice(i, 1)">×</button>
              </div>

              <button class="pfm-recipe-add" @click="recipes.push({ ingredientId: '', qty: 1 })">
                ＋ 新增食材
              </button>

              <div v-if="hasRecipes" class="pfm-recipe-total">
                預估成本：<strong>${{ calculatedCost.toFixed(2) }}</strong>
                <span class="pfm-recipe-margin" v-if="form.price">
                  　毛利率 {{ margin }}%
                </span>
              </div>
            </template>
          </div>

          <p v-if="errorMsg" class="pfm-error">{{ errorMsg }}</p>

        </div>

        <div class="pfm-footer">
          <button class="pfm-btn-cancel" @click="emit('close')">取消</button>
          <button class="pfm-btn-confirm" @click="submit">儲存</button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { reactive, ref, computed, watch, onMounted } from 'vue'
import { useInventoryStore } from '@/stores/inventoryStore.js'
import { supabase } from '@/lib/supabase.js'

const props = defineProps({
  categories:  { type: Array,  required: true },
  initialData: { type: Object, default: null },
})

const emit = defineEmits(['close', 'submit'])

const isEdit   = !!props.initialData
const errorMsg = ref('')

const form = reactive({
  code:       props.initialData?.code ?? '',
  name:       props.initialData?.name ?? '',
  categoryId: props.initialData?.categoryId ?? props.categories[0]?.id ?? '',
  cost:       props.initialData?.cost ?? 0,
  price:      props.initialData?.price ?? 0,
  icon:       props.initialData?.icon ?? '🍽️',
  taxType:    props.initialData?.taxType ?? 'taxable',
})

/* ── 食材配方 ── */
const inventoryStore = useInventoryStore()
const recipes        = ref([])  // [{ ingredientId, qty }]
const recipeLoading  = ref(false)

const ingredientOptions = computed(() => inventoryStore.ingredients)

function getIngredient(id) {
  return inventoryStore.ingredients.find(x => x.id === id) ?? null
}

function rowCost(row) {
  const ing = getIngredient(row.ingredientId)
  if (!ing || !row.qty) return 0
  return row.qty * ing.avg_cost
}

const hasRecipes = computed(() => recipes.value.some(r => r.ingredientId && r.qty > 0))

const calculatedCost = computed(() =>
  recipes.value.reduce((sum, r) => sum + rowCost(r), 0)
)

const margin = computed(() => {
  if (!form.price || !hasRecipes.value) return '—'
  return (((form.price - calculatedCost.value) / form.price) * 100).toFixed(1)
})

/* 當有食材設定時，同步更新 form.cost */
watch(calculatedCost, (val) => {
  if (hasRecipes.value) form.cost = Math.round(val * 100) / 100
})

function onIngredientSelect(i) {
  /* 選食材後，如果還沒填數量，設預設 1 */
  if (!recipes.value[i].qty) recipes.value[i].qty = 1
}

/* ── 載入現有配方（編輯模式）── */
onMounted(async () => {
  await inventoryStore.fetchIngredients()
  if (!isEdit || !props.initialData?.id) return
  recipeLoading.value = true
  const { data } = await supabase
    .from('product_ingredient_recipes')
    .select('ingredient_id, qty_per_unit')
    .eq('product_id', props.initialData.id)
  if (data?.length) {
    recipes.value = data.map(r => ({ ingredientId: r.ingredient_id, qty: r.qty_per_unit }))
  }
  recipeLoading.value = false
})

/* ── 送出 ── */
function submit() {
  errorMsg.value = ''
  if (!form.name.trim())               { errorMsg.value = '請輸入商品名稱'; return }
  if (!form.categoryId)                { errorMsg.value = '請選擇商品分類'; return }
  if (!form.price || form.price <= 0)  { errorMsg.value = '請輸入售價';     return }

  const finalCost = hasRecipes.value ? calculatedCost.value : (Number(form.cost) || 0)

  emit('submit', {
    name:       form.name.trim(),
    categoryId: form.categoryId,
    cost:       Math.round(finalCost * 100) / 100,
    price:      Number(form.price),
    icon:       form.icon.trim() || '🍽️',
    taxType:    form.taxType,
    /* recipes 供 ProductManagementView 存入 product_ingredient_recipes */
    recipes:    recipes.value.filter(r => r.ingredientId && r.qty > 0),
  })
}
</script>

<style scoped>
.pfm-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 9999;
}

.pfm-box {
  background: #fff; border-radius: 16px;
  width: 420px; max-height: 90vh; overflow-y: auto;
  box-shadow: 0 12px 40px rgba(0,0,0,0.22);
  font-family: 'Noto Sans TC','PingFang TC',sans-serif;
}

.pfm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px 12px; border-bottom: 1px solid #ede5d0; position: sticky; top: 0; background: #fff; z-index: 1;
}
.pfm-title { font-size: 15px; font-weight: 600; color: #1a0800; }
.pfm-close {
  width: 26px; height: 26px; border-radius: 50%;
  background: #f0e8d8; font-size: 16px; color: #7a6850;
  display: flex; align-items: center; justify-content: center;
}
.pfm-close:hover { background: #e0d0b8; }

.pfm-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 12px; }

.pfm-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.pfm-row   { display: flex; gap: 10px; }

.pfm-label {
  font-size: 12px; font-weight: 500; color: #5a4030;
  display: flex; align-items: center; gap: 6px;
}
.pfm-required { color: #c03020; }
.pfm-auto-badge {
  font-size: 10px; font-weight: 500;
  background: #fde8c0; color: #8a6020;
  padding: 1px 7px; border-radius: 999px;
}

.pfm-input {
  padding: 7px 10px; border: 1.5px solid #c8b89a; border-radius: 8px;
  font-size: 13px; color: #1a0800; background: #faf5ec;
  outline: none; font-family: inherit; width: 100%; transition: border-color 0.15s;
}
.pfm-input:focus    { border-color: #e8a038; }
.pfm-input:disabled { color: #9a8868; background: #f0ebe0; }
.pfm-input--auto    { color: #8a6020; background: #fff8ee; border-color: #e8d090; }
.pfm-input--icon    { font-size: 18px; text-align: center; }

/* ── 食材配方 ── */
.pfm-recipe {
  border: 1.5px solid #e8dcc8; border-radius: 10px;
  padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;
  background: #fdfaf5;
}

.pfm-recipe-header { display: flex; align-items: baseline; gap: 8px; }
.pfm-recipe-title  { font-size: 12.5px; font-weight: 600; color: #5a4030; }
.pfm-recipe-hint   { font-size: 11px; color: var(--color-text-muted); }
.pfm-recipe-loading { font-size: 12px; color: var(--color-text-muted); }

.pfm-recipe-row {
  display: grid;
  grid-template-columns: 1fr 70px 32px 52px 24px;
  align-items: center;
  gap: 5px;
}

.pfm-recipe-select { font-size: 12.5px; padding: 5px 7px; }
.pfm-recipe-qty    { font-size: 12.5px; padding: 5px 7px; text-align: right; }
.pfm-recipe-unit   { font-size: 11.5px; color: var(--color-text-muted); text-align: center; }
.pfm-recipe-cost   { font-size: 12px; color: #5a8030; text-align: right; font-weight: 500; }

.pfm-recipe-del {
  width: 22px; height: 22px; border-radius: 50%;
  background: #ffe8e8; color: #c0392b; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  transition: background 0.12s;
}
.pfm-recipe-del:hover { background: #ffd0d0; }

.pfm-recipe-add {
  font-size: 12px; color: #e8a038; font-weight: 500;
  padding: 4px 0; text-align: left; transition: color 0.12s;
  background: none; border: none; cursor: pointer;
}
.pfm-recipe-add:hover { color: #c88020; }

.pfm-recipe-total {
  font-size: 12.5px; color: var(--color-text-secondary);
  padding-top: 6px; border-top: 1px dashed #e0d5c0;
  display: flex; align-items: center;
}
.pfm-recipe-margin { color: #5a8030; }

.pfm-error {
  font-size: 12px; color: #c03020; background: #fff0ee;
  padding: 6px 10px; border-radius: 8px; border: 1px solid #f0c0b8;
}

.pfm-tax-hint { font-size: 10.5px; color: var(--color-text-muted); font-weight: 400; }
.pfm-tax-warning {
  font-size: 11px; color: #8a6020; background: #fff8ee;
  border: 1px solid #e8d090; border-radius: 8px; padding: 6px 10px;
  margin: 0; line-height: 1.5;
}

.pfm-footer {
  display: flex; justify-content: flex-end; gap: 8px;
  padding: 12px 18px 16px; border-top: 1px solid #ede5d0;
  position: sticky; bottom: 0; background: #fff;
}
.pfm-btn-cancel {
  padding: 7px 18px; border-radius: 8px; font-size: 13px;
  color: #7a6850; background: #f0e8d8; border: 1px solid #c8b89a;
}
.pfm-btn-cancel:hover { background: #e8dcc8; }
.pfm-btn-confirm {
  padding: 7px 18px; border-radius: 8px; font-size: 13px;
  color: #fff; background: #3a7a3a; border: none; font-weight: 500;
}
.pfm-btn-confirm:hover { background: #2a6a2a; }
</style>