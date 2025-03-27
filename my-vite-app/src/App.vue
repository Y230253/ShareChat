<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import Header from './components/header.vue';
import Sidebar from './components/Sidebar.vue';
import PhotoList from './components/PhotoList.vue';
import { useRoute } from 'vue-router';
import authStore from './authStore.js';

const count = ref(0);
const isSidebarOpen = ref(false);
const route = useRoute();
const showPhotoList = computed(() => route.meta.showPhotoList ?? true);
// 投稿フォームへ遷移
const goToPostForm = () => {
  console.log("Navigating to /posts")
  router.push('/posts').catch(err => console.error(err))
}
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const checkWindowSize = () => {
  if(window.innerWidth > 768){
    isSidebarOpen.value = true;
  } else {
    isSidebarOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('resize', checkWindowSize);
  checkWindowSize();
  authStore.initAuth();
});

onUnmounted(() => {
  window.removeEventListener('resize', checkWindowSize);
});
</script>

<template>
  <router-view />
</template>

<style>
.App {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.main-wrapper {
  display: flex;
  flex: 1;
  min-height: 0;
}
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  min-height: 0;
  transition: margin-left 0.3s;
  margin-left: 0;
  padding-bottom: 20px;
  scrollbar-width: none; /* Firefox */
}
.content::-webkit-scrollbar {
  display: none; /* Chrome, Safari */
}
.content.with-sidebar {
  margin-left: 220px;
}
</style>
