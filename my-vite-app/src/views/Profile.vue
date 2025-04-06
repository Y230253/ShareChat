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
            <div class="post-content">
              <p class="post-text">{{ post.content }}</p>
              <p class="post-date">{{ formatDate(post.createdAt) }}</p>
            </div>
            
            <div class="post-actions">
              <button @click="deletePost(post.id)" class="delete-button">
                削除
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="loadingPosts" class="loading-more">
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
    
    const response = await api.posts.getUserPosts({
      userId: user.value.id,
      page: 1,
      limit: postsPerPage
    });
    
    console.log('Posts API response:', response);
    
    if (response && Array.isArray(response.posts)) {
      posts.value = response.posts;
      hasMorePosts.value = posts.value.length >= postsPerPage;
    } else {
      console.warn('Unexpected posts response format:', response);
      posts.value = response && response.posts ? response.posts : [];
      hasMorePosts.value = false;
    }
    
    currentPage.value = 1;
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
  gap: 15px;
}

.post-item {
  display: flex;
  justify-content: space-between;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 4px;
  background-color: #fff;
}

.post-content {
  flex: 1;
}

.post-text {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.post-date {
  margin: 0;
  font-size: 12px;
  color: #888;
}

.post-actions {
  display: flex;
  align-items: start;
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
  text-align: center;
  padding: 15px;
  color: #666;
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
