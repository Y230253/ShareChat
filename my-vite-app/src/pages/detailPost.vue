<template>
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
  
  <!-- メディアモーダル - 改善版 -->
  <div v-if="showMediaModal" class="media-modal" @click="closeMediaModal">
    <div class="modal-content" @click.stop>
      <button class="close-modal" @click.stop="closeMediaModal">×</button>
      
      <!-- 動画の場合 -->
      <video 
        v-if="post && post.isVideo" 
        :src="post.image_url"
        controls
        autoplay
        class="modal-media"
      ></video>
      
      <!-- 画像の場合 - ズーム機能を追加 -->
      <div 
        v-else-if="post"
        class="zoomable-container"
        @wheel.prevent="handleZoomWheel"
      >
        <img 
          :src="post.image_url" 
          class="modal-media"
          :style="zoomStyle"
          alt="Full size media"
          @mousedown="startDrag"
          @mousemove="dragImage"
          @mouseup="stopDrag"
          @mouseleave="stopDrag"
          @dblclick="toggleZoomLevel"
        >

        <!-- ズームコントロール -->
        <div class="zoom-controls">
          <button @click.stop="adjustZoom(-0.2)" class="zoom-btn">−</button>
          <span class="zoom-level">{{ Math.round(zoomLevel * 100) }}%</span>
          <button @click.stop="adjustZoom(0.2)" class="zoom-btn">＋</button>
          <button @click.stop="resetZoom" class="zoom-btn reset">リセット</button>
        </div>
        
        <!-- ヘルプテキスト -->
        <div class="zoom-help">
          ホイールスクロール: ズーム調整 / ダブルクリック: ズーム切替 / ドラッグ: 移動
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import authStore from '../authStore.js';
import { apiCall } from '../services/api.js';

const route = useRoute();
const router = useRouter();
const postId = computed(() => Number(route.params.id));

const post = ref(null);
const loading = ref(true);
const error = ref(null);
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

// APIベースURLをimport.meta.envから取得
const apiUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.sharechat-app.com';

// ユーザー情報
const isLoggedIn = computed(() => authStore.isLoggedIn.value);
const userIconUrl = computed(() => post.value?.user_icon || 'https://via.placeholder.com/40');

// 戻るボタン
const goBack = () => {
  router.back();
};

