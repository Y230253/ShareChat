<script setup>
import { defineProps, ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import authStore from '../authStore.js'
import { api } from '../services/api.js'  // APIサービスをインポート

const props = defineProps({
  photo: Object // 投稿情報
})

const router = useRouter()

// ログイン状態
const isLoggedIn = ref(false)
const errorMsg = ref('')

// メディア要素の参照
const mediaRef = ref(null)
// 表示状態の追跡
const isVisible = ref(false)
// メディアの読み込み状態
const isMediaLoaded = ref(false)

// いいね機能
const liked = ref(false)
const likeCount = ref(props.photo.likeCount || 0)

// API経由でいいね機能を実装
const toggleLike = async () => {
  // ログインチェック
  if (!isLoggedIn.value) {
    errorMsg.value = 'いいねするにはログインが必要です'
    setTimeout(() => {
      errorMsg.value = ''
      router.push('/login')
    }, 1500)
    return
  }

  try {
    if(liked.value) {
      // いいね解除 - APIサービスを使用
      await api.likes.remove(props.photo.id);
      liked.value = false;
      likeCount.value = Math.max(likeCount.value - 1, 0);
    } else {
      // いいね追加 - APIサービスを使用
      await api.likes.add(props.photo.id);
      liked.value = true;
      likeCount.value++;
    }
  } catch (err) {
    console.error("いいね処理中エラー", err);
    errorMsg.value = "処理中にエラーが発生しました";
    setTimeout(() => errorMsg.value = '', 3000);
  }
}

// ブックマーク機能
const isBookmarked = ref(false)
const bookmarkCount = ref(props.photo.bookmarkCount || 0)

// API経由でブックマーク機能を実装
const toggleBookmarkAction = async () => {
  // ログインチェック
  if (!isLoggedIn.value) {
    errorMsg.value = 'ブックマークするにはログインが必要です'
    setTimeout(() => {
      errorMsg.value = ''
      router.push('/login')
    }, 1500)
    return
  }
  
  try {
    if(isBookmarked.value) {
      // ブックマーク解除 - APIサービスを使用
      await api.bookmarks.remove(props.photo.id);
      isBookmarked.value = false;
      bookmarkCount.value = Math.max(bookmarkCount.value - 1, 0);
    } else {
      // ブックマーク追加 - APIサービスを使用
      await api.bookmarks.add(props.photo.id);
      isBookmarked.value = true;
      bookmarkCount.value++;
    }
  } catch (err) {
    console.error("ブックマーク処理中エラー", err);
    errorMsg.value = "処理中にエラーが発生しました";
    setTimeout(() => errorMsg.value = '', 3000);
  }
}

// ユーザーアイコンのコンピューテッドプロパティ
const userIconUrl = computed(() => {
  if (props.photo.user_icon) {
    return props.photo.user_icon;
  }
  return 'https://via.placeholder.com/40'; // デフォルトアイコン
});

// メッセージ省略用の定数
const MAX_MESSAGE_LENGTH = 100 // 最大表示文字数

// 省略表示用のコンピューテッドプロパティ
const truncatedMessage = computed(() => {
  if (!props.photo.message) return '';
  
  if (props.photo.message.length <= MAX_MESSAGE_LENGTH) {
    return props.photo.message;
  }
  
  return props.photo.message.substring(0, MAX_MESSAGE_LENGTH) + '...';
})

// メッセージが長文かどうか
const isLongMessage = computed(() => {
  return props.photo.message && props.photo.message.length > MAX_MESSAGE_LENGTH;
})

// Intersection Observer インスタンス
let observer = null;

// 動画再生の制御
const handleVisibilityChange = (entries) => {
  const entry = entries[0];
  isVisible.value = entry.isIntersecting;
  
  if (props.photo.isVideo && mediaRef.value) {
    if (entry.isIntersecting) {
      // 画面内に表示された場合、動画を再生
      try {
        const playPromise = mediaRef.value.play();
        // play() がPromiseを返す場合（モダンブラウザ）はエラーハンドリング
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            // 自動再生ポリシーによるエラーを無視（ユーザー操作が必要な場合がある）
            console.log('自動再生できません:', error);
          });
        }
      } catch (e) {
        console.log('再生エラー:', e);
      }
    } else {
      // 画面外に出た場合、動画を一時停止
      try {
        mediaRef.value.pause();
      } catch (e) {
        console.log('一時停止エラー:', e);
      }
    }
  }
};

// メディアの読み込み完了イベントハンドラ
const handleMediaLoaded = () => {
  isMediaLoaded.value = true;
};

// 詳細ページへのナビゲーション
const goToDetail = () => {
  router.push(`/detail/${props.photo.id}`);
}

// 初期化
onMounted(() => {
  // ログイン状態の確認
  isLoggedIn.value = authStore.isLoggedIn.value;
  
  // Intersection Observer の設定
  observer = new IntersectionObserver(handleVisibilityChange, {
    root: null, // ビューポートをルートとする
    threshold: 0.1 // 10%以上表示されたら検知
  });
  
  if (mediaRef.value) {
    observer.observe(mediaRef.value);
  }
  
  // いいね・ブックマーク状態の確認
  checkUserInteractions();
  
  // 認証状態の変化を監視
  authStore.$subscribe((_, state) => {
    isLoggedIn.value = state.isLoggedIn;
    // 認証状態が変わったら再チェック
    if (state.isLoggedIn) {
      checkUserInteractions();
    }
  });
});

