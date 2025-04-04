<template>
  <div class="App">
    <Header :toggleSidebar="toggleSidebar" />
    <div class="main-wrapper">
      <Sidebar :isOpen="isSidebarOpen" />
      <div class="detail-post" v-if="post">
        <!-- 戻るボタン -->
        <button class="back-button" @click="goBack">← 戻る</button>
        
        <!-- ユーザー情報 -->
        <div class="user-info">
          <div class="user-icon-container">
            <img :src="userIconUrl" class="user-icon" alt="User Icon">
          </div>
          <div>
            <p class="username">{{ post.username || ('ユーザー ' + post.user_id) }}</p>
            <p class="date">{{ new Date(post.created_at).toLocaleString('ja-JP') }}</p>
          </div>
        </div>
        
        <!-- メディアコンテナ -->
        <div class="media-container" @click="openMediaModal">
          <!-- 動画の場合 -->
          <video 
            v-if="post.isVideo" 
            ref="mediaRef"
            :src="post.image_url" 
            class="media"
            controls
            autoplay
            loop
          ></video>
          
          <!-- 画像の場合 -->
          <img 
            v-else 
            :src="post.image_url" 
            class="media"
            alt="Uploaded Photo"
          >
          
          <div class="view-full-btn">クリックで拡大表示</div>
        </div>
        
        <!-- メッセージ表示をより読みやすく -->
        <div class="message-container">
          <p class="message">{{ post.message }}</p>
        </div>
        
        <!-- タグ表示 -->
        <div v-if="post.tags && post.tags.length > 0" class="tags-container">
          <h4>タグ</h4>
          <div class="tags">
            <router-link 
              v-for="tag in post.tags" 
              :key="tag" 
              :to="`/tags?tag=${encodeURIComponent(tag)}`"
              class="tag"
            >
              #{{ tag }}
            </router-link>
          </div>
        </div>
        
        <!-- アクションボタン -->
        <div class="action-bar">
          <button @click="toggleLike" :class="{ 'active': liked }">
            {{ liked ? '❤️' : '🤍' }} いいね {{ likeCount }}
          </button>
          <button @click="toggleBookmark" :class="{ 'active': isBookmarked }">
            {{ isBookmarked ? '📌' : '🔖' }} ブックマーク {{ bookmarkCount }}
          </button>
          <button @click="focusCommentInput">
            💬 コメント {{ commentCount }}
          </button>
          <button @click="sharePost">
            🔗 シェア
          </button>
        </div>
        
        <!-- コメント一覧 -->
        <div class="comment-section">
          <h3>コメント</h3>
          <div class="comments-list">
            <div v-if="comments.length === 0" class="no-comments">
              まだコメントはありません
            </div>
            <div v-for="comment in comments" :key="comment.id" class="comment">
              <div class="comment-user">
                <img :src="comment.user_icon || 'https://via.placeholder.com/30'" alt="User" class="comment-user-icon">
                <span class="comment-username">{{ comment.username }}</span>
              </div>
              <p class="comment-text">{{ comment.text }}</p>
              <span class="comment-date">{{ new Date(comment.created_at).toLocaleString('ja-JP') }}</span>
            </div>
          </div>
          
          <!-- コメント投稿フォーム -->
          <div v-if="isLoggedIn" class="comment-form">
            <textarea 
              ref="commentInput"
              v-model="newComment" 
              placeholder="コメントを入力..."
              rows="2"
            ></textarea>
            <button @click="submitComment" :disabled="!newComment.trim()">送信</button>
          </div>
          <div v-else class="login-prompt">
            <p>コメントするには<router-link to="/login">ログイン</router-link>してください</p>
          </div>
        </div>
      </div>
      
      <!-- ローディング表示 -->
      <div v-else-if="loading" class="loading">
        <div class="spinner"></div>
        <p>読み込み中...</p>
      </div>
      
      <!-- エラー表示 -->
      <div v-else class="error">
        <p>{{ error || '投稿が見つかりませんでした' }}</p>
        <button @click="goBack">戻る</button>
      </div>
    </div>
    
    <!-- メディアモーダル -->
    <div v-if="showMediaModal" class="media-modal" @click="closeMediaModal">
      <div class="modal-content">
        <button class="close-modal" @click.stop="closeMediaModal">×</button>
        <video 
          v-if="post && post.isVideo" 
          :src="post.image_url"
          controls
          autoplay
          class="modal-media"
        ></video>
        <img 
          v-else-if="post"
          :src="post.image_url" 
          class="modal-media"
          alt="Full size media"
        >
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Header from '../components/header.vue';
import Sidebar from '../components/Sidebar.vue';
import authStore from '../authStore.js';
import { apiCall } from '../services/api.js'; // APIサービスをインポート

