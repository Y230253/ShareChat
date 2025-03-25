import { createRouter, createWebHistory } from 'vue-router'
import Home from '../src/pages/Home.vue'
import Favorite from '../src/pages/Favorite.vue'
import PostForm from '../src/pages/PostForm.vue' // PostForm.vue がこのパスに存在するか確認
import Login from '../src/pages/Login.vue' // Login.vue がこのパスに存在するか確認
import UserRegister from '../src/pages/UserRegister.vue' // Register.vue がこのパスに存在するか確認

const routes = [
  { path: '/', component: Home, meta: { layout: 'default', showPhotoList: true } },
  { path: '/favorite', component: Favorite, meta: { layout: 'favorite', showPhotoList: true } },
  { path: '/posts', component: PostForm, meta: { layout: 'default', showPhotoList: false } },
 // { path: '/login', component: Login, meta: { layout: 'default', showPhotoList: true } },
 // { path: '/register', component: Register, meta: { layout: 'default', showPhotoList: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
//ページ遷移関係はここに記述しないと反映されない