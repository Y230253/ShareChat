<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div :class="['content', { 'with-sidebar': isSidebarOpen }]" >
        <PhotoList v-if="showPhotoList" :sidebarOpen="isSidebarOpen" />
        <button @click="goToPostForm"><router-link to="/posts">写真を投稿する</router-link></button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from '../components/header.vue'
import Sidebar from '../components/Sidebar.vue'
import PhotoList from '../components/PhotoList.vue'

const router = useRouter()
const route = useRoute()
const isSidebarOpen = ref(false)
const showPhotoList = computed(() => route.meta.showPhotoList ?? true)

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
}
const checkWindowSize = () => {
  if(window.innerWidth > 768){
    isSidebarOpen.value = true
  } else {
    isSidebarOpen.value = false
  }
}
onMounted(() => {
  window.addEventListener('resize', checkWindowSize)
  checkWindowSize()
})
onUnmounted(() => {
  window.removeEventListener('resize', checkWindowSize)
})

// 投稿フォームへ遷移

const goToPostForm = () => {
  console.log("Navigating to /posts")
  router.push('/posts').catch(err => console.error(err))
}
</script>
