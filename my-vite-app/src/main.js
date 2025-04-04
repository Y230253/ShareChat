import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import authStore from './authStore.js'

// コンポーネントのインポート
import HomePage from './pages/Home.vue'
import LoginPage from './pages/Login.vue'
import PostFormPage from './pages/PostForm.vue'
import DetailPostPage from './pages/detailPost.vue'
import FavoritePage from './pages/Favorite.vue'
import TagsPage from './pages/Tags.vue'
// User.vueは存在しないため削除

// ルート定義
const routes = [
  { path: '/', component: HomePage },
  { path: '/login', component: LoginPage },
  { path: '/posts', component: PostFormPage },
  { path: '/detail/:id', component: DetailPostPage },
  { path: '/favorite', component: FavoritePage },
  { path: '/tags', component: TagsPage },
  // User.vueへのルートも削除
]

// ルーターの作成
const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 認証前処理 - ルート変更のデバッグ
router.beforeEach((to, from, next) => {
  console.log(`Route change: ${from.path} -> ${to.path}`);
  next();
});

// アプリケーション初期化
console.log('App initializing...');

// 環境情報ログ出力
console.log(`Current API URL: ${import.meta.env.VITE_API_BASE_URL}`);
console.log(`Current ENV: ${import.meta.env.MODE}`);
console.log(`App initializing with build timestamp: ${new Date().toISOString()}`);
console.log(`API Plugin initialized with base URL: ${import.meta.env.VITE_API_BASE_URL}`);

// 認証情報の初期化
authStore.initAuth();
console.log('認証状態:', authStore.isLoggedIn.value ? 'ログイン済み' : '未ログイン');

// アプリ作成とマウント
const app = createApp(App);
app.use(router);
app.mount('#app');

// デバッグ用グローバル変数
if (import.meta.env.DEV) {
  window.authStore = authStore;
}

// 初期化完了
console.log('App initialization complete!');

