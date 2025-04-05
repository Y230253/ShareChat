<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PhotoList from '../components/PhotoList.vue';
import { api } from '../services/api.js';

const router = useRouter();
const route = useRoute();
const loading = ref(true);
const tagsLoading = ref(true);
const error = ref('');
const tags = ref([]);
const selectedTag = ref('');
const filteredPosts = ref([]);

// URLからタグ名を取得
const tagFromUrl = computed(() => {
  return route.query.tag || '';
});

// タグ一覧を取得
const fetchTags = async () => {
  tagsLoading.value = true;
  
  try {
    console.log('タグ一覧を取得中...');
    const response = await api.tags.getAll();
    console.log('取得したタグデータ:', response);
    
    if (Array.isArray(response)) {
      tags.value = response;
      console.log(`${tags.value.length}件のタグを取得しました`);
    } else {
      console.warn('APIから返されたタグが配列ではありません');
      tags.value = [];
    }
  } catch (err) {
    console.error("タグ取得エラー:", err);
    error.value = "タグの取得に失敗しました";
    tags.value = [];
  } finally {
    tagsLoading.value = false;
  }
};

// タグでフィルタリングされた投稿を取得
const fetchPostsByTag = async (tagName) => {
  if (!tagName) {
    filteredPosts.value = [];
    loading.value = false;
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  try {
    console.log(`タグ「${tagName}」で投稿を検索します`);
    // posts-by-tag エンドポイントを使用
    const posts = await api.tags.getPostsByTag(tagName);
    
    if (Array.isArray(posts)) {
      filteredPosts.value = posts;
      console.log(`タグ「${tagName}」の投稿を${filteredPosts.value.length}件取得しました`);
    } else {
      console.warn('APIから返された投稿が配列ではありません');
      filteredPosts.value = [];
    }
  } catch (err) {
    console.error("投稿取得エラー:", err);
    error.value = `タグ「${tagName}」の投稿取得に失敗しました`;
    filteredPosts.value = [];
  } finally {
    loading.value = false;
  }
};

// タグ選択時の処理
const selectTag = (tagName) => {
  console.log(`タグを選択: ${tagName}`);
  selectedTag.value = tagName;
  // URLのクエリパラメータを更新
  router.replace({ path: '/tags', query: { tag: tagName } });
};

// コンポーネント初期化
onMounted(async () => {
  // まずタグ一覧を取得
  await fetchTags();
  
  // URLからタグが指定されていれば、投稿を取得
  if (tagFromUrl.value) {
    console.log(`URLからタグを検出: ${tagFromUrl.value}`);
    selectedTag.value = tagFromUrl.value;
    await fetchPostsByTag(selectedTag.value);
  } else {
    loading.value = false;
  }
});

// URLのクエリパラメータが変わったら投稿を再取得
watch(tagFromUrl, async (newTag) => {
  console.log(`URLパラメータが変更: ${newTag}`);
  if (newTag !== selectedTag.value) {
    selectedTag.value = newTag;
    if (newTag) {
      await fetchPostsByTag(newTag);
    } else {
      filteredPosts.value = [];
      loading.value = false;
    }
  }
});
</script>

<template>
  <div class="tag-search-container">
    <h1>タグ検索</h1>
    
    <div v-if="error" class="error-message">{{ error }}</div>
    
    <!-- タグ一覧 -->
    <div class="tag-container">
      <div v-if="tagsLoading" class="tag-loading">
        <div class="spinner small-spinner"></div>
        <p>タグを読み込み中...</p>
      </div>
      
      <div v-else-if="tags.length === 0" class="no-tags">
        タグが見つかりません
      </div>
      
      <div v-else class="tag-list">
        <button 
          v-for="tag in tags" 
          :key="tag.id || tag.name"
          @click="selectTag(tag.name)"
          class="tag-button"
          :class="{ active: selectedTag === tag.name }"
        >
          #{{ tag.name }} ({{ tag.count || 0 }})
        </button>
      </div>
    </div>
    
    <!-- 選択中のタグと検索結果 -->
    <div v-if="selectedTag" class="search-results">
      <h2>タグ「{{ selectedTag }}」の投稿</h2>
      
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>投稿を読み込み中...</p>
      </div>
      
      <div v-else-if="filteredPosts.length === 0" class="no-results">
        このタグの投稿はまだありません
      </div>
      
      <PhotoList v-else :photos="filteredPosts" />
    </div>
  </div>
</template>

<style scoped>
.main-wrapper {
  display: flex;
  flex: 1;
  margin-top: 60px;
}

.content {
  flex: 1;
  padding: 20px;
  transition: margin-left 0.3s;
  margin-left: 0;
}

.content.with-sidebar {
  margin-left: 220px;
}

h1 {
  color: #2c3e50;
  margin-bottom: 20px;
  font-size: 24px;
}

h2 {
  color: #2c3e50;
  margin: 30px 0 20px;
  font-size: 20px;
}

.tag-container {
  margin: 20px 0;
  padding: 15px;
  background-color: #f8f8f8;
  border-radius: 8px;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.tag-button {
  padding: 8px 15px;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-button:hover {
  background-color: #f1f1f1;
}

.tag-button.active {
  background-color: #42b983;
  color: white;
  border-color: #42b983;
}

.loading, .tag-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 20px 0;
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

.small-spinner {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.no-results, .no-tags {
  text-align: center;
  margin: 30px 0;
  color: #666;
}

.error-message {
  background-color: #fee;
  color: #c00;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
}
</style>
