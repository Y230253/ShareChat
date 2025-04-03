import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import authStore from './authStore'

// キャッシュバスティング用のコード
console.log('App initializing with build timestamp:', new Date().toISOString())

// キャッシュされたコンポーネントを強制的にリフレッシュする処理
router.beforeEach((to, from, next) => {
  if (to.path === from.path && to.hash === from.hash) {
    console.log('Same route detected, forcing refresh')
    window.location.reload()
    return
  }
  console.log(`Route change: ${from.path} -> ${to.path}`)
  next()
})

// アプリケーション起動時に認証情報を初期化
authStore.initAuth()

const app = createApp(App)
app.use(router)
app.mount('#app')

