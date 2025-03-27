import { createRouter, createWebHistory } from 'vue-router'
import Home from '../src/pages/Home.vue'
import Login from '../src/pages/Login.vue'
import UserRegister from '../src/pages/UserRegister.vue'
import PostForm from '../src/pages/PostForm.vue'
import DetailPost from '../src/pages/detailPost.vue'

const routes = [
  {
    path: '/',
    component: Home,
    meta: {
      showPhotoList: true
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
    component: PostForm
  },
  // 詳細ページのルート追加
  {
    path: '/detail/:id',
    component: DetailPost,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router