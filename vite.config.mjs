import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  plugins: [vue()],
  // 产物直接落进 utools/，让该目录成为自包含的插件根目录
  // （plugin.json 与它引用的 preload.js、logo.png 都在同级）。
  build: {
    outDir: 'utools/dist',
    emptyOutDir: true,
  },
})
