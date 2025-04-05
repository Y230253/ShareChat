<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Header from './components/header.vue';
import Sidebar from './components/Sidebar.vue';
import PhotoList from './components/PhotoList.vue';
import authStore from './authStore.js';

// ルーターとルートの設定
const router = useRouter();
const route = useRoute();

const isSidebarOpen = ref(false);
const showPhotoList = computed(() => route.meta.showPhotoList ?? true);

// 投稿フォームへ遷移
const goToPostForm = () => {
  console.log("Navigating to /posts");
  router.push('/posts').catch(err => console.error(err));
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
  console.log("App component mounted");
  window.addEventListener('resize', checkWindowSize);
  checkWindowSize();
  authStore.initAuth();
  console.log('アプリ全体で認証状態を初期化しました');
});

onUnmounted(() => {
  window.removeEventListener('resize', checkWindowSize);
});
</script>

<template>
  <div class="App">
    <!-- ヘッダーはすべてのページで共通 -->
    <Header :toggleSidebar="toggleSidebar" />
    
    <div class="main-wrapper">
      <!-- サイドバーはすべてのページで共通 -->
      <Sidebar :isOpen="isSidebarOpen" />
      
      <!-- ルート固有のコンテンツ -->
      <div :class="['content', { 'with-sidebar': isSidebarOpen }]">
        <router-view />
        
        <!-- 投稿ボタン（ホームページのみ表示） -->
        <button v-if="route.path === '/'" @click="goToPostForm" class="post-button">
          写真を投稿する
        </button>
      </div>
    </div>
  </div>
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
  margin-top: 60px; /* ヘッダーの高さ分のマージンを追加 */
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

/* 投稿ボタンのスタイル */
.post-button {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background-color: #42b983;
  color: white;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 3px 6px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}
.post-button:hover {
  background-color: #359268;
  box-shadow: 0 5px 12px rgba(0,0,0,0.3);
}
</style>
