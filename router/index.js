import { createRouter, createWebHistory } from 'vue-router'
import Home from '../src/pages/Home.vue'
import Favorite from '../src/pages/Favorite.vue'
import PostForm from '../src/pages/PostForm.vue' // PostForm.vue をインポート

const routes = [
  { path: '/', component: Home, meta: { layout: 'default', showPhotoList: true } },
  { path: '/favorite', component: Favorite, meta: { layout: 'favorite', showPhotoList: false } },
  { path: '/posts', component: PostForm, meta: { layout: 'default', showPhotoList: false } } // 追加
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
