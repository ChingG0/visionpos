import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 每次 build 都會產生一組新的版本號（用 build 當下的時間戳記即可，不需要跟 git 綁在一起）。
// 同一個值會被：① define 進前端程式碼裡（跑在瀏覽器裡、當下這個版本認得的版本號）、
// ② 寫成一個獨立的 version.json 靜態檔（每次重新整理都會去問這個檔案「現在最新版本是多少」）。
// 兩邊只要對不上，就代表使用者手上這個分頁是舊版本，該重新整理了。
const BUILD_VERSION = String(Date.now())

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  plugins: [
    vue(),
    vueDevTools(),
    {
      name: 'emit-version-json',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ version: BUILD_VERSION }),
        })
      },
    },
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // 移除所有 console.log/warn/error
        drop_debugger: true,
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/functions': {
        target: 'https://axwsootizanehojafwnw.supabase.co',
        changeOrigin: true,
        secure: true,
      }
    }
  }
})