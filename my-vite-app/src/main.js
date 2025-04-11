import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import authStore from './authStore.js'
import './style.css'
import { initAssetSystem } from './utils/asset-loader'

// コンポーネントのインポート
import HomePage from './pages/Home.vue'
import LoginPage from './pages/Login.vue'
import PostFormPage from './pages/PostForm.vue'
import DetailPostPage from './pages/detailPost.vue'
import FavoritePage from './pages/Favorite.vue'
import TagsPage from './pages/Tags.vue'
import ProfilePage from './pages/Profile.vue'
import EditProfilePage from './pages/EditProfile.vue'
import UserRegisterPage from './pages/UserRegister.vue'  // UserRegisterコンポーネントをインポート

// ルート定義
const routes = [
  { path: '/', component: HomePage },
  { path: '/login', component: LoginPage },
  { path: '/register', component: UserRegisterPage },  // 登録ルートを追加
  { path: '/posts', component: PostFormPage },
  { path: '/detail/:id', component: DetailPostPage },
  { path: '/favorite', component: FavoritePage },
  { path: '/tags', component: TagsPage },
  { path: '/profile', component: ProfilePage },
  { path: '/edit-profile', component: EditProfilePage },
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

// アセットシステムを初期化
initAssetSystem();

// アプリケーション初期化
console.log('App initializing...');

// 環境情報ログ出力
console.log(`Current API URL: ${import.meta.env.VITE_API_BASE_URL}`);
console.log(`Current ENV: ${import.meta.env.MODE}`);
console.log(`App initializing with build timestamp: ${new Date().toISOString()}`);
console.log(`API Plugin initialized with base URL: ${import.meta.env.VITE_API_BASE_URL}`);

// アプリ作成とマウント
const app = createApp(App);
app.use(router);
app.mount('#app');

// サービスワーカーを登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker登録成功:', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker登録失敗:', error);
      });
  });
}

// グローバルエラーハンドラーを追加
app.config.errorHandler = (err, instance, info) => {
  console.error('Vue Error:', err);
  console.error('Error Component:', instance);
  console.error('Error Info:', info);
};

// デバッグ用グローバル変数 - 常に利用可能にする（環境問わず）
window.authStore = authStore;

// 初期化完了
console.log('App initialization complete!');

