<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div :class="['content', { 'with-sidebar': isSidebarOpen }]">
        <div class="favorite-container">
          <h1>お気に入り 📌</h1>
          
          <!-- タグフィルター（ログイン中のみ表示） -->
          <div v-if="isLoggedIn" class="tag-filter">
            <input
              type="text"
              v-model="tagFilter"
              placeholder="タグでフィルタ"
              class="tag-input"
              @keydown.enter="applyTagFilter"
            />
            <button @click="applyTagFilter" class="filter-btn">フィルタ</button>
            <button v-if="currentTagFilter" @click="clearTagFilter" class="clear-btn">クリア</button>
          </div>
          
          <!-- 現在のフィルター表示 -->
          <div v-if="currentTagFilter" class="current-filter">
            <p>フィルター: <span class="filter-tag">#{{ currentTagFilter }}</span></p>
          </div>
          
          <!-- 未ログイン時の表示 -->
          <div v-if="!isLoggedIn" class="login-prompt">
            <p>お気に入り投稿を表示するには<router-link to="/login">ログイン</router-link>してください</p>
          </div>
          
          <!-- ローディング表示 -->
          <div v-else-if="loading" class="loading">
            <div class="spinner"></div>
            <p>読み込み中...</p>
          </div>
          
          <!-- エラー表示 -->
          <div v-else-if="error" class="error">
            <p>{{ error }}</p>
            <button @click="fetchBookmarkedPosts">再読み込み</button>
          </div>
          
          <!-- ブックマークなしの表示 -->
          <div v-else-if="bookmarkedPosts.length === 0" class="empty-state">
            <p>{{ currentTagFilter ? `「${currentTagFilter}」のタグがついたブックマーク投稿はありません` : 'ブックマークした投稿はありません' }}</p>
            <div class="action-buttons">
              <router-link to="/" class="browse-btn">投稿を見る</router-link>
              <button v-if="currentTagFilter" @click="clearTagFilter" class="clear-filter-btn">フィルターをクリア</button>
            </div>
          </div>
          
          <!-- ブックマーク投稿一覧 -->
          <ul v-else :style="{ display: 'grid', gap: '1rem', gridTemplateColumns: `repeat(${columns}, 1fr)` }">
            <li v-for="post in bookmarkedPosts" :key="post.id">
              <PhotoItem :photo="post" />
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Header from '../components/header.vue'
import Sidebar from '../components/Sidebar.vue'
import PhotoItem from '../components/PhotoItem.vue'
import authStore from '../authStore.js'
import { apiCall } from '../services/api.js' // APIサービスをインポート

const router = useRouter()
const route = useRoute()
const isSidebarOpen = ref(false)
const loading = ref(false)
const error = ref(null)
const bookmarkedPosts = ref([])
const tagFilter = ref('')
const currentTagFilter = ref('')

// ログイン状態を監視
const isLoggedIn = computed(() => authStore.isLoggedIn.value)

// レスポンシブ対応のカラム数
const columns = ref(1)

const updateColumns = () => {
  const width = window.innerWidth
  if (width < 500) {
    columns.value = 1
  } else if (width < 768) {
    columns.value = isSidebarOpen.value ? 1 : 2
  } else if (width < 1024) {
    columns.value = isSidebarOpen.value ? 2 : 3
  } else {
    columns.value = isSidebarOpen.value ? 3 : 4
  }
}

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value
  updateColumns()
}

// タグフィルター適用
const applyTagFilter = () => {
  const tag = tagFilter.value.trim()
  if (tag) {
    currentTagFilter.value = tag
    fetchBookmarkedPosts()
  }
}

// タグフィルタークリア
const clearTagFilter = () => {
  currentTagFilter.value = ''
  tagFilter.value = ''
  fetchBookmarkedPosts()
}

// ブックマーク投稿を取得する関数
const fetchBookmarkedPosts = async () => {
  if (!isLoggedIn.value) return
  
  loading.value = true
  error.value = null
  
  try {
    // クエリパラメータの構築
    let endpoint = '/bookmarked-posts'
    if (currentTagFilter.value) {
      endpoint += `?tag=${encodeURIComponent(currentTagFilter.value)}`
    }
    
    // APIサービスを使用
    const data = await apiCall(endpoint)
    bookmarkedPosts.value = data
    console.log('ブックマーク投稿取得成功:', data.length)
  } catch (err) {
    console.error('ブックマーク投稿取得エラー:', err)
    error.value = err.message || 'データの取得に失敗しました'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  // ウィンドウサイズ変更の監視
  window.addEventListener('resize', updateColumns)
  updateColumns()
  
  // ログイン中なら投稿を取得
  if (isLoggedIn.value) {
    fetchBookmarkedPosts()
  }
  
  // ログイン状態変化時に再取得
  watch(() => authStore.isLoggedIn.value, (newVal) => {
    if (newVal) {
      fetchBookmarkedPosts()
    } else {
      bookmarkedPosts.value = []
    }
  })
})

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns)
})

// サイドバー状態変更時にカラム数更新
watch(() => isSidebarOpen.value, () => {
  updateColumns()
})
</script>

<style scoped>
.favorite-container {
  padding: 20px;
  margin-top: 60px;
  width: 100%;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
  color: #2e7d32;
}

.content {
  flex: 1;
  transition: margin-left 0.3s;
  margin-left: 0;
}

.content.with-sidebar {
  margin-left: 220px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  margin-bottom: 20px;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 50px 0;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  text-align: center;
  padding: 30px;
  color: #e53935;
}

.error button {
  background-color: #42b983;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  margin-top: 15px;
  cursor: pointer;
}

.empty-state {
  text-align: center;
  padding: 50px 20px;
  color: #666;
}

.browse-btn {
  display: inline-block;
  background-color: #42b983;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  margin-top: 15px;
  text-decoration: none;
}

.login-prompt {
  text-align: center;
  padding: 50px 20px;
  background-color: #f5f5f5;
  border-radius: 8px;
  margin: 20px;
}

.login-prompt a {
  color: #42b983;
  text-decoration: underline;
  font-weight: bold;
}

/* タグフィルター */
.tag-filter {
  display: flex;
  max-width: 500px;
  margin: 0 auto 20px;
}

.tag-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #a5d6a7;
  border-radius: 4px 0 0 4px;
  font-size: 1rem;
}

.filter-btn {
  background-color: #2e7d32;
  color: white;
  border: none;
  padding: 0 15px;
  border-radius: 0 4px 4px 0;
  cursor: pointer;
}

.clear-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 0 15px;
  border-radius: 4px;
  margin-left: 8px;
  cursor: pointer;
}

.current-filter {
  text-align: center;
  margin-bottom: 20px;
  font-size: 0.9rem;
}

.filter-tag {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: bold;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.clear-filter-btn {
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}
</style>