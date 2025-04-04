<template>
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
      <div v-else class="post-grid" :style="{ gridTemplateColumns: `repeat(${columns}, 1fr)` }">
        <div v-for="post in posts" :key="post.id" class="post-item">
          <PhotoItem :photo="post" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { api } from '../services/api.js';
import { mockTags } from '../services/mock-data.js';
import PhotoItem from '../components/PhotoItem.vue'; // 写真アイテムコンポーネントをインポート

const router = useRouter();
const route = useRoute();
const tags = ref([]);
const popularTags = ref([]); // 人気タグ用の変数
const loading = ref(true);
const error = ref(null);
const tagInput = ref(''); // タグ検索用入力
const selectedTag = ref(''); // 選択されたタグ
const posts = ref([]); // タグに関連する投稿
const columns = ref(3); // グリッド列数

// 画面サイズに応じて列数を変更
const updateColumns = () => {
  const width = window.innerWidth;
  if (width < 600) columns.value = 1;
  else if (width < 960) columns.value = 2;
  else columns.value = 3;
};

onMounted(async () => {
  // 画面サイズ変更イベントリスナー
  window.addEventListener('resize', updateColumns);
  updateColumns();
  
  // URL からタグを取得
  const tagFromUrl = route.params.name || route.query.tag;
  if (tagFromUrl) {
    selectedTag.value = decodeURIComponent(tagFromUrl);
    console.log(`URLからタグを検出: ${selectedTag.value}`);
    fetchPosts();
  }
  
  await fetchTags();
});

// タグデータを取得
const fetchTags = async () => {
  try {
    loading.value = true;
    error.value = null;
    
    console.log('タグ一覧を取得中...');
    const result = await api.tags.getAll();
    
    if (Array.isArray(result)) {
      tags.value = result;
      console.log(`${tags.value.length}件のタグを取得しました`);
      
      // 最近使用されたタグを抽出して人気タグとして表示（最大10個）
      popularTags.value = [...result]
        .sort((a, b) => {
          // 最新のタグを上位に（または使用回数が多いものを上位に）
          return (b.updatedAt || b.count || 0) - (a.updatedAt || a.count || 0);
        })
        .slice(0, 10);
      
      console.log('人気タグをソート完了:', popularTags.value);
    } else {
      console.warn('タグデータが配列ではありません:', result);
      tags.value = [];
      popularTags.value = [];
    }
  } catch (err) {
    console.error('タグ取得中にエラー発生:', err);
    error.value = 'タグの読み込み中にエラーが発生しました。';
    // エラー時はモックデータを使用
    tags.value = mockTags;
    popularTags.value = mockTags.slice(0, 10);
  } finally {
    loading.value = false;
  }
};

// タグを選択したときの処理
const selectTag = (tagName) => {
  if (!tagName) return;
  
  console.log(`タグを選択: ${tagName}`);
  selectedTag.value = tagName;
  
  // URLを更新
  router.push({ path: '/tags', query: { tag: tagName } });
  
  // 投稿を取得
  fetchPosts();
};

// タグで検索
const searchTag = () => {
  const tag = tagInput.value.trim();
  if (!tag) return;
  
  console.log(`タグ検索: ${tag}`);
  selectTag(tag);
  tagInput.value = ''; // 検索後は入力をクリア
};

// タグをクリア
const clearTag = () => {
  selectedTag.value = '';
  posts.value = [];
  router.push({ path: '/tags' });
};

// 選択したタグに関連する投稿を取得
const fetchPosts = async () => {
  if (!selectedTag.value) {
    posts.value = [];
    return;
  }
  
  try {
    loading.value = true;
    error.value = null;
    
    console.log(`タグ「${selectedTag.value}」の投稿を取得中...`);
    const result = await api.posts.getByTag(selectedTag.value);
    
    if (Array.isArray(result)) {
      // タグでフィルタリング - 厳密なフィルタリングを適用
      posts.value = result.filter(post => {
        // タグが配列の場合
        if (Array.isArray(post.tags)) {
          return post.tags.some(tag => 
            typeof tag === 'string' 
              ? tag.toLowerCase() === selectedTag.value.toLowerCase()
              : (tag.name || '').toLowerCase() === selectedTag.value.toLowerCase()
          );
        } 
        // タグが文字列の場合
        else if (typeof post.tags === 'string') {
          return post.tags.toLowerCase().includes(selectedTag.value.toLowerCase());
        }
        // タグがない場合
        return false;
      });
      
      console.log(`${posts.value.length}件の投稿をフィルタリングしました`);
    } else {
      console.warn('投稿データが配列ではありません:', result);
      posts.value = [];
    }
  } catch (err) {
    console.error('投稿取得中にエラー発生:', err);
    error.value = '投稿の読み込み中にエラーが発生しました。';
    posts.value = [];
  } finally {
    loading.value = false;
  }
};

const navigateToTag = (tag) => {
  if (tag && tag.name) {
    console.log(`タグ "${tag.name}" のページに遷移します`);
    router.push(`/tags/${tag.name}`);
  }
};
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

/* 投稿グリッドのスタイル */
.post-grid {
  display: grid;
  gap: 20px;
  width: 100%;
}

.post-item {
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
