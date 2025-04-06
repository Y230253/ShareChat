<template>
  <div class="profile-container">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>読み込み中...</p>
    </div>

    <div v-else-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-else class="profile-content">
      <!-- プロフィール情報セクション -->
      <div class="profile-header">
        <div class="profile-avatar">
          <img v-if="user && user.avatar" :src="user.avatar" alt="プロフィール画像" />
          <img v-else-if="user && user.icon_url" :src="user.icon_url" alt="プロフィール画像" />
          <div v-else class="avatar-placeholder">{{ userInitials }}</div>
        </div>
        
        <div class="profile-info">
          <h1>{{ user ? user.username : '読み込み中...' }}</h1>
          <p class="email">{{ user ? user.email : '' }}</p>
          
          <button @click="navigateToEdit" class="edit-button">
            プロフィールを編集
          </button>
        </div>
      </div>

      <!-- 投稿一覧セクション -->
      <div class="posts-section">
        <h2>投稿一覧</h2>
        
        <div v-if="posts.length === 0" class="no-posts">
          まだ投稿がありません
        </div>
        
        <div v-else class="posts-list">
          <div v-for="post in posts" :key="post.id" class="post-item">
            <!-- 投稿メディア（画像または動画） -->
            <div class="post-media">
              <video 
                v-if="post.isVideo" 
                :src="post.image_url" 
                controls
                class="post-image"
              ></video>
              <img 
                v-else 
                :src="post.image_url" 
                alt="投稿画像" 
                class="post-image"
                @click="openDetailPage(post.id)"
              />
            </div>
            
            <div class="post-content">
              <p class="post-text">{{ post.message }}</p>
              <div class="post-meta">
                <p class="post-date">{{ formatDate(post.created_at) }}</p>
                <div class="post-stats">
                  <span class="like-count">❤️ {{ post.likeCount || 0 }}</span>
                  <span class="bookmark-count">🔖 {{ post.bookmarkCount || 0 }}</span>
                </div>
              </div>
              
              <!-- タグ表示 -->
              <div v-if="post.tags && post.tags.length > 0" class="post-tags">
                <span v-for="tag in post.tags" :key="tag" class="tag">
                  #{{ tag }}
                </span>
              </div>
            </div>
            
            <div class="post-actions">
              <button @click="openDetailPage(post.id)" class="detail-button">
                詳細
              </button>
              <button @click="deletePost(post.id)" class="delete-button">
                削除
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="loadingPosts" class="loading-more">
          <div class="small-spinner"></div>
          投稿を読み込み中...
        </div>
        
        <button 
          v-if="hasMorePosts" 
          @click="loadMorePosts" 
          class="load-more-button"
          :disabled="loadingPosts"
        >
          もっと表示
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import authStore from '../authStore.js';
import { api } from '../services/api.js';

const router = useRouter();
const loading = ref(true);
const error = ref(null);
const user = ref(null);
const posts = ref([]);
const loadingPosts = ref(false);
const hasMorePosts = ref(true);
const currentPage = ref(1);
const postsPerPage = 10;

// ユーザーのイニシャルを計算（アバターがない場合のプレースホルダー用）
const userInitials = computed(() => {
  if (!user.value || !user.value.username) return '?';
  
  return user.value.username
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2);
});

// プロフィールページ読み込み時の処理
onMounted(async () => {
  console.log('Profile page mounted');
  
  // 初期化
  loading.value = true;
  error.value = null;
  
  try {
    // 認証状態の確認
    if (!authStore.isLoggedIn.value) {
      console.error('Not logged in, redirecting to login page');
      error.value = 'ログインが必要です';
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      return;
    }
    
    console.log('Fetching user data...');
    
    // ユーザー情報の取得
    if (authStore.user.value) {
      console.log('Using user info from authStore:', authStore.user.value);
      user.value = { ...authStore.user.value }; // 防御的コピー
    } else {
      console.log('No user info in authStore, fetching from API');
      try {
        const userData = await api.auth.getUser();
        console.log('API response for user data:', userData);
        
        if (userData) {
          user.value = userData;
          // authStoreに保存
          authStore.setUser(userData);
        } else {
          throw new Error('ユーザーデータが空です');
        }
      } catch (userErr) {
        console.error('Failed to fetch user data:', userErr);
        throw new Error('ユーザー情報の取得に失敗しました');
      }
    }
    
    // ユーザー情報が取得できたことを確認
    if (!user.value || !user.value.id) {
      console.error('Invalid user data:', user.value);
      throw new Error('ユーザー情報が不完全です');
    }
    
    // 投稿の取得
    console.log('Fetching user posts...');
    await loadPosts();
    
  } catch (err) {
    console.error('プロフィールデータ取得エラー:', err);
    error.value = err.message || 'プロフィール情報の取得に失敗しました';
  } finally {
    loading.value = false;
    console.log('Profile loading complete. Error:', error.value);
    console.log('User data:', user.value);
  }
});

