import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../src/pages/Home.vue'
import Favorite from '../src/pages/Favorite.vue'
import PostForm from '../src/pages/PostForm.vue'
import UserRegister from '../src/pages/UserRegister.vue'
import Login from '../src/pages/Login.vue'
import Tags from '../src/pages/Tags.vue'
import DetailPost from '../src/pages/detailPost.vue'

// キャッシュバスティング用のタイムスタンプ
const buildTimestamp = new Date().getTime()

const routes = [
  { 
    path: '/', 
    component: Home, 
    meta: { layout: 'default', showPhotoList: true, timestamp: buildTimestamp } 
  },
  { 
    path: '/favorite', 
    component: Favorite, 
    meta: { layout: 'favorite', showPhotoList: false, timestamp: buildTimestamp } 
  },
  { 
    path: '/posts', 
    component: PostForm, 
    meta: { layout: 'default', showPhotoList: false, timestamp: buildTimestamp } 
  },
  { 
    path: '/register', 
    component: UserRegister, 
    meta: { layout: 'default', showPhotoList: false, timestamp: buildTimestamp }
  },
  { 
    path: '/login', 
    component: Login, 
    meta: { layout: 'default', showPhotoList: false, timestamp: buildTimestamp } 
  },
  { 
    path: '/tags', 
    component: Tags, 
    meta: { layout: 'default', showPhotoList: false, timestamp: buildTimestamp } 
  },
  { 
    path: '/detail/:id', 
    component: DetailPost, 
    meta: { layout: 'default', showPhotoList: false, timestamp: buildTimestamp } 
  },
  // キャッチオールルート - 404ページへのリダイレクト
  { 
    path: '/:pathMatch(.*)*', 
    redirect: '/' 
  }
]

const router = createRouter({
  // HTML5履歴モードからハッシュ履歴モードに変更
  // これによりページリロード時の認証エラーが解消されます
  history: createWebHashHistory(),
  routes,
})

export default router
