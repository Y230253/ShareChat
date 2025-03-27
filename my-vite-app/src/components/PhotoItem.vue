<script setup>
import { defineProps, ref, onMounted } from 'vue'
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

// 初期化 - ログイン状態とユーザーの「いいね」「ブックマーク」状態の確認
onMounted(async () => {
  // ログイン状態の確認
  isLoggedIn.value = authStore.isLoggedIn.value
  
  if (isLoggedIn.value) {
    // トークン取得
    const token = localStorage.getItem('token')
    
    try {
      // この投稿をユーザーがいいね済みかチェック - URLを修正
      const likesRes = await fetch(`${apiUrl}/check-like/${props.photo.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (likesRes.ok) {
        const likesData = await likesRes.json()
        liked.value = likesData.liked
      }
      
      // この投稿をユーザーがブックマーク済みかチェック - URLを修正
      const bookmarksRes = await fetch(`${apiUrl}/check-bookmark/${props.photo.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (bookmarksRes.ok) {
        const bookmarksData = await bookmarksRes.json()
        isBookmarked.value = bookmarksData.bookmarked
      }
    } catch (err) {
      console.error("状態チェックエラー:", err)
    }
  }
})
</script>

<template>
  <div class="photo-card">
    <div class="user-info">
      <img :src="photo.userIcon || 'https://via.placeholder.com/40'" class="user-icon" alt="User Icon">
      <div>
        <p class="username">{{ photo.username || ('ユーザー ' + photo.user_id) }}</p>
        <p class="date">{{ new Date(photo.created_at).toLocaleString('ja-JP') }}</p>
      </div>
    </div>

    <!-- 画像または動画を条件に応じて表示 -->
    <div class="media-container">
      <!-- 動画の場合 - 自動再生、ループ、音声オフ、プレイヤーコントロール付き -->
      <video 
        v-if="photo.isVideo" 
        :src="photo.image_url" 
        class="media" 
        autoplay
        loop
        muted
        playsinline
        controls
      ></video>
      <!-- 画像の場合 -->
      <img 
        v-else 
        :src="photo.image_url" 
        class="media" 
        alt="Uploaded Photo"
      >
    </div>

    <p class="message">{{ photo.message }}</p>

    <!-- いいね・ブックマークボタン -->
    <div class="actions">
      <p v-if="errorMsg" class="error-message">{{ errorMsg }}</p>
      <button @click="toggleLike" :class="{ 'active': liked }">
        {{ liked ? '❤️ いいね済' : '🤍 いいね' }} ({{ likeCount }})
      </button>
      <button @click="toggleBookmarkAction" :class="{ 'active': isBookmarked }">
        {{ isBookmarked ? '📌 ブックマーク済' : '🔖 ブックマーク' }} ({{ bookmarkCount }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.photo-card {
  width: 100%;
  max-width: 500px;
  background: white;
  padding: 15px;
  border-radius: 10px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  margin-bottom: 20px;
}

.media-container {
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
  position: relative;
  padding-top: 56.25%; /* 16:9のアスペクト比 */
}

.media {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
}

/* 以下は既存のスタイル */
.user-info {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}
.user-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
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
</style>