// 投稿の詳細情報を取得
const fetchPostDetail = async () => {
  loading.value = true;
  error.value = null;
  
  try {
    // APIサービスを使用して投稿を取得
    const posts = await apiCall('/posts');
    const foundPost = posts.find(p => p.id === postId.value);
    
    if (!foundPost) {
      throw new Error('指定された投稿が見つかりません');
    }
    
    post.value = foundPost;
    likeCount.value = foundPost.likeCount || 0;
    bookmarkCount.value = foundPost.bookmarkCount || 0;
    
    // コメント取得
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

// コメント取得 - APIサービスを使用
const fetchComments = async () => {
  try {
    console.log(`コメント取得中: post_id=${postId.value}`);
    const commentsData = await apiCall(`/comments/${postId.value}`);
    
    comments.value = commentsData;
    console.log('コメント取得成功:', comments.value);
    commentCount.value = comments.value.length;
  } catch (err) {
    console.error('コメント取得エラー:', err);
  }
};

// いいね・ブックマーク状態の確認
const checkUserInteractions = async () => {
  try {
    // いいねチェック
    const likeData = await api.likes.check(postId.value);
    liked.value = likeData.liked;
    
    // ブックマークチェック
    const bookmarkData = await api.bookmarks.check(postId.value);
    isBookmarked.value = bookmarkData.bookmarked;
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
  
  try {
    if (liked.value) {
      // いいね解除
      await api.likes.remove(postId.value);
      liked.value = false;
      likeCount.value = Math.max(likeCount.value - 1, 0);
    } else {
      // いいね追加
      await api.likes.add(postId.value);
      liked.value = true;
      likeCount.value++;
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
      await api.bookmarks.remove(postId.value);
      isBookmarked.value = false;
      bookmarkCount.value = Math.max(bookmarkCount.value - 1, 0);
    } else {
      // ブックマーク追加
      await api.bookmarks.add(postId.value);
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

// ズーム機能のための状態
const zoomLevel = ref(1); // 初期ズームレベル
const zoomPosition = ref({ x: 0, y: 0 }); // 画像の位置
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const zoomLevels = [1, 1.5, 2, 3]; // プリセットズームレベル
const zoomLevelIndex = ref(0);

// ズームスタイルの計算
const zoomStyle = computed(() => {
  return {
    transform: `scale(${zoomLevel.value}) translate(${zoomPosition.value.x}px, ${zoomPosition.value.y}px)`,
    transformOrigin: 'center center',
    cursor: isDragging.value ? 'grabbing' : 'grab'
  };
});

// ズームレベル調整（マウスホイール用）
const handleZoomWheel = (event) => {
  event.preventDefault(); // ページスクロールを防止
  
  // ホイールの方向に応じてズームイン/アウト
  const delta = event.deltaY > 0 ? -0.1 : 0.1;
  adjustZoom(delta);
};

// ズームレベル調整（ボタン用）
const adjustZoom = (delta) => {
  const newZoom = zoomLevel.value + delta;
  // 範囲を制限（0.5倍〜3倍）
  zoomLevel.value = Math.max(0.5, Math.min(3, newZoom));
};

// プリセットズームレベルの切り替え（ダブルクリック用）
const toggleZoomLevel = () => {
  zoomLevelIndex.value = (zoomLevelIndex.value + 1) % zoomLevels.length;
  zoomLevel.value = zoomLevels[zoomLevelIndex.value];
  
  // ズームが1倍になったら位置もリセット
  if (zoomLevel.value === 1) {
    resetZoomPosition();
  }
};

// ズームポジションのリセット
const resetZoom = () => {
  zoomLevel.value = 1;
  resetZoomPosition();
};

// ズーム位置をリセット
const resetZoomPosition = () => {
  zoomPosition.value = { x: 0, y: 0 };
};

// ドラッグ開始
const startDrag = (event) => {
  if (zoomLevel.value <= 1) return; // ズームしていない場合はドラッグ無効
  
  isDragging.value = true;
  dragStart.value = {
    x: event.clientX - zoomPosition.value.x,
    y: event.clientY - zoomPosition.value.y
  };
  event.target.style.cursor = 'grabbing';
};

// ドラッグ中
const dragImage = (event) => {
  if (!isDragging.value) return;
  
  // マウス位置から新しい位置を計算
  const newX = event.clientX - dragStart.value.x;
  const newY = event.clientY - dragStart.value.y;
  
  // 画像が画面外に行き過ぎないよう制限（ズームレベルに応じて）
  const moveLimit = 100 * (zoomLevel.value - 1);
  zoomPosition.value = {
    x: Math.max(-moveLimit, Math.min(moveLimit, newX)),
    y: Math.max(-moveLimit, Math.min(moveLimit, newY))
  };
};

// ドラッグ終了
const stopDrag = (event) => {
  if (isDragging.value) {
    isDragging.value = false;
    if (event && event.target) {
      event.target.style.cursor = 'grab';
    }
  }
};

// メディアモーダル表示
const openMediaModal = () => {
  showMediaModal.value = true;
  document.body.style.overflow = 'hidden'; // スクロール防止
  resetZoom(); // モーダルを開くときにズームをリセット
};

// メディアモーダル閉じる
const closeMediaModal = () => {
  showMediaModal.value = false;
  document.body.style.overflow = ''; // スクロール復活
  resetZoom(); // モーダルを閉じるときにズームをリセット
};

onMounted(() => {
  fetchPostDetail();
});
</script>

<style scoped>
.detail-post {
  max-width: 600px;
  margin: 0 auto 20px;
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
  background-color: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

/* ズーム可能なコンテナ */
.zoomable-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

/* モーダル内のメディア表示改善 */
.modal-media {
  max-width: 85vw;  /* 少し小さくして見やすく */
  max-height: 85vh; /* 少し小さくして見やすく */
  object-fit: contain;
  transition: transform 0.1s ease;
  user-select: none; /* テキスト選択を防止 */
}

/* ズームコントロール */
.zoom-controls {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.6);
  padding: 8px 12px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 1001;
}

.zoom-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: none;
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.zoom-btn:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.zoom-btn.reset {
  border-radius: 15px;
  width: auto;
  padding: 0 12px;
  font-size: 12px;
}

.zoom-level {
  color: white;
  font-size: 14px;
  min-width: 50px;
  text-align: center;
}

/* ヘルプテキスト */
.zoom-help {
  position: absolute;
  bottom: 70px;
  left: 50%;
  transform: translateX(-50%);
  color: rgba(255, 255, 255, 0.7);
  font-size: 12px;
  background-color: rgba(0, 0, 0, 0.5);
  padding: 5px 10px;
  border-radius: 10px;
  opacity: 0.7;
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
  z-index: 1002;
}
</style>