// 投稿を取得する関数
const loadPosts = async () => {
  if (!user.value || !user.value.id) {
    console.error('Cannot load posts: user ID is missing');
    throw new Error('ユーザーIDがありません');
  }
  
  try {
    loadingPosts.value = true;
    console.log(`Fetching posts for user ID: ${user.value.id}`);
    
    // ユーザーの投稿取得APIを呼び出し
    const response = await api.posts.getUserPosts({
      userId: user.value.id,
      page: 1,
      limit: postsPerPage
    });
    
    console.log('Posts API response:', response);
    
    // 様々なレスポンス形式に対応
    if (response && response.posts && Array.isArray(response.posts)) {
      // オブジェクト内posts配列
      posts.value = response.posts;
      hasMorePosts.value = response.posts.length >= postsPerPage;
    } else if (Array.isArray(response)) {
      // 配列が直接返される場合
      posts.value = response;
      hasMorePosts.value = response.length >= postsPerPage;
    } else if (response && typeof response === 'object') {
      // その他のオブジェクト形式
      const possiblePostsArray = Object.values(response).find(val => Array.isArray(val));
      if (possiblePostsArray) {
        posts.value = possiblePostsArray;
        hasMorePosts.value = possiblePostsArray.length >= postsPerPage;
      } else {
        console.warn('投稿データが見つかりません:', response);
        posts.value = [];
        hasMorePosts.value = false;
      }
    } else {
      console.warn('Unexpected posts response format:', response);
      posts.value = [];
      hasMorePosts.value = false;
    }
    
    currentPage.value = 1;
    console.log(`取得した投稿数: ${posts.value.length}件`);
  } catch (err) {
    console.error('投稿取得エラー:', err);
    throw new Error('投稿の取得に失敗しました');
  } finally {
    loadingPosts.value = false;
  }
};

// さらに投稿を読み込む関数
const loadMorePosts = async () => {
  if (loadingPosts.value || !hasMorePosts.value) return;
  
  try {
    loadingPosts.value = true;
    currentPage.value++;
    
    const response = await api.posts.getUserPosts({
      userId: user.value.id,
      page: currentPage.value,
      limit: postsPerPage
    });
    
    if (response.posts && response.posts.length > 0) {
      posts.value = [...posts.value, ...response.posts];
      hasMorePosts.value = response.posts.length >= postsPerPage;
    } else {
      hasMorePosts.value = false;
    }
  } catch (err) {
    console.error('さらなる投稿取得エラー:', err);
    currentPage.value--;
  } finally {
    loadingPosts.value = false;
  }
};

// 投稿を削除する関数
const deletePost = async (postId) => {
  if (!confirm('この投稿を削除してもよろしいですか？')) {
    return;
  }
  
  try {
    await api.posts.deletePost(postId);
    posts.value = posts.value.filter(post => post.id !== postId);
  } catch (err) {
    console.error('投稿削除エラー:', err);
    alert('投稿の削除に失敗しました');
  }
};

// 日付をフォーマットする関数
const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
};

// 編集ページに遷移する関数
const navigateToEdit = () => {
  router.push('/edit-profile');
};

// 詳細ページに遷移
const openDetailPage = (postId) => {
  router.push(`/detail/${postId}`);
};
</script>

<style scoped>
.profile-container {
  max-width: 800px;
  margin: 80px auto 40px;
  padding: 20px;
}

.profile-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.profile-header {
  display: flex;
  padding: 30px;
  background-color: #f9f9f9;
  border-bottom: 1px solid #eee;
}

.profile-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #e8f5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 30px;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background-color: #e8f5e9;
  color: #2e7d32;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: bold;
}

.profile-info {
  flex: 1;
}

.profile-info h1 {
  margin: 0 0 10px 0;
  color: #2e7d32;
}

.email {
  color: #666;
  margin: 0 0 20px 0;
}

.edit-button {
  background-color: #2e7d32;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.posts-section {
  padding: 30px;
}

.posts-section h2 {
  color: #2e7d32;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e8f5e9;
}

.no-posts {
  text-align: center;
  padding: 30px;
  color: #999;
}

.posts-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.post-item {
  display: flex;
  flex-direction: column;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background-color: #fff;
}

.post-media {
  margin-bottom: 15px;
  overflow: hidden;
  border-radius: 8px;
  max-height: 300px;
}

.post-image {
  width: 100%;
  max-height: 300px;
  object-fit: contain;
  cursor: pointer;
}

.post-content {
  flex: 1;
}

.post-text {
  margin: 0 0 10px 0;
  font-size: 16px;
  white-space: pre-wrap;
  word-break: break-word;
}

.post-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.post-date {
  margin: 0;
  font-size: 12px;
  color: #888;
}

.post-stats {
  display: flex;
  gap: 15px;
  font-size: 14px;
  color: #555;
}

.post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.tag {
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.post-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 15px;
}

.detail-button {
  background-color: #2196f3;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.delete-button {
  background-color: #f44336;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.loading-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 15px;
  color: #666;
}

.small-spinner {
  width: 20px;
  height: 20px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #2e7d32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.load-more-button {
  display: block;
  width: 100%;
  padding: 10px;
  margin-top: 15px;
  background-color: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 4px;
  color: #333;
  cursor: pointer;
  text-align: center;
}

.load-more-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
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
  border-top: 5px solid #2e7d32;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}
</style>
