<template>
  <div class = "App">
    <Header :toggleSidebar="toggleSidebar" />
    <h1>お気に入り</h1>
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
    <ul>
      <li v-for="photo in bookmarkedPhotos" :key="photo.id">
        <PhotoItem :photo="photo" />
      </li>
    </ul>
    </div>
  </div>
</template>

<script setup>
import { bookmarkedPhotos } from '../bookmarkStore.js'
import PhotoItem from '../components/PhotoItem.vue'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from '../components/header.vue'
import Sidebar from '../components/Sidebar.vue'
import PhotoList from '../components/PhotoList.vue'

const isSidebarOpen = ref(false)
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
</script>

<style scoped>
/* ...existing styles... */
</style>