const route = useRoute();
const router = useRouter();
const postId = computed(() => Number(route.params.id));

const post = ref(null);
const loading = ref(true);
const error = ref(null);
const isSidebarOpen = ref(false);
const mediaRef = ref(null);
const commentInput = ref(null);
const showMediaModal = ref(false);

// いいね・ブックマーク状態
const liked = ref(false);
const likeCount = ref(0);
const isBookmarked = ref(false);
const bookmarkCount = ref(0);

// コメント関連
const comments = ref([]);
const newComment = ref('');
const commentCount = ref(0);

// APIベースURL
const apiUrl = 'http://localhost:3000';

// ユーザー情報
const isLoggedIn = computed(() => authStore.isLoggedIn.value);
const userIconUrl = computed(() => post.value?.user_icon || 'https://via.placeholder.com/40');

// サイドバー切替
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

// 戻るボタン
const goBack = () => {
  router.back();
};

// 投稿の詳細情報を取得
const fetchPostDetail = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // 全ての投稿を取得してIDでフィルタリング
    const res = await fetch(`${apiUrl}/posts`);
    if (!res.ok) {
      throw new Error('投稿の取得に失敗しました');
    }
    
    const posts = await res.json();
    const foundPost = posts.find(p => p.id === postId.value);
    
    if (!foundPost) {
      throw new Error('指定された投稿が見つかりません');
    }
    
    post.value = foundPost;
    likeCount.value = foundPost.likeCount || 0;
    bookmarkCount.value = foundPost.bookmarkCount || 0;
    
    // コメント取得（APIがあれば）
    fetchComments();
    
    // いいね・ブックマーク状態の確認
    if (isLoggedIn.value) {
      checkUserInteractions();
    }
    
  } catch (err) {
    console.error('投稿取得エラー:', err);
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// コメント取得 - エラーハンドリングを強化
const fetchComments = async () => {
  try {
    console.log(`コメント取得中: post_id=${postId.value}`);
    const res = await fetch(`${apiUrl}/comments/${postId.value}`);
    
    if (!res.ok) {
      console.error('コメント取得失敗:', await res.text());
      return;
    }
    
    comments.value = await res.json();
    console.log('コメント取得成功:', comments.value);
    commentCount.value = comments.value.length;
  } catch (err) {
    console.error('コメント取得エラー:', err);
  }
};

// いいね・ブックマーク状態の確認
const checkUserInteractions = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    // いいねチェック
    const likesRes = await fetch(`${apiUrl}/check-like/${postId.value}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (likesRes.ok) {
      const likesData = await likesRes.json();
      liked.value = likesData.liked;
    }
    
    // ブックマークチェック
    const bookmarksRes = await fetch(`${apiUrl}/check-bookmark/${postId.value}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (bookmarksRes.ok) {
      const bookmarksData = await bookmarksRes.json();
      isBookmarked.value = bookmarksData.bookmarked;
    }
  } catch (err) {
    console.error('状態チェックエラー:', err);
  }
};

