<template>
  <div>
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
    
    <!-- ブックマークした投稿だけを表示 -->
    <PhotoList v-else :photos="bookmarkedPosts" />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import PhotoList from '../components/PhotoList.vue';
import authStore from '../authStore.js';
import { api } from '../services/api.js';

const router = useRouter();
const bookmarkedPosts = ref([]);
const loading = ref(true);
const error = ref('');
let authChangeUnsubscribe = null;

const fetchBookmarkedPosts = async () => {
  // ログイン確認
  if (!authStore.isLoggedIn.value) {
    error.value = 'お気に入りを表示するにはログインが必要です';
    setTimeout(() => router.push('/login'), 2000);
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  try {
    console.log('ブックマークした投稿を取得中...');
    // ブックマーク済み投稿だけを取得するAPIを使用
    const posts = await api.bookmarks.getPosts();
    
    // 重要: ここで別のポストを取得しないように注意
    bookmarkedPosts.value = posts;
    console.log(`ブックマークされた投稿を${posts.length}件取得しました`);
  } catch (err) {
    console.error("ブックマーク投稿取得エラー:", err);
    error.value = "お気に入り投稿の取得に失敗しました";
    bookmarkedPosts.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchBookmarkedPosts();
  
  // 認証状態変更時の処理
  if (typeof authStore.on === 'function') {
    authChangeUnsubscribe = authStore.on('auth-change', (state) => {
      console.log('認証状態変更検出:', state.isLoggedIn);
      if (state.isLoggedIn) {
        fetchBookmarkedPosts();
      } else {
        bookmarkedPosts.value = [];
        error.value = 'お気に入りを表示するにはログインが必要です';
      }
    });
  } else {
    console.warn('authStore.onメソッドが利用できません');
  }
});

// コンポーネント破棄時の処理
onUnmounted(() => {
  if (authChangeUnsubscribe) {
    authChangeUnsubscribe();
  }
});
</script>

<style scoped>
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