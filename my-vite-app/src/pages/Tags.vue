<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div :class="['content', { 'with-sidebar': isSidebarOpen }]">
        <div class="tags-container">
          <h1 v-if="selectedTag">タグ: #{{ selectedTag }}</h1>
          <h1 v-else>タグから探す</h1>
          
          <!-- タグ検索フォーム -->
          <div class="tag-search">
            <input
              type="text"
              v-model="tagInput"
              placeholder="タグを検索またはクリック"
              class="tag-search-input"
              @keydown.enter="searchTag"
            />
            <button @click="searchTag" class="search-btn">検索</button>
          </div>
          
          <!-- 人気タグクラウド -->
          <div class="popular-tags">
            <h2>人気のタグ</h2>
            <div class="tag-cloud">
              <button
                v-for="tag in popularTags"
                :key="tag.id"
                @click="selectTag(tag.name)"
                class="tag-btn"
                :class="{ 'selected': tag.name === selectedTag }"
              >
                #{{ tag.name }} ({{ tag.count || 0 }})
              </button>
            </div>
          </div>
          
          <!-- 投稿一覧 -->
          <div class="posts-section">
            <!-- ローディング表示 -->
            <div v-if="loading" class="loading">
              <div class="spinner"></div>
              <p>読み込み中...</p>
            </div>
            
            <!-- エラー表示 -->
            <div v-else-if="error" class="error">
              <p>{{ error }}</p>
              <button @click="fetchPosts">再読み込み</button>
            </div>
            
            <!-- 投稿なしの表示 -->
            <div v-else-if="selectedTag && posts.length === 0" class="empty-state">
              <p>「{{ selectedTag }}」のタグがついた投稿はありません</p>
              <button @click="clearTag" class="clear-tag-btn">タグをクリア</button>
            </div>
            
            <!-- タグ未選択時の表示 -->
            <div v-else-if="!selectedTag" class="empty-state">
              <p>タグを選択すると、関連する投稿が表示されます</p>
            </div>
            
            <!-- 投稿リスト -->
            <ul v-else :style="{ display: 'grid', gap: '1rem', gridTemplateColumns: `repeat(${columns}, 1fr)` }">
              <li v-for="post in posts" :key="post.id">
                <PhotoItem :photo="post" />
              </li>
            </ul>
          </div>
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

const router = useRouter()
const route = useRoute()
const isSidebarOpen = ref(false)
const loading = ref(false)
const error = ref(null)
const posts = ref([])
const tagInput = ref('')
const selectedTag = ref('')
const popularTags = ref([])

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

// URLからタグを取得
const getTagFromUrl = () => {
  const tag = route.query.tag
  if (tag) {
    selectedTag.value = decodeURIComponent(tag)
    tagInput.value = selectedTag.value
  }
}

// タグ選択
const selectTag = (tagName) => {
  selectedTag.value = tagName
  tagInput.value = tagName
  fetchPosts()
  
  // URLにタグをクエリパラメータとして追加（履歴に残す）
  router.push({
    path: '/tags',
    query: { tag: tagName }
  })
}

// タグ検索
const searchTag = () => {
  if (tagInput.value.trim()) {
    selectTag(tagInput.value.trim())
  }
}

// タグクリア
const clearTag = () => {
  selectedTag.value = ''
  tagInput.value = ''
  posts.value = []
  
  // クエリパラメータをクリア
  router.push('/tags')
}

// 人気タグ取得
const fetchPopularTags = async () => {
  try {
    const res = await fetch('http://localhost:3000/tags')
    if (!res.ok) {
      console.error('タグ取得エラー:', await res.text())
      return
    }
    
    const tags = await res.json()
    popularTags.value = tags
  } catch (err) {
    console.error('タグ取得エラー:', err)
  }
}

// 投稿取得
const fetchPosts = async () => {
  if (!selectedTag.value) {
    posts.value = []
    return
  }
  
  loading.value = true
  error.value = null
  
  try {
    const res = await fetch(`http://localhost:3000/posts?tag=${encodeURIComponent(selectedTag.value)}`)
    if (!res.ok) {
      throw new Error('投稿の取得に失敗しました')
    }
    
    const data = await res.json()
    posts.value = data
  } catch (err) {
    console.error('投稿取得エラー:', err)
    error.value = err.message || 'データの取得に失敗しました'
  } finally {
    loading.value = false
  }
}

// 初期化
onMounted(() => {
  window.addEventListener('resize', updateColumns)
  updateColumns()
  
  // URLからタグを取得
  getTagFromUrl()
  
  // 人気タグを取得
  fetchPopularTags()
  
  // タグが指定されていれば投稿を取得
  if (selectedTag.value) {
    fetchPosts()
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns)
})

// ルート変更を監視
watch(() => route.query.tag, (newTag) => {
  if (newTag) {
    selectedTag.value = decodeURIComponent(newTag)
    tagInput.value = selectedTag.value
    fetchPosts()
  } else {
    selectedTag.value = ''
    tagInput.value = ''
    posts.value = []
  }
})

// サイドバー状態変更時にカラム数更新
watch(() => isSidebarOpen.value, () => {
  updateColumns()
})
</script>

<style scoped>
.tags-container {
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

/* タグ検索フォーム */
.tag-search {
  display: flex;
  margin: 0 auto 20px;
  max-width: 600px;
}

.tag-search-input {
  flex: 1;
  padding: 10px;
  border: 2px solid #a5d6a7;
  border-radius: 4px 0 0 4px;
  font-size: 1rem;
}

.search-btn {
  background-color: #2e7d32;
  color: white;
  border: none;
  border-radius: 0 4px 4px 0;
  padding: 0 20px;
  cursor: pointer;
}

/* 人気タグクラウド */
.popular-tags {
  margin: 30px 0;
}

.popular-tags h2 {
  font-size: 1.2rem;
  color: #555;
  text-align: center;
  margin-bottom: 15px;
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  max-width: 800px;
  margin: 0 auto;
  padding: 10px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.tag-btn {
  background-color: #f1f8e9;
  border: 1px solid #c5e1a5;
  color: #558b2f;
  border-radius: 16px;
  padding: 5px 12px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-btn:hover {
  background-color: #dcedc8;
}

.tag-btn.selected {
  background-color: #aed581;
  color: #33691e;
  border-color: #8bc34a;
  font-weight: bold;
}

/* 投稿セクション */
.posts-section {
  margin-top: 30px;
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
  background-color: #f5f5f5;
  border-radius: 8px;
}

.clear-tag-btn {
  background-color: #42b983;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  margin-top: 15px;
  cursor: pointer;
}
</style>
