import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // 相対パスに変更
  base: './',
  plugins: [vue()],
  // Cloud Run環境のための本番設定
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    sourcemap: false, // 本番環境ではソースマップ無効化
  },
  // 環境変数プレフィックス設定
  envPrefix: 'VITE_',
})
