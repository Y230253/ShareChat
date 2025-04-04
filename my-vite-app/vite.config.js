import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  // 認証URLでも動作するよう完全に空のbase pathを使用
  base: '',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
    // ソースマップはデバッグ中のみ有効にする
    sourcemap: false,
    // アセットのパス解決方法を調整 - これが重要
    rollupOptions: {
      output: {
        // ハッシュを短く、パスを単純化
        chunkFileNames: 'assets/[name].[hash:6].js',
        entryFileNames: 'assets/[name].[hash:6].js',
        assetFileNames: 'assets/[name].[hash:6].[ext]',
        // マニュアルチャンクを無効化
        manualChunks: undefined
      }
    }
  },
  // 環境変数プレフィックス設定
  envPrefix: 'VITE_',
  // 開発サーバー設定
  server: {
    proxy: {
      // 開発時にAPIリクエストをプロキシする設定
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
