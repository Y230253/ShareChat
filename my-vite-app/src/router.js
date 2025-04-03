import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '../src/pages/Home.vue'
import Favorite from '../src/pages/Favorite.vue'
import PostForm from '../src/pages/PostForm.vue' // PostForm.vue がこのパスに存在するか確認

const routes = [
  { path: '/', component: Home, meta: { layout: 'default', showPhotoList: true } },
  { path: '/favorite', component: Favorite, meta: { layout: 'favorite', showPhotoList: false } },
  { path: '/posts', component: PostForm, meta: { layout: 'default', showPhotoList: false } }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

export default router
