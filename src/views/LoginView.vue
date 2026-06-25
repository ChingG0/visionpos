<template>
  <div class="login">
    <div class="login__bg" />
    <div class="login__card">

      <div class="login__logo">
        <span class="login__logo-icon">🍽</span>
        <h1 class="login__logo-name">VisionPOS</h1>
        <p class="login__logo-sub">智慧餐飲管理系統</p>
      </div>

      <form @submit.prevent="handleLogin" autocomplete="on" class="login__form">

        <div class="login__section">
          <div class="login__input-row">
            <span class="login__input-icon">🔒</span>
            <input
              v-model="storeCode"
              class="login__input"
              @input="storeCode = storeCode.toUpperCase()"
              type="text"
              placeholder="店家代碼"
              autocomplete="off"
              autocapitalize="characters"
              @keyup.enter="focusUsername"
            />
          </div>
        </div>

        <div class="login__section login__section--grouped">
          <div class="login__input-row login__input-row--top">
            <span class="login__input-icon">👤</span>
            <input
              ref="usernameRef"
              v-model="username"
              class="login__input"
              type="text"
              placeholder="帳號"
              autocomplete="username"
              @keyup.enter="focusPassword"
            />
          </div>
          <div class="login__divider" />
          <div class="login__input-row login__input-row--bottom">
            <span class="login__input-icon">🔑</span>
            <input
              ref="passwordRef"
              v-model="password"
              class="login__input"
              :type="showPassword ? 'text' : 'password'"
              placeholder="密碼"
              autocomplete="current-password"
            />
            <button class="login__eye" @click="showPassword = !showPassword" type="button">
              {{ showPassword ? '🙈' : '👁' }}
            </button>
          </div>
        </div>

        <Transition name="login-err">
          <p v-if="authStore.error" class="login__error">⚠ {{ authStore.error }}</p>
        </Transition>

        <button
          type="submit"
          class="login__btn"
          :class="{ 'login__btn--ready': canLogin }"
          :disabled="!canLogin || authStore.loading"
        >
          <span v-if="authStore.loading" class="login__spinner" />
          <span v-else>登入</span>
        </button>

      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/authStore.js'

const router    = useRouter()
const authStore = useAuthStore()

const storeCode    = ref('')
const username     = ref('')
const password     = ref('')
const showPassword = ref(false)
const usernameRef  = ref(null)
const passwordRef  = ref(null)

const canLogin = computed(() =>
  storeCode.value.trim().length > 0 &&
  username.value.trim().length  > 0 &&
  password.value.length         > 0
)

function focusUsername() { usernameRef.value?.focus() }
function focusPassword() { passwordRef.value?.focus() }

async function handleLogin() {
  if (!canLogin.value || authStore.loading) return
  const ok = await authStore.login(storeCode.value, username.value, password.value)
  if (ok) router.replace({ name: 'NewOrder', params: { storeCode: authStore.store.code } })
}
</script>

<style scoped>
.login {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.login__bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 30% 20%, #e8c88a 0%, transparent 55%),
    radial-gradient(ellipse at 75% 80%, #c8a070 0%, transparent 50%),
    #b8926a;
  filter: blur(24px);
  transform: scale(1.1);
}

.login__card {
  position: relative;
  z-index: 1;
  width: 300px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login__form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.login__logo { text-align: center; margin-bottom: 6px; }
.login__logo-icon { font-size: 40px; display: block; margin-bottom: 6px; }
.login__logo-name {
  font-size: 24px; font-weight: 800; color: #fff;
  text-shadow: 0 1px 6px rgba(0,0,0,.25); letter-spacing: 1px;
}
.login__logo-sub { font-size: 13px; color: rgba(255,255,255,.75); margin-top: 3px; }

.login__section {
  background: rgba(255,255,255,.92);
  border-radius: 14px;
  overflow: hidden;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 16px rgba(0,0,0,.12);
}
.login__input-row {
  display: flex; align-items: center;
  padding: 0 14px; height: 52px;
}
.login__input-icon { font-size: 16px; margin-right: 10px; flex-shrink: 0; }
.login__input {
  flex: 1; border: none; outline: none;
  background: transparent; font-size: 16px; color: #1a1a1a;
}
.login__input::placeholder { color: #bbb; }
.login__eye {
  background: none; border: none;
  font-size: 15px; cursor: pointer; padding: 0 2px; opacity: .6;
}
.login__divider { height: 1px; background: #f0ece5; margin: 0 14px; }

.login__error {
  font-size: 13px; color: #fff;
  background: rgba(200,50,50,.75);
  border-radius: 10px; padding: 8px 14px;
  text-align: center; backdrop-filter: blur(6px);
}
.login-err-enter-active, .login-err-leave-active { transition: all .2s; }
.login-err-enter-from, .login-err-leave-to { opacity: 0; transform: translateY(-6px); }

.login__btn {
  height: 52px; border-radius: 14px; border: none;
  font-size: 17px; font-weight: 600; letter-spacing: .5px;
  cursor: pointer; display: flex; align-items: center;
  justify-content: center; gap: 8px;
  background: rgba(255,255,255,.35); color: rgba(255,255,255,.6);
  transition: all .2s; box-shadow: 0 2px 12px rgba(0,0,0,.1);
  width: 100%;
}
.login__btn--ready {
  background: rgba(255,255,255,.92); color: #c08020;
  box-shadow: 0 3px 18px rgba(0,0,0,.18);
}
.login__btn--ready:hover { background: #fff; }
.login__btn:disabled { cursor: not-allowed; }

.login__spinner {
  width: 20px; height: 20px;
  border: 2px solid #e8a038;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin .7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
</style>