// いいね・ブックマーク状態のチェック - APIサービスを使用
const checkUserInteractions = async () => {
  if (!isLoggedIn.value) return;
  
  try {
    // チェックAPIを直接呼び出す代わりにAPIサービスを使用
    const [likeData, bookmarkData] = await Promise.allSettled([
      api.likes.check(props.photo.id),
      api.bookmarks.check(props.photo.id)
    ]);
    
    // いいね状態を設定
    if (likeData.status === 'fulfilled' && likeData.value) {
      liked.value = likeData.value.liked || false;
    }
    
    // ブックマーク状態を設定
    if (bookmarkData.status === 'fulfilled' && bookmarkData.value) {
      isBookmarked.value = bookmarkData.value.bookmarked || false;
    }
  } catch (err) {
    console.error("状態チェックエラー:", err);
  }
};

// クリーンアップ
onUnmounted(() => {
  if (observer && mediaRef.value) {
    observer.unobserve(mediaRef.value);
    observer.disconnect();
  }
});
</script>

<template>
  <div class="photo-card" @click="goToDetail">
    <div class="user-info">
      <div class="user-icon-container">
        <img :src="userIconUrl" class="user-icon" alt="User Icon">
      </div>
      <div>
        <p class="username">{{ photo.username || ('ユーザー ' + photo.user_id) }}</p>
        <p class="date">{{ new Date(photo.created_at).toLocaleString('ja-JP') }}</p>
      </div>
    </div>

    <!-- 画像または動画を条件に応じて表示 - コンテナ構造を修正 -->
    <div class="media-container" :class="{ 'loading': !isMediaLoaded }">
      <!-- ローディング表示 -->
      <div v-if="!isMediaLoaded" class="loading-indicator">
        <div class="spinner"></div>
      </div>

      <!-- 動画の場合 -->
      <video 
        v-if="photo.isVideo" 
        ref="mediaRef"
        :src="photo.image_url" 
        class="media" 
        :class="{ 'visible': isVisible }"
        loading="lazy"
        @loadeddata="handleMediaLoaded"
        loop
        muted
        playsinline
        controls
        @click.stop
      ></video>
      
      <!-- 画像の場合 -->
      <img 
        v-else 
        ref="mediaRef"
        :src="photo.image_url" 
        class="media"
        loading="lazy" 
        @load="handleMediaLoaded"
        alt="Uploaded Photo"
        @click.stop
      >
    </div>

    <!-- メッセージ表示を省略形式に変更 -->
    <div class="message-container">
      <p class="message">{{ truncatedMessage }}</p>
      <span v-if="isLongMessage" class="read-more" @click.stop="goToDetail">もっと見る</span>
    </div>

    <!-- タグ表示 -->
    <div class="tags">
      <span v-for="tag in photo.tags" :key="tag" class="tag">{{ tag }}</span>
    </div>

    <!-- いいね・ブックマークボタン -->
    <div class="actions">
      <p v-if="errorMsg" class="error-message">{{ errorMsg }}</p>
      <button @click.stop="toggleLike" :class="{ 'active': liked }">
        {{ liked ? '❤️' : '🤍' }} ({{ likeCount }})
      </button>
      <button @click.stop="toggleBookmarkAction" :class="{ 'active': isBookmarked }">
        {{ isBookmarked ? '📌' : '🔖' }} ({{ bookmarkCount }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.photo-card {
  width: 100%;
  max-width: 500px;
  background: white;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  margin-bottom: 10px;
  cursor: pointer; /* カードをクリック可能に見せる */
}

/* メディアコンテナのスタイル修正 - 白くボケるのを修正 */
.media-container {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
  position: relative;
  padding-top: 56.25%; /* 16:9のアスペクト比 */
  background-color: #f0f0f0; /* プレースホルダー背景 */
}

.media {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain; /* coverからcontainに変更して画像の歪みを防止 */
  border-radius: 10px;
  transition: opacity 0.3s ease;
}

.media:not(.visible) {
  opacity: 0.7; /* 画面外の動画は少し透明に */
}

.media:not(.visible) {
  opacity: 0.7; /* 画面外の動画は少し透明に */
}

.media-container.loading {
  min-height: 200px;
}

.loading-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.7);
  z-index: 1;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #42b983;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.user-icon-container {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  margin-right: 10px;
}

.user-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.username {
  font-weight: bold;
}
.date {
  color: gray;
  font-size: 12px;
}

/* メッセージ表示のスタイル改善 */
.message-container {
  margin: 10px 0;
  overflow: hidden;
}

.message {
  margin: 0;
  line-height: 1.5;
  word-break: break-word;
}

.read-more {
  display: inline-block;
  color: #42b983;
  font-size: 0.9rem;
  margin-top: 5px;
  cursor: pointer;
  font-weight: bold;
}

.read-more:hover {
  text-decoration: underline;
}

.message {
  margin: 10px 0;
}

/* タグ表示のスタイル */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 10px;
}

.tag {
  font-size: 0.8rem;
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 2px 8px;
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.2s;
}

.tag:hover {
  background-color: #c8e6c9;
  text-decoration: underline;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
button.active {
  background-color: #e3f2fd;
  border-color: #2196f3;
}
.error-message {
  color: red;
  font-size: 0.8rem;
  text-align: center;
  width: 100%;
  margin-bottom: 5px;
}

/* ボタンのクリックをカード全体に伝播させないための設定 */
.actions button {
  position: relative;
  z-index: 2;
}
</style>