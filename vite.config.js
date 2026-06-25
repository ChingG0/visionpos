import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

export default defineConfig({
  plugins: [vue(), vueDevTools()],
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