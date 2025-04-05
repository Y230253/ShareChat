<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      
      <div :class="['content', { 'with-sidebar': isSidebarOpen }]">
        <h1>お気に入り</h1>
        
        <div v-if="error" class="error-message">{{ error }}</div>
        
        <div v-else-if="loading" class="loading">
          <div class="spinner"></div>
          <p>お気に入りを読み込み中...</p>
        </div>
        
        <div v-else-if="bookmarkedPosts.length === 0" class="no-content">
          <p>まだお気に入りに追加された投稿はありません。</p>
          <button @click="router.push('/')" class="home-btn">
            投稿を見る
          </button>
        </div>
        
        <PhotoList v-else :photos="bookmarkedPosts" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import Header from '../components/header.vue';
import Sidebar from '../components/Sidebar.vue';
import PhotoList from '../components/PhotoList.vue';
import authStore from '../authStore.js';
import { api } from '../services/api.js';

const router = useRouter();
const isSidebarOpen = ref(false);
const bookmarkedPosts = ref([]);
const loading = ref(true);
const error = ref('');

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const fetchBookmarkedPosts = async () => {
  if (!authStore.isLoggedIn.value) {
    error.value = 'お気に入りを表示するにはログインが必要です';
    setTimeout(() => router.push('/login'), 2000);
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  try {
    // ブックマークした投稿を取得
    bookmarkedPosts.value = await api.bookmarks.getPosts();
    console.log(`ブックマークされた投稿を${bookmarkedPosts.value.length}件取得しました`);
  } catch (err) {
    console.error("ブックマーク投稿取得エラー:", err);
    error.value = "お気に入り投稿の取得に失敗しました";
    bookmarkedPosts.value = []; // エラー時は空配列を設定
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchBookmarkedPosts();
  
  // 認証状態変更時に再取得
  authStore.$subscribe((_, state) => {
    if (state.isLoggedIn) {
      fetchBookmarkedPosts();
    } else {
      bookmarkedPosts.value = [];
      error.value = 'お気に入りを表示するにはログインが必要です';
    }
  });
});
</script>

<style scoped>
.main-wrapper {
  display: flex;
  flex: 1;
  margin-top: 60px; /* ヘッダーの高さ分 */
}

.content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  transition: margin-left 0.3s;
  margin-left: 0;
  padding: 20px;
}

.content.with-sidebar {
  margin-left: 220px;
}

h1 {
  color: #2c3e50;
  margin-bottom: 30px;
  font-size: 24px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 50px 0;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-radius: 50%;
  border-top-color: #42b983;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-content {
  text-align: center;
  margin: 50px 0;
  color: #666;
}

.home-btn {
  background-color: #42b983;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s;
}

.home-btn:hover {
  background-color: #3aa876;
}

.error-message {
  background-color: #fee;
  color: #c00;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}
</style>