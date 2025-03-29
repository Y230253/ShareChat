import { createRouter, createWebHistory } from 'vue-router'
import Home from '../src/pages/Home.vue'
import Login from '../src/pages/Login.vue'
import UserRegister from '../src/pages/UserRegister.vue'
import PostForm from '../src/pages/PostForm.vue'
import DetailPost from '../src/pages/detailPost.vue'
import Tags from '../src/pages/Tags.vue'
import authStore from '../src/authStore.js'

const routes = [
  {
    path: '/',
    component: Home,
    meta: {
      showPhotoList: true,
      requiresAuth: true // 認証が必要なルートに設定
    }
  },
  {
    path: '/login',
    component: Login
  },
  {
    path: '/register',
    component: UserRegister
  },
  {
    path: '/posts',
    component: PostForm,
    meta: {
      requiresAuth: true // 認証が必要なルートに設定
    }
  },
  {
    path: '/detail/:id',
    component: DetailPost,
    props: true
  },
  {
    path: '/favorite',
    component: () => import('../src/pages/Favorite.vue'),
    meta: {
      showPhotoList: true,
      requiresAuth: true // 認証が必要なルートに設定
    }
  },
  {
    path: '/tags',
    component: Tags,
    meta: {
      showPhotoList: true,
      requiresAuth: true // 認証が必要なルートに設定
    }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// グローバルナビゲーションガードを追加
router.beforeEach((to, from, next) => {
  // ルートが認証を必要とするかチェック
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  
  // 現在のユーザーの認証状態を確認
  const isAuthenticated = authStore.isLoggedIn.value
  
  // 起動時または認証が必要なページにアクセスしようとしているが、ログインしていない場合
  if (requiresAuth && !isAuthenticated) {
    console.log('認証が必要なページにアクセスしようとしています。ログインページにリダイレクト。')
    next('/login')
  } else {
    // それ以外の場合は通常の遷移を許可
    next()
  }
})

export default router