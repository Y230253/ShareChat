<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import PhotoItem from "./PhotoItem.vue";
import authStore from '../authStore.js';
import { api } from '../services/api'; // APIサービスをインポート

const props = defineProps({
  sidebarOpen: {
    type: Boolean,
    default: false
  }
});

const photos = ref([]); // 取得した投稿を格納
const isLoading = ref(true);
const error = ref(null);

// ログイン状態を監視
const isLoggedIn = computed(() => authStore.isLoggedIn.value);

const columns = ref(props.sidebarOpen ? 3 : 4);

const updateColumns = () => {
  const width = window.innerWidth;
  if (width < 500) {
    columns.value = 1;
  } else if (width < 768) {
    columns.value = props.sidebarOpen ? 2 : 3;
  } else {
    columns.value = props.sidebarOpen ? 3 : 4;
  }
};

// 投稿を読み込む関数
const loadPosts = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // 直接fetchの代わりにAPIサービスを使用
    photos.value = await api.posts.getAll();
  } catch (err) {
    console.error('投稿取得エラー', err);
    error.value = '投稿の読み込みに失敗しました';
  } finally {
    isLoading.value = false;
  }
};

// 投稿をバッチで表示する（初期表示の最適化）
const visiblePostCount = ref(10); // 初期表示数
const batchSize = ref(5); // 追加で表示する数

// 表示する投稿を計算
const visiblePosts = computed(() => {
  return photos.value.slice(0, visiblePostCount.value);
});

// スクロールイベントハンドラ
const handleScroll = () => {
  // ページ下部に近づいたらもっと読み込む
  const scrollHeight = document.documentElement.scrollHeight;
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  const clientHeight = document.documentElement.clientHeight;
  
  if (scrollTop + clientHeight >= scrollHeight - 300 && visiblePostCount.value < photos.value.length) {
    visiblePostCount.value += batchSize.value;
  }
};

onMounted(() => {
  window.addEventListener('resize', updateColumns);
  updateColumns();
  
  // 投稿データを読み込む
  loadPosts();
  
  // ログイン状態の変化を監視
  watch(() => authStore.isLoggedIn.value, (newVal) => {
    if (newVal) {
      // ログインしたら投稿を再読み込み（いいね/ブックマーク状態を反映するため）
      loadPosts();
    }
  });

  // スクロールイベントリスナー追加
  window.addEventListener('scroll', handleScroll);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateColumns);
  window.removeEventListener('scroll', handleScroll);
});

watch(() => props.sidebarOpen, () => {
  updateColumns();
});
</script>

<template>
  <div>
    <h1>Photo List📸</h1>
    
    <div v-if="isLoading" class="loading">
      <p>読み込み中...</p>
    </div>
    
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="loadPosts">再読み込み</button>
    </div>
    
    <ul v-else :style="{ display: 'grid', gap: '1rem', gridTemplateColumns: `repeat(${columns}, 1fr)` }">
      <li v-for="photo in visiblePosts" :key="photo.id">
        <photoItem :photo="photo" />
      </li>
    </ul>
    
    <!-- もっと読み込むボタン（オプション） -->
    <div v-if="visiblePostCount < photos.length" class="load-more">
      <button @click="visiblePostCount += batchSize">もっと見る</button>
    </div>
  </div>
</template>

<style scoped>
li {
  list-style: none;
  margin:25px;
}
img {
  width: 100%;
  height: auto;
}
.loading, .error {
  text-align: center;
  padding: 20px;
}
.error {
  color: red;
}

.load-more {
  text-align: center;
  margin-top: 20px;
}

.load-more button {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}
</style>