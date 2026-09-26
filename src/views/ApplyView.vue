<template>
  <div class="ap">
    <div class="ap__bg" />

    <div class="ap__card">
      <div class="ap__head">
        <span class="ap__logo">🍽</span>
        <h1 class="ap__title">VisionPOS 申請試用</h1>
        <p class="ap__sub">填寫後我們會與您聯繫，確認需求並協助開通</p>
      </div>

      <!-- 送出成功 -->
      <div v-if="done" class="ap__done">
        <div class="ap__done-icon">✓</div>
        <h2 class="ap__done-title">已收到您的申請</h2>
        <p class="ap__done-text">
          我們會在一至二個工作天內以電話或 Email 與您聯繫。<br>
          若有急需，也可以直接來電洽詢。
        </p>
        <RouterLink :to="{ name: 'Login' }" class="ap__done-link">回登入頁</RouterLink>
      </div>

      <!-- 申請表單 -->
      <form v-else class="ap__form" @submit.prevent="submit">
        <label class="ap__field">
          <span class="ap__label">店名 <b>*</b></span>
          <input v-model="form.storeName" class="ap__input" maxlength="60" placeholder="例：阿明小吃" />
        </label>

        <label class="ap__field">
          <span class="ap__label">聯絡人 <b>*</b></span>
          <input v-model="form.ownerName" class="ap__input" maxlength="40" placeholder="例：陳阿明" />
        </label>

        <label class="ap__field">
          <span class="ap__label">聯絡電話 <b>*</b></span>
          <input v-model="form.phone" class="ap__input" maxlength="30" inputmode="tel" placeholder="例：0912345678" />
        </label>

        <label class="ap__field">
          <span class="ap__label">Email</span>
          <input v-model="form.email" class="ap__input" maxlength="120" inputmode="email" placeholder="選填" />
        </label>

        <div class="ap__row">
          <label class="ap__field ap__field--half">
            <span class="ap__label">統一編號</span>
            <input v-model="form.taxId" class="ap__input" maxlength="8" inputmode="numeric" placeholder="選填" />
          </label>
          <label class="ap__field ap__field--half">
            <span class="ap__label">類型</span>
            <select v-model="form.businessType" class="ap__input">
              <option value="restaurant">餐飲</option>
              <option value="retail">零售</option>
              <option value="fruit">蔬果</option>
              <option value="other">其他</option>
            </select>
          </label>
        </div>

        <label class="ap__field">
          <span class="ap__label">店址</span>
          <input v-model="form.address" class="ap__input" maxlength="200" placeholder="選填" />
        </label>

        <label class="ap__field">
          <span class="ap__label">想先了解什麼</span>
          <textarea v-model="form.note" class="ap__input ap__input--area" maxlength="500" rows="3"
                    placeholder="選填。例：目前幾個座位、需不需要電子發票、想什麼時候開始用" />
        </label>

        <p v-if="error" class="ap__error">{{ error }}</p>

        <button class="ap__submit" :disabled="sending || !canSubmit" type="submit">
          {{ sending ? '送出中...' : '送出申請' }}
        </button>

        <RouterLink :to="{ name: 'Login' }" class="ap__back">已經有帳號了？前往登入</RouterLink>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { RouterLink } from 'vue-router'

/* 走 edge function 而不是 supabase client：這是免登入的公開頁，
 * store_applications 對 anon 是完全關閉的（RLS 開啟、零 policy），
 * 只有後端拿 service key 寫得進去。 */
const EDGE_URL = import.meta.env.DEV
  ? '/functions/v1/store-application'
  : 'https://axwsootizanehojafwnw.supabase.co/functions/v1/store-application'

const form = reactive({
  storeName: '', ownerName: '', phone: '', email: '',
  taxId: '', address: '', note: '', businessType: 'restaurant',
})

const sending = ref(false)
const error   = ref('')
const done    = ref(false)

const canSubmit = computed(() =>
  form.storeName.trim() && form.ownerName.trim() && form.phone.trim()
)

async function submit() {
  if (sending.value || !canSubmit.value) return
  sending.value = true
  error.value   = ''
  try {
    const res = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ ...form }),
    })
    const data = await res.json()
    if (!res.ok) { error.value = data.error ?? '送出失敗，請稍後再試'; return }
    done.value = true
  } catch {
    error.value = '網路錯誤，請確認連線後再試一次'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.ap { position: relative; width: 100%; min-height: 100%; display: flex;
      align-items: center; justify-content: center; overflow-y: auto; padding: 28px 16px; }
.ap__bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(ellipse at 30% 20%, #e8c88a 0%, transparent 55%),
    radial-gradient(ellipse at 75% 80%, #c8a070 0%, transparent 50%),
    #b8926a;
  filter: blur(24px); transform: scale(1.1);
}
.ap__card { position: relative; z-index: 1; width: 100%; max-width: 380px;
            background: #fff; border-radius: 16px; padding: 24px 22px;
            box-shadow: 0 16px 48px rgba(0,0,0,0.22); }

.ap__head { text-align: center; margin-bottom: 18px; }
.ap__logo  { font-size: 30px; }
.ap__title { font-size: 18px; font-weight: 700; color: #1a0800; margin-top: 6px; }
.ap__sub   { font-size: 12px; color: #a89880; margin-top: 5px; line-height: 1.6; }

.ap__form  { display: flex; flex-direction: column; gap: 11px; }
.ap__field { display: flex; flex-direction: column; gap: 4px; }
.ap__row   { display: flex; gap: 10px; }
.ap__field--half { flex: 1; min-width: 0; }
.ap__label { font-size: 11.5px; color: #7a6850; font-weight: 500; }
.ap__label b { color: #c0392b; font-weight: 500; }

.ap__input {
  padding: 8px 10px; border: 1.5px solid #c8b89a; border-radius: 8px;
  background: #faf5ec; font-size: 13.5px; color: #1a0800;
  outline: none; width: 100%; font-family: inherit;
}
.ap__input:focus { border-color: #e8a038; }
.ap__input--area { resize: vertical; line-height: 1.6; }

.ap__error {
  font-size: 12px; color: #a5342a; background: #fdeceb;
  border: 1px solid #f0c8c4; border-radius: 8px; padding: 8px 10px; line-height: 1.6;
}

.ap__submit {
  margin-top: 4px; padding: 11px; border: none; border-radius: 10px;
  background: #e8a038; color: #fff; font-size: 14.5px; font-weight: 600; cursor: pointer;
}
.ap__submit:hover:not(:disabled) { background: #d8902c; }
.ap__submit:disabled { opacity: 0.45; cursor: not-allowed; }

.ap__back { text-align: center; font-size: 12px; color: #7a6850; text-decoration: none; margin-top: 2px; }
.ap__back:hover { color: #e8a038; }

/* 送出成功 */
.ap__done { text-align: center; padding: 8px 0 4px; }
.ap__done-icon {
  width: 46px; height: 46px; margin: 0 auto 12px; border-radius: 50%;
  background: #e8f3ea; color: #2f7a3d; font-size: 24px;
  display: flex; align-items: center; justify-content: center;
}
.ap__done-title { font-size: 16px; font-weight: 700; color: #1a0800; }
.ap__done-text  { font-size: 12.5px; color: #7a6850; line-height: 1.8; margin-top: 8px; }
.ap__done-link  {
  display: inline-block; margin-top: 16px; font-size: 13px;
  color: #8a5a10; background: #fdf1de; border: 1px solid #ecd6ac;
  border-radius: 8px; padding: 8px 18px; text-decoration: none;
}
.ap__done-link:hover { background: #f8e6c8; }
</style>
