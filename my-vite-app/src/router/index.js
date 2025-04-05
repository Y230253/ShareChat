import { createRouter, createWebHistory } from 'vue-router';
import authStore from '../authStore.js';

// ルート定義
import Home from '../views/Home.vue';
import Login from '../views/Login.vue';
import Register from '../views/Register.vue';
import Profile from '../views/Profile.vue';
import PostDetail from '../views/PostDetail.vue';
import NotFound from '../views/NotFound.vue';
import UserRegister from '../pages/UserRegister.vue'; // UserRegisterのインポートを追加
import UserEdit from '../views/UserEdit.vue'; // ユーザー編集ページをインポート

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  // UserRegisterへのルートを追加
  { path: '/user-register', component: UserRegister },
  { path: '/profile', component: Profile, meta: { requiresAuth: true } },
  // ユーザー編集ページへのルートを追加
  { path: '/edit-profile', component: UserEdit, meta: { requiresAuth: true } },
  { path: '/posts/:id', component: PostDetail },
  { path: '/:pathMatch(.*)*', component: NotFound }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// 認証チェックのナビゲーションガード
router.beforeEach((to, from, next) => {
  console.log(`ナビゲーション: ${from.path} -> ${to.path}`);
  
  // 認証状態を初期化
  authStore.initAuth();
  
  // ログイン必須のページへのアクセスをチェック
  if (to.meta.requiresAuth) {
    if (authStore.isLoggedIn.value && authStore.hasToken()) {
      console.log('認証済みユーザー: アクセス許可');
      next();
    } else {
      console.warn('認証が必要: ログインページへリダイレクト');
      next({ path: '/login', query: { redirect: to.fullPath } });
    }
  } else {
    // 認証不要ページはそのまま表示
    next();
  }
});

export default router;