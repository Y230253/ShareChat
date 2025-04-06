import { createRouter, createWebHistory } from 'vue-router';
import authStore from '../authStore.js';

// ルート定義
import Home from '../pages/Home.vue';
import Login from '../pages/Login.vue';
import Register from '../pages/Register.vue';
import Profile from '../pages/Profile.vue';
import PostDetail from '../pages/PostDetail.vue';
import NotFound from '../pages/NotFound.vue';
import UserRegister from '../pages/UserRegister.vue';
import EditProfile from '../pages/EditProfile.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/login', component: Login },
  { path: '/register', component: Register },
  { path: '/user-register', component: UserRegister },
  {
    path: '/profile',
    name: 'Profile',
    component: Profile,
    meta: { requiresAuth: true }
  },
  {
    path: '/edit-profile',
    name: 'EditProfile',
    component: EditProfile,
    meta: { requiresAuth: true }
  },
  { path: '/posts/:id', component: PostDetail },
  { path: '/:pathMatch(.*)*', component: NotFound }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

// ナビゲーションガード
router.beforeEach((to, from, next) => {
  console.log('Route change:', from.path, '->', to.path);
  
  // 認証が必要なルートの場合
  if (to.matched.some(record => record.meta.requiresAuth)) {
    console.log('Checking authentication for protected route:', to.path);
    console.log('Auth state:', authStore.isLoggedIn.value ? 'logged in' : 'not logged in');
    
    if (!authStore.isLoggedIn.value) {
      console.warn('Authentication required for', to.path, 'but user is not logged in');
      next({ name: 'Login', query: { redirect: to.fullPath } });
      return;
    }
  }
  
  // 正常に次のルートへ進む
  console.log('Proceeding to route:', to.path);
  next();
});

export default router;