// いいねトグル
const toggleLike = async () => {
  if (!isLoggedIn.value) {
    alert('いいねするにはログインが必要です');
    return;
  }
  
  const token = localStorage.getItem('token');
  if (!token) return;
  
  try {
    if (liked.value) {
      // いいね解除
      const response = await fetch(`${apiUrl}/likes`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: postId.value })
      });
      if (response.ok) {
        liked.value = false;
        likeCount.value = Math.max(likeCount.value - 1, 0);
      }
    } else {
      // いいね追加
      const response = await fetch(`${apiUrl}/likes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: postId.value })
      });
      if (response.ok) {
        liked.value = true;
        likeCount.value++;
      }
    }
  } catch (err) {
    console.error('いいね処理エラー:', err);
  }
};

// ブックマークトグル
const toggleBookmark = async () => {
  if (!isLoggedIn.value) {
    alert('ブックマークするにはログインが必要です');
    return;
  }
  
  try {
    if (isBookmarked.value) {
      // ブックマーク解除
      const response = await apiCall('/bookmarks', {
        method: 'DELETE',
        body: { post_id: postId.value }
      });
      
      isBookmarked.value = false;
      bookmarkCount.value = Math.max(bookmarkCount.value - 1, 0);
    } else {
      // ブックマーク追加
      const response = await apiCall('/bookmarks', {
        method: 'POST',
        body: { post_id: postId.value }
      });
      
      isBookmarked.value = true;
      bookmarkCount.value++;
    }
  } catch (err) {
    console.error('ブックマーク処理エラー:', err);
  }
};

// コメント入力にフォーカス
const focusCommentInput = () => {
  if (!isLoggedIn.value) {
    alert('コメントするにはログインが必要です');
    return;
  }
  
  nextTick(() => {
    if (commentInput.value) {
      commentInput.value.focus();
    }
  });
};

// コメント送信 - エラーハンドリングを強化
const submitComment = async () => {
  if (!isLoggedIn.value || !newComment.value.trim()) return;
  
  try {
    console.log('コメント送信:', {
      post_id: postId.value,
      text: newComment.value
    });
    
    // APIサービスを使用
    const newCommentData = await apiCall('/comments', {
      method: 'POST',
      body: {
        post_id: postId.value,
        text: newComment.value
      }
    });
    
    console.log('新規コメントデータ:', newCommentData);
    
    // 新しいコメントを先頭に追加
    comments.value.unshift(newCommentData);
    commentCount.value++;
    newComment.value = '';
    
  } catch (err) {
    console.error('コメント投稿エラー:', err);
    alert('コメントの投稿に失敗しました: ' + err.message);
  }
};

// シェア機能
const sharePost = () => {
  if (navigator.share) {
    navigator.share({
      title: `投稿 by ${post.value.username}`,
      text: post.value.message,
      url: window.location.href
    }).catch(err => console.error('共有エラー:', err));
  } else {
    // クリップボードにURLをコピー
    navigator.clipboard.writeText(window.location.href)
      .then(() => alert('URLをコピーしました'))
      .catch(err => console.error('コピーエラー:', err));
  }
};

// メディアモーダル表示
const openMediaModal = () => {
  showMediaModal.value = true;
  document.body.style.overflow = 'hidden'; // スクロール防止
};

// メディアモーダル閉じる
const closeMediaModal = () => {
  showMediaModal.value = false;
  document.body.style.overflow = ''; // スクロール復活
};

onMounted(() => {
  fetchPostDetail();
});
</script>

<style scoped>
.detail-post {
  max-width: 600px;
  margin: 80px auto 20px;
  padding: 20px;
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.back-button {
  background: none;
  border: none;
  color: #42b983;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  margin-bottom: 15px;
  padding: 5px;
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
}

.user-icon-container {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 15px;
}

.user-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.username {
  font-weight: bold;
  font-size: 18px;
}

.date {
  color: gray;
  font-size: 14px;
}

.media-container {
  width: 100%;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 15px;
  position: relative;
  cursor: pointer;
}

.media {
  width: 100%;
  max-height: 500px;
  object-fit: contain;
  display: block;
}

.view-full-btn {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  opacity: 0;
  transition: opacity 0.3s;
}

.media-container:hover .view-full-btn {
  opacity: 1;
}

/* メッセージ表示のスタイル改善 */
.message-container {
  margin: 15px 0;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 8px;
}

.message {
  font-size: 18px;
  line-height: 1.6;
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

/* タグ表示のスタイル */
.tags-container {
  margin: 15px 0;
}

.tags-container h4 {
  margin-bottom: 8px;
  font-size: 16px;
  color: #555;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  font-size: 0.9rem;
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 4px 12px;
  border-radius: 16px;
  text-decoration: none;
  transition: all 0.2s;
}

.tag:hover {
  background-color: #c8e6c9;
  text-decoration: underline;
}

.action-bar {
  display: flex;
  justify-content: space-between;
  border-top: 1px solid #eee;
  border-bottom: 1px solid #eee;
  padding: 15px 0;
}

.action-bar button {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 5px 10px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.action-bar button:hover {
  background-color: #f0f0f0;
}

.action-bar button.active {
  color: #42b983;
}

.comment-section {
  margin-top: 20px;
}

.comment-section h3 {
  margin-bottom: 15px;
  font-size: 18px;
}

.comments-list {
  max-height: 300px;
  overflow-y: auto;
}

.no-comments {
  color: #999;
  text-align: center;
  padding: 20px 0;
}

.comment {
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.comment-user {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
}

.comment-user-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  margin-right: 10px;
}

.comment-username {
  font-weight: bold;
}

.comment-text {
  margin: 5px 0;
  line-height: 1.4;
}

.comment-date {
  font-size: 12px;
  color: #999;
}

.comment-form {
  margin-top: 20px;
  display: flex;
  gap: 10px;
}

.comment-form textarea {
  flex: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 8px;
  resize: vertical;
}

.comment-form button {
  padding: 0 15px;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.comment-form button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.login-prompt {
  text-align: center;
  padding: 15px;
  color: #666;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
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
  padding: 50px 20px;
  color: #e53935;
}

/* メディアモーダル */
.media-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
}

.modal-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.close-modal {
  position: absolute;
  top: -40px;
  right: 0;
  background: none;
  border: none;
  color: white;
  font-size: 30px;
  cursor: pointer;
}
</style>