import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router/index.js'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())   // ← Pinia 必須在 router 之前或同時，且在 mount 之前
app.use(router)
app.mount('#app')