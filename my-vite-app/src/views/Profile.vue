<template>
  <div class="profile-container">
    <h1>プロフィール</h1>
    
    <div v-if="!authStore.isLoggedIn.value" class="login-prompt">
      <p>プロフィールを閲覧するにはログインが必要です。</p>
      <router-link to="/login" class="login-button">ログイン</router-link>
    </div>
    
    <div v-else>
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>読み込み中...</p>
      </div>
      
      <div v-else-if="error" class="error-message">
        {{ error }}
      </div>
      
      <div v-else class="profile-content">
        <div class="profile-header">
          <div class="user-avatar">
            <img v-if="user.avatar" :src="user.avatar" alt="プロフィール画像" />
            <div v-else class="avatar-placeholder">{{ userInitials }}</div>
          </div>
          
          <div class="user-info">
            <h2>{{ user.username || 'ユーザー名未設定' }}</h2>
            <p>{{ user.email }}</p>
            
            <router-link to="/edit-profile" class="edit-profile-btn">
              プロフィールを編集
            </router-link>
          </div>
        </div>
        
        <!-- ユーザーの投稿一覧 -->
        <div class="user-posts">
          <h3>あなたの投稿</h3>
          <div v-if="userPosts.length === 0" class="no-posts">
            まだ投稿がありません。
          </div>
          <!-- 投稿リストはここに実装 -->
        </div>
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
const user = ref({});
const userPosts = ref([]);

// ユーザーのイニシャルを計算
const userInitials = computed(() => {
  const username = user.value.username || '';
  if (!username) return '?';
  
  return username
    .split(' ')
    .map(name => name.charAt(0).toUpperCase())
    .join('')
    .substring(0, 2);
});

onMounted(async () => {
  if (!authStore.isLoggedIn.value) {
    error.value = 'ログインが必要です';
    setTimeout(() => {
      router.push('/login');
    }, 2000);
    return;
  }
  
  try {
    loading.value = true;
    
    // ユーザー情報の取得
    user.value = authStore.user.value || {};
    
    // ユーザーの投稿を取得
    try {
      const posts = await api.posts.getUserPosts();
      userPosts.value = Array.isArray(posts) ? posts : [];
    } catch (postsError) {
      console.error('投稿の取得に失敗しました:', postsError);
      // 投稿の取得に失敗しても、プロフィール自体は表示する
      userPosts.value = [];
    }
    
  } catch (err) {
    console.error('プロフィール読み込みエラー:', err);
    error.value = 'プロフィール情報の読み込みに失敗しました';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.profile-container {
  max-width: 800px;
  margin: 80px auto 40px;
  padding: 20px;
}

h1 {
  text-align: center;
  color: #2e7d32;
  margin-bottom: 30px;
}

.login-prompt {
  text-align: center;
  padding: 30px;
  background-color: #f5f5f5;
  border-radius: 8px;
}

.login-button {
  display: inline-block;
  margin-top: 20px;
  padding: 10px 20px;
  background-color: #2e7d32;
  color: white;
  border-radius: 4px;
  text-decoration: none;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
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

.profile-content {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.profile-header {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
}

.user-avatar {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 30px;
  border: 3px solid #e8f5e9;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background-color: #e8f5e9;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  font-weight: bold;
  color: #2e7d32;
}

.user-info {
  flex: 1;
}

.user-info h2 {
  margin: 0 0 5px;
  color: #333;
}

.user-info p {
  margin: 0 0 20px;
  color: #666;
}

.edit-profile-btn {
  display: inline-block;
  background-color: #2e7d32;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  text-decoration: none;
}

.user-posts {
  margin-top: 40px;
}

.user-posts h3 {
  border-bottom: 2px solid #e8f5e9;
  padding-bottom: 10px;
  margin-bottom: 20px;
  color: #2e7d32;
}

.no-posts {
  text-align: center;
  padding: 30px;
  background-color: #f5f5f5;
  border-radius: 8px;
  color: #666;
}

.error-message {
  background-color: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
}
</style>
