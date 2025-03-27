<script setup>
import { defineProps, ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import authStore from '../authStore.js'

const props = defineProps({
  photo: Object // 投稿情報
})

const router = useRouter()

// API のベース URL
const apiUrl = 'http://localhost:3000'

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
    // トークン取得
    const token = localStorage.getItem('token')
    if (!token) {
      errorMsg.value = '認証情報が見つかりません'
      setTimeout(() => {
        errorMsg.value = ''
        router.push('/login')
      }, 1500)
      return
    }

    if(liked.value) {
      const response = await fetch(`${apiUrl}/likes`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: props.photo.id })
      })
      if(response.ok) {
        liked.value = false
        likeCount.value = Math.max(likeCount.value - 1, 0)
      } else {
        console.error("いいね解除エラー", await response.text())
      }
    } else {
      const response = await fetch(`${apiUrl}/likes`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: props.photo.id })
      })
      if(response.ok) {
        liked.value = true
        likeCount.value++
      } else {
        console.error("いいね追加エラー", await response.text())
      }
    }
  } catch (err) {
    console.error("いいね処理中エラー", err)
    errorMsg.value = "処理中にエラーが発生しました"
    setTimeout(() => errorMsg.value = '', 3000)
  }
}

// ブックマーク機能
const isBookmarked = ref(false)
const bookmarkCount = ref(props.photo.bookmarkCount || 0)
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
    // トークン取得
    const token = localStorage.getItem('token')
    if (!token) {
      errorMsg.value = '認証情報が見つかりません'
      setTimeout(() => {
        errorMsg.value = ''
        router.push('/login')
      }, 1500)
      return
    }
    
    if(isBookmarked.value) {
      const response = await fetch(`${apiUrl}/bookmarks`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: props.photo.id })
      })
      if(response.ok) {
        isBookmarked.value = false
        bookmarkCount.value = Math.max(bookmarkCount.value - 1, 0)
      } else {
        console.error("ブックマーク解除エラー", await response.text())
      }
    } else {
      const response = await fetch(`${apiUrl}/bookmarks`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ post_id: props.photo.id })
      })
      if(response.ok) {
        isBookmarked.value = true
        bookmarkCount.value++
      } else {
        console.error("ブックマーク追加エラー", await response.text())
      }
    }
  } catch (err) {
    console.error("ブックマーク処理中エラー", err)
    errorMsg.value = "処理中にエラーが発生しました"
    setTimeout(() => errorMsg.value = '', 3000)
  }
}

// ユーザーアイコンのコンピューテッドプロパティ
const userIconUrl = computed(() => {
  if (props.photo.user_icon) {
    return props.photo.user_icon;
  }
  return 'https://via.placeholder.com/40'; // デフォルトアイコン
});

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
  if (isLoggedIn.value) {
    // トークン取得
    const token = localStorage.getItem('token');
    
    // 非同期処理を関数内にラップ
    const checkUserInteractions = async () => {
      try {
        // この投稿をユーザーがいいね済みかチェック - URLを修正
        const likesRes = await fetch(`${apiUrl}/check-like/${props.photo.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (likesRes.ok) {
          const likesData = await likesRes.json();
          liked.value = likesData.liked;
        }
        
        // この投稿をユーザーがブックマーク済みかチェック - URLを修正
        const bookmarksRes = await fetch(`${apiUrl}/check-bookmark/${props.photo.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (bookmarksRes.ok) {
          const bookmarksData = await bookmarksRes.json();
          isBookmarked.value = bookmarksData.bookmarked;
        }
      } catch (err) {
        console.error("状態チェックエラー:", err);
      }
    };
    
    // 非同期関数を実行
    checkUserInteractions();
  }
});

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

    <!-- 画像または動画を条件に応じて表示 -->
    <div class="media-container" :class="{ 'loading': !isMediaLoaded }">
      <!-- ローディング表示 -->
      <div v-if="!isMediaLoaded" class="loading-indicator">
        <div class="spinner"></div>
      </div>

      <!-- 動画の場合 - 画面内表示時のみ自動再生 -->
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
      
      <!-- 画像の場合 - object-fitをcontainに変更 -->
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

    <p class="message">{{ photo.message }}</p>

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

.media-container {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
  position: relative;
  padding-top: 56.25%; /* 16:9のアスペクト比 */
  background-color: #f0f0f0; /* プレースホルダー背景 */
}

.media-container.loading {
  background-color: #f0f0f0;
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

/* 以下は既存のスタイル */
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
.message {
  margin: 10px 0;
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