<script setup>
import { defineProps, ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import authStore from '../authStore.js'
import { api } from '../services/api.js'  // APIサービスを正しくインポート

const props = defineProps({
  photo: Object
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
const likeCount = ref(props.photo?.likeCount || 0)

// いいね機能の処理
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
    console.log(`いいね処理: postId = ${props.photo.id}, 現在の状態 = ${liked.value}`);
    
    if (liked.value) {
      // いいね解除 - APIサービス経由で呼び出し
      await api.likes.remove(props.photo.id);
      liked.value = false;
      likeCount.value = Math.max(0, likeCount.value - 1);
    } else {
      // いいね追加 - APIサービス経由で呼び出し
      await api.likes.add(props.photo.id);
      liked.value = true;
      likeCount.value++;
    }
  } catch (err) {
    console.error("いいね処理中エラー", err);
    errorMsg.value = "いいね処理中にエラーが発生しました";
    setTimeout(() => errorMsg.value = '', 3000);
  }
}

// ブックマーク機能
const isBookmarked = ref(false)
const bookmarkCount = ref(props.photo?.bookmarkCount || 0)

// ブックマーク処理
const toggleBookmark = async () => {
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
    console.log(`ブックマーク処理: postId = ${props.photo.id}, 現在の状態 = ${isBookmarked.value}`);
    
    if (isBookmarked.value) {
      // ブックマーク解除 - APIサービス経由で呼び出し
      await api.bookmarks.remove(props.photo.id);
      isBookmarked.value = false;
      bookmarkCount.value = Math.max(0, bookmarkCount.value - 1);
    } else {
      // ブックマーク追加 - APIサービス経由で呼び出し
      await api.bookmarks.add(props.photo.id);
      isBookmarked.value = true;
      bookmarkCount.value++;
    }
  } catch (err) {
    console.error("ブックマーク処理中エラー", err);
    errorMsg.value = "ブックマーク処理中にエラーが発生しました";
    setTimeout(() => errorMsg.value = '', 3000);
  }
}

// ユーザーアイコンのコンピューテッドプロパティ
const userIconUrl = computed(() => {
  if (props.photo.user_icon) {
    return props.photo.user_icon;
  }
  // 信頼できる画像サーバーを使用
  return 'https://ui-avatars.com/api/?name=' + (props.photo.username || 'User') + '&background=random';
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

// Intersection Observer のインスタンス
let observer = null;

// 表示状態の変更処理
const handleVisibilityChange = entries => {
  for (const entry of entries) {
    isVisible.value = entry.isIntersecting;
    
    // 表示されたら、遅延読み込みを行う
    if (isVisible.value && !isMediaLoaded.value && mediaRef.value) {
      // 実際のsrcを設定
      if (props.photo.isVideo) {
        mediaRef.value.src = props.photo.image_url;
      } else {
        const img = new Image();
        img.onload = () => {
          if (mediaRef.value) {
            mediaRef.value.src = props.photo.image_url;
            isMediaLoaded.value = true;
          }
        };
        img.src = props.photo.image_url;
      }
    }
  }
};

// 詳細ページに遷移
const goToDetail = () => {
  router.push(`/detail/${props.photo.id}`);
};

// 初期化
onMounted(() => {
  // ログイン状態の確認
  isLoggedIn.value = authStore.isLoggedIn.value;
  
  // Intersection Observer の設定
  observer = new IntersectionObserver(handleVisibilityChange, {
    root: null,
    threshold: 0.1
  });
  
  if (mediaRef.value) {
    observer.observe(mediaRef.value);
  }
  
  // いいね・ブックマーク状態を確認
  checkUserInteractions();
  
  // 認証状態の変化を監視
  authStore.$subscribe((_, state) => {
    isLoggedIn.value = state.isLoggedIn;
    if (state.isLoggedIn) {
      checkUserInteractions();
    }
  });
});

// いいね・ブックマーク状態のチェック
const checkUserInteractions = async () => {
  if (!isLoggedIn.value || !props.photo) return;
  
  try {
    // 両方の状態を並行して取得
    const [likeStatus, bookmarkStatus] = await Promise.allSettled([
      api.likes.check(props.photo.id),
      api.bookmarks.check(props.photo.id)
    ]);
    
    // いいね状態を設定
    if (likeStatus.status === 'fulfilled' && likeStatus.value) {
      liked.value = likeStatus.value.liked;
      console.log(`いいね状態取得: ${props.photo.id} => ${liked.value}`);
    }
    
    // ブックマーク状態を設定
    if (bookmarkStatus.status === 'fulfilled' && bookmarkStatus.value) {
      isBookmarked.value = bookmarkStatus.value.bookmarked;
      console.log(`ブックマーク状態取得: ${props.photo.id} => ${isBookmarked.value}`);
    }
  } catch (err) {
    console.error("状態チェックエラー:", err);
  }
};

onUnmounted(() => {
  // Observer の解除
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
      <button @click.stop="toggleBookmark" :class="{ 'active': isBookmarked }">
        {{ isBookmarked ? '📌' : '🔖' }} ({{ bookmarkCount }})
      </button>
    </div>
  </div>
  <div class="error-message" v-if="errorMsg">{{ errorMsg }}</div>
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

.error-message {
  background-color: rgba(255, 0, 0, 0.1);
  color: #c00;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 8px;
  text-align: center;
}
</style>