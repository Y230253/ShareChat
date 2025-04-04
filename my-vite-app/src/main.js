import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import authStore from './authStore'

// キャッシュバスティング用のコード
console.log('App initializing with build timestamp:', new Date().toISOString())

// シンプルなログのみ出力するフック
router.beforeEach((to, from, next) => {
  console.log(`Route change: ${from.path} -> ${to.path}`)
  next()
})

// アプリケーション起動時に認証情報を初期化
authStore.initAuth()

const app = createApp(App)
app.use(router)
app.mount('#app')

