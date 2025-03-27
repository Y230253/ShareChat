import { createApp } from 'vue'
import App from './App.vue'
import router from '../router/index.js'
import './style.css'
import authStore from './authStore.js'

// アプリケーション起動時に認証情報を初期化
authStore.initAuth()

createApp(App)
  .use(router)
  .mount('#app')

